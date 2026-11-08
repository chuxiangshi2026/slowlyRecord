import { ElMessage, ElMessageBox } from 'element-plus'
import { useWordBookStore } from '@/stores/wordBook'
import type { WordBookBook } from '@/types/word-book'

export interface WordBookCopyResult {
  book: WordBookBook
  created: boolean
}

export async function confirmAndCopyWordBook(
  store: ReturnType<typeof useWordBookStore>,
  source: WordBookBook,
): Promise<WordBookCopyResult | null> {
  const sourceRootId = source.copiedFromBookId || source._id
  const existingCopy = store.books
    .filter(book => !book.isSample && book._id !== source._id && book.copiedFromBookId === sourceRootId)
    .sort((a, b) => b.utime - a.utime)[0]

  if (existingCopy) {
    const action = await ElMessageBox.confirm(
      `已经从「${source.name}」复制出「${existingCopy.name}」。建议打开已有副本，避免重复创建。`,
      '已有复制副本',
      {
        confirmButtonText: '打开已有副本',
        cancelButtonText: '新建副本',
        distinguishCancelAndClose: true,
        type: 'info',
      },
    ).then(() => 'open').catch(reason => reason === 'cancel' ? 'new' : 'close')
    if (action === 'open') return { book: existingCopy, created: false }
    if (action === 'close') return null
  }

  let name = ''
  try {
    const { value } = await ElMessageBox.prompt('给副本起一个容易辨认的名称', '复制词集', {
      inputValue: source.isSample ? `我的${source.name}` : `${source.name} 副本`,
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
      inputPlaceholder: '请输入词集名称',
      confirmButtonText: '创建副本',
    })
    name = String(value || '').trim()
  } catch {
    return null
  }

  const sameName = store.books.find(book => !book.isSample && book.name.trim().toLowerCase() === name.toLowerCase())
  if (sameName) {
    const openExisting = await ElMessageBox.confirm(
      `我的词集中已有「${sameName.name}」，本次不再重复创建。`,
      '同名词集已存在',
      { confirmButtonText: '打开已有词集', cancelButtonText: '取消', type: 'info' },
    ).then(() => true).catch(() => false)
    return openExisting ? { book: sameName, created: false } : null
  }

  try {
    const result = await store.duplicateBook(source._id, name)
    if (!result.ok || !result.item) {
      ElMessage.error(result.message || '复制失败')
      return null
    }
    return { book: result.item, created: true }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '复制失败')
    return null
  }
}
