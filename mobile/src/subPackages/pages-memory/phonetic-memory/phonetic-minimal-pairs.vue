<template>
  <view class="pairs-page">
    <!-- 顶部 -->
    <view class="header">
      <text class="title">最小对立对</text>
      <view class="stats">
        <text class="stat correct">✓ {{ correctCount }}</text>
        <text class="stat wrong">✗ {{ wrongCount }}</text>
      </view>
    </view>
    <view class="progress-track">
      <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
    </view>

    <!-- 答题区 -->
    <view v-if="currentQ && !finished" class="quiz">
      <text class="quiz-prompt">听发音，选出你听到的单词</text>

      <view class="play-area">
        <view class="play-btn" @click="playTarget">
          <text class="play-icon">🔊</text>
          <text class="play-text">播放</text>
        </view>
        <view class="play-btn slow" @click="playTargetSlow">
          <text class="play-icon">🐢</text>
          <text class="play-text">慢速</text>
        </view>
      </view>

      <view class="pair-options">
        <view
          class="pair-card"
          :class="optionClass('a')"
          @click="choose('a')"
        >
          <text class="pair-word">{{ currentQ.pair.a }}</text>
          <text class="pair-phonetic">/{{ currentQ.pair.phoneticA }}/</text>
        </view>
        <view class="pair-vs">
          <text>or</text>
        </view>
        <view
          class="pair-card"
          :class="optionClass('b')"
          @click="choose('b')"
        >
          <text class="pair-word">{{ currentQ.pair.b }}</text>
          <text class="pair-phonetic">/{{ currentQ.pair.phoneticB }}/</text>
        </view>
      </view>

      <view v-if="answered" class="contrast-block">
        <text class="contrast-text">对立点：{{ currentQ.pair.contrast }}</text>
        <view class="contrast-actions">
          <text class="contrast-play" @click="speak(currentQ.pair.a)">🔊 {{ currentQ.pair.a }}</text>
          <text class="contrast-play" @click="speak(currentQ.pair.b)">🔊 {{ currentQ.pair.b }}</text>
        </view>
      </view>

      <button v-if="answered" class="btn-next" @click="nextQuestion">
        {{ currentIndex + 1 >= TOTAL ? '查看结果' : '下一题' }}
      </button>
    </view>

    <!-- 结果页 -->
    <view v-if="finished" class="result">
      <text class="result-icon">🎧</text>
      <text class="result-title">本组完成</text>
      <view class="result-stats">
        <text class="result-num correct">{{ correctCount }}</text>
        <text class="result-label">答对</text>
        <text class="result-num wrong">{{ wrongCount }}</text>
        <text class="result-label">答错</text>
      </view>
      <text class="result-accuracy">正确率 {{ accuracy }}%</text>
      <button class="btn-restart" @click="restart">再来一组</button>
      <button class="btn-back" @click="goBack">返回音标表</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { MINIMAL_PAIRS, type MinimalPair } from '@/utils/phoneme-data'
import { usePhoneticMemory } from '@/stores/usePhoneticMemory'
import { getTtsAdapter } from '@/adapters/index'

const TOTAL = 15
const phoneticStore = usePhoneticMemory()

interface Question {
  pair: MinimalPair
  /** 'a' = 播放 A 词，'b' = 播放 B 词；用户需选对应的 */
  answer: 'a' | 'b'
}

const questions = ref<Question[]>([])
const currentIndex = ref(0)
const correctCount = ref(0)
const wrongCount = ref(0)
const picked = ref<'a' | 'b' | null>(null)
const answered = ref(false)
const finished = ref(false)

const currentQ = computed<Question | null>(() => questions.value[currentIndex.value] || null)

const progressPercent = computed(() =>
  Math.round(((currentIndex.value + (answered.value ? 1 : 0)) / TOTAL) * 100),
)

const accuracy = computed(() => {
  const total = correctCount.value + wrongCount.value
  return total ? Math.round((correctCount.value / total) * 100) : 0
})

async function startSession() {
  await phoneticStore.ensureLoaded()
  // 按间隔重复优先级抽对子
  const pickedPairs = phoneticStore.pickPairsForSession(MINIMAL_PAIRS, TOTAL)
  questions.value = pickedPairs.map<Question>(pair => ({
    pair,
    answer: Math.random() < 0.5 ? 'a' : 'b',
  }))
  currentIndex.value = 0
  correctCount.value = 0
  wrongCount.value = 0
  picked.value = null
  answered.value = false
  finished.value = false
  setTimeout(playTarget, 400)
}

function choose(option: 'a' | 'b') {
  if (answered.value || !currentQ.value) return
  picked.value = option
  answered.value = true
  const isCorrect = option === currentQ.value.answer
  if (isCorrect) {
    correctCount.value++
  } else {
    wrongCount.value++
    // 答错时自动对比朗读两个词，帮助辨别
    setTimeout(() => speak(currentQ.value!.pair.a), 200)
    setTimeout(() => speak(currentQ.value!.pair.b), 1300)
  }
  phoneticStore.markPair(currentQ.value.pair.a, currentQ.value.pair.b, isCorrect)
}

