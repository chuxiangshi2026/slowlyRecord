/**
 * 同步 Store
 *
 * 提供响应式的同步状态管理，供 UI 组件使用
 */
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { SyncData, SyncFormat, SyncStatus, SyncServerResult } from '@/types/sync'
import type { RestoreOptions, RestoreResult } from '@/utils/sync-manager'
import { DEFAULT_RESTORE_OPTIONS } from '@/utils/sync-manager'
import { downloadSyncFile, pickAndImportSyncFile, importFromFile, getSyncDataSummary } from '@/utils/sync-file'
import { uploadToServer, downloadFromServer, checkServerAvailable, setSyncServerUrl, resetSyncServer, uploadToServerMobileCompat } from '@/utils/sync-server'
import { NUTSTORE_WEBDAV_URL, checkDirWritable, diagnoseWebDav, normalizeWebDavUrl, testWebDavConnection, uploadToWebDav, downloadFromWebDav } from '@/utils/sync-webdav'
import type { WebDavDiagnosis } from '@/utils/sync-webdav'
import { log } from '@/utils/logger'
import { getDbStorage } from '@/adapters/db'
import { markSynced } from '@/utils/sync-dirty'

// 持久化键
const LS_SERVER_URL = 'sync_server_url'

export const useSyncStore = defineStore('sync', () => {
  // ==================== 状态 ====================

  /** 当前同步状态 */
  const status = ref<SyncStatus>('idle')

  /** 上传后获得的同步码 */
  const syncCode = ref('')

  /** 下载时输入的同步码 */
  const inputCode = ref('')

  /** 服务器是否可用 */
  const serverAvailable = ref<boolean | null>(null) // null = 未检测

  /** 最近一次操作结果消息 */
  const resultMessage = ref('')

  /** 最近一次还原结果 */
  const lastRestoreResult = ref<RestoreResult | null>(null)

  /** 预览数据 */
  const previewData = ref<SyncData | null>(null)

  /** 预览摘要 */
  const previewSummary = computed(() => {
    if (!previewData.value) return null
    return getSyncDataSummary(previewData.value)
  })

  /** 是否正在操作 */
  const isBusy = computed(() => status.value === 'uploading' || status.value === 'downloading')

  /** 自定义服务器地址（持久化，使用 dbStorage 替代 localStorage 以兼容 uTools） */
  const _storage = getDbStorage()
  const savedServerUrl = ref((_storage.getItem(LS_SERVER_URL) as string) || '')

  // ==================== WebDAV（坚果云）配置 ====================

  const LS_WEBDAV_URL = 'sync_webdav_url'
  const LS_WEBDAV_USERNAME = 'sync_webdav_username'
  const LS_WEBDAV_PASSWORD = 'sync_webdav_password'

  const webdavUrl = ref((_storage.getItem(LS_WEBDAV_URL) as string) || NUTSTORE_WEBDAV_URL)
  const webdavUsername = ref((_storage.getItem(LS_WEBDAV_USERNAME) as string) || '')
  const webdavPassword = ref((_storage.getItem(LS_WEBDAV_PASSWORD) as string) || '')

  /** 是否已填写完整凭据 */
  const webdavConfigured = computed(() => !!(webdavUrl.value.trim() && webdavUsername.value.trim() && webdavPassword.value.trim()))

  // ==================== 文件操作 ====================

  /**
   * 导出同步文件
   */
  async function exportFile(format: SyncFormat = 'json') {
    if (isBusy.value) return
    status.value = 'uploading'
    resultMessage.value = ''

    try {
      await downloadSyncFile(format)
      resultMessage.value = `导出成功 (${format === 'binary' ? '二进制' : 'JSON'} 格式)`
    } catch (e) {
      resultMessage.value = `导出失败: ${e}`
      log.e('导出同步文件失败', e)
    } finally {
      status.value = 'idle'
    }
  }

  /**
   * 选择文件导入（仅预览，不还原）
   */
  async function previewFile() {
    if (isBusy.value) return
    resultMessage.value = ''

    try {
      const file = await pickFileOnly()
      if (!file) return

      const data = await importFromFile(file)
      previewData.value = data
      resultMessage.value = '文件解析成功，请确认后还原'
    } catch (e) {
      resultMessage.value = `文件解析失败: ${e}`
      previewData.value = null
      log.e('预览同步文件失败', e)
    }
  }

  /**
   * 确认还原预览数据
   */
  async function confirmRestore(options?: Partial<RestoreOptions>) {
    if (!previewData.value || isBusy.value) return

    status.value = 'downloading'
    resultMessage.value = ''

    try {
      const { restoreSyncData } = await import('@/utils/sync-manager')
      const result = await restoreSyncData(previewData.value, { ...DEFAULT_RESTORE_OPTIONS, ...options })
      lastRestoreResult.value = result
      if (result.success) {
        resultMessage.value = '还原成功'
        previewData.value = null
        markSynced()
      } else {
        resultMessage.value = `还原失败: ${result.errors.join('; ')}`
      }
    } catch (e) {
      resultMessage.value = `还原失败: ${e}`
    } finally {
      status.value = 'idle'
    }
  }

  /**
   * 快速导入（选择文件后直接还原，不预览）
   */
  async function quickImport(options?: Partial<RestoreOptions>) {
    if (isBusy.value) return
    status.value = 'downloading'
    resultMessage.value = ''

    try {
      const result = await pickAndImportSyncFile(options)
      lastRestoreResult.value = result
      if (result.success) {
        resultMessage.value = '导入成功'
        markSynced()
      } else {
        resultMessage.value = `导入失败: ${result.errors.join('; ')}`
      }
    } catch (e) {
      resultMessage.value = `导入失败: ${e}`
    } finally {
      status.value = 'idle'
    }
  }

  /**
   * 清除预览
   */
  function clearPreview() {
    previewData.value = null
    resultMessage.value = ''
  }

  // ==================== 服务器操作 ====================

  /**
   * 检查服务器可用性
   */
  async function checkServer() {
    try {
      serverAvailable.value = await checkServerAvailable()
    } catch {
      serverAvailable.value = false
    }
  }

  /**
   * 上传数据到服务器（推送）
   */
  async function serverUpload(): Promise<SyncServerResult> {
    if (isBusy.value) return { success: false, error: '正在操作中' }

    status.value = 'uploading'
    resultMessage.value = ''
    syncCode.value = ''

    try {
      const result = await uploadToServer()
      if (result.skipped) {
        resultMessage.value = '数据未变更，已跳过上传'
      } else if (result.success && result.code) {
        syncCode.value = result.code
        resultMessage.value = '推送成功'
        markSynced()
      } else {
        resultMessage.value = `推送失败: ${result.error || '未知错误'}`
      }
      return result
    } catch (e) {
      resultMessage.value = `推送失败: ${e}`
      return { success: false, error: String(e) }
    } finally {
      status.value = 'idle'
    }
  }

  /**
   * 上传数据到服务器（移动端兼容格式，供小程序拉取）
   */
  async function serverUploadMobileCompat(): Promise<SyncServerResult> {
    if (isBusy.value) return { success: false, error: '正在操作中' }

    status.value = 'uploading'
    resultMessage.value = ''
    syncCode.value = ''

    try {
      const result = await uploadToServerMobileCompat()
      if (result.success && result.code) {
        syncCode.value = result.code
        resultMessage.value = '推送成功（小程序可拉取）'
        markSynced()
      } else {
        resultMessage.value = `推送失败: ${result.error || '未知错误'}`
      }
      return result
    } catch (e) {
      resultMessage.value = `推送失败: ${e}`
      return { success: false, error: String(e) }
    } finally {
      status.value = 'idle'
    }
  }

  /**
   * 从服务器下载数据并还原（拉取）
   */
  async function serverDownload(code?: string, options?: Partial<RestoreOptions>): Promise<RestoreResult> {
    if (isBusy.value) {
      return makeEmptyResult('正在操作中')
    }

    const syncCodeToUse = code || inputCode.value
    if (!syncCodeToUse.trim()) {
      return makeEmptyResult('请输入同步码')
    }

    status.value = 'downloading'
    resultMessage.value = ''

    try {
      const result = await downloadFromServer(syncCodeToUse.trim(), options)
      lastRestoreResult.value = result
      if (result.success) {
        resultMessage.value = '拉取成功'
        inputCode.value = ''
        markSynced()
      } else {
        resultMessage.value = `拉取失败: ${result.errors.join('; ')}`
      }
      return result
    } catch (e) {
      const failResult = makeEmptyResult(String(e))
      resultMessage.value = `拉取失败: ${e}`
      return failResult
    } finally {
      status.value = 'idle'
    }
  }

  /**
   * 复制同步码到剪贴板
   */
  async function copySyncCode() {
    if (!syncCode.value) return
    try {
      await navigator.clipboard.writeText(syncCode.value)
      resultMessage.value = '同步码已复制到剪贴板'
    } catch {
      const textarea = document.createElement('textarea')
      textarea.value = syncCode.value
      textarea.style.position = 'fixed'
      textarea.style.opacity = '0'
      document.body.appendChild(textarea)
      textarea.select()
      document.execCommand('copy')
      document.body.removeChild(textarea)
      resultMessage.value = '同步码已复制到剪贴板'
    }
  }

  /**
   * 设置自定义服务器地址
   */
  function setCustomServer(url: string) {
    if (url.trim()) {
      setSyncServerUrl(url.trim())
      savedServerUrl.value = url.trim()
      _storage.setItem(LS_SERVER_URL, url.trim())
      resultMessage.value = `已切换到自定义服务器: ${url.trim()}`
    } else {
      resetSyncServer()
      savedServerUrl.value = ''
      _storage.removeItem(LS_SERVER_URL)
      resultMessage.value = '已切换到默认服务器'
    }
    serverAvailable.value = null
  }

  // ==================== WebDAV（坚果云）操作 ====================

  function currentWebDavConfig() {
    return { url: webdavUrl.value.trim(), username: webdavUsername.value.trim(), password: webdavPassword.value.trim() }
  }

  /** 保存 WebDAV 凭据到本地（与应用内 API key 同级存储，不上传）；地址顺手规范化并存回输入框 */
  function saveWebDavConfig() {
    const cfg = currentWebDavConfig()
    const normalizedUrl = normalizeWebDavUrl(cfg.url)
    webdavUrl.value = normalizedUrl
    _storage.setItem(LS_WEBDAV_URL, normalizedUrl)
    _storage.setItem(LS_WEBDAV_USERNAME, cfg.username)
    _storage.setItem(LS_WEBDAV_PASSWORD, cfg.password)
  }

  async function testWebDav(): Promise<{ ok: boolean; message: string }> {
    const result = await testWebDavConnection(currentWebDavConfig())
    resultMessage.value = result.message
    return result
  }

  /** 当前同步目录是否可写：null=尚未检查，true/false=最近一次检查结果 */
  const webdavDirWritable = ref<boolean | null>(null)

  /** 保存配置后即时验证目录可写性（写不进去再引导用户做完整诊断） */
  async function checkWebDavDir(): Promise<boolean> {
    const writable = await checkDirWritable(currentWebDavConfig(), normalizeWebDavUrl(webdavUrl.value))
    webdavDirWritable.value = writable
    return writable
  }

  /** 诊断 WebDAV：逐步执行并返回结构化结果（UI 据此着色与给出修复入口） */
  async function webdavDiagnose(): Promise<WebDavDiagnosis> {
    saveWebDavConfig()
    const diagnosis = await diagnoseWebDav(currentWebDavConfig())
    resultMessage.value = diagnosis.verdict
    return diagnosis
  }

  async function webdavUpload(): Promise<SyncServerResult> {
    if (isBusy.value) return { success: false, error: '正在操作中' }
    if (!webdavConfigured.value) return { success: false, error: '请先填写网盘地址、账号和应用密码' }

    status.value = 'uploading'
    resultMessage.value = ''
    try {
      saveWebDavConfig()
      const result = await uploadToWebDav(currentWebDavConfig())
      if (result.success && result.resolvedDir) {
        // 坚果云根目录不允许直接创建文件，已自动改用可写子目录：记住它，后续备份/恢复直连该目录
        webdavUrl.value = result.resolvedDir
        saveWebDavConfig()
        webdavDirWritable.value = true
        resultMessage.value = `已备份到 ${result.resolvedDir}（已自动改用可写目录，并记入地址栏）`
      } else {
        resultMessage.value = result.success
          ? `已备份到 ${normalizeWebDavUrl(webdavUrl.value)}`
          : `备份失败: ${result.error || '未知错误'}`
        if (result.success) webdavDirWritable.value = true
      }
      if (result.success) markSynced()
      return result
    } catch (e) {
      resultMessage.value = `备份失败: ${e}`
      return { success: false, error: String(e) }
    } finally {
      status.value = 'idle'
    }
  }

  async function webdavDownload(options?: Partial<RestoreOptions>): Promise<RestoreResult> {
    if (isBusy.value) return makeEmptyResult('正在操作中')
    if (!webdavConfigured.value) return makeEmptyResult('请先填写网盘地址、账号和应用密码')

    status.value = 'downloading'
    resultMessage.value = ''
    try {
      saveWebDavConfig()
      const result = await downloadFromWebDav(currentWebDavConfig(), options)
      lastRestoreResult.value = result
      if (result.success) {
        resultMessage.value = '已从云盘恢复（按 id 合并，本地已有数据不会被覆盖）'
        markSynced()
      } else {
        resultMessage.value = `恢复失败: ${result.errors.join('; ')}`
      }
      return result
    } catch (e) {
      const failResult = makeEmptyResult(String(e))
      resultMessage.value = `恢复失败: ${e}`
      return failResult
    } finally {
      status.value = 'idle'
    }
  }

  // ==================== 辅助 ====================

  function makeEmptyResult(...errors: string[]): RestoreResult {
    return {
      success: false,
      wordBanksRestored: 0,
      userSettingsRestored: false,
      textMemoryRestored: false,
      numberMemoryRestored: false,
      shortcutMemoryRestored: false,
      letterMemoryRestored: false,
      knowledgeMemoryRestored: false,
      phoneticMemoryRestored: false,
      signinRestored: false,
      memoryPalaceRestored: false,
      sentencesRestored: false,
      errors,
    }
  }

  /** 仅选择文件（不触发下载） */
  function pickFileOnly(): Promise<File | null> {
    return new Promise((resolve) => {
      const input = document.createElement('input')
      input.type = 'file'
      input.accept = '.json,.bin,.slowlyrecord.json,.slowlyrecord.bin'
      input.onchange = () => resolve(input.files?.[0] || null)
      input.oncancel = () => resolve(null)
      input.click()
    })
  }

  // 初始化：如果有保存的服务器地址，设置它
  if (savedServerUrl.value) {
    setSyncServerUrl(savedServerUrl.value)
  }

  return {
    // 状态
    status,
    syncCode,
    inputCode,
    serverAvailable,
    resultMessage,
    lastRestoreResult,
    previewData,
    previewSummary,
    isBusy,
    savedServerUrl,
    // WebDAV
    webdavUrl,
    webdavUsername,
    webdavPassword,
    webdavConfigured,
    saveWebDavConfig,
    testWebDav,
    webdavDiagnose,
    webdavDirWritable,
    checkWebDavDir,
    webdavUpload,
    webdavDownload,
    // 文件操作
    exportFile,
    previewFile,
    confirmRestore,
    quickImport,
    clearPreview,
    // 服务器操作
    checkServer,
    serverUpload,
    serverUploadMobileCompat,
    serverDownload,
    copySyncCode,
    setCustomServer,
  }
})
