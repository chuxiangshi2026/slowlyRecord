<template>
  <view class="page" :class="themeClass">
    <AppBackground />
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
        <text class="quiz-mode">{{ MODE_LABELS[mode] }}</text>
        <text class="quiz-progress">第 {{ results.length + 1 }} / {{ ROUND_SIZE }} 题</text>
      </view>

      <!-- 认桩/数字桩模式：范围选择 -->
      <view v-if="mode === 'pegs' || mode === 'choice'" class="range-bar">
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

      <!-- 认桩选择题：看数字选桩描述 -->
      <template v-if="mode === 'choice' && currentPeg">
        <view class="choice-card">
          <text class="peg-number">{{ currentPeg.number }}</text>
          <text class="choice-hint">这个数字的桩是？</text>
        </view>
        <view class="choice-list">
          <view
            v-for="desc in choiceOptions"
            :key="desc"
            class="choice-item"
            :class="choiceClassOf(desc)"
            @click="pickChoice(desc)"
          >
            <text class="choice-text">{{ desc }}</text>
          </view>
        </view>
        <button v-if="pickedWrong" class="summary-btn primary next-btn" @click="advanceQuestion">下一题</button>
      </template>

      <!-- 题目卡（背桩 / 编码复述 / 实战） -->
      <view v-if="mode !== 'choice'" class="quiz-card" @click="revealed = true">
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

        <template v-else-if="currentEntry && mode === 'story'">
          <!-- 编码复述：看数字串，回忆桩链故事 -->
          <text class="story-numbers">{{ formatNumbers(currentEntry.numbers) }}</text>
          <view v-if="!revealed" class="peg-cover">
            <text class="peg-cover-hint">把这串数字在脑子里过成桩链故事，点我揭示</text>
          </view>
          <template v-else>
            <text class="story-chain">{{ currentStory }}</text>
            <text class="story-entry-title">—— {{ currentEntry.title }}</text>
          </template>
        </template>

        <template v-else-if="currentEntry">
          <!-- 条目：先显示标题，点击揭示数字串 -->
          <text class="entry-label">{{ currentEntry.title }}</text>
          <view v-if="!revealed" class="peg-cover">
            <text class="peg-cover-hint">回忆对应的数字，点我揭示</text>
          </view>
          <template v-else>
            <text class="entry-answer">{{ formatNumbers(currentEntry.numbers) }}</text>
            <text v-if="currentStory" class="story-chain small">🔗 {{ currentStory }}</text>
          </template>
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

      <!-- 自评（背桩/复述/实战） -->
      <view v-if="mode !== 'choice' && hasQuestion" class="rate-bar">
        <button class="rate-btn forgot" :disabled="!revealed" @click="onRate(false)">
          <text>😅 没想起来</text>
        </button>
        <button class="rate-btn remembered" :disabled="!revealed" @click="onRate(true)">
          <text>✅ 想起来了</text>
        </button>
      </view>
      <button v-else-if="mode !== 'choice'" class="back-btn" @click="goBack">返回</button>
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
  buildPegChoiceOptions,
  type PracticeMode,
  type PegRange,
} from './practice'
import { pegChainOf, chainToStory } from './peg-chain'
import { getPegSuggestion } from './default-pegs'

const store = useNumberMemory()

const mode = ref<PracticeMode>('pegs')
const MODE_LABELS: Record<PracticeMode, string> = {
  choice: '认桩练习',
  pegs: '背桩练习',
  story: '编码复述',
  entries: '实战回忆',
}
const pegRange = ref<PegRange>('all')
const ranges = [
  { value: 'single', label: '0-9' },
  { value: 'double', label: '10-99' },
  { value: 'all', label: '全部' },
] as const

const currentPeg = ref<ReturnType<typeof pickPegQuestion>>(null)
const currentEntry = ref<ReturnType<typeof pickEntryQuestion>>(null)
const choiceOptions = ref<string[]>([])
const picked = ref('')
const revealed = ref(false)
const asked = ref<Set<string>>(new Set())
const results = ref<boolean[]>([])
const showSummary = ref(false)

const hasQuestion = computed(() => currentPeg.value !== null || currentEntry.value !== null)
const summary = computed(() => summarizeRound(results.value))
const pickedWrong = computed(
  () => picked.value !== '' && picked.value !== currentPeg.value?.description,
)

/** 当前条目的桩链故事（优先用户桩，回落推荐桩） */
const currentStory = computed(() => {
  if (!currentEntry.value) return ''
  return chainToStory(
    pegChainOf(currentEntry.value.numbers, (num) => {
      const a = store.getAssociation(num)
      if (a?.description) return a.description
      return getPegSuggestion(num) || undefined
    }),
  )
})

onLoad((opt: any) => {
  store.load()
  const m = opt?.mode
  mode.value = m === 'entries' || m === 'story' || m === 'choice' ? m : 'pegs'
  if (opt?.range === 'single' || opt?.range === 'double' || opt?.range === 'all') {
    pegRange.value = opt.range
  }
  nextQuestion()
})

