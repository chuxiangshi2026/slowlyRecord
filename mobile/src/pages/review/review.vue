<template>
  <view class="review-container">
    <view v-if="!currentWord" class="empty-state">
      <text class="empty-text">{{ emptyTitle }}</text>
      <text class="empty-hint">{{ emptyHint }}</text>
      <button v-if="wordsStore.words.length > 0" class="btn-start-review" @click="startReview">
        开始复习
      </button>
    </view>

    <view v-else class="review-card" :class="{ flipped: isFlipped }">
      <!-- 正面 -->
      <view class="card-front" @click="flipCard">
        <view class="progress">
          <text class="progress-text">{{ currentIndex + 1 }} / {{ reviewWords.length }}</text>
          <view class="progress-bar">
            <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
          </view>
        </view>

        <view class="word-section">
          <text class="word-text">{{ currentWord.word }}</text>
          <text class="phonetic" v-if="currentWord.phonetic">{{ currentWord.phonetic }}</text>
          <text class="flip-hint">点击翻转查看释义</text>
        </view>

        <view class="quick-actions">
          <button class="btn-play" @click.stop="playWord">🔊 发音</button>
        </view>
      </view>

      <!-- 背面 -->
      <view class="card-back">
        <view class="progress">
          <text class="progress-text">{{ currentIndex + 1 }} / {{ reviewWords.length }}</text>
        </view>

        <view class="word-section">
          <text class="word-text">{{ currentWord.word }}</text>
          <text class="word-meaning">{{ currentWord.meaning }}</text>
          <text v-if="currentWord.example" class="word-example">{{ currentWord.example }}</text>
        </view>

        <view class="action-buttons">
          <button class="btn-forget" @click="handleForget">
            <text class="btn-label">😵 忘记</text>
            <text class="btn-hint">重置进度</text>
          </button>
          <button class="btn-hard" @click="handleHard">
            <text class="btn-label">🤔 模糊</text>
            <text class="btn-hint">缩短间隔</text>
          </button>
          <button class="btn-remember" @click="handleRemember">
            <text class="btn-label">😊 记住</text>
            <text class="btn-hint">延长间隔</text>
          </button>
        </view>
      </view>
    </view>

    <!-- 完成弹窗 -->
    <view v-if="showComplete" class="complete-overlay">
      <view class="complete-card">
        <text class="complete-icon">🎉</text>
        <text class="complete-title">复习完成</text>
        <view class="complete-stats">
          <view class="stat">
            <text class="stat-value">{{ reviewWords.length }}</text>
            <text class="stat-label">复习单词</text>
          </view>
          <view class="stat">
            <text class="stat-value success">{{ rememberCount }}</text>
            <text class="stat-label">记住</text>
          </view>
          <view class="stat">
            <text class="stat-value error">{{ forgetCount }}</text>
            <text class="stat-label">忘记</text>
          </view>
        </view>
        <button class="btn-done" @click="finishReview">完成</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { getTtsAdapter } from '@/adapters/tts'

const wordsStore = useMobileWords()
const currentIndex = ref(0)
const isFlipped = ref(false)
const showComplete = ref(false)
const rememberCount = ref(0)
const forgetCount = ref(0)

const reviewWords = computed(() => wordsStore.reviewWords)

const currentWord = computed(() => {
  return reviewWords.value[currentIndex.value]
})

const progressPercent = computed(() => {
  if (reviewWords.value.length === 0) return 0
  return Math.round((currentIndex.value / reviewWords.value.length) * 100)
})

const emptyTitle = computed(() => {
  return wordsStore.words.length === 0 ? '暂无单词' : '暂无待复习单词'
})

const emptyHint = computed(() => {
  return wordsStore.words.length === 0 ? '先去添加一些单词吧' : '所有单词都还没到复习时间'
})

onMounted(() => {
  wordsStore.loadWords()
})

const startReview = () => {
  // 如果有单词但不需要复习，允许手动开始
  if (wordsStore.words.length > 0 && reviewWords.value.length === 0) {
    // 将所有单词设为需要复习
    wordsStore.words.forEach(w => {
      if (!w.needsReview) {
        w.needsReview = true
      }
    })
  }
}

const flipCard = () => {
  isFlipped.value = true
}

const playWord = () => {
  if (currentWord.value?.word) {
    try {
      const tts = getTtsAdapter()
      tts.speak(currentWord.value.word, { lang: 'en-US', rate: 0.8 })
    } catch {
      // TTS 不可用，静默失败
    }
  }
}

const handleRemember = () => {
  if (currentWord.value) {
    wordsStore.markAsRemembered(currentWord.value.id)
    rememberCount.value++
    nextWord()
  }
}

