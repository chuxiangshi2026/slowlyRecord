// @vitest-environment jsdom
/**
 * App.vue uTools 入口分派（handleUtoolsEnter）集成测试 —— fake utools 宿主
 *
 * 背景：uTools 专属链路（划词/截图/超级面板入口、主窗口隐藏与恢复）只在 window.utools
 * 存在的真机环境触发，L1 单测与 L2 黑盒 E2E（纯 Chromium）都覆盖不到，曾漏掉
 * 「截图后窗口不恢复、划词翻译静默失败」等线上问题。本文件用 fake utools 对象把
 * 入口分派整条链路纳入回归：
 *  - overSentence：收藏句子进句子库并跳转
 *  - huaciTranslate：payload → 模拟复制（轮询剪贴板取新内容）两级获取，空结果有可见提示
 *  - jietu / jietuTranslate：成功、空结果、错误、取消所有出口都必须恢复主窗口
 *  - OCR 面板选择：整句作为词条入词库，不拆词不分流
 *  - huaci：长句出划段面板；中文短词绕过字符集校验交给中文反查
 */
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mount } from '@vue/test-utils'

const hoisted = vi.hoisted(() => ({
  routerPush: vi.fn(),
  enterCallback: null as null | ((action: any) => void),
  ocrMulti: vi.fn(),
  addWord: vi.fn(async () => ({ success: true, message: '', text: '' })),
  batchAddWords: vi.fn(async () => {}),
  sentencesAdd: vi.fn(async () => ({ success: true, message: '', sentence: {} })),
  isWordText: vi.fn(() => true),
  elMessage: Object.assign(vi.fn(), {
    success: vi.fn(), warning: vi.fn(), error: vi.fn(), info: vi.fn(),
  }),
  wordsStore: {
    pluginStatus: false,
    shortcutEnabled: false,
    currentTranslationPlatform: 'youdao',
    currentOcrPlatform: 'bilibili',
    memoryFirmness: 'normal',
    scheduleReminder: {} as Record<string, unknown>,
    focusMode: {} as Record<string, unknown>,
    mainWindowOpacity: 1,
    appBg: {} as Record<string, unknown>,
    autoSpeak: false,
    eyeCare: false,
    userApiKeys: {} as Record<string, unknown>,
    userOcrApiKeys: {} as Record<string, unknown>,
    forgetCount: 0,
    lastFocusWordText: '',
    listWords: vi.fn(async () => []),
    applyAppBg: vi.fn(),
    applyEyeCareTheme: vi.fn(),
    applyRgbaOpacity: vi.fn(),
    setLastAddedWordText: vi.fn(),
  },
}))

