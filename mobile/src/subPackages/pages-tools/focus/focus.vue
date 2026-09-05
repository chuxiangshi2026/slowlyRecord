<template>
  <view class="focus-page" @touchmove.stop>
    <!-- 顶栏 -->
    <view class="top-bar">
      <text class="exit-btn" @click="exitFocus">✕ 退出</text>
      <text class="progress-text" v-if="wordList.length > 0">{{ currentIndex + 1 }} / {{ wordList.length }}</text>
      <text class="settings-btn" @click="showSettings = !showSettings">⚙</text>
    </view>

    <!-- 设置面板 -->
    <view v-if="showSettings" class="settings-panel">
      <view class="setting-row">
        <text class="setting-label">模式</text>
        <view class="setting-chips">
          <view
            v-for="m in modeOptions"
            :key="m.value"
            class="chip"
            :class="{ on: settings.mode === m.value }"
            @click="setMode(m.value)"
          >
            <text>{{ m.label }}</text>
          </view>
        </view>
      </view>
      <view class="setting-row">
        <text class="setting-label">自动翻页</text>
        <view class="setting-chips">
          <view
            v-for="opt in intervalOptions"
            :key="opt.value"
            class="chip"
            :class="{ on: settings.intervalSec === opt.value }"
            @click="setIntervalSec(opt.value)"
          >
            <text>{{ opt.label }}</text>
          </view>
        </view>
      </view>
      <view class="setting-row">
        <text class="setting-label">自动发音</text>
        <view class="setting-chips">
          <view class="chip" :class="{ on: settings.autoPlay }" @click="toggleAutoPlay">
            <text>{{ settings.autoPlay ? '开' : '关' }}</text>
          </view>
        </view>
      </view>
      <text class="settings-hint">当前词库：{{ bankName }} · 待复习 {{ wordList.length }} 词</text>
    </view>

    <!-- 空状态 -->
    <view v-if="wordList.length === 0" class="empty-state">
      <text class="empty-icon">🌙</text>
      <text class="empty-text">当前词库没有待复习单词</text>
      <text class="empty-hint">先去复习页或词库导入单词吧</text>
      <button class="btn-exit" @click="exitFocus">返回</button>
    </view>

    <!-- 标准模式：逐词轮播 -->
    <view v-else-if="settings.mode === 'standard' && currentWord" class="stage">
      <view class="word-stage" @click="revealCurrent">
        <text class="focus-word">{{ currentWord.word }}</text>
        <template v-if="isRevealed">
          <text v-if="currentWord.phonetic" class="focus-phonetic">{{ currentWord.phonetic }}</text>
          <text class="focus-meaning">{{ currentWord.meaning || '暂无释义' }}</text>
          <text v-if="currentWord.example" class="focus-example">{{ currentWord.example }}</text>
        </template>
        <text v-else class="focus-hint">
          点击显示释义{{ settings.intervalSec > 0 ? `（${settings.intervalSec}s 后自动显示）` : '' }}
        </text>
      </view>
      <view class="action-row">
        <button class="btn-forget" @click="markCurrent(false)">没记住</button>
        <button class="btn-play" @click.stop="playCurrent">🔊</button>
        <button class="btn-remember" @click="markCurrent(true)">记住了</button>
      </view>
    </view>

    <!-- 拼写/听写模式 -->
    <view v-else-if="currentWord" class="stage">
      <view class="word-stage">
        <!-- 提示区 -->
        <template v-if="settings.mode === 'spelling'">
          <text class="focus-meaning prompt">{{ currentWord.meaning || '（无释义提示）' }}</text>
          <text v-if="currentWord.phonetic" class="focus-phonetic">{{ currentWord.phonetic }}</text>
        </template>
        <template v-else>
          <view class="audio-trigger" @click="playCurrent">
            <text class="audio-icon">🔊</text>
            <text class="audio-text">{{ played ? '再听一遍' : '点击播放' }}</text>
          </view>
        </template>

        <!-- 作答区 -->
        <template v-if="!checked">
          <input
            class="spell-input"
            v-model="userInput"
            :focus="inputFocus"
            placeholder="输入单词后回车"
            confirm-type="done"
            @confirm="checkAnswer"
          />
          <button class="btn-check" @click="checkAnswer">确定</button>
        </template>

        <!-- 判定结果 -->
        <template v-else>
          <text class="result-icon" :class="{ ok: isCorrect }">{{ isCorrect ? '✓' : '✗' }}</text>
          <text class="focus-word answer">{{ currentWord.word }}</text>
          <text v-if="!isCorrect" class="wrong-input">你的答案：{{ userInput || '（空）' }}</text>
          <button class="btn-next" @click="nextWord">下一个</button>
        </template>
      </view>
    </view>

    <!-- 完成弹层 -->
    <view v-if="showComplete" class="complete-overlay">
      <view class="complete-card">
        <text class="complete-icon">🌙</text>
        <text class="complete-title">本轮完成</text>
        <view class="complete-stats">
          <view class="stat">
            <text class="stat-value">{{ wordList.length }}</text>
            <text class="stat-label">过词</text>
          </view>
          <view class="stat">
            <text class="stat-value ok">{{ rememberCount }}</text>
            <text class="stat-label">记住</text>
          </view>
          <view class="stat">
            <text class="stat-value bad">{{ forgetCount }}</text>
            <text class="stat-label">忘记</text>
          </view>
        </view>
        <button class="btn-restart" @click="restart">再来一轮</button>
        <button class="btn-exit wide" @click="exitFocus">退出专注</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, nextTick } from 'vue'
