// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { setActivePinia, createPinia } from 'pinia'
import { nextTick } from 'vue'

// Mock 依赖
vi.mock('@shared/utils/sync-file', () => ({
  downloadSyncFile: vi.fn(async () => {}),
  pickAndImportSyncFile: vi.fn(async () => ({
    success: true,
    wordBanksRestored: 1,
    userSettingsRestored: true,
    textMemoryRestored: true,
    numberMemoryRestored: true,
    shortcutMemoryRestored: true,
    letterMemoryRestored: true,
    errors: [],
  })),
  importFromFile: vi.fn(async () => mockSyncData),
  getSyncDataSummary: vi.fn(() => ({
    exportedAt: new Date().toLocaleString(),
    platform: 'test',
    wordBankCount: 1,
    totalWords: 10,
    hasUserSettings: true,
    textArticleCount: 0,
    numberMemoryEntryCount: 0,
    shortcutCategoryCount: 0,
  })),
  FILE_EXT_JSON: '.slowlyrecord.json',
  FILE_EXT_BINARY: '.slowlyrecord.bin',
}))

vi.mock('@shared/utils/sync-server', () => ({
  checkServerAvailable: vi.fn(async () => true),
  uploadToServer: vi.fn(async () => ({ success: true, code: 'ABC123' })),
  uploadToServerMobileCompat: vi.fn(async () => ({ success: true, code: 'MOBILE456' })),
  downloadFromServer: vi.fn(async () => ({
    success: true,
    wordBanksRestored: 1,
    userSettingsRestored: true,
    textMemoryRestored: true,
    numberMemoryRestored: true,
    shortcutMemoryRestored: true,
    letterMemoryRestored: true,
    errors: [],
  })),
  setSyncServerUrl: vi.fn(),
  resetSyncServer: vi.fn(),
}))

vi.mock('@shared/utils/sync-manager', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...(actual as any),
    restoreSyncData: vi.fn(async () => ({
      success: true,
      wordBanksRestored: 1,
      userSettingsRestored: true,
      textMemoryRestored: true,
      numberMemoryRestored: true,
      shortcutMemoryRestored: true,
      letterMemoryRestored: true,
      errors: [],
    })),
  }
})

vi.mock('@shared/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() },
}))

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
}
Object.defineProperty(global, 'localStorage', { value: localStorageMock })

import { useSyncStore } from './sync'
import {
  downloadSyncFile,
  pickAndImportSyncFile,
  importFromFile,
} from '@shared/utils/sync-file'
import {
  checkServerAvailable,
  uploadToServer,
  uploadToServerMobileCompat,
  downloadFromServer,
} from '@shared/utils/sync-server'
import type { SyncData } from '@shared/types/sync'

const mockSyncData: SyncData = {
  version: 1,
  exportedAt: Date.now(),
  platform: 'test',
  wordBanks: [],
  currentWordBankId: '',
  userSettings: null,
  textMemory: null,
  numberMemory: null,
  shortcutMemory: null,
  letterMemory: null,
}

