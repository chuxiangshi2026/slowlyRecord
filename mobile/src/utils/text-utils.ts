/**
 * 移动端文本规范化工具
 *
 * 与桌面 src/utils/text-utils.ts 中的 normalizeItemText/getItemKey 在语义上等价：
 * - 去掉首尾空格、折叠中间空白
 * - 大小写不敏感的去重键
 *
 * 出于移动端构建限制（UniApp 不能直接 import 桌面端代码），这里维护一份独立实现。
 */

export function normalizeWordText(text: string): string {
  return (text || '').trim().replace(/\s+/g, ' ')
}

export function getWordKey(text: string): string {
  return normalizeWordText(text).toLowerCase()
}