import { useMobileWords, type MobileWord } from '@/stores/useMobileWords'
import { getTtsAdapter } from '@/adapters/index'

const wordsStore = useMobileWords()

// ========== 设置（持久化到 slowlyrecord-focus-settings） ==========
const SETTINGS_KEY = 'slowlyrecord-focus-settings'

type FocusMode = 'standard' | 'spelling' | 'dictation'

interface FocusSettings {
  mode: FocusMode
  intervalSec: number  // 自动翻页间隔，0 = 手动
  autoPlay: boolean    // 自动发音
}

const modeOptions: { value: FocusMode; label: string }[] = [
  { value: 'standard', label: '标准' },
  { value: 'spelling', label: '拼写' },
  { value: 'dictation', label: '听写' }
]

const intervalOptions = [
  { value: 0, label: '手动' },
  { value: 5, label: '5s' },
  { value: 10, label: '10s' },
  { value: 20, label: '20s' },
  { value: 60, label: '60s' }
]

function loadSettings(): FocusSettings {
  try {
    const raw = uni.getStorageSync(SETTINGS_KEY)
    if (raw && typeof raw === 'object') {
      return {
        mode: raw.mode === 'spelling' || raw.mode === 'dictation' ? raw.mode : 'standard',
        intervalSec: typeof raw.intervalSec === 'number' ? raw.intervalSec : 0,
        autoPlay: !!raw.autoPlay
      }
    }
  } catch {}
  return { mode: 'standard', intervalSec: 0, autoPlay: true }
}

const settings = ref<FocusSettings>(loadSettings())
const showSettings = ref(false)

function persistSettings() {
  try {
    uni.setStorageSync(SETTINGS_KEY, settings.value)
  } catch (e) {
    console.error('保存专注模式设置失败:', e)
  }
}

function setMode(mode: FocusMode) {
  settings.value.mode = mode
  persistSettings()
  resetWordState()
}

function setIntervalSec(sec: number) {
  settings.value.intervalSec = sec
  persistSettings()
  scheduleAutoTimer()
}

function toggleAutoPlay() {
  settings.value.autoPlay = !settings.value.autoPlay
  persistSettings()
  if (settings.value.autoPlay) playCurrent()
}

// ========== 会话状态 ==========
const wordList = ref<MobileWord[]>([])
const currentIndex = ref(0)
const isRevealed = ref(false)
const showComplete = ref(false)
const rememberCount = ref(0)
const forgetCount = ref(0)

