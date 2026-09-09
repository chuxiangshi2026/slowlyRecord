<template>
  <view class="wrong-words-container">
    <!-- 空态：无错题时给出口 -->
    <view v-if="!hasSession" class="empty-state">
      <text class="empty-icon">🎉</text>
      <text class="empty-text">暂无错题</text>
      <text class="empty-hint">太棒了！你还没有忘记过任何单词</text>
      <view class="empty-actions">
        <view class="empty-btn primary" @click="goReview">
          <text class="empty-btn-text">去复习</text>
        </view>
        <view class="empty-btn plain" @click="goHome">
          <text class="empty-btn-text plain-text">返回首页</text>
        </view>
      </view>
    </view>

    <!-- 本轮完成：简单统计 -->
    <view v-else-if="isDone" class="summary-state">
      <text class="summary-icon">🎉</text>
      <text class="summary-title">本轮错题复习完成</text>
      <text class="summary-stats">本轮 {{ stats.total }} 条 · 掌握 {{ stats.mastered }} · 仍需巩固 {{ stats.stillWeak }}</text>
      <view class="empty-actions">
        <view class="empty-btn primary" @click="restart">
          <text class="empty-btn-text">再练一轮</text>
        </view>
        <view class="empty-btn plain" @click="goHome">
          <text class="empty-btn-text plain-text">返回首页</text>
        </view>
      </view>
    </view>

    <!-- 翻卡遍历快照 -->
    <view v-else>
      <view class="progress-bar">
        <view class="progress-fill" :style="{ width: progressPercent + '%' }"></view>
        <text class="progress-text">{{ session.pos + 1 }} / {{ session.ids.length }}</text>
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
import { ref, computed, reactive, onMounted } from 'vue'
import { useMobileWords, type MobileWord } from '@/stores/useMobileWords'
// 快照遍历纯逻辑：进入页面取一次快照，"已掌握"只从剩余待处理移除，不破坏遍历索引
import {
  createWrongWordsSession,
  currentId,
  isDone as sessionIsDone,
  markMastered,
  markForgotten,
  sessionStats,
  type WrongWordsSessionState
} from './wrong-words-session'

const wordsStore = useMobileWords()
const isFlipped = ref(false)

// 本轮遍历的快照（进入页面时取一次，之后词被标"已掌握"也不会导致跳词/空卡片）
const session = reactive<WrongWordsSessionState>(createWrongWordsSession([]))
const snapshotWords = ref<MobileWord[]>([])

const hasSession = computed(() => session.ids.length > 0)
const isDone = computed(() => sessionIsDone(session))

const currentWord = computed(() => {
  const id = currentId(session)
  if (id === null) return null
  return snapshotWords.value.find(w => w.id === id) || null
})

const stats = computed(() => sessionStats(session))

const progressPercent = computed(() => {
  if (session.ids.length === 0) return 0
  return (session.pos / session.ids.length) * 100
})

/** 开始一轮新会话：对当前错题列表取快照 */
async function startSession() {
  await wordsStore.loadWords()
  const wrong = wordsStore.words.filter(w => (w.level || 1) <= 2 && (w.reviewCount || 0) > 0)
  snapshotWords.value = [...wrong]
  Object.assign(session, createWrongWordsSession(wrong))
  isFlipped.value = false
}

function restart() {
  startSession()
}

onMounted(() => {
  startSession()
})

const flipCard = () => {
  isFlipped.value = true
}

const handleStillForget = () => {
  const word = currentWord.value
  if (word) {
    wordsStore.markAsForgotten(word.id)
    markForgotten(session)
    isFlipped.value = false
  }
}

const handleMastered = () => {
  const word = currentWord.value
  if (word) {
    wordsStore.markAsRemembered(word.id)
    markMastered(session)
    isFlipped.value = false
  }
}

const goReview = () => {
  uni.switchTab({ url: '/pages/review/review' })
}

const goHome = () => {
  uni.switchTab({ url: '/pages/index/index' })
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

.empty-state, .summary-state {
  text-align: center;
  background: rgba(255,255,255,0.95);
  border-radius: 24rpx;
  padding: 80rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.summary-icon {
  font-size: 80rpx;
}

.summary-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
  margin-top: 20rpx;
}

.summary-stats {
  font-size: 28rpx;
  color: #666;
  margin-top: 24rpx;
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

/* 空态/完成态出口按钮 */
.empty-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 48rpx;
}

.empty-btn {
  padding: 20rpx 56rpx;
  border-radius: 40rpx;
}

.empty-btn:active {
  opacity: 0.85;
}

.empty-btn.primary {
  background: #52796f;
}

.empty-btn.plain {
  background: transparent;
  border: 2rpx solid #52796f;
}

.empty-btn-text {
  font-size: 30rpx;
  color: #fff;
}

.plain-text {
  color: #52796f;
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
