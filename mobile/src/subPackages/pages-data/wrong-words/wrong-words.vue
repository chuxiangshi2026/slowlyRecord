<template>
  <view class="wrong-words-container">
    <view v-if="wrongWords.length === 0" class="empty-state">
      <text class="empty-icon">🎉</text>
      <text class="empty-text">暂无错题</text>
      <text class="empty-hint">太棒了！你还没有忘记过任何单词</text>
    </view>

    <view v-else>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
        <text class="progress-text">{{ currentIndex + 1 }} / {{ wrongWords.length }}</text>
      </view>

      <view class="card" :class="{ flipped: isFlipped }" @click="flipCard">
        <view class="card-front">
          <text class="word-text">{{ currentWord?.word }}</text>
          <text class="hint">点击查看释义</text>
        </view>
        <view class="card-back">
          <text class="word-text">{{ currentWord?.word }}</text>
          <text class="word-meaning">{{ currentWord?.meaning }}</text>
          <text v-if="currentWord?.phonetic" class="phonetic">{{ currentWord?.phonetic }}</text>
        </view>
      </view>

      <view class="action-buttons">
        <button class="btn-forget" @click.stop="handleStillForget">还是不会</button>
        <button class="btn-remember" @click.stop="handleMastered">已掌握</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'

const wordsStore = useMobileWords()
const currentIndex = ref(0)
const isFlipped = ref(false)

const wrongWords = computed(() => {
  return wordsStore.words.filter(w => (w.level || 1) <= 2 && (w.reviewCount || 0) > 0)
})

const currentWord = computed(() => wrongWords.value[currentIndex.value])

const progressPercent = computed(() => {
  if (wrongWords.value.length === 0) return 0
  return ((currentIndex.value + 1) / wrongWords.value.length) * 100
})

onMounted(() => {
  wordsStore.loadWords()
})

const flipCard = () => {
  isFlipped.value = true
}

const handleStillForget = () => {
  if (currentWord.value) {
    wordsStore.markAsForgotten(currentWord.value.id)
    nextWord()
  }
}

const handleMastered = () => {
  if (currentWord.value) {
    wordsStore.markAsRemembered(currentWord.value.id)
    nextWord()
  }
}

const nextWord = () => {
  isFlipped.value = false
  if (currentIndex.value < wrongWords.value.length - 1) {
    currentIndex.value++
  } else {
    uni.showToast({ title: '错题复习完成', icon: 'success' })
    currentIndex.value = 0
  }
}
</script>

<style scoped>
.wrong-words-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.empty-state {
  text-align: center;
  background: rgba(255,255,255,0.95);
  border-radius: 24rpx;
  padding: 80rpx 40rpx;
}

.empty-icon {
  font-size: 80rpx;
  display: block;
}

.empty-text {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-top: 20rpx;
  display: block;
}

.empty-hint {
  font-size: 26rpx;
  color: #999;
  margin-top: 16rpx;
  display: block;
}

.progress-bar {
  background: rgba(255,255,255,0.3);
  border-radius: 10rpx;
  height: 20rpx;
  margin-bottom: 40rpx;
  position: relative;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #fff;
  border-radius: 10rpx;
  transition: width 0.3s;
}

.progress-text {
  position: absolute;
  top: 30rpx;
  right: 0;
  font-size: 24rpx;
  color: #fff;
}

.card {
  background: #fff;
  border-radius: 24rpx;
  min-height: 500rpx;
  position: relative;
  perspective: 1000px;
  margin-bottom: 40rpx;
  overflow: hidden;
}

.card-front, .card-back {
  padding: 60rpx 40rpx;
  min-height: 500rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
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

.card.flipped .card-front {
  transform: rotateY(180deg);
}

.card.flipped .card-back {
  transform: rotateY(0deg);
}

.word-text {
  font-size: 64rpx;
  font-weight: bold;
  color: #333;
}

.hint {
  font-size: 26rpx;
  color: #bbb;
  margin-top: 40rpx;
}

.word-meaning {
  font-size: 36rpx;
  color: #333;
  margin-top: 30rpx;
  line-height: 1.6;
}

.phonetic {
  font-size: 28rpx;
  color: #999;
  margin-top: 20rpx;
  font-family: 'Times New Roman', serif;
}

.action-buttons {
  display: flex;
  gap: 30rpx;
}

.btn-forget, .btn-remember {
  flex: 1;
  height: 100rpx;
  border-radius: 50rpx;
  font-size: 32rpx;
  border: none;
  color: #fff;
}

.btn-forget {
  background: rgba(255,255,255,0.3);
  border: 2rpx solid #fff;
}

.btn-remember {
  background: #fff;
  color: #ee5a6f;
}
</style>
