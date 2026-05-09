<template>
  <view class="review-container">
    <view v-if="!currentWord" class="empty-state">
      <text class="empty-text">{{ emptyTitle }}</text>
      <text class="empty-hint">{{ emptyHint }}</text>
      <button v-if="wordsStore.words.length > 0" class="btn-start-review" @click="startReview">
        开始复习
      </button>
      <button v-if="wordsStore.words.length === 0" class="btn-start-review" @click="goToWords">
        去添加单词
      </button>
    </view>

    <view v-else class="review-area">
      <!-- 进度 -->
      <view class="progress-bar-top">
        <text class="progress-text">{{ currentIndex + 1 }} / {{ reviewWords.length }}</text>
        <view class="progress-track">
          <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
        </view>
      </view>

      <!-- 手势提示 -->
      <view class="gesture-hints">
        <text class="hint-left">左划 忘记</text>
        <text class="hint-down">下划 永久记住</text>
        <text class="hint-right">右划 记住</text>
      </view>

      <!-- 卡片（微信小程序用 catchtouch 阻止页面滚动） -->
      <view
        class="card-wrapper"
        @catchtouchstart="handleTouchStart"
        @catchtouchmove="handleTouchMove"
        @catchtouchend="handleTouchEnd"
        @catchlongpress="handleLongPress"
      >
        <!-- 正面 -->
        <view
          v-if="!isFlipped"
          class="review-card card-front"
          :class="{ swiping: isSwiping }"
          :style="cardStyle"
          @tap="onCardTap"
        >
          <view class="word-section">
            <text class="word-text">{{ currentWord.word }}</text>
            <text class="phonetic" v-if="currentWord.phonetic">{{ currentWord.phonetic }}</text>
            <text class="flip-hint">点击翻转 / 长按删除</text>
          </view>
          <view class="quick-actions">
            <button class="btn-play" @tap.stop="playWord">🔊 发音</button>
          </view>
          <!-- 划动视觉反馈 -->
          <view v-if="swipeDirection === 'left'" class="swipe-overlay left">
            <text class="swipe-icon">❌</text>
            <text class="swipe-text">忘记</text>
          </view>
          <view v-if="swipeDirection === 'right'" class="swipe-overlay right">
            <text class="swipe-icon">✅</text>
            <text class="swipe-text">记住</text>
          </view>
          <view v-if="swipeDirection === 'down'" class="swipe-overlay down">
            <text class="swipe-icon">⭐</text>
            <text class="swipe-text">永久记住</text>
          </view>
        </view>

        <!-- 背面 -->
        <view
          v-else
          class="review-card card-back"
          :class="{ swiping: isSwiping }"
          :style="cardStyle"
          @tap="onCardTap"
        >
          <view class="word-section">
            <text class="word-text">{{ currentWord.word }}</text>
            <text class="word-meaning">{{ displayMeaning }}</text>
            <text v-if="currentWord.example" class="word-example">{{ currentWord.example }}</text>
            <text v-if="offlineDictMeaning && offlineDictMeaning !== currentWord.meaning" class="offline-meaning">
              📚 离线释义：{{ offlineDictMeaning }}
            </text>
          </view>
          <view class="gesture-guide">
            <view class="guide-item left">
              <text class="guide-arrow">←</text>
              <text class="guide-label">忘记</text>
            </view>
            <view class="guide-item down">
              <text class="guide-arrow">↓</text>
              <text class="guide-label">永久记住</text>
            </view>
            <view class="guide-item right">
              <text class="guide-arrow">→</text>
              <text class="guide-label">记住</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 操作按钮 -->
      <view class="action-buttons">
        <button class="btn-forget" @click="handleForget">
          <text class="btn-label">忘记</text>
        </button>
        <button class="btn-remember-forever" @click="handleRememberForever">
          <text class="btn-label">永久记住</text>
        </button>
        <button class="btn-remember" @click="handleRemember">
          <text class="btn-label">记住</text>
        </button>
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

    <!-- 长按删除确认 -->
    <view v-if="showDeleteConfirm" class="complete-overlay">
      <view class="complete-card">
        <text class="complete-title">确认删除</text>
        <text class="delete-word">{{ currentWord?.word }}</text>
        <text class="delete-hint">删除后将无法恢复</text>
        <view class="popup-actions">
          <button class="btn-cancel" @click="showDeleteConfirm = false">取消</button>
          <button class="btn-confirm-delete" @click="confirmDelete">删除</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'
