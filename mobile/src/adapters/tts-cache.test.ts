/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import {
  hashAudioCacheKey,
  pickLruEvictions,
  pickLruEvictionsForBytes,
  parseAudioCacheWord,
  storageQuotaWarning,
  getTtsAdapter,
  setTtsAdapter,
  type AudioCacheEntry,
} from '@/adapters/index'

describe('音频缓存纯函数', () => {
  describe('hashAudioCacheKey', () => {
    it('同一文本哈希结果稳定', () => {
      expect(hashAudioCacheKey('hello')).toBe(hashAudioCacheKey('hello'))
    })

    it('不同文本哈希不同', () => {
      expect(hashAudioCacheKey('hello')).not.toBe(hashAudioCacheKey('world'))
    })

    it('对大小写与特殊字符敏感且输出为短字符串', () => {
      const key = hashAudioCacheKey("don't")
      expect(typeof key).toBe('string')
      expect(key.length).toBeLessThan(16)
      expect(key).not.toBe(hashAudioCacheKey("DON'T"))
    })

    it('空字符串也能得到合法 key', () => {
      expect(hashAudioCacheKey('')).toMatch(/^[0-9a-z]+$/)
    })
  })

  describe('pickLruEvictions', () => {
    const entry = (key: string, lastUsed: number): AudioCacheEntry => ({ key, filePath: `/cache/${key}`, lastUsed })

    it('未超过上限时不淘汰', () => {
      const entries = [entry('a', 1), entry('b', 2), entry('c', 3)]
      expect(pickLruEvictions(entries, 3)).toEqual([])
      expect(pickLruEvictions(entries, 5)).toEqual([])
    })

    it('超过上限时按最久未用淘汰多余条目', () => {
      const entries = [entry('a', 100), entry('b', 300), entry('c', 200), entry('d', 400)]
      const evicted = pickLruEvictions(entries, 2)
      expect(evicted.map(e => e.key)).toEqual(['a', 'c'])
    })

    it('淘汰数量等于超出部分', () => {
      const entries = Array.from({ length: 10 }, (_, i) => entry(`k${i}`, i))
      expect(pickLruEvictions(entries, 8)).toHaveLength(2)
    })

    it('不修改原数组', () => {
      const entries = [entry('a', 2), entry('b', 1)]
      pickLruEvictions(entries, 1)
      expect(entries.map(e => e.key)).toEqual(['a', 'b'])
    })
  })

  describe('pickLruEvictionsForBytes', () => {
    const entry = (key: string, lastUsed: number, size: number): AudioCacheEntry =>
      ({ key, filePath: `/cache/${key}`, lastUsed, size })

    it('未超字节上限时不淘汰', () => {
      const entries = [entry('a', 1, 1000), entry('b', 2, 2000)]
      expect(pickLruEvictionsForBytes(entries, 10000)).toEqual([])
      expect(pickLruEvictionsForBytes(entries, 3000)).toEqual([])
    })

    it('超限时按最久未用淘汰直到不超上限', () => {
      // 按旧到新排序：a(1000) c(2000) b(3000) d(4000)，总 10000，上限 6000
      // 淘汰 a→9000, c→7000, b→4000（停）；留下 d(4000)
      const entries = [entry('a', 100, 1000), entry('b', 300, 3000), entry('c', 200, 2000), entry('d', 400, 4000)]
      const evicted = pickLruEvictionsForBytes(entries, 6000)
      expect(evicted.map(e => e.key)).toEqual(['a', 'c', 'b'])
    })

    it('size 缺失的条目按 0 计，不影响其余淘汰', () => {
      // a 无 size(0)、b=8000，总 8000，上限 4000 → 淘汰 a(0) 后仍 8000，再淘汰 b
      const entries = [
        { key: 'a', filePath: '/a', lastUsed: 1 },
        { key: 'b', filePath: '/b', lastUsed: 2, size: 8000 },
      ]
      const evicted = pickLruEvictionsForBytes(entries as AudioCacheEntry[], 4000)
      expect(evicted.map(e => e.key)).toEqual(['a', 'b'])
    })

    it('不修改原数组', () => {
      const entries = [entry('a', 1, 3000), entry('b', 2, 3000)]
      pickLruEvictionsForBytes(entries, 1000)
      expect(entries.map(e => e.key)).toEqual(['a', 'b'])
    })
  })

  describe('storageQuotaWarning', () => {
    it('低于阈值返回空串（不提示）', () => {
      expect(storageQuotaWarning(400, 1024)).toBe('')
    })

    it('超过 80% 返回清理提示', () => {
      expect(storageQuotaWarning(900, 1024)).toContain('清理')
      expect(storageQuotaWarning(1024, 1024)).toContain('清理')
    })

    it('参数非法返回空串', () => {
      expect(storageQuotaWarning(-1, 1024)).toBe('')
      expect(storageQuotaWarning(100, 0)).toBe('')
      expect(storageQuotaWarning(NaN, NaN)).toBe('')
    })
  })

  describe('parseAudioCacheWord', () => {
    it('解析有道 dictvoice 的 audio 参数', () => {
      expect(parseAudioCacheWord('https://dict.youdao.com/dictvoice?audio=hello&type=2')).toBe('hello')
    })

    it('解析 google tts 的 q 参数', () => {
      expect(
        parseAudioCacheWord('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=hello')
      ).toBe('hello')
    })

    it('解析百度 gettts 的 text 参数', () => {
      expect(parseAudioCacheWord('https://fanyi.baidu.com/gettts?lan=zh&text=%E4%BD%A0%E5%A5%BD&spd=5&source=web')).toBe('你好')
    })

    it('对编码后的参数解码并统一小写、去除首尾空白', () => {
      expect(parseAudioCacheWord('https://dict.youdao.com/dictvoice?audio=%20Hello%20')).toBe('hello')
      expect(parseAudioCacheWord(`https://dict.youdao.com/dictvoice?audio=${encodeURIComponent("don't")}`)).toBe("don't")
    })

    it('无 audio/q/text 参数的 http(s) 直链（jsDelivr 预合成音频等）用完整 URL 派生稳定 key', () => {
      const url = 'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/speech-audio/spoken-reductions-1/fccc2c23599dd82f462335ff36e36e37.mp3'
      const key = parseAudioCacheWord(url)
      expect(key).toBe(`url:${url}`)
      // 同一 URL 稳定、不同路径不同 key、hash/查询参数变化也反映到 key
      expect(parseAudioCacheWord(url)).toBe(key)
      expect(parseAudioCacheWord(url.replace('fccc', 'aaaa'))).not.toBe(key)
      expect(parseAudioCacheWord(`${url}#t=1`)).toBe(key)
    })

    it('非 http(s) 地址（本地路径等）无法派生 key，返回 null', () => {
      expect(parseAudioCacheWord('not-a-url')).toBeNull()
      expect(parseAudioCacheWord('wxfile://tmp/audio.mp3')).toBeNull()
    })

    it('非英语/中文的 lan、tl 语种参数纳入 key，防止同文本跨语种串音（D17/14.3）', () => {
      expect(parseAudioCacheWord('https://fanyi.baidu.com/gettts?lan=jp&text=%E5%AD%A6%E7%94%9F&spd=5&source=web')).toBe('jp:学生')
      expect(parseAudioCacheWord('https://fanyi.baidu.com/gettts?lan=uk&text=hello&spd=5&source=web')).toBe('hello')
      expect(parseAudioCacheWord('https://fanyi.baidu.com/gettts?lan=zh&text=%E4%BD%A0%E5%A5%BD&spd=5&source=web')).toBe('你好')
      expect(
        parseAudioCacheWord('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=ja&q=%E5%AD%A6%E7%94%9F')
      ).toBe('ja:学生')
      expect(
        parseAudioCacheWord('https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=hello')
      ).toBe('hello')
    })
  })
})

