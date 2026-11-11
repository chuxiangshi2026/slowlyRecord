import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

interface ScreenWord {
  word: string
  explains: string
  freq: number
}

const BANKS = [
  { id: 'girl-meets-world', name: '女孩成长记词汇' },
  { id: 'friends-tv', name: '老友记词汇' },
  { id: 'modern-family', name: '摩登家庭词汇' },
  { id: 'big-bang-theory', name: '生活大爆炸词汇' },
  { id: 'sherlock', name: '神探夏洛克词汇' },
  { id: 'the-crown', name: '王冠词汇' },
  { id: 'pursuit-of-happyness', name: '当幸福来敲门词汇' },
  { id: 'forrest-gump', name: '阿甘正传词汇' },
  { id: 'shawshank-redemption', name: '肖申克的救赎词汇' },
]

const readJson = (file: string): any => JSON.parse(readFileSync(resolve(process.cwd(), file), 'utf8'))

describe('影视单库词库', () => {
  const banks = BANKS.map(bank => {
    const desktop: ScreenWord[] = readJson(`public/wordbanks/${bank.id}.json`)
    const mobile: ScreenWord[] = readJson(`mobile/wordbank-json/${bank.id}.json`)
    return { ...bank, desktop, mobile }
  })

  it('每个作品一个词库，双端一致且各 50 词', () => {
    expect(banks).toHaveLength(9)
    for (const bank of banks) {
      expect(bank.mobile, bank.id).toEqual(bank.desktop)
      expect(bank.desktop, bank.id).toHaveLength(50)
      bank.desktop.forEach((item, index) => {
        expect(item.word.trim(), bank.id).toBeTruthy()
        expect(item.explains.trim(), bank.id).toBeTruthy()
        expect(item.freq, bank.id).toBe(index + 1)
      })
    }
  })

  it('词条是单词或连字符词，不含台词或短语句子', () => {
    for (const bank of banks) {
      for (const item of bank.desktop) {
        expect(item.word, bank.id).not.toContain('?')
        expect(item.word.trim().split(/\s+/), `${bank.id}/${item.word}`).toHaveLength(1)
      }
    }
  })

  it('每库按入门、进阶、高阶递增，共 450 个不重复词', () => {
    const allWords = new Set<string>()
    for (const bank of banks) {
      const levels = bank.desktop.map(item => {
        const level = ['入门', '进阶', '高阶'].find(value => item.explains.includes(`（${value}高频）`))
        expect(level, `${bank.id}/${item.word}`).toBeTruthy()
        return ['入门', '进阶', '高阶'].indexOf(level!)
      })
      expect(levels.filter(level => level === 0)).toHaveLength(17)
      expect(levels.filter(level => level === 1)).toHaveLength(19)
      expect(levels.filter(level => level === 2)).toHaveLength(14)
      levels.forEach((level, index) => {
        if (index > 0) expect(level, bank.id).toBeGreaterThanOrEqual(levels[index - 1])
      })
      for (const item of bank.desktop) {
        const key = item.word.toLowerCase()
        expect(allWords.has(key), `重复词：${item.word}`).toBe(false)
        allWords.add(key)
      }
    }
    expect(allWords.size).toBe(450)
  })

  it('远程清单包含 9 个单库，不再包含旧合并库', () => {
    const index = readJson('mobile/wordbank-json/index.json')
    expect(index).not.toEqual(expect.arrayContaining([expect.objectContaining({ id: 'movie-tv-vocab' })]))
    for (const bank of BANKS) {
      expect(index).toEqual(expect.arrayContaining([
        expect.objectContaining({ id: bank.id, name: bank.name, wordCount: 50 }),
      ]))
    }
  })
})
