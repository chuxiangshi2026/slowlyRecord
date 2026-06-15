import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  MobileTextArticle,
  MobileTextNote,
  MobileTextPrompt,
  MobileTextMemory,
} from './useUtils/types'

/**
 * 文本记忆 store（移动端）
 *
 * 持久化策略：
 * - 与桌面端共用 wire format（字段名一致），通过 wx.Storage 单 key 存放
 * - 单 key 命名 `slowlyrecord-textmemory-data`，与桌面端 TEXTMEMORY_DOC_ID 对齐
 *
 * 第一阶段功能：列表/添加/编辑/删除文章 + 内置库导入 + 批量粘贴
 * 不实现：跟打/填空/选择题/地图/文件导入/AI 搜索
 */

const STORAGE_KEY = 'slowlyrecord-textmemory-data'

interface TextMemoryDoc {
  articles: MobileTextArticle[]
  notes: MobileTextNote[]
  prompts: MobileTextPrompt[]
  updatedAt: number
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function readDoc(): TextMemoryDoc {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object') {
      return {
        articles: Array.isArray(raw.articles) ? raw.articles : [],
        notes: Array.isArray(raw.notes) ? raw.notes : [],
        prompts: Array.isArray(raw.prompts) ? raw.prompts : [],
        updatedAt: raw.updatedAt || 0,
      }
    }
  } catch {
    /* 读取失败兜底 */
  }
  return { articles: [], notes: [], prompts: [], updatedAt: 0 }
}

function writeDoc(doc: TextMemoryDoc) {
  doc.updatedAt = Date.now()
  uni.setStorageSync(STORAGE_KEY, doc)
}

