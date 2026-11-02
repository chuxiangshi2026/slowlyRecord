<template>
  <el-dialog :model-value="modelValue" title="生成学习页" width="520px" :close-on-click-modal="false"
             @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <div class="create-summary">
      <strong>{{ words.length }} 个单词</strong>
      <span>每页 {{ pageSize }} 词 · 将生成 {{ pageCount }} 页</span>
    </div>

    <el-form label-position="top">
      <el-form-item label="所属书">
        <div class="row">
          <el-select v-model="bookId" class="grow" filterable placeholder="选择书" :disabled="!!lockedBookId">
            <el-option v-for="book in store.sortedBooks" :key="book._id" :label="book.name" :value="book._id"/>
          </el-select>
          <el-input v-if="!lockedBookId && newBookName !== null" v-model="newBookName" class="grow"
                    placeholder="新书名称" maxlength="30"/>
          <el-button v-else-if="!lockedBookId" text type="primary" @click="newBookName = defaultBookName">＋新建</el-button>
        </div>
      </el-form-item>

      <el-form-item label="所属章">
        <div class="row">
          <el-select v-model="chapterId" class="grow" filterable placeholder="选择章" :disabled="!bookId || !!lockedChapterId">
            <el-option v-for="chapter in chapterOptions" :key="chapter._id" :label="chapter.name" :value="chapter._id"/>
          </el-select>
          <el-input v-if="!lockedChapterId && newChapterName !== null" v-model="newChapterName" class="grow"
                    placeholder="新章名称" maxlength="30"/>
          <el-button v-else-if="!lockedChapterId" text type="primary" @click="newChapterName = defaultChapterName">＋新建</el-button>
        </div>
      </el-form-item>

      <el-form-item label="学习页名称">
        <el-input v-model="pageName" maxlength="40" placeholder="如：old 篇"/>
      </el-form-item>

      <el-form-item label="分页">
        <div class="row">
          <span class="field-label">每页</span>
          <el-input-number v-model="pageSize" :min="1" :max="MAX_WORD_BOOK_PAGE_SIZE" size="small"/>
          <span class="field-label">词，按</span>
          <el-select v-model="splitBy" size="small" style="width: 120px">
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
        <el-radio-group v-model="dupMode" size="small">
          <el-radio-button value="append">再生成一页</el-radio-button>
          <el-radio-button value="cancel">不生成</el-radio-button>
        </el-radio-group>
      </el-alert>

      <p class="create-tip">单词按当前筛选结果装页，生成后可在页面上逐个标记「记住了」。</p>
    </el-form>

    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" :disabled="!canSave" @click="confirm">生成并查看</el-button>
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

const bookId = ref('')
const chapterId = ref('')
const newBookName = ref<string | null>(null)
const newChapterName = ref<string | null>(null)
const pageName = ref('')
const pageSize = ref(WORD_BOOK_PAGE_SIZE)
const splitBy = ref<WordBookSplitBy>('order')
const dupMode = ref<'append' | 'cancel'>('append')
const saving = ref(false)

const chapterOptions = computed(() => (bookId.value ? store.chaptersOf(bookId.value) : []))
const chunks = computed(() => splitWordsIntoPages(props.words, pageSize.value, splitBy.value))
const pageCount = computed(() => Math.max(1, chunks.value.length))
const duplicatedPage = computed(() => (chapterId.value ? store.findPageByKey(chapterId.value, key.value) : undefined))

const canSave = computed(() => {
  if (!props.words.length) return false
  if (dupMode.value === 'cancel' && duplicatedPage.value) return false
  const hasBook = !!bookId.value || !!newBookName.value?.trim()
  const hasChapter = !!chapterId.value || !!newChapterName.value?.trim()
  return hasBook && hasChapter && !!pageName.value.trim()
})

// 每次打开：按当前上下文预填
watch(() => props.modelValue, (open) => {
  if (!open) return
  bookId.value = props.lockedBookId || store.sortedBooks[0]?._id || ''
  chapterId.value = props.lockedChapterId || (bookId.value ? store.chaptersOf(bookId.value)[0]?._id : '') || ''
  newBookName.value = null
  newChapterName.value = null
  pageSize.value = WORD_BOOK_PAGE_SIZE
  splitBy.value = 'order'
  dupMode.value = 'append'
  pageName.value = getDefaultPageName(key.value, 1, chunks.value.length)
}, { immediate: true })

watch(bookId, (value) => {
  if (!value) return
  const list = store.chaptersOf(value)
  chapterId.value = list[0]?._id || ''
})
watch([pageSize, splitBy], () => {
  pageName.value = getDefaultPageName(key.value, 1, chunks.value.length)
})

async function confirm() {
  if (!canSave.value || saving.value) return
  saving.value = true
  try {
    let targetBookId = bookId.value
    if (!targetBookId && newBookName.value?.trim()) {
      const book = await store.createBook(newBookName.value.trim())
      targetBookId = book._id
    }
    let targetChapterId = chapterId.value
    if (!targetChapterId && newChapterName.value?.trim()) {
      const chapter = await store.createChapter(targetBookId, newChapterName.value.trim())
      targetChapterId = chapter._id
    }
    if (!targetBookId || !targetChapterId) {
      ElMessage.warning('请选择或新建书与章')
      return
    }

    const source = buildWordBookSource(props.bankId, props.bankName, props.filter)
    const total = chunks.value.length
    for (let i = 0; i < total; i++) {
      const words = chunks.value[i].map(toWordBookWord).filter(word => word.text)
      if (!words.length) continue
      await store.createPage({
        bookId: targetBookId,
        chapterId: targetChapterId,
        name: getDefaultPageName(key.value, i + 1, total),
        key: key.value,
        words,
        source,
      })
    }
    trackEvent('feature', 'word_book_generate', splitBy.value, total)
    ElMessage.success(`已生成 ${total} 页`)
    emit('update:modelValue', false)
    emit('created', { bookId: targetBookId, chapterId: targetChapterId })
  } catch (e) {
    console.error('[词图] 生成学习页失败', e)
    ElMessage.error('生成失败，请重试')
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
