<template>
  <view class="breakdown-page">
    <!-- 顶部 -->
    <view class="header">
      <text class="title">音素拆解</text>
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
      <text class="quiz-prompt">把单词的音标拆成音素（{{ difficultyLabel(currentQ.word.difficulty) }}）</text>

      <view class="word-display" @click="speakTarget">
        <text class="word-text">{{ currentQ.word.word }}</text>
        <text class="word-phonetic">/{{ currentQ.word.phonetic }}/</text>
        <text class="word-play">🔊 点击发音</text>
      </view>

      <!-- 槽位 -->
      <view class="slots" :class="{ shaking }">
        <view
          v-for="(slot, idx) in slots"
          :key="idx"
          class="slot"
          :class="{
            filled: slot.filled,
            ok: answered && slotCorrect[idx],
            bad: answered && !slotCorrect[idx]
          }"
          @click="onSlotClick(idx)"
        >
          <text v-if="slot.filled" class="slot-ipa">/{{ slot.ipa }}/</text>
          <text v-else class="slot-empty">{{ idx + 1 }}</text>
        </view>
      </view>

      <!-- 音素池 -->
      <view class="pool">
        <view
          v-for="item in pool"
          :key="item.id"
          class="pool-item"
          :class="{ used: item.used }"
          @click="onPoolClick(item)"
        >
          <text class="pool-ipa">/{{ item.ipa }}/</text>
        </view>
      </view>

      <view class="quiz-actions">
        <button v-if="!answered" class="btn-check" :class="{ disabled: !allFilled }" @click="checkAnswer">
          提交
        </button>
        <button v-if="!answered" class="btn-reset" @click="resetSlots">重置</button>
        <button v-if="answered" class="btn-next" @click="nextQuestion">
          {{ currentIndex + 1 >= TOTAL ? '查看结果' : '下一题' }}
        </button>
      </view>
    </view>

    <!-- 结果页 -->
    <view v-if="finished" class="result">
      <text class="result-icon">🧩</text>
      <text class="result-title">本组完成</text>
      <view class="result-stats">
        <text class="result-num correct">{{ correctCount }}</text>
        <text class="result-label">答对</text>
        <text class="result-num wrong">{{ wrongCount }}</text>
        <text class="result-label">答错</text>
      </view>
      <button class="btn-restart" @click="restart">再来一组</button>
      <button class="btn-back" @click="goBack">返回音标表</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { BREAKDOWN_WORDS, breakdownPhonetic, type BreakdownWord } from '@/utils/phoneme-breakdown'
import { ALL_PHONEMES, type Phoneme } from '@/utils/phoneme-data'
import { usePhoneticMemory } from '@/stores/usePhoneticMemory'
import { getTtsAdapter } from '@/adapters/index'

const TOTAL = 10
const phoneticStore = usePhoneticMemory()

interface BreakdownQuestion {
  word: BreakdownWord
  target: Phoneme[]
  distractors: Phoneme[]
}

interface Slot {
  filled: boolean
  ipa: string
  /** 该填充来自池中哪个 id，用于点回时还原 */
  fromPoolId: number
}

interface PoolItem {
  id: number
  ipa: string
  used: boolean
}

const questions = ref<BreakdownQuestion[]>([])
const currentIndex = ref(0)
const correctCount = ref(0)
const wrongCount = ref(0)
const slots = ref<Slot[]>([])
const pool = ref<PoolItem[]>([])
const slotCorrect = ref<boolean[]>([])
const answered = ref(false)
const finished = ref(false)
const shaking = ref(false)

const currentQ = computed<BreakdownQuestion | null>(() => questions.value[currentIndex.value] || null)

const progressPercent = computed(() =>
  Math.round(((currentIndex.value + (answered.value ? 1 : 0)) / TOTAL) * 100),
)

const accuracy = computed(() => {
  const total = correctCount.value + wrongCount.value
  return total ? Math.round((correctCount.value / total) * 100) : 0
})

const allFilled = computed(() => slots.value.every(s => s.filled))

const currentSlotIndex = computed(() => slots.value.findIndex(s => !s.filled))

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

function difficultyLabel(d: 1 | 2 | 3): string {
  return d === 1 ? '入门' : d === 2 ? '中级' : '进阶'
}

/**
 * 为单词构造一道拆解题：
 * - target：正确切分序列
 * - distractors：从全集随机抽 N 个不在 target 中的音素作干扰
 */
function buildQuestion(word: BreakdownWord): BreakdownQuestion | null {
  const { phonemes, complete } = breakdownPhonetic(word.phonetic)
  if (!complete || phonemes.length === 0) return null
  const targetIpas = new Set(phonemes.map(p => p.ipa))
  const distractorPool = ALL_PHONEMES.filter(p => !targetIpas.has(p.ipa))
  const distractorCount = Math.max(2, Math.ceil(phonemes.length / 2))
  const distractors = shuffle(distractorPool).slice(0, distractorCount)
  return { word, target: phonemes, distractors }
}

function generateQuestions() {
  const built = shuffle(BREAKDOWN_WORDS)
    .map(buildQuestion)
    .filter((q): q is BreakdownQuestion => q !== null)
    .slice(0, TOTAL)
  questions.value = built
}

