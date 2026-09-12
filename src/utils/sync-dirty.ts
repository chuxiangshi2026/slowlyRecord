/**
 * 同步脏标记
 *
 * 通过「最后一次本地写入时间 > 最后一次同步时间」判断是否存在未同步改动。
 * 写入动作由 db 适配器代理统一捕获，避免每个业务模块各自埋点。
 */
import {ref} from 'vue'
import {getDbStorage} from '@/adapters/db'

const LAST_CHANGE_KEY = 'slowlyrecord_sync_last_change'
const LAST_SYNC_KEY = 'slowlyrecord_sync_last_sync'

/** 是否存在未同步改动（响应式，供头部状态点使用） */
export const syncDirty = ref(false)

function readTs(key: string): number {
  try {
    const v = getDbStorage().getItem(key)
    return typeof v === 'number' ? v : 0
  } catch {
    return 0
  }
}

function writeTs(key: string, ts: number): void {
  try {
    getDbStorage().setItem(key, ts)
  } catch {
    // 存储不可用时静默降级：头部不显示未同步点，不影响主流程
  }
}

/** 重新计算脏标记（应用启动 / 同步完成后调用）；未同步过的用户不显示未同步点，避免噪音 */
export function refreshSyncDirty(): void {
  const lastSync = readTs(LAST_SYNC_KEY)
  syncDirty.value = lastSync > 0 && readTs(LAST_CHANGE_KEY) > lastSync
}

/** 标记发生本地写入 */
export function markLocalChange(ts: number = Date.now()): void {
  writeTs(LAST_CHANGE_KEY, ts)
  refreshSyncDirty()
}

/** 标记已完成一次全量同步 */
export function markSynced(ts: number = Date.now()): void {
  writeTs(LAST_SYNC_KEY, ts)
  refreshSyncDirty()
}

/** 距上次同步的天数；从未同步过返回 -1 */
export function daysSinceLastSync(): number {
  const lastSync = readTs(LAST_SYNC_KEY)
  if (lastSync <= 0) return -1
  return Math.floor((Date.now() - lastSync) / 86400000)
}
