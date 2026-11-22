<template>
  <view class="page" :class="themeClass">
    <AppBackground />
    <!-- ===== 小结页 ===== -->
    <view v-if="showSummary" class="summary">
      <text class="summary-icon">🎯</text>
      <text class="summary-title">本轮完成</text>
      <view class="summary-stats">
        <view class="summary-stat remembered">
          <text class="summary-num">{{ rememberedCount }}</text>
          <text class="summary-label">记住了</text>
        </view>
        <view class="summary-stat forgotten">
          <text class="summary-num">{{ results.length - rememberedCount }}</text>
          <text class="summary-label">没记住</text>
        </view>
      </view>
      <button class="summary-btn primary" @click="startRound">再来一轮</button>
      <button class="summary-btn secondary" @click="goBack">返回</button>
    </view>

    <template v-else>
      <view class="quiz-head">
        <text class="quiz-mode">{{ modeLabel }}</text>
        <text class="quiz-progress">第 {{ results.length + 1 }} / {{ roundLetters.length }} 题</text>
      </view>

      <!-- 题目：字母 -->
      <view class="letter-wrap">
        <text class="quiz-letter">{{ currentLetter?.toUpperCase() }}</text>
        <text class="quiz-letter-lower">{{ currentLetter }}</text>
      </view>

      <!-- ===== 认映射：4 选 1 ===== -->
      <template v-if="mode === 'recognize'">
        <view class="option-list">
          <view
            v-for="opt in options"
            :key="opt.name"
            class="option-item"
            :class="optionClassOf(opt.name)"
            @click="pick(opt.name)"
          >
            <text class="option-emoji">{{ opt.emoji }}</text>
            <text class="option-name">{{ opt.name }}</text>
          </view>
        </view>
        <button v-if="answeredWrong" class="summary-btn primary next-btn" @click="advance">下一题</button>
      </template>

      <!-- ===== 背映射：回忆后自评 ===== -->
      <template v-else>
        <view class="recall-wrap" @click="reveal">
          <template v-if="revealed && currentDisplay">
            <text class="recall-emoji">{{ currentDisplay.emoji }}</text>
            <text class="recall-name">{{ currentDisplay.name }}</text>
            <text class="recall-desc">{{ currentDisplay.description }}</text>
          </template>
          <text v-else class="recall-hint">心里想出画面，点我看答案</text>
        </view>
        <view class="judge-row">
          <button class="judge-btn forgot" @click="mark(false)">没记住</button>
          <button class="judge-btn known" @click="mark(true)">记住了</button>
        </view>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { pickRoundLetters, buildRecognizeOptions } from './letter-practice'
import { useLetterMemory } from '@/stores/useLetterMemory'
import type { LetterSuggestion } from '@/utils/letter-preset'

const store = useLetterMemory()

type Mode = 'recognize' | 'recall'
const mode = ref<Mode>('recognize')

const MODE_LABELS: Record<Mode, string> = {
  recognize: '认映射',
  recall: '背映射',
}
const modeLabel = computed(() => MODE_LABELS[mode.value])

const roundLetters = ref<string[]>([])
const currentIndex = ref(0)
const results = ref<boolean[]>([])
const showSummary = ref(false)
const revealed = ref(false)
const options = ref<LetterSuggestion[]>([])
const picked = ref('')

const currentLetter = computed(() => roundLetters.value[currentIndex.value] ?? '')
const currentDisplay = computed(() =>
  currentLetter.value ? store.getDisplay(currentLetter.value) : undefined,
)
const rememberedCount = computed(() => results.value.filter(Boolean).length)
const answeredWrong = computed(
  () => picked.value !== '' && picked.value !== currentDisplay.value?.name,
)

onLoad(async (query) => {
  mode.value = query?.mode === 'recall' ? 'recall' : 'recognize'
  uni.setNavigationBarTitle({ title: MODE_LABELS[mode.value] })
  await store.ensureLoaded()
  startRound()
})

function startRound() {
  roundLetters.value = pickRoundLetters((l) => store.getEntry(l))
  currentIndex.value = 0
  results.value = []
  showSummary.value = false
  setupQuestion()
}

