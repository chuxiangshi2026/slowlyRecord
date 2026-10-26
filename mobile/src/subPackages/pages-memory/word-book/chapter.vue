<template>
  <view class="chapter-container" :class="themeClass">
    <view v-if="chapter" class="chapter-header">
      <text class="chapter-name">{{ chapter.name }}</text>
      <text class="chapter-progress">{{ completedCount }} / {{ chapter.pages.length }} 页已过关 · 按顺序挑战</text>
    </view>
    <view v-if="!store.loaded" class="empty-tip">加载中...</view>
    <view v-else-if="!chapter" class="empty-tip">章节不存在或已删除</view>
    <view v-else-if="!store.chapterUnlocked(chapterId)" class="empty-state">
      <text class="empty-title">本章尚未解锁</text>
      <text class="empty-desc">先完成上一章的全部学习页</text>
    </view>
    <view v-else class="page-list">
      <view
        v-for="page in chapter.pages"
        :key="page.id"
        class="page-card"
        :class="{locked: !store.pageUnlocked(chapterId, page.id), completed: !!page.completedAt}"
        @click="openPage(page.id)"
      >
        <view class="page-topline">
          <text class="page-order">第 {{ page.order }} 页</text>
          <text class="page-status">{{ statusText(page.id, page.completedAt) }}</text>
        </view>
        <text class="page-name">{{ page.title }}</text>
        <text class="word-preview">{{ preview(page.words.map(word => word.text)) }}</text>
        <view class="page-bottom">
          <text class="page-meta">{{ page.words.length }} 词<template v-if="page.bestScore !== undefined"> · 最佳 {{ page.bestScore }} 分</template></text>
          <text class="page-action">{{ page.completedAt ? '再学一遍 ›' : '开始学习 ›' }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {onLoad, onShow} from '@dcloudio/uni-app'
import {useWordBook} from '@/stores/useWordBook'

const store = useWordBook()
const chapterId = ref('')
const chapter = computed(() => store.getChapter(chapterId.value))
const completedCount = computed(() => chapter.value?.pages.filter(page => !!page.completedAt).length || 0)

onLoad(query => { chapterId.value = String(query?.id || '') })
onShow(() => store.load())

function preview(words: string[]): string {
  return words.slice(0, 6).join(' · ') + (words.length > 6 ? ' …' : '')
}

function statusText(pageId: string, completedAt?: number): string {
  if (completedAt) return '已过关'
  return store.pageUnlocked(chapterId.value, pageId) ? '待挑战' : '未解锁'
}

function openPage(pageId: string) {
  if (!store.pageUnlocked(chapterId.value, pageId)) {
    uni.showToast({title: '先完成前一页', icon: 'none'})
    return
  }
  uni.navigateTo({url: `/subPackages/pages-memory/word-book/page?chapterId=${chapterId.value}&pageId=${pageId}`})
}
</script>

<style scoped>
.chapter-container { min-height: 100vh; padding: 24rpx; box-sizing: border-box; background: var(--sr-bg); }
.chapter-header { display: flex; flex-direction: column; margin-bottom: 24rpx; }
.chapter-name { color: var(--sr-text); font-size: 34rpx; font-weight: bold; }
.chapter-progress { margin-top: 8rpx; color: var(--sr-text-3); font-size: 24rpx; }
.empty-tip, .empty-state { padding: 100rpx 30rpx; text-align: center; color: var(--sr-text-3); }
.empty-state { display: flex; flex-direction: column; }
.empty-title { color: var(--sr-text); font-size: 30rpx; }
.empty-desc { margin-top: 16rpx; font-size: 24rpx; }
.page-list { display: flex; flex-direction: column; gap: 20rpx; }
.page-card { padding: 26rpx; background: var(--sr-card); border: 1rpx solid var(--sr-border); border-radius: 18rpx; }
.page-card.completed { border-color: var(--sr-primary); }
.page-card.locked { opacity: 0.55; }
.page-topline, .page-bottom { display: flex; align-items: center; justify-content: space-between; }
.page-order { color: var(--sr-primary); font-size: 22rpx; font-weight: bold; }
.page-status { color: var(--sr-text-3); font-size: 22rpx; }
.page-name { display: block; margin-top: 16rpx; color: var(--sr-text); font-size: 30rpx; font-weight: bold; }
.word-preview { display: block; margin-top: 12rpx; color: var(--sr-text-2); font-size: 24rpx; line-height: 1.6; }
.page-bottom { margin-top: 18rpx; }
.page-meta { color: var(--sr-text-3); font-size: 22rpx; }
.page-action { color: var(--sr-primary); font-size: 24rpx; }
</style>
