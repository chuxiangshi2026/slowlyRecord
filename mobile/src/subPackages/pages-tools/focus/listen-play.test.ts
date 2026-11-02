import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildWordAudioUrls, ListenPlayer, type WordAudioPlayer } from './listen-play'

describe('buildWordAudioUrls', () => {
  it('应以有道音源为首选并附带谷歌兜底音源', () => {
    const urls = buildWordAudioUrls('take care')
    expect(urls).toHaveLength(2)
    expect(urls[0]).toContain('dict.youdao.com')
    expect(urls[0]).toContain(encodeURIComponent('take care'))
    expect(urls[1]).toContain('translate.google.com')
  })

  it('中文词应走有道智云 TTS 与谷歌 zh-CN 兜底', () => {
    const urls = buildWordAudioUrls('你好')
    expect(urls[0]).toContain('openapi.youdao.com/ttsapi')
    expect(urls[0]).toContain(encodeURIComponent('你好'))
    expect(urls[urls.length - 1]).toContain('tl=zh-CN')
  })
})

describe('ListenPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('播放成功后按停顿时长自动推进直至结束', async () => {
    const played: string[] = []
    const player: WordAudioPlayer = {
      playAudio: (url) => { played.push(url); return Promise.resolve() }
    }
    const onFinished = vi.fn()
    const p = new ListenPlayer(['apple', 'banana'], player, () => 1000, { onFinished })

    p.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(played).toHaveLength(1)
    expect(played[0]).toContain('apple')

    await vi.advanceTimersByTimeAsync(1000)
    expect(played).toHaveLength(2)
    expect(played[1]).toContain('banana')

    await vi.advanceTimersByTimeAsync(1000)
    expect(onFinished).toHaveBeenCalledTimes(1)
    expect(p.isPlaying).toBe(false)
  })

  it('首选音源失败时应回退到兜底音源', async () => {
    const played: string[] = []
    const player: WordAudioPlayer = {
      playAudio: (url) => {
        played.push(url)
        return url.includes('youdao') ? Promise.reject(new Error('network')) : Promise.resolve()
      }
    }
    const onError = vi.fn()
    const p = new ListenPlayer(['apple'], player, () => 1000, { onError })

    p.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(played).toHaveLength(2)
    expect(played[1]).toContain('translate.google.com')
    expect(onError).not.toHaveBeenCalled()
  })

  it('某词所有音源均失败时应跳过该词继续播放', async () => {
    const played: string[] = []
    const player: WordAudioPlayer = {
      playAudio: (url) => {
        played.push(url)
        return url.includes('apple') ? Promise.reject(new Error('network')) : Promise.resolve()
      }
    }
    const onError = vi.fn()
    const onIndexChange = vi.fn()
    const onFinished = vi.fn()
    const p = new ListenPlayer(['apple', 'banana'], player, () => 1000, { onError, onIndexChange, onFinished })

    p.start()
    await vi.advanceTimersByTimeAsync(0)
    // apple 两个音源都失败：触发 onError 并跳到 banana，不进入停顿时长
    expect(onError).toHaveBeenCalledTimes(1)
    expect(onError).toHaveBeenCalledWith(0)
    expect(onIndexChange).toHaveBeenCalledWith(1)
    expect(played.filter(u => u.includes('banana'))).toHaveLength(1)

    await vi.advanceTimersByTimeAsync(1000)
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it('暂停后不再推进，恢复时从当前词重播', async () => {
    const played: string[] = []
    const player: WordAudioPlayer = {
      playAudio: (url) => { played.push(url); return Promise.resolve() }
    }
    const p = new ListenPlayer(['apple', 'banana'], player, () => 1000, {})

    p.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(played).toHaveLength(1)

    p.pause()
    expect(p.isPlaying).toBe(false)
    await vi.advanceTimersByTimeAsync(5000)
    expect(played).toHaveLength(1)

    p.resume()
    await vi.advanceTimersByTimeAsync(0)
    // 恢复重播当前词 apple
    expect(played).toHaveLength(2)
    expect(played[1]).toContain('apple')
  })

  it('暂停期间旧播放回调 resolve 不应引发推进', async () => {
    let resolvePlay: (() => void) | null = null
    const player: WordAudioPlayer = {
      playAudio: () => new Promise<void>((resolve) => { resolvePlay = resolve })
    }
    const p = new ListenPlayer(['apple', 'banana'], player, () => 1000, {})

    p.start()
    p.pause()
    resolvePlay!()
    await vi.advanceTimersByTimeAsync(5000)
    expect(p.currentIndex).toBe(0)
  })

  it('next/prev 切换下标并从对应词重播，末尾 next 触发结束', async () => {
    const played: string[] = []
    const player: WordAudioPlayer = {
      playAudio: (url) => { played.push(url); return Promise.resolve() }
    }
    const onFinished = vi.fn()
    const p = new ListenPlayer(['apple', 'banana'], player, () => 1000, { onFinished })

    p.start()
    await vi.advanceTimersByTimeAsync(0)
    expect(p.currentIndex).toBe(0)

    p.next()
    await vi.advanceTimersByTimeAsync(0)
    expect(p.currentIndex).toBe(1)
    expect(played[played.length - 1]).toContain('banana')

    p.prev()
    await vi.advanceTimersByTimeAsync(0)
    expect(p.currentIndex).toBe(0)
    expect(played[played.length - 1]).toContain('apple')

    p.next()
    p.next()
    expect(onFinished).toHaveBeenCalledTimes(1)
  })

  it('播放当前词时预取下一词的首选音源', () => {
    const prefetched: string[] = []
    const player: WordAudioPlayer = {
      playAudio: () => new Promise<void>(() => {}),
      prefetchAudio: (url) => { prefetched.push(url) }
    }
    const p = new ListenPlayer(['apple', 'banana'], player, () => 1000)

    p.start()
    expect(prefetched).toHaveLength(1)
    expect(prefetched[0]).toContain('dict.youdao.com')
    expect(prefetched[0]).toContain('banana')
    p.destroy()
  })

  it('切词后旧播放延迟失败不得回退抢播', async () => {
    const pending: { url: string; reject: () => void }[] = []
    const player: WordAudioPlayer = {
      playAudio: (url) => new Promise<void>((_resolve, reject) => {
        pending.push({ url, reject })
      })
    }
    const p = new ListenPlayer(['apple', 'banana'], player, () => 1000)

    p.start()
    p.next()
    pending[0].reject()
    await vi.advanceTimersByTimeAsync(0)
    expect(pending).toHaveLength(2)
    expect(pending[1].url).toContain('banana')
    p.destroy()
  })

  it('快速暂停恢复后旧播放延迟失败不得回退抢播', async () => {
    const pending: { url: string; reject: () => void }[] = []
    const player: WordAudioPlayer = {
      playAudio: (url) => new Promise<void>((_resolve, reject) => {
        pending.push({ url, reject })
      })
    }
    const p = new ListenPlayer(['apple', 'banana'], player, () => 1000)

    p.start()
    p.pause()
    p.resume()
    pending[0].reject()
    await vi.advanceTimersByTimeAsync(0)
    expect(pending).toHaveLength(2)
    expect(pending[1].url).toContain('apple')
    p.destroy()
  })

  it('destroy 后不再有任何回调', async () => {
    const player: WordAudioPlayer = { playAudio: () => Promise.resolve() }
    const onFinished = vi.fn()
    const onIndexChange = vi.fn()
    const p = new ListenPlayer(['apple'], player, () => 1000, { onFinished, onIndexChange })

    p.start()
    p.destroy()
    await vi.advanceTimersByTimeAsync(5000)
    expect(onFinished).not.toHaveBeenCalled()
    expect(onIndexChange).not.toHaveBeenCalled()
  })

  it('播放和预取都使用会话语言', () => {
    const played: string[] = []
    const prefetched: string[] = []
    const player: WordAudioPlayer = {
      playAudio: (url) => { played.push(url); return Promise.resolve() },
      prefetchAudio: (url) => { prefetched.push(url) },
    }
    const p = new ListenPlayer(['こんにちは', '学生'], player, () => 1000, {}, 'ja')

    p.start()
    expect(played[0]).toContain('tl=ja')
    expect(prefetched[0]).toContain('tl=ja')
    p.destroy()
  })
})