// 拼写/听写状态
const userInput = ref('')
const checked = ref(false)
const isCorrect = ref(false)
const inputFocus = ref(false)
const played = ref(false)

const currentWord = computed(() => wordList.value[currentIndex.value] || null)

const bankName = computed(() =>
  wordsStore.getBankById(wordsStore.currentBankId)?.name || '默认词库'
)

// ========== 自动翻页定时器 ==========
let autoTimer: ReturnType<typeof setTimeout> | null = null

function clearAutoTimer() {
  if (autoTimer) {
    clearTimeout(autoTimer)
    autoTimer = null
  }
}

/** 标准模式自动翻页：未揭示 → 揭示；已揭示 → 下一词 */
function scheduleAutoTimer() {
  clearAutoTimer()
  if (settings.value.mode !== 'standard' || settings.value.intervalSec <= 0) return
  if (!currentWord.value || showComplete.value) return
  autoTimer = setTimeout(() => {
    if (!isRevealed.value) {
      isRevealed.value = true
      if (settings.value.autoPlay) playCurrent()
      scheduleAutoTimer()
    } else {
      advance(false)
    }
  }, settings.value.intervalSec * 1000)
}

// ========== 发音（与听写页同一 TTS 通道） ==========
function playCurrent() {
  const word = currentWord.value
  if (!word?.word) return
  played.value = true
  try {
    const tts = getTtsAdapter()
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word.word)}&type=2`
    tts.playAudio(url).catch(() => {
      const fallback = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=en&q=${encodeURIComponent(word.word)}`
      tts.playAudio(fallback).catch(() => {})
    })
  } catch {
    // TTS 不可用，静默失败
  }
}

// ========== 流程控制 ==========
function resetWordState() {
  isRevealed.value = false
  userInput.value = ''
  checked.value = false
  isCorrect.value = false
  played.value = false
  clearAutoTimer()
  nextTick(() => {
    if (settings.value.mode !== 'standard') {
      inputFocus.value = true
    }
  })
  if (settings.value.mode === 'standard') {
    scheduleAutoTimer()
    if (settings.value.autoPlay) playCurrent()
  } else if (settings.value.mode === 'dictation' && settings.value.autoPlay) {
    playCurrent()
  }
}

function revealCurrent() {
  if (settings.value.mode !== 'standard' || isRevealed.value) return
  isRevealed.value = true
  if (settings.value.autoPlay) playCurrent()
  scheduleAutoTimer()
}

/** 标准模式：记住/没记住，走 store 的 SRS 标准 */
function markCurrent(remembered: boolean) {
  const word = currentWord.value
  if (!word) return
  if (remembered) {
    wordsStore.markAsRemembered(word.id)
    rememberCount.value++
  } else {
    wordsStore.markAsForgotten(word.id)
    forgetCount.value++
  }
  advance(true)
}

/** 拼写/听写判定 */
function checkAnswer() {
  const word = currentWord.value
  if (!word || checked.value) return
  const answer = word.word.trim().toLowerCase()
  const input = userInput.value.trim().toLowerCase()
  isCorrect.value = input === answer
  checked.value = true
  clearAutoTimer()
  if (isCorrect.value) {
    wordsStore.markAsRemembered(word.id)
    rememberCount.value++
    // 答对短暂停留后自动进入下一个
    if (settings.value.intervalSec > 0) {
      autoTimer = setTimeout(() => advance(true), 1200)
    }
  } else {
    wordsStore.markAsForgotten(word.id)
    forgetCount.value++
    if (settings.value.intervalSec > 0) {
      autoTimer = setTimeout(() => advance(true), 3000)
    }
  }
}

/** 进入下一个词；走完一轮弹出完成层。markDone 表示本词 SRS 已落盘 */
function advance(markDone: boolean) {
  if (!markDone) {
    // 自动翻页未标记：按当前揭示状态记为"没记住"
    const word = currentWord.value
    if (word) {
      if (isRevealed.value) {
        wordsStore.markAsForgotten(word.id)
        forgetCount.value++
      }
    }
  }
  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++
    resetWordState()
  } else {
    clearAutoTimer()
    showComplete.value = true
  }
}

