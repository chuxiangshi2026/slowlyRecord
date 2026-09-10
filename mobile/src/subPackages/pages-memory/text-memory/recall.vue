<template>
  <view class="recall-page">
    <!-- 文章信息 -->
    <view class="article-head">
      <text class="article-title">{{ article?.title || '遮挡回忆' }}</text>
      <text v-if="article?.author" class="article-author">{{ article.author }}</text>
    </view>

    <!-- 操作条 -->
    <view class="toolbar">
      <view class="toolbar-btn" @click="revealAll">
        <text>全部揭示</text>
      </view>
      <view class="toolbar-btn" @click="coverAll">
        <text>重新遮盖</text>
      </view>
      <text class="progress-text">已揭示 {{ revealedCount }}/{{ blocks.length }}</text>
    </view>

    <!-- 正文遮挡块 -->
    <scroll-view scroll-y class="content-scroll">
      <view class="block-list">
        <view
          v-for="(block, idx) in blocks"
          :key="idx"
          class="block"
          :class="{ revealed: revealed[idx] }"
          @click="toggleBlock(idx)"
        >
          <text v-if="revealed[idx]" class="block-text">{{ block }}</text>
          <view v-else class="block-mask">
            <text class="block-mask-hint">点击回忆</text>
          </view>
        </view>
      </view>
      <view class="bottom-placeholder" />
    </scroll-view>

    <!-- 底部自评 -->
    <view class="rate-bar">
      <button class="rate-btn forgot" @click="onRate(false)">
        <text>😅 还没记住</text>
      </button>
      <button class="rate-btn remembered" @click="onRate(true)">
        <text>✅ 记住了</text>
      </button>
    </view>

    <!-- 文章不存在 -->
    <view v-if="!article && loaded" class="empty-state">
      <text class="empty-icon">📭</text>
      <text class="empty-title">文章不存在或已删除</text>
      <button class="empty-back" @click="goBack">返回</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useTextMemory } from '@/stores/useTextMemory'
import type { MobileTextArticle } from '@/stores/useUtils/types'
import { splitContentToBlocks } from './recall'

const store = useTextMemory()

const article = ref<MobileTextArticle | null>(null)
const loaded = ref(false)
const revealed = ref<boolean[]>([])

const blocks = computed(() =>
  article.value ? splitContentToBlocks(article.value.content) : [],
)

const revealedCount = computed(() => revealed.value.filter(Boolean).length)

onLoad((opt: any) => {
  store.load()
  const id = opt?.id ? decodeURIComponent(opt.id) : ''
  const found = store.articles.find((a) => a._id === id)
  if (found) {
    article.value = found
    revealed.value = blocks.value.map(() => false)
  }
  loaded.value = true
})

function toggleBlock(idx: number) {
  revealed.value[idx] = !revealed.value[idx]
}

function revealAll() {
  revealed.value = blocks.value.map(() => true)
}

function coverAll() {
  revealed.value = blocks.value.map(() => false)
}

function onRate(remembered: boolean) {
  if (!article.value) return
  store.rateArticle(article.value._id, remembered)
  uni.showToast({ title: remembered ? '太棒了，已记录' : '没关系，下次再来', icon: 'none' })
  setTimeout(() => uni.navigateBack(), 600)
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.recall-page {
  min-height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.article-head {
  background: linear-gradient(135deg, #52796f 0%, #3d5a52 100%);
  padding: 50rpx 40rpx 32rpx;
}
.article-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}
.article-author {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 8rpx;
  display: block;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  background: #fff;
  border-bottom: 1rpx solid #eef0f2;
}
.toolbar-btn {
  padding: 10rpx 26rpx;
  background: #eef3f0;
  color: #52796f;
  border-radius: 28rpx;
  font-size: 24rpx;
}
.progress-text {
  margin-left: auto;
  font-size: 22rpx;
  color: #999;
}

.content-scroll {
  flex: 1;
  height: calc(100vh - 380rpx);
}
.block-list {
  padding: 24rpx;
}
.block {
  margin-bottom: 16rpx;
}
.block-text {
  font-size: 30rpx;
  color: #303030;
  line-height: 1.9;
  display: block;
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
}
.block-mask {
  height: 88rpx;
  border-radius: 12rpx;
  background: rgba(82, 121, 111, 0.18);
  border: 1rpx dashed rgba(82, 121, 111, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
}
.block-mask-hint {
  font-size: 24rpx;
  color: rgba(82, 121, 111, 0.6);
}
.bottom-placeholder {
  height: 160rpx;
}

.rate-bar {
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx 24rpx calc(20rpx + env(safe-area-inset-bottom));
  background: #fff;
  box-shadow: 0 -2rpx 12rpx rgba(0, 0, 0, 0.06);
}
.rate-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: none;
  margin: 0;
}
.rate-btn.forgot {
  background: #f5f5f5;
  color: #666;
}
.rate-btn.remembered {
  background: #52796f;
  color: #fff;
}

.empty-state {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.empty-icon {
  font-size: 80rpx;
  margin-bottom: 16rpx;
}
.empty-title {
  font-size: 28rpx;
  color: #666;
  margin-bottom: 24rpx;
}
.empty-back {
  width: 240rpx;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 38rpx;
  background: #52796f;
  color: #fff;
  font-size: 28rpx;
  border: none;
}
</style>
