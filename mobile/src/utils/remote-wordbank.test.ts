/**
 * remote-wordbank.ts 缓存分块测试
 * 重点：超 1MB 词库（如 level8）整存必然写失败，必须分块写入且能读回；
 * 兼容旧版整存格式；导入后删除缓存含分块清理。
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

// 内存 Map 兜底 uni storage
const store = new Map<string, any>()
let mockDownloadContent = ''
let downloadFails = false
const downloadFile = vi.fn(({ url, success, fail }: any) => {
  if (downloadFails) { fail?.({ errMsg: 'downloadFile:fail mock' }); return }
  if (url.includes('404')) return
  success({ statusCode: 200, tempFilePath: '/tmp/mock.json' })
})
const request = vi.fn()
vi.stubGlobal('uni', {
  getStorageSync: (k: string) => store.get(k) ?? '',
  setStorageSync: (k: string, v: any) => { store.set(k, v) },
  removeStorageSync: (k: string) => { store.delete(k) },
  downloadFile,
  request,
  getFileSystemManager: () => ({
    readFile: ({ success }: any) => success({ data: mockDownloadContent }),
  }),
})

import {
  loadCachedWordBank,
  removeCachedWordBank,
  getCachedBankIds,
  downloadWordBank,
  getWordBank,
  fetchRemoteIndex,
  getBundledIndex,
  categoryIdOf,
  buildCategoryTabs,
  hasSpeechAudio,
  PUBLIC_HOSTED_BANKS,
  type RemoteWordBankInfo,
} from '@/utils/remote-wordbank'

const CACHE_KEY_PREFIX = 'slowlyrecord_remote_wordbank_'

/** 直接调用模块内部分块逻辑不可行（未导出），写入侧通过 downloadWordBank 端到端验证。 */

describe('downloadWordBank 缓存写入', () => {
  beforeEach(() => store.clear())

  it('小词库整存，读回一致', async () => {
    const words = [{ word: 'apple', meaning: '苹果' }]
    mockDownloadContent = JSON.stringify(words)
    const result = await downloadWordBank('cet4')
    expect(result).toEqual(words)
    expect(typeof store.get(CACHE_KEY_PREFIX + 'cet4')).toBe('string')
    expect(loadCachedWordBank('cet4')).toEqual(words)
    expect(getCachedBankIds()).toContain('cet4')
  })

  it('超 1MB 大词库自动分块写入且能读回（level8 场景回归）', async () => {
    // 构造 >800KB 的 JSON：每个词约 60 字节，2 万个词约 1.2MB
    const words = Array.from({ length: 20000 }, (_, i) => ({
      word: `word${i}`, meaning: `释义${i}`, phonetic: `/wɜːd${i}/`,
    }))
    mockDownloadContent = JSON.stringify(words)
    expect(mockDownloadContent.length).toBeGreaterThan(900 * 1024)

    const result = await downloadWordBank('level8')
    expect(result.length).toBe(20000)
    // 主 key 存的是分块元信息而非整串
    const meta = store.get(CACHE_KEY_PREFIX + 'level8')
    expect(meta._chunks).toBeGreaterThan(1)
    expect(loadCachedWordBank('level8')).toEqual(words)
    expect(getCachedBankIds()).toContain('level8')
  })

  it('多字节词库（日/俄/汉/emoji）按 UTF-8 字节分块、逐块不超限且无损重组（D15 回归）', async () => {
    // 高比例 3 字节字符：UTF-16 长度不到 800K，但 UTF-8 字节超 800KB——旧实现按字符数判断会整存超限
    const words = Array.from({ length: 14000 }, (_, i) => ({
      word: `あい${i}`, meaning: `あいうえおかきくけこ${i}`,
    }))
    mockDownloadContent = JSON.stringify(words)
    const byteLen = (s: string) => new TextEncoder().encode(s).length
    expect(mockDownloadContent.length).toBeLessThan(800 * 1024)
    expect(byteLen(mockDownloadContent)).toBeGreaterThan(800 * 1024)

    const result = await downloadWordBank('jlpt-n3')
    expect(result).toEqual(words)
    const meta = store.get(CACHE_KEY_PREFIX + 'jlpt-n3')
    expect(meta._chunks).toBeGreaterThan(1)
    expect(meta._chunkKeys).toHaveLength(meta._chunks)
    for (const chunkKey of meta._chunkKeys) {
      expect(byteLen(store.get(chunkKey))).toBeLessThanOrEqual(800 * 1024)
    }
    expect(loadCachedWordBank('jlpt-n3')).toEqual(words)
  })

  it('代理对字符（emoji，4 字节）跨分块边界不被切断（D15 回归）', async () => {
    // 让每个词以 emoji 结尾，分块边界大概率落在代理对中间
    const words = Array.from({ length: 30000 }, (_, i) => ({
      word: `word${i}😀`, meaning: `释义${i}`, phonetic: '',
    }))
    mockDownloadContent = JSON.stringify(words)
    expect(new TextEncoder().encode(mockDownloadContent).length).toBeGreaterThan(800 * 1024)

    const result = await downloadWordBank('emoji-bank')
    expect(result).toEqual(words)
    const meta = store.get(CACHE_KEY_PREFIX + 'emoji-bank')
    expect(meta._chunks).toBeGreaterThan(1)
    expect(loadCachedWordBank('emoji-bank')).toEqual(words)
  })
})