import { getTtsAdapter } from '@/adapters/index'
import { queryOfflineDict } from '@/stores/useUtils'

const wordsStore = useMobileWords()
const currentIndex = ref(0)
const isFlipped = ref(false)
const showComplete = ref(false)
const showDeleteConfirm = ref(false)
const rememberCount = ref(0)
const forgetCount = ref(0)

// 手势状态
const touchStartX = ref(0)
const touchStartY = ref(0)
const touchStartTime = ref(0)
const cardOffsetX = ref(0)
const cardOffsetY = ref(0)
const cardRotate = ref(0)
const isAnimating = ref(false)
const isSwiping = ref(false)
const swipeDirection = ref<'left' | 'right' | 'down' | ''>('')

const reviewWords = computed(() => wordsStore.reviewWords)

const currentWord = computed(() => {
  return reviewWords.value[currentIndex.value]
})

const progressPercent = computed(() => {
  if (reviewWords.value.length === 0) return 0
  return Math.round(((currentIndex.value) / reviewWords.value.length) * 100)
})

const emptyTitle = computed(() => {
  return wordsStore.words.length === 0 ? '暂无单词' : '暂无待复习单词'
})

const emptyHint = computed(() => {
  return wordsStore.words.length === 0 ? '先去添加一些单词吧' : '所有单词都还没到复习时间'
})

// 离线词典释义（优先显示）
const offlineDictMeaning = computed(() => {
  if (!currentWord.value) return ''
  const dict = queryOfflineDict(currentWord.value.word)
  return dict || ''
})

// 显示的释义：优先离线词典，其次用户保存的释义
const displayMeaning = computed(() => {
  if (!currentWord.value) return ''
  return offlineDictMeaning.value || currentWord.value.meaning || '暂无释义'
})

// 卡片样式（手势位移）
const cardStyle = computed(() => {
  if (isAnimating.value) {
    return {
      transform: `translateX(${cardOffsetX.value}px) translateY(${cardOffsetY.value}px) rotate(${cardRotate.value}deg)`,
      transition: 'transform 0.3s ease-out',
      opacity: Math.max(0.3, 1 - Math.abs(cardOffsetX.value) / 300),
    }
  }
  return {
    transform: `translateX(${cardOffsetX.value}px) translateY(${cardOffsetY.value}px) rotate(${cardRotate.value}deg)`,
    transition: cardOffsetX.value === 0 && cardOffsetY.value === 0 ? 'transform 0.3s ease-out' : 'none',
  }
})

onMounted(() => {
  wordsStore.loadWords()
})

const startReview = () => {
  if (wordsStore.words.length > 0 && reviewWords.value.length === 0) {
    const all = wordsStore.words
    for (let i = 0; i < all.length; i++) {
      const w = all[i]
      if (!w.needsReview) {
        wordsStore.updateWord(w.id, { needsReview: true })
      }
    }
  }
}

