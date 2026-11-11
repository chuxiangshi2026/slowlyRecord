<template>
  <view class="book-container" :class="themeClass">
    <view class="book-header">
      <view class="book-heading">
        <text class="book-title">词集</text>
        <text class="book-subtitle">把相关单词编成学习页；单词页筛选 → 生成学习页 → 逐词标记</text>
      </view>
      <view class="book-header-actions">
        <text class="header-link" @click="importSample">导入示例</text>
        <button class="primary-btn small" @click="createBook">新建词集</button>
      </view>
    </view>

    <view v-if="store.dueCount" class="due-bar" @click="goFirstDue">
      <text class="due-text">今天该复习 {{ store.dueCount }} 篇 ›</text>
    </view>

    <view v-if="!store.loaded" class="empty-tip">加载中...</view>
    <view v-else-if="store.sortedBooks.length === 0" class="empty-state">
      <text class="empty-title">还没有词集</text>
      <text class="empty-desc">先新建一本词集（如「四级词根」），再去单词页筛选后生成学习页</text>
      <button class="primary-btn" @click="createBook">新建词集</button>
    </view>

    <view v-else class="chapter-list">
      <view v-for="book in store.sortedBooks" :key="book._id" class="chapter-card" @click="openBook(book._id)">
        <view class="chapter-topline">
          <text class="chapter-order">词集</text>
          <text class="more" @click.stop="onBookAction(book)">⋯</text>
        </view>
        <text class="chapter-name">{{ book.name }}</text>
        <text class="chapter-progress">{{ summaryOf(book._id) }}</text>
        <view class="progress-track">
          <view class="progress-value" :style="{width: progressOf(book._id) + '%'}"></view>
        </view>
        <view class="chapter-actions">
          <text class="enter-action">进入 ›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { onShow } from '@dcloudio/uni-app'
import { useWordBook } from '@/stores/useWordBook'
import { addWordBookSample, seedWordBookSamples } from '@/utils/wordbook-seed'
import { WORDBOOK_SAMPLES } from '@/utils/wordbook-samples'
import type { WordBookBook } from '@/types/word-book'

const store = useWordBook()

onShow(() => {
  seedWordBookSamples()
  store.load()
})

function pagesOfBook(bookId: string) {
  const chapterIds = new Set(store.chaptersOf(bookId).map(chapter => chapter._id))
  return store.pages.filter(page => chapterIds.has(page.chapterId))
}

function summaryOf(bookId: string): string {
  const chapters = store.chaptersOf(bookId).length
  const pages = pagesOfBook(bookId)
  return `${chapters} 章 · ${pages.length} 页 · 已完成 ${pages.filter(page => page.completedAt).length} 页`
}

function progressOf(bookId: string): number {
  const pages = pagesOfBook(bookId)
  if (!pages.length) return 0
  return Math.round(pages.filter(page => page.completedAt).length / pages.length * 100)
}

function openBook(bookId: string) {
  uni.navigateTo({ url: `/subPackages/pages-memory/word-book/chapter?bookId=${bookId}` })
}

function goFirstDue() {
  const first = store.duePages[0]
  if (first) uni.navigateTo({ url: `/subPackages/pages-memory/word-book/page?pageId=${first._id}` })
}

