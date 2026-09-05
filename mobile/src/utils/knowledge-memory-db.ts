/**
 * 通用知识包进度持久化（移动端）
 *
 * 移植自桌面端 src/utils/knowledge-memory-db.ts（去掉自建条目部分）：
 * 每个知识包一条文档，存储该包所有条目的 SRS 进度。
 * doc id 与桌面端保持一致（同步互通的前提）。
 */
import type {
  KnowledgePackProgressDoc,
  KnowledgeItemProgress,
  KnowledgeImportedDoc,
  MobileKnowledgeMemory,
} from '@/stores/useUtils/types'
import { getDbAdapter } from '@/adapters/index'
import { createDefaultProgress } from './knowledge-memory-srs'

const DB_KEY_KNOWLEDGE_MEMORY = 'knowledge_memory_'

/** 已导入知识包清单文档 ID（与桌面端一致） */
export const IMPORTED_LIST_DOC_ID = 'knowledge_memory_imported'

function progressDocId(packId: string): string {
  return DB_KEY_KNOWLEDGE_MEMORY + packId
}

/**
 * 读取某知识包的进度文档
 * 旧数据或缺项时自动补全默认进度（不修改原 DB，仅内存兜底）
 */
export function getProgressDoc(packId: string): KnowledgePackProgressDoc {
  const id = progressDocId(packId)
  const doc = getDbAdapter().get<KnowledgePackProgressDoc>(id)
  if (doc && typeof doc === 'object') {
    return {
      _id: doc._id || id,
      _rev: doc._rev,
      type: 'knowledge_pack_progress',
      packId,
      items: doc.items && typeof doc.items === 'object' ? doc.items : {},
    }
  }
  return {
    _id: id,
    type: 'knowledge_pack_progress',
    packId,
    items: {},
  }
}

/**
 * 保存某知识包的进度文档
 */
export function saveProgressDoc(doc: KnowledgePackProgressDoc): void {
  try {
    const result = getDbAdapter().put({ ...doc, _id: progressDocId(doc.packId) })
    if (result.ok && result.rev) {
      doc._rev = result.rev
    }
  } catch (e) {
    console.error('知识包进度持久化失败:', e)
  }
}

/**
 * 获取某条目的进度（不存在则返回默认进度）
 */
export function getItemProgress(
  packId: string,
  itemId: string,
): KnowledgeItemProgress {
  const doc = getProgressDoc(packId)
  return doc.items[itemId] || createDefaultProgress(itemId)
}

/**
 * 清空某知识包的全部进度
 */
export function clearProgressDoc(packId: string): void {
  try {
    const doc = getProgressDoc(packId)
    if (doc._rev) {
      getDbAdapter().remove(doc._id)
    }
  } catch (e) {
    console.error('清空知识包进度失败:', e)
  }
}

/**
 * 判断某知识包是否已存在进度文档（用于兼容老用户：有进度即视为已导入）
 */
export function hasProgressDoc(packId: string): boolean {
  const doc = getDbAdapter().get(progressDocId(packId))
  return !!(doc && doc._rev)
}

/**
 * 读取已导入知识包清单（无文档时返回空数组）
 */
export function getImportedIds(): string[] {
  const doc = getDbAdapter().get<KnowledgeImportedDoc>(IMPORTED_LIST_DOC_ID)
  if (doc && Array.isArray(doc.ids)) {
    return [...doc.ids]
  }
  return []
}

/**
 * 保存已导入知识包清单
 */
function saveImportedIds(ids: string[]): void {
  try {
    const existing = getDbAdapter().get<KnowledgeImportedDoc>(IMPORTED_LIST_DOC_ID)
    getDbAdapter().put({
      _id: IMPORTED_LIST_DOC_ID,
      _rev: existing?._rev,
      type: 'knowledge_imported_list',
      ids,
    })
  } catch (e) {
    console.error('已导入知识包清单持久化失败:', e)
  }
}

/**
 * 将知识包加入已导入清单（幂等）
 */
export function addImportedId(packId: string): void {
  const ids = getImportedIds()
  if (ids.includes(packId)) return
  ids.push(packId)
  saveImportedIds(ids)
}

/**
 * 将知识包从已导入清单移除（仅下架，不删进度文档）
 */
export function removeImportedId(packId: string): void {
  const ids = getImportedIds()
  const next = ids.filter(id => id !== packId)
  if (next.length === ids.length) return
  saveImportedIds(next)
}

// ==================== 同步 collect / restore ====================

/**
 * 收集知识库同步数据：已导入清单 + 每包条目进度
 * 进度文档按 allDocs 扫描（含不在清单中但有进度的包，兼容旧数据）
 */
export function collectKnowledgeSyncData(): MobileKnowledgeMemory | null {
  try {
    const db = getDbAdapter()
    const importedIds = getImportedIds()
    const progressDocs = db.allDocs<KnowledgePackProgressDoc>(DB_KEY_KNOWLEDGE_MEMORY)
      .filter(d => (d as any).type === 'knowledge_pack_progress')

    const packIds = new Set<string>([
      ...importedIds,
      ...progressDocs.map(d => (d as any).packId).filter(Boolean),
    ])
    if (packIds.size === 0) return null

    const packs: Record<string, Record<string, KnowledgeItemProgress>> = {}
    for (const packId of packIds) {
      const doc = getProgressDoc(packId)
      if (Object.keys(doc.items).length > 0) {
        packs[packId] = doc.items
      }
    }

    if (Object.keys(packs).length === 0 && importedIds.length === 0) return null
    return { importedIds: [...packIds], packs }
  } catch (e) {
    console.error('收集知识库同步数据失败:', e)
    return null
  }
}

/**
 * 还原知识库同步数据：并入已导入清单 + 按包合并条目进度
 * 进度条目按 learnDate 较新者保留（双向 merge，不丢本地进度）
 */
export function restoreKnowledgeSyncData(data: MobileKnowledgeMemory): number {
  let mergedPacks = 0
  try {
    const importedIds = new Set<string>([...getImportedIds(), ...(data.importedIds || [])])
    for (const packId of importedIds) {
      addImportedId(packId)
    }

    for (const [packId, items] of Object.entries(data.packs || {})) {
      if (!items || typeof items !== 'object') continue
      const doc = getProgressDoc(packId)
      const merged: Record<string, KnowledgeItemProgress> = { ...doc.items }
      for (const [itemId, progress] of Object.entries(items)) {
        const local = merged[itemId]
        if (!local || (progress?.learnDate || 0) > (local.learnDate || 0)) {
          merged[itemId] = progress
        }
      }
      doc.items = merged
      saveProgressDoc(doc)
      mergedPacks++
    }
  } catch (e) {
    console.error('还原知识库同步数据失败:', e)
  }
  return mergedPacks
}
