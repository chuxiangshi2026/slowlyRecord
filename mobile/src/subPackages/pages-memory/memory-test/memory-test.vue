<template>
  <view class="memory-test-container">
    <view class="header">
      <text class="title">🧠 记忆力测试</text>
      <text class="subtitle">测试你的瞬时记忆能力</text>
    </view>

    <view v-if="gameState === 'menu'" class="menu">
      <view class="test-options">
        <view class="option-card" @click="startColorTest">
          <text class="option-icon">🎨</text>
          <text class="option-title">颜色记忆</text>
          <text class="option-desc">记住颜色出现的位置</text>
          <text v-if="colorBest" class="option-best">最佳：Lv {{ colorBest.level }} · {{ colorBest.score }} 分</text>
        </view>
        <view class="option-card" @click="startSequenceTest">
          <text class="option-icon">🔢</text>
          <text class="option-title">顺序记忆</text>
          <text class="option-desc">按顺序点击数字</text>
          <text v-if="sequenceBest" class="option-best">最佳：Lv {{ sequenceBest.level }} · {{ sequenceBest.score }} 分</text>
        </view>
      </view>
    </view>

    <view v-else-if="gameState === 'color-test'" class="color-test">
      <text class="test-title">记住亮起的颜色位置</text>
      <view class="color-grid">
        <view
          v-for="(cell, index) in colorCells"
          :key="index"
          class="color-cell"
          :class="{ active: cell.active, highlight: cell.highlight }"
          :style="{ backgroundColor: cell.active ? cell.color : '#e0e0e0' }"
          @click="handleColorClick(index)"
        />
      </view>
      <text class="level-info">等级 {{ colorLevel }} | 得分 {{ colorScore }}</text>
      <button class="back-btn" @click="finishTest">结束本轮</button>
    </view>

    <view v-else-if="gameState === 'sequence-test'" class="sequence-test">
      <text class="test-title">按从小到大的顺序点击数字</text>
      <text class="timer">{{ sequenceTimer }}s</text>
      <view class="number-grid">
        <view
          v-for="(num, index) in sequenceNumbers"
          :key="index"
          class="number-cell"
          :class="{ clicked: num.clicked }"
          @click="handleNumberClick(index)"
        >
          <text>{{ num.value }}</text>
        </view>
      </view>
      <text class="level-info">等级 {{ sequenceLevel }} | 得分 {{ sequenceScore }}</text>
      <button class="back-btn" @click="finishTest">结束本轮</button>
    </view>

    <!-- 本轮结果：成绩落库后给出下一步引导 -->
    <view v-else-if="gameState === 'result'" class="result-panel">
      <text class="result-icon">🎉</text>
      <text class="result-encourage">{{ encourageText }}</text>
      <view class="result-stats">
        <view class="result-stat">
          <text class="result-num">{{ resultLevel }}</text>
          <text class="result-label">本次等级</text>
        </view>
        <view class="result-stat">
          <text class="result-num">{{ resultScore }}</text>
          <text class="result-label">本次得分</text>
        </view>
      </view>
      <text v-if="newBest" class="result-new-best">✨ 新纪录！历史最佳：Lv {{ bestLevel }}</text>
      <button class="result-btn primary" @click="retryTest">再来一次</button>
      <button class="result-btn guide" @click="goToNumberMemory">🔢 去练数字记忆</button>
      <button class="result-btn plain" @click="goToMenu">返回菜单</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { getEncourageText } from '@/utils/encourage'
import { getMemoryTestBest, saveMemoryTestBest, type MemoryTestBest, type MemoryTestMode } from '@/utils/memory-test-best'

type GameState = 'menu' | 'color-test' | 'sequence-test' | 'result'
const gameState = ref<GameState>('menu')

// 各模式历史最佳成绩（等级优先、得分其次，仅在打破纪录时落库）
const colorBest = ref<MemoryTestBest | null>(null)
const sequenceBest = ref<MemoryTestBest | null>(null)

function refreshBests() {
  colorBest.value = getMemoryTestBest('color')
  sequenceBest.value = getMemoryTestBest('sequence')
}

onMounted(refreshBests)

// 结果区状态：刚结束的模式与成绩
const lastMode = ref<MemoryTestMode>('color')
const resultLevel = ref(1)
const resultScore = ref(0)
const newBest = ref(false)
const bestLevel = ref(1)
const encourageText = ref(getEncourageText())