function nextWord() {
  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++
    resetWordState()
  } else {
    clearAutoTimer()
    showComplete.value = true
  }
}

function restart() {
  showComplete.value = false
  currentIndex.value = 0
  rememberCount.value = 0
  forgetCount.value = 0
  // 重新拉取最新的待复习列表（本轮标记会改变队列）
  wordList.value = [...wordsStore.reviewWords]
  if (wordList.value.length === 0) {
    uni.showToast({ title: '没有待复习单词了', icon: 'none' })
    exitFocus()
    return
  }
  resetWordState()
}

function exitFocus() {
  clearAutoTimer()
  uni.navigateBack()
}

// ========== 生命周期 ==========
onMounted(async () => {
  // 防熄屏
  try {
    uni.setKeepScreenOn({ keepScreenOn: true })
  } catch {}
  // 数据由首页加载，这里兜底调用（幂等）
  await wordsStore.loadWords()
  wordList.value = [...wordsStore.reviewWords]
  resetWordState()
})

onUnmounted(() => {
  clearAutoTimer()
  try {
    uni.setKeepScreenOn({ keepScreenOn: false })
  } catch {}
})
</script>

<style scoped>
.focus-page {
  min-height: 100vh;
  background: #10241e;
  display: flex;
  flex-direction: column;
  color: #eaf1ea;
}

/* 顶栏 */
.top-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 100rpx 30rpx 10rpx;
}

.exit-btn {
  font-size: 28rpx;
  color: rgba(234, 241, 234, 0.7);
  padding: 10rpx 20rpx;
}

.progress-text {
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.6);
}

.settings-btn {
  font-size: 36rpx;
  color: rgba(234, 241, 234, 0.7);
  padding: 0 20rpx;
}

/* 设置面板 */
.settings-panel {
  margin: 10rpx 30rpx 0;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 16rpx;
  padding: 24rpx;
}

.setting-row {
  display: flex;
  align-items: center;
  margin-bottom: 20rpx;
}

.setting-row:last-of-type {
  margin-bottom: 0;
}

.setting-label {
  width: 140rpx;
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.8);
  flex-shrink: 0;
}

.setting-chips {
  display: flex;
  gap: 14rpx;
  flex-wrap: wrap;
}

.chip {
  padding: 8rpx 26rpx;
  border-radius: 28rpx;
  background: rgba(255, 255, 255, 0.1);
  font-size: 24rpx;
  color: rgba(234, 241, 234, 0.7);
}

.chip.on {
  background: #83c5a8;
  color: #10241e;
  font-weight: bold;
}

.settings-hint {
  display: block;
  margin-top: 20rpx;
  font-size: 22rpx;
  color: rgba(234, 241, 234, 0.45);
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60rpx;
}

.empty-icon {
  font-size: 90rpx;
}

.empty-text {
  font-size: 34rpx;
  color: rgba(234, 241, 234, 0.9);
  margin-top: 30rpx;
}

.empty-hint {
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.5);
  margin-top: 16rpx;
}

.btn-exit {
  margin-top: 50rpx;
  background: rgba(255, 255, 255, 0.12);
  color: #eaf1ea;
  border-radius: 44rpx;
  height: 84rpx;
  font-size: 28rpx;
  border: none;
  padding: 0 60rpx;
}

.btn-exit.wide {
  width: 100%;
  margin-top: 20rpx;
}

/* 主舞台 */
.stage {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 30rpx;
}

.word-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 55vh;
  text-align: center;
}

.focus-word {
  font-size: 88rpx;
  font-weight: bold;
  color: #eaf1ea;
  word-break: break-all;
}

.focus-word.answer {
  font-size: 64rpx;
  color: #83c5a8;
}

.focus-phonetic {
  font-size: 32rpx;
  color: rgba(131, 197, 168, 0.85);
  margin-top: 24rpx;
  font-family: 'Times New Roman', serif;
}

