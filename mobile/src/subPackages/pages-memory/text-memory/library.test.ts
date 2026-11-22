/**
 * 内置诗词回填匹配测试（旧导入文章无 pinyin 字段时的运行时回填）
 */
import { describe, it, expect } from 'vitest'
import { findBuiltinPoem } from './library'

describe('findBuiltinPoem', () => {
  it('按标题+正文匹配到内置诗并带回拼音', async () => {
    const poem = await findBuiltinPoem('静夜思', '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。', '唐')
    expect(poem).toBeDefined()
    expect(poem!.author).toBe('李白')
    expect(poem!.pinyin).toContain('chuáng qián míng yuè guāng')
  })

  it('正文空白差异（换行/空格变化）仍能匹配', async () => {
    const poem = await findBuiltinPoem('静夜思', '床前明月光，疑是地上霜。 举头望明月，低头思故乡。', '唐')
    expect(poem).toBeDefined()
  })

  it('朝代不符时全库兜底仍能匹配', async () => {
    const poem = await findBuiltinPoem('静夜思', '床前明月光，疑是地上霜。\n举头望明月，低头思故乡。', '宋')
    expect(poem).toBeDefined()
  })

  it('标题或正文不匹配（自建/改过）返回 undefined', async () => {
    expect(await findBuiltinPoem('静夜思', '我改过的内容', '唐')).toBeUndefined()
    expect(await findBuiltinPoem('不存在的诗', '床前明月光', '唐')).toBeUndefined()
  })

  it('空标题/空正文直接返回 undefined', async () => {
    expect(await findBuiltinPoem('', '床前明月光')).toBeUndefined()
    expect(await findBuiltinPoem('静夜思', '')).toBeUndefined()
  })
})