describe('MiniProgramTtsAdapter 重试与缓存', () => {
  let storage: Map<string, any>
  let audioInstances: any[]
  let uniMock: any
  let savedFiles: string[]

  /** 创建可控的 InnerAudioContext mock：外部可通过 trigger 触发回调 */
  function createAudioMock() {
    const handlers: Record<string, Function[]> = {}
    const audio: any = {
      src: '',
      play: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onEnded: (fn: Function) => { (handlers['ended'] ||= []).push(fn) },
      onError: (fn: Function) => { (handlers['error'] ||= []).push(fn) },
      onTimeUpdate: (fn: Function) => { (handlers['timeupdate'] ||= []).push(fn) },
      onCanplay: (fn: Function) => { (handlers['canplay'] ||= []).push(fn) },
      trigger: (event: string, arg?: any) => { (handlers[event] || []).forEach(fn => fn(arg)) },
    }
    return audio
  }

  beforeEach(() => {
    vi.useFakeTimers()
    storage = new Map()
    audioInstances = []
    savedFiles = []
    uniMock = {
      getStorageSync: vi.fn((key: string) => storage.get(key) ?? null),
      setStorageSync: vi.fn((key: string, data: any) => { storage.set(key, data) }),
      removeStorageSync: vi.fn((key: string) => { storage.delete(key) }),
      createInnerAudioContext: vi.fn(() => {
        const audio = createAudioMock()
        audioInstances.push(audio)
        return audio
      }),
      downloadFile: vi.fn(({ success }: any) => {
        success({ statusCode: 200, tempFilePath: 'tmp://audio.mp3' })
      }),
      saveFile: vi.fn(({ tempFilePath, success }: any) => {
        const savedFilePath = `saved://${tempFilePath}`
        savedFiles.push(savedFilePath)
        success({ savedFilePath })
      }),
      removeSavedFile: vi.fn(),
      showToast: vi.fn(),
    }
    ;(global as any).uni = uniMock
    setTtsAdapter(null as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    setTtsAdapter(null as any)
  })

  it('播放成功时直接 resolve 且不走下载', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    // 等 playOnce 内部创建实例并 play
    await vi.advanceTimersByTimeAsync(0)
    expect(audioInstances).toHaveLength(1)
    expect(uniMock.downloadFile).not.toHaveBeenCalled() // 播放完成前不触发后台缓存
    audioInstances[0].trigger('ended')
    await expect(promise).resolves.toBeUndefined()
    expect(audioInstances[0].destroy).toHaveBeenCalledTimes(1)
  })

  it('onError 后自动重试，最终成功则 resolve', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('error', { errMsg: 'net error' })
    expect(audioInstances[0].destroy).toHaveBeenCalledTimes(1)
    await vi.advanceTimersByTimeAsync(500) // 第 1 次重试间隔 400ms
    expect(audioInstances).toHaveLength(2)
    audioInstances[1].trigger('ended')
    await expect(promise).resolves.toBeUndefined()
    expect(audioInstances[1].destroy).toHaveBeenCalledTimes(1)
  })

  it('重试 2 次仍失败则 reject，且提示 toast', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    // 先挂接 rejection 断言，避免 promise 先拒绝产生 unhandled rejection
    const assertion = expect(promise).rejects.toBeTruthy()
    for (let i = 0; i <= 2; i++) {
      await vi.advanceTimersByTimeAsync(0)
      audioInstances[i].trigger('error', { errMsg: 'net error' })
      await vi.advanceTimersByTimeAsync(1200)
    }
    await assertion
    expect(audioInstances).toHaveLength(3)
    expect(uniMock.showToast).toHaveBeenCalledTimes(1)
  })

  it('超时无回调视为失败并进入重试', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(15000) // 触发超时
    await vi.advanceTimersByTimeAsync(500) // 第 1 次重试等待间隔
    expect(audioInstances).toHaveLength(2)
    audioInstances[1].trigger('ended')
    await expect(promise).resolves.toBeUndefined()
  })

  it('播放成功后后台下载并写入缓存清单', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0) // 让后台 downloadAndCache 完成
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    expect(uniMock.saveFile).toHaveBeenCalledTimes(1)
    const manifest = storage.get('slowlyrecord_audio_cache_manifest')
    const wordKey = hashAudioCacheKey('hello')
    expect(manifest[wordKey]?.filePath).toBe('saved://tmp://audio.mp3')
  })

  it('jsDelivr 直链播放成功后同样落缓存（URL 派生稳定 key，D17 回归）', async () => {
    const url = 'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/speech-audio/spoken-reductions-1/fccc2c23599dd82f462335ff36e37.mp3'
    const promise = getTtsAdapter().playAudio(url)
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0) // 让后台 downloadAndCache 完成
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    const manifest = storage.get('slowlyrecord_audio_cache_manifest')
    const urlKey = hashAudioCacheKey(`url:${url}`)
    expect(manifest[urlKey]?.filePath).toBe('saved://tmp://audio.mp3')
  })

  it('jsDelivr 直链可预取缓存，且与播放共用同一 key（D17 回归）', async () => {
    const url = 'https://cdn.jsdelivr.net/gh/chuxiangshi2026/slowlyRecord@master/public/speech-audio/spoken-reductions-1/fccc2c23599dd82f462335ff36e37.mp3'
    getTtsAdapter().prefetchAudio?.(url)
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    const manifest = storage.get('slowlyrecord_audio_cache_manifest')
    const urlKey = hashAudioCacheKey(`url:${url}`)
    expect(manifest[urlKey]?.filePath).toBe('saved://tmp://audio.mp3')
    // 播放同一 URL 命中预取缓存，不再下载
    const promise = getTtsAdapter().playAudio(url)
    await vi.advanceTimersByTimeAsync(0)
    expect(audioInstances[0].src).toBe('saved://tmp://audio.mp3')
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
  })

  it('命中缓存时直接播本地路径，不再下载', async () => {
    const wordKey = hashAudioCacheKey('hello')
    storage.set('slowlyrecord_audio_cache_manifest', {
      [wordKey]: { key: wordKey, filePath: 'saved://cached.mp3', lastUsed: 1 },
    })
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    expect(audioInstances[0].src).toBe('saved://cached.mp3')
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).not.toHaveBeenCalled()
    // lastUsed 被刷新
    expect(storage.get('slowlyrecord_audio_cache_manifest')[wordKey].lastUsed).toBeGreaterThan(1)
  })

  it('缓存清单超过上限时按 LRU 淘汰并删除本地文件', async () => {
    // 预置 400 个旧条目 + 本次将写入的新条目，上限 400 → 淘汰最旧的一个
    const manifest: Record<string, any> = {}
    for (let i = 0; i < 400; i++) {
      manifest[`old${i}`] = { key: `old${i}`, filePath: `saved://old${i}`, lastUsed: i + 1 }
    }
    storage.set('slowlyrecord_audio_cache_manifest', manifest)

    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=newword&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0)

    const next = storage.get('slowlyrecord_audio_cache_manifest')
    expect(Object.keys(next)).toHaveLength(400)
    expect(next['old0']).toBeUndefined()
    expect(uniMock.removeSavedFile).toHaveBeenCalledWith(
      expect.objectContaining({ filePath: 'saved://old0' })
    )
  })

  it('saveFile 能力缺失时降级为纯在线播放，不影响发音', async () => {
    delete uniMock.saveFile
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    // 未写入任何缓存清单
    expect(storage.get('slowlyrecord_audio_cache_manifest') ?? {}).toEqual({})
  })

  it('downloadFile 失败时静默，不 reject 发音流程', async () => {
    uniMock.downloadFile = vi.fn(({ fail }: any) => { fail(new Error('network down')) })
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await expect(promise).resolves.toBeUndefined()
    await vi.advanceTimersByTimeAsync(0)
    expect(storage.get('slowlyrecord_audio_cache_manifest') ?? {}).toEqual({})
  })

  it('播放成功补缓存与预取撞车时只下载一次（并发去重）', async () => {
    // 让 downloadFile 挂起：success 不立即回调，模拟慢网络下下载进行中
    let pendingSuccess: ((res: any) => void) | null = null
    uniMock.downloadFile = vi.fn(({ success }: any) => { pendingSuccess = success })
    const url = 'https://dict.youdao.com/dictvoice?audio=hello&type=2'
    const promise = getTtsAdapter().playAudio(url)
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await promise
    await vi.advanceTimersByTimeAsync(0) // 后台补缓存发起下载（挂起中）
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    // 下载未完成的同一词再预取：与进行中的补缓存撞车，应被去重
    getTtsAdapter().prefetchAudio?.(url)
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    // 放行下载完成，缓存最终只写入一份
    pendingSuccess!({ statusCode: 200, tempFilePath: 'tmp://audio.mp3' })
    await vi.advanceTimersByTimeAsync(0)
    const manifest = storage.get('slowlyrecord_audio_cache_manifest')
    expect(manifest[hashAudioCacheKey('hello')]?.filePath).toBe('saved://tmp://audio.mp3')
  })

  it('缓存命中刷新 lastUsed 的落盘做 5 秒节流', async () => {
    // 模拟真机存储的反序列化语义：get/set 都是深拷贝，内存对象与存储互不影响
    uniMock.getStorageSync = vi.fn((key: string) => {
      const v = storage.get(key)
      return v == null ? null : JSON.parse(JSON.stringify(v))
    })
    uniMock.setStorageSync = vi.fn((key: string, data: any) => { storage.set(key, JSON.parse(JSON.stringify(data))) })
    const manifestKey = 'slowlyrecord_audio_cache_manifest'
    const wordKey = hashAudioCacheKey('hello')
    storage.set(manifestKey, {
      [wordKey]: { key: wordKey, filePath: 'saved://cached.mp3', lastUsed: 1 },
    })
    const url = 'https://dict.youdao.com/dictvoice?audio=hello&type=2'
    const manifestWrites = () =>
      uniMock.setStorageSync.mock.calls.filter(([k]: any[]) => k === manifestKey).length

    // 第一次命中：初始上次持久化时间为 0，必落盘一次
    let p = getTtsAdapter().playAudio(url)
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('ended')
    await p
    await vi.advanceTimersByTimeAsync(0)
    expect(manifestWrites()).toBe(1)
    const persistedAt = storage.get(manifestKey)[wordKey].lastUsed
    expect(persistedAt).toBeGreaterThan(1)

    // 5 秒内第二次命中：内存里 lastUsed 继续刷新，但不再同步落盘（落盘滞后）
    vi.advanceTimersByTime(1000)
    p = getTtsAdapter().playAudio(url)
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[1].trigger('ended')
    await p
    await vi.advanceTimersByTimeAsync(0)
    expect(manifestWrites()).toBe(1)
    expect(storage.get(manifestKey)[wordKey].lastUsed).toBe(persistedAt)

    // 距上次落盘超过 5 秒后再命中：恢复落盘
    vi.advanceTimersByTime(6000)
    p = getTtsAdapter().playAudio(url)
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[2].trigger('ended')
    await p
    await vi.advanceTimersByTimeAsync(0)
    expect(manifestWrites()).toBe(2)
    expect(storage.get(manifestKey)[wordKey].lastUsed).toBeGreaterThan(persistedAt)
  })
})

