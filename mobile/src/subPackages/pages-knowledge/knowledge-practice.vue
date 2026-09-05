<template>
  <view class="practice-page">
    <!-- 顶部进度 -->
    <view class="header">
      <text class="title">{{ mode === 'flip' ? '翻卡练习' : '四选一' }}</text>
      <view class="stats">
        <text class="stat correct">✓ {{ correctCount }}</text>
        <text class="stat wrong">✗ {{ wrongCount }}</text>
      </view>
    </view>
    <view class="progress-track">
      <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
    </view>

    <!-- 答题区 -->
    <view v-if="currentItem && !finished" class="quiz">
      <!-- 翻卡模式 -->
      <template v-if="mode === 'flip'">
        <view class="flip-card" @click="reveal">
          <template v-if="!revealed">
            <text class="q-label">问题</text>
            <text class="q-text">{{ currentItem.question }}</text>
            <text v-if="extrasText" class="q-extras">{{ extrasText }}</text>
            <text class="flip-hint">点击查看答案</text>
          </template>
          <template v-else>
            <text class="q-label">{{ currentItem.question }}</text>
            <text class="a-text">{{ currentItem.answer }}</text>
          </template>
        </view>

        <view v-if="revealed" class="flip-actions">
          <button class="btn-forget" @click="mark(false)">没记住</button>
          <button class="btn-remember" @click="mark(true)">记住了</button>
        </view>
      </template>

      <!-- 四选一模式 -->
      <template v-else>
        <view class="choice-prompt">
          <text class="q-label">选择正确答案</text>
          <text class="q-text">{{ currentItem.question }}</text>
          <text v-if="extrasText" class="q-extras">{{ extrasText }}</text>
        </view>

        <view class="choice-options">
          <view
            v-for="(opt, idx) in options"
            :key="idx"
            class="choice-card"
            :class="choiceClass(idx)"
            @click="choose(idx)"
          >
            <text class="choice-text">{{ opt }}</text>
          </view>
        </view>

        <button v-if="answered" class="btn-next" @click="nextQuestion">下一题</button>
      </template>
    </view>

    <!-- 完成页 -->
    <view v-if="finished" class="result">
      <text class="result-icon">{{ correctCount >= wrongCount ? '🎉' : '💪' }}</text>
      <text class="result-title">本轮完成</text>
      <view class="result-stats">
        <text class="result-num correct">{{ correctCount }}</text>
        <text class="result-label">答对</text>
        <text class="result-num wrong">{{ wrongCount }}</text>
        <text class="result-label">答错</text>
      </view>
      <button class="btn-restart" @click="restart">再来一轮</button>
      <button class="btn-back" @click="goBack">返回详情</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad, onShow } from '@dcloudio/uni-app'
import { useKnowledgeMemory } from './useKnowledgeMemory'
import type { KnowledgeItem } from '@/stores/useUtils/types'

const SESSION_SIZE = 10

const store = useKnowledgeMemory()
const packId = ref('')
const mode = ref<'flip' | 'choice'>('flip')

const sessionItems = ref<KnowledgeItem[]>([])
const currentIndex = ref(0)
const correctCount = ref(0)
const wrongCount = ref(0)
const finished = ref(false)

// 翻卡状态
const revealed = ref(false)

// 四选一状态
const options = ref<string[]>([])
const answered = ref(false)
const pickedIdx = ref<number | null>(null)

const currentItem = computed(() => sessionItems.value[currentIndex.value] || null)

const progressPercent = computed(() =>
  Math.round(((currentIndex.value + (answered.value || revealed.value ? 1 : 0)) / sessionItems.value.length) * 100),
)

const extrasText = computed(() => {
  const item = currentItem.value
  if (!item?.extras) return ''
  return Object.entries(item.extras)
    .slice(0, 2)
    .map(([k, v]) => `${k}:${v}`)
    .join(' · ')
})

function startSession() {
  sessionItems.value = store.pickItemsForSession(packId.value, SESSION_SIZE)
  currentIndex.value = 0
  correctCount.value = 0
  wrongCount.value = 0
  finished.value = false
  resetQuestionState()
}

