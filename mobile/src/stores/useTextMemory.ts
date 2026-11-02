import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type {
  MobileTextArticle,
  MobileTextNote,
  MobileTextPrompt,
  MobileTextMemory,
} from './useUtils/types'
import { parseLocation } from '../utils/poetry-location'
import {
  isPracticeDue,
  scheduleOnRemembered,
  scheduleOnForgotten,
} from '../utils/practice-srs'
import { filterByTombstones, recordTombstones } from './useUtils/sync-tombstone'

/**
 * 文本记忆 store（移动端）
 *
 * 持久化策略：
 * - 与桌面端共用 wire format（字段名一致），通过 wx.Storage 单 key 存放
 * - 单 key 命名 `slowlyrecord-textmemory-data`，与桌面端 TEXTMEMORY_DOC_ID 对齐
 *
 * 已实现：列表/添加/编辑/删除文章 + 内置库导入 + 批量粘贴 + 导入页地图 Tab(标点/作者生平路线)
 *          + 遮挡回忆自测（recall.vue，自评接轻量复习调度 level/nextReview）
 * 不实现：跟打/填空/选择题/文件导入/AI 搜索
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

/**
 * 为文章补全 geo 字段（如果缺失且能解析出来）
 * 不可变操作：返回新对象，原文章不变
 */
