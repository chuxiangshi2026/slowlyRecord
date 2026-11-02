/**
 * 拆分子窗口 URL：物理文件名不能包含查询串。
 * search 不包含前导 ?，交给 Electron loadFile 的 url.format 处理。
 */
export function resolveChildWindowTarget(url) {
  const raw = String(url || '')
  const queryIndex = raw.indexOf('?')
  if (queryIndex < 0) return { filePath: raw, search: '' }
  return {
    filePath: raw.slice(0, queryIndex),
    search: raw.slice(queryIndex + 1),
  }
}
