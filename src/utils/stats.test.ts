/**
 * stats（umami）单元测试
 * window/fetch/localStorage 全部 mock，验证启用判定与上报报文结构
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const config = vi.hoisted(() => ({
  UMAMI_STATS_CONFIG: { websiteId: 'test-website-id', host: 'https://stats.example.com' },
  APP_VERSION: '9.9.9',
}))
vi.mock('@/config', () => config)

import {
  initStats,
  trackEvent,
  trackPageView,
  isStatsExcluded,
  setStatsExcluded,
  trackError,
  submitFeedback,
  getStatsStatus,
  initAttribution,
  getAttribution,
} from '@/utils/stats'

/** 取出 fetch 收到的全部 umami 报文（过滤 getPluginVersion 等无 body 的调用） */
function sentPayloads(): any[] {
  return (globalThis.fetch as any).mock.calls
    .filter((c: any[]) => c[1]?.body)
    .map((c: any[]) => JSON.parse(c[1].body))
}

describe('stats（umami）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const store: Record<string, string> = {}
    ;(globalThis as any).window = {
      location: { hostname: '', pathname: '/', hash: '#/Word' },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
      },
      utools: { isDev: () => false, getNativeId: () => 'native-device-id-for-test' },
    }
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('{"cache":"ok"}'), json: () => Promise.resolve({}) })
  })

  afterEach(() => {
    delete (globalThis as any).window
    delete (globalThis as any).fetch
  })

  describe('启用判定', () => {
    it('uTools 生产环境（hostname 为空、isDev=false）启用', async () => {
      await initStats()
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    it('未配置 websiteId 时不上报', async () => {
      config.UMAMI_STATS_CONFIG.websiteId = ''
      await initStats()
      expect(globalThis.fetch).not.toHaveBeenCalled()
      config.UMAMI_STATS_CONFIG.websiteId = 'test-website-id'
    })

    it('uTools 开发环境（isDev=true）排除', async () => {
      ;(globalThis as any).window.utools.isDev = () => true
      await initStats()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('非 uTools 的 localhost 排除', async () => {
      delete (globalThis as any).window.utools
      ;(globalThis as any).window.location.hostname = 'localhost'
      await initStats()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('file:// 生产页（hostname 空、无 utools/electronAPI）按 web 平台启用', async () => {
      delete (globalThis as any).window.utools
      await initStats()
      expect(globalThis.fetch).toHaveBeenCalled()
      const payloads = sentPayloads()
      expect(payloads[0].payload.hostname).toBe('slowlyrecord.web')
    })

    it('自我排除标记跳过上报；setStatsExcluded 双向切换', () => {
      expect(isStatsExcluded()).toBe(false)
      setStatsExcluded(true)
      expect(isStatsExcluded()).toBe(true)
      trackPageView('/Word')
      expect(globalThis.fetch).not.toHaveBeenCalled()
      setStatsExcluded(false)
      expect(isStatsExcluded()).toBe(false)
      trackPageView('/Word')
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    it('强制启用标记优先于一切排除规则', async () => {
      ;(globalThis as any).window.utools.isDev = () => true
      setStatsExcluded(true)
      window.localStorage.setItem('sr_stats_force', '1')
      await initStats()
      expect(globalThis.fetch).toHaveBeenCalled()
    })
  })

  describe('getStatsStatus', () => {
    it('生产环境返回 enabled', () => {
      expect(getStatsStatus()).toBe('enabled')
    })

    it('手动关闭返回 excluded，dev 环境返回 dev，localhost 返回 localhost', () => {
      setStatsExcluded(true)
      expect(getStatsStatus()).toBe('excluded')
      setStatsExcluded(false)

      ;(globalThis as any).window.utools.isDev = () => true
      expect(getStatsStatus()).toBe('dev')

      ;(globalThis as any).window.utools.isDev = () => false
      delete (globalThis as any).window.utools
      ;(globalThis as any).window.location.hostname = 'localhost'
      expect(getStatsStatus()).toBe('localhost')
    })

    it('force 标记优先于排除规则返回 enabled；未配置 websiteId 返回 no-config', () => {
      setStatsExcluded(true)
      window.localStorage.setItem('sr_stats_force', '1')
      expect(getStatsStatus()).toBe('enabled')
      window.localStorage.removeItem('sr_stats_force')

      config.UMAMI_STATS_CONFIG.websiteId = ''
      expect(getStatsStatus()).toBe('no-config')
      config.UMAMI_STATS_CONFIG.websiteId = 'test-website-id'
    })
  })

  describe('首次来源归因', () => {
    it('从 hash 前的查询参数记录第一次来源，后续不覆盖', () => {
      ;(globalThis as any).window.location.search = '?from=seo&page=cet4'
      expect(initAttribution()).toMatchObject({ source: 'seo', page: 'cet4' })

      ;(globalThis as any).window.location.search = '?from=wechat&page=cet6'
      expect(initAttribution()).toMatchObject({ source: 'seo', page: 'cet4' })
      expect(getAttribution()?.source).toBe('seo')
    })

    it('非法来源不落库；launch 与 source.landing 携带归因', async () => {
      ;(globalThis as any).window.location.search = '?from=<script>'
      expect(initAttribution()).toBeNull()

      ;(globalThis as any).window.location.search = '?utm_source=github&page=poem-tang_001'
      await initStats()
      const payloads = sentPayloads()
      const launch = payloads.find(p => p.payload.name === 'app.launch')
      expect(launch.payload.data.source).toBe('github')
      expect(launch.payload.data.landingPage).toBe('poem-tang_001')
      const landing = payloads.find(p => p.payload.name === 'source.landing')
      expect(landing.payload.data).toEqual({ source: 'github', page: 'poem-tang_001' })
    })
  })

  describe('报文结构', () => {
    it('启动事件带平台/版本/匿名安装 ID', async () => {
      await initStats()
      const launch = sentPayloads().find(p => p.payload.name === 'app.launch')
      expect(launch).toBeDefined()
      expect(launch.type).toBe('event')
      expect(launch.payload.website).toBe('test-website-id')
      expect(launch.payload.hostname).toBe('slowlyrecord.utools')
      expect(launch.payload.data.platform).toBe('utools')
      expect(launch.payload.data.appVersion).toBe('9.9.9') // file:// 下 fetch plugin.json 必败，回退编译期常量
      expect(launch.payload.data.installId).toBe('native-device-id-for-test')
      const request = (globalThis.fetch as any).mock.calls.find((call: any[]) => call[1]?.body)[1]
      expect(request.headers).toMatchObject({
        'x-umami-website-id': 'test-website-id',
        'x-umami-hostname': 'slowlyrecord.utools',
      })
    })

    it('页面浏览：无 name 字段，url 为路由路径', () => {
      trackPageView('/Dictation')
      const p = sentPayloads()[0]
      expect(p.payload.url).toBe('/Dictation')
      expect(p.payload.name).toBeUndefined()
    })

    it('自定义事件：name 为 类别.操作，label/value 进 data', () => {
      trackEvent('translation', 'batch', 'count_5')
      const p = sentPayloads()[0]
      expect(p.payload.name).toBe('translation.batch')
      expect(p.payload.data).toEqual({ label: 'count_5' })
      expect(p.payload.url).toBe('/Word') // 附带当前 hash 路由
    })

    it('上报失败只记日志不抛异常', () => {
      ;(globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('network down'))
      expect(() => trackEvent('word', 'add')).not.toThrow()
    })

    it('上报被拒绝（4xx）只 warn 不抛异常', async () => {
      ;(globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 401, text: () => Promise.resolve('') })
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      trackPageView('/Word')
      await new Promise(r => setTimeout(r, 0))
      expect(warn).toHaveBeenCalledWith('[统计] 上报未被收录:', 401, '')
      warn.mockRestore()
    })
  })

  describe('异常上报', () => {
    it('trackError 上报 bug.error，带 source/message/platform/appVersion', async () => {
      await trackError('js', new Error('boom'))
      const p = sentPayloads().find(x => x.payload.name === 'bug.error')
      expect(p).toBeDefined()
      expect(p.payload.data.source).toBe('js')
      expect(p.payload.data.message).toBe('boom')
      expect(p.payload.data.platform).toBe('utools')
      expect(p.payload.data.appVersion).toBe('9.9.9')
    })

    it('同源同消息会话内去重', async () => {
      await trackError('js', 'dup-error')
      await trackError('js', 'dup-error')
      const errs = sentPayloads().filter(x => x.payload.data?.message === 'dup-error')
      expect(errs.length).toBe(1)
    })

    it('统计开关关闭时异常不上报', async () => {
      setStatsExcluded(true)
      await trackError('promise', 'excluded-error')
      expect(sentPayloads().find(x => x.payload.data?.message === 'excluded-error')).toBeUndefined()
    })

    it('错误消息截断 200 字符', async () => {
      await trackError('vue', 'x'.repeat(300))
      const p = sentPayloads().find(x => x.payload.name === 'bug.error')
      expect(p.payload.data.message.length).toBe(200)
    })
  })

  describe('手动反馈', () => {
    it('submitFeedback 上报 feedback.submit，统计开关关闭也能提交', async () => {
      setStatsExcluded(true)
      const ok = await submitFeedback('  测试反馈  ', 'qq:123')
      expect(ok).toBe(true)
      const p = sentPayloads().find(x => x.payload.name === 'feedback.submit')
      expect(p).toBeDefined()
      expect(p.payload.data.text).toBe('测试反馈')
      expect(p.payload.data.contact).toBe('qq:123')
      expect(p.payload.data.installId).toBe('native-device-id-for-test')
    })

    it('空文本返回 false 且不上报', async () => {
      expect(await submitFeedback('   ')).toBe(false)
      expect(sentPayloads().find(x => x.payload.name === 'feedback.submit')).toBeUndefined()
    })

    it('网络故障时返回 false（调用方提示重试），不谎报成功', async () => {
      ;(globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('network down'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(await submitFeedback('网络测试')).toBe(false)
      warn.mockRestore()
    })

    it('反馈文本截断 500 字符', async () => {
      await submitFeedback('y'.repeat(600))
      const p = sentPayloads().find(x => x.payload.name === 'feedback.submit')
      expect(p.payload.data.text.length).toBe(500)
    })
  })

  describe('送达判定（umami 爬虫过滤）', () => {
    /** fetch 里打到 umami 的调用（排除 getPluginVersion 读 plugin.json） */
    const umamiCalls = () => (globalThis.fetch as any).mock.calls.filter((c: any[]) => String(c[0]).includes('/api/send'))

    it('uTools 下优先走 preload 的 Node 通道（浏览器 fetch 改不了 UA）', async () => {
      const post = vi.fn().mockResolvedValue({ status: 200, body: '{"cache":"ok"}' })
      ;(globalThis as any).window.services = { httpPostJson: post }
      expect(await submitFeedback('走 Node')).toBe(true)
      expect(post).toHaveBeenCalled()
      expect(umamiCalls()).toHaveLength(0)
      delete (globalThis as any).window.services
    })

    it('200 但正文是 beep（UA 被判为 bot）视为未入账', async () => {
      ;(globalThis as any).fetch = vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        text: () => Promise.resolve('{"beep":"boop"}'),
        json: () => Promise.resolve({}),
      })
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(await submitFeedback('被过滤')).toBe(false)
      expect(warn).toHaveBeenCalled()
      warn.mockRestore()
    })
  })
})
