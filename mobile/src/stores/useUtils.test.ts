/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'

// ==================== Mock 设置 (vi.mock 必须放在最顶部，且不能引用外部变量) ====================

// Mock pako - 工厂函数内联，避免 hoisting 时变量未初始化
vi.mock('pako', () => ({
  default: {
    deflate: (data: Uint8Array) => {
      // 简单模拟压缩：在原数据末尾加标记字节
      const result = new Uint8Array(data.length + 1)
      result.set(data)
      result[data.length] = 0x78
      return result
    },
    inflate: (data: Uint8Array) => {
      // 还原：去掉末尾标记
      return data.subarray(0, data.length - 1)
    },
  },
}))

// jsencrypt 已从 useUtils.ts 移除，不再需要 mock

// Mock 全部词库动态 import (useUtils.ts 在 #ifndef MP-WEIXIN 中有动态 import)
// vitest 会将 vi.mock 提升到文件顶部，拦截模块解析（必须单独写出，不能用循环/变量）
vi.mock('@/subPackages/wordbank-b/wordbanks/cet4', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-b/wordbanks/cet6', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-b/wordbanks/bec', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-c/wordbanks/gre', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-a/wordbanks/gmat', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-b/wordbanks/ielts', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-b/wordbanks/kaogong', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-a/wordbanks/kaoyan', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-c/wordbanks/level4', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-level8/wordbanks/level8', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-c/wordbanks/sat', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-d/wordbanks/toefl', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-b/wordbanks/zsb', () => ({ default: [] }))
vi.mock('@/subPackages/wordbank-b/wordbanks/nul', () => ({ default: [] }))

// Mock uni API (运行时设置，非 vi.mock)
const mockStorage = new Map<string, any>()
const mockUni: any = {
  setStorageSync: vi.fn((key: string, data: any) => { mockStorage.set(key, data) }),
  getStorageSync: vi.fn((key: string) => mockStorage.get(key) ?? null),
  removeStorageSync: vi.fn((key: string) => { mockStorage.delete(key) }),
  getStorageInfoSync: vi.fn(() => ({ keys: Array.from(mockStorage.keys()), currentSize: 0, limitSize: 10240 })),
  request: vi.fn(),
  createInnerAudioContext: vi.fn(() => ({
    src: '',
    play: vi.fn(),
    destroy: vi.fn(),
    onPlay: vi.fn(),
    onError: vi.fn(),
  })),
  createCanvasContext: vi.fn(() => ({
    setFillStyle: vi.fn(),
    fillRect: vi.fn(),
    draw: vi.fn(),
  })),
}
;(global as any).uni = mockUni

// 导入被测试模块
import {
  setTranslationPlatform,
  getTranslationPlatform,
  getTranslationApiKey,
  setTranslationApiKey,
  hasCustomTranslationApiKey,
  TRANSLATION_PLATFORM_LINKS,
  getPronunciationUrl,
  playPronunciation,
  queryOfflineDict,
  hasOfflineDict,
  getOfflineDictSize,
  WORDBANK_LIST,
  DEFAULT_STRATEGY,
  getAllWordBankInfo,
  isWordBankCached,
  saveWordBankCache,
  clearWordBankCache,
} from './useUtils'

// 同步服务器、远端推送/拉取与翻译已迁移到分包目录
// （vitest alias 中 `@/` 解析到桌面 src/，这里改用相对路径避免误命中）
import {
  setSyncServerUrl,
  getSyncServerUrl,
  resetSyncServer,
  checkServerAvailable,
  pushToServer,
  pullFromServer,
} from '../subPackages/pages-tools/utils/sync'
import {
  translateText,
  batchTranslate,
} from '../subPackages/pages-tools/utils/translation'

import type {
  TranslationPlatform,
  TranslationResult,
  MobileSyncBank,
  SyncResult,
  RestoreResult,
} from './useUtils'

beforeEach(() => {
  vi.clearAllMocks()
  mockStorage.clear()
})

// ==================== 翻译平台设置测试 ====================

