<template>
  <view class="palace-list-container">
    <view v-if="!store.loaded" class="loading-tip">加载中...</view>

    <view v-else-if="sortedPalaces.length === 0" class="empty-state">
      <text class="empty-icon">🏛️</text>
      <text class="empty-text">暂无记忆宫殿</text>
      <text class="empty-desc">请在桌面端创建宫殿后，通过「数据同步」拉取到移动端</text>
    </view>

    <view v-else class="palace-list">
      <view
        v-for="palace in sortedPalaces"
        :key="palace._id"
        class="palace-card"
        @click="goReview(palace._id)"
      >
        <view class="palace-main">
          <text class="palace-name">{{ palace.name }}</text>
          <text class="palace-meta">
            {{ palace.loci.length }} 个钩子 · 已挂上 {{ mountedCount(palace._id) }}
          </text>
          <text class="palace-time">更新于 {{ formatTime(palace.utime) }}</text>
        </view>
        <view class="palace-side">
          <view v-if="dueCountOf(palace._id) > 0" class="due-badge">
            <text>{{ dueCountOf(palace._id) }} 个钩子待过一遍</text>
          </view>
          <view v-else class="due-clear">
            <text>✓ 已过一遍</text>
          </view>
          <text class="palace-arrow">›</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useMemoryPalace } from '@/stores/useMemoryPalace'

// 记忆宫殿列表（查看版）：展示名称 / 桩数 / 待巡视状态，点击进巡视页
const store = useMemoryPalace()
store.load()

const sortedPalaces = computed(() =>
  [...store.palaces].sort((a, b) => b.utime - a.utime),
)

function mountedCount(palaceId: string): number {
  return store.pegsOf(palaceId).length
}

function dueCountOf(palaceId: string): number {
  return store.dueCount(palaceId)
}

function formatTime(ts: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

function goReview(palaceId: string) {
  uni.navigateTo({ url: `/subPackages/pages-memory/memory-palace/review?palaceId=${palaceId}` })
}
</script>

<style scoped>
.palace-list-container {
  min-height: 100vh;
  background: #f5f7f5;
  padding: 20rpx;
}

.loading-tip {
  text-align: center;
  color: #999;
  font-size: 28rpx;
  padding: 60rpx 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 32rpx;
  color: #333;
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 26rpx;
  color: #999;
  text-align: center;
  line-height: 1.6;
}

.palace-list {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}

.palace-card {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.palace-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.palace-name {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.palace-meta {
  font-size: 26rpx;
  color: #666;
  margin-top: 8rpx;
}

.palace-time {
  font-size: 24rpx;
  color: #aaa;
  margin-top: 6rpx;
}

.palace-side {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.due-badge {
  background: #fdf3e7;
  border-radius: 24rpx;
  padding: 8rpx 20rpx;
}

.due-badge text {
  font-size: 24rpx;
  color: #c07a2b;
}

.due-clear text {
  font-size: 24rpx;
  color: #52796f;
}

.palace-arrow {
  font-size: 36rpx;
  color: #ccc;
}
</style>