export const useTextMemory = defineStore('mobileTextMemory', () => {
  const articles = ref<MobileTextArticle[]>([])
  const notes = ref<MobileTextNote[]>([])
  const prompts = ref<MobileTextPrompt[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  // ===== Getters =====

  const totalArticles = computed(() => articles.value.length)

  const sortedArticles = computed(() =>
    [...articles.value].sort((a, b) => b.ctime - a.ctime),
  )

  const allTags = computed(() => {
    const set = new Set<string>()
    articles.value.forEach((a) => a.tags.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  })

  const allCategories = computed(() => {
    const set = new Set<string>()
    articles.value.forEach((a) => a.category && set.add(a.category))
    return Array.from(set)
  })

  function notesOf(articleId: string): MobileTextNote[] {
    return notes.value
      .filter((n) => n.articleId === articleId)
      .sort((a, b) => b.ctime - a.ctime)
  }

  function promptsOf(articleId: string): MobileTextPrompt[] {
    return prompts.value
      .filter((p) => p.articleId === articleId)
      .sort((a, b) => a.order - b.order)
  }

  // ===== 加载 / 持久化 =====

  function load() {
    if (initialized.value) return
    loading.value = true
    try {
      const doc = readDoc()
      articles.value = doc.articles
      notes.value = doc.notes
      prompts.value = doc.prompts
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  function persist() {
    writeDoc({
      articles: articles.value,
      notes: notes.value,
      prompts: prompts.value,
      updatedAt: Date.now(),
    })
  }

  // ===== 文章 CRUD =====

  function addArticle(input: Partial<MobileTextArticle> & { title: string; content: string }) {
    const now = Date.now()
    const article: MobileTextArticle = {
      _id: `article_${generateId()}`,
      title: input.title,
      content: input.content,
      author: input.author || '',
      source: input.source || '',
      location: input.location || '',
      dynasty: input.dynasty || '',
      category: input.category,
      year: input.year,
      tags: Array.isArray(input.tags) ? input.tags : [],
      ctime: now,
      utime: now,
      reviewCount: 0,
    }
    articles.value.unshift(article)
    persist()
    return article
  }

  function addArticles(inputs: Array<Partial<MobileTextArticle> & { title: string; content: string }>) {
    const now = Date.now()
    const created: MobileTextArticle[] = inputs.map((input, idx) => ({
      _id: `article_${generateId()}_${idx}`,
      title: input.title,
      content: input.content,
      author: input.author || '',
      source: input.source || '',
      location: input.location || '',
      dynasty: input.dynasty || '',
      category: input.category,
      year: input.year,
      tags: Array.isArray(input.tags) ? input.tags : [],
      ctime: now,
      utime: now,
      reviewCount: 0,
    }))
    articles.value = [...created, ...articles.value]
    persist()
    return created
  }

  function updateArticle(id: string, patch: Partial<MobileTextArticle>) {
    const idx = articles.value.findIndex((a) => a._id === id)
    if (idx < 0) return false
    articles.value[idx] = {
      ...articles.value[idx],
      ...patch,
      _id: articles.value[idx]._id,
      ctime: articles.value[idx].ctime,
      utime: Date.now(),
    }
    persist()
    return true
  }

  function deleteArticle(id: string) {
    const before = articles.value.length
    articles.value = articles.value.filter((a) => a._id !== id)
    notes.value = notes.value.filter((n) => n.articleId !== id)
    prompts.value = prompts.value.filter((p) => p.articleId !== id)
    if (articles.value.length !== before) persist()
    return articles.value.length !== before
  }

  // ===== 笔记 / 提示词（最小实现，第一阶段不开放 UI 也保持数据完整） =====

  function addNote(articleId: string, content: string, selectedText?: string) {
    const note: MobileTextNote = {
      _id: `note_${generateId()}`,
      articleId,
      content,
      selectedText,
      ctime: Date.now(),
    }
    notes.value.push(note)
    persist()
    return note
  }

  function deleteNote(noteId: string) {
    const before = notes.value.length
    notes.value = notes.value.filter((n) => n._id !== noteId)
    if (notes.value.length !== before) persist()
  }

  function addPrompt(articleId: string, title: string, content: string) {
    const order = promptsOf(articleId).length
    const prompt: MobileTextPrompt = {
      _id: `prompt_${generateId()}`,
      articleId,
      title,
      content,
      order,
      enabled: true,
      ctime: Date.now(),
    }
    prompts.value.push(prompt)
    persist()
    return prompt
  }

  function deletePrompt(id: string) {
    const before = prompts.value.length
    prompts.value = prompts.value.filter((p) => p._id !== id)
    if (prompts.value.length !== before) persist()
  }

  // ===== 同步辅助 =====

  /** 收集为同步格式 */
  function collect(): MobileTextMemory {
    return {
      articles: articles.value,
      notes: notes.value,
      prompts: prompts.value,
    }
  }

  /**
   * 从同步包恢复
   * 默认按 _id 合并：本地存在则跳过，远端新增则插入
   */
  function restore(data: MobileTextMemory, mode: 'merge' | 'replace' = 'merge') {
    if (!data) return { added: 0, replaced: 0 }
    if (mode === 'replace') {
      articles.value = data.articles || []
      notes.value = data.notes || []
      prompts.value = data.prompts || []
      persist()
      return { added: articles.value.length, replaced: articles.value.length }
    }

    let added = 0
    const articleIds = new Set(articles.value.map((a) => a._id))
    for (const a of data.articles || []) {
      if (!articleIds.has(a._id)) {
        articles.value.push(a)
        articleIds.add(a._id)
        added++
      }
    }
    const noteIds = new Set(notes.value.map((n) => n._id))
    for (const n of data.notes || []) {
      if (!noteIds.has(n._id)) {
        notes.value.push(n)
        noteIds.add(n._id)
      }
    }
    const promptIds = new Set(prompts.value.map((p) => p._id))
    for (const p of data.prompts || []) {
      if (!promptIds.has(p._id)) {
        prompts.value.push(p)
        promptIds.add(p._id)
      }
    }
    if (added > 0 || (data.notes?.length || 0) > 0 || (data.prompts?.length || 0) > 0) {
      persist()
    }
    return { added, replaced: 0 }
  }

  return {
    // state
    articles,
    notes,
    prompts,
    loading,
    // getters
    totalArticles,
    sortedArticles,
    allTags,
    allCategories,
    notesOf,
    promptsOf,
    // actions
    load,
    addArticle,
    addArticles,
    updateArticle,
    deleteArticle,
    addNote,
    deleteNote,
    addPrompt,
    deletePrompt,
    // sync
    collect,
    restore,
  }
})
