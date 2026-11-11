import { describe, it, expect } from 'vitest'
import { WORDBOOK_SAMPLES } from './wordbook-samples'

describe('内置示例词集', () => {
  it('每页至少 4 个词，且词条 entryId 全局唯一', () => {
    const entryIds = new Set<string>()
    for (const book of WORDBOOK_SAMPLES) {
      expect(book.chapters.length).toBeGreaterThan(0)
      for (const chapter of book.chapters) {
        expect(chapter.pages.length).toBeGreaterThan(0)
        for (const page of chapter.pages) {
          expect(page.words.length).toBeGreaterThanOrEqual(4)
          for (const word of page.words) {
            expect(word.entryId).toMatch(/^sample_[a-z0-9_]+$/)
            expect(entryIds.has(word.entryId)).toBe(false)
            entryIds.add(word.entryId)
          }
        }
      }
    }
  })

  it('页内单词确实包含所标注的词根/词缀/字母组合', () => {
    for (const book of WORDBOOK_SAMPLES) {
      for (const chapter of book.chapters) {
        for (const page of chapter.pages) {
          if (page.keyType === 'text' || page.keyType === 'phonetic') continue
          const key = page.keyValue.toLowerCase()
          for (const word of page.words) {
            const text = word.text.toLowerCase()
            const matched = page.keyType === 'prefix'
              ? text.startsWith(key)
              : page.keyType === 'suffix'
                ? text.endsWith(key)
                : text.includes(key)
            expect(matched, `${book.name}/${chapter.name}/${key}: ${word.text}`).toBe(true)
          }
        }
      }
    }
  })

  it('示例包含词根 port、前缀 un 和字母组合 old 三个入门页', () => {
    const pages = WORDBOOK_SAMPLES.flatMap(book => book.chapters.flatMap(chapter => chapter.pages))
    expect(pages.some(page => page.keyType === 'root' && page.keyValue === 'port')).toBe(true)
    expect(pages.some(page => page.keyType === 'prefix' && page.keyValue === 'un')).toBe(true)
    expect(pages.some(page => page.keyType === 'letters' && page.keyValue === 'old')).toBe(true)
  })

  it('固定句式按疑问开头成页，包含状态确认和常用疑问词', () => {
    const book = WORDBOOK_SAMPLES.find(item => item.name === '固定句式')
    expect(book?.chapters.map(chapter => chapter.name)).toEqual(['确认与状态', '常用疑问词', '礼貌请求'])
    const pages = book?.chapters.flatMap(chapter => chapter.pages) || []
    expect(pages.map(page => page.keyValue)).toEqual(expect.arrayContaining([
      'Are you', 'Do you', 'Can you', 'Who', 'When', 'How much', 'How many', 'Where', 'What', 'Why',
    ]))
    const areYou = pages.find(page => page.keyValue === 'Are you')
    expect(areYou?.words.map(word => word.text)).toEqual(expect.arrayContaining(['Are you OK?', 'Are you ready?']))
    expect(pages.every(page => page.words.length >= 4)).toBe(true)
    expect(pages.flatMap(page => page.words).every(word => word.explains.trim())).toBe(true)
  })

  it('每个学习页都有构词/演变说明，关键派生词带词条备注、例句和记忆点', () => {
    const pages = WORDBOOK_SAMPLES.flatMap(book => book.chapters.flatMap(chapter => chapter.pages))
    const patternPages = new Set((WORDBOOK_SAMPLES.find(book => book.name === '固定句式')?.chapters || [])
      .flatMap(chapter => chapter.pages))
    for (const page of pages) {
      expect(page.note?.trim(), `${page.keyValue} 缺少页面说明`).toBeTruthy()
    }
    const words = pages.flatMap(page => page.words)
    for (const page of pages) {
      if (patternPages.has(page)) continue
      for (const word of page.words) {
        expect(word.examples?.length, `${word.text} 缺少例句`).toBeGreaterThan(0)
      }
    }
    const interaction = words.find(word => word.text === 'interaction')
    expect(interaction?.note).toContain('interact')
    expect(interaction?.examples?.[0]?.english).toContain('Online')
    expect(interaction?.memoryTip).toContain('interact')
    expect(words.find(word => word.text === 'transportation')?.note).toContain('transport')
    expect(words.find(word => word.text === 'internet')?.note).toContain('inter-')
  })

  it('interact 派生页紧跟在 inter 页之后', () => {
    const prefixChapter = WORDBOOK_SAMPLES
      .flatMap(book => book.chapters)
      .find(chapter => chapter.name === '常用前缀')!
    const interIndex = prefixChapter.pages.findIndex(page => page.keyValue === 'inter')
    expect(interIndex).toBeGreaterThanOrEqual(0)
    expect(prefixChapter.pages[interIndex + 1].keyValue).toBe('interact')
    expect(prefixChapter.pages[interIndex + 1].keyType).toBe('text')
  })
})
