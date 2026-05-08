<template>
  <view class="number-memory-container">
    <view class="header">
      <text class="title">🔢 数字记忆</text>
      <text class="subtitle">挑战你的短期记忆极限</text>
    </view>

    <view v-if="gameState === 'menu'" class="menu">
      <view class="level-selector">
        <text class="selector-label">选择难度</text>
        <view class="level-options">
          <view
            v-for="level in levels"
            :key="level.value"
            class="level-btn"
            :class="{ active: selectedLevel === level.value }"
            @click="selectedLevel = level.value"
          >
            <text class="level-name">{{ level.name }}</text>
            <text class="level-desc">{{ level.desc }}</text>
          </view>
        </view>
      </view>
      <button class="start-btn" @click="startGame">开始挑战</button>
    </view>

    <view v-else-if="gameState === 'show'" class="show-phase">
      <text class="phase-label">请记住以下数字</text>
      <text class="number-display">{{ currentNumber }}</text>
      <text class="timer">{{ showTimer }}s</text>
    </view>

    <view v-else-if="gameState === 'input'" class="input-phase">
      <text class="phase-label">请输入刚才的数字</text>
      <input
        class="number-input"
        v-model="userAnswer"
        type="number"
        placeholder="输入数字"
        @confirm="checkAnswer"
      />
      <button class="submit-btn" @click="checkAnswer">确认</button>
    </view>

    <view v-else-if="gameState === 'result'" class="result-phase">
      <text class="result-icon">{{ isCorrect ? '🎉' : '😅' }}</text>
      <text class="result-title">{{ isCorrect ? '回答正确！' : '回答错误' }}</text>
      <view class="result-detail">
        <text class="detail-row">正确答案: {{ currentNumber }}</text>
        <text class="detail-row">你的答案: {{ userAnswer || '无' }}</text>
        <text class="detail-row">当前连胜: {{ streak }} 轮</text>
        <text class="detail-row">最高记录: {{ bestRecord }} 轮</text>
      </view>
      <view class="result-actions">
        <button class="action-btn secondary" @click="goToMenu">返回菜单</button>
        <button class="action-btn primary" @click="nextRound">下一轮</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const levels = [
  { value: 4, name: '简单', desc: '4位数字' },
  { value: 6, name: '普通', desc: '6位数字' },
  { value: 8, name: '困难', desc: '8位数字' },
  { value: 10, name: '大师', desc: '10位数字' },
  { value: 12, name: '极限', desc: '12位数字' },
]

const gameState = ref<'menu' | 'show' | 'input' | 'result'>('menu')
const selectedLevel = ref(4)
const currentNumber = ref('')
const userAnswer = ref('')
const showTimer = ref(3)
const isCorrect = ref(false)
const streak = ref(0)
const bestRecord = ref(0)

let timerInterval: any = null
const STORAGE_KEY = 'number_memory_best'

onMounted(() => {
  const stored = uni.getStorageSync(STORAGE_KEY)
  if (stored) bestRecord.value = parseInt(stored) || 0
})

onUnmounted(() => {
  clearInterval(timerInterval)
})

const generateNumber = (length: number): string => {
  let num = ''
  for (let i = 0; i < length; i++) {
    num += Math.floor(Math.random() * 10)
  }
  return num
}

const startGame = () => {
  currentNumber.value = generateNumber(selectedLevel.value)
  userAnswer.value = ''
  gameState.value = 'show'
  showTimer.value = Math.max(2, Math.floor(selectedLevel.value / 2))

  timerInterval = setInterval(() => {
    showTimer.value--
    if (showTimer.value <= 0) {
      clearInterval(timerInterval)
      gameState.value = 'input'
    }
  }, 1000)
}

const checkAnswer = () => {
  isCorrect.value = userAnswer.value === currentNumber.value

  if (isCorrect.value) {
    streak.value++
    if (streak.value > bestRecord.value) {
      bestRecord.value = streak.value
      uni.setStorageSync(STORAGE_KEY, String(bestRecord.value))
    }
  } else {
    streak.value = 0
  }

  gameState.value = 'result'
}

const nextRound = () => {
  if (isCorrect.value) {
    // 连胜增加难度
    if (streak.value > 0 && streak.value % 3 === 0 && selectedLevel.value < 12) {
      selectedLevel.value += 2
    }
  } else {
    // 失败后降低难度
    selectedLevel.value = Math.max(4, selectedLevel.value - 2)
  }
  startGame()
}

const goToMenu = () => {
  streak.value = 0
  gameState.value = 'menu'
}
</script>

<style scoped>
.number-memory-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 40rpx;
}

.header {
  text-align: center;
  padding: 40rpx 0;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}

.subtitle {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 10rpx;
  display: block;
}

.menu {
  background: rgba(255,255,255,0.95);
  border-radius: 24rpx;
  padding: 40rpx;
  margin-top: 20rpx;
}

.level-selector {
  margin-bottom: 40rpx;
}

.selector-label {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
  margin-bottom: 20rpx;
}

.level-options {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
}

.level-btn {
  background: #f5f5f5;
  border-radius: 16rpx;
  padding: 24rpx;
  text-align: center;
  border: 2rpx solid transparent;
}

.level-btn.active {
  background: #e3f2fd;
  border-color: #667eea;
}

.level-name {
  font-size: 28rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.level-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.start-btn {
  width: 100%;
  height: 90rpx;
  background: linear-gradient(90deg, #667eea, #764ba2);
  color: #fff;
  border-radius: 50rpx;
  font-size: 32rpx;
  border: none;
}

.show-phase, .input-phase, .result-phase {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 60vh;
}

.phase-label {
  font-size: 32rpx;
  color: #fff;
  margin-bottom: 40rpx;
}

.number-display {
  font-size: 80rpx;
  font-weight: bold;
  color: #fff;
  letter-spacing: 20rpx;
  text-align: center;
}

.timer {
  font-size: 36rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 40rpx;
}

.number-input {
  width: 80%;
  height: 100rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 0 30rpx;
  font-size: 40rpx;
  text-align: center;
  letter-spacing: 10rpx;
  margin-bottom: 30rpx;
}

.submit-btn {
  width: 60%;
  height: 90rpx;
  background: #fff;
  color: #667eea;
  border-radius: 50rpx;
  font-size: 32rpx;
  border: none;
  font-weight: bold;
}

.result-icon {
  font-size: 80rpx;
  display: block;
}

.result-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  margin-top: 20rpx;
  display: block;
}

.result-detail {
  background: rgba(255,255,255,0.2);
  border-radius: 16rpx;
  padding: 30rpx;
  margin: 40rpx 0;
  width: 80%;
}

.detail-row {
  font-size: 28rpx;
  color: #fff;
  display: block;
  margin: 10rpx 0;
}

.result-actions {
  display: flex;
  gap: 20rpx;
  width: 80%;
}

.action-btn {
  flex: 1;
  height: 90rpx;
  border-radius: 50rpx;
  font-size: 30rpx;
  border: none;
}

.action-btn.primary {
  background: #fff;
  color: #667eea;
  font-weight: bold;
}

.action-btn.secondary {
  background: rgba(255,255,255,0.3);
  color: #fff;
  border: 2rpx solid #fff;
}
</style>
