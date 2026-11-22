/**
 * 轻量在线翻译通道选择测试（不触发网络）
 */
import { describe, it, expect } from 'vitest'
import { quickTranslateChannel } from './quick-translate'

describe('quickTranslateChannel', () => {
  it('AI 引擎走 ai 通道', () => {
    for (const p of ['glm', 'deepseek', 'qwen', 'kimi'] as const) {
      expect(quickTranslateChannel(p)).toBe('ai')
    }
  })

  it('传统机器翻译走各自通道', () => {
    expect(quickTranslateChannel('youdao')).toBe('youdao')
    expect(quickTranslateChannel('baidu')).toBe('baidu')
  })

  it('B站免密钥 AI 走独立通道', () => {
    expect(quickTranslateChannel('bilibili')).toBe('bilibili')
  })

  it('主包轻量版不支持的引擎返回 null', () => {
    expect(quickTranslateChannel('ali')).toBeNull()
    expect(quickTranslateChannel('tencent')).toBeNull()
    expect(quickTranslateChannel('ollama')).toBeNull()
  })
})