.focus-meaning {
  font-size: 40rpx;
  color: rgba(234, 241, 234, 0.92);
  margin-top: 36rpx;
  line-height: 1.6;
}

.focus-meaning.prompt {
  color: #eaf1ea;
}

.focus-example {
  font-size: 28rpx;
  color: rgba(234, 241, 234, 0.5);
  margin-top: 30rpx;
  font-style: italic;
  line-height: 1.5;
}

.focus-hint {
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.4);
  margin-top: 70rpx;
}

/* 拼写/听写 */
.audio-trigger {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 40rpx;
}

.audio-icon {
  font-size: 100rpx;
}

.audio-text {
  font-size: 26rpx;
  color: rgba(234, 241, 234, 0.5);
  margin-top: 16rpx;
}

.spell-input {
  width: 70%;
  height: 96rpx;
  margin-top: 60rpx;
  background: rgba(255, 255, 255, 0.1);
  border-radius: 16rpx;
  padding: 0 30rpx;
  font-size: 40rpx;
  color: #eaf1ea;
  text-align: center;
}

.btn-check {
  margin-top: 40rpx;
  background: #83c5a8;
  color: #10241e;
  border-radius: 44rpx;
  height: 84rpx;
  font-size: 30rpx;
  border: none;
  padding: 0 80rpx;
}

.result-icon {
  font-size: 80rpx;
  margin-top: 40rpx;
}

.result-icon.ok {
  color: #83c5a8;
}

.result-icon.bad,
.wrong-input {
  color: #e58f8f;
}

.wrong-input {
  font-size: 26rpx;
  margin-top: 20rpx;
}

.btn-next {
  margin-top: 50rpx;
  background: rgba(255, 255, 255, 0.14);
  color: #eaf1ea;
  border-radius: 44rpx;
  height: 84rpx;
  font-size: 30rpx;
  border: none;
  padding: 0 90rpx;
}

/* 标准模式操作按钮 */
.action-row {
  display: flex;
  gap: 20rpx;
  align-items: center;
  justify-content: center;
  padding-bottom: 40rpx;
}

.btn-forget,
.btn-remember {
  flex: 1;
  max-width: 260rpx;
  height: 92rpx;
  border-radius: 46rpx;
  font-size: 30rpx;
  border: none;
}

.btn-forget {
  background: rgba(229, 143, 143, 0.18);
  color: #e58f8f;
  border: 1rpx solid rgba(229, 143, 143, 0.5);
}

.btn-remember {
  background: rgba(131, 197, 168, 0.2);
  color: #83c5a8;
  border: 1rpx solid rgba(131, 197, 168, 0.5);
}

.btn-play {
  width: 92rpx;
  height: 92rpx;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.1);
  color: #eaf1ea;
  font-size: 36rpx;
  border: none;
  display: flex;
  align-items: center;
  justify-content: center;
  line-height: 92rpx;
  padding: 0;
}

/* 完成弹层 */
.complete-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(8, 20, 16, 0.9);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.complete-card {
  background: #1a332b;
  border-radius: 24rpx;
  padding: 60rpx;
  text-align: center;
  width: 560rpx;
}

.complete-icon {
  font-size: 80rpx;
}

.complete-title {
  font-size: 40rpx;
  font-weight: bold;
  color: #eaf1ea;
  margin-top: 20rpx;
  display: block;
}

.complete-stats {
  display: flex;
  justify-content: center;
  gap: 50rpx;
  margin: 40rpx 0;
}

.stat {
  text-align: center;
}

.stat-value {
  font-size: 48rpx;
  font-weight: bold;
  color: #eaf1ea;
  display: block;
}

.stat-value.ok {
  color: #83c5a8;
}

.stat-value.bad {
  color: #e58f8f;
}

.stat-label {
  font-size: 24rpx;
  color: rgba(234, 241, 234, 0.5);
  margin-top: 8rpx;
  display: block;
}

.btn-restart {
  background: #83c5a8;
  color: #10241e;
  border-radius: 44rpx;
  height: 88rpx;
  font-size: 30rpx;
  border: none;
  width: 100%;
}
</style>
