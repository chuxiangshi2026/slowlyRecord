<template>
  <view class="recognition-page">
    <!-- 顶部 -->
    <view class="header">
      <text class="title">{{ direction === 'forward' ? '音标识别' : '反向识别' }}</text>
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
      <text class="quiz-prompt">{{ direction === 'forward' ? '这个音标的例词是？' : '这个单词包含哪个音？' }}</text>

      <!-- 正向：题干 IPA；反向：题干单词 -->
      <view class="prompt-card" @click="autoSpeakPrompt">
        <text v-if="direction === 'forward'" class="ipa-text">/{{ currentQ.phoneme.ipa }}/</text>
        <text v-else class="word-text">{{ currentQ.targetWord }}</text>
        <text class="prompt-play">🔊 点击发音</text>
      </view>
      <text v-if="direction === 'forward'" class="ipa-tip">{{ currentQ.phoneme.groupLabel }} · 发音要点：{{ currentQ.phoneme.tip }}</text>

      <!-- 选项 -->
      <view class="options">
        <view
          v-for="(opt, idx) in currentQ.options"
          :key="idx"
          class="option-card"
          :class="optionClass(idx)"
          @click="choose(idx)"
        >
          <text v-if="direction === 'forward'" class="option-word">{{ opt }}</text>
          <text v-else class="option-ipa">/{{ opt }}/</text>
        </view>
      </view>

      <button v-if="answered" class="btn-next" @click="nextQuestion">
        {{ currentIndex + 1 >= TOTAL ? '查看结果' : '下一题' }}
      </button>
    </view>

    <!-- 结果页 -->
    <view v-if="finished" class="result">
      <text class="result-icon">🎉</text>
      <text class="result-title">本组完成</text>
      <view class="result-stats">
        <text class="result-num correct">{{ correctCount }}</text>
        <text class="result-label">答对</text>
        <text class="result-num wrong">{{ wrongCount }}</text>
        <text class="result-label">答错</text>
      </view>
      <text class="result-accuracy">正确率 {{ accuracy }}%</text>
      <text class="result-encourage">{{ encourageText }}</text>
      <button class="btn-restart" @click="restart">再来一组</button>
      <button class="btn-back" @click="goReview">📚 去复习单词</button>
      <button class="btn-back" @click="goBack">返回音标表</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { ALL_PHONEMES, findPhoneme, type Phoneme } from '@/utils/phoneme-data'
import { usePhoneticMemory } from '@/stores/usePhoneticMemory'
import { getTtsAdapter } from '@/adapters/index'
import { getEncourageText } from '@/utils/encourage'

const TOTAL = 12
const phoneticStore = usePhoneticMemory()

const direction = ref<'forward' | 'backward'>('forward')

interface Question {
  phoneme: Phoneme
  targetWord: string
  options: string[]
  answerIdx: number
}

const questions = ref<Question[]>([])
const currentIndex = ref(0)
const correctCount = ref(0)
const wrongCount = ref(0)
const pickedIdx = ref<number | null>(null)
const answered = ref(false)
const finished = ref(false)
// 完成页鼓励语：每组开始时刷新
const encourageText = ref(getEncourageText())

const currentQ = computed<Question | null>(() => questions.value[currentIndex.value] || null)

const progressPercent = computed(() =>
  Math.round(((currentIndex.value + (answered.value ? 1 : 0)) / TOTAL) * 100),
)

const accuracy = computed(() => {
  const total = correctCount.value + wrongCount.value
  return total ? Math.round((correctCount.value / total) * 100) : 0
})

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** 正向题：题干 IPA，正确选项是该音素的例词，干扰项从 similar 抽 */
function buildForwardQuestion(phoneme: Phoneme): Question {
  const correct = phoneme.examples[Math.floor(Math.random() * phoneme.examples.length)]
  const distractors: string[] = []
  for (const ipa of phoneme.similar || []) {
    const ph = findPhoneme(ipa)
    if (!ph) continue
    const word = ph.examples[Math.floor(Math.random() * ph.examples.length)]
    if (word !== correct && !distractors.includes(word)) distractors.push(word)
    if (distractors.length >= 3) break
  }
  while (distractors.length < 3) {
    const ph = ALL_PHONEMES[Math.floor(Math.random() * ALL_PHONEMES.length)]
    if (ph.ipa === phoneme.ipa) continue
    const word = ph.examples[Math.floor(Math.random() * ph.examples.length)]
    if (word !== correct && !distractors.includes(word)) distractors.push(word)
  }
  const options = shuffle([correct, ...distractors])
  return { phoneme, targetWord: correct, options, answerIdx: options.indexOf(correct) }
}