// 颜色记忆测试
const colorCells = ref<{ active: boolean; color: string; highlight: boolean }[]>([])
const colorLevel = ref(1)
const colorScore = ref(0)
const colorSequence = ref<number[]>([])
const colorStep = ref(0)
const colors = ['#f44336', '#2196f3', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4']

// 顺序记忆测试
const sequenceNumbers = ref<{ value: number; clicked: boolean }[]>([])
const sequenceLevel = ref(1)
const sequenceScore = ref(0)
const sequenceTimer = ref(30)
const nextExpected = ref(1)
let timerInterval: any = null

const initColorGrid = () => {
  const count = 9
  colorCells.value = Array.from({ length: count }, () => ({
    active: false,
    color: '',
    highlight: false
  }))
}

const startColorTest = () => {
  gameState.value = 'color-test'
  colorLevel.value = 1
  colorScore.value = 0
  initColorGrid()
  showColorSequence()
}

const showColorSequence = () => {
  initColorGrid()
  const count = Math.min(3 + Math.floor(colorLevel.value / 2), 6)
  const indices: number[] = []
  while (indices.length < count) {
    const idx = Math.floor(Math.random() * 9)
    if (!indices.includes(idx)) indices.push(idx)
  }

  colorSequence.value = indices
  colorStep.value = 0

  indices.forEach((idx, i) => {
    setTimeout(() => {
      colorCells.value[idx].active = true
      colorCells.value[idx].color = colors[i % colors.length]
      setTimeout(() => {
        colorCells.value[idx].active = false
      }, 800)
    }, i * 1000)
  })
}

const handleColorClick = (index: number) => {
  if (colorStep.value >= colorSequence.value.length) return

  if (index === colorSequence.value[colorStep.value]) {
    colorCells.value[index].highlight = true
    colorStep.value++
    if (colorStep.value >= colorSequence.value.length) {
      colorScore.value += colorLevel.value * 10
      colorLevel.value++
      uni.showToast({ title: '正确！', icon: 'success' })
      setTimeout(showColorSequence, 1500)
    }
  } else {
    uni.showToast({ title: '错误，重新开始', icon: 'none' })
    colorLevel.value = Math.max(1, colorLevel.value - 1)
    setTimeout(showColorSequence, 1500)
  }
}

const startSequenceTest = () => {
  gameState.value = 'sequence-test'
  sequenceLevel.value = 1
  sequenceScore.value = 0
  initSequenceGame()
}

const initSequenceGame = () => {
  const count = Math.min(4 + sequenceLevel.value, 16)
  const nums = Array.from({ length: count }, (_, i) => i + 1)
  // 洗牌
  for (let i = nums.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [nums[i], nums[j]] = [nums[j], nums[i]]
  }

  sequenceNumbers.value = nums.map(n => ({ value: n, clicked: false }))
  nextExpected.value = 1
  sequenceTimer.value = Math.max(10, 30 - sequenceLevel.value * 2)

  clearInterval(timerInterval)
  timerInterval = setInterval(() => {
    sequenceTimer.value--
    if (sequenceTimer.value <= 0) {
      clearInterval(timerInterval)
      uni.showToast({ title: '时间到！', icon: 'none' })
      sequenceLevel.value = Math.max(1, sequenceLevel.value - 1)
      setTimeout(initSequenceGame, 1500)
    }
  }, 1000)
}

const handleNumberClick = (index: number) => {
  const num = sequenceNumbers.value[index]
  if (num.clicked) return

  if (num.value === nextExpected.value) {
    num.clicked = true
    nextExpected.value++

    if (nextExpected.value > sequenceNumbers.value.length) {
      clearInterval(timerInterval)
      sequenceScore.value += sequenceLevel.value * 10
      sequenceLevel.value++
      uni.showToast({ title: '完成！', icon: 'success' })
      setTimeout(initSequenceGame, 1500)
    }
  } else {
    clearInterval(timerInterval)
    uni.showToast({ title: '点错了！', icon: 'none' })
    sequenceLevel.value = Math.max(1, sequenceLevel.value - 1)
    setTimeout(initSequenceGame, 1500)
  }
}

// 结束本轮：成绩落库（仅打破纪录时），进入结果区给下一步引导
const finishTest = () => {
  clearInterval(timerInterval)
  const isColor = gameState.value === 'color-test'
  lastMode.value = isColor ? 'color' : 'sequence'
  resultLevel.value = isColor ? colorLevel.value : sequenceLevel.value
  resultScore.value = isColor ? colorScore.value : sequenceScore.value
  newBest.value = saveMemoryTestBest(lastMode.value, resultLevel.value, resultScore.value)
  bestLevel.value = getMemoryTestBest(lastMode.value)?.level ?? resultLevel.value
  encourageText.value = getEncourageText()
  refreshBests()
  gameState.value = 'result'
}

// 结果区引导：重开刚结束的模式 / 去数字记忆训练 / 返回菜单
const retryTest = () => {
  if (lastMode.value === 'color') startColorTest()
  else startSequenceTest()
}

const goToNumberMemory = () => {
  uni.navigateTo({ url: '/subPackages/pages-memory/number-memory/number-memory' })
}

const goToMenu = () => {
  clearInterval(timerInterval)
  gameState.value = 'menu'
}

onUnmounted(() => {
  clearInterval(timerInterval)
})
</script>

<style scoped>
.memory-test-container {
  min-height: 100vh;
  background: linear-gradient(135deg, #52796f 0%, #3d5a52 100%);
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
  margin-top: 40rpx;
}

.test-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
}

.option-card {
  background: rgba(255,255,255,0.95);
  border-radius: 20rpx;
  padding: 40rpx 20rpx;
  text-align: center;
}

.option-icon {
  font-size: 60rpx;
  display: block;
}

.option-title {
  font-size: 30rpx;
  font-weight: bold;
  color: #333;
  margin-top: 16rpx;
  display: block;
}

.option-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.option-best {
  display: inline-block;
  margin-top: 14rpx;
  font-size: 22rpx;
  color: #52796f;
  background: rgba(82, 121, 111, 0.12);
  padding: 4rpx 16rpx;
  border-radius: 20rpx;
}

.color-test, .sequence-test {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 40rpx;
}

.test-title {
  font-size: 32rpx;
  color: #fff;
  margin-bottom: 30rpx;
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 30rpx;
}

.color-cell {
  width: 160rpx;
  height: 160rpx;
  border-radius: 16rpx;
  background: #e0e0e0;
  transition: all 0.3s;
}

.color-cell.highlight {
  border: 4rpx solid #fff;
  transform: scale(1.05);
}

.number-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16rpx;
  margin-bottom: 30rpx;
}

