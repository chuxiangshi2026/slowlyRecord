<template>
  <view class="edit-container" :class="themeClass">
    <AppBackground />
    <view v-if="!draft" class="empty-state">
      <text class="empty-title">没有待生成的内容</text>
      <text class="empty-desc">先在单词页筛选，再点「生成学习页」</text>
      <button class="primary-btn" @click="goWords">去单词页</button>
    </view>

    <template v-else>
      <view class="summary-card">
        <text class="summary-count">{{ draft.words.length }} 个单词</text>
        <text class="summary-text">每页 {{ pageSize }} 词 · 将生成 {{ pageCount }} 页</text>
      </view>

      <view class="form-card">
        <text class="form-label">所属词集</text>
        <view class="row">
          <picker class="grow" :range="books" range-key="name" :value="bookIndex" @change="onBookChange">
            <view class="form-input picker-value">{{ selectedBook?.name || '选择词集' }}</view>
          </picker>
          <text class="link" @click="createBook">＋新建</text>
        </view>

        <text class="form-label">所属章节</text>
        <view class="row">
          <picker class="grow" :range="chapters" range-key="name" :value="chapterIndex" @change="onChapterChange">
            <view class="form-input picker-value">{{ selectedChapter?.name || '选择章节' }}</view>
          </picker>
          <text class="link" @click="createChapter">＋新建</text>
        </view>

        <text class="form-label">学习页名称</text>
        <input v-model="pageName" class="form-input" maxlength="40" placeholder="如：old 篇"/>

        <text class="form-label">每页词数</text>
        <input v-model="pageSizeText" class="form-input" type="number" placeholder="12"/>

        <text class="form-label">分页顺序</text>
        <view class="mode-chips">
          <text v-for="opt in splitOptions" :key="opt.value"
                :class="['mode-chip', {on: splitBy === opt.value}]"
                @click="splitBy = opt.value">{{ opt.label }}</text>
        </view>

        <view v-if="duplicatedPage" class="dup-tip">
          本章已有「{{ duplicatedPage.name }}」，生成后会追加新的一页
        </view>

        <text class="form-tip">单词按当前筛选结果装页，生成后可在记忆页逐个标记「记住了」。</text>
        <button class="primary-btn" :disabled="!canSave || saving" @click="confirm">{{ saving ? '正在生成…' : '生成并查看' }}</button>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useWordBook } from '@/stores/useWordBook'
import {
  WORD_BOOK_PAGE_SIZE,
  getDefaultPageName,
  normalizePageSize,
  splitWordsIntoPages,
} from '@/utils/word-book'
import type { WordBookSplitBy } from '@/types/word-book'

const store = useWordBook()
const pageName = ref('')
const pageSizeText = ref(String(WORD_BOOK_PAGE_SIZE))
const splitBy = ref<WordBookSplitBy>('order')
const bookIndex = ref(0)
const chapterIndex = ref(0)
const selectedChapterId = ref('')
const saving = ref(false)

const splitOptions: Array<{ value: WordBookSplitBy; label: string }> = [
  { value: 'order', label: '原顺序' },
  { value: 'freq', label: '词频' },
  { value: 'length', label: '长度' },
  { value: 'alpha', label: '字母序' },
]

onLoad(() => store.load())
onShow(() => {
  store.load()
  if (!pageName.value && draft.value) {
    pageName.value = draft.value.name
  }
  // 从章节页「添加学习页」过来：预选目标
  const target = store.pendingTarget
  if (target) {
    const bookPosition = store.sortedBooks.findIndex(book => book._id === target.bookId)
    if (bookPosition >= 0) {
      bookIndex.value = bookPosition
      const list = store.chaptersOf(target.bookId)
      const chapterPosition = list.findIndex(chapter => chapter._id === target.chapterId)
      if (chapterPosition >= 0) {
        chapterIndex.value = chapterPosition
        selectedChapterId.value = list[chapterPosition]._id
      }
    }
  }
})

const draft = computed(() => store.draft)
const books = computed(() => store.sortedBooks)
const selectedBook = computed(() => books.value[bookIndex.value])
const chapters = computed(() => (selectedBook.value ? store.chaptersOf(selectedBook.value._id) : []))
const selectedChapter = computed(() => chapters.value[chapterIndex.value])
const pageSize = computed(() => normalizePageSize(Number(pageSizeText.value)))
const chunks = computed(() => (draft.value ? splitWordsIntoPages(draft.value.words, pageSize.value, splitBy.value) : []))
const pageCount = computed(() => Math.max(1, chunks.value.length))
const duplicatedPage = computed(() => {
  const chapterId = selectedChapter.value?._id
  return chapterId && draft.value ? store.findPageByKey(chapterId, draft.value.key) : undefined
})
const canSave = computed(() => !!draft.value && !!selectedBook.value && !!selectedChapter.value && !!pageName.value.trim())

function onBookChange(event: any) {
  bookIndex.value = Number(event.detail.value) || 0
  chapterIndex.value = 0
}

