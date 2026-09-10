<template>
  <view class="palace-list-container">
    <view v-if="!store.loaded" class="loading-tip">加载中...</view>

    <view v-else-if="sortedPalaces.length === 0" class="empty-state">
      <text class="empty-icon">🏛️</text>
      <text class="empty-text">暂无记忆宫殿</text>
      <text class="empty-desc">把要记的内容挂到熟悉的空间位置上，按顺序过一遍</text>
      <button class="create-btn" @click="goCreate">创建你的第一个记忆宫殿</button>
    </view>

    <view v-else class="palace-list">
      <view class="palace-actions">
        <button class="create-btn small" @click="goCreate">＋ 新建宫殿</button>
      </view>
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
          <text class="edit-btn" @click.stop="goEdit(palace._id)">✎</text>
          <text class="delete-btn" @click.stop="confirmDelete(palace._id, palace.name)">×</text>
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

function goCreate() {
  uni.navigateTo({ url: '/subPackages/pages-memory/memory-palace/edit' })
}

function goEdit(palaceId: string) {
  uni.navigateTo({ url: `/subPackages/pages-memory/memory-palace/edit?id=${palaceId}` })
}

function confirmDelete(palaceId: string, name: string) {
  uni.showModal({
    title: '删除宫殿',
    content: `删除「${name}」将同时删除其所有钩子与学习进度，不可恢复`,
    confirmColor: '#c0564f',
    success: (res) => {
      if (res.confirm) {
        store.deletePalace(palaceId)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    },
  })
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

.create-btn {
  margin-top: 40rpx;
  background: #52796f;
  color: #fff;
  font-size: 30rpx;
  border-radius: 44rpx;
  padding: 0 60rpx;
  height: 88rpx;
  line-height: 88rpx;
}

.create-btn.small {
  margin-top: 0;
  margin-bottom: 20rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
  align-self: flex-end;
}

.palace-actions {
  display: flex;
  justify-content: flex-end;
  margin-bottom: 16rpx;
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

.edit-btn {
  font-size: 28rpx;
  color: #52796f;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.delete-btn {
  font-size: 32rpx;
  color: #c0564f;
  width: 44rpx;
  height: 44rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
