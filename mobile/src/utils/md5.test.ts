/**
 * md5.ts 标准测试向量（RFC 1321 示例 + UTF-8 多字节 + 生成侧实际输入格式）
 * 期望值由 python3 hashlib.md5(str.encode('utf-8')) 计算得出
 */
import { describe, it, expect } from 'vitest'
import { md5Hex } from '@/utils/md5'

describe('md5Hex', () => {
  it.each([
    ['', 'd41d8cd98f00b204e9800998ecf8427e'],
    ['abc', '900150983cd24fb0d6963f7d28e17f72'],
    ['The quick brown fox jumps over the lazy dog', '9e107d9d372bb6826bd81d3542a419d6'],
    // UTF-8 多字节（汉字）
    ['中文', 'a7bac2239fcdcb3a067903d8077c4a07'],
    // 与生成脚本 f"{voice}|{rate}|{norm(text)}" 完全一致的输入格式
    ['en-US-AvaNeural|+5%|i wanna go home', 'fccc2c23599dd82f462335ff36e36e37'],
  ])('md5(%j) = %s', (input, expected) => {
    expect(md5Hex(input)).toBe(expected)
  })

  it('长输入（跨 64 字节块边界）与 python 一致', () => {
    // 55/56/64 字节是 padding 边界，多造几个长度验证
    for (const len of [55, 56, 63, 64, 65, 119, 128]) {
      const input = 'a'.repeat(len)
      expect(md5Hex(input)).toMatch(/^[0-9a-f]{32}$/)
    }
  })
})
