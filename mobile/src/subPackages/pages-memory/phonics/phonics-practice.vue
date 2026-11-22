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
          <text class="summary-label">{{ mode === 'blend' ? '会拼了' : '答对了' }}</text>
        </view>
        <view class="summary-stat forgotten">
          <text class="summary-num">{{ results.length - rememberedCount }}</text>
          <text class="summary-label">{{ mode === 'blend' ? '还不熟' : '答错了' }}</text>
        </view>
      </view>
      <button class="summary-btn primary" @click="restartRound">再来一轮</button>
      <button class="summary-btn secondary" @click="goBack">返回</button>
    </view>

    <template v-else>
      <view class="quiz-head">
        <text class="quiz-mode">{{ modeLabel }}</text>
        <text class="quiz-progress">第 {{ results.length + 1 }} / {{ ROUND_SIZE }} 题</text>
      </view>

      <!-- ===== 拼读模式 ===== -->
      <template v-if="mode === 'blend' && current">
        <view class="blend-tip">逐块点读，再合成整词</view>
        <view class="blend-blocks">
          <text
            v-for="(b, i) in current.example.blocks"
            :key="i"
            class="blend-block"
            @click="speakBlock(b)"
          >{{ displayBlock(b) }}</text>
        </view>
        <view class="blend-arrow">↓ 合成</view>
        <view class="blend-word-wrap" @click="speakWord(current.example.word)">
          <text class="blend-word">{{ revealed ? current.example.word : '· · ·' }} 🔊</text>
          <text v-if="revealed" class="blend-meaning">{{ current.example.meaning }}（/{{ current.rule.ipa }}/ 音：{{ current.rule.grapheme }}）</text>
          <text v-else class="blend-meaning dim">点我先听整词、看答案</text>
        </view>
        <view class="judge-row">
          <button class="judge-btn forgot" @click="mark(false)">还不熟</button>
          <button class="judge-btn known" @click="mark(true)">会拼了</button>
        </view>
      </template>

      <!-- ===== 听音选词模式 ===== -->
      <template v-else-if="mode === 'listen' && current">
        <view class="listen-play" @click="speakWord(current.example.word)">
          <text class="listen-play-icon">🔊</text>
          <text class="listen-play-text">点击重听</text>
        </view>
        <view class="option-list">
          <view
            v-for="opt in listenOptions"
            :key="opt.word"
            class="option-item"
            :class="optionClassOf(opt.word)"
            @click="pick(opt.word)"
          >
            <text class="option-word">{{ opt.word }}</text>
            <text class="option-meaning">{{ opt.meaning }}</text>
          </view>
        </view>
        <button v-if="answeredWrong" class="summary-btn primary next-btn" @click="nextQuestion">下一题</button>
      </template>

      <!-- ===== 看词分块模式 ===== -->
      <template v-else-if="mode === 'split' && current">
        <view class="listen-play" @click="speakWord(current.example.word)">
          <text class="split-word">{{ current.example.word }} 🔊</text>
          <text class="listen-play-text">选出正确的拼读分块</text>
        </view>
        <view class="option-list">
          <view
            v-for="opt in splitOptions"
            :key="opt"
            class="option-item"
            :class="optionClassOf(opt)"
            @click="pick(opt)"
          >
            <text class="option-word mono">{{ opt }}</text>
          </view>
        </view>
        <button v-if="answeredWrong" class="summary-btn primary next-btn" @click="nextQuestion">下一题</button>
      </template>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { findPhoneme } from '@/utils/phoneme-data'
import { playPhoneme } from '@/utils/phoneme-audio'
import { findPhonicsRule, type PhonicsExample } from '@/utils/phonics-data'
import {
  pickBlendingQuestions,
  buildListenOptions,
  buildSplitOptions,
  correctSplitOf,
  blockSoundText,
  ROUND_SIZE,
  type PhonicsQuestion,
} from '@/utils/phonics-practice'
import { usePhonicsMemory } from '@/stores/usePhonicsMemory'
import { getTtsAdapter } from '@/adapters/index'

const store = usePhonicsMemory()

type Mode = 'blend' | 'listen' | 'split'
const mode = ref<Mode>('blend')

const MODE_LABELS: Record<Mode, string> = {
  blend: '拼读练习',
  listen: '听音选词',
  split: '看词分块',
}
const modeLabel = computed(() => MODE_LABELS[mode.value])

const questions = ref<PhonicsQuestion[]>([])
const currentIndex = ref(0)
const results = ref<boolean[]>([])
const showSummary = ref(false)
const revealed = ref(false)

const listenOptions = ref<PhonicsExample[]>([])
const splitOptions = ref<string[]>([])
const picked = ref('')

