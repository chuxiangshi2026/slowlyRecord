// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock sync-manager
vi.mock('@shared/utils/sync-manager', () => ({
  collectSyncData: vi.fn(async () => mockSyncData),
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
  DEFAULT_RESTORE_OPTIONS: {
    conflictStrategy: 'merge',
    restoreWordBanks: true,
    restoreUserSettings: true,
    restoreTextMemory: true,
    restoreNumberMemory: true,
    restoreShortcutMemory: true,
    restoreLetterMemory: true,
  },
}))

vi.mock('@shared/utils/logger', () => ({
  log: { i: vi.fn(), e: vi.fn(), w: vi.fn(), d: vi.fn() },
}))

import {
  exportToJson,
  importFromJson,
  exportToBinary,
  importFromBinary,
  importFromFile,
  downloadSyncFile,
  pickAndImportSyncFile,
  getSyncDataSummary,
  FILE_EXT_JSON,
  FILE_EXT_BINARY,
} from './sync-file'
import { collectSyncData, restoreSyncData } from '@shared/utils/sync-manager'
import type { SyncData } from '@shared/types/sync'

const mockSyncData: SyncData = {
  version: 1,
  exportedAt: Date.now(),
  platform: 'test',
  wordBanks: [
    {
      id: 'bank-1',
      name: 'Test Bank',
      words: [{ text: 'hello', translation: '你好', learnDate: Date.now() }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    },
  ],
  currentWordBankId: 'bank-1',
  userSettings: {
    pluginStatus: true,
    shortcutEnabled: false,
    translationPlatform: 'glm',
    ocrPlatform: 'local',
    memoryFirmness: '正常',
    keys: {},
    ocrKeys: {},
    focusMode: { alwaysOnTop: true, opacity: 1, edgeStickEnabled: true, fontColor: '', fontSize: 20, explainFontSize: 11, backgroundImage: '', backgroundImageOpacity: 0.35 },
  },
  textMemory: null,
  numberMemory: null,
  shortcutMemory: null,
  letterMemory: null,
}

describe('sync-file', () => {
  beforeEach(() => {
    vi.resetAllMocks()
  })

  describe('exportToJson', () => {
    it('应该将数据导出为 JSON 字符串', () => {
      const json = exportToJson(mockSyncData)

      expect(typeof json).toBe('string')
      const parsed = JSON.parse(json)
      expect(parsed.version).toBe(1)
      expect(parsed.platform).toBe('test')
    })
  })

  describe('importFromJson', () => {
    it('应该从 JSON 字符串解析数据', () => {
      const json = JSON.stringify(mockSyncData)

      const result = importFromJson(json)

      expect(result.version).toBe(1)
      expect(result.platform).toBe('test')
      expect(result.wordBanks).toHaveLength(1)
    })

    it('应该验证数据格式', () => {
      expect(() => importFromJson('{}')).toThrow('同步数据缺少必要字段')
    })

    it('应该检查版本兼容性', () => {
      const highVersionData = { ...mockSyncData, version: 999 }

      expect(() => importFromJson(JSON.stringify(highVersionData))).toThrow('高于当前支持版本')
    })

    it('应该拒绝无效数据', () => {
      expect(() => importFromJson('not json')).toThrow()
      expect(() => importFromJson('null')).toThrow('无效的同步数据格式')
    })
  })

  describe('exportToBinary', () => {
    it('应该导出为二进制格式', async () => {
      const binary = await exportToBinary(mockSyncData)

      expect(binary).toBeInstanceOf(Uint8Array)
      expect(binary.length).toBeGreaterThan(5)
      // 检查魔数 'SRSY'
      expect(binary[0]).toBe(0x53)
      expect(binary[1]).toBe(0x52)
      expect(binary[2]).toBe(0x53)
      expect(binary[3]).toBe(0x59)
      // 检查版本号
      expect(binary[4]).toBe(1)
    })

    it('应该在没有 pako 时降级为未压缩', async () => {
      // 模拟 pako 导入失败
      vi.doMock('pako', () => {
        throw new Error('Module not found')
      })

      const binary = await exportToBinary(mockSyncData)

      expect(binary).toBeInstanceOf(Uint8Array)
      expect(binary.length).toBeGreaterThan(5)
    })
  })

  describe('importFromBinary', () => {
    it('应该从二进制格式解析', async () => {
      const binary = await exportToBinary(mockSyncData)

      const result = await importFromBinary(binary.buffer)

      expect(result.version).toBe(1)
      expect(result.platform).toBe('test')
    })

    it('对非二进制数据应该尝试 JSON 解析', async () => {
      const json = JSON.stringify(mockSyncData)
      const encoder = new TextEncoder()
      const bytes = encoder.encode(json)

      const result = await importFromBinary(bytes.buffer)

      expect(result.version).toBe(1)
    })

    it('应该检查魔数', async () => {
      const invalidBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04])

      // 非二进制格式会尝试 JSON 解析，但应该失败
      await expect(importFromBinary(invalidBytes.buffer)).rejects.toThrow()
    })
  })

  describe('importFromFile', () => {
    it('应该检测二进制格式文件', async () => {
      const binary = await exportToBinary(mockSyncData)
      // 创建带有 arrayBuffer 方法的 Mock File
      const file = {
        name: 'test.bin',
        type: 'application/octet-stream',
        arrayBuffer: async () => binary.buffer,
      } as unknown as File

      const result = await importFromFile(file)

      expect(result.version).toBe(1)
    })

    it('应该检测 JSON 格式文件', async () => {
      const json = JSON.stringify(mockSyncData)
      const encoder = new TextEncoder()
      const bytes = encoder.encode(json)
      // 创建带有 arrayBuffer 方法的 Mock File
      const file = {
        name: 'test.json',
        type: 'application/json',
        arrayBuffer: async () => bytes.buffer,
      } as unknown as File

      const result = await importFromFile(file)

      expect(result.version).toBe(1)
    })
  })

  describe('downloadSyncFile', () => {
    it('应该触发 JSON 格式下载', async () => {
      const clickSpy = vi.fn()
      const mockAnchor = document.createElement('a')
      mockAnchor.click = clickSpy

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor)

      await downloadSyncFile('json')

      expect(collectSyncData).toHaveBeenCalled()
      expect(createElementSpy).toHaveBeenCalledWith('a')
      expect(clickSpy).toHaveBeenCalled()

      createElementSpy.mockRestore()
    })

    it('应该触发二进制格式下载', async () => {
      const clickSpy = vi.fn()
      const mockAnchor = document.createElement('a')
      mockAnchor.click = clickSpy

      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockAnchor)

      await downloadSyncFile('binary')

      expect(collectSyncData).toHaveBeenCalled()

      createElementSpy.mockRestore()
    })
  })

  describe('pickAndImportSyncFile', () => {
    it('未选择文件时应该返回错误结果', async () => {
      // Mock pickFile 返回 null（模拟取消选择）
      const mockInput = document.createElement('input')
      const createElementSpy = vi.spyOn(document, 'createElement').mockReturnValue(mockInput)

      // 设置一个短的延迟来触发 oncancel
      setTimeout(() => {
        mockInput.oncancel?.(null as any)
      }, 10)

      const resultPromise = pickAndImportSyncFile()

      // 由于实现使用 Promise 构造函数，我们需要等待
      await expect(resultPromise).resolves.toMatchObject({
        success: false,
        errors: expect.arrayContaining(['未选择文件']),
      })

      createElementSpy.mockRestore()
    })
  })

  describe('getSyncDataSummary', () => {
    it('应该生成数据摘要', () => {
      const summary = getSyncDataSummary(mockSyncData)

      expect(summary).toHaveProperty('exportedAt')
      expect(summary).toHaveProperty('platform', 'test')
      expect(summary).toHaveProperty('wordBankCount', 1)
      expect(summary).toHaveProperty('totalWords', 1)
      expect(summary).toHaveProperty('hasUserSettings', true)
      expect(summary).toHaveProperty('textArticleCount', 0)
      expect(summary).toHaveProperty('numberMemoryEntryCount', 0)
      expect(summary).toHaveProperty('shortcutCategoryCount', 0)
    })

    it('应该正确处理 null 数据', () => {
      const dataWithNulls: SyncData = {
        ...mockSyncData,
        userSettings: null,
        wordBanks: [],
      }

      const summary = getSyncDataSummary(dataWithNulls)

      expect(summary.hasUserSettings).toBe(false)
      expect(summary.totalWords).toBe(0)
    })
  })

  describe('文件扩展名常量', () => {
    it('应该有正确的扩展名', () => {
      expect(FILE_EXT_JSON).toBe('.slowlyrecord.json')
      expect(FILE_EXT_BINARY).toBe('.slowlyrecord.bin')
    })
  })
})
