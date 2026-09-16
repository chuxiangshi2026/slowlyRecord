/**
 * 本地词典（local-dictionary.ts）单元测试
 *
 * 模块通过动态 import 加载 words/ 分片与 phrases-data.json，并依赖
 * dictionary-db（外部词典 DB）与 translation-api（发音 URL）。
 * 这里全部用 vi.mock 注入可控数据：分片/短语内容挂在 hoisted holder 上，
 * 每个用例 vi.resetModules() 后动态 import 被测模块，重置模块级缓存
 * （dictionaryCache / dictionaryLoading / phrasesCache / phrasesLoading）。
 *
 * 覆盖重点：
 * - 单词规范化（大小写、空白）、精简数组格式转换、键名小写化
 * - 直接命中 / 未命中、词形还原（-s / -es / -ed / -ing / -ies）
 * - 外部词典（uTools DB）回退及未安装时不查询外部
 * - 延迟加载缓存：重复调用走缓存、并发去重、分片失败容错与重试
 * - 统计信息（内置 + 外部合并、useCache 语义）
 * - 翻译：空文本、单字/多释义、短语整句与句中 n-gram、句型规则、时间词前置、未知词保留
 * - 同步版本在数据未加载时的行为
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// testTimeout: 每用例 vi.resetModules() 后动态 import 大 JSON 分片，全量并行跑时偶发默认超时，放宽到 30s
vi.setConfig({ testTimeout: 30000 })

// ---- hoisted 可控状态（vi.mock 工厂内只能访问 vi.hoisted 的变量） ----
const { shardHolder, shardFailHolder, phraseHolder, phraseFailHolder, dbHolder, dbQuerySpy } = vi.hoisted(() => ({
  shardHolder: {} as Record<string, Record<string, any>>,
  shardFailHolder: { a: false },
  phraseHolder: { phrases: {} as Record<string, string> },
  phraseFailHolder: { fail: false },
  dbHolder: { installed: false, words: {} as Record<string, any> },
  dbQuerySpy: vi.fn(),
}))

// ---- mock words/ 分片：全部持有化（getter 每次读取当前内容，可注入/可失败） ----
// 注意：vitest 会缓存 mock 模块的命名空间对象，普通属性在首次求值后不再重算，
// 因此用 getter 让被测模块每次 spread/access 时读到 holder 的最新状态；
// getter 抛错发生在被测模块 .then() 内，正好落入其 import 失败的 catch 分支。
vi.mock('../../words/a.json', () => ({
  get default() {
    if (shardFailHolder.a) throw new Error('shard a load failed')
    return shardHolder.a
  },
}))
vi.mock('../../words/b.json', () => ({ get default() { return shardHolder.b } }))
vi.mock('../../words/c.json', () => ({ get default() { return shardHolder.c } }))
vi.mock('../../words/d.json', () => ({ get default() { return shardHolder.d } }))
vi.mock('../../words/e.json', () => ({ default: {} }))
vi.mock('../../words/f.json', () => ({ default: {} }))
vi.mock('../../words/g.json', () => ({ get default() { return shardHolder.g } }))
vi.mock('../../words/h.json', () => ({ get default() { return shardHolder.h } }))
vi.mock('../../words/i.json', () => ({ get default() { return shardHolder.i } }))
vi.mock('../../words/j.json', () => ({ default: {} }))
vi.mock('../../words/k.json', () => ({ default: {} }))
vi.mock('../../words/l.json', () => ({ default: {} }))
vi.mock('../../words/m.json', () => ({ get default() { return shardHolder.m } }))
vi.mock('../../words/n.json', () => ({ default: {} }))
vi.mock('../../words/o.json', () => ({ get default() { return shardHolder.o } }))
vi.mock('../../words/p.json', () => ({ default: {} }))
vi.mock('../../words/q.json', () => ({ default: {} }))
vi.mock('../../words/r.json', () => ({ get default() { return shardHolder.r } }))
vi.mock('../../words/s.json', () => ({ get default() { return shardHolder.s } }))
vi.mock('../../words/t.json', () => ({ get default() { return shardHolder.t } }))
vi.mock('../../words/u.json', () => ({ default: {} }))
vi.mock('../../words/v.json', () => ({ default: {} }))
vi.mock('../../words/w.json', () => ({ get default() { return shardHolder.w } }))
vi.mock('../../words/x.json', () => ({ default: {} }))
vi.mock('../../words/y.json', () => ({ get default() { return shardHolder.y } }))
vi.mock('../../words/z.json', () => ({ default: {} }))

// ---- mock 短语库（同样持有化，可注入/可失败） ----
vi.mock('./phrases-data.json', () => ({
  get default() {
    if (phraseFailHolder.fail) throw new Error('phrases load failed')
    return phraseHolder.phrases
  },
}))

// ---- mock 外部词典 DB 与发音 URL ----
vi.mock('./dictionary-db', () => ({
  hasDictionaryInDB: () => dbHolder.installed,
  queryWordFromDB: dbQuerySpy,
  loadDictionaryFromDB: () => (dbHolder.installed ? dbHolder.words : null),
  saveDictionaryToDB: vi.fn(async () => true),
  getDictionaryVersion: () => null,
  removeDictionaryFromDB: vi.fn(async () => true),
  importDictionaryFromJSON: vi.fn(async () => true),
  importDictionaryFromFile: vi.fn(async () => true),
  getExternalDictionaryCount: () => Object.keys(dbHolder.words).length,
}))

vi.mock('./translation-api', () => ({
  getPronunciationUrlSync: (word: string) => `mock-tts://${word}`,
}))

// ---- 测试夹具 ----
// 28 个词条：覆盖完整对象格式、精简数组格式、大写键（应被小写化）
const DEFAULT_SHARDS: Record<string, Record<string, any>> = {
  a: {
    apple: { word: 'apple', phonetic: '/ˈæpəl/', explains: ['n. 苹果'] },
    apply: ['/əˈplaɪ/', 'v. 应用', 'v. 申请'],
    are: { word: 'are', phonetic: '/ɑː/', explains: ['v. 是'] },
    a: { word: 'a', phonetic: '/ə/', explains: ['art. 一'] },
  },
  b: {
    'Boat': { word: 'boat', phonetic: '/bəʊt/', explains: ['n. 船'] },
    box: { word: 'box', phonetic: '/bɒks/', explains: ['n. 盒子'] },
  },
  c: {
    cat: { word: 'cat', phonetic: '/kæt/', explains: ['n. 猫'] },
    cake: { word: 'cake', phonetic: '/keɪk/', explains: ['n. 蛋糕'] },
    call: { word: 'call', phonetic: '/kɔːl/', explains: ['v. 打电话'] },
  },
  d: { do: { word: 'do', phonetic: '/duː/', explains: ['v. 做'] } },
  g: { go: { word: 'go', phonetic: '/ɡəʊ/', explains: ['v. 去'] } },
  h: {
    have: { word: 'have', phonetic: '/hæv/', explains: ['v. 有'] },
    hello: { word: 'hello', phonetic: '/həˈləʊ/', explains: ['int. 你好'] },
  },
  i: {
    i: { word: 'i', phonetic: '/aɪ/', explains: ['pron. 我'] },
    is: { word: 'is', phonetic: '/ɪz/', explains: ['v. 是'] },
  },
  m: { make: { word: 'make', phonetic: '/meɪk/', explains: ['v. 制作'] } },
  o: { ok: { word: 'ok', phonetic: '/əʊˈkeɪ/', explains: ['adj. 好'] } },
  r: {
    run: { word: 'run', phonetic: '/rʌn/', explains: ['v. 跑'] },
    running: { word: 'running', phonetic: '/ˈrʌnɪŋ/', explains: ['v. 跑步'] },
  },
  s: {
    say: { word: 'say', phonetic: '/seɪ/', explains: ['v. 说'] },
    she: { word: 'she', phonetic: '/ʃiː/', explains: ['pron. 她'] },
  },
  t: {
    test: { word: 'test', phonetic: '/test/', explains: ['n. 测试', 'v. 测验'] },
    this: { word: 'this', phonetic: '/ðɪs/', explains: ['pron. 这'] },
    to: { word: 'to', phonetic: '/tuː/', explains: ['prep. 向'] },
  },
  w: {
    walk: { word: 'walk', phonetic: '/wɔːk/', explains: ['v. 走路'] },
    want: { word: 'want', phonetic: '/wɒnt/', explains: ['v. 想要'] },
  },
  y: {
    you: { word: 'you', phonetic: '/juː/', explains: ['pron. 你'] },
    yesterday: { word: 'yesterday', phonetic: '/ˈjestədeɪ/', explains: ['adv. 昨天'] },
  },
}
const LOCAL_TOTAL = 28
const DEFAULT_PHRASES: Record<string, string> = {
  hi: '你好',
  'good morning': '早上好',
}

type LocalDictionaryModule = typeof import('./local-dictionary')

let mod: LocalDictionaryModule

beforeEach(async () => {
  vi.resetModules()
  vi.clearAllMocks()
  // 注入默认夹具
  for (const key of Object.keys(shardHolder)) delete shardHolder[key]
  Object.assign(shardHolder, JSON.parse(JSON.stringify(DEFAULT_SHARDS)))
  shardFailHolder.a = false
  phraseHolder.phrases = { ...DEFAULT_PHRASES }
  phraseFailHolder.fail = false
  dbHolder.installed = false
  dbHolder.words = {}
  dbQuerySpy.mockImplementation((word: string) => dbHolder.words[word.toLowerCase()] ?? null)
  // 静默模块内的调试日志
  vi.spyOn(console, 'log').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  // 每个用例拿到全新的模块实例（模块级缓存随之重置）
  mod = await import('./local-dictionary')
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('queryLocalDictionaryAsync - 直接查询与规范化', () => {
  it('命中词条返回完整条目（含音标与释义）', async () => {
    const entry = await mod.queryLocalDictionaryAsync('apple')
    expect(entry).toEqual({ word: 'apple', phonetic: '/ˈæpəl/', explains: ['n. 苹果'] })
  })

  it('大小写与首尾空白会被规范化', async () => {
    const entry = await mod.queryLocalDictionaryAsync('  APPLE  ')
    expect(entry?.word).toBe('apple')
    expect(await mod.queryLocalDictionaryAsync('Apple')).not.toBeNull()
  })

  it('大写键的词条会被小写化后命中', async () => {
    const entry = await mod.queryLocalDictionaryAsync('boat')
    expect(entry?.word).toBe('boat')
  })

  it('精简数组格式 [音标, 释义...] 会被转换为完整对象', async () => {
    const entry = await mod.queryLocalDictionaryAsync('apply')
    expect(entry).toEqual({ word: 'apply', phonetic: '/əˈplaɪ/', explains: ['v. 应用', 'v. 申请'] })
  })

  it('未收录的单词返回 null', async () => {
    expect(await mod.queryLocalDictionaryAsync('zzzznotaword')).toBeNull()
  })

  it('空字符串查询返回 null', async () => {
    expect(await mod.queryLocalDictionaryAsync('')).toBeNull()
  })
})

describe('queryLocalDictionaryAsync - 词形还原', () => {
  it("cats -> cat（去 -s）", async () => {
    expect((await mod.queryLocalDictionaryAsync('cats'))?.word).toBe('cat')
  })

  it("boxes -> box（去 -es）", async () => {
    expect((await mod.queryLocalDictionaryAsync('boxes'))?.word).toBe('box')
  })

  it("walked -> walk（去 -ed）", async () => {
    expect((await mod.queryLocalDictionaryAsync('walked'))?.word).toBe('walk')
  })

  it("making -> make（去 -ing 补 e）", async () => {
    expect((await mod.queryLocalDictionaryAsync('making'))?.word).toBe('make')
  })

  it('还原也走外部查询规范化（传给小写词条）', async () => {
    // 直接命中优先于词形还原：walked 命中 walk 后不应再查 walking 等
    await mod.queryLocalDictionaryAsync('walked')
    expect(dbQuerySpy).not.toHaveBeenCalled()
  })
})

describe('queryLocalDictionaryAsync - 外部词典回退', () => {
  beforeEach(() => {
    dbHolder.installed = true
    dbHolder.words = {
      zebra: { word: 'zebra', phonetic: '/ˈziːbrə/', explains: ['n. 斑马'] },
    }
  })

  it('内置词库未命中时回退到外部词典', async () => {
    const entry = await mod.queryLocalDictionaryAsync('zebra')
    expect(entry?.explains).toEqual(['n. 斑马'])
    expect(dbQuerySpy).toHaveBeenCalledWith('zebra')
  })

  it('外部词典同样做词形还原（zebras -> zebra）', async () => {
    const entry = await mod.queryLocalDictionaryAsync('zebras')
    expect(entry?.word).toBe('zebra')
  })

  it('外部词典已安装但未收录该词时返回 null', async () => {
    expect(await mod.queryLocalDictionaryAsync('lion')).toBeNull()
  })

  it('未安装外部词典时不触发外部查询', async () => {
    dbHolder.installed = false
    expect(await mod.queryLocalDictionaryAsync('zebra')).toBeNull()
    expect(dbQuerySpy).not.toHaveBeenCalled()
  })
})

describe('loadDictionaryLazy - 缓存与容错', () => {
  it('重复调用返回同一缓存对象', async () => {
    const d1 = await mod.default.loadDictionaryLazy()
    const d2 = await mod.default.loadDictionaryLazy()
    expect(d1).toBe(d2)
  })

  it('并发调用去重：两次调用解析为同一词典对象', async () => {
    // loadDictionaryLazy 是 async 函数，每次调用返回新的 Promise 包装，
    // 去重的可观察语义是：并发调用复用同一条加载链，解析到同一个缓存对象
    const [d1, d2] = await Promise.all([
      mod.default.loadDictionaryLazy(),
      mod.default.loadDictionaryLazy(),
    ])
    expect(d1).toBe(d2)
  })

  it('缓存生效：加载后修改分片数据不影响已缓存结果', async () => {
    const d1 = await mod.default.loadDictionaryLazy()
    expect(Object.keys(d1)).toHaveLength(LOCAL_TOTAL)
    shardHolder.a.newword = { word: 'newword', explains: ['n. 新词'] }
    const d2 = await mod.default.loadDictionaryLazy()
    expect(Object.keys(d2)).toHaveLength(LOCAL_TOTAL)
    expect(d2['newword']).toBeUndefined()
  })

  it('分片加载失败时容错为空对象，恢复后可重试成功', async () => {
    shardFailHolder.a = true
    const failed = await mod.default.loadDictionaryLazy()
    expect(failed).toEqual({})
    expect(await mod.queryLocalDictionaryAsync('apple')).toBeNull()

    shardFailHolder.a = false
    const retried = await mod.default.loadDictionaryLazy()
    expect(Object.keys(retried)).toHaveLength(LOCAL_TOTAL)
  })
})

describe('loadPhrasesLazy - 缓存与容错', () => {
  it('重复调用返回同一缓存对象', async () => {
    const p1 = await mod.default.loadPhrasesLazy()
    const p2 = await mod.default.loadPhrasesLazy()
    expect(p1).toBe(p2)
    expect(p1['good morning']).toBe('早上好')
  })

  it('加载失败时容错为空对象并可重试', async () => {
    phraseFailHolder.fail = true
    expect(await mod.default.loadPhrasesLazy()).toEqual({})
    phraseFailHolder.fail = false
    expect((await mod.default.loadPhrasesLazy())['hi']).toBe('你好')
  })
})

describe('queryLocalDictionary / hasLocalWord（同步）', () => {
  it('词典未加载时同步查询返回 null，并触发后台加载', async () => {
    expect(mod.queryLocalDictionary('apple')).toBeNull()
    // 后台加载完成后即可命中
    await mod.default.loadDictionaryLazy()
    expect(mod.queryLocalDictionary('apple')?.word).toBe('apple')
  })

  it('hasLocalWord 随加载状态变化', async () => {
    expect(mod.hasLocalWord('cat')).toBe(false)
    await mod.default.loadDictionaryLazy()
    expect(mod.hasLocalWord('cat')).toBe(true)
    expect(mod.hasLocalWord('zzzznotaword')).toBe(false)
  })
})

describe('getDictionaryStats', () => {
  it('未加载且 useCache=true（默认）时统计为空', async () => {
    const stats = await mod.getDictionaryStats()
    expect(stats).toEqual({
      total: 0,
      localTotal: 0,
      externalTotal: 0,
      hasExternal: false,
      letterCounts: {},
    })
  })

  it('useCache=false 时强制加载并按首字母统计', async () => {
    const stats = await mod.getDictionaryStats(false)
    expect(stats.localTotal).toBe(LOCAL_TOTAL)
    expect(stats.total).toBe(LOCAL_TOTAL)
    expect(stats.hasExternal).toBe(false)
    // a: apple/apply/are/a；b: Boat(->boat)/box；t: test/this/to
    expect(stats.letterCounts['a']).toBe(4)
    expect(stats.letterCounts['b']).toBe(2)
    expect(stats.letterCounts['t']).toBe(3)
    expect(Object.values(stats.letterCounts).reduce((s, n) => s + n, 0)).toBe(LOCAL_TOTAL)
  })

  it('已加载时 useCache=true 直接读缓存', async () => {
    await mod.default.loadDictionaryLazy()
    const stats = await mod.getDictionaryStats()
    expect(stats.localTotal).toBe(LOCAL_TOTAL)
  })

  it('外部词典存在时合并统计（externalTotal / total / letterCounts）', async () => {
    await mod.default.loadDictionaryLazy()
    dbHolder.installed = true
    dbHolder.words = {
      zebra: { word: 'zebra', explains: ['n. 斑马'] },
      zone: { word: 'zone', explains: ['n. 区域'] },
    }
    const stats = await mod.getDictionaryStats()
    expect(stats.hasExternal).toBe(true)
    expect(stats.externalTotal).toBe(2)
    expect(stats.total).toBe(LOCAL_TOTAL + 2)
    expect(stats.letterCounts['z']).toBe(2)
  })
})

describe('translateWithLocalDictionaryAsync', () => {
  it('空文本与纯空白返回参数错误', async () => {
    for (const text of ['', '   ']) {
      const result = await mod.translateWithLocalDictionaryAsync(text)
      expect(result).toEqual({ success: false, errorMsg: '请输入要翻译的文本', isLocal: true })
    }
  })

  it('单词查询：释义拼接、音标与发音 URL', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('  APPLE ')
    expect(result).toEqual({
      success: true,
      explains: 'n. 苹果',
      phonetic: '/ˈæpəl/',
      pronunciation: 'mock-tts://apple',
      isLocal: true,
    })
  })

  it('多释义词条用分号拼接', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('apply')
    expect(result.explains).toBe('v. 应用；v. 申请')
    expect(result.phonetic).toBe('/əˈplaɪ/')
  })

  it('未收录单词返回失败并提示切换网络翻译', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('zzzznotaword')
    expect(result.success).toBe(false)
    expect(result.errorMsg).toBe('词库暂未收录 "zzzznotaword"，建议切换至网络翻译')
    expect(result.isLocal).toBe(true)
  })

  it("词形还原：applies -> apply（-ies -> -y），发音用原词", async () => {
    const result = await mod.translateWithLocalDictionaryAsync('applies')
    expect(result.success).toBe(true)
    expect(result.explains).toBe('v. 应用；v. 申请')
    expect(result.pronunciation).toBe('mock-tts://applies')
  })

  it('单字短语命中短语库并附发音 URL', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('hi')
    expect(result).toEqual({
      success: true,
      explains: '你好',
      pronunciation: 'mock-tts://hi',
      isLocal: true,
    })
  })

  it('整句短语命中短语库（多词不带发音 URL）', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('good morning')
    expect(result).toEqual({ success: true, explains: '早上好', pronunciation: undefined, isLocal: true })
  })

  it('清理后无有效单词时返回“无法识别的文本”', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('. !')
    expect(result).toEqual({ success: false, errorMsg: '无法识别的文本', isLocal: true })
  })

  it('句型规则：I want to ... 去掉 to 的连接', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('i want to go')
    expect(result.success).toBe(true)
    expect(result.explains).toBe('我想要去')
  })

  it('句型规则：一般疑问句加“是否”', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('are you ok')
    expect(result.explains).toBe('是否是你好')
  })

  it('句型规则：wh 疑问句映射疑问词', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('what is this')
    expect(result.explains).toBe('什么是这')
  })

  it('句型规则：there be 句型译为“有”', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('there is a cat')
    expect(result.explains).toBe('有一猫')
  })

  it('句型规则：进行时为“正在”', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('she is running')
    expect(result.explains).toBe('她正在跑步')
  })

  it('句型规则：完成时为“已经”', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('i have walked')
    expect(result.explains).toBe('我已经走路')
  })

  it('时间词前置（yesterday 移到句首）', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('i go yesterday')
    expect(result.explains).toBe('昨天我去')
  })

  it('未知单词按原样保留', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('i go zzzq')
    expect(result.explains).toBe('我去zzzq')
  })

  it('句中 n-gram 短语优先于逐词翻译', async () => {
    const result = await mod.translateWithLocalDictionaryAsync('i say good morning')
    expect(result.explains).toBe('我说早上好')
  })
})

describe('translateWithLocalDictionary（同步）', () => {
  it('数据未加载时单字查询返回“暂未收录”', () => {
    const result = mod.translateWithLocalDictionary('apple')
    expect(result.success).toBe(false)
    expect(result.errorMsg).toContain('词库暂未收录')
  })

  it('空文本直接返回参数错误', () => {
    expect(mod.translateWithLocalDictionary('   ')).toEqual({
      success: false,
      errorMsg: '请输入要翻译的文本',
      isLocal: true,
    })
  })

  it('异步加载完成后同步翻译可用（单词/短语/句子）', async () => {
    await Promise.all([mod.default.loadDictionaryLazy(), mod.default.loadPhrasesLazy()])

    const word = mod.translateWithLocalDictionary('apple')
    expect(word.success).toBe(true)
    expect(word.explains).toBe('n. 苹果')
    expect(word.pronunciation).toBe('mock-tts://apple')

    expect(mod.translateWithLocalDictionary('good morning').explains).toBe('早上好')
    expect(mod.translateWithLocalDictionary('i want to go').explains).toBe('我想要去')
  })
})