function resetQuestionState() {
  revealed.value = false
  answered.value = false
  pickedIdx.value = null
  if (mode.value === 'choice' && currentItem.value) {
    options.value = store.generateChoices(packId.value, currentItem.value)
  }
}

function reveal() {
  if (mode.value === 'flip') revealed.value = true
}

/** 翻卡自评 */
function mark(isCorrect: boolean) {
  const item = currentItem.value
  if (!item) return
  store.markItem(packId.value, item.id, isCorrect)
  if (isCorrect) correctCount.value++
  else wrongCount.value++
  nextQuestion()
}

function choiceClass(idx: number) {
  if (!answered.value) return ''
  const correctText = currentItem.value?.answer
  if (options.value[idx] === correctText) return 'correct'
  if (idx === pickedIdx.value) return 'wrong'
  return 'disabled'
}

/** 四选一作答 */
function choose(idx: number) {
  if (answered.value || !currentItem.value) return
  pickedIdx.value = idx
  answered.value = true
  const isCorrect = options.value[idx] === currentItem.value.answer
  store.markItem(packId.value, currentItem.value.id, isCorrect)
  if (isCorrect) correctCount.value++
  else wrongCount.value++
}

function nextQuestion() {
  if (currentIndex.value + 1 >= sessionItems.value.length) {
    finished.value = true
    return
  }
  currentIndex.value++
  resetQuestionState()
}

function restart() {
  startSession()
}

function goBack() {
  uni.navigateBack()
}

onLoad((opt: any) => {
  if (opt?.packId) packId.value = opt.packId
  if (opt?.mode === 'choice') mode.value = 'choice'
})

// 详情页 loadPack 是异步的，等包加载完再抽题
onShow(() => {
  if (finished.value) return
  const tryStart = () => {
    if (store.getPack(packId.value)) {
      if (sessionItems.value.length === 0) startSession()
      return true
    }
    return false
  }
  if (tryStart()) return
  store.loadPack(packId.value).then(tryStart).catch(() => {
    uni.showToast({ title: '知识包加载失败', icon: 'none' })
  })
})
</script>

<style scoped>
.practice-page {
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

/* 翻卡 */
.flip-card {
  width: 100%;
  min-height: 560rpx;
  background: #fff;
  border-radius: 24rpx;
  padding: 50rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  box-shadow: 0 6rpx 24rpx rgba(102, 126, 234, 0.08);
}

.q-label {
  font-size: 24rpx;
  color: #999;
  margin-bottom: 24rpx;
}

.q-text {
  font-size: 52rpx;
  font-weight: bold;
  color: #303030;
  line-height: 1.5;
  word-break: break-all;
}

.q-extras {
  font-size: 24rpx;
  color: #999;
  margin-top: 16rpx;
}

.flip-hint {
  font-size: 24rpx;
  color: #bbb;
  margin-top: 70rpx;
}

.a-text {
  font-size: 48rpx;
  color: #667eea;
  font-weight: bold;
  line-height: 1.5;
  word-break: break-all;
}

.flip-actions {
  display: flex;
  gap: 24rpx;
  width: 100%;
  margin-top: 40rpx;
}

.btn-forget,
.btn-remember {
  flex: 1;
  height: 96rpx;
  border-radius: 48rpx;
  font-size: 30rpx;
  border: none;
  line-height: 96rpx;
}

.btn-forget {
  background: #fee;
  color: #e64340;
  border: 2rpx solid #e64340;
}

.btn-remember {
  background: #667eea;
  color: #fff;
}

/* 四选一 */
.choice-prompt {
  width: 100%;
  background: #fff;
  border-radius: 24rpx;
  padding: 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-bottom: 30rpx;
}

.choice-options {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.choice-card {
  background: #fff;
  border: 3rpx solid #eef0f4;
  border-radius: 16rpx;
  padding: 34rpx 20rpx;
  text-align: center;
}

.choice-card.correct {
  border-color: #4caf50;
  background: #f2fbf4;
}

.choice-card.wrong {
  border-color: #e64340;
  background: #fef2f2;
}

.choice-card.disabled {
  opacity: 0.45;
}

.choice-text {
  font-size: 32rpx;
  font-weight: bold;
  color: #303030;
  word-break: break-all;
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
