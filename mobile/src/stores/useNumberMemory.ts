import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { getDbAdapter } from '@/adapters/index'
import {
  isPracticeDue,
  scheduleOnRemembered,
  scheduleOnForgotten,
} from '../utils/practice-srs'
import type {
  MobileNumberAssociation,
  MobileNumberEntry,
  MobileNumberNote,
  MobileNumberPrompt,
  MobileNumberMemory,
} from './useUtils/types'

/**
 * 数字记忆 store（移动端）
 *
 * 桩位支持文字（type='text'）与图片（type='image'，base64 dataURL）两种形态
 * 自测练习（practice.vue）：报数回忆桩 / 条目回忆，自评接轻量复习调度 level/nextReview
 * 持久化：DB 适配器单 doc（超过 900KB 自动分块，兼容图片 base64）
 */

const DOC_ID = 'numbermemory-data'
// 历史版本的裸 storage key，读取后自动迁移到 DB 适配器
const LEGACY_STORAGE_KEY = 'slowlyrecord-numbermemory-data'

interface NumberMemoryDoc {
  associations: MobileNumberAssociation[]
  entries: MobileNumberEntry[]
  notes: MobileNumberNote[]
  prompts: MobileNumberPrompt[]
  updatedAt: number
}

function generateId(): string {
  return `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`
}

function normalizeDoc(raw: any): NumberMemoryDoc {
  return {
    associations: Array.isArray(raw?.associations) ? raw.associations : [],
    entries: Array.isArray(raw?.entries) ? raw.entries : [],
    notes: Array.isArray(raw?.notes) ? raw.notes : [],
    prompts: Array.isArray(raw?.prompts) ? raw.prompts : [],
    updatedAt: raw?.updatedAt || 0,
  }
}

function readDoc(): NumberMemoryDoc {
  try {
    const doc = getDbAdapter().get<NumberMemoryDoc>(DOC_ID)
    if (doc?.data && typeof doc.data === 'object') {
      return normalizeDoc(doc.data)
    }
  } catch {
    /* 兜底走 legacy */
  }
  // 旧版本数据存在裸 storage key 下，读到即迁移
  try {
    const raw = uni.getStorageSync(LEGACY_STORAGE_KEY)
    if (raw && typeof raw === 'object') {
      const doc = normalizeDoc(raw)
      try {
        getDbAdapter().put({ _id: DOC_ID, data: { ...doc, updatedAt: Date.now() } })
        uni.removeStorageSync(LEGACY_STORAGE_KEY)
      } catch {
        /* 迁移失败不影响本次读取 */
      }
      return doc
    }
  } catch {
    /* 兜底 */
  }
  return { associations: [], entries: [], notes: [], prompts: [], updatedAt: 0 }
}

function writeDoc(doc: NumberMemoryDoc) {
  doc.updatedAt = Date.now()
  try {
    const result = getDbAdapter().put({ _id: DOC_ID, data: doc })
    if (result.error) {
      console.error('持久化数字记忆失败:', result.message)
    }
  } catch (e) {
    console.error('持久化数字记忆失败:', e)
  }
}

