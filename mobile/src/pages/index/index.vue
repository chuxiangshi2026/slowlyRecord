<template>
  <view class="home-container">
    <view class="header">
      <text class="title">慢记</text>
      <text class="subtitle">高效记忆，轻松学习</text>
    </view>
    
    <view class="stats-grid">
      <view class="stat-card" @click="goToWords">
        <text class="stat-num">{{ wordCount }}</text>
        <text class="stat-label">单词总数</text>
      </view>
      <view class="stat-card" @click="goToReview">
        <text class="stat-num">{{ reviewCount }}</text>
        <text class="stat-label">待复习</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ streakDays }}</text>
        <text class="stat-label">连续打卡</text>
      </view>
      <view class="stat-card">
        <text class="stat-num">{{ todayLearned }}</text>
        <text class="stat-label">今日学习</text>
      </view>
      <view class="stat-card bank-card" @click="goToWordbank">
        <text class="stat-num bank-name">{{ currentBankName }}</text>
        <text class="stat-label">当前词库 ›</text>
      </view>
    </view>

    <view class="quick-actions">
      <view class="action-title">快速入口</view>
      <view class="action-list">
        <view class="action-item" @click="goToReview">
          <view class="action-icon review">📚</view>
          <text class="action-text">开始复习</text>
        </view>
        <view class="action-item" @click="goToDictation">
          <view class="action-icon dictation">✏️</view>
          <text class="action-text">听写练习</text>
        </view>
        <view class="action-item" @click="goToTranslate">
          <view class="action-icon translate">🌐</view>
          <text class="action-text">快速翻译</text>
        </view>
        <view class="action-item" @click="goToWords">
          <view class="action-icon words">➕</view>
          <text class="action-text">添加单词</text>
        </view>
        <view class="action-item" @click="goToSignin">
          <view class="action-icon signin">📅</view>
          <text class="action-text">每日打卡</text>
        </view>
        <view class="action-item" @click="goToWrongWords">
          <view class="action-icon wrong">❌</view>
          <text class="action-text">错题复习</text>
        </view>
        <view class="action-item" @click="goToWordbank">
          <view class="action-icon wordbank">📚</view>
          <text class="action-text">词库下载</text>
        </view>
        <view class="action-item" @click="goToNumberMemory">
          <view class="action-icon memory">🔢</view>
          <text class="action-text">数字记忆</text>
        </view>
        <view class="action-item" @click="goToTextMemory">
          <view class="action-icon text">📜</view>
          <text class="action-text">诗词记忆</text>
        </view>
        <view class="action-item" @click="goToMemoryTest">
          <view class="action-icon test">🧠</view>
          <text class="action-text">记忆测试</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'

const wordCount = ref(0)
const reviewCount = ref(0)
const streakDays = ref(7)
const todayLearned = ref(12)

const currentBankName = computed(() => {
  const bank = wordsStore.getBankById(wordsStore.currentBankId)
  return bank?.name || '我的词库'
})

const wordsStore = useMobileWords()

onMounted(() => {
  // 不 await，避免阻塞首屏渲染；数据加载后通过 watch 自动更新 UI
  wordsStore.loadWords()
})

// 数据加载完成后自动更新统计
watch(() => wordsStore.wordCount, (count) => {
  wordCount.value = count
})
watch(() => wordsStore.reviewWords.length, (count) => {
  reviewCount.value = count
})

const goToWords = () => {
  uni.switchTab({ url: '/pages/words/words' })
}

const goToReview = () => {
  uni.switchTab({ url: '/pages/review/review' })
}

const goToDictation = () => {
  uni.navigateTo({ url: '/pages/dictation/dictation' })
}

const goToTranslate = () => {
  uni.navigateTo({ url: '/pages/translate/translate' })
}

const goToSignin = () => {
  uni.navigateTo({ url: '/pages/signin/signin' })
}

const goToWrongWords = () => {
  uni.navigateTo({ url: '/pages/wrong-words/wrong-words' })
}

const goToWordbank = () => {
  uni.navigateTo({ url: '/pages/wordbank/wordbank' })
}

const goToNumberMemory = () => {
  uni.navigateTo({ url: '/pages/number-memory/number-memory' })
}

const goToTextMemory = () => {
  uni.navigateTo({ url: '/pages/text-memory/text-memory' })
}

const goToMemoryTest = () => {
  uni.navigateTo({ url: '/pages/memory-test/memory-test' })
}
</script>

<style scoped>
.home-container {
  padding: 20rpx;
  min-height: 100vh;
  background: linear-gradient(180deg, #e3f2fd 0%, #f5f5f5 100%);
}

.header {
  text-align: center;
  padding: 40rpx 0;
}

.title {
  font-size: 48rpx;
  font-weight: bold;
  color: #1976d2;
  display: block;
}

.subtitle {
  font-size: 28rpx;
  color: #666;
  margin-top: 10rpx;
  display: block;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  margin: 30rpx 0;
}

.bank-card {
  grid-column: span 2;
}

.bank-name {
  font-size: 36rpx !important;
  color: #667eea !important;
}

.stat-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  text-align: center;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.1);
}

.stat-num {
  font-size: 48rpx;
  font-weight: bold;
  color: #1976d2;
  display: block;
}

.stat-label {
  font-size: 24rpx;
  color: #666;
  margin-top: 10rpx;
  display: block;
}

.quick-actions {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-top: 20rpx;
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.1);
}

.action-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
}

.action-list {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.action-item {
  text-align: center;
  padding: 20rpx 0;
}

.action-icon {
  width: 80rpx;
  height: 80rpx;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  margin: 0 auto;
  font-size: 32rpx;
  color: #fff;
  font-weight: bold;
}

.action-icon.review { background: #1976d2; }
.action-icon.dictation { background: #7b1fa2; }
.action-icon.translate { background: #388e3c; }
.action-icon.words { background: #f57c00; }
.action-icon.signin { background: #e91e63; }
.action-icon.wrong { background: #d32f2f; }
.action-icon.wordbank { background: #5e35b1; }
.action-icon.memory { background: #00897b; }
.action-icon.text { background: #43a047; }
.action-icon.test { background: #ff7043; }

.action-text {
  font-size: 24rpx;
  color: #666;
  margin-top: 10rpx;
  display: block;
}
</style>
