/**
 * 首页「快速入口」可配置注册表
 * 宫格按用户选择的子集展示（uni storage 持久化），展示顺序固定为注册表顺序；
 * 「全部功能」固定在宫格末尾，不在注册表内也不可取消。
 */
import { WORD_BOOK_ENABLED } from '@/utils/feature-flags'

export interface QuickEntry {
  id: string
  icon: string
  /** action-icon 配色类（index.vue 样式） */
  cls: string
  text: string
  url: string
}

const ALL_ENTRIES: QuickEntry[] = [
  { id: 'dictation', icon: '✏️', cls: 'dictation', text: '拼写练习', url: '/subPackages/pages-tools/dictation/dictation' },
  { id: 'translate', icon: '🌐', cls: 'translate', text: '翻译取词', url: '/subPackages/pages-tools/translate/translate' },
  { id: 'text', icon: '📜', cls: 'text', text: '文本记忆', url: '/subPackages/pages-memory/text-memory/text-memory' },
  { id: 'number', icon: '🔢', cls: 'memory', text: '数字记忆', url: '/subPackages/pages-memory/number-memory/number-memory' },
  { id: 'phonetic', icon: '🔤', cls: 'phonetic', text: '音标学习', url: '/subPackages/pages-memory/phonetic-memory/phonetic-memory' },
  { id: 'phonics', icon: '🧩', cls: 'phonics', text: '自然拼读', url: '/subPackages/pages-memory/phonics/phonics' },
  { id: 'letter', icon: '🔡', cls: 'letter', text: '字母映射', url: '/subPackages/pages-memory/letter-memory/letter-memory' },
  { id: 'speak', icon: '🗣️', cls: 'speak', text: '口语翻译', url: '/subPackages/pages-tools/speak/speak' },
  { id: 'focus', icon: '🌙', cls: 'focus', text: '专注模式', url: '/subPackages/pages-tools/focus/focus' },
  { id: 'addword', icon: '➕', cls: 'addword', text: '添加单词', url: '/subPackages/pages-tools/add-word/add-word' },
  { id: 'sentences', icon: '💬', cls: 'sentences', text: '句子收藏', url: '/subPackages/pages-memory/sentences/sentences' },
  { id: 'palace', icon: '🏛️', cls: 'palace', text: '记忆宫殿', url: '/subPackages/pages-memory/memory-palace/list' },
  { id: 'knowledge', icon: '📖', cls: 'knowledge', text: '知识库', url: '/subPackages/pages-knowledge/knowledge-list' },
  { id: 'memorytest', icon: '🧠', cls: 'memorytest', text: '记忆测试', url: '/subPackages/pages-memory/memory-test/memory-test' },
  { id: 'grapher', icon: '📈', cls: 'grapher', text: '函数图像', url: '/subPackages/pages-tools/function-graph/function-graph' },
  // 词集与「全部功能」页保持同一开关
  ...(WORD_BOOK_ENABLED
    ? [{ id: 'wordbook', icon: '🗺️', cls: 'wordbook', text: '词集', url: '/subPackages/pages-memory/word-book/list' } as QuickEntry]
    : []),
]

export const QUICK_ENTRIES: QuickEntry[] = ALL_ENTRIES

/** 默认展示项（与可配置化之前的首页宫格一致） */
export const DEFAULT_QUICK_ENTRY_IDS = ['dictation', 'translate', 'text', 'number', 'phonetic', 'phonics', 'letter', 'addword']

const STORAGE_KEY = 'home-quick-entries'

/**
 * 读取用户选择的快速入口 id 列表。
 * 从未设置过（无存储）回退默认 8 项；设置过则尊重选择（可为空数组，此时宫格只剩「全部功能」）；
 * 已下线/不存在的 id 自动过滤。
 */
export function loadQuickEntryIds(): string[] {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw === '' || raw === null || raw === undefined) return [...DEFAULT_QUICK_ENTRY_IDS]
    if (!Array.isArray(raw)) return [...DEFAULT_QUICK_ENTRY_IDS]
    return (raw as unknown[]).filter((id): id is string => typeof id === 'string' && QUICK_ENTRIES.some((e) => e.id === id))
  } catch {
    return [...DEFAULT_QUICK_ENTRY_IDS]
  }
}

export function saveQuickEntryIds(ids: string[]): void {
  try {
    uni.setStorageSync(STORAGE_KEY, ids)
  } catch { /* 存储失败不影响本次使用 */ }
}