function optionClass(option: 'a' | 'b') {
  if (!answered.value || !currentQ.value) return ''
  if (option === currentQ.value.answer) return 'correct'
  if (option === picked.value) return 'wrong'
  return 'disabled'
}

function nextQuestion() {
  if (currentIndex.value + 1 >= TOTAL) {
    finished.value = true
    return
  }
  currentIndex.value++
  picked.value = null
  answered.value = false
  setTimeout(playTarget, 300)
}

function playTarget() {
  if (!currentQ.value) return
  const word = currentQ.value.answer === 'a' ? currentQ.value.pair.a : currentQ.value.pair.b
  speak(word)
}

function playTargetSlow() {
  if (!currentQ.value) return
  const word = currentQ.value.answer === 'a' ? currentQ.value.pair.a : currentQ.value.pair.b
  // 有道 dictvoice type=1 为英式慢速（type=2 美式），用 type=1 近似慢速效果
  speakRaw(word, 1)
}

function speak(word: string) {
  speakRaw(word, 2)
}

function speakRaw(word: string, voiceType: number) {
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=${voiceType}`
    getTtsAdapter().playAudio(url).catch(() => {})
  } catch {}
}

function restart() {
  startSession()
}

function goBack() {
  uni.navigateBack()
}

onLoad(() => {
  startSession()
})
</script>

<style scoped>
.pairs-page {
  min-height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 30rpx;
  background: #fff;
}

.title {
  font-size: 32rpx;
  font-weight: bold;
  color: #303030;
}

.stats {
  display: flex;
  gap: 20rpx;
  font-size: 26rpx;
}

.stat.correct {
  color: #4caf50;
  font-weight: bold;
}

.stat.wrong {
  color: #e64340;
  font-weight: bold;
}

.progress-track {
  height: 8rpx;
  background: #eef0f4;
}

.progress-fill {
  height: 100%;
  background: #667eea;
  border-radius: 4rpx;
  transition: width 0.3s;
}

.quiz {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 40rpx 60rpx;
}

.quiz-prompt {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 30rpx;
}

.play-area {
  display: flex;
  gap: 40rpx;
  margin-bottom: 40rpx;
}

.play-btn {
  width: 160rpx;
  height: 160rpx;
  border-radius: 50%;
  background: #667eea;
  color: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.play-btn.slow {
  background: #fff;
  border: 3rpx solid #667eea;
  color: #667eea;
}

.play-icon {
  font-size: 52rpx;
}

.play-text {
  font-size: 22rpx;
  margin-top: 6rpx;
}

.pair-options {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 20rpx;
  align-items: stretch;
}

.pair-card {
  background: #fff;
  border: 3rpx solid #eef0f4;
  border-radius: 20rpx;
  padding: 34rpx;
  text-align: center;
}

.pair-card.correct {
  border-color: #4caf50;
  background: #f2fbf4;
}

.pair-card.wrong {
  border-color: #e64340;
  background: #fef2f2;
}

.pair-card.disabled {
  opacity: 0.45;
}

.pair-word {
  font-size: 44rpx;
  font-weight: bold;
  color: #303030;
  display: block;
}

.pair-phonetic {
  font-size: 26rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
  font-family: 'Times New Roman', serif;
}

.pair-vs {
  text-align: center;
  font-size: 24rpx;
  color: #bbb;
  font-style: italic;
}

.contrast-block {
  margin-top: 36rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  width: 100%;
  box-sizing: border-box;
  text-align: center;
}

.contrast-text {
  font-size: 26rpx;
  color: #667eea;
  font-family: 'Times New Roman', serif;
}

.contrast-actions {
  display: flex;
  justify-content: center;
  gap: 40rpx;
  margin-top: 16rpx;
}

.contrast-play {
  font-size: 28rpx;
  color: #303030;
  background: #f0eefa;
  padding: 12rpx 28rpx;
  border-radius: 12rpx;
}

.btn-next {
  margin-top: 40rpx;
  background: #667eea;
  color: #fff;
  border-radius: 44rpx;
  height: 88rpx;
  font-size: 30rpx;
  border: none;
  padding: 0 90rpx;
}

/* 结果页 */
.result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx;
}

.result-icon {
  font-size: 100rpx;
}

.result-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #303030;
  margin-top: 20rpx;
}

.result-stats {
  display: flex;
  align-items: baseline;
  gap: 14rpx;
  margin-top: 36rpx;
}

.result-num {
  font-size: 56rpx;
  font-weight: bold;
}

.result-num.correct {
  color: #4caf50;
}

.result-num.wrong {
  color: #e64340;
}

.result-label {
  font-size: 26rpx;
  color: #999;
  margin-right: 20rpx;
}

.result-accuracy {
  font-size: 28rpx;
  color: #667eea;
  margin-top: 16rpx;
}

.btn-restart {
  margin-top: 60rpx;
  background: #667eea;
  color: #fff;
  border-radius: 44rpx;
  height: 88rpx;
  font-size: 30rpx;
  border: none;
  width: 100%;
}

.btn-back {
  margin-top: 20rpx;
  background: #f5f5f5;
  color: #666;
  border-radius: 44rpx;
  height: 88rpx;
  font-size: 30rpx;
  border: none;
  width: 100%;
}
</style>
