/**
 * stats（自建采集端点）单元测试
 * window/fetch/localStorage 全部 mock，验证启用判定与上报信封结构
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const config = vi.hoisted(() => ({
  STATS_ENDPOINT: 'https://stats.example.com/collect',
  APP_VERSION: '9.9.9',
}))
vi.mock('@/config', () => config)

import {
  initStats,
  trackEvent,
  trackPageView,
  isStatsExcluded,
  setStatsExcluded,
  applyPersistedStatsPrefs,
  trackError,
  submitFeedback,
  getStatsStatus,
  initAttribution,
  getAttribution,
  getLocalErrors,
  clearLocalErrors,
} from '@/utils/stats'

/** 等待 send() 内部的异步信封组装（getPluginVersion 微任务）完成 */
function flush(): Promise<void> {
  return new Promise(r => setTimeout(r, 0))
}

/** 取出 fetch 收到的全部统计信封（过滤 getPluginVersion 等无 body 的调用） */
function sentEvents(): any[] {
  return (globalThis.fetch as any).mock.calls
    .filter((c: any[]) => c[1]?.body)
    .map((c: any[]) => JSON.parse(c[1].body))
}

describe('stats（自建端点）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    const store: Record<string, string> = {}
    ;(globalThis as any).window = {
      location: { hostname: '', pathname: '/', hash: '#/Word', search: '' },
      localStorage: {
        getItem: (k: string) => store[k] ?? null,
        setItem: (k: string, v: string) => { store[k] = v },
        removeItem: (k: string) => { delete store[k] },
      },
      utools: { isDev: () => false, getNativeId: () => 'native-device-id-for-test' },
    }
    ;(globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: () => Promise.resolve('{"ok":true}'), json: () => Promise.resolve({}) })
  })

  afterEach(() => {
    delete (globalThis as any).window
    delete (globalThis as any).fetch
  })

  describe('启用判定', () => {
    it('默认关闭：生产环境未主动开启前不上报，opt-in 后立即启用', async () => {
      await initStats()
      await flush()
      expect(globalThis.fetch).not.toHaveBeenCalled()
      setStatsExcluded(false) // 用户主动勾选开启
      await initStats()
      await flush()
      expect(globalThis.fetch).toHaveBeenCalled()
    })

    it('未配置端点时不上报', async () => {
      config.STATS_ENDPOINT = ''
      await initStats()
      await flush()
      expect((globalThis.fetch as any).mock.calls.filter((c: any[]) => c[1]?.body)).toHaveLength(0)
      config.STATS_ENDPOINT = 'https://stats.example.com/collect'
    })

    it('uTools 开发环境（isDev=true）排除', async () => {
      ;(globalThis as any).window.utools.isDev = () => true
      await initStats()
      await flush()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('非 uTools 的 localhost 排除', async () => {
      delete (globalThis as any).window.utools
      ;(globalThis as any).window.location.hostname = 'localhost'
      setStatsExcluded(false)
      await initStats()
      await flush()
      expect(globalThis.fetch).not.toHaveBeenCalled()
    })

    it('file:// 生产页（hostname 空、无 utools/electronAPI）opt-in 后按 web 平台启用', async () => {
      delete (globalThis as any).window.utools
      setStatsExcluded(false)
      await initStats()
      await flush()
      expect(globalThis.fetch).toHaveBeenCalled()
      expect(sentEvents()[0].platform).toBe('web')
    })

    it('默认关闭即未开启；setStatsExcluded 双向切换立即生效', async () => {
      expect(isStatsExcluded()).toBe(true)
      trackPageView('/Word')
      await flush()
      expect(globalThis.fetch).not.toHaveBeenCalled()
      setStatsExcluded(false)
      expect(isStatsExcluded()).toBe(false)
      trackPageView('/Word')
      await flush()
      expect(globalThis.fetch).toHaveBeenCalled()
      setStatsExcluded(true)
      expect(isStatsExcluded()).toBe(true)
      trackPageView('/Word')
      await flush()
      // 只有 opt-in 后的那一次 page.view 真正发出
      expect((globalThis.fetch as any).mock.calls.filter((c: any[]) => c[1]?.body)).toHaveLength(1)
    })

    it('applyPersistedStatsPrefs 回填 localStorage（更新清空后恢复用户选择）', () => {
      window.localStorage.removeItem('sr_stats_optin')
      applyPersistedStatsPrefs({ optedIn: true })
      expect(isStatsExcluded()).toBe(false)
      applyPersistedStatsPrefs({ optedIn: false })
      expect(isStatsExcluded()).toBe(true)
    })

    it('旧版数据迁移：statsExcluded===false（曾显式开启）视为已 opt-in，其余按默认关闭', () => {
      window.localStorage.removeItem('sr_stats_optin')
      applyPersistedStatsPrefs({ excluded: false })
      expect(isStatsExcluded()).toBe(false) // 保住旧版显式选择
      window.localStorage.removeItem('sr_stats_optin')
      applyPersistedStatsPrefs({ excluded: true })
      expect(isStatsExcluded()).toBe(true)
      window.localStorage.removeItem('sr_stats_optin')
      applyPersistedStatsPrefs({}) // 旧版默认开启的老用户：无显式选择，按新默认关闭
      expect(isStatsExcluded()).toBe(true)
    })

    it('强制启用标记优先于一切排除规则', async () => {      ;(globalThis as any).window.utools.isDev = () => true
      setStatsExcluded(true)
      window.localStorage.setItem('sr_stats_force', '1')
      await initStats()
      await flush()
      expect(globalThis.fetch).toHaveBeenCalled()
    })
  })

  describe('getStatsStatus', () => {
    it('默认未开启返回 excluded，opt-in 后返回 enabled', () => {
      expect(getStatsStatus()).toBe('excluded')
      setStatsExcluded(false)
      expect(getStatsStatus()).toBe('enabled')
    })

    it('关闭返回 excluded，dev 环境返回 dev，localhost 返回 localhost', () => {
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

    it('force 标记优先于排除规则返回 enabled；未配置端点返回 no-endpoint', () => {
      setStatsExcluded(true)
      window.localStorage.setItem('sr_stats_force', '1')
      expect(getStatsStatus()).toBe('enabled')
      window.localStorage.removeItem('sr_stats_force')

      config.STATS_ENDPOINT = ''
      expect(getStatsStatus()).toBe('no-endpoint')
      config.STATS_ENDPOINT = 'https://stats.example.com/collect'
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
      setStatsExcluded(false)
      await initStats()
      await flush()
      const events = sentEvents()
      const launch = events.find(p => p.name === 'app.launch')
      expect(launch.data.source).toBe('github')
      expect(launch.data.landingPage).toBe('poem-tang_001')
      const landing = events.find(p => p.name === 'source.landing')
      expect(landing.data).toEqual({ source: 'github', page: 'poem-tang_001' })
    })
  })

  describe('信封结构', () => {
    // 信封用例聚焦上报内容，统一先 opt-in（默认关闭口径下无正向标记一律不发）
    beforeEach(() => setStatsExcluded(false))

    it('启动事件：事件名/平台/版本/匿名安装 ID 在顶层，POST 到固定端点', async () => {
      await initStats()
      await flush()
      const launch = sentEvents().find(p => p.name === 'app.launch')
      expect(launch).toBeDefined()
      expect(launch.platform).toBe('utools')
      expect(launch.appVersion).toBe('9.9.9') // file:// 下 fetch plugin.json 必败，回退编译期常量
      expect(launch.installId).toBe(window.localStorage.getItem('sr_install_id'))
      expect(launch.installId).not.toBe('native-device-id-for-test') // 不再读取宿主设备标识，只用本机随机 UUID
      expect(launch.ts).toEqual(expect.any(Number))
      const call = (globalThis.fetch as any).mock.calls.find((c: any[]) => c[1]?.body)
      expect(call[0]).toBe('https://stats.example.com/collect')
      expect(call[1].method).toBe('POST')
      expect(call[1].headers['Content-Type']).toBe('application/json')
    })

    it('页面浏览：事件名 page.view，url 为路由路径', async () => {
      trackPageView('/Dictation')
      await flush()
      const p = sentEvents()[0]
      expect(p.name).toBe('page.view')
      expect(p.url).toBe('/Dictation')
    })

    it('页面路径剥离查询串：划词/翻译原文等 query 参数不上报', async () => {
      trackPageView('/translate?text=secret-content')
      await flush()
      expect(sentEvents()[0].url).toBe('/translate')

      ;(globalThis as any).window.location.hash = '#/translate?text=abc'
      trackEvent('word', 'add')
      await flush()
      expect(sentEvents()[1].url).toBe('/translate')
    })

    it('自定义事件：name 为 类别.操作，label/value 进 data', async () => {
      trackEvent('translation', 'batch', 'count_5')
      await flush()
      const p = sentEvents()[0]
      expect(p.name).toBe('translation.batch')
      expect(p.data).toEqual({ label: 'count_5' })
      expect(p.url).toBe('/Word') // 附带当前 hash 路由
    })

    it('上报失败只记日志不抛异常', () => {
      ;(globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('network down'))
      expect(() => trackEvent('word', 'add')).not.toThrow()
    })

    it('上报被拒绝（4xx）只 warn 不抛异常', async () => {
      ;(globalThis as any).fetch = vi.fn().mockResolvedValue({ ok: false, status: 400, text: () => Promise.resolve('') })
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      trackPageView('/Word')
      await flush()
      expect(warn).toHaveBeenCalledWith('[统计] 上报未被收录:', 400)
      warn.mockRestore()
    })
  })

  describe('异常上报', () => {
    // bug.error 与常规统计共用 opt-in 开关；用例统一先开启（关闭行为有专项用例）
    beforeEach(() => setStatsExcluded(false))

    it('trackError 上报 bug.error，带路由和非敏感运行时上下文', async () => {
      ;(globalThis as any).window.utools.getAppVersion = () => '8.0.2'
      await trackError('js', new Error('boom'), '/word')
      await flush()
      const p = sentEvents().find(x => x.name === 'bug.error')
      expect(p).toBeDefined()
      expect(p.url).toBe('/word')
      expect(p.platform).toBe('utools')
      expect(p.appVersion).toBe('9.9.9')
      expect(p.data.source).toBe('js')
      expect(p.data.message).toBe('boom')
      expect(p.data.clientVersion).toBe('8.0.2')
      expect(p.data.runtime).toEqual(expect.any(String))
      expect(p.data.errorName).toBe('Error')
    })

    it('同源同消息会话内去重', async () => {
      await trackError('js', 'dup-error')
      await trackError('js', 'dup-error')
      await flush()
      const errs = sentEvents().filter(x => x.data?.message === 'dup-error')
      expect(errs.length).toBe(1)
    })

    it('统计开关关闭时异常不上报', async () => {
      setStatsExcluded(true)
      await trackError('promise', 'excluded-error')
      await flush()
      expect(sentEvents().find(x => x.data?.message === 'excluded-error')).toBeUndefined()
    })

    it('错误消息截断 200 字符', async () => {
      await trackError('vue', 'x'.repeat(300))
      await flush()
      const p = sentEvents().find(x => x.name === 'bug.error')
      expect(p.data.message.length).toBe(200)
    })

    it('错误消息脱敏：去 URL、去 JSON 回显、只留首行', async () => {
      await trackError('js', new Error('请求 https://api.example.com/v1?q=原文 失败 {"echo":"用户原文"}\n第二行堆栈信息'))
      await flush()
      const p = sentEvents().find(x => x.name === 'bug.error')
      expect(p.data.message).toBe('请求 [url] 失败')
    })
  })

  describe('本地错误日志（始终记录，不上传）', () => {
    it('统计关闭时 trackError 仍写本地缓冲，只是不发网络请求', async () => {
      setStatsExcluded(true)
      await trackError('js', 'local-only-error', '/word')
      await flush()
      const list = getLocalErrors()
      expect(list).toHaveLength(1)
      expect(list[0]).toMatchObject({ source: 'js', message: 'local-only-error', page: '/word' })
      expect(list[0].ts).toEqual(expect.any(Number))
      expect(sentEvents().find(x => x.data?.message === 'local-only-error')).toBeUndefined()
    })

    it('新错误排在前；clearLocalErrors 清空', async () => {
      clearLocalErrors()
      await trackError('js', 'first')
      await trackError('promise', 'second')
      await flush()
      expect(getLocalErrors().map(e => e.message)).toEqual(['second', 'first'])
      clearLocalErrors()
      expect(getLocalErrors()).toHaveLength(0)
    })

    it('环形缓冲上限 50 条，保留最新', async () => {
      clearLocalErrors()
      for (let i = 0; i < 55; i++) {
        await trackError('js', `err-${i}`)
      }
      await flush()
      const list = getLocalErrors()
      expect(list).toHaveLength(50)
      expect(list[0].message).toBe('err-54')
    })

    it('损坏的本地数据按空处理，不阻断后续记录', async () => {
      window.localStorage.setItem('sr_error_log', '{broken json')
      await trackError('js', 'after-corrupt')
      await flush()
      expect(getLocalErrors().map(e => e.message)).toEqual(['after-corrupt'])
    })
  })

  describe('手动反馈', () => {
    it('submitFeedback 上报 feedback.submit，统计开关关闭也能提交', async () => {
      setStatsExcluded(true)
      const ok = await submitFeedback('  测试反馈  ', 'qq:123')
      expect(ok).toBe(true)
      const p = sentEvents().find(x => x.name === 'feedback.submit')
      expect(p).toBeDefined()
      expect(p.data.text).toBe('测试反馈')
      expect(p.data.contact).toBe('qq:123')
      expect(p.installId).toBe(window.localStorage.getItem('sr_install_id'))
    })

    it('空文本返回 false 且不上报', async () => {
      expect(await submitFeedback('   ')).toBe(false)
      expect(sentEvents().find(x => x.name === 'feedback.submit')).toBeUndefined()
    })

    it('网络故障时返回 false（调用方提示重试），不谎报成功', async () => {
      ;(globalThis as any).fetch = vi.fn().mockRejectedValue(new Error('network down'))
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
      expect(await submitFeedback('网络测试')).toBe(false)
      warn.mockRestore()
    })

    it('反馈文本截断 500 字符', async () => {
      await submitFeedback('y'.repeat(600))
      await flush()
      const p = sentEvents().find(x => x.name === 'feedback.submit')
      expect(p.data.text.length).toBe(500)
    })
  })
})
