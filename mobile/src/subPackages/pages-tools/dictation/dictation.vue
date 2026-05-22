<template>
  <view class="dictation-container">
    <view class="controls">
      <picker mode="selector" :range="wordRanges" :value="rangeIndex" @change="onRangeChange">
        <view class="picker">{{ wordRanges[rangeIndex] }}</view>
      </picker>
      <button class="play-btn" @click="playCurrent">播放</button>
    </view>

    <view class="input-section">
      <input 
        class="answer-input"
        v-model="userAnswer"
        placeholder="输入听到的单词"
        @confirm="checkAnswer"
      />
      <button class="check-btn" @click="checkAnswer">检查</button>
    </view>

    <view v-if="showResult" class="result-section" :class="{ correct: isCorrect }">
      <text class="result-text">{{ isCorrect ? '正确' : '错误' }}</text>
      <text v-if="!isCorrect" class="correct-answer">正确答案: {{ currentWord?.word }}</text>
      <button class="next-btn" @click="nextWord">下一个</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMobileWords } from '@/stores/useMobileWords'

const wordsStore = useMobileWords()
const wordRanges = ['全部单词', '待复习单词', '最近添加']
const rangeIndex = ref(0)
const userAnswer = ref('')
const showResult = ref(false)
const isCorrect = ref(false)
const currentWord = ref<any>(null)

onMounted(() => {
  wordsStore.loadWords()
  nextWord()
})

const onRangeChange = (e: any) => {
  rangeIndex.value = e.detail.value
}

const getWords = () => {
  switch (rangeIndex.value) {
    case 0: return wordsStore.words
    case 1: return wordsStore.reviewWords
    case 2: return wordsStore.words.slice(-20)
    default: return wordsStore.words
  }
}

const nextWord = () => {
  const words = getWords()
  if (words.length === 0) {
    uni.showToast({ title: '没有可用单词', icon: 'none' })
    return
  }
  currentWord.value = words[Math.floor(Math.random() * words.length)]
  userAnswer.value = ''
  showResult.value = false
}

const playCurrent = () => {
  if (!currentWord.value) return

  // #ifdef H5 || APP-PLUS
  const utterance = new SpeechSynthesisUtterance(currentWord.value.word)
  utterance.lang = 'en-US'
  speechSynthesis.speak(utterance)
  // #endif

  // #ifdef MP-WEIXIN
  // 小程序端使用微信语音合成（需要申请插件或使用百度/腾讯 TTS API）
  uni.showToast({ title: '小程序端 TTS 需配置插件', icon: 'none' })
  // #endif
}

const checkAnswer = () => {
  if (!currentWord.value || !userAnswer.value) return
  
  isCorrect.value = userAnswer.value.toLowerCase().trim() === currentWord.value.word.toLowerCase()
  showResult.value = true
  
  if (isCorrect.value) {
    uni.showToast({ title: '回答正确', icon: 'success' })
  }
}
</script>

<style scoped>
.dictation-container {
  padding: 40rpx;
  min-height: 100vh;
  background: #f5f5f5;
}

.controls {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 40rpx;
}

.picker {
  background: #fff;
  padding: 20rpx 30rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
}

.play-btn {
  background: #1976d2;
  color: #fff;
  padding: 20rpx 40rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  border: none;
}

.input-section {
  display: flex;
  gap: 20rpx;
  margin-bottom: 40rpx;
}

.answer-input {
  flex: 1;
  height: 80rpx;
  background: #fff;
  border-radius: 8rpx;
  padding: 0 20rpx;
  font-size: 28rpx;
}

.check-btn {
  width: 140rpx;
  height: 80rpx;
  background: #4caf50;
  color: #fff;
  border-radius: 8rpx;
  font-size: 28rpx;
  border: none;
}

.result-section {
  background: #ffebee;
  border-radius: 16rpx;
  padding: 40rpx;
  text-align: center;
}

.result-section.correct {
  background: #e8f5e9;
}

.result-text {
  font-size: 48rpx;
  font-weight: bold;
  display: block;
}

.correct-answer {
  font-size: 32rpx;
  color: #666;
  margin-top: 20rpx;
  display: block;
}

.next-btn {
  margin-top: 30rpx;
  background: #1976d2;
  color: #fff;
  padding: 20rpx 60rpx;
  border-radius: 8rpx;
  font-size: 28rpx;
  border: none;
}
</style>