const goToWords = () => {
  uni.switchTab({ url: '/pages/words/words' })
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

// ==================== 手势处理（微信小程序兼容）====================

const handleTouchStart = (e: any) => {
  if (isAnimating.value) return
  const t = e.touches[0]
  touchStartX.value = t.clientX
  touchStartY.value = t.clientY
  touchStartTime.value = Date.now()
  isSwiping.value = false
  swipeDirection.value = ''
}

const handleTouchMove = (e: any) => {
  if (isAnimating.value) return
  const t = e.touches[0]
  const deltaX = t.clientX - touchStartX.value
  const deltaY = t.touches[0].clientY - touchStartY.value
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  // 超过阈值才开始响应
  if (absX > 10 || absY > 10) {
    isSwiping.value = true
  }

  // 限制位移范围
  cardOffsetX.value = deltaX * 0.6
  cardOffsetY.value = deltaY > 0 ? deltaY * 0.6 : deltaY * 0.3
  cardRotate.value = deltaX * 0.03

  // 实时显示划动方向
  if (absX > absY && absX > 40) {
    swipeDirection.value = deltaX > 0 ? 'right' : 'left'
  } else if (absY > absX && absY > 40 && deltaY > 0) {
    swipeDirection.value = 'down'
  } else {
    swipeDirection.value = ''
  }
}

const handleTouchEnd = (e: any) => {
  if (isAnimating.value) return
  const t = e.changedTouches[0]
  const deltaX = t.clientX - touchStartX.value
  const deltaY = t.clientY - touchStartY.value
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)
  const duration = Date.now() - touchStartTime.value

  // 快速点击（短位移+短时间）= 翻转卡片
  if (absX < 30 && absY < 30 && duration < 300) {
    isSwiping.value = false
    swipeDirection.value = ''
    resetCard()
    flipCard()
    return
  }

  // 判断手势方向
  if (absX > absY && absX > 80) {
    if (deltaX > 0) {
      animateCard('right', () => handleRemember())
    } else {
      animateCard('left', () => handleForget())
    }
  } else if (absY > absX && absY > 80 && deltaY > 0) {
    animateCard('down', () => handleRememberForever())
  } else {
    resetCard()
  }
  isSwiping.value = false
  swipeDirection.value = ''
}

const onCardTap = () => {
  // tap 事件在划动时不应触发
  if (!isSwiping.value && !isAnimating.value) {
    flipCard()
  }
}

const flipCard = () => {
  isFlipped.value = !isFlipped.value
}

// 长按删除
const handleLongPress = () => {
  if (currentWord.value) {
    showDeleteConfirm.value = true
  }
}

const confirmDelete = () => {
  if (currentWord.value) {
    wordsStore.deleteWord(currentWord.value.id)
    showDeleteConfirm.value = false
    uni.showToast({ title: '已删除', icon: 'success' })
    if (currentIndex.value >= reviewWords.value.length) {
      currentIndex.value = Math.max(0, reviewWords.value.length - 1)
      isFlipped.value = false
    }
  }
}

// 动画卡片滑出
const animateCard = (direction: 'left' | 'right' | 'down', callback: () => void) => {
  isAnimating.value = true
  if (direction === 'right') {
    cardOffsetX.value = 400
    cardRotate.value = 20
  } else if (direction === 'left') {
    cardOffsetX.value = -400
    cardRotate.value = -20
  } else if (direction === 'down') {
    cardOffsetY.value = 500
  }

  setTimeout(() => {
    callback()
    cardOffsetX.value = 0
    cardOffsetY.value = 0
    cardRotate.value = 0
    isAnimating.value = false
  }, 300)
}

const resetCard = () => {
  cardOffsetX.value = 0
  cardOffsetY.value = 0
  cardRotate.value = 0
}

// ==================== 操作处理 ====================

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