describe('词库下载有效性', () => {
  beforeEach(() => { store.clear(); mockDownloadContent = ''; downloadFails = false })

  it('空词库文件视为下载失败：不写缓存、不标记已下载（newConcept = [] 回归）', async () => {
    mockDownloadContent = '[]'
    await expect(downloadWordBank('cet4')).rejects.toThrow('词库文件为空')
    expect(getCachedBankIds()).not.toContain('cet4')
  })

  it('已缓存空数组视为无效，getWordBank 会重新下载', async () => {
    store.set(CACHE_KEY_PREFIX + 'cet4', '[]')
    store.set('slowlyrecord_remote_wordbank_index', JSON.stringify(['cet4']))
    mockDownloadContent = JSON.stringify([{ word: 'refuse', explains: 'v. 拒绝' }])
    const words = await getWordBank('cet4')
    expect(words).toHaveLength(1)
    expect(downloadFile).toHaveBeenCalled()
    expect(getCachedBankIds()).toContain('cet4')
  })
})

describe('loadCachedWordBank', () => {
  beforeEach(() => store.clear())

  it('旧版整存格式（JSON 字符串）正常读回', () => {
    const words = [{ word: 'apple', meaning: '苹果' }]
    store.set(CACHE_KEY_PREFIX + 'cet4', JSON.stringify(words))
    expect(loadCachedWordBank('cet4')).toEqual(words)
  })

  it('分块格式读回：多块拼接后解析', () => {
    const words = [{ word: 'abandon', meaning: '放弃' }]
    const json = JSON.stringify(words)
    const mid = Math.ceil(json.length / 2)
    const key = CACHE_KEY_PREFIX + 'gre'
    store.set(`${key}__chunk__0`, json.slice(0, mid))
    store.set(`${key}__chunk__1`, json.slice(mid))
    store.set(key, { _chunks: 2, _chunkKeys: [`${key}__chunk__0`, `${key}__chunk__1`] })
    expect(loadCachedWordBank('gre')).toEqual(words)
  })

  it('分块缺失任一块返回 null（不返回半成品）', () => {
    const key = CACHE_KEY_PREFIX + 'gre'
    store.set(`${key}__chunk__0`, '[{"word":"a"}')
    store.set(key, { _chunks: 2, _chunkKeys: [`${key}__chunk__0`, `${key}__chunk__1`] })
    expect(loadCachedWordBank('gre')).toBeNull()
  })

  it('分块数与 key 列表不一致（半截写入）返回 null（14.4 回归）', () => {
    const key = CACHE_KEY_PREFIX + 'gre'
    store.set(`${key}__chunk__0`, '[{"word":"a"}]')
    store.set(key, { _chunks: 2, _chunkKeys: [`${key}__chunk__0`] })
    expect(loadCachedWordBank('gre')).toBeNull()
    store.set(key, { _chunks: 1, _chunkKeys: [`${key}__chunk__0`, `${key}__chunk__1`] })
    expect(loadCachedWordBank('gre')).toBeNull()
  })

  it('未缓存 / 非法内容返回 null', () => {
    expect(loadCachedWordBank('nonexistent')).toBeNull()
    store.set(CACHE_KEY_PREFIX + 'bad', '{not json')
    expect(loadCachedWordBank('bad')).toBeNull()
  })
})