function nextQuestion() {
  revealed.value = false
  picked.value = ''
  if (mode.value === 'pegs' || mode.value === 'choice') {
    currentEntry.value = null
    currentPeg.value = pickPegQuestion(store.associations, pegRange.value, asked.value)
    if (currentPeg.value) {
      asked.value.add(currentPeg.value.number)
      if (mode.value === 'choice') {
        choiceOptions.value = buildPegChoiceOptions(currentPeg.value, store.associations, pegRange.value)
      }
    }
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

/** 认桩选择：选对自动下一题，选错揭示答案手动下一题 */
function pickChoice(desc: string) {
  if (!currentPeg.value || picked.value) return
  picked.value = desc
  const ok = desc === currentPeg.value.description
  store.rateAssociation(currentPeg.value.number, ok)
  results.value.push(ok)
  uni.vibrateShort?.({ type: ok ? 'light' : 'medium' })
  if (ok) {
    setTimeout(() => advanceQuestion(), 500)
  }
}

function choiceClassOf(desc: string): string {
  if (!picked.value) return ''
  if (desc === currentPeg.value?.description) return 'correct'
  if (desc === picked.value) return 'wrong'
  return 'dim'
}

function advanceQuestion() {
  if (results.value.length >= ROUND_SIZE) {
    showSummary.value = true
  } else {
    nextQuestion()
  }
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
  background: var(--sr-bg);
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
  background: var(--sr-card);
  border-radius: 28rpx;
  font-size: 24rpx;
  color: var(--sr-text-2);
}
.range-chip.active {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
}

.quiz-card {
  margin: 12rpx 24rpx;
  background: var(--sr-card);
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
  color: var(--sr-primary);
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
.theme-dark .peg-cover {
  background: rgba(131, 197, 168, 0.12);
  border-color: rgba(131, 197, 168, 0.4);
}
.theme-dark .peg-cover-hint {
  color: rgba(131, 197, 168, 0.85);
}
.peg-image {
  width: 320rpx;
  height: 240rpx;
  margin-top: 24rpx;
  border-radius: 12rpx;
  background: var(--sr-card-2);
}
.peg-answer {
  margin-top: 32rpx;
  font-size: 32rpx;
  color: var(--sr-text-strong);
  line-height: 1.7;
  text-align: center;
}
.entry-label {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--sr-text-strong);
}
.entry-answer {
  margin-top: 40rpx;
  font-size: 56rpx;
  font-weight: 600;
  color: var(--sr-primary);
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
  color: var(--sr-text-2);
  display: block;
  margin-bottom: 8rpx;
}
.quiz-empty-tip {
  font-size: 24rpx;
  color: var(--sr-text-3);
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
  background: var(--sr-card-2);
  color: var(--sr-text-2);
}
.rate-btn.remembered {
  background: var(--sr-primary);
  color: var(--sr-on-primary);
}
.back-btn {
  margin: 24rpx;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  background: var(--sr-primary);
  color: var(--sr-on-primary);
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
  color: var(--sr-text-strong);
  margin-bottom: 40rpx;
}
.summary-stats {
  display: flex;
  gap: 40rpx;
  margin-bottom: 60rpx;
}
.summary-stat {
  width: 220rpx;
  background: var(--sr-card);
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
  color: var(--sr-primary);
}
.summary-stat.forgotten .summary-num {
  color: #d4564e;
}
.summary-label {
  font-size: 24rpx;
  color: var(--sr-text-2);
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
  background: var(--sr-primary);
  color: var(--sr-on-primary);
}
.summary-btn.secondary {
  background: var(--sr-card-2);
  color: var(--sr-text-2);
}

/* 认桩选择题 */
.choice-card {
  margin: 12rpx 24rpx 0;
  background: var(--sr-card);
  border-radius: 20rpx;
  padding: 48rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.choice-hint {
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--sr-text-2);
}
.choice-list {
  margin: 24rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.choice-item {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
  border: 2rpx solid transparent;
}
.choice-item.correct {
  border-color: var(--sr-primary);
}
.choice-item.wrong {
  border-color: #d4564e;
}
.choice-item.dim {
  opacity: 0.5;
}
.choice-text {
  font-size: 28rpx;
  color: var(--sr-text-strong);
  line-height: 1.5;
}
.next-btn {
  margin: 0 24rpx;
}

/* 编码复述 */
.story-numbers {
  font-size: 48rpx;
  font-weight: 600;
  color: var(--sr-primary);
  font-family: 'Courier New', monospace;
  letter-spacing: 4rpx;
  text-align: center;
  word-break: break-all;
}
.story-chain {
  margin-top: 32rpx;
  font-size: 30rpx;
  color: var(--sr-text-strong);
  line-height: 1.8;
  text-align: center;
}
.story-chain.small {
  font-size: 24rpx;
  color: var(--sr-text-2);
}
.story-entry-title {
  margin-top: 20rpx;
  font-size: 24rpx;
  color: var(--sr-text-3);
}
</style>