const handleRememberForever = () => {
  if (currentWord.value) {
    wordsStore.updateWord(currentWord.value.id, {
      remembered: true,
      needsReview: false,
      nextReviewTime: Date.now() + 100 * 365 * 24 * 60 * 60 * 1000,
      level: 14
    })
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
  padding: 20rpx;
  display: flex;
  flex-direction: column;
}

.empty-state {
  text-align: center;
  padding: 60rpx;
  background: rgba(255,255,255,0.95);
  border-radius: 24rpx;
  margin: auto;
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

/* 复习区域 */
.review-area {
  flex: 1;
  display: flex;
  flex-direction: column;
}

.progress-bar-top {
  padding: 20rpx 0;
}

.progress-text {
  font-size: 26rpx;
  color: rgba(255,255,255,0.9);
  text-align: center;
  display: block;
}

.progress-track {
  height: 8rpx;
  background: rgba(255,255,255,0.3);
  border-radius: 4rpx;
  margin-top: 16rpx;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 4rpx;
  transition: width 0.3s;
}

/* 手势提示 */
.gesture-hints {
  display: flex;
  justify-content: space-between;
  padding: 10rpx 20rpx;
  margin-bottom: 10rpx;
}

.hint-left, .hint-down, .hint-right {
  font-size: 22rpx;
  color: rgba(255,255,255,0.7);
}

.hint-left { color: #ffab40; }
.hint-down { color: #69f0ae; }
.hint-right { color: #4caf50; }

/* 卡片容器 */
.card-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20rpx;
  touch-action: none;
}

.review-card {
  background: #fff;
  border-radius: 24rpx;
  width: 100%;
  max-width: 600rpx;
  min-height: 700rpx;
  position: relative;
  perspective: 1000px;
  overflow: hidden;
  box-shadow: 0 20rpx 60rpx rgba(0,0,0,0.3);
}

.card-front, .card-back {
  padding: 60rpx 40rpx;
  min-height: 700rpx;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s, opacity 0.3s;
}

.card-back {
  background: #fff;
}

/* 划动视觉反馈 */
.swipe-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 24rpx;
  pointer-events: none;
}

.swipe-overlay.left {
  background: rgba(255, 82, 82, 0.15);
}

.swipe-overlay.right {
  background: rgba(76, 175, 80, 0.15);
}

.swipe-overlay.down {
  background: rgba(105, 240, 174, 0.15);
}

.swipe-icon {
  font-size: 80rpx;
  margin-bottom: 20rpx;
}

.swipe-text {
  font-size: 40rpx;
  font-weight: bold;
  color: #333;
}

/* 离线词典释义 */
.offline-meaning {
  font-size: 28rpx;
  color: #4caf50;
  margin-top: 20rpx;
  padding: 16rpx;
  background: #e8f5e9;
  border-radius: 12rpx;
  line-height: 1.5;
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

/* 背面手势引导 */
.gesture-guide {
  display: flex;
  justify-content: space-around;
  margin-top: 40rpx;
  padding-top: 40rpx;
  border-top: 1rpx solid #eee;
}

.guide-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
}

.guide-arrow {
  font-size: 40rpx;
}

.guide-label {
  font-size: 24rpx;
  color: #666;
}

.guide-item.left .guide-arrow { color: #ff5252; }
.guide-item.down .guide-arrow { color: #4caf50; }
.guide-item.right .guide-arrow { color: #4caf50; }

/* 底部操作按钮 */
.action-buttons {
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  margin-top: auto;
}

.btn-forget, .btn-remember, .btn-remember-forever {
  flex: 1;
  height: 100rpx;
  border-radius: 16rpx;
  font-size: 28rpx;
  border: none;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.btn-forget {
  background: #ff5252;
  color: #fff;
}

.btn-remember-forever {
  background: #69f0ae;
  color: #333;
}

.btn-remember {
  background: #4caf50;
  color: #fff;
}

.btn-label {
  font-size: 28rpx;
  font-weight: bold;
}

/* 完成弹窗 */
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

/* 删除确认 */
.delete-word {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin: 20rpx 0;
  display: block;
}

.delete-hint {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 30rpx;
  display: block;
}

.popup-actions {
  display: flex;
  gap: 20rpx;
}

.btn-cancel, .btn-confirm-delete {
  flex: 1;
  height: 80rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  border: none;
}

.btn-cancel {
  background: #f5f5f5;
  color: #666;
}

.btn-confirm-delete {
  background: #ff5252;
  color: #fff;
}
</style>
