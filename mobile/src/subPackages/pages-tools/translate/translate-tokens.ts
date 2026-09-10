/**
 * 翻译页 OCR 词条批量入库的纯逻辑（不依赖 uni API，可单测）
 */

import { getWordKey } from '../../../utils/text-utils'

/** 词条选中态 key 集合：默认全选，key 为 getWordKey 规范化小写 */
export function defaultSelectedTokens(tokens: string[]): Set<string> {
  return new Set(tokens.map(t => getWordKey(t)))
}

/** 切换某个词条的选中态，返回新集合（不改原集合，保证响应式触发） */
export function toggleTokenSelection(selected: Set<string>, token: string): Set<string> {
  const key = getWordKey(token)
  const next = new Set(selected)
  if (next.has(key)) {
    next.delete(key)
  } else {
    next.add(key)
  }
  return next
}

/** 从词条列表中筛出当前选中的词条（保持原顺序，用于批量加入） */
export function selectedTokenList(tokens: string[], selected: Set<string>): string[] {
  return tokens.filter(t => selected.has(getWordKey(t)))
}

/** 批量加入词库的结果汇总文案 */
export function summarizeBatchAdd(added: number, duplicated: number, failed: number): string {
  if (failed > 0) {
    return `已加入 ${added} 个，${duplicated} 个已在词库，${failed} 个失败`
  }
  return `已加入 ${added} 个，${duplicated} 个已在词库`
}