export const useNumberMemory = defineStore('mobileNumberMemory', () => {
  const associations = ref<MobileNumberAssociation[]>([])
  const entries = ref<MobileNumberEntry[]>([])
  const notes = ref<MobileNumberNote[]>([])
  const prompts = ref<MobileNumberPrompt[]>([])
  const loading = ref(false)
  const initialized = ref(false)

  // ===== Getters =====

  const associationCount = computed(() => associations.value.length)
  const totalEntries = computed(() => entries.value.length)
  const sortedEntries = computed(() =>
    [...entries.value].sort((a, b) => b.createdAt - a.createdAt),
  )
  const allTags = computed(() => {
    const set = new Set<string>()
    entries.value.forEach((e) => e.tags?.forEach((t) => set.add(t)))
    return Array.from(set).sort()
  })

  /** 数字桩 Map：number → association（O(1) 查询） */
  const associationMap = computed(() => {
    const m = new Map<string, MobileNumberAssociation>()
    associations.value.forEach((a) => m.set(a.number, a))
    return m
  })

  function getAssociation(number: string): MobileNumberAssociation | undefined {
    return associationMap.value.get(number)
  }

  function hasAssociation(number: string): boolean {
    return associationMap.value.has(number)
  }

  /** 某数字桩是否到期待复习 */
  function isAssociationDue(number: string): boolean {
    const assoc = associationMap.value.get(number)
    return isPracticeDue(assoc?.nextReview)
  }

  /** 某数字条目是否到期待复习 */
  function isEntryDue(id: string): boolean {
    const entry = entries.value.find((e) => e._id === id)
    return isPracticeDue(entry?.nextReview)
  }

  /** 到期待复习的数字桩（按到期时间升序） */
  const dueAssociations = computed(() =>
    associations.value
      .filter((a) => isPracticeDue(a.nextReview))
      .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0)),
  )

  /** 到期待复习的数字条目（按到期时间升序） */
  const dueEntries = computed(() =>
    entries.value
      .filter((e) => isPracticeDue(e.nextReview))
      .sort((a, b) => (a.nextReview || 0) - (b.nextReview || 0)),
  )

  // ===== 加载 / 持久化 =====

  function load() {
    if (initialized.value) return
    loading.value = true
    try {
      const doc = readDoc()
      associations.value = doc.associations
      entries.value = doc.entries
      notes.value = doc.notes
      prompts.value = doc.prompts
    } finally {
      loading.value = false
      initialized.value = true
    }
  }

  function persist() {
    writeDoc({
      associations: associations.value,
      entries: entries.value,
      notes: notes.value,
      prompts: prompts.value,
      updatedAt: Date.now(),
    })
  }

  // ===== 数字桩 CRUD =====

  /**
   * 添加或更新数字桩
   * 传 imageUrl 时为图片桩（type='image'），否则为文字桩（type='text'）
   */
  function setAssociation(input: {
    number: string
    description: string
    source?: 'user' | 'preset' | 'upload'
    imageUrl?: string
    imageSource?: 'base64' | 'local' | 'remote' | 'preset'
  }) {
    const idx = associations.value.findIndex((a) => a.number === input.number)
    const prev = idx >= 0 ? associations.value[idx] : undefined
    // 图片桩以 base64 dataURL 存 imageUrl（与桌面端格式一致，保证同步互通）
    // 传 undefined 表示沿用原值，传 '' 表示显式清除
    const imageUrl = input.imageUrl !== undefined ? (input.imageUrl || undefined) : prev?.imageUrl
    const next: MobileNumberAssociation = {
      number: input.number,
      type: imageUrl ? 'image' : 'text',
      description: input.description,
      source: input.source || prev?.source || 'user',
      imageUrl,
      imageSource: imageUrl ? (input.imageSource || prev?.imageSource) : undefined,
    }
    if (idx >= 0) associations.value[idx] = next
    else associations.value.push(next)
    persist()
    return next
  }

  function deleteAssociation(number: string) {
    const before = associations.value.length
    associations.value = associations.value.filter((a) => a.number !== number)
    if (associations.value.length !== before) persist()
  }

  /** 数字桩自评落库：更新复习调度（level / nextReview） */
  function rateAssociation(number: string, remembered: boolean, now: number = Date.now()) {
    const idx = associations.value.findIndex((a) => a.number === number)
    if (idx < 0) return false
    const prev = associations.value[idx]
    const schedule = remembered
      ? scheduleOnRemembered(prev.level, now)
      : scheduleOnForgotten(prev.level, now)
    associations.value[idx] = { ...prev, level: schedule.level, nextReview: schedule.nextReview }
    persist()
    return true
  }

  function clearAllAssociations() {
    if (associations.value.length === 0) return
    associations.value = []
    persist()
  }

  // ===== 条目 CRUD =====

  function addEntry(input: { title: string; numbers: string; tags?: string[]; description?: string }) {
    const now = Date.now()
    const entry: MobileNumberEntry = {
      _id: `numentry_${generateId()}`,
      title: input.title,
      numbers: input.numbers,
      tags: input.tags || [],
      description: input.description,
      createdAt: now,
      updatedAt: now,
      reviewCount: 0,
    }
    entries.value.unshift(entry)
    persist()
    return entry
  }

  function updateEntry(id: string, patch: Partial<MobileNumberEntry>) {
    const idx = entries.value.findIndex((e) => e._id === id)
    if (idx < 0) return false
    entries.value[idx] = {
      ...entries.value[idx],
      ...patch,
      _id: entries.value[idx]._id,
      createdAt: entries.value[idx].createdAt,
      updatedAt: Date.now(),
    }
    persist()
    return true
  }

  function deleteEntry(id: string) {
    const before = entries.value.length
    entries.value = entries.value.filter((e) => e._id !== id)
    notes.value = notes.value.filter((n) => n.entryId !== id)
    prompts.value = prompts.value.filter((p) => p.entryId !== id)
    if (entries.value.length !== before) persist()
  }

  /** 数字条目自评落库：更新复习调度（level / nextReview）与统计 */
  function rateEntry(id: string, remembered: boolean, now: number = Date.now()) {
    const idx = entries.value.findIndex((e) => e._id === id)
    if (idx < 0) return false
    const prev = entries.value[idx]
    const schedule = remembered
      ? scheduleOnRemembered(prev.level, now)
      : scheduleOnForgotten(prev.level, now)
    entries.value[idx] = {
      ...prev,
      level: schedule.level,
      nextReview: schedule.nextReview,
      lastReviewTime: now,
      reviewCount: (prev.reviewCount || 0) + 1,
    }
    persist()
    return true
  }

  // ===== 同步辅助 =====

  function collect(): MobileNumberMemory {
    return {
      associations: associations.value,
      entries: entries.value,
      notes: notes.value,
      prompts: prompts.value,
    }
  }

  function restore(data: MobileNumberMemory, mode: 'merge' | 'replace' = 'merge') {
    if (!data) return { addedAssoc: 0, addedEntry: 0 }

    if (mode === 'replace') {
      associations.value = data.associations || []
      entries.value = data.entries || []
      notes.value = data.notes || []
      prompts.value = data.prompts || []
      persist()
      return {
        addedAssoc: associations.value.length,
        addedEntry: entries.value.length,
      }
    }

    // merge：number 唯一 → 远端覆盖本地（但不丢本地独有）；entries/notes/prompts 按 _id 合并
    let addedAssoc = 0
    const localAssoc = new Map(associations.value.map((a) => [a.number, a]))
    for (const a of data.associations || []) {
      if (!localAssoc.has(a.number)) {
        associations.value.push(a)
        localAssoc.set(a.number, a)
        addedAssoc++
      } else {
        // 远端覆盖：以 utime 等无字段比对，简化为远端有 description/imageUrl 时覆盖
        const local = localAssoc.get(a.number)!
        if (
          (a.description && a.description !== local.description) ||
          (a.imageUrl && a.imageUrl !== local.imageUrl)
        ) {
          const idx = associations.value.findIndex((x) => x.number === a.number)
          if (idx >= 0) associations.value[idx] = { ...local, ...a }
        }
      }
    }

    let addedEntry = 0
    const entryIds = new Set(entries.value.map((e) => e._id))
    for (const e of data.entries || []) {
      if (!entryIds.has(e._id)) {
        entries.value.push(e)
        entryIds.add(e._id)
        addedEntry++
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

    persist()
    return { addedAssoc, addedEntry }
  }

  return {
    // state
    associations,
    entries,
    notes,
    prompts,
    loading,
    // getters
    associationCount,
    totalEntries,
    sortedEntries,
    allTags,
    associationMap,
    getAssociation,
    hasAssociation,
    isAssociationDue,
    isEntryDue,
    dueAssociations,
    dueEntries,
    // actions
    load,
    setAssociation,
    deleteAssociation,
    clearAllAssociations,
    rateAssociation,
    addEntry,
    updateEntry,
    deleteEntry,
    rateEntry,
    // sync
    collect,
    restore,
  }
})