describe('翻译平台设置', () => {
  it('默认翻译平台应为 glm（与桌面端一致）', () => {
    expect(getTranslationPlatform()).toBe('glm')
  })

  it('可以设置为 youdao', () => {
    setTranslationPlatform('youdao')
    expect(getTranslationPlatform()).toBe('youdao')
  })

  it('可以设置为 baidu', () => {
    setTranslationPlatform('youdao')
    setTranslationPlatform('baidu')
    expect(getTranslationPlatform()).toBe('baidu')
  })

  it('可以设置为 ali', () => {
    setTranslationPlatform('ali')
    expect(getTranslationPlatform()).toBe('ali')
  })

  it('可以设置为 tencent', () => {
    setTranslationPlatform('tencent')
    expect(getTranslationPlatform()).toBe('tencent')
  })

  it('可以设置为 deepseek', () => {
    setTranslationPlatform('deepseek')
    expect(getTranslationPlatform()).toBe('deepseek')
  })

  it('可以设置为 glm', () => {
    setTranslationPlatform('glm')
    expect(getTranslationPlatform()).toBe('glm')
  })

  it('可以设置为 local', () => {
    setTranslationPlatform('local')
    expect(getTranslationPlatform()).toBe('local')
  })
})

describe('翻译 API 密钥管理', () => {
  const plat: TranslationPlatform = 'glm'

  it('getTranslationApiKey 应返回默认配置的密钥', () => {
    const keys = getTranslationApiKey('youdao')
    expect(keys.appkey).toBeTruthy()
    expect(keys.key).toBeTruthy()
  })

  it('没有默认密钥的平台应返回空字符串（deepseek）', () => {
    const keys = getTranslationApiKey('deepseek')
    expect(keys.appkey).toBe('')
    expect(keys.key).toBe('deepseek-chat') // 默认模型名
  })

  it('setTranslationApiKey 应保存自定义密钥', () => {
    setTranslationApiKey(plat, 'my-custom-key', 'my-model')
    const keys = getTranslationApiKey(plat)
    expect(keys.appkey).toBe('my-custom-key')
    expect(keys.key).toBe('my-model')
  })

  it('hasCustomTranslationApiKey 在设置密钥后应返回 true', () => {
    setTranslationApiKey(plat, 'test-key', '')
    expect(hasCustomTranslationApiKey(plat)).toBe(true)
  })

  it('hasCustomTranslationApiKey 在清空密钥后应返回 false', () => {
    setTranslationApiKey(plat, '', '')
    expect(hasCustomTranslationApiKey(plat)).toBe(false)
  })

  it('setTranslationApiKey 空值应清空', () => {
    setTranslationApiKey(plat, 'temp', 'temp')
    setTranslationApiKey(plat, '', '')
    const keys = getTranslationApiKey(plat)
    // 清空后应回退到 DefaultApiKeys[plat] 的默认 key（具体值由 config.ts 决定，这里只校验非空且非自定义）
    expect(keys.appkey).not.toBe('temp')
    expect(keys.appkey.length).toBeGreaterThan(0)
  })
})

describe('TRANSLATION_PLATFORM_LINKS', () => {
  it('应包含各个平台的申请链接', () => {
    expect(TRANSLATION_PLATFORM_LINKS.length).toBeGreaterThan(0)
    const keys = TRANSLATION_PLATFORM_LINKS.map(l => l.key)
    expect(keys).toContain('youdao')
    expect(keys).toContain('baidu')
    expect(keys).toContain('glm')
    expect(keys).toContain('deepseek')
    expect(keys).toContain('kimi')
    expect(keys).toContain('ollama')
  })

  it('每个链接应包含 name、key、content、url', () => {
    for (const link of TRANSLATION_PLATFORM_LINKS) {
      expect(link.name).toBeTruthy()
      expect(link.key).toBeTruthy()
      expect(link.content).toBeTruthy()
      expect(link.url).toBeTruthy()
    }
  })
})

// ==================== 发音功能测试 ====================