function importSample() {
  const existing = new Set(store.sortedBooks.map(book => book.name))
  const missing = WORDBOOK_SAMPLES.filter(sample => !existing.has(sample.name))
  if (!missing.length) {
    uni.showToast({ title: '示例词集已全部导入', icon: 'none' })
    return
  }
  uni.showActionSheet({
    itemList: missing.map(sample => sample.name),
    success: res => {
      const sample = missing[res.tapIndex]
      if (!sample) return
      const book = addWordBookSample(sample)
      if (!book) {
        uni.showToast({ title: '导入示例失败', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/subPackages/pages-memory/word-book/chapter?bookId=${book._id}` })
    },
  })
}

function createBook() {
  uni.showModal({
    title: '新建词集',
    editable: true,
    placeholderText: '如：四级词根',
    success: res => {
      if (!res.confirm) return
      const name = (res.content || '').trim()
      if (!name) {
        uni.showToast({ title: '名称不能为空', icon: 'none' })
        return
      }
      const book = store.createBook(name)
      if (!book) {
        uni.showToast({ title: '创建词集失败', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/subPackages/pages-memory/word-book/chapter?bookId=${book._id}` })
    },
  })
}

function onBookAction(book: WordBookBook) {
  uni.showActionSheet({
    itemList: ['重命名', '删除'],
    success: res => {
      if (res.tapIndex === 0) renameBook(book)
      else if (res.tapIndex === 1) removeBook(book)
    },
  })
}

function renameBook(book: WordBookBook) {
  uni.showModal({
    title: '重命名',
    editable: true,
    content: book.name,
    success: res => {
      if (!res.confirm) return
      const name = (res.content || '').trim()
      if (!name) return
      const result = store.renameBook(book._id, name)
      uni.showToast({ title: result.ok ? '已重命名' : '重命名失败', icon: 'none' })
    },
  })
}

function removeBook(book: WordBookBook) {
  uni.showModal({
    title: '删除词集',
    content: `删除「${book.name}」及其下所有章节和学习页？原词库单词不会删除。`,
    success: res => {
      if (!res.confirm) return
      const result = store.deleteBook(book._id)
      uni.showToast({ title: result.ok ? '已删除' : '删除失败', icon: 'none' })
    },
  })
}
</script>

<style lang="scss" scoped>
.book-container {
  min-height: 100vh;
  padding: 24rpx;
  box-sizing: border-box;
  background: var(--sr-bg);
}

.book-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.book-heading {
  flex: 1;
  min-width: 0;
}

.book-header-actions {
  display: flex;
  align-items: center;
  gap: 16rpx;
  flex-shrink: 0;
}

.header-link {
  font-size: 24rpx;
  color: var(--sr-primary);
}

.book-title {
  display: block;
  font-size: 36rpx;
  font-weight: 600;
  color: var(--sr-text);
}

.book-subtitle {
  display: block;
  margin-top: 6rpx;
  font-size: 24rpx;
  color: var(--sr-text-2);
}

.due-bar {
  margin-bottom: 20rpx;
  padding: 20rpx 24rpx;
  border-radius: 16rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);
}

.due-text {
  font-size: 26rpx;
  color: var(--sr-primary);
}

.empty-tip,
.empty-state {
  padding: 80rpx 0;
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
  line-height: 1.6;
}

.chapter-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.chapter-card {
  padding: 24rpx;
  border-radius: 20rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);
}

.chapter-topline,
.chapter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chapter-order {
  font-size: 22rpx;
  color: var(--sr-primary);
  font-weight: 600;
}

.more {
  font-size: 30rpx;
  color: var(--sr-text-2);
  padding: 0 12rpx;
}

.chapter-name {
  display: block;
  margin: 12rpx 0 8rpx;
  font-size: 32rpx;
  color: var(--sr-text);
  font-weight: 600;
}

.chapter-progress {
  display: block;
  font-size: 24rpx;
  color: var(--sr-text-2);
  margin-bottom: 14rpx;
}

.progress-track {
  height: 10rpx;
  border-radius: 6rpx;
  background: var(--sr-border);
  overflow: hidden;
}

.progress-value {
  height: 100%;
  background: var(--sr-primary);
}

.chapter-actions {
  margin-top: 14rpx;
  justify-content: flex-end;
}

.enter-action {
  font-size: 24rpx;
  color: var(--sr-primary);
}

.primary-btn {
  padding: 0 28rpx;
  height: 64rpx;
  line-height: 64rpx;
  border-radius: 32rpx;
  background: var(--sr-primary);
  color: #fff;
  font-size: 26rpx;

  &.small {
    height: 56rpx;
    line-height: 56rpx;
    font-size: 24rpx;
  }
}
</style>