describe('removeCachedWordBank', () => {
  it('删除缓存同时移出「已下载」列表（导入后清缓存不再显示已下载）', () => {
    store.set(CACHE_KEY_PREFIX + 'cet4', JSON.stringify([{ word: 'a' }]))
    store.set(CACHE_KEY_PREFIX + 'cet6', JSON.stringify([{ word: 'b' }]))
    store.set('slowlyrecord_remote_wordbank_index', JSON.stringify(['cet4', 'cet6']))
    removeCachedWordBank('cet4')
    expect(getCachedBankIds()).toEqual(['cet6'])
  })

  beforeEach(() => store.clear())

  it('删除整存缓存', () => {
    store.set(CACHE_KEY_PREFIX + 'cet4', '[]')
    removeCachedWordBank('cet4')
    expect(store.has(CACHE_KEY_PREFIX + 'cet4')).toBe(false)
  })

  it('删除分块缓存时连带清理所有分块 key', () => {
    const key = CACHE_KEY_PREFIX + 'level8'
    store.set(`${key}__chunk__0`, 'a')
    store.set(`${key}__chunk__1`, 'b')
    store.set(key, { _chunks: 2, _chunkKeys: [`${key}__chunk__0`, `${key}__chunk__1`] })
    removeCachedWordBank('level8')
    expect(store.has(key)).toBe(false)
    expect(store.has(`${key}__chunk__0`)).toBe(false)
    expect(store.has(`${key}__chunk__1`)).toBe(false)
  })

  it('删除不存在的缓存不抛异常', () => {
    expect(() => removeCachedWordBank('nonexistent')).not.toThrow()
  })
})

describe('getCachedBankIds', () => {
  it('列表里的 id 但缓存内容已丢失时自愈剔除', () => {
    store.set('slowlyrecord_remote_wordbank_index', JSON.stringify(['cet4', 'cet6']))
    store.set(CACHE_KEY_PREFIX + 'cet6', JSON.stringify([{ word: 'a' }]))
    expect(getCachedBankIds()).toEqual(['cet6'])
    expect(JSON.parse(store.get('slowlyrecord_remote_wordbank_index'))).toEqual(['cet6'])
  })

  beforeEach(() => store.clear())

  it('空存储返回空数组', () => {
    expect(getCachedBankIds()).toEqual([])
  })

  it('读取已缓存 id 列表', () => {
    store.set(CACHE_KEY_PREFIX + 'cet4', JSON.stringify([{ word: 'a' }]))
    store.set(CACHE_KEY_PREFIX + 'gre', JSON.stringify([{ word: 'b' }]))
    store.set('slowlyrecord_remote_wordbank_index', JSON.stringify(['cet4', 'gre']))
    expect(getCachedBankIds()).toEqual(['cet4', 'gre'])
  })
})

describe('远程清单拉取', () => {
  beforeEach(() => {
    store.clear()
    mockDownloadContent = ''
    downloadFails = false
    request.mockReset()
    downloadFile.mockClear()
  })

  it('清单走 downloadFile 即可拿到，不依赖 request 合法域名', async () => {
    mockDownloadContent = JSON.stringify([{ id: 'cet4', name: '四级词汇', wordCount: 3739, sizeKB: 305 }])
    const list = await fetchRemoteIndex()
    expect(request).not.toHaveBeenCalled()
    expect(list?.some(bank => bank.id === 'cet4')).toBe(true)
    expect(list).toHaveLength(1 + PUBLIC_HOSTED_BANKS.length)
  })

  it('downloadFile 失败时回退 request，且字符串型 data 也能解析', async () => {
    downloadFails = true
    request.mockImplementation(({ success }: any) => success({
      statusCode: 200,
      data: JSON.stringify([{ id: 'cet6', name: '六级词汇', wordCount: 2078, sizeKB: 190 }]),
    }))
    const list = await fetchRemoteIndex()
    expect(list?.some(bank => bank.id === 'cet6')).toBe(true)
  })

  it('随包内置清单可直接渲染（首屏不等网络）', () => {
    const list = getBundledIndex()
    expect(list.length).toBeGreaterThan(10)
    expect(list.some(bank => bank.id === 'cet4')).toBe(true)
    expect(list.length).toBeGreaterThan(PUBLIC_HOSTED_BANKS.length)
    expect(new Set(list.map(bank => bank.language))).toEqual(new Set(['en', 'ja', 'ru', 'es', 'fr']))
  })

  it('两个通道都失败且无缓存时退回内置清单', async () => {
    downloadFails = true
    request.mockImplementation(({ fail }: any) => fail({ errMsg: 'request:fail mock' }))
    const list = await fetchRemoteIndex()
    expect(list?.some(bank => bank.id === 'cet4')).toBe(true)
  })

  it('两个通道都失败时退回上次成功清单（不整页空白）', async () => {
    mockDownloadContent = JSON.stringify([{ id: 'kaoyan', name: '考研词汇', wordCount: 4533, sizeKB: 518 }])
    const first = await fetchRemoteIndex()
    expect(first?.some(bank => bank.id === 'kaoyan')).toBe(true)

    downloadFails = true
    request.mockImplementation(({ fail }: any) => fail({ errMsg: 'request:fail mock' }))
    const second = await fetchRemoteIndex()
    expect(second?.some(bank => bank.id === 'kaoyan')).toBe(true)
  })
})