function enrichGeo(article: MobileTextArticle): MobileTextArticle {
  if (article.geo) return article
  let coord = parseLocation(article.location)
  if (!coord && article.title) coord = parseLocation(article.title)
  if (!coord) return article
  return {
    ...article,
    geo: { lng: coord.lng, lat: coord.lat, name: coord.name },
  }
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

  /** 到期待复习的文章列表（按到期时间升序） */
  const dueArticles = computed(() =>
    articles.value
      .filter((a) => isPracticeDue(a.nextReview))
      .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0)),
  )

  /** 到期待复习篇数（首页今日任务区等展示用） */
  const dueArticleCount = computed(() => dueArticles.value.length)

  /** 单篇文章是否到期待复习 */
  function isArticleDue(article: MobileTextArticle): boolean {
    return isPracticeDue(article.nextReview)
  }

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
      // 加载时为缺少 geo 的旧数据补全（一次性迁移）
      let needPersist = false
      const enriched = doc.articles.map((a) => {
        const next = enrichGeo(a)
        if (next !== a) needPersist = true
        return next
      })
      articles.value = enriched
      notes.value = doc.notes
      prompts.value = doc.prompts
      if (needPersist) persist()
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
    const article: MobileTextArticle = enrichGeo({
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
    })
    articles.value.unshift(article)
    persist()
    return article
  }

  function addArticles(inputs: Array<Partial<MobileTextArticle> & { title: string; content: string }>) {
    const now = Date.now()
    const created: MobileTextArticle[] = inputs.map((input, idx) =>
      enrichGeo({
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
      }),
    )
    articles.value = [...created, ...articles.value]
    persist()
    return created
  }

  function updateArticle(id: string, patch: Partial<MobileTextArticle>) {
    const idx = articles.value.findIndex((a) => a._id === id)
    if (idx < 0) return false
    const prev = articles.value[idx]
    const merged: MobileTextArticle = {
      ...prev,
      ...patch,
      _id: prev._id,
      ctime: prev.ctime,
      utime: Date.now(),
    }
    // 如果 location 或 title 发生变化，丢弃旧 geo 重新解析
    const locationChanged = patch.location !== undefined && patch.location !== prev.location
    const titleChanged = patch.title !== undefined && patch.title !== prev.title
    if (locationChanged || titleChanged) {
      delete merged.geo
    }
    articles.value[idx] = enrichGeo(merged)
    persist()
    return true
  }

  function deleteArticle(id: string) {
    const before = articles.value.length
    // 同步墓碑：文章及其级联删除的笔记/提示词一并埋点，防止另一端推送时「删除复活」
    const cascadeIds = [
      id,
      ...notes.value.filter((n) => n.articleId === id).map((n) => n._id),
      ...prompts.value.filter((p) => p.articleId === id).map((p) => p._id),
    ]
    articles.value = articles.value.filter((a) => a._id !== id)
    notes.value = notes.value.filter((n) => n.articleId !== id)
    prompts.value = prompts.value.filter((p) => p.articleId !== id)
    if (articles.value.length !== before) {
      recordTombstones(cascadeIds)
      persist()
    }
    return articles.value.length !== before
  }

  /**
   * 遮挡回忆自评结果落库：更新复习调度（level / nextReview）与统计
   * remembered=true 表示「记住了」，false 表示「还没记住」
   */
  function rateArticle(id: string, remembered: boolean, now: number = Date.now()) {
    const idx = articles.value.findIndex((a) => a._id === id)
    if (idx < 0) return false
    const prev = articles.value[idx]
    const schedule = remembered
      ? scheduleOnRemembered(prev.level, now)
      : scheduleOnForgotten(prev.level, now)
    articles.value[idx] = {
      ...prev,
      level: schedule.level,
      nextReview: schedule.nextReview,
      lastReviewTime: now,
      reviewCount: (prev.reviewCount || 0) + 1,
    }
    persist()
    return true
  }

  // ===== 笔记 / 提示词（最小实现，暂不开放 UI 也保持数据完整） =====

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
    if (notes.value.length !== before) {
      // 同步墓碑：防止被删笔记在另一台设备「删除复活」
      recordTombstones([noteId])
      persist()
    }
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
    if (prompts.value.length !== before) {
      // 同步墓碑：防止被删提示词在另一台设备「删除复活」
      recordTombstones([id])
      persist()
    }
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
   * 从同步包恢复：先按墓碑清理本地，再按时间戳合并较新内容。
   * 旧数据无 utime 时回退 ctime；远端较旧不会覆盖本地。
   */
  function restore(
    data: MobileTextMemory,
    mode: 'merge' | 'replace' = 'merge',
    tombstones: Record<string, number> = {},
  ) {
    if (!data) return { added: 0, updated: 0, replaced: 0 }
    if (mode === 'replace') {
      const safe = (list: any[]) => filterByTombstones(list, 'remote', tombstones)
      articles.value = safe(data.articles || []).map(enrichGeo)
      notes.value = safe(data.notes || [])
      prompts.value = safe(data.prompts || [])
      persist()
      return {
        added: articles.value.length,
        updated: 0,
        replaced: articles.value.length,
        addedArticles: articles.value.length,
        updatedArticles: 0,
        addedNotes: notes.value.length,
        updatedNotes: 0,
        addedPrompts: prompts.value.length,
        updatedPrompts: 0,
      }
    }

    let added = 0
    let updated = 0
    const mergeList = <T extends { _id: string; _rev?: string; utime?: number; ctime?: number; updatedAt?: number }>(
      local: T[],
      remote: T[],
    ): T[] => {
      const cleanedLocal = filterByTombstones(local, 'remote', tombstones)
      const map = new Map(cleanedLocal.map(item => [item._id, item]))
      const timeOf = (item: T) => item.utime || item.updatedAt || item.ctime || 0
      for (const item of filterByTombstones(remote, 'remote', tombstones)) {
        if (!item?._id) continue
        const current = map.get(item._id)
        if (!current) {
          map.set(item._id, item)
          added++
        } else if (timeOf(item) > timeOf(current)) {
          const { _rev, ...clean } = item as any
          map.set(item._id, {
            ...current,
            ...clean,
            ...(current._rev ? { _rev: current._rev } : {}),
          } as T)
          updated++
        }
      }
      return Array.from(map.values())
    }

    const countBefore = () => ({ added, updated })
    const articleBefore = countBefore()
    const nextArticles = mergeList(articles.value, data.articles || []).map(enrichGeo)
    const articleStats = { added: added - articleBefore.added, updated: updated - articleBefore.updated }
    const noteBefore = countBefore()
    const nextNotes = mergeList(notes.value, data.notes || [])
    const noteStats = { added: added - noteBefore.added, updated: updated - noteBefore.updated }
    const promptBefore = countBefore()
    const nextPrompts = mergeList(prompts.value, data.prompts || [])
    const promptStats = { added: added - promptBefore.added, updated: updated - promptBefore.updated }

    const changed = added > 0 || updated > 0 ||
      nextArticles.length !== articles.value.length ||
      nextNotes.length !== notes.value.length ||
      nextPrompts.length !== prompts.value.length
    articles.value = nextArticles
    notes.value = nextNotes
    prompts.value = nextPrompts
    if (changed) persist()
    return {
      added: articleStats.added,
      updated: articleStats.updated,
      replaced: 0,
      addedArticles: articleStats.added,
      updatedArticles: articleStats.updated,
      addedNotes: noteStats.added,
      updatedNotes: noteStats.updated,
      addedPrompts: promptStats.added,
      updatedPrompts: promptStats.updated,
    }
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
    dueArticles,
    dueArticleCount,
    isArticleDue,
    notesOf,
    promptsOf,
    // actions
    load,
    addArticle,
    addArticles,
    updateArticle,
    deleteArticle,
    rateArticle,
    addNote,
    deleteNote,
    addPrompt,
    deletePrompt,
    // sync
    collect,
    restore,
  }
})