describe('getPronunciationUrl', () => {
  // 有道发音 type 约定：type=1 英音，type=2 美音
  it('应该生成美式发音 URL', () => {
    const url = getPronunciationUrl('hello', 'us')
    expect(url).toContain('dict.youdao.com/dictvoice')
    expect(url).toContain('audio=hello')
    expect(url).toContain('type=2')
  })

  it('应该生成英式发音 URL', () => {
    const url = getPronunciationUrl('hello', 'en')
    expect(url).toContain('type=1')
  })

  it('默认应该使用美式发音', () => {
    const url = getPronunciationUrl('world')
    expect(url).toContain('type=2')
  })

  it('应该对特殊字符进行 URL 编码', () => {
    const url = getPronunciationUrl('what\'s up')
    expect(url).toContain('audio=')
    expect(url).not.toContain(' ')
  })
})

describe('playPronunciation', () => {
  // 注：playPronunciation 还会调用 audio.onEnded/onError/destroy，
  // 这里 mock 必须提供这些方法的桩
  function makeAudioCtx() {
    return {
      src: '',
      play: vi.fn(),
      onEnded: vi.fn(),
      onError: vi.fn(),
      destroy: vi.fn(),
    }
  }

  it('应该创建音频上下文并播放', () => {
    const audioCtx = makeAudioCtx()
    mockUni.createInnerAudioContext.mockReturnValue(audioCtx)

    playPronunciation('hello')

    expect(mockUni.createInnerAudioContext).toHaveBeenCalled()
    expect(audioCtx.src).toContain('dict.youdao.com/dictvoice')
    expect(audioCtx.src).toContain('audio=hello')
    expect(audioCtx.play).toHaveBeenCalled()
  })

  it('应该支持英式发音', () => {
    const audioCtx = makeAudioCtx()
    mockUni.createInnerAudioContext.mockReturnValue(audioCtx)

    playPronunciation('hello', 'en')

    // 有道 type=1 是英音
    expect(audioCtx.src).toContain('type=1')
  })
})

// ==================== 离线词典测试 ====================

describe('queryOfflineDict', () => {
  it('应该返回已知单词的解释', () => {
    expect(queryOfflineDict('hello')).toBe('你好；问候')
    expect(queryOfflineDict('world')).toBe('世界；领域')
  })

  it('大小写不敏感查询', () => {
    expect(queryOfflineDict('Hello')).toBe('你好；问候')
    expect(queryOfflineDict('HELLO')).toBe('你好；问候')
  })

  it('前后带空格应 trim', () => {
    expect(queryOfflineDict('  hello  ')).toBe('你好；问候')
  })

  it('不存在的单词应返回 null', () => {
    expect(queryOfflineDict('nonexistentword')).toBeNull()
    expect(queryOfflineDict('xyzabc123')).toBeNull()
  })

  it('空字符串应返回 null', () => {
    expect(queryOfflineDict('')).toBeNull()
  })

  it('常见虚词应该命中', () => {
    expect(queryOfflineDict('the')).toBe('这；那（定冠词）')
    expect(queryOfflineDict('about')).toBe('关于；大约')
  })
})

describe('hasOfflineDict', () => {
  it('存在的单词应返回 true', () => {
    expect(hasOfflineDict('hello')).toBe(true)
  })

  it('不存在的单词应返回 false', () => {
    expect(hasOfflineDict('notexists')).toBe(false)
  })

  it('大小写不敏感', () => {
    expect(hasOfflineDict('Hello')).toBe(true)
  })
})

describe('getOfflineDictSize', () => {
  it('应返回离线词典包含的单词数量', () => {
    const size = getOfflineDictSize()
    expect(size).toBeGreaterThan(0)
    // 根据 OFFLINE_DICT 常量估算（约80+个词条）
    expect(size).toBeGreaterThan(50)
  })
})

// ==================== 同步服务器配置测试 ====================