const handleForget = () => {
  if (currentWord.value) {
    wordsStore.markAsForgotten(currentWord.value.id)
    forgetCount.value++
    nextWord()
  }
}

const handleHard = () => {
  if (currentWord.value) {
    // 模糊：稍微降低级别但保留部分进度
    wordsStore.updateWordLevel(currentWord.value.id, Math.max(1, (currentWord.value.level || 1) - 1))
    rememberCount.value++
    nextWord()
  }
}

const nextWord = () => {
  isFlipped.value = false
  if (currentIndex.value < reviewWords.value.length - 1) {
    currentIndex.value++
  } else {
    showComplete.value = true
  }
}

const finishReview = () => {
  showComplete.value = false
  currentIndex.value = 0
  rememberCount.value = 0
  forgetCount.value = 0
  uni.showToast({ title: '复习完成', icon: 'success' })
}
</script>

<style scoped>
.review-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.empty-state {
  text-align: center;
  padding: 60rpx;
  background: rgba(255,255,255,0.95);
  border-radius: 24rpx;
}

.empty-text {
  font-size: 40rpx;
  color: #333;
  display: block;
  font-weight: bold;
}

.empty-hint {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
  display: block;
}

.btn-start-review {
  margin-top: 40rpx;
  background: #667eea;
  color: #fff;
  border-radius: 50rpx;
  height: 90rpx;
  font-size: 32rpx;
  border: none;
}

.review-card {
  background: #fff;
  border-radius: 24rpx;
  min-height: 800rpx;
  position: relative;
  perspective: 1000px;
  overflow: hidden;
}

.card-front, .card-back {
  padding: 60rpx 40rpx;
  min-height: 800rpx;
  display: flex;
  flex-direction: column;
  transition: transform 0.6s;
  backface-visibility: hidden;
}

.card-back {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  transform: rotateY(180deg);
  background: #fff;
}

.review-card.flipped .card-front {
  transform: rotateY(180deg);
}

.review-card.flipped .card-back {
  transform: rotateY(0deg);
}

.progress {
  text-align: center;
  margin-bottom: 40rpx;
}

.progress-text {
  font-size: 26rpx;
  color: #999;
  display: block;
}

.progress-bar {
  height: 8rpx;
  background: #eee;
  border-radius: 4rpx;
  margin-top: 16rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #667eea, #764ba2);
  border-radius: 4rpx;
  transition: width 0.3s;
}

.word-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.word-text {
  font-size: 72rpx;
  font-weight: bold;
  color: #333;
}

.phonetic {
  font-size: 32rpx;
  color: #667eea;
  margin-top: 20rpx;
  font-family: 'Times New Roman', serif;
}

.flip-hint {
  font-size: 26rpx;
  color: #bbb;
  margin-top: 60rpx;
}

.word-meaning {
  font-size: 40rpx;
  color: #333;
  margin-top: 40rpx;
  line-height: 1.6;
}

.word-example {
  font-size: 28rpx;
  color: #999;
  margin-top: 30rpx;
  font-style: italic;
}

.quick-actions {
  display: flex;
  justify-content: center;
  margin-top: 40rpx;
}

.btn-play {
  background: #f0f0f0;
  color: #667eea;
  border-radius: 50rpx;
  padding: 16rpx 40rpx;
  font-size: 28rpx;
  border: none;
}

.action-buttons {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;
}

.btn-forget, .btn-hard, .btn-remember {
  flex: 1;
  height: 140rpx;
  border-radius: 20rpx;
  font-size: 28rpx;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
}

.btn-label {
  font-size: 32rpx;
  display: block;
}

.btn-hint {
  font-size: 22rpx;
  opacity: 0.8;
  display: block;
}

.btn-forget {
  background: #ff5252;
  color: #fff;
}

.btn-hard {
  background: #ffab40;
  color: #fff;
}

.btn-remember {
  background: #4caf50;
  color: #fff;
}

.complete-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.6);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.complete-card {
  background: #fff;
  border-radius: 24rpx;
  padding: 60rpx;
  text-align: center;
  width: 560rpx;
}

.complete-icon {
  font-size: 80rpx;
  display: block;
}

.complete-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
  margin-top: 20rpx;
  display: block;
}

.complete-stats {
  display: flex;
  justify-content: center;
  gap: 40rpx;
  margin: 40rpx 0;
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.stat-value.success {
  color: #4caf50;
}

.stat-value.error {
  color: #ff5252;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.btn-done {
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: #fff;
  border-radius: 50rpx;
  height: 90rpx;
  font-size: 32rpx;
  border: none;
  width: 100%;
}
</style>
