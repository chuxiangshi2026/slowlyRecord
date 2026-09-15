import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import type { MobileSentences } from './useUtils/types'

/**
 * 句子收藏 store（移动端）
 *
 * 与桌面端共用文档 key `slowlyrecord-sentences-data`（见桌面 src/utils/sentence-db.ts），
 * 但两端同步目前都不覆盖句子库，故本 store 只做本地读写。
 * 已实现：列表/收藏切换/极简手动添加（原文+译文）；不做编辑、删除、同步。
 */

const STORAGE_KEY = 'slowlyrecord-sentences-data'

export interface MobileSentence {
  id: string
  text: string
  translation?: string
  lang: 'zh' | 'en' | 'other'
  tags: string[]
  note?: string
  source?: string
  favorite: boolean
  createdAt: number
}

interface SentencesDoc {
  sentences: MobileSentence[]
  updatedAt: number
}

function generateId(): string {
  return `sent_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 简单语言判定：含中文 → zh，否则按字母比例判 en/other */
function detectLang(text: string): MobileSentence['lang'] {
  if (/[一-龥]/.test(text)) return 'zh'
  if (/[a-zA-Z]/.test(text)) return 'en'
  return 'other'
}

function readDoc(): SentencesDoc {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object' && Array.isArray(raw.sentences)) {
      return { sentences: raw.sentences, updatedAt: raw.updatedAt || 0 }
    }
  } catch {
    /* 读取失败兜底 */
  }
  return { sentences: [], updatedAt: 0 }
}

export const useSentences = defineStore('mobileSentences', () => {
  const sentences = ref<MobileSentence[]>([])
  const initialized = ref(false)

  /** 收藏优先，其余按创建时间倒序 */
  const sortedSentences = computed(() =>
    [...sentences.value].sort((a, b) => {
      if (a.favorite !== b.favorite) return a.favorite ? -1 : 1
      return b.createdAt - a.createdAt
    }),
  )

  const allTags = computed(() => {
    const set = new Set<string>()
    sentences.value.forEach((s) => (s.tags || []).forEach((t) => set.add(t)))
    return Array.from(set).sort()
  })

  function load() {
    if (initialized.value) return
    sentences.value = readDoc().sentences
    initialized.value = true
  }

  function persist() {
    uni.setStorageSync(STORAGE_KEY, {
      sentences: sentences.value,
      updatedAt: Date.now(),
    })
  }

  function addSentence(text: string, translation?: string) {
    const trimmed = text.trim()
    if (!trimmed) return null
    const sentence: MobileSentence = {
      id: generateId(),
      text: trimmed,
      translation: translation?.trim() || undefined,
      lang: detectLang(trimmed),
      tags: [],
      favorite: false,
      createdAt: Date.now(),
    }
    sentences.value.unshift(sentence)
    persist()
    return sentence
  }

  function toggleFavorite(id: string) {
    const s = sentences.value.find((x) => x.id === id)
    if (!s) return false
    s.favorite = !s.favorite
    persist()
    return true
  }

  // ===== 同步 =====

  /** 收集为同步格式（空库返回 null，避免无意义负载） */
  function collect(): MobileSentences | null {
    load()
    if (sentences.value.length === 0) return null
    return { sentences: sentences.value.map((s) => ({ ...s })) }
  }

  /** 从同步包恢复：按 id 合并去重，已有 id 保留本地版本，返回新增条数 */
  function restore(data: MobileSentences): number {
    if (!data || !Array.isArray(data.sentences)) return 0
    load()
    const ids = new Set(sentences.value.map((s) => s.id))
    let added = 0
    for (const s of data.sentences) {
      if (s && s.id && !ids.has(s.id)) {
        ids.add(s.id)
        sentences.value.push({ ...s })
        added++
      }
    }
    if (added > 0) persist()
    return added
  }

  return {
    sentences,
    sortedSentences,
    allTags,
    load,
    addSentence,
    toggleFavorite,
    collect,
    restore,
  }
})
