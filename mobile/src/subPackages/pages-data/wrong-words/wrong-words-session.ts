/**
 * 错题本翻卡会话的纯逻辑：进入页面时对错题列表取一次快照，
 * 翻卡遍历快照，"已掌握"只把词从剩余待处理中移除，不破坏遍历索引。
 * 设计为可被 Vue reactive() 包裹的普通对象，便于组件响应式驱动与单测。
 */

export interface WrongWordsSessionState {
  /** 快照中的词 id 序列（本轮遍历顺序） */
  ids: string[]
  /** 当前遍历到的下标 */
  pos: number
  /** 已被标记"已掌握"的词 id（从剩余待处理中移除，但仍在快照统计内） */
  masteredIds: string[]
  masteredCount: number
  forgottenCount: number
}

/** 用进入页面时的错题快照创建一轮会话 */
export function createWrongWordsSession(words: { id: string }[]): WrongWordsSessionState {
  return {
    ids: words.map(w => w.id),
    pos: 0,
    masteredIds: [],
    masteredCount: 0,
    forgottenCount: 0
  }
}

/** 当前应展示的词 id；遍历完成返回 null */
export function currentId(state: WrongWordsSessionState): string | null {
  return state.ids[state.pos] ?? null
}

/** 是否已遍历完整个快照 */
export function isDone(state: WrongWordsSessionState): boolean {
  return state.pos >= state.ids.length
}

/** 标记"已掌握"：从剩余待处理中移除（视觉上卡片滑走），索引照常前进 */
export function markMastered(state: WrongWordsSessionState): void {
  const id = currentId(state)
  if (id === null) return
  if (!state.masteredIds.includes(id)) {
    state.masteredIds.push(id)
    state.masteredCount++
  }
  state.pos++
}

/** 标记"还是不会"：词仍是错题，索引前进并计入仍需巩固 */
export function markForgotten(state: WrongWordsSessionState): void {
  if (currentId(state) === null) return
  state.forgottenCount++
  state.pos++
}

/** 该词是否还在"剩余待处理"中（已掌握的词返回 false） */
export function isPending(state: WrongWordsSessionState, id: string): boolean {
  return !state.masteredIds.includes(id)
}

/** 本轮统计：M 条 · 掌握 X · 仍需巩固 Y */
export function sessionStats(state: WrongWordsSessionState): { total: number; mastered: number; stillWeak: number } {
  return {
    total: state.ids.length,
    mastered: state.masteredCount,
    stillWeak: state.ids.length - state.masteredCount
  }
}