/** 反向题：题干单词，正确选项是音素 IPA，干扰项从 similar 抽 */
function buildBackwardQuestion(phoneme: Phoneme): Question {
  const targetWord = phoneme.examples[Math.floor(Math.random() * phoneme.examples.length)]
  const correctIpa = phoneme.ipa
  const distractors: string[] = []
  for (const ipa of phoneme.similar || []) {
    if (!distractors.includes(ipa) && ipa !== correctIpa) distractors.push(ipa)
    if (distractors.length >= 3) break
  }
  while (distractors.length < 3) {
    const ph = ALL_PHONEMES[Math.floor(Math.random() * ALL_PHONEMES.length)]
    if (ph.ipa !== correctIpa && !distractors.includes(ph.ipa)) distractors.push(ph.ipa)
  }
  const options = shuffle([correctIpa, ...distractors])
  return { phoneme, targetWord, options, answerIdx: options.indexOf(correctIpa) }
}

async function startSession() {
  await phoneticStore.ensureLoaded()
  const picked = phoneticStore.pickPhonemesForSession(TOTAL)
  const builder = direction.value === 'forward' ? buildForwardQuestion : buildBackwardQuestion
  questions.value = picked.map(builder)
  currentIndex.value = 0
  correctCount.value = 0
  wrongCount.value = 0
  pickedIdx.value = null
  answered.value = false
  finished.value = false
  encourageText.value = getEncourageText()
  setTimeout(autoSpeakPrompt, 300)
}

function choose(idx: number) {
  if (answered.value || !currentQ.value) return
  pickedIdx.value = idx
  answered.value = true
  const isCorrect = idx === currentQ.value.answerIdx
  if (isCorrect) correctCount.value++
  else wrongCount.value++
  // 播报目标词发音，强化听感
  speakWord(currentQ.value.targetWord)
  phoneticStore.markPhoneme(currentQ.value.phoneme.ipa, isCorrect)
}

function optionClass(idx: number) {
  if (!answered.value || !currentQ.value) return ''
  if (idx === currentQ.value.answerIdx) return 'correct'
  if (idx === pickedIdx.value) return 'wrong'
  return 'disabled'
}

function nextQuestion() {
  if (currentIndex.value + 1 >= TOTAL) {
    finished.value = true
    return
  }
  currentIndex.value++
  pickedIdx.value = null
  answered.value = false
  setTimeout(autoSpeakPrompt, 200)
}

/** 进入每题时自动发音：正向读音素代理串，反向读单词 */
function autoSpeakPrompt() {
  if (!currentQ.value) return
  if (direction.value === 'forward') {
    speakWord(currentQ.value.phoneme.articulation)
  } else {
    speakWord(currentQ.value.targetWord)
  }
}

function speakWord(word: string) {
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
    getTtsAdapter().playAudio(url).catch(() => {})
  } catch {}
}

function restart() {
  startSession()
}

function goBack() {
  uni.navigateBack()
}

// 完成页引导：去主复习页接着练单词
function goReview() {
  uni.switchTab({ url: '/pages/review/review' })
}

onMounted(() => {})

onLoad((opt: any) => {
  if (opt?.direction === 'backward') direction.value = 'backward'
  startSession()
})
</script>

<style scoped>
.recognition-page {
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
  color: #52796f;
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
  background: #52796f;
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
  margin-bottom: 24rpx;
}

.prompt-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx 70rpx;
  background: #fff;
  border: 3rpx solid #eef0f4;
  border-radius: 24rpx;
  margin-bottom: 16rpx;
}

.ipa-text {
  font-size: 88rpx;
  font-weight: bold;
  color: #303030;
  font-family: 'Times New Roman', serif;
  line-height: 1.2;
}

.word-text {
  font-size: 72rpx;
  font-weight: bold;
  color: #303030;
  line-height: 1.2;
}

.prompt-play {
  font-size: 22rpx;
  color: #52796f;
  margin-top: 16rpx;
}

.ipa-tip {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 20rpx;
}

.options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20rpx;
  width: 100%;
  margin-top: 20rpx;
}

.option-card {
  background: #fff;
  border: 3rpx solid #eef0f4;
  border-radius: 16rpx;
  padding: 34rpx 20rpx;
  text-align: center;
}

.option-card.correct {
  border-color: #52796f;
  background: #f4faf5;
}

.option-card.wrong {
  border-color: #e64340;
  background: #fef2f2;
}

.option-card.disabled {
  opacity: 0.45;
}

.option-word {
  font-size: 36rpx;
  font-weight: bold;
  color: #303030;
}

.option-ipa {
  font-size: 40rpx;
  font-weight: bold;
  color: #303030;
  font-family: 'Times New Roman', serif;
}

.btn-next {
  margin-top: 50rpx;
  background: #52796f;
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
  color: #52796f;
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
  color: #52796f;
  margin-top: 16rpx;
}

.result-encourage {
  font-size: 26rpx;
  color: #52796f;
  margin-top: 24rpx;
  text-align: center;
  line-height: 1.6;
  padding: 0 30rpx;
}

.btn-restart {
  margin-top: 60rpx;
  background: #52796f;
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
