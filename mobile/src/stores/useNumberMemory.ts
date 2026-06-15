import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
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
 * 第一阶段：仅文字描述桩位（type='text'），imageUrl/imageSource 字段保留待后期升级
 * 持久化：wx.Storage 单 key
 */

const STORAGE_KEY = 'slowlyrecord-numbermemory-data'

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

function readDoc(): NumberMemoryDoc {
  try {
    const raw = uni.getStorageSync(STORAGE_KEY)
    if (raw && typeof raw === 'object') {
      return {
        associations: Array.isArray(raw.associations) ? raw.associations : [],
        entries: Array.isArray(raw.entries) ? raw.entries : [],
        notes: Array.isArray(raw.notes) ? raw.notes : [],
        prompts: Array.isArray(raw.prompts) ? raw.prompts : [],
        updatedAt: raw.updatedAt || 0,
      }
    }
  } catch {
    /* 兜底 */
  }
  return { associations: [], entries: [], notes: [], prompts: [], updatedAt: 0 }
}

function writeDoc(doc: NumberMemoryDoc) {
  doc.updatedAt = Date.now()
  uni.setStorageSync(STORAGE_KEY, doc)
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
   * 添加或更新文字桩
   * 第一阶段强制 type='text'；imageUrl 字段保留为后期升级使用
   */
  function setAssociation(input: {
    number: string
    description: string
    source?: 'user' | 'preset'
  }) {
    const idx = associations.value.findIndex((a) => a.number === input.number)
    const next: MobileNumberAssociation = {
      number: input.number,
      type: 'text',
      description: input.description,
      source: input.source || 'user',
      // 后期升级解锁这两个字段
      imageUrl: idx >= 0 ? associations.value[idx].imageUrl : undefined,
      imageSource: idx >= 0 ? associations.value[idx].imageSource : undefined,
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
    // actions
    load,
    setAssociation,
    deleteAssociation,
    clearAllAssociations,
    addEntry,
    updateEntry,
    deleteEntry,
    // sync
    collect,
    restore,
  }
})