describe('同步服务器配置', () => {
  const STORAGE_KEY = 'slowly_sync_server_url'
  const DEFAULT_SERVER = 'https://1258475269-6fkx3oixct.ap-guangzhou.tencentscf.com'

  it('默认应返回腾讯云默认地址', () => {
    expect(getSyncServerUrl()).toBe(DEFAULT_SERVER)
  })

  it('设置自定义服务器地址后应返回自定义地址', () => {
    setSyncServerUrl('https://sync.example.com')
    expect(getSyncServerUrl()).toBe('https://sync.example.com')
    expect(mockUni.setStorageSync).toHaveBeenCalledWith(STORAGE_KEY, 'https://sync.example.com')
  })

  it('设置带末尾斜杠的地址应自动去除斜杠', () => {
    setSyncServerUrl('https://sync.example.com/')
    expect(getSyncServerUrl()).toBe('https://sync.example.com')
    expect(mockUni.setStorageSync).toHaveBeenCalledWith(STORAGE_KEY, 'https://sync.example.com')
  })

  it('传入空字符串应恢复默认', () => {
    setSyncServerUrl('https://custom.server.com')
    setSyncServerUrl('')
    expect(mockUni.removeStorageSync).toHaveBeenCalledWith(STORAGE_KEY)
  })

  it('重置服务器地址应恢复默认', () => {
    setSyncServerUrl('https://custom.server.com')
    resetSyncServer()
    expect(mockUni.removeStorageSync).toHaveBeenCalledWith(STORAGE_KEY)
    expect(getSyncServerUrl()).toBe(DEFAULT_SERVER)
  })

  it('从缓存读取自定义地址', () => {
    mockStorage.set(STORAGE_KEY, 'https://cached.server.com')
    expect(getSyncServerUrl()).toBe('https://cached.server.com')
  })
})

// ==================== 词库常量测试 ====================

describe('WORDBANK_LIST', () => {
  it('应包含所有词库类型', () => {
    const ids = WORDBANK_LIST.map(w => w.id)
    expect(ids).toContain('cet4')
    expect(ids).toContain('cet6')
    expect(ids).toContain('ielts')
    expect(ids).toContain('toefl')
    expect(ids).toContain('gre')
    expect(ids).toContain('gmat')
    expect(ids).toContain('bec')
    expect(ids).toContain('level4')
    expect(ids).toContain('level8')
    expect(ids).toContain('zsb')
    expect(ids).toContain('sat')
    expect(ids).toContain('kaogong')
    expect(ids).toContain('kaoyan')
    expect(ids).toContain('nul')
  })

  it('每个词库应有 id、name、description、wordCount', () => {
    for (const bank of WORDBANK_LIST) {
      expect(bank.id).toBeDefined()
      expect(bank.name).toBeDefined()
      expect(bank.description).toBeDefined()
      expect(bank.wordCount).toBeGreaterThan(0)
    }
  })
})

describe('DEFAULT_STRATEGY', () => {
  it('默认策略优先使用本地加载', () => {
    expect(DEFAULT_STRATEGY.priority).toBe('local')
  })

  it('默认策略启用缓存', () => {
    expect(DEFAULT_STRATEGY.useCache).toBe(true)
  })

  it('默认超时时间为 5000ms', () => {
    expect(DEFAULT_STRATEGY.timeout).toBe(5000)
  })
})

describe('getAllWordBankInfo', () => {
  it('应返回词库列表的副本', async () => {
    const result = await getAllWordBankInfo()
    expect(result.length).toBe(WORDBANK_LIST.length)
    expect(result[0].id).toBe(WORDBANK_LIST[0].id)
  })
})

// ==================== 词库缓存测试 ====================