describe('useSyncStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.resetAllMocks()
    localStorageMock.getItem.mockReturnValue(null)
  })

  describe('初始状态', () => {
    it('应该有正确的初始值', () => {
      const store = useSyncStore()

      expect(store.status).toBe('idle')
      expect(store.syncCode).toBe('')
      expect(store.inputCode).toBe('')
      expect(store.serverAvailable).toBeNull()
      expect(store.resultMessage).toBe('')
      expect(store.lastRestoreResult).toBeNull()
      expect(store.previewData).toBeNull()
      expect(store.isBusy).toBe(false)
      expect(store.savedServerUrl).toBe('')
    })
  })

  describe('getters', () => {
    it('isBusy 在 uploading 状态时为 true', async () => {
      const store = useSyncStore()

      store.status = 'uploading'
      await nextTick()

      expect(store.isBusy).toBe(true)
    })

    it('isBusy 在 downloading 状态时为 true', async () => {
      const store = useSyncStore()

      store.status = 'downloading'
      await nextTick()

      expect(store.isBusy).toBe(true)
    })

    it('previewSummary 应该基于 previewData 计算', () => {
      const store = useSyncStore()

      expect(store.previewSummary).toBeNull()

      store.previewData = mockSyncData

      expect(store.previewSummary).not.toBeNull()
      expect(store.previewSummary).toHaveProperty('exportedAt')
      expect(store.previewSummary).toHaveProperty('totalWords')
    })
  })

  describe('exportFile', () => {
    it('应该导出 JSON 文件', async () => {
      const store = useSyncStore()

      await store.exportFile('json')

      expect(downloadSyncFile).toHaveBeenCalledWith('json')
      expect(store.resultMessage).toContain('导出成功')
      expect(store.status).toBe('idle')
    })

    it('应该导出二进制文件', async () => {
      const store = useSyncStore()

      await store.exportFile('binary')

      expect(downloadSyncFile).toHaveBeenCalledWith('binary')
      expect(store.resultMessage).toContain('导出成功')
    })

    it('应该在忙碌时取消操作', async () => {
      const store = useSyncStore()
      store.status = 'uploading'

      await store.exportFile('json')

      expect(downloadSyncFile).not.toHaveBeenCalled()
    })

    it('应该处理导出错误', async () => {
      const store = useSyncStore()
      vi.mocked(downloadSyncFile).mockRejectedValueOnce(new Error('Export failed'))

      await store.exportFile('json')

      expect(store.resultMessage).toContain('导出失败')
      expect(store.status).toBe('idle')
    })
  })

  describe('previewFile', () => {
    it('应该解析并预览文件', async () => {
      const store = useSyncStore()

      // 模拟文件选择
      const mockFile = new File(['{}'], 'test.json', { type: 'application/json' })
      const input = document.createElement('input')
      vi.spyOn(document, 'createElement').mockReturnValue(input)
      setTimeout(() => {
        Object.defineProperty(input, 'files', {
          value: [mockFile],
          writable: false,
        })
        input.onchange?.(null as any)
      }, 10)

      await store.previewFile()

      expect(importFromFile).toHaveBeenCalled()
      expect(store.previewData).not.toBeNull()
    })

    it('应该在忙碌时取消操作', async () => {
      const store = useSyncStore()
      store.status = 'uploading'

      await store.previewFile()

      expect(importFromFile).not.toHaveBeenCalled()
    })
  })

  describe('confirmRestore', () => {
    it('没有预览数据时应该取消', async () => {
      const store = useSyncStore()
      store.previewData = null

      await store.confirmRestore()

      expect(store.status).toBe('idle')
    })

    it('应该还原预览的数据', async () => {
      const store = useSyncStore()
      store.previewData = mockSyncData

      await store.confirmRestore()

      expect(store.resultMessage).toContain('还原成功')
      expect(store.previewData).toBeNull()
    })
  })

  describe('quickImport', () => {
    it('应该快速导入文件', async () => {
      const store = useSyncStore()

      await store.quickImport()

      expect(pickAndImportSyncFile).toHaveBeenCalled()
      expect(store.resultMessage).toContain('导入成功')
    })

    it('应该处理导入失败', async () => {
      const store = useSyncStore()
      vi.mocked(pickAndImportSyncFile).mockResolvedValueOnce({
        success: false,
        wordBanksRestored: 0,
        userSettingsRestored: false,
        textMemoryRestored: false,
        numberMemoryRestored: false,
        shortcutMemoryRestored: false,
        letterMemoryRestored: false,
        errors: ['File error'],
      })

      await store.quickImport()

      expect(store.resultMessage).toContain('导入失败')
    })
  })

  describe('clearPreview', () => {
    it('应该清除预览数据和消息', () => {
      const store = useSyncStore()
      store.previewData = mockSyncData
      store.resultMessage = 'Some message'

      store.clearPreview()

      expect(store.previewData).toBeNull()
      expect(store.resultMessage).toBe('')
    })
  })

  describe('checkServer', () => {
    it('应该检查服务器可用性', async () => {
      const store = useSyncStore()

      await store.checkServer()

      expect(checkServerAvailable).toHaveBeenCalled()
      expect(store.serverAvailable).toBe(true)
    })

    it('应该处理检查失败', async () => {
      const store = useSyncStore()
      vi.mocked(checkServerAvailable).mockRejectedValueOnce(new Error('Network error'))

      await store.checkServer()

      expect(store.serverAvailable).toBe(false)
    })
  })

  describe('serverUpload', () => {
    it('应该上传数据到服务器', async () => {
      const store = useSyncStore()

      const result = await store.serverUpload()

      expect(uploadToServer).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(store.syncCode).toBe('ABC123')
      expect(store.resultMessage).toContain('推送成功')
    })

    it('应该处理上传失败', async () => {
      const store = useSyncStore()
      vi.mocked(uploadToServer).mockResolvedValueOnce({ success: false, error: 'Upload failed' })

      const result = await store.serverUpload()

      expect(result.success).toBe(false)
      expect(store.resultMessage).toContain('推送失败')
    })
  })

  describe('serverUploadMobileCompat', () => {
    it('应该以移动端兼容格式上传', async () => {
      const store = useSyncStore()

      const result = await store.serverUploadMobileCompat()

      expect(uploadToServerMobileCompat).toHaveBeenCalled()
      expect(result.success).toBe(true)
      expect(store.syncCode).toBe('MOBILE456')
    })
  })

  describe('serverDownload', () => {
    it('应该使用输入的同步码下载', async () => {
      const store = useSyncStore()
      store.inputCode = 'TEST123'

      const result = await store.serverDownload()

      expect(downloadFromServer).toHaveBeenCalledWith('TEST123', undefined)
      expect(result.success).toBe(true)
      expect(store.inputCode).toBe('') // 成功后清空
    })

    it('应该使用传入的同步码下载', async () => {
      const store = useSyncStore()

      await store.serverDownload('OTHER456')

      expect(downloadFromServer).toHaveBeenCalledWith('OTHER456', undefined)
    })

    it('空同步码时应该返回错误', async () => {
      const store = useSyncStore()
      store.inputCode = ''

      const result = await store.serverDownload()

      expect(result.success).toBe(false)
      expect(result.errors).toContain('请输入同步码')
    })
  })

  describe('copySyncCode', () => {
    it('应该复制同步码到剪贴板', async () => {
      const store = useSyncStore()
      store.syncCode = 'COPY123'

      const writeTextSpy = vi.fn().mockResolvedValue(undefined)
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextSpy },
        writable: true,
      })

      await store.copySyncCode()

      expect(writeTextSpy).toHaveBeenCalledWith('COPY123')
      expect(store.resultMessage).toContain('已复制')
    })

    it('没有同步码时不应该操作', async () => {
      const store = useSyncStore()
      store.syncCode = ''

      const writeTextSpy = vi.fn()
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: writeTextSpy },
        writable: true,
      })

      await store.copySyncCode()

      expect(writeTextSpy).not.toHaveBeenCalled()
    })
  })

  describe('setCustomServer', () => {
    it('应该设置自定义服务器地址', () => {
      const store = useSyncStore()

      store.setCustomServer('https://custom.server.com')

      // 注意：getDbStorage 在 Web/Electron 环境会对 value 做 JSON.stringify，
      // 所以 localStorage.setItem 实际收到的是带引号的 JSON 字符串
      expect(localStorageMock.setItem).toHaveBeenCalledWith('sync_server_url', JSON.stringify('https://custom.server.com'))
      expect(store.savedServerUrl).toBe('https://custom.server.com')
      expect(store.resultMessage).toContain('已切换到自定义服务器')
    })

    it('空地址时应该重置为默认服务器', () => {
      const store = useSyncStore()

      store.setCustomServer('')

      expect(localStorageMock.removeItem).toHaveBeenCalledWith('sync_server_url')
      expect(store.savedServerUrl).toBe('')
      expect(store.resultMessage).toContain('已切换到默认服务器')
    })
  })
})
