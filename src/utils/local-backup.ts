/**
 * 本地全量备份/恢复（单个 JSON 文件）
 *
 * 覆盖：数据库全部文档（词库/设置/句子/记忆宫殿/数字字母映射/听写/知识库等）+
 * 商店版本机大体积存储（宫殿桩图、映射图片、自定义背景图、外置词典分块）。
 *
 * 审核合规：导出是用户主动触发的本地文件行为，不经任何服务器；商店版密钥在
 * user-set 文档中本就是 AES-GCM 密文（enc:v1: 前缀），导出文件不落明文。
 *
 * 跨版本兼容：
 *  - 主分支备份 → 商店版：图片 dataURL 内联在文档里，读取侧既有「旧版迁移」自动落本机；
 *    明文密钥由 user-set 读取侧的遗留迁移自动改写为密文。
 *  - 商店版备份 → 非商店端：bulk: 引用递归还原为 dataURL；词典分块合并为整文档；
 *    宫殿图片文档以 bulk 完整版覆盖 refs 版；enc:v1: 密文密钥解密回明文。
 *  - 恢复语义为按 _id 覆盖式 upsert（不删除本端多出的文档），完成后需刷新页面。
 */
import { getDbAdapter } from '@/adapters/db'
import { getFileAdapter } from '@/adapters/file'
import { isStoreLocalOnly, localBulkEntries, localBulkSet } from '@/adapters/local-bulk-store'
import { encryptSecret, hasSecretCrypto, isEncryptedSecret } from '@/utils/secret-crypto'
import { DB_KEY_USER_SET } from '@/constants'
import cloneDeep from 'lodash.clonedeep'

const BACKUP_KIND = 'slowlyrecord-local-backup'
const BACKUP_VERSION = 1

/** 与 dictionary-db.ts 的本机存储键约定一致（避免循环依赖，此处复制常量） */
const DICT_DOC_KEY = 'external_dictionary'
const DICT_META_KEY = 'external_dictionary_meta'
const DICT_CHUNK_PREFIX = 'external_dictionary_chunk_'

export interface LocalBackupFile {
  kind: typeof BACKUP_KIND
  version: number
  exportedAt: string
  platform: string
  storeBuild: boolean
  /** 数据库全量文档 */
  docs: Record<string, any>[]
  /** 商店版本机大体积存储（非商店版为空对象） */
  bulk: Record<string, any>
}

/** 收集全量备份数据 */
export function buildLocalBackup(): LocalBackupFile {
  const docs = getDbAdapter().allDocs('') as Record<string, any>[]
  const bulk: Record<string, any> = {}
  if (isStoreLocalOnly()) {
    for (const [key, value] of localBulkEntries()) {
      bulk[key] = value
    }
  }
  return {
    kind: BACKUP_KIND,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    platform: __PLATFORM__,
    storeBuild: isStoreLocalOnly(),
    docs: cloneDeep(docs),
    bulk: cloneDeep(bulk),
  }
}

/** 导出为本地 JSON 文件，返回文件名与规模统计 */
export async function exportLocalBackupToFile(): Promise<{ fileName: string; docs: number; bulk: number }> {
  const backup = buildLocalBackup()
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  const fileName = `slowlyrecord-backup-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}.json`
  await getFileAdapter().downloadFile(JSON.stringify(backup), fileName)
  return { fileName, docs: backup.docs.length, bulk: Object.keys(backup.bulk).length }
}

/** 解析并校验备份文件内容，非法文件抛错 */
export function parseLocalBackup(text: string): LocalBackupFile {
  let data: any
  try {
    data = JSON.parse(text)
  } catch {
    throw new Error('备份文件不是有效的 JSON')
  }
  if (!data || data.kind !== BACKUP_KIND) {
    throw new Error('不是慢记备份文件（缺少标识）')
  }
  if (typeof data.version !== 'number' || data.version > BACKUP_VERSION) {
    throw new Error(`备份文件版本过新（v${data.version}），请升级应用后再导入`)
  }
  if (!Array.isArray(data.docs)) {
    throw new Error('备份文件损坏（缺少数据文档）')
  }
  return data as LocalBackupFile
}

/** 把 bulk: 引用就地还原为 dataURL（商店版备份导入非商店端时使用） */
function resolveBulkRefsDeep(node: any, bulk: Record<string, any>): void {
  if (!node || typeof node !== 'object') return
  if (Array.isArray(node)) {
    for (let i = 0; i < node.length; i++) {
      const v = node[i]
      if (typeof v === 'string' && v.startsWith('bulk:') && Object.prototype.hasOwnProperty.call(bulk, v)) node[i] = bulk[v]
      else resolveBulkRefsDeep(v, bulk)
    }
    return
  }
  for (const key of Object.keys(node)) {
    const v = node[key]
    if (typeof v === 'string' && v.startsWith('bulk:') && Object.prototype.hasOwnProperty.call(bulk, v)) node[key] = bulk[v]
    else resolveBulkRefsDeep(v, bulk)
  }
}

