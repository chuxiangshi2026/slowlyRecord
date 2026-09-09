/**
 * wrong-words-session 纯逻辑测试：快照遍历、"已掌握"不破坏索引、本轮统计
 */
import { describe, it, expect } from 'vitest'
import {
  createWrongWordsSession,
  currentId,
  isDone,
  markMastered,
  markForgotten,
  isPending,
  sessionStats
} from './wrong-words-session'

const words = [{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }]

describe('wrong-words-session 快照遍历', () => {
  it('初始状态：指向快照第一项，未完成', () => {
    const s = createWrongWordsSession(words)
    expect(currentId(s)).toBe('a')
    expect(isDone(s)).toBe(false)
    expect(sessionStats(s)).toEqual({ total: 4, mastered: 0, stillWeak: 4 })
  })

  it('已掌握的词从剩余待处理移除，但遍历索引不被破坏（不跳词）', () => {
    const s = createWrongWordsSession(words)
    // 掌握 a，正常走到 b
    markMastered(s)
    expect(currentId(s)).toBe('b')
    expect(isPending(s, 'a')).toBe(false)
    expect(isPending(s, 'b')).toBe(true)
    // 掌握 b，走到 c
    markMastered(s)
    expect(currentId(s)).toBe('c')
    // 还是不会 c，走到 d
    markForgotten(s)
    expect(currentId(s)).toBe('d')
    // 掌握 d，本轮结束
    markMastered(s)
    expect(isDone(s)).toBe(true)
    expect(currentId(s)).toBeNull()
  })

  it('连续掌握多张卡片不会出现跳词或空卡片', () => {
    const s = createWrongWordsSession(words)
    const visited: (string | null)[] = []
    while (!isDone(s)) {
      visited.push(currentId(s))
      markMastered(s)
    }
    expect(visited).toEqual(['a', 'b', 'c', 'd'])
  })

  it('同一词重复标记掌握只计一次（幂等）', () => {
    const s = createWrongWordsSession(words)
    markMastered(s)
    // 人为回退模拟重复触发
    s.pos = 0
    markMastered(s)
    expect(s.masteredCount).toBe(1)
    expect(s.masteredIds).toEqual(['a'])
  })

  it('完成后统计：本轮 M 条 · 掌握 X · 仍需巩固 Y', () => {
    const s = createWrongWordsSession(words)
    markMastered(s)   // a 掌握
    markForgotten(s)  // b 还是不会
    markMastered(s)   // c 掌握
    markForgotten(s)  // d 还是不会
    expect(isDone(s)).toBe(true)
    expect(sessionStats(s)).toEqual({ total: 4, mastered: 2, stillWeak: 2 })
    expect(s.forgottenCount).toBe(2)
  })

  it('完成后继续标记是安全的空操作', () => {
    const s = createWrongWordsSession([{ id: 'a' }])
    markMastered(s)
    expect(isDone(s)).toBe(true)
    markMastered(s)
    markForgotten(s)
    expect(s.masteredCount).toBe(1)
    expect(s.forgottenCount).toBe(0)
  })

  it('空快照直接判定完成', () => {
    const s = createWrongWordsSession([])
    expect(isDone(s)).toBe(true)
    expect(sessionStats(s)).toEqual({ total: 0, mastered: 0, stillWeak: 0 })
  })
})
