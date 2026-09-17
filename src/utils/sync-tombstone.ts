/**
 * 同步墓碑（tombstone）存取层
 *
 * 解决多端同步的「删除复活」问题：设备 A 删除条目后写入墓碑，
 * 设备 B 推送旧数据时，restore 端按墓碑过滤，被删条目不再复活。
 *
 * 存储：跨模块共享单文档（id 全局唯一，各模块共用一个 id 池）：
 *   { _id: 'slowly-record-sync-tombstones', type: 'sync-tombstones',
 *     tombstones: Record<id, deletedAt>, updatedAt }
 *
 * 墓碑保留窗口期（默认 30 天）后由 pruneTombstones 清理，避免无限膨胀。
 */
import { getDbAdapter } from '@/adapters/db'
import { log } from '@/utils/logger'

export const TOMBSTONES_DOC_ID = 'slowly-record-sync-tombstones'

/** 墓碑保留窗口期：默认 30 天 */
export const TOMBSTONE_MAX_AGE_MS = 30 * 24 * 3600 * 1000

interface TombstonesDoc {
  _id: string
  _rev?: string
  type: 'sync-tombstones'
  /** id → 删除时间戳（deletedAt） */
  tombstones: Record<string, number>
  updatedAt: number
}

/**
 * 读取墓碑表（无文档时返回空对象）
 */
export function getTombstones(): Record<string, number> {
  try {
    const db = getDbAdapter()
    const doc = db.get(TOMBSTONES_DOC_ID) as TombstonesDoc | null
    if (doc && doc.type === 'sync-tombstones' && doc.tombstones) {
      return { ...doc.tombstones }
    }
  } catch (e) {
    log.e('读取墓碑表失败', e)
  }
  return {}
}

/**
 * 记录一条墓碑（fire-and-forget 调用方无需 await，本函数永不 reject）
 * 带 _rev 写入，conflict 时重读重试一次
 */
export async function recordTombstone(id: string): Promise<void> {
  if (!id) return
  try {
    const db = getDbAdapter()

    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = db.get(TOMBSTONES_DOC_ID) as TombstonesDoc | null
      const doc: TombstonesDoc = {
        _id: TOMBSTONES_DOC_ID,
        type: 'sync-tombstones',
        tombstones: { ...(existing?.tombstones || {}), [id]: Date.now() },
        updatedAt: Date.now(),
      }
      if (existing?._rev) {
        doc._rev = existing._rev
      }
      const result = await db.promises.put(doc)
      if (result.ok) return
      if (!result.message?.includes('conflict')) {
        log.e('写入墓碑失败:', result.message)
        return
      }
      // conflict：下一轮循环重读最新 _rev 重试
    }
  } catch (e) {
    // DB 未初始化等异常只记日志：墓碑是尽力而为的同步辅助数据，不能影响删除主流程
    log.e('记录墓碑失败', id, e)
  }
}

/**
 * 合并远端墓碑到本地（两侧取较大 deletedAt），随后清理过期墓碑
 * @returns 合并后的墓碑表
 */
export async function mergeTombstones(remote: Record<string, number> | undefined): Promise<Record<string, number>> {
  const local = getTombstones()
  // 空对象（桌面 payload 固定带 tombstones 字段）不视为「有远端墓碑」，避免无谓回写
  if (remote && Object.keys(remote).length > 0) {
    for (const [id, deletedAt] of Object.entries(remote)) {
      if (!(id in local) || (deletedAt || 0) > (local[id] || 0)) {
        local[id] = deletedAt || 0
      }
    }
    // 有远端墓碑时统一回写（含清理结果）
    await pruneTombstones(TOMBSTONE_MAX_AGE_MS, local)
  }
  return local
}

/**
 * 清理早于窗口期的墓碑并回写
 * @param tombstones 指定要清理的墓碑表（缺省读本地文档）
 */
export async function pruneTombstones(maxAgeMs = TOMBSTONE_MAX_AGE_MS, tombstones?: Record<string, number>): Promise<void> {
  try {
    const db = getDbAdapter()

    for (let attempt = 0; attempt < 2; attempt++) {
      const existing = db.get(TOMBSTONES_DOC_ID) as TombstonesDoc | null
      const source = tombstones ?? (existing?.tombstones || {})
      const now = Date.now()
      const kept: Record<string, number> = {}
      for (const [id, deletedAt] of Object.entries(source)) {
        if (now - (deletedAt || 0) <= maxAgeMs) {
          kept[id] = deletedAt
        }
      }
      // 从未有过墓碑文档且没有可保留内容：跳过写入，避免无谓建文档
      if (!existing && Object.keys(kept).length === 0) return
      const doc: TombstonesDoc = {
        _id: TOMBSTONES_DOC_ID,
        type: 'sync-tombstones',
        tombstones: kept,
        updatedAt: now,
      }
      if (existing?._rev) {
        doc._rev = existing._rev
      }
      const result = await db.promises.put(doc)
      if (result.ok) return
      if (!result.message?.includes('conflict')) {
        log.e('回写清理后的墓碑失败:', result.message)
        return
      }
      // conflict：下一轮循环重读最新 _rev 重试
    }
  } catch (e) {
    log.e('清理墓碑失败', e)
  }
}

/**
 * 按墓碑过滤条目（核心过滤逻辑）
 * - source === 'remote'：远端拉回时剔除「墓碑 deletedAt 不早于条目更新时间」的条目，不让已删条目进来
 * - source === 'local'：本地推送时剔除同条件条目（本地删除后条目已不在列表，此分支为兜底）
 *
 * @param items  待过滤条目（取 _id || id 作为墓碑键）
 * @param tombstones 墓碑表
 */
export function filterByTombstones<T extends { _id?: string; id?: string; updatedAt?: number; utime?: number }>(
  items: T[],
  source: 'local' | 'remote',
  tombstones: Record<string, number>,
): T[] {
  if (!items?.length || !tombstones || Object.keys(tombstones).length === 0) {
    // 墓碑表为空：无需过滤，返回副本保持调用方语义稳定
    return [...(items || [])]
  }
  return items.filter((item) => {
    const id = item?._id || item?.id
    if (!id) return true
    const deletedAt = tombstones[id]
    if (deletedAt === undefined) return true
    const itemTime = item?.updatedAt || item?.utime || 0
    // 墓碑晚于条目最后更新：条目是被删后回流的旧数据，剔除
    if (deletedAt >= itemTime) {
      return false
    }
    return true
  })
}