/**
 * 恢复写库前统一保证密钥为密文：明文重新加密，已是密文的保持原样。
 * 无法安全加密时在写入任何文档前中止，绝不把备份中的明文写入本地数据库。
 */
async function normalizeDocSecretsForStorage(doc: Record<string, any>): Promise<void> {
  const maps = [doc.keys, doc.ocrKeys]
  const hasAnySecret = maps.some(map => map && typeof map === 'object' && Object.values(map).some(entry => {
    const e = entry as { appkey?: string; key?: string } | undefined
    return !!e && (!!e.appkey || !!e.key)
  }))
  if (!hasAnySecret) return
  if (!hasSecretCrypto()) {
    throw new Error('当前环境不支持密钥加密，也不支持密钥解密，已中止恢复；请在 HTTPS 或桌面安全环境中导入')
  }
  const encryptMap = async (map: any) => {
    if (!map || typeof map !== 'object') return
    for (const entry of Object.values(map)) {
      const e = entry as { appkey?: string; key?: string }
      if (!e) continue
      if (e.appkey && !isEncryptedSecret(e.appkey)) e.appkey = await encryptSecret(e.appkey)
      if (e.key && !isEncryptedSecret(e.key)) e.key = await encryptSecret(e.key)
    }
  }
  for (const map of maps) await encryptMap(map)
}

/**
 * 应用备份（覆盖式 upsert，不删除本端多出的文档）。
 * 返回恢复的文档数与本机大体积条目数；调用方负责提示用户刷新页面。
 */
export async function applyLocalBackup(backup: LocalBackupFile): Promise<{ docs: number; bulk: number }> {
  const db = getDbAdapter()
  const bulk = backup.bulk && typeof backup.bulk === 'object' ? backup.bulk : {}
  const hasBulk = Object.keys(bulk).length > 0
  const toNonStore = !isStoreLocalOnly()

  const docs = cloneDeep(backup.docs).filter(d => d && typeof d === 'object' && d._id)

  // 商店版备份 → 非商店端：还原 bulk 数据到文档形态
  if (toNonStore && hasBulk) {
    for (const doc of docs) resolveBulkRefsDeep(doc, bulk)
    const docIndexes = new Map(docs.map((doc, index) => [doc._id, index]))
    const upsert = (doc: Record<string, any>) => {
      const idx = docIndexes.get(doc._id)
      if (idx !== undefined) docs[idx] = doc
      else {
        docIndexes.set(doc._id, docs.length)
        docs.push(doc)
      }
    }
    // 宫殿图片文档：bulk 完整版（含 images dataURL）覆盖 refs 版
    for (const value of Object.values(bulk)) {
      if (value && typeof value === 'object' && (value as any).type === 'memory_palace_images' && (value as any)._id) {
        upsert(cloneDeep(value))
      }
    }
    // 外置词典：分块合并回整文档
    const meta = bulk[DICT_META_KEY] as { version?: string; total?: number; chunks?: number } | undefined
    if (meta && (meta.chunks ?? 0) > 0) {
      const words: Record<string, any> = {}
      for (let i = 0; i < meta.chunks!; i++) {
        const chunk = bulk[DICT_CHUNK_PREFIX + i]
        if (chunk && typeof chunk === 'object') Object.assign(words, chunk)
      }
      upsert({
        _id: DICT_DOC_KEY,
        version: meta.version || '1.0',
        total: meta.total ?? Object.keys(words).length,
        words,
      })
    }
  }

  // 所有桌面端写库前统一规范化密钥：旧备份明文重新加密，已有密文保持
  for (const doc of docs) {
    if (doc._id === DB_KEY_USER_SET || (doc as any).type === 'user-set') {
      await normalizeDocSecretsForStorage(doc)
    }
  }

  // 覆盖式写回：丢弃备份里的 _rev，存在同 _id 文档时沿用其 _rev 覆盖
  let written = 0
  for (const doc of docs) {
    try {
      const { _rev, ...rest } = doc as Record<string, any>
      const existing = db.get(rest._id as string) as Record<string, any> | null
      const toPut = existing?._rev ? { ...rest, _rev: existing._rev } : rest
      if (db.put(toPut as any).ok) written++
    } catch (e) {
      console.warn('[本地备份] 文档写入失败:', (doc as any)._id, e)
    }
  }

  // 商店端：本机大体积存储逐条恢复
  let bulkWritten = 0
  if (isStoreLocalOnly() && hasBulk) {
    for (const [key, value] of Object.entries(bulk)) {
      if (await localBulkSet(key, value)) bulkWritten++
    }
  }

  await db.whenIdle?.()
  return { docs: written, bulk: bulkWritten }
}
