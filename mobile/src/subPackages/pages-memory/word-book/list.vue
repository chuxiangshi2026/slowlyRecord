<template>
  <view class="book-container" :class="themeClass">
    <view class="book-header">
      <view class="book-heading">
        <text class="book-title">词图闯关</text>
        <text class="book-subtitle">完成整章解锁下一章，已过关内容可随时重练</text>
      </view>
      <button class="primary-btn small" @click="goWords">筛选建页</button>
    </view>

    <view v-if="!store.loaded" class="empty-tip">加载中...</view>
    <view v-else-if="store.chapters.length === 0" class="empty-state">
      <text class="empty-title">还没有词图章节</text>
      <text class="empty-desc">在单词页设置词根词缀等筛选，再把结果生成学习页</text>
      <button class="primary-btn" @click="goWords">去单词页</button>
    </view>

    <view v-else class="chapter-list">
      <view
        v-for="(chapter, index) in store.chapters"
        :key="chapter._id"
        class="chapter-card"
        :class="{locked: !store.chapterUnlocked(chapter._id)}"
        @click="openChapter(chapter._id)"
      >
        <view class="chapter-topline">
          <text class="chapter-order">第 {{ index + 1 }} 章</text>
          <text class="chapter-status">{{ statusText(chapter) }}</text>
        </view>
        <text class="chapter-name">{{ chapter.name }}</text>
        <text class="chapter-progress">{{ completedCount(chapter) }} / {{ chapter.pages.length }} 页已过关</text>
        <view class="progress-track"><view class="progress-value" :style="{width: progress(chapter) + '%'}"></view></view>
        <view class="chapter-actions">
          <text class="delete-action" @click.stop="removeChapter(chapter._id, chapter.name)">删除</text>
          <text class="enter-action">{{ store.chapterUnlocked(chapter._id) ? '进入章节 ›' : '先完成上一章' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import {onShow} from '@dcloudio/uni-app'
import {useWordBook} from '@/stores/useWordBook'
import {isWordBookChapterComplete} from '@/utils/word-book'
import type {WordBookChapter} from '@/types/word-book'

const store = useWordBook()
onShow(() => store.load())

function completedCount(chapter: WordBookChapter): number {
  return chapter.pages.filter(page => !!page.completedAt).length
}

function progress(chapter: WordBookChapter): number {
  return chapter.pages.length ? Math.round(completedCount(chapter) / chapter.pages.length * 100) : 0
}

function statusText(chapter: WordBookChapter): string {
  if (isWordBookChapterComplete(chapter)) return '已完成'
  return store.chapterUnlocked(chapter._id) ? '闯关进行中' : '未解锁'
}

function openChapter(chapterId: string) {
  if (!store.chapterUnlocked(chapterId)) {
    uni.showToast({title: '先完成上一章', icon: 'none'})
    return
  }
  uni.navigateTo({url: `/subPackages/pages-memory/word-book/chapter?id=${chapterId}`})
}

function goWords() {
  uni.switchTab({url: '/pages/words/words'})
}

function removeChapter(chapterId: string, name: string) {
  uni.showModal({
    title: '删除章节',
    content: `删除「${name}」及其闯关进度？原词库单词不会删除。`,
    success: res => {
      if (!res.confirm) return
      try {
        const result = store.deleteChapter(chapterId)
        uni.showToast({title: result.ok ? '已删除' : (result.message || '删除失败'), icon: result.ok ? 'success' : 'none'})
      } catch {
        uni.showToast({title: '删除失败，请重试', icon: 'none'})
      }
    },
  })
}
</script>

<style scoped>
.book-container { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: var(--sr-bg); }
.book-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 24rpx; }
.book-heading { flex: 1; display: flex; flex-direction: column; }
.book-title { color: var(--sr-text); font-size: 36rpx; font-weight: bold; }
.book-subtitle { margin-top: 8rpx; color: var(--sr-text-3); font-size: 22rpx; line-height: 1.5; }
.primary-btn { margin-top: 24rpx; padding: 0 36rpx; height: 72rpx; color: var(--sr-on-primary); background: var(--sr-primary); border-radius: 36rpx; font-size: 26rpx; line-height: 72rpx; }
.primary-btn.small { flex-shrink: 0; margin: 0 0 0 16rpx; padding: 0 24rpx; height: 60rpx; font-size: 24rpx; line-height: 60rpx; }
.primary-btn::after { border: none; }
.empty-tip, .empty-state { padding: 100rpx 30rpx; text-align: center; color: var(--sr-text-3); }
.empty-state { display: flex; flex-direction: column; align-items: center; }
.empty-title { color: var(--sr-text); font-size: 30rpx; }
.empty-desc { margin-top: 16rpx; font-size: 24rpx; line-height: 1.6; }
.chapter-list { display: flex; flex-direction: column; gap: 20rpx; }
.chapter-card { padding: 26rpx; background: var(--sr-card); border: 1rpx solid var(--sr-border); border-radius: 18rpx; }
.chapter-card.locked { opacity: 0.58; }
.chapter-topline, .chapter-actions { display: flex; align-items: center; justify-content: space-between; }
.chapter-order { color: var(--sr-primary); font-size: 22rpx; font-weight: bold; }
.chapter-status { color: var(--sr-text-3); font-size: 22rpx; }
.chapter-name { display: block; margin-top: 18rpx; color: var(--sr-text); font-size: 32rpx; font-weight: bold; }
.chapter-progress { display: block; margin-top: 10rpx; color: var(--sr-text-2); font-size: 24rpx; }
.progress-track { height: 12rpx; margin-top: 18rpx; overflow: hidden; background: var(--sr-card-2); border-radius: 6rpx; }
.progress-value { height: 100%; background: var(--sr-primary); border-radius: 6rpx; }
.chapter-actions { margin-top: 18rpx; }
.delete-action { padding: 8rpx 0; color: #c0564f; font-size: 24rpx; }
.enter-action { padding: 8rpx 0; color: var(--sr-primary); font-size: 24rpx; }
</style>
