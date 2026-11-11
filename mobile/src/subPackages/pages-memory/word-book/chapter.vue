<template>
  <view class="book-container" :class="themeClass">
    <view class="book-header">
      <view class="book-heading">
        <text class="back" @click="goBooks">‹ 词集列表</text>
        <text class="book-title">{{ book?.name || '词集' }}</text>
        <text class="book-subtitle">章节是词集里的主题（一个词根、一个音标），每个章节下可以放多个学习页</text>
      </view>
      <button class="primary-btn small" @click="createChapter">新建章节</button>
    </view>

    <view v-if="chapters.length === 0" class="empty-state">
      <text class="empty-title">还没有章节</text>
      <text class="empty-desc">先新建一个主题，再去单词页筛选生成学习页</text>
      <button class="primary-btn" @click="createChapter">新建章节</button>
    </view>

    <view v-else class="chapter-list">
      <view v-for="chapter in chapters" :key="chapter._id" class="chapter-card" @click="openChapter(chapter._id)">
        <view class="chapter-topline">
          <text class="chapter-order">章节</text>
          <text class="more" @click.stop="onChapterAction(chapter)">⋯</text>
        </view>
        <text class="chapter-name">{{ chapter.name }}</text>
        <text class="chapter-progress">{{ summaryOf(chapter._id) }}</text>
        <view class="progress-track">
          <view class="progress-value" :style="{width: progressOf(chapter._id) + '%'}"></view>
        </view>
        <view class="chapter-actions">
          <text class="enter-action" @click.stop="addPage(chapter._id)">＋ 添加学习页</text>
          <text class="enter-action">进入 ›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useWordBook } from '@/stores/useWordBook'
import type { WordBookChapter } from '@/types/word-book'

const store = useWordBook()
const bookId = ref('')

onLoad((options: any) => {
  bookId.value = String(options?.bookId || '')
})

onShow(() => store.load())

const book = computed(() => store.getBook(bookId.value))
const chapters = computed(() => (bookId.value ? store.chaptersOf(bookId.value) : []))

function pagesOf(chapterId: string) {
  return store.pagesOf(chapterId)
}

function summaryOf(chapterId: string): string {
  const pages = pagesOf(chapterId)
  return `${pages.length} 个学习页 · 已完成 ${pages.filter(page => page.completedAt).length} 个`
}

function progressOf(chapterId: string): number {
  const pages = pagesOf(chapterId)
  if (!pages.length) return 0
  return Math.round(pages.filter(page => page.completedAt).length / pages.length * 100)
}

function goBooks() {
  uni.navigateBack({ delta: 1 })
}

function openChapter(chapterId: string) {
  uni.navigateTo({ url: `/subPackages/pages-memory/word-book/pages?bookId=${bookId.value}&chapterId=${chapterId}` })
}

function addPage(chapterId: string) {
  store.setPendingTarget({ bookId: bookId.value, chapterId })
  uni.setStorageSync('sr_wb_open_word_filter', '1')
  uni.switchTab({ url: '/pages/words/words' })
}

function createChapter() {
  uni.showModal({
    title: '新建章节',
    editable: true,
    placeholderText: '如：词根 old',
    success: res => {
      if (!res.confirm) return
      const name = (res.content || '').trim()
      if (!name) return
      const chapter = store.createChapter(bookId.value, name)
      if (!chapter) {
        uni.showToast({ title: '创建章节失败', icon: 'none' })
        return
      }
      uni.navigateTo({ url: `/subPackages/pages-memory/word-book/pages?bookId=${bookId.value}&chapterId=${chapter._id}` })
    },
  })
}

function onChapterAction(chapter: WordBookChapter) {
  uni.showActionSheet({
    itemList: ['重命名', '每关页数', '删除'],
    success: res => {
      if (res.tapIndex === 0) renameChapter(chapter)
      else if (res.tapIndex === 1) setLevelSize(chapter)
      else if (res.tapIndex === 2) removeChapter(chapter)
    },
  })
}

function renameChapter(chapter: WordBookChapter) {
  uni.showModal({
    title: '重命名',
    editable: true,
    content: chapter.name,
    success: res => {
      if (!res.confirm) return
      const name = (res.content || '').trim()
      if (!name) return
      const result = store.renameChapter(chapter._id, name)
      uni.showToast({ title: result.ok ? '已重命名' : '重命名失败', icon: 'none' })
    },
  })
}

function setLevelSize(chapter: WordBookChapter) {
  uni.showModal({
    title: '每关页数',
    editable: true,
    content: String(chapter.levelSize || 5),
    success: res => {
      if (!res.confirm) return
      const size = Math.max(1, Number(res.content) || 5)
      const result = store.setChapterLevelSize(chapter._id, size)
      uni.showToast({ title: result.ok ? '已更新' : '更新失败', icon: 'none' })
    },
  })
}

function removeChapter(chapter: WordBookChapter) {
  uni.showModal({
    title: '删除章节',
    content: `删除「${chapter.name}」及其下所有学习页？原词库单词不会删除。`,
    success: res => {
      if (!res.confirm) return
      const result = store.deleteChapter(chapter._id)
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

.back {
  display: block;
  font-size: 24rpx;
  color: var(--sr-primary);
  margin-bottom: 8rpx;
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

.enter-action {
  font-size: 24rpx;
  color: var(--sr-primary);
  padding: 10rpx 0;
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
