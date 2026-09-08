<template>
  <view class="practice-page">
    <!-- 顶部进度 -->
    <view class="header">
      <text class="title">{{ modeTitle }}</text>
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
      <!-- 拼答案模式（答案 token 数 2~8 时点选，否则回退翻卡自评） -->
      <template v-if="mode === 'spell' && !spellFallback">
        <view class="choice-prompt">
          <text class="q-label">按顺序点选碎片拼出答案</text>
          <text class="q-text">{{ currentItem.question }}</text>
          <text v-if="extrasText" class="q-extras">{{ extrasText }}</text>
        </view>

        <!-- 答题区：已点碎片序列，点按可撤回 -->
        <view
          class="spell-answer"
          :class="{ correct: spellDone && spellCorrect, wrong: spellDone && !spellCorrect }"
        >
          <view
            v-for="(tile, idx) in spellPlaced"
            :key="tile.id"
            class="spell-placed"
            @click="recallTile(idx)"
          >
            <text class="spell-placed-text">{{ tile.text }}</text>
          </view>
          <text v-if="spellPlaced.length === 0" class="spell-placeholder">点击下方碎片开始拼答案</text>
        </view>

        <!-- 判分反馈 -->
        <view v-if="spellDone" class="spell-feedback">
          <text v-if="spellCorrect" class="feedback-text ok">✓ 拼对了</text>
          <text v-else class="feedback-text bad">✗ 正确答案：{{ currentItem.answer }}</text>
        </view>

        <!-- 碎片格子区 -->
        <view class="spell-pool">
          <view
            v-for="tile in spellTiles"
            :key="tile.id"
            v-show="!tile.used"
            class="spell-tile"
            @click="pickTile(tile)"
          >
            <text class="spell-tile-text">{{ tile.text }}</text>
          </view>
        </view>

        <button v-if="spellDone" class="btn-next" @click="nextQuestion">下一题</button>
      </template>

      <!-- 翻卡模式（含拼答案回退条目） -->
      <template v-else-if="mode === 'flip' || spellFallback">
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
        <text v-if="spellFallback" class="fallback-tip">该答案过长或过短，已切换为翻卡自评</text>
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
import { useKnowledgeMemory, normalizeAnswer } from './useKnowledgeMemory'
import { tokenizeAnswer, type AnswerTile } from '@/utils/answer-tokens'
import type { KnowledgeItem } from '@/stores/useUtils/types'

const SESSION_SIZE = 10
/** 拼答案长度闸：token 数 2~8 才点选，其余回退翻卡自评 */
const MIN_SPELL_TOKENS = 2
const MAX_SPELL_TOKENS = 8

const store = useKnowledgeMemory()
const packId = ref('')
const mode = ref<'flip' | 'choice' | 'spell'>('flip')

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

// 拼答案状态
const spellTiles = ref<(AnswerTile & { used: boolean })[]>([])
const spellPlaced = ref<AnswerTile[]>([])
const spellDone = ref(false)
const spellCorrect = ref(false)

const currentItem = computed(() => sessionItems.value[currentIndex.value] || null)

const modeTitle = computed(() => {
  if (mode.value === 'flip') return '翻卡练习'
  if (mode.value === 'choice') return '四选一'
  return '拼答案'
})

/** 拼答案长度闸：答案 token 数不在 2~8 区间时，该条目回退为翻卡自评 */
const spellFallback = computed(() => {
  if (mode.value !== 'spell' || !currentItem.value) return false
  const n = tokenizeAnswer(currentItem.value.answer).length
  return n < MIN_SPELL_TOKENS || n > MAX_SPELL_TOKENS
})