vi.mock('vue-router', () => ({
  useRouter: () => ({ push: hoisted.routerPush }),
  RouterView: { name: 'RouterView', template: '<div />' },
}))
vi.mock('@/stores/words.ts', () => ({ useWordsStore: () => hoisted.wordsStore }))
vi.mock('@/stores/ui.ts', () => ({ useUiStore: () => ({ uiZoom: 1, applyUiZoom: vi.fn() }) }))
vi.mock('@/stores/sentences', () => ({ useSentencesStore: () => ({ add: hoisted.sentencesAdd }) }))
vi.mock('element-plus', () => ({
  ElMessage: hoisted.elMessage,
  ElMessageBox: { confirm: vi.fn(async () => 'confirm') },
}))
vi.mock('@/utils/pic-translate.ts', () => ({
  ocrTranslate: vi.fn(),
  ocrTranslateAli: vi.fn(),
  ocrTranslateBaidu: vi.fn(),
  ocrTranslateBilibili: vi.fn(),
  ocrTranslateSiliconflow: vi.fn(),
  ocrTranslateLocal: vi.fn(),
  ocrTranslateMultiPlatform: hoisted.ocrMulti,
  ocrTranslateTencent: vi.fn(),
  preloadWorker: vi.fn(),
}))
vi.mock('@/utils/str-util.ts', () => ({
  addWord: hoisted.addWord,
  batchAddWords: hoisted.batchAddWords,
}))
vi.mock('@/adapters/platform', () => ({ isUtools: () => true }))
vi.mock('@/utils/user-set-db-util.ts', () => ({
  getSetDb: () => null,
  decryptSyncedSecrets: async (x: any) => x,
}))
vi.mock('@/utils/get-api-key.ts', () => ({ getOcrApiKey: () => ({ appkey: '', key: '' }) }))
vi.mock('@/utils/translation-lang-map.ts', () => ({ toEngineLang: () => 'auto' }))
vi.mock('@/utils/usage-counter.ts', () => ({
  getCurrentUsageCount: () => 0,
  incrementUsageCounter: vi.fn(),
  isFreeOcrPlatform: () => false,
  isOverDailyLimit: () => false,
}))
vi.mock('@/adapters/notification.ts', () => ({ getNotificationAdapter: () => ({ show: vi.fn() }) }))
vi.mock('@/utils/stats', () => ({
  getStatsStatus: () => ({}),
  setStatsExcluded: vi.fn(),
  applyPersistedStatsPrefs: vi.fn(),
}))
vi.mock('@/utils/schedule-reminder', () => ({ reconcileSchedules: vi.fn(async () => {}) }))
vi.mock('@/adapters/local-bulk-store', () => ({ isStoreLocalOnly: () => false }))
vi.mock('@/utils/language', () => ({
  getActiveProfile: () => ({}),
  getActiveLanguage: () => 'en',
  isWordText: (...args: any[]) => (hoisted.isWordText as any)(...args),
}))
vi.mock('@/utils/zh-entry', () => ({
  containsChinese: (t: string) => /[一-鿿㐀-䶿]/.test(t),
  resolveZhEntry: vi.fn(async () => null),
}))
vi.mock('@/utils/translation-api', () => ({
  translateWithPlatform: vi.fn(async () => ({ success: true, explains: '译文' })),
}))
vi.mock('@/config.ts', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/config.ts')>()
  return { ...actual, RETIRED_MODEL_NAMES: {} }
})

import App from './App.vue'
import { translateWithPlatform } from '@/utils/translation-api'

function fakeUtools() {
  return {
    onPluginEnter: (cb: (action: any) => void) => { hoisted.enterCallback = cb },
    showMainWindow: vi.fn(),
    hideMainWindow: vi.fn(() => true),
    copyText: vi.fn(),
    simulateKeyboardTap: vi.fn(),
    getWindowType: vi.fn(() => 'main'),
    isMacOS: vi.fn(() => false),
  }
}

function mountApp() {
  return mount(App, {
    global: {
      stubs: {
        'el-config-provider': { template: '<div><slot /></div>' },
        OCRSelector: { name: 'OCRSelector', props: ['visible', 'ocrResults', 'loading'], template: '<div />' },
        TextSelector: { name: 'TextSelector', props: ['visible', 'textContent'], template: '<div />' },
        DebugPanel: {
          name: 'DebugPanel',
          props: ['visible'],
          template: '<div />',
          // App.vue 的 debugLog 会调 ref 上的 addLog，stub 必须暴露同名方法
          setup: (_: any, { expose }: any) => { expose({ addLog: vi.fn() }) },
        },
      },
    },
  })
}

