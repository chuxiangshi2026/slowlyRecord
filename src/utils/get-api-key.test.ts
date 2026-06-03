import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock stores/words
const mockGetApiKey = vi.fn()
const mockGetOcrApiKey = vi.fn()

vi.mock('@/stores/words.ts', () => ({
  useWordsStore: () => ({
    getApiKey: mockGetApiKey,
    getOcrApiKey: mockGetOcrApiKey,
  }),
}))

// Mock config
vi.mock('@/config.ts', () => ({
  AppInfo: {
    youdao: { appkey: 'default_youdao_appkey', key: 'default_youdao_key' },
    baidu: { appkey: 'default_baidu_appkey', key: 'default_baidu_key' },
  },
  OcrKeyInfo: {
    tencent: { appkey: 'default_tencent_appkey', key: 'default_tencent_key' },
    baidu: { appkey: 'default_baidu_ocr_appkey', key: 'default_baidu_ocr_key' },
  },
}))

describe('get-api-key', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('getTranslationApiKey', () => {
    it('local 平台应返回空字符串', async () => {
      const { getTranslationApiKey } = await import('./get-api-key')
      const result = getTranslationApiKey('local')
      expect(result).toEqual({ appkey: '', key: '' })
      expect(mockGetApiKey).not.toHaveBeenCalled()
    })

    it('用户设置了密钥时应返回用户密钥', async () => {
      mockGetApiKey.mockReturnValue({ appkey: 'user_appkey', key: 'user_key' })

      const { getTranslationApiKey } = await import('./get-api-key')
      const result = getTranslationApiKey('youdao')

      expect(result).toEqual({ appkey: 'user_appkey', key: 'user_key' })
    })

    it('用户密钥为空时应使用默认配置', async () => {
      mockGetApiKey.mockReturnValue({ appkey: '', key: '' })

      const { getTranslationApiKey } = await import('./get-api-key')
      const result = getTranslationApiKey('youdao')

      expect(result).toEqual({ appkey: 'default_youdao_appkey', key: 'default_youdao_key' })
    })

    it('用户密钥为纯空格时应使用默认配置', async () => {
      mockGetApiKey.mockReturnValue({ appkey: '   ', key: '  ' })

      const { getTranslationApiKey } = await import('./get-api-key')
      const result = getTranslationApiKey('youdao')

      expect(result).toEqual({ appkey: 'default_youdao_appkey', key: 'default_youdao_key' })
    })

    it('用户只设置了 appkey 时应混合使用', async () => {
      mockGetApiKey.mockReturnValue({ appkey: 'user_appkey', key: '' })

      const { getTranslationApiKey } = await import('./get-api-key')
      const result = getTranslationApiKey('youdao')

      expect(result.appkey).toBe('user_appkey')
      expect(result.key).toBe('default_youdao_key')
    })

    it('用户只设置了 key 时应混合使用', async () => {
      mockGetApiKey.mockReturnValue({ appkey: '', key: 'user_key' })

      const { getTranslationApiKey } = await import('./get-api-key')
      const result = getTranslationApiKey('baidu')

      expect(result.appkey).toBe('default_baidu_appkey')
      expect(result.key).toBe('user_key')
    })
  })

  describe('getOcrApiKey', () => {
    it('userKeys 为 falsy 时应使用默认配置', async () => {
      mockGetOcrApiKey.mockReturnValue(null)

      const { getOcrApiKey } = await import('./get-api-key')
      const result = getOcrApiKey('tencent')

      expect(result).toEqual({ appkey: 'default_tencent_appkey', key: 'default_tencent_key' })
    })

    it('userKeys 为 undefined 时应使用默认配置', async () => {
      mockGetOcrApiKey.mockReturnValue(undefined)

      const { getOcrApiKey } = await import('./get-api-key')
      const result = getOcrApiKey('baidu')

      expect(result).toEqual({ appkey: 'default_baidu_ocr_appkey', key: 'default_baidu_ocr_key' })
    })

    it('用户设置了 OCR 密钥时应返回用户密钥', async () => {
      mockGetOcrApiKey.mockReturnValue({ appkey: 'ocr_user_appkey', key: 'ocr_user_key' })

      const { getOcrApiKey } = await import('./get-api-key')
      const result = getOcrApiKey('tencent')

      expect(result).toEqual({ appkey: 'ocr_user_appkey', key: 'ocr_user_key' })
    })

    it('用户 OCR 密钥为空时应使用默认配置', async () => {
      mockGetOcrApiKey.mockReturnValue({ appkey: '', key: '' })

      const { getOcrApiKey } = await import('./get-api-key')
      const result = getOcrApiKey('tencent')

      expect(result.appkey).toBe('default_tencent_appkey')
      expect(result.key).toBe('default_tencent_key')
    })

    it('默认配置也为空时应返回空字符串', async () => {
      mockGetOcrApiKey.mockReturnValue({ appkey: '', key: '' })

      const { getOcrApiKey } = await import('./get-api-key')
      // 使用一个不在 mock config 中的平台
      const result = getOcrApiKey('youdao' as any)

      expect(result).toEqual({ appkey: '', key: '' })
    })
  })
})
