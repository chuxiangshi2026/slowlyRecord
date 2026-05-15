/**
 * 同步文件导出导入工具
 *
 * 支持 JSON 和二进制（MessagePack-like 压缩）格式。
 * JSON 可读性好，二进制体积小。
 * 使用 pako (zlib) 做二进制压缩。
 */
import type { SyncData, SyncFormat } from '@/types/sync'
import { SYNC_VERSION } from '@/types/sync'
import { collectSyncData, restoreSyncData, DEFAULT_RESTORE_OPTIONS, type RestoreOptions, type RestoreResult } from '@/utils/sync-manager'
import { log } from '@/utils/logger'
import pako from 'pako'

// 二进制文件魔数（用于识别文件格式）
const BINARY_MAGIC = new Uint8Array([0x53, 0x52, 0x53, 0x59]) // 'SRSY' = SlowlyRecord SYnc
const BINARY_VERSION = 1

/** 导出文件扩展名 */
export const FILE_EXT_JSON = '.slowlyrecord.json'
export const FILE_EXT_BINARY = '.slowlyrecord.bin'

/**
 * 导出同步数据为 JSON 字符串
 */
export function exportToJson(data: SyncData): string {
  return JSON.stringify(data)
}

/**
 * 从 JSON 字符串解析同步数据
 */
export function importFromJson(jsonStr: string): SyncData {
  const data = JSON.parse(jsonStr) as SyncData
  validateSyncData(data)
  return data
}

/**
 * 导出同步数据为二进制格式
 * 格式: [magic(4B)] [version(1B)] [pako_compressed_json]
 * 使用 TextEncoder + pako 压缩，不依赖 MessagePack
 */
export async function exportToBinary(data: SyncData): Promise<Uint8Array> {
  const jsonStr = JSON.stringify(data)
  const jsonBytes = new TextEncoder().encode(jsonStr)

  // pako 压缩
  const compressed = pako.deflate(jsonBytes)

  // 拼接: magic + version + compressed data
  const result = new Uint8Array(4 + 1 + compressed.length)
  result.set(BINARY_MAGIC, 0)
  result[4] = BINARY_VERSION
  result.set(compressed, 5)

  return result
}

/**
 * 从二进制格式解析同步数据
 */
export async function importFromBinary(buffer: ArrayBuffer): Promise<SyncData> {
  const bytes = new Uint8Array(buffer)

  // 检查魔数
  if (bytes.length < 5 ||
    bytes[0] !== BINARY_MAGIC[0] ||
    bytes[1] !== BINARY_MAGIC[1] ||
    bytes[2] !== BINARY_MAGIC[2] ||
    bytes[3] !== BINARY_MAGIC[3]) {
    // 不是二进制格式，尝试当作 JSON 解析
    const text = new TextDecoder().decode(bytes)
    return importFromJson(text)
  }

  const version = bytes[4]
  const payload = bytes.slice(5)

  const jsonBytes = pako.inflate(payload)

  const jsonStr = new TextDecoder().decode(jsonBytes)
  const data = JSON.parse(jsonStr) as SyncData
  validateSyncData(data)
  return data
}

/**
 * 自动检测文件格式并导入
 */
export async function importFromFile(file: File): Promise<SyncData> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // 检测是否为二进制格式
  if (bytes.length >= 5 &&
    bytes[0] === BINARY_MAGIC[0] &&
    bytes[1] === BINARY_MAGIC[1] &&
    bytes[2] === BINARY_MAGIC[2] &&
    bytes[3] === BINARY_MAGIC[3]) {
    return importFromBinary(buffer)
  }

  // 否则当作 JSON
  const text = new TextDecoder().decode(buffer)
  return importFromJson(text)
}

/**
 * 校验同步数据基本结构
 */
function validateSyncData(data: SyncData) {
  if (!data || typeof data !== 'object') {
    throw new Error('无效的同步数据格式')
  }
  if (!data.version || !data.exportedAt) {
    throw new Error('同步数据缺少必要字段 (version, exportedAt)')
  }
  if (data.version > SYNC_VERSION) {
    throw new Error(`数据版本(${data.version})高于当前支持版本(${SYNC_VERSION})，请更新应用`)
  }
}

/**
 * 触发浏览器下载导出文件
 */
export async function downloadSyncFile(format: SyncFormat = 'json'): Promise<void> {
  const data = await collectSyncData()
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '')

  if (format === 'binary') {
    const binary = await exportToBinary(data)
    const blob = new Blob([binary], { type: 'application/octet-stream' })
    triggerDownload(blob, `slowlyrecord_backup_${timestamp}${FILE_EXT_BINARY}`)
  } else {
    const json = exportToJson(data)
    const blob = new Blob([json], { type: 'application/json' })
    triggerDownload(blob, `slowlyrecord_backup_${timestamp}${FILE_EXT_JSON}`)
  }
}

/**
 * 选择文件并导入同步数据
 */
export async function pickAndImportSyncFile(options?: Partial<RestoreOptions>): Promise<RestoreResult> {
  const file = await pickFile()
  if (!file) {
    return {
      success: false,
      wordBanksRestored: 0,
      userSettingsRestored: false,
      textMemoryRestored: false,
      numberMemoryRestored: false,
      shortcutMemoryRestored: false,
      letterMemoryRestored: false,
      errors: ['未选择文件'],
    }
  }

  const data = await importFromFile(file)
  const restoreOpts = { ...DEFAULT_RESTORE_OPTIONS, ...options }
  return restoreSyncData(data, restoreOpts)
}

// ==================== 浏览器辅助 ====================

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  // 延迟释放 URL 对象，确保下载开始
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

function pickFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = `.json,.bin,${FILE_EXT_JSON},${FILE_EXT_BINARY}`
    input.onchange = () => {
      const file = input.files?.[0] || null
      resolve(file)
    }
    // 取消选择
    input.oncancel = () => resolve(null)
    input.click()
  })
}

/**
 * 获取同步数据的统计摘要（用于预览）
 */
export function getSyncDataSummary(data: SyncData) {
  const totalWords = data.wordBanks?.reduce((sum, b) => sum + (b.words?.length || 0), 0) || 0
  return {
    exportedAt: new Date(data.exportedAt).toLocaleString(),
    platform: data.platform,
    wordBankCount: data.wordBanks?.length || 0,
    totalWords,
    hasUserSettings: !!data.userSettings,
    textArticleCount: data.textMemory?.articles?.length || 0,
    numberMemoryEntryCount: data.numberMemory?.entries?.length || 0,
    shortcutCategoryCount: data.shortcutMemory?.customCategories?.length || 0,
  }
}