describe('词库缓存管理', () => {
  const CACHE_KEY_PREFIX = 'wordbank_cache_v2_'

  it('saveWordBankCache 应保存到 storage', () => {
    const words = [
      { word: 'hello', meaning: '你好', phonetic: 'həˈloʊ' },
      { word: 'world', meaning: '世界', phonetic: 'wɜːld' },
    ]
    saveWordBankCache('cet4', words)

    expect(mockUni.setStorageSync).toHaveBeenCalled()
    const callKey = mockUni.setStorageSync.mock.calls[0][0]
    expect(callKey).toContain(CACHE_KEY_PREFIX)
    expect(callKey).toContain('cet4')
  })

  it('isWordBankCached 未缓存时返回 false', () => {
    expect(isWordBankCached('cet4')).toBe(false)
  })

  it('isWordBankCached 已缓存时返回 true', () => {
    const words = [{ word: 'test', meaning: '测试' }]
    saveWordBankCache('cet4', words)

    expect(isWordBankCached('cet4')).toBe(true)
  })

  it('过期缓存应返回 false', () => {
    // 手动构造一个过期缓存
    const cacheKey = CACHE_KEY_PREFIX + 'cet6'
    const oldData = {
      timestamp: Date.now() - 10 * 24 * 60 * 60 * 1000, // 10天前
      words: [{ word: 'old', meaning: '旧数据' }],
    }
    mockStorage.set(cacheKey, JSON.stringify(oldData))

    expect(isWordBankCached('cet6')).toBe(false)
    // 注：isWordBankCached 不主动清理过期缓存，清理只在 getFromCache（loadWordBank 内部）触发
  })

  it('clearWordBankCache 应清除指定类型的缓存', () => {
    saveWordBankCache('cet4', [{ word: 'test', meaning: '测试' }])
    clearWordBankCache('cet4')

    expect(mockUni.removeStorageSync).toHaveBeenCalledWith(expect.stringContaining('cet4'))
  })

  it('clearWordBankCache 不传参数应清除所有词库缓存', () => {
    mockStorage.set(CACHE_KEY_PREFIX + 'cet4', JSON.stringify({ timestamp: Date.now(), words: [] }))
    mockStorage.set(CACHE_KEY_PREFIX + 'toefl', JSON.stringify({ timestamp: Date.now(), words: [] }))
    mockStorage.set('other_key', 'value')

    clearWordBankCache()

    // 词库缓存应该被删除
    expect(mockUni.removeStorageSync).toHaveBeenCalledWith(CACHE_KEY_PREFIX + 'cet4')
    expect(mockUni.removeStorageSync).toHaveBeenCalledWith(CACHE_KEY_PREFIX + 'toefl')
  })
})

// ==================== 同步服务测试 ====================

describe('checkServerAvailable', () => {
  it('服务器返回 200 时应返回 true', async () => {
    mockUni.request.mockImplementation((opts: any) => {
      opts.success({ statusCode: 200 })
    })

    const result = await checkServerAvailable()
    expect(result).toBe(true)
    expect(mockUni.request).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining('/ping') })
    )
  })

  it('服务器返回非 200 时应返回 false', async () => {
    mockUni.request.mockImplementation((opts: any) => {
      opts.success({ statusCode: 500 })
    })

    const result = await checkServerAvailable()
    expect(result).toBe(false)
  })

  it('请求失败时应返回 false', async () => {
    mockUni.request.mockImplementation((opts: any) => {
      opts.fail({ errMsg: '网络错误' })
    })

    const result = await checkServerAvailable()
    expect(result).toBe(false)
  })
})

describe('pushToServer / pullFromServer', () => {
  const mockBanks: MobileSyncBank[] = [
    { id: 'bank1', name: '四级词汇', words: [{ word: 'hello', meaning: '你好' }] },
  ]

  it('pushToServer 应返回同步码', async () => {
    // 模拟上传成功
    mockUni.request.mockImplementation((opts: any) => {
      opts.success({ statusCode: 201, data: { code: 'sync-123' } })
    })

    const result: SyncResult = await pushToServer(mockBanks)

    expect(result.success).toBe(true)
    expect(result.code).toBeDefined()
    expect(result.code).toContain('.') // 格式: blobId.aesKey
  })

  it('pushToServer 上传失败应返回错误', async () => {
    mockUni.request.mockImplementation((opts: any) => {
      opts.fail({ errMsg: '网络不可用' })
    })

    const result: SyncResult = await pushToServer(mockBanks)

    expect(result.success).toBe(false)
    expect(result.error).toBeDefined()
  })

  it('pullFromServer 同步码无效时应返回错误', async () => {
    const result: RestoreResult = await pullFromServer('invalid-code')

    expect(result.success).toBe(false)
    expect(result.error).toContain('同步码格式无效')
  })

  it('pullFromServer 同步码缺少密码部分时应返回错误', async () => {
    const result: RestoreResult = await pullFromServer('.')

    expect(result.success).toBe(false)
    expect(result.error).toContain('同步码格式无效')
  })

  it('pullFromServer 末尾为点号时应报错', async () => {
    const result: RestoreResult = await pullFromServer('blobId.')

    expect(result.success).toBe(false)
    expect(result.error).toContain('同步码格式无效')
  })
})

// ==================== 翻译测试 ====================