describe('MiniProgramTtsAdapter 代际作废与提示降噪', () => {
  let storage: Map<string, any>
  let audioInstances: any[]
  let uniMock: any

  function createAudioMock() {
    const handlers: Record<string, Function[]> = {}
    const audio: any = {
      src: '',
      play: vi.fn(),
      stop: vi.fn(),
      destroy: vi.fn(),
      onEnded: (fn: Function) => { (handlers['ended'] ||= []).push(fn) },
      onError: (fn: Function) => { (handlers['error'] ||= []).push(fn) },
      onTimeUpdate: (fn: Function) => { (handlers['timeupdate'] ||= []).push(fn) },
      onCanplay: (fn: Function) => { (handlers['canplay'] ||= []).push(fn) },
      trigger: (event: string, arg?: any) => { (handlers[event] || []).forEach(fn => fn(arg)) },
    }
    return audio
  }

  beforeEach(() => {
    vi.useFakeTimers()
    storage = new Map()
    audioInstances = []
    uniMock = {
      getStorageSync: vi.fn((key: string) => storage.get(key) ?? null),
      setStorageSync: vi.fn((key: string, data: any) => { storage.set(key, data) }),
      removeStorageSync: vi.fn((key: string) => { storage.delete(key) }),
      createInnerAudioContext: vi.fn(() => {
        const audio = createAudioMock()
        audioInstances.push(audio)
        return audio
      }),
      downloadFile: vi.fn(({ success }: any) => {
        success({ statusCode: 200, tempFilePath: 'tmp://audio.mp3' })
      }),
      saveFile: vi.fn(({ tempFilePath, success }: any) => {
        success({ savedFilePath: `saved://${tempFilePath}` })
      }),
      removeSavedFile: vi.fn(),
      showToast: vi.fn(),
    }
    ;(global as any).uni = uniMock
    setTtsAdapter(null as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    setTtsAdapter(null as any)
  })

  it('静默模式重试耗尽仍 reject，但不弹 toast', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2', { silent: true })
    // 先挂接 rejection 断言，避免 promise 先拒绝产生 unhandled rejection
    const assertion = expect(promise).rejects.toBeTruthy()
    for (let i = 0; i <= 2; i++) {
      await vi.advanceTimersByTimeAsync(0)
      audioInstances[i].trigger('error', { errMsg: 'net error' })
      await vi.advanceTimersByTimeAsync(1200)
    }
    await assertion
    expect(uniMock.showToast).not.toHaveBeenCalled()
  })

  it('新播放开始后，旧播放的待重试被代际作废且静默失败', async () => {
    const stale = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=oldword&type=2')
    // 先挂接 rejection 断言，避免 promise 先拒绝产生 unhandled rejection
    const staleAssertion = expect(stale).rejects.toBeTruthy()
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[0].trigger('error', { errMsg: 'net error' })
    // 重试间隔内用户切词发起新播放：旧请求代次作废
    const fresh = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=newword&type=2')
    await vi.advanceTimersByTimeAsync(0)
    expect(audioInstances).toHaveLength(2)
    audioInstances[1].trigger('ended')
    await expect(fresh).resolves.toBeUndefined()
    // 旧请求重试间隔到期：直接作废，不再创建新实例、不弹 toast
    await vi.advanceTimersByTimeAsync(1200)
    await staleAssertion
    expect(audioInstances).toHaveLength(2)
    expect(uniMock.showToast).not.toHaveBeenCalled()
  })

  it('stop() 使进行中的非静默播放作废且不弹 toast', async () => {
    const promise = getTtsAdapter().playAudio('https://dict.youdao.com/dictvoice?audio=hello&type=2')
    // 先挂接 rejection 断言，避免 promise 先拒绝产生 unhandled rejection
    const assertion = expect(promise).rejects.toBeTruthy()
    await vi.advanceTimersByTimeAsync(0)
    getTtsAdapter().stop()
    // playOnce 挂起直至 15s 超时兜底 → 重试前代际校验作废
    await vi.advanceTimersByTimeAsync(15500)
    await assertion
    expect(uniMock.showToast).not.toHaveBeenCalled()
  })

  it('prefetchAudio 后台下载缓存，已缓存时不重复下载', async () => {
    const url = 'https://dict.youdao.com/dictvoice?audio=hello&type=2'
    getTtsAdapter().prefetchAudio?.(url)
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    // 再次预取同一词：命中缓存，不再下载
    getTtsAdapter().prefetchAudio?.(url)
    await vi.advanceTimersByTimeAsync(0)
    expect(uniMock.downloadFile).toHaveBeenCalledTimes(1)
    const manifest = storage.get('slowlyrecord_audio_cache_manifest')
    expect(manifest[hashAudioCacheKey('hello')]?.filePath).toBe('saved://tmp://audio.mp3')
  })

  it('语速在播放开始（canplay）后才设置，且钳制在 0.5–2.0', async () => {
    const url = 'https://dict.youdao.com/dictvoice?audio=hello&type=2'
    // rate=1.5：play 前不得设置（部分机型 play 前赋值会无声），canplay 后生效
    const p1 = getTtsAdapter().playAudio(url, { rate: 1.5 })
    await vi.advanceTimersByTimeAsync(0)
    expect(audioInstances[0].playbackRate).toBeUndefined()
    audioInstances[0].trigger('canplay')
    expect(audioInstances[0].playbackRate).toBe(1.5)
    audioInstances[0].trigger('ended')
    await expect(p1).resolves.toBeUndefined()
    // 超出上限钳制到 2
    const p2 = getTtsAdapter().playAudio(url, { rate: 3 })
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[1].trigger('canplay')
    expect(audioInstances[1].playbackRate).toBe(2)
    audioInstances[1].trigger('ended')
    await expect(p2).resolves.toBeUndefined()
    // rate=1（原速）始终不写 playbackRate，兼容无此能力的低版本基础库
    const p3 = getTtsAdapter().playAudio(url, { rate: 1 })
    await vi.advanceTimersByTimeAsync(0)
    audioInstances[2].trigger('canplay')
    expect(audioInstances[2].playbackRate).toBeUndefined()
    audioInstances[2].trigger('ended')
    await expect(p3).resolves.toBeUndefined()
  })
})