describe('App uTools 入口分派（fake utools 宿主）', () => {
  let utools: ReturnType<typeof fakeUtools>

  beforeEach(() => {
    vi.clearAllMocks()
    hoisted.enterCallback = null
    hoisted.addWord.mockResolvedValue({ success: true, message: '', text: '' })
    hoisted.sentencesAdd.mockResolvedValue({ success: true, message: '', sentence: {} })
    hoisted.isWordText.mockReturnValue(true)
    utools = fakeUtools()
    ;(window as any).utools = utools
    Object.defineProperty(navigator, 'clipboard', {
      value: { readText: vi.fn(async () => ''), writeText: vi.fn(async () => {}) },
      configurable: true,
    })
  })

  it('overSentence：原句进句子库并跳转 /sentences', async () => {
    mountApp()
    hoisted.enterCallback!({ code: 'overSentence', payload: '愿所有美好如期而至。' })
    await vi.waitFor(() => {
      expect(hoisted.sentencesAdd).toHaveBeenCalledWith('愿所有美好如期而至。')
      expect(hoisted.routerPush).toHaveBeenCalledWith('/sentences')
    })
    // 收藏句子不翻译：不触碰翻译/加词链路
    expect(hoisted.addWord).not.toHaveBeenCalled()
    expect(hoisted.batchAddWords).not.toHaveBeenCalled()
  })

  it('overSentence：空 payload 只提示，不进库不跳转', async () => {
    mountApp()
    hoisted.enterCallback!({ code: 'overSentence', payload: '   ' })
    await vi.waitFor(() => {
      expect(hoisted.elMessage.warning).toHaveBeenCalledWith('未获取到选中的文本')
    })
    expect(hoisted.sentencesAdd).not.toHaveBeenCalled()
    expect(hoisted.routerPush).not.toHaveBeenCalled()
  })

  it('huaciTranslate：payload 直给时直接进翻译页，不读剪贴板不模拟复制', async () => {
    mountApp()
    hoisted.enterCallback!({ code: 'huaciTranslate', from: 'hotkey', payload: 'hello world' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith({ path: '/translate', query: { text: 'hello world' } })
    })
    expect(utools.simulateKeyboardTap).not.toHaveBeenCalled()
  })

  it('huaciTranslate：无 payload 时模拟复制获取选中文本（不读旧剪贴板）', async () => {
    ;(navigator.clipboard.readText as any)
      .mockResolvedValueOnce('') // 备份读取：剪贴板原为空
      .mockResolvedValue('fresh selection') // 模拟复制后读到新选中文本
    mountApp()
    hoisted.enterCallback!({ code: 'huaciTranslate', from: 'hotkey' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith({ path: '/translate', query: { text: 'fresh selection' } })
    }, { timeout: 3000 })
    expect(utools.simulateKeyboardTap).toHaveBeenCalledWith('c', 'ctrl')
  })

  it('huaciTranslate：主输入框触发时 payload 是关键词本身，剥掉后走模拟复制（回归锁）', async () => {
    // 真机日志实锤：主输入框键入「划词翻译」时 uTools 把关键词本身作为 payload 传入，
    // 若直接采用会把「划词翻译」四字拿去翻译，而不是用户选中的内容
    ;(navigator.clipboard.readText as any)
      .mockResolvedValueOnce('')
      .mockResolvedValue('real selected text')
    mountApp()
    hoisted.enterCallback!({ code: 'huaciTranslate', from: 'main', type: 'text', payload: '划词翻译' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith({ path: '/translate', query: { text: 'real selected text' } })
    }, { timeout: 3000 })
    expect(utools.simulateKeyboardTap).toHaveBeenCalledWith('c', 'ctrl')
  })

  it('huaciTranslate：主输入框关键词后带文本时直接翻译剩余部分，不模拟复制', async () => {
    mountApp()
    hoisted.enterCallback!({ code: 'huaciTranslate', from: 'main', type: 'text', payload: '划词翻译 hello world' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith({ path: '/translate', query: { text: 'hello world' } })
    })
    expect(utools.simulateKeyboardTap).not.toHaveBeenCalled()
  })

  it('translate：over 匹配时 payload 是选中文本，直接带入翻译页', async () => {
    mountApp()
    hoisted.enterCallback!({ code: 'translate', from: 'main', type: 'over', payload: 'panel selection' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith({ path: '/translate', query: { text: 'panel selection' } })
    })
  })

  it('translate：主输入框仅键入「翻译」时打开空翻译页，不把关键词当原文', async () => {
    mountApp()
    hoisted.enterCallback!({ code: 'translate', from: 'main', type: 'text', payload: '翻译' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith('/translate')
    })
  })

  it('huaciTranslate：全部取空时给出可见提示而不是静默无反应', async () => {
    mountApp()
    hoisted.enterCallback!({ code: 'huaciTranslate', from: 'hotkey' })
    // getSelectedTextFromSystem 内有约 800ms 真实延迟
    await vi.waitFor(() => {
      expect(hoisted.elMessage.warning).toHaveBeenCalledWith('未获取到选中的文本，请先选中要翻译的内容')
    }, { timeout: 3000 })
    expect(hoisted.routerPush).not.toHaveBeenCalledWith(expect.objectContaining({ path: '/translate' }))
  })

  it('jietuTranslate：截图完成立即恢复窗口并打开「识别中」翻译页，不等 OCR 网络返回', async () => {
    hoisted.ocrMulti.mockImplementation(async (onCaptured?: () => void) => {
      onCaptured?.() // 模拟截图完成的时机
      return { errorCode: '0', resRegions: [{ context: 'hello' }] }
    })
    mountApp()
    hoisted.enterCallback!({ code: 'jietuTranslate' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith({ path: '/translate', query: { pending: 'ocr' } })
    })
    expect(utools.showMainWindow).toHaveBeenCalled()
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith({ path: '/translate', query: { text: 'hello', to: 'zh' } })
    })
  })

  it('jietuTranslate 成功：恢复主窗口并携带 OCR 文本跳转翻译页', async () => {
    hoisted.ocrMulti.mockResolvedValue({
      errorCode: '0',
      resRegions: [{ context: 'hello' }, { context: 'world' }],
    })
    mountApp()
    hoisted.enterCallback!({ code: 'jietuTranslate' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith({ path: '/translate', query: { text: 'hello\nworld', to: 'zh' } })
    })
    expect(utools.showMainWindow).toHaveBeenCalled()
    // 截图翻译固定译向中文：预热参数与页面 query.to 一致，命中在途去重
    expect(translateWithPlatform).toHaveBeenCalledWith('hello\nworld', 'youdao', 'auto', 'zh')
  })

  it('jietuTranslate 空结果：主窗口必须恢复（回归：曾静默悬挂），且不跳转', async () => {
    hoisted.ocrMulti.mockResolvedValue({ errorCode: '0', resRegions: [] })
    mountApp()
    hoisted.enterCallback!({ code: 'jietuTranslate' })
    await vi.waitFor(() => {
      expect(hoisted.elMessage.warning).toHaveBeenCalledWith('未识别到可翻译的原文')
    })
    expect(utools.showMainWindow).toHaveBeenCalled()
    expect(hoisted.routerPush).not.toHaveBeenCalled()
  })

  it('jietuTranslate OCR 错误：主窗口必须恢复并提示错误', async () => {
    hoisted.ocrMulti.mockResolvedValue({ errorCode: '500', resRegions: [] })
    mountApp()
    hoisted.enterCallback!({ code: 'jietuTranslate' })
    await vi.waitFor(() => {
      expect(hoisted.elMessage.error).toHaveBeenCalled()
    })
    expect(utools.showMainWindow).toHaveBeenCalled()
    expect(hoisted.routerPush).not.toHaveBeenCalled()
  })

  it('jietu：截图完成立即恢复窗口并切到单词列表，不停留在上次页面', async () => {
    hoisted.ocrMulti.mockImplementation(async (onCaptured?: () => void) => {
      onCaptured?.() // 模拟截图完成的时机
      return { errorCode: '0', resRegions: [{ context: 'hello' }] }
    })
    mountApp()
    hoisted.enterCallback!({ code: 'jietu' })
    await vi.waitFor(() => {
      expect(hoisted.routerPush).toHaveBeenCalledWith('/word')
    })
    expect(utools.showMainWindow).toHaveBeenCalled()
  })

  it('jietu：截图完成立即打开「识别中」面板，OCR 结果稍后填入', async () => {
    hoisted.ocrMulti.mockImplementation(async (onCaptured?: () => void) => {
      onCaptured?.()
      await new Promise(r => setTimeout(r, 200)) // 模拟 OCR 网络耗时，让「识别中」可被观测
      return { errorCode: '0', resRegions: [{ context: 'hello' }] }
    })
    const wrapper = mountApp()
    hoisted.enterCallback!({ code: 'jietu' })
    const selector = wrapper.findComponent({ name: 'OCRSelector' })
    await vi.waitFor(() => {
      expect(selector.props('visible')).toBe(true)
      expect(selector.props('loading')).toBe(true)
    })
    await vi.waitFor(() => {
      expect(selector.props('loading')).toBe(false)
      expect(selector.props('ocrResults')).toHaveLength(1)
    })
  })

  it('新功能进入时关闭已打开的 OCR 面板，避免盖住新页面', async () => {
    hoisted.ocrMulti.mockResolvedValue({ errorCode: '0', resRegions: [{ context: 'hello' }] })
    const wrapper = mountApp()
    hoisted.enterCallback!({ code: 'jietu' })
    const selector = wrapper.findComponent({ name: 'OCRSelector' })
    await vi.waitFor(() => expect(selector.props('visible')).toBe(true))
    // 再触发划词翻译：旧面板应立即关闭，新页面不被遮挡
    hoisted.enterCallback!({ code: 'huaciTranslate', from: 'hotkey', payload: 'world' })
    await vi.waitFor(() => expect(selector.props('visible')).toBe(false))
  })

  it('jietu 用户取消截图：静默恢复主窗口，不报错', async () => {
    hoisted.ocrMulti.mockRejectedValue(new Error('截图取消'))
    mountApp()
    hoisted.enterCallback!({ code: 'jietu' })
    await vi.waitFor(() => {
      expect(utools.showMainWindow).toHaveBeenCalled()
    })
    expect(hoisted.elMessage.error).not.toHaveBeenCalled()
  })

  it('OCR 面板选择：整句作为词条入词库，不拆词不分流到句子库', async () => {
    hoisted.ocrMulti.mockResolvedValue({
      errorCode: '0',
      resRegions: [{ context: 'The quick brown fox jumps', tranContent: '敏捷的棕色狐狸跳' }],
    })
    const wrapper = mountApp()
    hoisted.enterCallback!({ code: 'jietu' })
    const selector = wrapper.findComponent({ name: 'OCRSelector' })
    await vi.waitFor(() => {
      expect(selector.props('visible')).toBe(true)
    })
    selector.vm.$emit('select', { context: 'The quick brown fox jumps', tranContent: '敏捷的棕色狐狸跳' })
    await vi.waitFor(() => {
      expect(hoisted.batchAddWords).toHaveBeenCalledWith(['The quick brown fox jumps'])
      expect(hoisted.routerPush).toHaveBeenCalledWith('/word')
    })
    expect(hoisted.sentencesAdd).not.toHaveBeenCalled()
  })

  it('huaci 长句：打开划段面板（可挑词/整句/收藏），不自动分流', async () => {
    const sentence = 'The quick brown fox jumps over the lazy dog again'
    const wrapper = mountApp()
    hoisted.enterCallback!({ code: 'huaci', from: 'hotkey', payload: sentence })
    const selector = wrapper.findComponent({ name: 'TextSelector' })
    await vi.waitFor(() => {
      expect(selector.props('visible')).toBe(true)
      expect(selector.props('textContent')).toBe(sentence)
    })
    expect(hoisted.sentencesAdd).not.toHaveBeenCalled()
  })

  it('huaci 中文短词：绕过拉丁字符集校验，交给 addWord 中文反查（回归锁）', async () => {
    hoisted.isWordText.mockReturnValue(false) // 英语词库的字符集校验会拒绝 CJK
    mountApp()
    hoisted.enterCallback!({ code: 'huaci', from: 'hotkey', payload: '美好' })
    await vi.waitFor(() => {
      expect(hoisted.addWord).toHaveBeenCalledWith('美好')
    })
  })

  it('huaci 加词成功时不弹空白 warning', async () => {
    mountApp()
    hoisted.enterCallback!({ code: 'huaci', from: 'hotkey', payload: 'hello' })
    await vi.waitFor(() => expect(hoisted.addWord).toHaveBeenCalledWith('hello'))
    await new Promise(resolve => setTimeout(resolve, 0))
    expect(hoisted.elMessage.warning).not.toHaveBeenCalled()
  })

  it('启动缓存 enter 失败时给出可见错误', async () => {
    hoisted.addWord.mockRejectedValueOnce(new Error('db failed'))
    ;(window as any).__pluginEnterQueue = [{ code: 'over', payload: 'hello' }]
    mountApp()
    await vi.waitFor(() => {
      expect(hoisted.elMessage.warning).toHaveBeenCalledWith('操作执行失败，请重试')
    })
    delete (window as any).__pluginEnterQueue
  })

  it('批量加词失败时给出可见错误', async () => {
    hoisted.batchAddWords.mockRejectedValueOnce(new Error('translate failed'))
    const wrapper = mountApp()
    hoisted.enterCallback!({ code: 'huaci', from: 'hotkey', payload: 'The quick brown fox jumps over the lazy dog again' })
    const selector = wrapper.findComponent({ name: 'TextSelector' })
    await vi.waitFor(() => expect(selector.props('visible')).toBe(true))
    selector.vm.$emit('select', ['hello'])
    await vi.waitFor(() => {
      expect(hoisted.elMessage.error).toHaveBeenCalledWith('保存失败，请重试')
    })
  })
})