.number-cell {
  width: 120rpx;
  height: 120rpx;
  background: #fff;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.number-cell.clicked {
  background: #c8d6cc;
  color: #3d5a52;
}

.timer {
  font-size: 48rpx;
  font-weight: bold;
  color: #fff;
  margin-bottom: 20rpx;
}

.level-info {
  font-size: 28rpx;
  color: rgba(255,255,255,0.9);
  margin-bottom: 20rpx;
}

.back-btn {
  width: 200rpx;
  height: 70rpx;
  background: rgba(255,255,255,0.3);
  color: #fff;
  border-radius: 35rpx;
  font-size: 28rpx;
  border: 2rpx solid #fff;
}

/* 本轮结果区 */
.result-panel {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 60rpx 40rpx;
  background: rgba(255,255,255,0.95);
  border-radius: 24rpx;
  margin-top: 40rpx;
}

.result-icon {
  font-size: 90rpx;
}

.result-encourage {
  font-size: 26rpx;
  color: #52796f;
  margin-top: 20rpx;
  text-align: center;
  line-height: 1.6;
}

.result-stats {
  display: flex;
  gap: 60rpx;
  margin-top: 30rpx;
}

.result-stat {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.result-num {
  font-size: 56rpx;
  font-weight: bold;
  color: #333;
}

.result-label {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
}

.result-new-best {
  font-size: 26rpx;
  color: #c07a2b;
  margin-top: 20rpx;
}

.result-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  margin-top: 24rpx;
  border: none;
}

.result-btn.primary {
  background: #52796f;
  color: #fff;
}

.result-btn.guide {
  background: #e8f0ec;
  color: #52796f;
}

.result-btn.plain {
  background: #f5f5f5;
  color: #666;
}
</style>
