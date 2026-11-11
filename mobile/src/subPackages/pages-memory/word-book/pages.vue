<template>
  <view class="book-container" :class="themeClass">
    <view class="book-header">
      <view class="book-heading">
        <text class="back" @click="goBack">‹ 章节列表</text>
        <text class="book-title">{{ chapter?.name || '章节' }}</text>
        <text class="book-subtitle">{{ pages.length }} 个学习页 · 每 {{ levelSize }} 页一关 · 已达成 {{ chapter?.levels?.length || 0 }} 关</text>
      </view>
      <button class="primary-btn small" @click="addPage">＋ 添加学习页</button>
    </view>

    <view v-if="pages.length === 0" class="empty-state">
      <text class="empty-title">还没有学习页</text>
      <text class="empty-desc">去单词页设置筛选条件，点「生成学习页」并选到这一章</text>
      <button class="primary-btn" @click="addPage">去单词页生成</button>
    </view>

    <view v-else class="level-list">
      <view v-for="group in levelGroups" :key="group.index" class="level-group">
        <view class="level-head">
          <text class="level-title">第 {{ group.index }} 关</text>
          <text class="level-meta">{{ group.completed ? '已达成' : completedIn(group) + ' / ' + group.pages.length + ' 页' }}</text>
        </view>
        <view class="page-list">
          <view v-for="page in group.pages" :key="page._id"
                :class="['page-card', { completed: !!page.completedAt }]"
                @click="openPage(page._id)">
            <view class="page-topline">
              <text class="page-order">P{{ page.order }}</text>
              <text class="more" @click.stop="onPageAction(page)">⋯</text>
            </view>
            <text class="page-name">{{ page.name }}</text>
            <text class="page-meta">{{ page.words.length }} 词 · {{ statusOf(page) }}</text>
          </view>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useWordBook } from '@/stores/useWordBook'
import { formatDueLabel, groupPagesIntoLevels, isPageDue } from '@/utils/word-book'
import type { WordBookPage } from '@/types/word-book'

const store = useWordBook()
const bookId = ref('')
const chapterId = ref('')

onLoad((options: any) => {
  bookId.value = String(options?.bookId || '')
  chapterId.value = String(options?.chapterId || '')
})

onShow(() => store.load())

const chapter = computed(() => store.getChapter(chapterId.value))
const pages = computed(() => (chapterId.value ? store.pagesOf(chapterId.value) : []))
const levelSize = computed(() => chapter.value?.levelSize || 5)
const levelGroups = computed(() => groupPagesIntoLevels(pages.value, levelSize.value))

function completedIn(group: { pages: WordBookPage[] }): number {
  return group.pages.filter(page => page.completedAt).length
}

function statusOf(page: WordBookPage): string {
  if (page.completedAt) return '已过关'
  if (isPageDue(page)) return '今天到期'
  return formatDueLabel(page.nextReviewAt)
}

function goBack() {
  uni.navigateBack({ delta: 1 })
}

function openPage(pageId: string) {
  uni.navigateTo({ url: `/subPackages/pages-memory/word-book/page?pageId=${pageId}` })
}

function addPage() {
  store.setPendingTarget({ bookId: bookId.value, chapterId: chapterId.value })
  uni.setStorageSync('sr_wb_open_word_filter', '1')
  uni.switchTab({ url: '/pages/words/words' })
}

function onPageAction(page: WordBookPage) {
  uni.showActionSheet({
    itemList: ['重命名', '删除'],
    success: res => {
      if (res.tapIndex === 0) renamePage(page)
      else if (res.tapIndex === 1) removePage(page)
    },
  })
}

function renamePage(page: WordBookPage) {
  uni.showModal({
    title: '重命名',
    editable: true,
    content: page.name,
    success: res => {
      if (!res.confirm) return
      const name = (res.content || '').trim()
      if (!name) return
      const result = store.renamePage(page._id, name)
      uni.showToast({ title: result.ok ? '已重命名' : '重命名失败', icon: 'none' })
    },
  })
}

function removePage(page: WordBookPage) {
  uni.showModal({
    title: '删除学习页',
    content: `删除「${page.name}」？原词库单词不会删除。`,
    success: res => {
      if (!res.confirm) return
      const result = store.deletePage(page._id)
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

.level-group {
  margin-bottom: 24rpx;
}

.level-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}

.level-title {
  font-size: 26rpx;
  color: var(--sr-text-2);
  font-weight: 600;
}

.level-meta {
  font-size: 22rpx;
  color: var(--sr-text-2);
}

.page-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.page-card {
  padding: 22rpx;
  border-radius: 18rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);

  &.completed {
    border-color: var(--sr-primary);
  }
}

.page-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-order {
  font-size: 22rpx;
  color: var(--sr-primary);
  font-weight: 600;
}

.more {
  font-size: 30rpx;
  color: var(--sr-text-2);
  padding: 0 12rpx;
}

.page-name {
  display: block;
  margin: 8rpx 0 6rpx;
  font-size: 30rpx;
  color: var(--sr-text);
}

.page-meta {
  font-size: 22rpx;
  color: var(--sr-text-2);
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