describe('translateText', () => {
  it('空字符串应返回错误', async () => {
    const result: TranslationResult = await translateText('')
    expect(result.success).toBe(false)
    expect(result.errorMsg).toBeDefined()
    expect(result.platform).toBe('local')
  })

  it('纯空格应返回错误', async () => {
    const result: TranslationResult = await translateText('   ')
    expect(result.success).toBe(false)
    expect(result.errorMsg).toBeDefined()
  })

  it('离线词典命中的单词应直接返回本地结果', async () => {
    const result: TranslationResult = await translateText('hello')
    expect(result.success).toBe(true)
    expect(result.platform).toBe('local')
    expect(result.translatedText).toBe('你好；问候')
    expect(result.explains).toBe('你好；问候')
  })

  it('离线词典未命中的单词应走 API（你道）', async () => {
    setTranslationPlatform('youdao')

    // 模拟有道翻译成功
    mockUni.request.mockImplementation((opts: any) => {
      opts.success({
        statusCode: 200,
        data: { errorCode: '0', translation: ['测试翻译'], basic: { phonetic: 'test' } },
      })
    })

    const result: TranslationResult = await translateText('nonexistentxyz')

    expect(result.success).toBe(true)
    expect(result.platform).toBe('youdao')
    expect(result.translatedText).toBe('测试翻译')
  })

  it('API 调用失败应返回原文和错误信息', async () => {
    setTranslationPlatform('baidu')

    mockUni.request.mockImplementation((opts: any) => {
      opts.fail({ errMsg: '网络错误' })
    })

    const result: TranslationResult = await translateText('testword')

    expect(result.success).toBe(false)
    expect(result.explains).toBe('testword') // 返回原文
    expect(result.errorMsg).toBeDefined()
  })
})

describe('batchTranslate', () => {
  it('应该批量翻译多个单词', async () => {
    // hello 离线命中，world 离线命中
    // batchTranslate 返回 TranslationResult[]，每项含 translatedText / explains
    const results = await batchTranslate(['hello', 'world'])

    expect(results.length).toBe(2)
    expect(results[0].translatedText).toBe('你好；问候')
    expect(results[1].translatedText).toBe('世界；领域')
  })

  it('空数组应返回空结果', async () => {
    const results = await batchTranslate([])
    expect(results).toEqual([])
  })

  it('未知单词应在翻译失败时返回原文', async () => {
    setTranslationPlatform('baidu')

    mockUni.request.mockImplementation((opts: any) => {
      opts.fail({ errMsg: '网络错误' })
    })

    const results = await batchTranslate(['xyzunknown'])

    // 失败时降级返回原文（translatedText 与 explains 字段）
    expect(results[0].translatedText).toBe('xyzunknown')
    expect(results[0].success).toBe(false)
  })
})

// ==================== 边界条件与完整性测试 ====================

describe('离线词典覆盖率', () => {
  it('所有常见单词都应该在词典中', () => {
    const commonWords = [
      'hello', 'world', 'apple', 'book', 'car', 'dog', 'eat',
      'fish', 'good', 'hand', 'ice', 'job', 'king', 'love',
      'milk', 'name', 'open', 'pen', 'question', 'run', 'sun',
      'time', 'water', 'yellow', 'zoo',
    ]
    for (const word of commonWords) {
      expect(hasOfflineDict(word)).toBe(true)
    }
  })

  it('介词和连词应该在词典中', () => {
    const functionWords = ['a', 'an', 'the', 'is', 'are', 'am',
      'was', 'were', 'be', 'been', 'have', 'has', 'had',
      'do', 'does', 'did', 'will', 'would', 'shall', 'should',
      'may', 'might', 'can', 'could', 'must', 'need',
      'about', 'above', 'across', 'after', 'against', 'along',
      'among', 'around', 'at', 'before', 'behind', 'below',
      'between', 'but', 'by', 'down', 'during', 'except',
      'for', 'from', 'in', 'inside', 'into', 'like', 'near',
      'of', 'off', 'on', 'out', 'outside', 'over', 'past',
      'since', 'through', 'to', 'under', 'until', 'with', 'without',
    ]
    for (const word of functionWords) {
      expect(hasOfflineDict(word)).toBe(true)
    }
  })
})
