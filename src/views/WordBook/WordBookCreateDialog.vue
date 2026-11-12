<template>
  <el-dialog :model-value="modelValue" title="加入词集" width="min(560px, 92vw)" :close-on-click-modal="false"
             @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <div class="create-summary">
      <strong>{{ words.length }} 个单词</strong>
      <span>每页 {{ pageSize }} 词 · 将生成 {{ pageCount }} 页</span>
    </div>

    <el-form label-position="top">
      <el-form-item label="所属词集">
        <div class="mode-row">
          <el-radio-group v-model="bookMode" size="small" :disabled="!!lockedBookId || hasRetryTarget">
            <el-radio-button value="select">选择已有</el-radio-button>
            <el-radio-button value="new">新建词集</el-radio-button>
          </el-radio-group>
        </div>
        <div class="row">
          <el-select v-if="bookMode === 'select'" v-model="bookId" class="grow" filterable placeholder="选择词集" :disabled="!!lockedBookId || hasRetryTarget">
            <el-option v-for="book in store.sortedBooks" :key="book._id" :label="book.name" :value="book._id"/>
          </el-select>
          <el-input v-else v-model="newBookName" class="grow" placeholder="新词集名称" maxlength="30" :disabled="hasRetryTarget"/>
        </div>
      </el-form-item>

      <el-form-item label="所属章节">
        <div class="mode-row">
          <el-radio-group v-model="chapterMode" size="small" :disabled="bookMode === 'new' || !!lockedChapterId || hasRetryTarget">
            <el-radio-button value="select">选择已有</el-radio-button>
            <el-radio-button value="new">新建章节</el-radio-button>
          </el-radio-group>
        </div>
        <div class="row">
          <el-select v-if="chapterMode === 'select'" v-model="chapterId" class="grow" filterable placeholder="选择章节"
                     :disabled="bookMode === 'new' || !bookId || !!lockedChapterId || hasRetryTarget">
            <el-option v-for="chapter in chapterOptions" :key="chapter._id" :label="chapter.name" :value="chapter._id"/>
          </el-select>
          <el-input v-else v-model="newChapterName" class="grow" placeholder="新章节名称" maxlength="30" :disabled="hasRetryTarget"/>
        </div>
      </el-form-item>

      <el-form-item label="学习页名称">
        <el-input v-model="pageName" maxlength="40" placeholder="如：old 篇" @input="pageNameTouched = true"/>
      </el-form-item>

      <el-form-item label="分页">
        <div class="row">
          <span class="field-label">每页</span>
          <el-input-number v-model="pageSize" :min="1" :max="MAX_WORD_BOOK_PAGE_SIZE" size="small" :disabled="hasRetryTarget"/>
          <span class="field-label">词，按</span>
          <el-select v-model="splitBy" size="small" style="width: 120px" :disabled="hasRetryTarget">
            <el-option label="原顺序" value="order"/>
            <el-option label="词频" value="freq"/>
            <el-option label="拼写长度" value="length"/>
            <el-option label="字母序" value="alpha"/>
          </el-select>
        </div>
      </el-form-item>

      <el-alert v-if="duplicatedPage" type="warning" :closable="false" show-icon class="dup-alert">
        <template #title>
          本章已有「{{ duplicatedPage.name }}」（{{ duplicatedPage.words.length }} 词）
        </template>
        <el-radio-group v-model="dupMode" size="small" :disabled="hasRetryTarget">
          <el-radio-button value="append">再生成一页</el-radio-button>
          <el-radio-button value="cancel">不生成</el-radio-button>
        </el-radio-group>
      </el-alert>

      <el-alert v-if="failedIndexes.length" type="error" :closable="false" show-icon class="dup-alert">
        {{ failedIndexes.length }} 页保存失败；可只重试失败页，取消则保留已生成内容。
      </el-alert>

      <p class="create-tip">单词按当前筛选结果装页，生成后可继续在导图页编辑、复习和标记已读。</p>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!canSave" @click="confirm">
        {{ failedIndexes.length ? '重试失败页' : '生成并查看' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { ElMessage } from 'element-plus'
import { trackEvent } from '@/utils/stats'
import { useWordBookStore } from '@/stores/wordBook'
import {
  MAX_WORD_BOOK_PAGE_SIZE,
  WORD_BOOK_PAGE_SIZE,
  buildPageNameFromBase,
  getDefaultBookName,
  getDefaultChapterName,
  getDefaultPageName,
  resolveWordBookKey,
  splitWordsIntoPages,
  toWordBookWord,
  buildWordBookSource,
  type WordBookFilterLike,
} from '@/utils/word-book'
import type { WordBookSplitBy } from '@/types/word-book'
import type { Word } from '@/types/words'

const props = defineProps<{
  modelValue: boolean
  words: Word[]
  filter?: WordBookFilterLike
  bankId?: string
  bankName?: string
  language?: string
  lockedBookId?: string
  lockedChapterId?: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', payload: { bookId: string; chapterId: string }): void
}>()

const store = useWordBookStore()

const key = computed(() => resolveWordBookKey(props.filter))
const defaultBookName = computed(() => getDefaultBookName(props.bankName, key.value))
const defaultChapterName = computed(() => getDefaultChapterName(key.value))

const bookMode = ref<'select' | 'new'>('select')
const chapterMode = ref<'select' | 'new'>('select')
const bookId = ref('')
const chapterId = ref('')
const newBookName = ref('')
const newChapterName = ref('')
const pageName = ref('')
const pageNameTouched = ref(false)
const pageSize = ref(WORD_BOOK_PAGE_SIZE)
const splitBy = ref<WordBookSplitBy>('order')
const dupMode = ref<'append' | 'cancel'>('append')
const saving = ref(false)
const failedIndexes = ref<number[]>([])
const retryBookId = ref('')
const retryChapterId = ref('')
const hasRetryTarget = computed(() => failedIndexes.value.length > 0 && !!retryBookId.value && !!retryChapterId.value)

const chapterOptions = computed(() => (bookMode.value === 'select' && bookId.value ? store.chaptersOf(bookId.value) : []))
const chunks = computed(() => splitWordsIntoPages(props.words, pageSize.value, splitBy.value))
const pageCount = computed(() => Math.max(1, chunks.value.length))
const duplicatedPage = computed(() => (chapterMode.value === 'select' && chapterId.value ? store.findPageByKey(chapterId.value, key.value) : undefined))

const canSave = computed(() => {
  if (!props.words.length) return false
  if (dupMode.value === 'cancel' && duplicatedPage.value) return false
  const hasBook = bookMode.value === 'select' ? !!bookId.value : !!newBookName.value.trim()
  const hasChapter = chapterMode.value === 'select' ? !!chapterId.value : !!newChapterName.value.trim()
  return hasBook && hasChapter && !!pageName.value.trim()
})

// 每次打开：先读取最新书章，再按当前上下文预填
watch(() => props.modelValue, async (open) => {
  if (!open) return
  try {
    await store.loadAll()
  } catch {
    ElMessage.error('词集数据读取失败')
  }
  const firstBook = store.sortedBooks[0]
  failedIndexes.value = []
  retryBookId.value = ''
  retryChapterId.value = ''
  pageNameTouched.value = false
  pageSize.value = WORD_BOOK_PAGE_SIZE
  splitBy.value = 'order'
  dupMode.value = 'append'

  bookMode.value = props.lockedBookId || firstBook ? 'select' : 'new'
  bookId.value = props.lockedBookId || firstBook?._id || ''
  newBookName.value = bookMode.value === 'new' ? defaultBookName.value : ''

  syncChapterState()
  pageName.value = getDefaultPageName(key.value, 1, 1)
}, { immediate: true })

watch(bookMode, (mode) => {
  if (props.lockedBookId) return
  if (mode === 'new') {
    bookId.value = ''
    newBookName.value = defaultBookName.value
    chapterMode.value = 'new'
    chapterId.value = ''
    newChapterName.value = defaultChapterName.value
    return
  }
  bookId.value = store.sortedBooks[0]?._id || ''
  newBookName.value = ''
  syncChapterState()
})

watch(bookId, () => {
  if (bookMode.value === 'select') syncChapterState()
})

watch(chapterMode, (mode) => {
  if (props.lockedChapterId) return
  if (mode === 'new') {
    chapterId.value = ''
    newChapterName.value = defaultChapterName.value
    return
  }
  newChapterName.value = ''
  const list = bookId.value ? store.chaptersOf(bookId.value) : []
  chapterId.value = list[0]?._id || ''
})

watch([pageSize, splitBy], () => {
  if (!pageNameTouched.value) {
    pageName.value = getDefaultPageName(key.value, 1, 1)
  }
})

function syncChapterState() {
  if (props.lockedChapterId) {
    chapterMode.value = 'select'
    chapterId.value = props.lockedChapterId
    newChapterName.value = ''
    return
  }
  const list = bookId.value ? store.chaptersOf(bookId.value) : []
  if (list.length) {
    chapterMode.value = 'select'
    chapterId.value = list[0]._id
    newChapterName.value = ''
  } else {
    chapterMode.value = 'new'
    chapterId.value = ''
    newChapterName.value = defaultChapterName.value
  }
}

async function confirm() {
  if (!canSave.value || saving.value) return
  saving.value = true
  let createdBookId = ''
  let createdChapterId = ''
  try {
    const retrying = hasRetryTarget.value
    let targetBookId = retrying ? retryBookId.value : bookId.value
    if (!retrying && bookMode.value === 'new') {
      const bookResult = await store.createBook(newBookName.value.trim())
      if (!bookResult.ok || !bookResult.item) throw new Error(bookResult.message || '创建词集失败')
      targetBookId = bookResult.item._id
      createdBookId = targetBookId
    }

    let targetChapterId = retrying ? retryChapterId.value : chapterId.value
    if (!retrying && chapterMode.value === 'new') {
      const chapterResult = await store.createChapter(targetBookId, newChapterName.value.trim())
      if (!chapterResult.ok || !chapterResult.item) throw new Error(chapterResult.message || '创建章节失败')
      targetChapterId = chapterResult.item._id
      createdChapterId = targetChapterId
    }
    if (!targetBookId || !targetChapterId) throw new Error('请选择或新建词集与章节')

    const source = buildWordBookSource(props.bankId, props.bankName, props.filter, props.language)
    const total = chunks.value.length
    const indexes = failedIndexes.value.length ? [...failedIndexes.value] : chunks.value.map((_, index) => index)
    const failures: number[] = []
    let createdCount = 0

    for (const index of indexes) {
      const words = chunks.value[index].map(toWordBookWord).filter(word => word.text)
      if (!words.length) continue
      const result = await store.createPage({
        bookId: targetBookId,
        chapterId: targetChapterId,
        name: buildPageNameFromBase(pageName.value.trim(), index + 1, total),
        key: key.value,
        words,
        source,
      })
      if (result.ok) createdCount++
      else failures.push(index)
    }

    if (createdCount && !retrying && bookMode.value === 'select') {
      const claimed = await store.claimSampleBook(targetBookId)
      if (!claimed.ok) ElMessage.warning('内容已生成，但示例转换失败，仍保留为示例')
    }

    failedIndexes.value = failures
    if (failures.length) {
      retryBookId.value = targetBookId
      retryChapterId.value = targetChapterId
    }
    trackEvent('feature', 'word_book_generate', splitBy.value, createdCount)

    if (createdCount && !failures.length) {
      retryBookId.value = ''
      retryChapterId.value = ''
      ElMessage.success(`已生成 ${createdCount} 页`)
      emit('update:modelValue', false)
      emit('created', { bookId: targetBookId, chapterId: targetChapterId })
      return
    }
    if (createdCount && failures.length) {
      ElMessage.warning(`已生成 ${createdCount} 页，${failures.length} 页失败，可继续重试`)
      return
    }

    if (createdChapterId) await store.deleteChapter(createdChapterId)
    if (createdBookId) await store.deleteBook(createdBookId)
    if (createdChapterId || createdBookId) {
      retryBookId.value = ''
      retryChapterId.value = ''
    }
    throw new Error('学习页保存失败')
  } catch (e) {
    console.error('[词集] 生成学习页失败', e)
    ElMessage.error(e instanceof Error && e.message ? e.message : '生成失败，请重试')
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.create-summary {
  display: flex;
  gap: 12px;
  align-items: baseline;
  margin-bottom: 12px;
  color: var(--utools-text-secondary);
  font-size: 13px;

  strong {
    color: var(--utools-text-primary);
    font-size: 15px;
  }
}

.mode-row {
  margin-bottom: 8px;
}

.row {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.grow {
  flex: 1;
  min-width: 0;
}

.field-label {
  color: var(--utools-text-secondary);
  font-size: 13px;
  white-space: nowrap;
}

.dup-alert {
  margin-bottom: 8px;
}

.create-tip {
  margin: 0;
  color: var(--utools-text-tertiary);
  font-size: 12px;
}
</style>