describe('多语言词库', () => {
  beforeEach(() => {
    store.clear()
    mockDownloadContent = ''
    downloadFails = false
    request.mockReset()
    downloadFile.mockClear()
  })

  it('旧远程清单也补齐全部非英语词库，且清单与实际 JSON 一致', async () => {
    request.mockImplementation(({ success }: any) => success({
      statusCode: 200,
      data: [{ id: 'cet4', name: '四级词汇', wordCount: 3739, sizeKB: 305 }],
    }))
    const list = await fetchRemoteIndex()
    expect(list).toHaveLength(1 + PUBLIC_HOSTED_BANKS.length)
    expect(new Set(list?.map(bank => bank.language))).toEqual(new Set(['en', 'ja', 'ru', 'es', 'fr']))
    for (const bank of PUBLIC_HOSTED_BANKS) {
      const words = JSON.parse(readFileSync(resolve(process.cwd(), `public/wordbanks/${bank.id}.json`), 'utf-8'))
      expect(words, bank.id).toHaveLength(bank.wordCount)
    }
  })

  it('日语词库从现有 public/wordbanks 下载', async () => {
    mockDownloadContent = JSON.stringify([{ word: 'あい', meaning: '爱' }])
    await downloadWordBank('jlpt-n5')
    expect(downloadFile.mock.calls[0][0].url).toBe(
      'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/wordbanks/jlpt-n5.json',
    )
  })
})

describe('词库分类', () => {
  it('仓库清单里的英语词库全都有明确分类（不落到「其他」）', () => {
    const index = JSON.parse(
      readFileSync(resolve(process.cwd(), 'mobile/wordbank-json/index.json'), 'utf-8'),
    ) as RemoteWordBankInfo[]
    for (const bank of index) {
      expect(categoryIdOf({ ...bank, language: 'en' }), bank.id).not.toBe('other')
    }
  })

  it('托管词库分类：非英语按语种，英语口语库归口语句型', () => {
    for (const bank of PUBLIC_HOSTED_BANKS) {
      if ((bank.language || 'en') === 'en') {
        expect(categoryIdOf(bank), bank.id).toBe('oral')
      } else {
        expect(categoryIdOf(bank), bank.id).toBe(`lang:${bank.language}`)
      }
    }
  })

  it('分类 tab：英语汇总在最前，英语分类其次、语种在后，只列出清单里出现的', () => {
    const list: RemoteWordBankInfo[] = [
      { id: 'cet4', name: '四级词汇', wordCount: 1, sizeKB: 1, language: 'en' },
      { id: 'dining', name: '吃饭', wordCount: 1, sizeKB: 1, language: 'en' },
      { id: 'jlpt-n5', name: 'JLPT N5', wordCount: 1, sizeKB: 1, language: 'ja' },
    ]
    expect(buildCategoryTabs(list)).toEqual([
      { id: 'lang:en', label: '英语' },
      { id: 'exam', label: '考试' },
      { id: 'life', label: '生活场景' },
      { id: 'lang:ja', label: '日语' },
    ])
  })

  it('纯非英语清单不出「英语」汇总 tab', () => {
    const list: RemoteWordBankInfo[] = [
      { id: 'jlpt-n5', name: 'JLPT N5', wordCount: 1, sizeKB: 1, language: 'ja' },
    ]
    expect(buildCategoryTabs(list)).toEqual([{ id: 'lang:ja', label: '日语' }])
  })

  it('hasSpeechAudio：口语句库带预合成音频，其余不带', () => {
    expect(hasSpeechAudio('spoken-reductions-1')).toBe(true)
    expect(hasSpeechAudio('spoken-reactions-1')).toBe(true)
    expect(hasSpeechAudio('cet4')).toBe(false)
    expect(hasSpeechAudio('')).toBe(false)
  })

  it('未收录的英语 id 归「其他」', () => {
    expect(categoryIdOf({ id: 'xxx-new', name: '', wordCount: 1, sizeKB: 1, language: 'en' })).toBe('other')
  })
})