const current = computed<PhonicsQuestion | null>(() => questions.value[currentIndex.value] ?? null)
const rememberedCount = computed(() => results.value.filter(Boolean).length)
/** 当前题的正确答案文本：听音选词=单词，看词分块=切分串 */
const answerText = computed(() => {
  if (!current.value) return ''
  return mode.value === 'split' ? correctSplitOf(current.value.example) : current.value.example.word
})
const answeredWrong = computed(
  () => mode.value !== 'blend' && picked.value !== '' && picked.value !== answerText.value,
)

onLoad((query) => {
  const m = query?.mode
  mode.value = m === 'listen' || m === 'split' ? m : 'blend'
  uni.setNavigationBarTitle({ title: MODE_LABELS[mode.value] })
  startRound()
})

function startRound() {
  questions.value = pickBlendingQuestions((id) => store.getRuleProgress(id), ROUND_SIZE)
  currentIndex.value = 0
  results.value = []
  showSummary.value = false
  setupQuestion()
}

function setupQuestion() {
  revealed.value = false
  picked.value = ''
  if (mode.value === 'listen' && current.value) {
    listenOptions.value = buildListenOptions(current.value)
    setTimeout(() => speakWord(current.value!.example.word), 300)
  } else if (mode.value === 'split' && current.value) {
    splitOptions.value = buildSplitOptions(current.value)
  }
}

function speak(text: string) {
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(text)}&type=2`
    getTtsAdapter().playAudio(url).catch(() => {})
  } catch {}
}

function speakWord(word: string) {
  speak(word)
}

function speakBlock(block: string) {
  const fallback = blockSoundText(block, (ipa) => findPhoneme(ipa)?.articulation)
  const rule = findPhonicsRule(block)
  if (rule) {
    playPhoneme(rule.ipa, fallback)
  } else {
    speak(fallback)
  }
}

function displayBlock(block: string): string {
  return findPhonicsRule(block)?.grapheme ?? block
}

/** 拼读模式：自评 */
function mark(ok: boolean) {
  if (!current.value) return
  if (!revealed.value) {
    revealed.value = true
    speakWord(current.value.example.word)
    return
  }
  store.markRule(current.value.rule.id, ok)
  results.value.push(ok)
  advance()
}

/** 听音选词 / 看词分块：选对直接下一题，选错揭示答案后手动下一题 */
function pick(value: string) {
  if (!current.value || picked.value) return
  picked.value = value
  const ok = value === answerText.value
  store.markRule(current.value.rule.id, ok)
  results.value.push(ok)
  if (ok) {
    setTimeout(() => advance(), 600)
  } else {
    speakWord(current.value.example.word)
  }
}

function optionClassOf(value: string): string {
  if (!picked.value) return ''
  if (value === answerText.value) return 'correct'
  if (value === picked.value) return 'wrong'
  return 'dim'
}

function nextQuestion() {
  advance()
}

function advance() {
  if (results.value.length >= ROUND_SIZE) {
    showSummary.value = true
    return
  }
  currentIndex.value++
  setupQuestion()
}

function restartRound() {
  startRound()
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

/* 拼读模式 */
.blend-tip {
  font-size: 24rpx;
  color: var(--sr-text-3);
  text-align: center;
  margin-bottom: 30rpx;
}

.blend-blocks {
  display: flex;
  justify-content: center;
  gap: 16rpx;
  flex-wrap: wrap;
}

.blend-block {
  font-size: 52rpx;
  font-weight: bold;
  color: var(--sr-primary);
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 24rpx 32rpx;
}

.blend-arrow {
  text-align: center;
  font-size: 28rpx;
  color: var(--sr-text-3);
  margin: 24rpx 0;
}

.blend-word-wrap {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 36rpx 24rpx;
  text-align: center;
}

.blend-word {
  font-size: 56rpx;
  font-weight: bold;
  color: var(--sr-text);
  display: block;
}

.blend-meaning {
  font-size: 26rpx;
  color: var(--sr-text-2);
  display: block;
  margin-top: 12rpx;
}

.blend-meaning.dim {
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

/* 听音选词 */
.listen-play {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 48rpx 24rpx;
  text-align: center;
  margin-bottom: 32rpx;
}

.listen-play-icon {
  font-size: 64rpx;
  display: block;
}

.listen-play-text {
  font-size: 24rpx;
  color: var(--sr-text-3);
  display: block;
  margin-top: 8rpx;
}

.split-word {
  font-size: 56rpx;
  font-weight: bold;
  color: var(--sr-text);
  display: block;
}

.option-word.mono {
  letter-spacing: 2rpx;
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
  align-items: baseline;
  gap: 20rpx;
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

.option-word {
  font-size: 34rpx;
  font-weight: bold;
  color: var(--sr-text);
}

.option-meaning {
  font-size: 24rpx;
  color: var(--sr-text-3);
}

.next-btn {
  margin-top: 32rpx;
}

/* 小结 */
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
  color: var(--sr-text);
  display: block;
}

.summary-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
}

.summary-btn {
  width: 60%;
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
