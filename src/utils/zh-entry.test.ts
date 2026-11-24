/**
 * 桌面端 zh-entry 中文加词方向 单元测试（与移动端 mobile/src/utils/zh-entry.test.ts 对齐）
 *
 * 锁定行为：
 *  - 仅英语词库 + 输入含中文时反查；其他语言词库/纯英文输入不触发
 *  - zh2en（默认）：英文主词、原中文作释义；keep-zh：中文主词、英译作释义
 *  - 词组取第一义项词头；句子保留完整英译（单词列表支持句子条目）
 *  - 翻译失败一律返回 null（调用方回退），不抛异常
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTranslate = vi.fn()
const mockStore = {
  currentLanguage: 'en' as string,
  currentTranslationPlatform: 'youdao' as string,
}

vi.mock('@/utils/translation-api', () => ({
  translateWithPlatform: (...args: any[]) => mockTranslate(...args),
}))
vi.mock('@/stores/words', () => ({ useWordsStore: () => mockStore }))

import {
  containsChinese,
  getZhEntryMode,
  looksSentenceLike,
  pickEnglishHeadword,
  resolveZhEntry,
  setZhEntryMode,
} from './zh-entry'

describe('zh-entry（桌面端）', () => {
  beforeEach(() => {
    mockTranslate.mockReset()
    mockStore.currentLanguage = 'en'
    setZhEntryMode('zh2en')
  })

  it('containsChinese 基本判定', () => {
    expect(containsChinese('苹果')).toBe(true)
    expect(containsChinese('hello 世界')).toBe(true)
    expect(containsChinese('apple')).toBe(false)
    expect(containsChinese('')).toBe(false)
  })

  it('pickEnglishHeadword 取第一义项并清理标点、括号与多余空白', () => {
    expect(pickEnglishHeadword('apple; apple tree')).toBe('apple')
    expect(pickEnglishHeadword('苹果（fruit）：apple')).toBe('apple')
    expect(pickEnglishHeadword('take   care ！')).toBe('take care')
    expect(pickEnglishHeadword('；')).toBe('')
  })

  it('looksSentenceLike：句读标点或超过 4 字判定为句子', () => {
    expect(looksSentenceLike('美好')).toBe(false)
    expect(looksSentenceLike('美好生活')).toBe(false) // 恰好 4 字
    expect(looksSentenceLike('祝你生日快乐')).toBe(true) // > 4 字
    expect(looksSentenceLike('你好，世界')).toBe(true) // 句读标点
  })

  it('getZhEntryMode 缺省 zh2en；setZhEntryMode 写入 localStorage 持久化', () => {
    const mem: Record<string, string> = {}
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => mem[k] ?? null,
      setItem: (k: string, v: string) => { mem[k] = v },
    })
    expect(getZhEntryMode()).toBe('zh2en')
    setZhEntryMode('keep-zh')
    expect(getZhEntryMode()).toBe('keep-zh')
    expect(mem['slowlyrecord_zh_entry_mode']).toBe('keep-zh')
    vi.unstubAllGlobals()
    setZhEntryMode('zh2en')
  })

  it('zh2en：中文词组反查英文主词（取第一义项），原中文作释义', async () => {
    mockTranslate.mockResolvedValue({ success: true, explains: 'apple; apple tree' })
    const entry = await resolveZhEntry('苹果')
    expect(mockTranslate).toHaveBeenCalledWith('苹果', 'youdao', 'zh', 'en')
    expect(entry).toEqual({ word: 'apple', explains: '苹果', mode: 'zh2en' })
  })

  it('keep-zh：保留中文主词，英译作释义', async () => {
    setZhEntryMode('keep-zh')
    mockTranslate.mockResolvedValue({ success: true, explains: 'apple' })
    const entry = await resolveZhEntry('苹果')
    expect(entry).toEqual({ word: '苹果', explains: 'apple', mode: 'keep-zh' })
  })

  it('句子输入保留完整英译作主词（换行折叠为空格）', async () => {
    mockTranslate.mockResolvedValue({ success: true, explains: 'Happy birthday\nto you' })
    const entry = await resolveZhEntry('祝你生日快乐')
    expect(entry?.word).toBe('Happy birthday to you')
    expect(entry?.explains).toBe('祝你生日快乐')
  })

  it('非英语词库或非中文输入不触发反查', async () => {
    expect(await resolveZhEntry('apple')).toBeNull()
    mockStore.currentLanguage = 'ja'
    expect(await resolveZhEntry('苹果')).toBeNull()
    expect(mockTranslate).not.toHaveBeenCalled()
  })

  it('翻译失败/空结果/抛异常一律返回 null，不抛出', async () => {
    mockTranslate.mockResolvedValue({ success: false })
    expect(await resolveZhEntry('苹果')).toBeNull()
    mockTranslate.mockResolvedValue({ success: true, explains: '；' })
    expect(await resolveZhEntry('苹果')).toBeNull()
    mockTranslate.mockRejectedValue(new Error('network down'))
    expect(await resolveZhEntry('苹果')).toBeNull()
  })
})