const progressPercent = computed(() =>
  Math.round(((currentIndex.value + (answered.value || revealed.value || (spellDone.value && !spellFallback.value) ? 1 : 0)) / sessionItems.value.length) * 100),
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
  spellPlaced.value = []
  spellDone.value = false
  spellCorrect.value = false
  if (mode.value === 'choice' && currentItem.value) {
    options.value = store.generateChoices(packId.value, currentItem.value)
  }
  if (mode.value === 'spell' && currentItem.value && !spellFallback.value) {
    spellTiles.value = store.generateFragments(packId.value, currentItem.value).map(t => ({ ...t, used: false }))
  }
}

function reveal() {
  // 翻卡模式 + 拼答案回退条目（长度闸外）都走翻卡自评
  if (mode.value === 'flip' || spellFallback.value) revealed.value = true
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

/** 拼答案：点选碎片放入答题区，放满自动判分 */
function pickTile(tile: AnswerTile & { used: boolean }) {
  const item = currentItem.value
  if (!item || spellDone.value || tile.used) return
  tile.used = true
  spellPlaced.value.push({ id: tile.id, text: tile.text })
  if (spellPlaced.value.length === tokenizeAnswer(item.answer).length) {
    gradeSpell()
  }
}

/** 拼答案：点按已放碎片撤回 */
function recallTile(idx: number) {
  if (spellDone.value) return
  const tile = spellPlaced.value[idx]
  if (!tile) return
  const poolTile = spellTiles.value.find(t => t.id === tile.id)
  if (poolTile) poolTile.used = false
  spellPlaced.value.splice(idx, 1)
}

/** 拼答案判分：比较归一化后的 token 拼接序列，与翻卡自评同等计入进度 */
function gradeSpell() {
  const item = currentItem.value
  if (!item || spellDone.value) return
  const joined = spellPlaced.value.map(t => t.text).join('')
  const isCorrect = normalizeAnswer(joined) === normalizeAnswer(item.answer)
  spellDone.value = true
  spellCorrect.value = isCorrect
  store.markItem(packId.value, item.id, isCorrect)
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
  if (opt?.mode === 'spell') mode.value = 'spell'
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

/* 拼答案 */
.spell-answer {
  width: 100%;
  min-height: 130rpx;
  background: #fff;
  border: 3rpx dashed #cfd8dc;
  border-radius: 20rpx;
  padding: 24rpx 20rpx;
  display: flex;
  flex-wrap: wrap;
  align-content: center;
  justify-content: center;
  gap: 14rpx;
  margin-bottom: 26rpx;
  transition: border-color 0.2s;
}

.spell-answer.correct {
  border-color: #4caf50;
  border-style: solid;
  background: #f2fbf4;
}

.spell-answer.wrong {
  border-color: #e64340;
  border-style: solid;
  background: #fef2f2;
}

.spell-placeholder {
  font-size: 26rpx;
  color: #bbb;
  align-self: center;
}

.spell-placed {
  min-width: 72rpx;
  height: 88rpx;
  padding: 0 16rpx;
  background: #eef4f0;
  border: 3rpx solid #52796f;
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.spell-placed-text {
  font-size: 38rpx;
  font-weight: bold;
  color: #52796f;
}

.spell-feedback {
  width: 100%;
  margin-bottom: 24rpx;
  text-align: center;
}

.feedback-text {
  font-size: 30rpx;
  font-weight: bold;
}

.feedback-text.ok {
  color: #4caf50;
}

.feedback-text.bad {
  color: #e64340;
}

.spell-pool {
  width: 100%;
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 18rpx;
  padding: 30rpx 10rpx;
  background: #eef0f4;
  border-radius: 20rpx;
}

.spell-tile {
  min-width: 88rpx;
  height: 96rpx;
  padding: 0 20rpx;
  background: #fff;
  border: 3rpx solid #d5ddd8;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3rpx 8rpx rgba(82, 121, 111, 0.12);
}

.spell-tile:active {
  transform: scale(0.92);
}

.spell-tile-text {
  font-size: 40rpx;
  font-weight: bold;
  color: #303030;
}

.fallback-tip {
  font-size: 24rpx;
  color: #999;
  margin-top: 24rpx;
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
