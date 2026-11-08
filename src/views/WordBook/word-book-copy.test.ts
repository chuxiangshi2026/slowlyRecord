import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WordBookBook } from '@/types/word-book'

const dialog = vi.hoisted(() => ({
  confirm: vi.fn(),
  prompt: vi.fn(),
  error: vi.fn(),
}))

vi.mock('element-plus', () => ({
  ElMessageBox: { confirm: dialog.confirm, prompt: dialog.prompt },
  ElMessage: { error: dialog.error },
}))

import { confirmAndCopyWordBook } from './word-book-copy'

function book(id: string, name: string, extra: Partial<WordBookBook> = {}): WordBookBook {
  return { _id: id, type: 'wb_book', name, order: 0, ctime: 1, utime: 1, ...extra }
}

describe('复制词集确认', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('已有同源副本时优先打开，不再创建', async () => {
    const source = book('sample', '示例', { isSample: true })
    const copy = book('copy', '我的示例', { copiedFromBookId: source._id, utime: 2 })
    const duplicateBook = vi.fn()
    dialog.confirm.mockResolvedValue(undefined)

    const result = await confirmAndCopyWordBook({ books: [source, copy], duplicateBook } as any, source)

    expect(result).toEqual({ book: copy, created: false })
    expect(dialog.prompt).not.toHaveBeenCalled()
    expect(duplicateBook).not.toHaveBeenCalled()
  })

  it('同名时打开已有词集，不创建重复名称', async () => {
    const source = book('sample', '示例', { isSample: true })
    const sameName = book('mine', '我的示例')
    const duplicateBook = vi.fn()
    dialog.prompt.mockResolvedValue({ value: ' 我的示例 ' })
    dialog.confirm.mockResolvedValue(undefined)

    const result = await confirmAndCopyWordBook({ books: [source, sameName], duplicateBook } as any, source)

    expect(result).toEqual({ book: sameName, created: false })
    expect(duplicateBook).not.toHaveBeenCalled()
  })

  it('确认新名称后才创建副本', async () => {
    const source = book('sample', '示例', { isSample: true })
    const copy = book('copy', '旧字母组合')
    const duplicateBook = vi.fn(async () => ({ ok: true, item: copy }))
    dialog.prompt.mockResolvedValue({ value: ' 旧字母组合 ' })

    const result = await confirmAndCopyWordBook({ books: [source], duplicateBook } as any, source)

    expect(duplicateBook).toHaveBeenCalledWith(source._id, '旧字母组合')
    expect(result).toEqual({ book: copy, created: true })
  })
})
