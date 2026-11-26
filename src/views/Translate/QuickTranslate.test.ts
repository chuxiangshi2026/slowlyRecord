// @vitest-environment jsdom
/**
 * 快速翻译页入口参数：截图翻译带 to=zh 时固定译向中文（不按中英占比翻成学习语言），
 * 识别中状态清掉上一次的文本与结果（回归：停留翻译页再截图，旧内容残留）。
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount, flushPromises } from '@vue/test-utils'
import { reactive } from 'vue'

const hoisted = vi.hoisted(() => ({
  route: { query: {} as Record<string, unknown> },
  translate: vi.fn(async () => ({ success: true, explains: '译文' })),
}))

vi.mock('vue-router', async () => {
  const { reactive: reactiveRoute } = await import('vue')
  return { useRoute: () => reactiveRoute(hoisted.route) }
})
vi.mock('@/utils/translation-api', () => ({ translateWithPlatform: hoisted.translate }))
vi.mock('@/utils/engine-options', () => ({ getAvailableTranslationEngineGroups: () => [] }))
vi.mock('@/utils/str-util', () => ({ addWord: vi.fn(async () => ({ success: true })) }))
vi.mock('@/stores/words', () => ({
  useWordsStore: () => ({
    currentTranslationPlatform: 'bilibili',
    setTranslationPlatform: vi.fn(),
    findWord: () => null,
  }),
}))
vi.mock('@/adapters/clipboard', () => ({ getClipboardAdapter: () => ({ copyText: vi.fn() }) }))
vi.mock('@/stores/sentences', () => ({ useSentencesStore: () => ({ add: vi.fn() }) }))
vi.mock('element-plus', () => ({
  ElMessage: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}))

import QuickTranslate from './QuickTranslate.vue'

// reactive(hoisted.route) 缓存同一代理，测试里改 route 才能触发组件 watch
let route: { query: Record<string, unknown> }

function mountPage() {
  return mount(QuickTranslate, {
    global: {
      stubs: {
        'el-select': { template: '<div><slot /></div>', props: ['modelValue'] },
        'el-option': true,
        'el-option-group': true,
        'el-button': { template: '<button><slot /></button>' },
        'el-input': { template: '<textarea :data-value="modelValue" />', props: ['modelValue'] },
        'el-icon': { template: '<i><slot /></i>' },
        'el-divider': true,
        'el-tag': { template: '<span><slot /></span>' },
      },
    },
  })
}

function inputValue(wrapper: ReturnType<typeof mountPage>) {
  return wrapper.find('textarea').attributes('data-value') || ''
}

describe('QuickTranslate 入口参数', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.route = { query: {} }
    route = reactive(hoisted.route)
  })

  it('截图翻译带 to=zh：中英混排也译向中文（源语言交引擎自动识别）', async () => {
    route.query = { text: '今天天气很好 hello', to: 'zh' }
    mountPage()
    await flushPromises()
    expect(hoisted.translate).toHaveBeenCalledWith('今天天气很好 hello', 'bilibili', 'auto', 'zh')
  })

  it('无 to 参数时保持占比判定：中文为主译成学习语言', async () => {
    route.query = { text: '今天天气很好 hello' }
    mountPage()
    await flushPromises()
    expect(hoisted.translate).toHaveBeenCalledWith('今天天气很好 hello', 'bilibili', 'zh', 'en')
  })

  it('识别中清空旧内容，新文本到达后按入口参数翻译（回归：旧译文残留）', async () => {
    route.query = { text: 'old text' }
    const wrapper = mountPage()
    await flushPromises()
    expect(hoisted.translate).toHaveBeenCalledWith('old text', 'bilibili', 'en', 'zh')

    // 截图完成：先切到「识别中」，旧文本/结果立即清掉
    route.query = { pending: 'ocr' }
    await flushPromises()
    expect(inputValue(wrapper)).toBe('')

    // OCR 返回：填入新文本并按固定译向中文翻译
    route.query = { text: 'new words', to: 'zh' }
    await flushPromises()
    expect(inputValue(wrapper)).toBe('new words')
    expect(hoisted.translate).toHaveBeenCalledWith('new words', 'bilibili', 'auto', 'zh')
  })

  it('不同文本并发时旧响应不得覆盖新译文', async () => {
    const resolvers = new Map<string, (value: any) => void>()
    hoisted.translate.mockImplementation((text: string) => new Promise(resolve => resolvers.set(text, resolve)))
    route.query = { text: 'old text' }
    const wrapper = mountPage()
    await flushPromises()

    route.query = { text: 'new text' }
    await flushPromises()
    resolvers.get('new text')!({ success: true, explains: '新译文' })
    await flushPromises()
    resolvers.get('old text')!({ success: true, explains: '旧译文' })
    await flushPromises()

    expect(wrapper.text()).toContain('新译文')
    expect(wrapper.text()).not.toContain('旧译文')
  })
})
