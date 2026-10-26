<template>
  <view class="palace-list-container" :class="themeClass">
    <view v-if="!store.loaded" class="loading-tip">加载中...</view>

    <view v-else>
      <view class="example-section">
        <view class="example-heading">
          <view class="example-heading-main">
            <text class="example-title">跟着图解案例建宫殿</text>
            <text class="example-subtitle">熟悉位置 → 夸张联想 → 沿原路线回忆</text>
          </view>
          <text class="example-toggle" @click="examplesExpanded = !examplesExpanded">{{ examplesExpanded ? '收起' : '查看案例' }}</text>
        </view>
        <view v-if="examplesExpanded" class="example-list">
          <view v-for="example in PALACE_EXAMPLES" :key="example.id" class="example-card">
            <image class="example-image" :src="example.image" mode="aspectFit" />
            <view class="example-info">
              <text class="example-name">{{ example.title }}</text>
              <text class="example-desc">{{ example.description }}</text>
              <text class="example-usage">{{ example.usage }}</text>
              <button class="example-use" :disabled="!!creatingExample" @click="useExample(example)">
                {{ creatingExample === example.id ? '创建中…' : '用这个案例' }}
              </button>
            </view>
          </view>
        </view>
      </view>

      <view v-if="sortedPalaces.length === 0" class="empty-state">
        <text class="empty-icon">🏛️</text>
        <text class="empty-text">还没有自己的宫殿</text>
        <text class="empty-desc">可直接使用上方案例，或从头选择熟悉的地点</text>
        <button class="create-btn" @click="goCreate">自己建一座</button>
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
              {{ palace.loci.length }} 个桩 · 已挂载 {{ mountedCount(palace._id) }}
            </text>
            <text class="palace-time">更新于 {{ formatTime(palace.utime) }}</text>
          </view>
          <view class="palace-side">
            <view v-if="dueCountOf(palace._id) > 0" class="due-badge">
              <text>{{ dueCountOf(palace._id) }} 个桩待过一遍</text>
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
  </view>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { useMemoryPalace } from '@/stores/useMemoryPalace'
import { pegPackToLoci } from '@/utils/memory-palace'
import { getPegPack } from '../utils/peg-packs'
import { PALACE_EXAMPLES, type MobilePalaceExample } from './examples'

// 记忆宫殿列表（查看版）：展示名称 / 桩数 / 待过一遍状态，点击进过一遍页
const store = useMemoryPalace()
store.load()

const examplesExpanded = ref(true)
const creatingExample = ref('')

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

function useExample(example: MobilePalaceExample) {
  if (creatingExample.value) return
  creatingExample.value = example.id
  try {
    const loci = pegPackToLoci(getPegPack(example.packId)).map((locus, index) => ({
      order: index + 1,
      name: locus.name,
      description: locus.description,
      imageUrl: locus.imageUrl,
    }))
    const palace = store.createPalace(example.title, loci, example.packId)
    uni.showToast({ title: '案例已创建，点击桩挂内容', icon: 'none' })
    goReview(palace._id)
  } catch {
    uni.showToast({ title: '案例创建失败，请重试', icon: 'none' })
  } finally {
    creatingExample.value = ''
  }
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
    content: `删除「${name}」将同时删除其所有桩与学习进度，不可恢复`,
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
  background: var(--sr-bg);
  padding: 20rpx;
}

.example-section {
  margin-bottom: 24rpx;
}

.example-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 16rpx;
}

.example-heading-main {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.example-title {
  color: var(--sr-text);
  font-size: 30rpx;
  font-weight: bold;
}

.example-subtitle {
  margin-top: 6rpx;
  color: var(--sr-text-3);
  font-size: 22rpx;
}

.example-toggle {
  padding: 12rpx 0 12rpx 20rpx;
  color: var(--sr-primary);
  font-size: 24rpx;
}

.example-card {
  display: flex;
  overflow: hidden;
  margin-bottom: 16rpx;
  background: var(--sr-card);
  border: 1rpx solid var(--sr-border);
  border-radius: 16rpx;
}

.example-image {
  width: 220rpx;
  height: 220rpx;
  flex-shrink: 0;
  align-self: center;
  background: var(--sr-card-2);
}

.example-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 16rpx 18rpx;
}

.example-name {
  color: var(--sr-text);
  font-size: 28rpx;
  font-weight: bold;
}

.example-desc,
.example-usage {
  margin-top: 6rpx;
  font-size: 22rpx;
  line-height: 1.45;
}

.example-desc {
  color: var(--sr-text-2);
}

.example-usage {
  color: var(--sr-text-3);
}

.example-use {
  align-self: flex-start;
  height: 50rpx;
  margin: 10rpx 0 0;
  padding: 0 22rpx;
  color: var(--sr-primary);
  background: var(--sr-card-2);
  border: 1rpx solid var(--sr-primary);
  border-radius: 26rpx;
  font-size: 22rpx;
  line-height: 48rpx;
}

.example-use::after {
  border: none;
}

.example-use[disabled] {
  opacity: 0.6;
}

.loading-tip {
  text-align: center;
  color: var(--sr-text-3);
  font-size: 28rpx;
  padding: 60rpx 0;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 50rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.empty-text {
  font-size: 32rpx;
  color: var(--sr-text);
  margin-bottom: 12rpx;
}

.empty-desc {
  font-size: 26rpx;
  color: var(--sr-text-3);
  text-align: center;
  line-height: 1.6;
}

.create-btn {
  margin-top: 40rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
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
  background: var(--sr-card);
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
  color: var(--sr-text);
}

.palace-meta {
  font-size: 26rpx;
  color: var(--sr-text-2);
  margin-top: 8rpx;
}

.palace-time {
  font-size: 24rpx;
  color: var(--sr-text-3);
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

/* 浅橙底在暗色下刺眼：保留亮色值，追加暗色覆盖 */
.theme-dark .due-badge {
  background: rgba(192, 122, 43, 0.18);
}

.due-badge text {
  font-size: 24rpx;
  color: #c07a2b;
}

.theme-dark .due-badge text {
  color: #dba15c;
}

.due-clear text {
  font-size: 24rpx;
  color: var(--sr-primary);
}

.palace-arrow {
  font-size: 36rpx;
  color: var(--sr-text-3);
}

.edit-btn {
  font-size: 28rpx;
  color: var(--sr-primary);
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
