<template>
  <view class="page">
    <!-- ===== 小结页 ===== -->
    <view v-if="showSummary" class="summary">
      <text class="summary-icon">🎯</text>
      <text class="summary-title">本轮完成</text>
      <view class="summary-stats">
        <view class="summary-stat remembered">
          <text class="summary-num">{{ summary.remembered }}</text>
          <text class="summary-label">想起来了</text>
        </view>
        <view class="summary-stat forgotten">
          <text class="summary-num">{{ summary.forgotten }}</text>
          <text class="summary-label">没想起来</text>
        </view>
      </view>
      <button class="summary-btn primary" @click="restartRound">再来一轮</button>
      <button class="summary-btn secondary" @click="goBack">返回</button>
    </view>

    <!-- ===== 答题页 ===== -->
    <template v-else>
      <view class="quiz-head">
        <text class="quiz-mode">{{ mode === 'pegs' ? '数字桩自测' : '条目回忆' }}</text>
        <text class="quiz-progress">第 {{ results.length + 1 }} / {{ ROUND_SIZE }} 题</text>
      </view>

      <!-- 数字桩模式：范围选择 -->
      <view v-if="mode === 'pegs'" class="range-bar">
        <view
          v-for="r in ranges"
          :key="r.value"
          class="range-chip"
          :class="{ active: pegRange === r.value }"
          @click="onChangeRange(r.value)"
        >
          {{ r.label }}
        </view>
      </view>

      <!-- 题目卡 -->
      <view class="quiz-card" @click="revealed = true">
        <template v-if="currentPeg">
          <!-- 数字桩：先显示数字，点击揭示桩描述/图像 -->
          <text class="peg-number">{{ currentPeg.number }}</text>
          <view v-if="!revealed" class="peg-cover">
            <text class="peg-cover-hint">心里回忆这个数字的桩，点我揭示</text>
          </view>
          <template v-else>
            <image
              v-if="currentPeg.imageUrl"
              class="peg-image"
              :src="currentPeg.imageUrl"
              mode="aspectFit"
            />
            <text class="peg-answer">{{ currentPeg.description }}</text>
          </template>
        </template>

        <template v-else-if="currentEntry">
          <!-- 条目：先显示标题，点击揭示数字串 -->
          <text class="entry-label">{{ currentEntry.title }}</text>
          <view v-if="!revealed" class="peg-cover">
            <text class="peg-cover-hint">回忆对应的数字，点我揭示</text>
          </view>
          <text v-else class="entry-answer">{{ formatNumbers(currentEntry.numbers) }}</text>
        </template>

        <view v-else class="quiz-empty">
          <text class="quiz-empty-icon">{{ mode === 'pegs' ? '🪝' : '🔢' }}</text>
          <text class="quiz-empty-title">
            {{ mode === 'pegs' ? '这个范围还没有编桩的数字' : '还没有数字条目' }}
          </text>
          <text class="quiz-empty-tip">
            {{ mode === 'pegs' ? '先回主页为数字编上记忆桩吧' : '先回主页添加电话、生日等条目吧' }}
          </text>
        </view>
      </view>

      <!-- 自评 -->
      <view v-if="hasQuestion" class="rate-bar">
        <button class="rate-btn forgot" :disabled="!revealed" @click="onRate(false)">
          <text>😅 没想起来</text>
        </button>
        <button class="rate-btn remembered" :disabled="!revealed" @click="onRate(true)">
          <text>✅ 想起来了</text>
        </button>
      </view>
      <button v-else class="back-btn" @click="goBack">返回</button>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useNumberMemory } from '@/stores/useNumberMemory'
import {
  ROUND_SIZE,
  pickPegQuestion,
  pickEntryQuestion,
  summarizeRound,
  type PracticeMode,
  type PegRange,
} from './practice'

const store = useNumberMemory()

const mode = ref<PracticeMode>('pegs')
const pegRange = ref<PegRange>('all')
const ranges = [
  { value: 'single', label: '0-9' },
  { value: 'double', label: '10-99' },
  { value: 'all', label: '全部' },
] as const

const currentPeg = ref<ReturnType<typeof pickPegQuestion>>(null)
const currentEntry = ref<ReturnType<typeof pickEntryQuestion>>(null)
const revealed = ref(false)
const asked = ref<Set<string>>(new Set())
const results = ref<boolean[]>([])
const showSummary = ref(false)

const hasQuestion = computed(() => currentPeg.value !== null || currentEntry.value !== null)
const summary = computed(() => summarizeRound(results.value))

onLoad((opt: any) => {
  store.load()
  mode.value = opt?.mode === 'entries' ? 'entries' : 'pegs'
  if (opt?.range === 'single' || opt?.range === 'double' || opt?.range === 'all') {
    pegRange.value = opt.range
  }
  nextQuestion()
})

