import { describe, it, expect } from 'vitest'
import {
  getRecommendedImages,
  getNumberKeyword,
  getAllPresetNumbers,
  shuffleArray,
  getRandomNumbers,
  presetImageMap
} from './number-memory-preset'

describe('number-memory-preset', () => {
  describe('presetImageMap', () => {
    it('应该包含 0-99 共 100 个数字的编码', () => {
      for (let i = 0; i <= 99; i++) {
        expect(presetImageMap[i]).toBeDefined()
        expect(presetImageMap[i].keyword).toBeTruthy()
        expect(presetImageMap[i].suggestions).toBeInstanceOf(Array)
        expect(presetImageMap[i].suggestions.length).toBeGreaterThan(0)
      }
    })

    it('每个数字的推荐图片应包含必要字段', () => {
      for (let i = 0; i <= 99; i++) {
        for (const suggestion of presetImageMap[i].suggestions) {
          expect(suggestion.name).toBeTruthy()
          expect(suggestion.url).toBeTruthy()
          expect(suggestion.description).toBeTruthy()
        }
      }
    })

    // ---- 数据质量回归（2026-09 修复） ----
    it('所有建议 url 不含截断的零宽连接符（ZWJ 结尾）', () => {
      for (let i = 0; i <= 99; i++) {
        for (const suggestion of presetImageMap[i].suggestions) {
          expect(suggestion.url.endsWith('\u200d')).toBe(false)
        }
      }
    })

    it('所有建议 url 均为 emoji（非纯 ASCII 文本）', () => {
      for (let i = 0; i <= 99; i++) {
        for (const suggestion of presetImageMap[i].suggestions) {
          expect(/^[\x20-\x7E]+$/.test(suggestion.url)).toBe(false)
        }
      }
    })

    it('同一数字的建议 url 互不重复', () => {
      for (let i = 0; i <= 99; i++) {
        const urls = presetImageMap[i].suggestions.map(s => s.url)
        expect(new Set(urls).size).toBe(urls.length)
      }
    })

    it('数字 4 的 keyword 无英文残留', () => {
      expect(getNumberKeyword(4)).toBe('寺/旗/蛇/帆')
      expect(presetImageMap[4].keyword).not.toMatch(/[a-zA-Z]/)
    })

    it('修复替换的 emoji 在全表建议中仅出现一次', () => {
      const allUrls = Object.values(presetImageMap).flatMap(p => p.suggestions.map(s => s.url))
      for (const emoji of ['🤱', '🪿', '🛡️', '📜', '🗻', '🌅', '👕', '♾️', '🧧', '🌌', '🧑‍⚖️', '👨‍👦']) {
        expect(allUrls.filter(u => u === emoji)).toHaveLength(1)
      }
    })
  })

  describe('getRecommendedImages', () => {
    it('应该返回 0-99 范围内数字的推荐图片', () => {
      const result = getRecommendedImages(0)
      expect(result).toBeInstanceOf(Array)
      expect(result.length).toBeGreaterThan(0)
    })

    it('应该返回数字 5 的推荐图片', () => {
      const result = getRecommendedImages(5)
      expect(result).toEqual(presetImageMap[5].suggestions)
    })

    it('应该返回数字 99 的推荐图片', () => {
      const result = getRecommendedImages(99)
      expect(result).toEqual(presetImageMap[99].suggestions)
    })

    it('数字 -1 应该返回空数组', () => {
      expect(getRecommendedImages(-1)).toEqual([])
    })

    it('数字 100 应该返回空数组', () => {
      expect(getRecommendedImages(100)).toEqual([])
    })

    it('数字 200 应该返回空数组', () => {
      expect(getRecommendedImages(200)).toEqual([])
    })

    it('数字 -100 应该返回空数组', () => {
      expect(getRecommendedImages(-100)).toEqual([])
    })

    it('边界值 0 应返回有效数据', () => {
      const result = getRecommendedImages(0)
      expect(result.length).toBeGreaterThan(0)
    })

    it('边界值 99 应返回有效数据', () => {
      const result = getRecommendedImages(99)
      expect(result.length).toBeGreaterThan(0)
    })
  })

  describe('getNumberKeyword', () => {
    it('应该返回 0-99 范围内数字的关键词', () => {
      const result = getNumberKeyword(0)
      expect(result).toBe('铃/球/蛋/洞')
    })

    it('应该返回数字 5 的关键词', () => {
      const result = getNumberKeyword(5)
      expect(result).toBe('舞/虎/钩/屋')
    })

    it('应该返回数字 99 的关键词', () => {
      const result = getNumberKeyword(99)
      expect(result).toBe('久久/舅舅/酒酒')
    })

    it('数字 -1 应该返回空字符串', () => {
      expect(getNumberKeyword(-1)).toBe('')
    })

    it('数字 100 应该返回空字符串', () => {
      expect(getNumberKeyword(100)).toBe('')
    })

    it('数字 200 应该返回空字符串', () => {
      expect(getNumberKeyword(200)).toBe('')
    })
  })

  describe('getAllPresetNumbers', () => {
    it('默认参数 (all) 应返回 0-99 共 100 个数字', () => {
      const result = getAllPresetNumbers()
      expect(result).toHaveLength(100)
      expect(result[0]).toBe(0)
      expect(result[99]).toBe(99)
    })

    it('range 为 all 应返回 0-99 共 100 个数字', () => {
      const result = getAllPresetNumbers('all')
      expect(result).toHaveLength(100)
      expect(result[0]).toBe(0)
      expect(result[99]).toBe(99)
    })

    it('range 为 single 应返回 0-9 共 10 个数字', () => {
      const result = getAllPresetNumbers('single')
      expect(result).toHaveLength(10)
      expect(result).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9])
    })

    it('range 为 double 应返回 10-99 共 90 个数字', () => {
      const result = getAllPresetNumbers('double')
      expect(result).toHaveLength(90)
      expect(result[0]).toBe(10)
      expect(result[89]).toBe(99)
    })
  })

  describe('shuffleArray', () => {
    it('应该保持数组长度不变', () => {
      const arr = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      const result = shuffleArray(arr)
      expect(result).toHaveLength(arr.length)
    })

    it('应该保持数组元素不变（只改变顺序）', () => {
      const arr = [1, 2, 3, 4, 5]
      const result = shuffleArray(arr)
      const sorted = [...result].sort((a, b) => a - b)
      expect(sorted).toEqual(arr)
    })

    it('不应该修改原数组', () => {
      const arr = [1, 2, 3, 4, 5]
      const originalArr = [...arr]
      shuffleArray(arr)
      expect(arr).toEqual(originalArr)
    })

    it('空数组应返回空数组', () => {
      const result = shuffleArray([])
      expect(result).toEqual([])
    })

    it('单元素数组应返回相同元素的数组', () => {
      const result = shuffleArray([42])
      expect(result).toEqual([42])
    })

    it('应该能处理字符串数组', () => {
      const arr = ['a', 'b', 'c', 'd', 'e']
      const result = shuffleArray(arr)
      expect(result).toHaveLength(5)
      const sorted = [...result].sort()
      expect(sorted).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    it('应该能处理对象数组', () => {
      const arr = [{ id: 1 }, { id: 2 }, { id: 3 }]
      const result = shuffleArray(arr)
      expect(result).toHaveLength(3)
      const ids = result.map(item => item.id).sort()
      expect(ids).toEqual([1, 2, 3])
    })
  })

  describe('getRandomNumbers', () => {
    it('应该返回指定数量的数字', () => {
      const result = getRandomNumbers(5)
      expect(result).toHaveLength(5)
    })

    it('返回的数字不应重复', () => {
      const result = getRandomNumbers(20)
      const uniqueSet = new Set(result)
      expect(uniqueSet.size).toBe(result.length)
    })

    it('请求数量超过总数量时应返回全部数字', () => {
      const result = getRandomNumbers(200, 'all')
      expect(result).toHaveLength(100)
    })

    it('请求数量为 0 应返回空数组', () => {
      const result = getRandomNumbers(0)
      expect(result).toEqual([])
    })

    it('使用 single 范围应只返回 0-9 的数字', () => {
      const result = getRandomNumbers(10, 'single')
      expect(result).toHaveLength(10)
      result.forEach(num => {
        expect(num).toBeGreaterThanOrEqual(0)
        expect(num).toBeLessThanOrEqual(9)
      })
    })

    it('使用 double 范围应只返回 10-99 的数字', () => {
      const result = getRandomNumbers(10, 'double')
      result.forEach(num => {
        expect(num).toBeGreaterThanOrEqual(10)
        expect(num).toBeLessThanOrEqual(99)
      })
    })

    it('使用 all 范围应返回 0-99 的数字', () => {
      const result = getRandomNumbers(10, 'all')
      result.forEach(num => {
        expect(num).toBeGreaterThanOrEqual(0)
        expect(num).toBeLessThanOrEqual(99)
      })
    })
  })
})
