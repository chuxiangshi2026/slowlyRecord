import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockTranslate = vi.fn()

vi.mock('./quick-translate', () => ({
  quickTranslateToEnglish: (...args: any[]) => mockTranslate(...args),
}))
vi.mock('./youdao-tts', () => ({
  containsChinese: (text: string) => /[\u4e00-\u9fff]/.test(text),
}))

import { getZhEntryMode, pickEnglishHeadword, resolveZhEntry, setZhEntryMode } from './zh-entry'

describe('zh-entry', () => {
  beforeEach(() => {
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn(() => ''),
      setStorageSync: vi.fn(),
    })
    mockTranslate.mockReset()
  })

  it('pickEnglishHeadword 取第一义项并清理标点、括号与多余空白', () => {
    expect(pickEnglishHeadword('apple; apple tree')).toBe('apple')
    expect(pickEnglishHeadword('苹果（fruit）：apple')).toBe('apple')
    expect(pickEnglishHeadword('take   care ！')).toBe('take care')
    expect(pickEnglishHeadword('；')).toBe('')
  })

  it('默认方向：中文译成英文主词、原中文作释义', async () => {
    setZhEntryMode('zh2en')
    expect(getZhEntryMode()).toBe('zh2en')
    mockTranslate.mockResolvedValue({ ok: true, text: 'apple; apple tree' })
    const entry = await resolveZhEntry('苹果', 'en')
    expect(entry).toEqual({ word: 'apple', meaning: '苹果', mode: 'zh2en' })
  })

  it('keep-zh 方向：保留中文主词、英文译文作释义', async () => {
    setZhEntryMode('keep-zh')
    expect(getZhEntryMode()).toBe('keep-zh')
    mockTranslate.mockResolvedValue({ ok: true, text: 'apple' })
    const entry = await resolveZhEntry('苹果', 'en')
    expect(entry).toEqual({ word: '苹果', meaning: 'apple', mode: 'keep-zh' })
  })

  it('非中文或非英语词库不触发反查', async () => {
    setZhEntryMode('zh2en')
    expect(await resolveZhEntry('apple', 'en')).toBeNull()
    expect(await resolveZhEntry('苹果', 'ja')).toBeNull()
    expect(mockTranslate).not.toHaveBeenCalled()
  })

  it('翻译失败返回 null 交给调用方回退', async () => {
    setZhEntryMode('zh2en')
    mockTranslate.mockResolvedValue({ ok: false, error: 'no network' })
    expect(await resolveZhEntry('苹果', 'en')).toBeNull()
  })

  it('中文句子加入单词列表：保留完整英译作主词，不截断成词头', async () => {
    setZhEntryMode('zh2en')
    mockTranslate.mockResolvedValue({ ok: true, text: 'I love learning English. It is fun.' })
    const entry = await resolveZhEntry('我喜欢学英语。很有趣。', 'en')
    expect(entry).toEqual({ word: 'I love learning English. It is fun.', meaning: '我喜欢学英语。很有趣。', mode: 'zh2en' })
  })
})