function setupQuestion() {
  revealed.value = false
  picked.value = ''
  if (mode.value === 'recognize' && currentDisplay.value) {
    const pool = roundLetters.value
      .filter((l) => l !== currentLetter.value)
      .map((l) => store.getDisplay(l))
      .filter((s): s is LetterSuggestion => !!s)
    options.value = buildRecognizeOptions(currentDisplay.value, pool)
  }
}

function pick(name: string) {
  if (picked.value) return
  picked.value = name
  const ok = name === currentDisplay.value?.name
  store.markLetter(currentLetter.value, ok)
  results.value.push(ok)
  if (ok) setTimeout(() => advance(), 600)
}

function optionClassOf(name: string): string {
  if (!picked.value) return ''
  if (name === currentDisplay.value?.name) return 'correct'
  if (name === picked.value) return 'wrong'
  return 'dim'
}

function reveal() {
  revealed.value = true
}

function mark(ok: boolean) {
  if (!revealed.value) {
    reveal()
    return
  }
  store.markLetter(currentLetter.value, ok)
  results.value.push(ok)
  advance()
}

function advance() {
  if (results.value.length >= roundLetters.value.length) {
    showSummary.value = true
    return
  }
  currentIndex.value++
  setupQuestion()
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: var(--sr-bg);
  padding: 20rpx 24rpx 60rpx;
}

.quiz-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24rpx;
}

.quiz-mode {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--sr-text);
}

.quiz-progress {
  font-size: 24rpx;
  color: var(--sr-text-3);
}

.letter-wrap {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 56rpx 24rpx;
  text-align: center;
  margin-bottom: 32rpx;
}

.quiz-letter {
  font-size: 120rpx;
  font-weight: bold;
  color: var(--sr-primary);
}

.quiz-letter-lower {
  font-size: 48rpx;
  color: var(--sr-text-3);
  margin-left: 16rpx;
}

.option-list {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}

.option-item {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
  display: flex;
  align-items: center;
  gap: 24rpx;
  border: 2rpx solid transparent;
}

.option-item.correct {
  border-color: var(--sr-primary);
}

.option-item.wrong {
  border-color: var(--sr-danger, #f56c6c);
}

.option-item.dim {
  opacity: 0.5;
}

.option-emoji {
  font-size: 48rpx;
}

.option-name {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--sr-text);
}

.recall-wrap {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 64rpx 24rpx;
  text-align: center;
}

.recall-emoji {
  font-size: 96rpx;
  display: block;
}

.recall-name {
  font-size: 44rpx;
  font-weight: bold;
  color: var(--sr-text);
  display: block;
  margin-top: 16rpx;
}

.recall-desc {
  font-size: 24rpx;
  color: var(--sr-text-3);
  display: block;
  margin-top: 8rpx;
}

.recall-hint {
  font-size: 28rpx;
  color: var(--sr-text-3);
}

.judge-row {
  display: flex;
  gap: 20rpx;
  margin-top: 40rpx;
}

.judge-btn {
  flex: 1;
  border-radius: 999rpx;
  font-size: 30rpx;
  padding: 8rpx 0;
}

.judge-btn.forgot {
  background: var(--sr-card);
  color: var(--sr-text-2);
}

.judge-btn.known {
  background: var(--sr-primary);
  color: #fff;
}

.next-btn {
  margin-top: 32rpx;
}

.summary {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding-top: 120rpx;
}

.summary-icon {
  font-size: 80rpx;
}

.summary-title {
  font-size: 36rpx;
  font-weight: bold;
  color: var(--sr-text);
  margin: 20rpx 0 32rpx;
}

.summary-stats {
  display: flex;
  gap: 32rpx;
  margin-bottom: 48rpx;
}

.summary-stat {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 24rpx 48rpx;
  text-align: center;
}

.summary-num {
  font-size: 48rpx;
  font-weight: bold;
  color: var(--sr-primary);
  display: block;
}

.summary-stat.forgotten .summary-num {
  color: var(--sr-danger, #f56c6c);
}

.summary-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
  display: block;
  margin-top: 4rpx;
}

.summary-btn {
  width: 100%;
  border-radius: 999rpx;
  font-size: 30rpx;
  margin-bottom: 20rpx;
}

.summary-btn.primary {
  background: var(--sr-primary);
  color: #fff;
}

.summary-btn.secondary {
  background: var(--sr-card);
  color: var(--sr-text-2);
}
</style>