function setupQuiz() {
  if (!currentQ.value) return
  const q = currentQ.value
  slots.value = q.target.map<Slot>(() => ({ filled: false, ipa: '', fromPoolId: -1 }))
  slotCorrect.value = []
  // 池子 = target 音素 + distractors，打散
  let nextId = 0
  const allItems: PoolItem[] = [
    ...q.target.map(ph => ({ id: nextId++, ipa: ph.ipa, used: false })),
    ...q.distractors.map(ph => ({ id: nextId++, ipa: ph.ipa, used: false })),
  ]
  pool.value = shuffle(allItems)
  answered.value = false
  shaking.value = false
}

async function startSession() {
  await phoneticStore.ensureLoaded()
  generateQuestions()
  currentIndex.value = 0
  correctCount.value = 0
  wrongCount.value = 0
  finished.value = false
  setupQuiz()
  setTimeout(speakTarget, 300)
}

function onPoolClick(item: PoolItem) {
  if (answered.value || item.used) return
  const idx = currentSlotIndex.value
  if (idx === -1) return
  slots.value[idx] = { filled: true, ipa: item.ipa, fromPoolId: item.id }
  item.used = true
}

/** 点已填的槽位 = 取回到池子 */
function onSlotClick(idx: number) {
  if (answered.value) return
  const slot = slots.value[idx]
  if (!slot.filled) return
  const poolItem = pool.value.find(p => p.id === slot.fromPoolId)
  if (poolItem) poolItem.used = false
  slots.value[idx] = { filled: false, ipa: '', fromPoolId: -1 }
}

function resetSlots() {
  if (answered.value) return
  for (const s of slots.value) {
    if (s.filled) {
      const poolItem = pool.value.find(p => p.id === s.fromPoolId)
      if (poolItem) poolItem.used = false
    }
  }
  slots.value = slots.value.map(() => ({ filled: false, ipa: '', fromPoolId: -1 }))
}

function checkAnswer() {
  if (!currentQ.value || !allFilled.value) return
  const target = currentQ.value.target
  const correctness: boolean[] = slots.value.map((s, i) => s.ipa === target[i].ipa)
  slotCorrect.value = correctness
  answered.value = true

  const allRight = correctness.every(Boolean)
  if (allRight) {
    correctCount.value++
  } else {
    wrongCount.value++
    shaking.value = true
    setTimeout(() => (shaking.value = false), 400)
    speakTarget()
  }

  // 给每个涉及到的音素都记一次进度（对了 +1，错了 -1）
  target.forEach((ph, i) => {
    phoneticStore.markPhoneme(ph.ipa, correctness[i])
  })
}

function nextQuestion() {
  if (currentIndex.value + 1 >= TOTAL) {
    finished.value = true
    return
  }
  currentIndex.value++
  setupQuiz()
  setTimeout(speakTarget, 300)
}

function speakTarget() {
  if (!currentQ.value) return
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(currentQ.value.word.word)}&type=2`
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
.breakdown-page {
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
  padding: 40rpx 30rpx 60rpx;
}

.quiz-prompt {
  font-size: 26rpx;
  color: #999;
  margin-bottom: 24rpx;
}

.word-display {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: #fff;
  border: 3rpx solid #eef0f4;
  border-radius: 20rpx;
  padding: 30rpx 70rpx;
  margin-bottom: 36rpx;
}

.word-text {
  font-size: 64rpx;
  font-weight: bold;
  color: #303030;
}

.word-phonetic {
  font-size: 36rpx;
  color: #667eea;
  margin-top: 8rpx;
  font-family: 'Times New Roman', serif;
}

.word-play {
  font-size: 22rpx;
  color: #999;
  margin-top: 12rpx;
}

/* 槽位 */
.slots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
  margin-bottom: 36rpx;
}

.slots.shaking {
  animation: shake 0.4s;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  25% { transform: translateX(-10rpx); }
  75% { transform: translateX(10rpx); }
}

.slot {
  width: 110rpx;
  height: 110rpx;
  border: 3rpx dashed #c8cce8;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #fff;
}

.slot.filled {
  border-style: solid;
  border-color: #667eea;
  background: #f0eefa;
}

.slot.ok {
  border-color: #4caf50;
  background: #f2fbf4;
}

.slot.bad {
  border-color: #e64340;
  background: #fef2f2;
}

.slot-ipa {
  font-size: 32rpx;
  font-weight: bold;
  color: #303030;
  font-family: 'Times New Roman', serif;
}

.slot-empty {
  font-size: 30rpx;
  color: #ccc;
}

/* 音素池 */
.pool {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 14rpx;
  margin-bottom: 40rpx;
}

.pool-item {
  padding: 18rpx 26rpx;
  background: #fff;
  border: 3rpx solid #eef0f4;
  border-radius: 14rpx;
}

.pool-item.used {
  opacity: 0.25;
}

.pool-ipa {
  font-size: 30rpx;
  font-weight: bold;
  color: #667eea;
  font-family: 'Times New Roman', serif;
}

.quiz-actions {
  display: flex;
  gap: 20rpx;
  width: 100%;
}

.btn-check {
  flex: 2;
  background: #667eea;
  color: #fff;
  border-radius: 44rpx;
  height: 88rpx;
  font-size: 30rpx;
  border: none;
}

.btn-check.disabled {
  opacity: 0.5;
}

.btn-reset {
  flex: 1;
  background: #f5f5f5;
  color: #666;
  border-radius: 44rpx;
  height: 88rpx;
  font-size: 30rpx;
  border: none;
}

.btn-next {
  flex: 1;
  background: #667eea;
  color: #fff;
  border-radius: 44rpx;
  height: 88rpx;
  font-size: 30rpx;
  border: none;
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