function onChapterChange(event: any) {
  chapterIndex.value = Number(event.detail.value) || 0
}

function goWords() {
  uni.switchTab({ url: '/pages/words/words' })
}

function createBook() {
  uni.showModal({
    title: '新建词集',
    editable: true,
    placeholderText: '如：四级词根',
    success: res => {
      if (!res.confirm) return
      const name = (res.content || '').trim()
      if (!name) return
      const book = store.createBook(name)
      if (!book) {
        uni.showToast({ title: '创建词集失败', icon: 'none' })
        return
      }
      bookIndex.value = store.sortedBooks.findIndex(item => item._id === book._id)
      chapterIndex.value = 0
    },
  })
}

function createChapter() {
  if (!selectedBook.value) {
    uni.showToast({ title: '先选择或新建词集', icon: 'none' })
    return
  }
  uni.showModal({
    title: '新建章节',
    editable: true,
    placeholderText: '如：词根 old',
    success: res => {
      if (!res.confirm) return
      const name = (res.content || '').trim()
      if (!name) return
      const chapter = store.createChapter(selectedBook.value!._id, name)
      if (!chapter) {
        uni.showToast({ title: '创建章节失败', icon: 'none' })
        return
      }
      chapterIndex.value = store.chaptersOf(selectedBook.value!._id).findIndex(item => item._id === chapter._id)
    },
  })
}

function confirm() {
  if (!canSave.value || !draft.value || saving.value) return
  saving.value = true
  try {
    const book = selectedBook.value!
    const chapter = selectedChapter.value!
    const total = chunks.value.length
    const createdIds: string[] = []
    for (let i = 0; i < total; i++) {
      const words = chunks.value[i]
      if (!words.length) continue
      const page = store.createPage({
        bookId: book._id,
        chapterId: chapter._id,
        name: getDefaultPageName(draft.value.key, i + 1, total),
        key: draft.value.key,
        words,
        source: draft.value.source,
      })
      if (!page) {
        createdIds.forEach(id => store.deletePage(id))
        uni.showToast({ title: '生成失败，请检查存储空间后重试', icon: 'none' })
        return
      }
      createdIds.push(page._id)
    }
    store.clearDraft()
    store.setPendingTarget(null)
    uni.showToast({ title: `已生成 ${createdIds.length} 个学习页`, icon: 'success' })
    setTimeout(() => {
      uni.redirectTo({ url: `/subPackages/pages-memory/word-book/pages?bookId=${book._id}&chapterId=${chapter._id}` })
    }, 600)
  } finally {
    saving.value = false
  }
}
</script>

<style lang="scss" scoped>
.edit-container {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: var(--sr-bg);
}

.summary-card {
  padding: 22rpx;
  border-radius: 18rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);
  margin-bottom: 20rpx;
}

.summary-count {
  display: block;
  font-size: 32rpx;
  color: var(--sr-text);
  font-weight: 600;
}

.summary-text {
  display: block;
  margin-top: 8rpx;
  font-size: 24rpx;
  color: var(--sr-text-2);
}

.form-card {
  padding: 22rpx;
  border-radius: 18rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);
}

.form-label {
  display: block;
  margin: 18rpx 0 10rpx;
  font-size: 24rpx;
  color: var(--sr-text-2);
}

.form-input {
  width: 100%;
  padding: 18rpx 20rpx;
  border-radius: 14rpx;
  background: var(--sr-bg);
  border: 1rpx solid var(--sr-border);
  font-size: 26rpx;
  color: var(--sr-text);
  box-sizing: border-box;
}

.picker-value {
  line-height: 1.4;
}

.row {
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.grow {
  flex: 1;
}

.link {
  font-size: 24rpx;
  color: var(--sr-primary);
  padding: 10rpx 6rpx;
}

.mode-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.mode-chip {
  padding: 10rpx 22rpx;
  border-radius: 999rpx;
  background: var(--sr-bg);
  border: 1rpx solid var(--sr-border);
  font-size: 24rpx;
  color: var(--sr-text-2);

  &.on {
    color: var(--sr-primary);
    border-color: var(--sr-primary);
  }
}

.dup-tip {
  margin-top: 16rpx;
  padding: 14rpx 18rpx;
  border-radius: 12rpx;
  background: var(--sr-bg);
  font-size: 22rpx;
  color: var(--sr-text-2);
}

.form-tip {
  display: block;
  margin: 18rpx 0;
  font-size: 22rpx;
  color: var(--sr-text-2);
  line-height: 1.5;
}

.empty-state {
  padding: 100rpx 0;
  text-align: center;
}

.empty-title {
  display: block;
  font-size: 30rpx;
  color: var(--sr-text);
  margin-bottom: 12rpx;
}

.empty-desc {
  display: block;
  font-size: 24rpx;
  color: var(--sr-text-2);
  margin-bottom: 30rpx;
}

.primary-btn {
  width: 100%;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 38rpx;
  background: var(--sr-primary);
  color: #fff;
  font-size: 28rpx;
}
</style>