function nextQuestion() {
  revealed.value = false
  if (mode.value === 'pegs') {
    currentEntry.value = null
    currentPeg.value = pickPegQuestion(store.associations, pegRange.value, asked.value)
    if (currentPeg.value) asked.value.add(currentPeg.value.number)
  } else {
    currentPeg.value = null
    currentEntry.value = pickEntryQuestion(store.entries, asked.value)
    if (currentEntry.value) asked.value.add(currentEntry.value._id)
  }
}

// 切换范围时重置本轮已抽记录，避免上一范围的排除项干扰
function onChangeRange(range: PegRange) {
  pegRange.value = range
  asked.value = new Set()
  nextQuestion()
}

function onRate(remembered: boolean) {
  if (!revealed.value) return
  if (currentPeg.value) {
    store.rateAssociation(currentPeg.value.number, remembered)
  } else if (currentEntry.value) {
    store.rateEntry(currentEntry.value._id, remembered)
  }
  results.value.push(remembered)
  uni.vibrateShort?.({ type: remembered ? 'light' : 'medium' })
  if (results.value.length >= ROUND_SIZE) {
    showSummary.value = true
  } else {
    nextQuestion()
  }
}

function restartRound() {
  results.value = []
  asked.value = new Set()
  showSummary.value = false
  nextQuestion()
}

function goBack() {
  uni.navigateBack()
}

function formatNumbers(nums: string): string {
  return nums.replace(/(\d{4})(?=\d)/g, '$1 ')
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 40rpx;
}

.quiz-head {
  background: linear-gradient(135deg, #52796f 0%, #3d5a52 100%);
  padding: 50rpx 40rpx 32rpx;
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
}
.quiz-mode {
  font-size: 36rpx;
  font-weight: bold;
  color: #fff;
}
.quiz-progress {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
}

.range-bar {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  padding: 20rpx;
}
.range-chip {
  padding: 10rpx 30rpx;
  background: #fff;
  border-radius: 28rpx;
  font-size: 24rpx;
  color: #666;
}
.range-chip.active {
  background: #52796f;
  color: #fff;
}

.quiz-card {
  margin: 12rpx 24rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 60rpx 32rpx;
  min-height: 420rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.peg-number {
  font-size: 100rpx;
  font-weight: bold;
  color: #52796f;
  font-family: 'Courier New', monospace;
}
.peg-cover {
  margin-top: 40rpx;
  padding: 40rpx 48rpx;
  border-radius: 16rpx;
  background: rgba(82, 121, 111, 0.12);
  border: 1rpx dashed rgba(82, 121, 111, 0.4);
}
.peg-cover-hint {
  font-size: 26rpx;
  color: rgba(82, 121, 111, 0.75);
}
.peg-image {
  width: 320rpx;
  height: 240rpx;
  margin-top: 24rpx;
  border-radius: 12rpx;
  background: #f5f5f5;
}
.peg-answer {
  margin-top: 32rpx;
  font-size: 32rpx;
  color: #303030;
  line-height: 1.7;
  text-align: center;
}
.entry-label {
  font-size: 36rpx;
  font-weight: 600;
  color: #303030;
}
.entry-answer {
  margin-top: 40rpx;
  font-size: 56rpx;
  font-weight: 600;
  color: #52796f;
  font-family: 'Courier New', monospace;
  letter-spacing: 6rpx;
  word-break: break-all;
  text-align: center;
}
.quiz-empty {
  text-align: center;
}
.quiz-empty-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 16rpx;
}
.quiz-empty-title {
  font-size: 28rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}
.quiz-empty-tip {
  font-size: 24rpx;
  color: #aaa;
  display: block;
}

.rate-bar {
  display: flex;
  gap: 20rpx;
  padding: 24rpx;
}
.rate-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: none;
  margin: 0;
}
.rate-btn[disabled] {
  opacity: 0.4;
}
.rate-btn.forgot {
  background: #f5f5f5;
  color: #666;
}
.rate-btn.remembered {
  background: #52796f;
  color: #fff;
}
.back-btn {
  margin: 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  background: #52796f;
  color: #fff;
  font-size: 28rpx;
  border: none;
}

/* 小结页 */
.summary {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}
.summary-icon {
  font-size: 90rpx;
  margin-bottom: 16rpx;
}
.summary-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #303030;
  margin-bottom: 40rpx;
}
.summary-stats {
  display: flex;
  gap: 40rpx;
  margin-bottom: 60rpx;
}
.summary-stat {
  width: 220rpx;
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.summary-num {
  font-size: 56rpx;
  font-weight: bold;
}
.summary-stat.remembered .summary-num {
  color: #52796f;
}
.summary-stat.forgotten .summary-num {
  color: #d4564e;
}
.summary-label {
  font-size: 24rpx;
  color: #888;
  margin-top: 8rpx;
}
.summary-btn {
  width: 100%;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 28rpx;
  border: none;
  margin: 0 0 20rpx;
}
.summary-btn.primary {
  background: #52796f;
  color: #fff;
}
.summary-btn.secondary {
  background: #f5f5f5;
  color: #666;
}
</style>
