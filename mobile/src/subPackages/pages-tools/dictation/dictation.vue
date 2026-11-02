<template>
  <view class="dictation-page" :class="themeClass">
    <!-- 顶部进度栏 -->
    <view class="dictation-header">
      <view class="header-left">
        <text class="title">拼写练习</text>
      </view>
      <view class="header-right" v-if="wordList.length > 0">
        <text class="progress">{{ currentIndex + 1 }} / {{ wordList.length }}</text>
      </view>
    </view>

    <!-- 单词范围选择 -->
    <view class="range-bar">
      <picker mode="selector" :range="wordRanges" :value="rangeIndex" @change="onRangeChange">
        <view class="range-picker">
          <text>{{ wordRanges[rangeIndex] }}</text>
          <text class="arrow">▼</text>
        </view>
      </picker>
      <view class="stats-mini">
        <text class="stat-correct">✓ {{ stats.correct }}</text>
        <text class="stat-wrong">✗ {{ stats.wrong }}</text>
      </view>
    </view>

    <!-- 听写主区域 -->
    <view class="review-panel" v-if="currentWord">
      <!-- 升级飘字（判对升级时短暂展示于练习区右上角） -->
      <LevelUpFloat v-if="levelUpFloat" :from="levelUpFloat.from" :to="levelUpFloat.to" />

      <!-- 提示区域 -->
      <view class="hints-area">
        <view v-if="options.showPhonetic && currentWord.phonetic" class="hint-item">
          <text class="hint-label">音标</text>
          <text class="hint-content">{{ currentWord.phonetic }}</text>
        </view>
        <view v-if="options.showMeaning" class="hint-item">
          <text class="hint-label">释义</text>
          <text class="hint-content">{{ currentWord.meaning }}</text>
        </view>
        <view v-if="!options.showMeaning && !options.showPhonetic" class="hint-item hint-placeholder">
          <text class="hint-content hint-dim">提示已关闭</text>
        </view>
      </view>

      <!-- 点选模式回退打字模式的轻提示 -->
      <view v-if="tapFallbackTip" class="tap-fallback-tip">
        <text class="tap-fallback-text">{{ tapFallbackTip }}</text>
      </view>

      <!-- 输入区域 -->
      <view class="input-area" :class="{ shaking: isShaking }">
        <!-- 点选拼写模式（英语 ≤8 字母，其他情况使用键盘输入） -->
        <view v-if="tapInputActive" class="tap-mode">
          <view class="tap-slots">
            <view
              v-for="i in currentUnits.length"
              :key="'tap-slot-' + i"
              class="tap-slot"
              :class="{ filled: tapPlaced[i-1] }"
              @click="tapRecall(i - 1)"
            >
              <text class="tap-slot-text">{{ tapPlaced[i-1]?.text || '' }}</text>
            </view>
          </view>
          <view class="tap-pool">
            <view
              v-for="tile in tapTiles"
              :key="tile.id"
              v-show="!tile.used"
              class="tap-tile"
              @click="tapPick(tile)"
            >
              <text class="tap-tile-text">{{ tile.text }}</text>
            </view>
          </view>
        </view>

        <!-- 全盲模式 -->
        <view v-else-if="displayMode === 'blank'" class="blank-mode">
          <view class="input-slots">
            <view
              v-for="i in currentUnits.length"
              :key="i"
              class="input-slot"
              :class="{
                filled: userInput[i-1],
                flashing: isShowingHint
              }"
            >
              <text class="slot-text">{{ userInput[i-1] || '' }}</text>
            </view>
          </view>
          <input
            class="hidden-input"
            v-model="rawInput"
            @input="handleInput"
            :maxlength="currentWord.word.length"
            :focus="inputFocus"
            adjust-position
          />
        </view>

        <!-- 部分提示模式 -->
        <view v-else class="partial-mode">
          <view class="letter-slots">
            <view
              v-for="(slot, index) in partialSlots"
              :key="index"
              class="letter-slot"
              :class="{
                fixed: slot.fixed,
                empty: !slot.fixed,
                filled: !slot.fixed && slot.value,
                flashing: isShowingHint && !slot.fixed
              }"
              @click="onSlotTap(index)"
            >
              <text v-if="slot.fixed" class="slot-text fixed-text">{{ slot.letter }}</text>
              <input
                v-else
                v-model="slot.value"
                :maxlength="slot.letter.length"
                class="letter-input"
                :focus="focusedSlotIndex === index"
                @input="handlePartialInput(index)"
                adjust-position
              />
            </view>
          </view>
        </view>
      </view>

      <!-- 错误提示区域 -->
      <view v-if="canShowHint" class="hint-area">
        <view v-if="hintType === 'full'" class="full-hint">
          <text class="full-hint-text">正确答案: {{ currentWord.word }}</text>
        </view>
        <view v-else class="letter-hint-btn" @click="showLetterHint">
          <text class="letter-hint-text">显示提示 (已错{{ getCurrentErrorCount }}次)</text>
        </view>
      </view>

      <!-- 控制按钮 -->
      <view class="control-area">
        <view class="ctrl-btn" :class="{ disabled: currentIndex === 0 }" @click="prevWord">
          <text class="ctrl-icon">◀</text>
        </view>
        <view class="ctrl-btn play-btn" @click="replayWord">
          <text class="ctrl-icon">🔊</text>
        </view>
        <view class="ctrl-btn forget-btn" @click="handleForget">
          <text class="ctrl-icon">✕</text>
          <text class="ctrl-label">忘记</text>
        </view>
        <view class="ctrl-btn skip-btn" @click="handleSkip">
          <text class="ctrl-icon">▶</text>
          <text class="ctrl-label">跳过</text>
        </view>
        <view class="ctrl-btn hint-trigger" @click="showHintDialog">
          <text class="ctrl-icon">?</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-if="wordList.length === 0 && !isLoading" class="empty-state">
      <text class="empty-icon">✓</text>
      <text class="empty-text">{{ emptyState.text }}</text>
      <text v-if="filteredOutCount > 0" class="empty-sub">{{ getFilteredHint(filteredOutCount) }}</text>
      <view class="empty-btn" @click="goAddWord">
        <text class="empty-btn-text">去添加单词</text>
      </view>
    </view>

    <!-- 底部操作栏 -->
    <view class="footer-bar">
      <view class="footer-left">
        <text class="bank-name" @click="goToWordbank">{{ currentBankName }}</text>
        <text class="divider">|</text>
        <text class="stat-item">待复习: {{ forgetCount }}</text>
        <text class="stat-item">总数: {{ totalCount }}</text>
      </view>
      <view class="footer-right">
        <view class="toggle-btn" :class="{ active: options.autoPlay }" @click="toggleOption('autoPlay')">
          <text>发音</text>
        </view>
        <view class="toggle-btn" :class="{ active: options.showPhonetic }" @click="toggleOption('showPhonetic')">
          <text>音标</text>
        </view>
        <view class="toggle-btn" :class="{ active: options.showMeaning }" @click="toggleOption('showMeaning')">
          <text>释义</text>
        </view>
        <view class="toggle-btn" :class="{ active: partialMode }" @click="togglePartialMode">
          <text>给一半字母</text>
        </view>
        <view v-if="wordsStore.currentLanguage === 'en'" class="toggle-btn tap-toggle" :class="{ 'tap-on': tapMode }" @click="toggleTapMode">
          <text>点选</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue'
import { useMobileWords, type MobileWord } from '@/stores/useMobileWords'
import { speakWord, stopSpeaking } from '@/utils/word-audio'
import { buildFragmentTiles, type AnswerTile } from '@/utils/answer-tokens'
import { vibrateOnJudge } from '@/utils/practice-feedback'
import LevelUpFloat from '@/components/LevelUpFloat.vue'
import { isWordText, isPhraseText, normalizeForCompare, splitSpellUnits } from '@/utils/language'
// 等级口径与主复习体系（12 级标准）对齐，拼写模块不单独"毕业"单词
import { nextLevelOnCorrect, nextLevelOnWrong, getEmptyState, getFilteredHint } from './dictation-level'

const wordsStore = useMobileWords()

// ========== 常量 ==========
const MAX_ERRORS_BEFORE_HINT = 3
/** 点选拼写长度闸：≤8 字母的单词才走碎片点选，长单词自动回退打字模式 */
const MAX_TAP_LETTERS = 8

// ========== 选项 ==========
// 给一半字母模式
const partialMode = ref(true)
const displayMode = computed<'blank' | 'partial'>(() => partialMode.value ? 'partial' : 'blank')

// 点选拼写保留英语字母池，其他语言使用键盘输入
const tapMode = ref(false)
const tapTiles = ref<(AnswerTile & { used: boolean })[]>([])
const tapPlaced = ref<AnswerTile[]>([])
const tapInputActive = computed(() =>
  wordsStore.currentLanguage === 'en' && tapMode.value && currentUnits.value.length > 0 && currentUnits.value.length <= MAX_TAP_LETTERS
)
const tapFallbackTip = computed(() => {
  if (!tapMode.value || !currentWord.value) return ''
  if (wordsStore.currentLanguage !== 'en') return '非英语词库已切换为键盘输入'
  return currentUnits.value.length > MAX_TAP_LETTERS ? '该词较长，已切换为键盘输入' : ''
})
const options = ref({
  autoPlay: true,
  showPhonetic: true,
  showMeaning: true,
})

// ========== 状态 ==========
const wordRanges = ['全部单词', '待复习单词', '最近添加']
const rangeIndex = ref(0)
const wordList = ref<MobileWord[]>([])
const currentIndex = ref(0)
const userInput = ref<string[]>([])
const rawInput = ref('')
const isShaking = ref(false)
const errorCountMap = ref<Record<number, number>>({})
const hintType = ref<'none' | 'letter' | 'full'>('none')
const isShowingHint = ref(false)
const isLoading = ref(false)
const inputFocus = ref(false)

// 空态统计：当前范围内的总条数与不适合拼写练习的词组/句子条数
const rangeTotalCount = ref(0)
const filteredOutCount = ref(0)

// 空态文案（含"词组/句子被过滤"解释）
const emptyState = computed(() => getEmptyState(rangeTotalCount.value, filteredOutCount.value))

// 给一半字母模式
const partialSlots = ref<{ fixed: boolean; letter: string; value?: string }[]>([])
const focusedSlotIndex = ref(-1)

// 统计
const stats = ref({ correct: 0, wrong: 0 })

// 升级飘字：Lv 提升时短暂展示「Lv5 → 6」，1s 后消失（降级不飘，抖动已够）
const levelUpFloat = ref<{ from: number; to: number } | null>(null)
let levelUpTimer: ReturnType<typeof setTimeout> | null = null
function triggerLevelUp(from: number, to: number) {
  levelUpFloat.value = { from, to }
  if (levelUpTimer) clearTimeout(levelUpTimer)
  levelUpTimer = setTimeout(() => {
    levelUpFloat.value = null
    levelUpTimer = null
  }, 1000)
}

// ========== 计算属性 ==========
const currentWord = computed(() => wordList.value[currentIndex.value] || null)
const currentUnits = computed(() => currentWord.value
  ? splitSpellUnits(currentWord.value.word, wordsStore.currentProfile)
  : []
)

const getCurrentErrorCount = computed(() => {
  return errorCountMap.value[currentIndex.value] || 0
})

const canShowHint = computed(() => {
  const count = errorCountMap.value[currentIndex.value] || 0
  return count >= MAX_ERRORS_BEFORE_HINT
})

const currentBankName = computed(() => {
  const bank = wordsStore.bankList.find(b => b.id === wordsStore.currentBankId)
  return bank?.name || '默认词库'
})

const forgetCount = computed(() => wordsStore.reviewWords.length)
const totalCount = computed(() => wordsStore.wordCount)

// ========== 词库加载 ==========
function getWords() {
  switch (rangeIndex.value) {
    case 0: return wordsStore.words
    case 1: return wordsStore.reviewWords
    case 2: return wordsStore.words.slice(-20)
    default: return wordsStore.words
  }
}

function getEligibleWords(words: MobileWord[]): MobileWord[] {
  const profile = wordsStore.currentProfile
  return words.filter(w => w.word && isWordText(w.word, profile) && !isPhraseText(w.word, profile))
}

async function loadWords() {
  isLoading.value = true
  try {
    const allWords = getWords()
    rangeTotalCount.value = allWords.length
    if (allWords.length === 0) {
      wordList.value = []
      filteredOutCount.value = 0
      return
    }
    const eligibleWords = getEligibleWords(allWords)
    filteredOutCount.value = allWords.length - eligibleWords.length
    wordList.value = [...eligibleWords].sort(() => Math.random() - 0.5)
    currentIndex.value = 0
  } finally {
    isLoading.value = false
  }
}

/** 刷新单词列表（答对后移除已记住的单词等） */
function refreshWordList() {
  const allWords = getWords()
  rangeTotalCount.value = allWords.length
  const eligibleWords = getEligibleWords(allWords)
  filteredOutCount.value = allWords.length - eligibleWords.length
  const curWord = currentWord.value
  if (curWord) {
    const newIdx = eligibleWords.findIndex(w => w.id === curWord.id)
    if (newIdx >= 0) {
      wordList.value = eligibleWords
      currentIndex.value = newIdx
      return
    }
  }
  wordList.value = [...eligibleWords].sort(() => Math.random() - 0.5)
  currentIndex.value = Math.min(currentIndex.value, wordList.value.length - 1)
}

// ========== 准备单词 ==========
function prepareWord() {
  userInput.value = []
  rawInput.value = ''
  isShaking.value = false
  partialSlots.value = []
  hintType.value = 'none'
  focusedSlotIndex.value = -1
  tapPlaced.value = []
  tapTiles.value = []

  const word = currentWord.value
  if (!word) return

  if (tapInputActive.value) {
    // 英语点选：单词字母 + 2~3 个干扰字母（干扰字母不与单词已有字母重复）
    const letters = currentUnits.value.map(unit => unit.toLowerCase())
    const pool = 'abcdefghijklmnopqrstuvwxyz'.split('').filter(l => !letters.includes(l))
    const distractorCount = 2 + (Math.random() < 0.5 ? 1 : 0)
    tapTiles.value = buildFragmentTiles(letters, pool, distractorCount).map(t => ({ ...t, used: false }))
  } else if (displayMode.value === 'partial') {
    const letters = currentUnits.value
    const len = letters.length
    let hideCount = Math.floor(len * 0.5)
    if (hideCount < 1) hideCount = 1
    if (hideCount >= len) hideCount = len - 1

    const hideIndices = new Set<number>()
    while (hideIndices.size < hideCount) {
      hideIndices.add(Math.floor(Math.random() * len))
    }

    partialSlots.value = letters.map((letter, index) => ({
      fixed: !hideIndices.has(index),
      letter,
      value: hideIndices.has(index) ? '' : undefined
    }))

    // 自动聚焦第一个空位
    nextTick(() => {
      setTimeout(() => {
        const firstEmpty = partialSlots.value.findIndex(s => !s.fixed)
        if (firstEmpty >= 0) {
          focusedSlotIndex.value = firstEmpty
        }
      }, 150)
    })
  } else {
    // 全盲模式，自动聚焦
    nextTick(() => {
      setTimeout(() => {
        inputFocus.value = true
      }, 150)
    })
  }

  // 自动播放
  if (options.value.autoPlay) {
    setTimeout(() => playWord(), 300)
  }
}

// ========== 输入处理 ==========
function handleInput() {
  if (!currentWord.value) return

  const inputUnits = splitSpellUnits(rawInput.value, wordsStore.currentProfile)
  userInput.value = inputUnits.slice(0, currentUnits.value.length)

  if (inputUnits.length === currentUnits.value.length) {
    checkAnswer()
  }
}

function handlePartialInput(index: number) {
  const slot = partialSlots.value[index]
  if (slot?.value) {
    slot.value = wordsStore.currentProfile.caseInsensitive ? slot.value.toLowerCase() : slot.value
    // 跳到下一个空位
    const nextIndex = partialSlots.value.findIndex((s, i) => i > index && !s.fixed && !s.value)
    if (nextIndex >= 0) {
      focusedSlotIndex.value = nextIndex
    } else {
      // 检查是否全部填满
      const allFilled = partialSlots.value.every(s => s.fixed || s.value)
      if (allFilled) {
        focusedSlotIndex.value = -1
        checkAnswer()
      }
    }
  }
}

function onSlotTap(index: number) {
  if (!partialSlots.value[index]?.fixed) {
    focusedSlotIndex.value = index
  }
}

// ========== 点选拼写输入 ==========
function tapPick(tile: AnswerTile & { used: boolean }) {
  if (!currentWord.value || tile.used) return
  tile.used = true
  tapPlaced.value.push({ id: tile.id, text: tile.text })
  // 放满单词长度自动判分
  if (tapPlaced.value.length === currentUnits.value.length) {
    checkAnswer()
  }
}

/** 点按已放字母撤回 */
function tapRecall(index: number) {
  const tile = tapPlaced.value[index]
  if (!tile) return
  const poolTile = tapTiles.value.find(t => t.id === tile.id)
  if (poolTile) poolTile.used = false
  tapPlaced.value.splice(index, 1)
}

// ========== 语音播放 ==========
function playWord(userInitiated = false) {
  const word = currentWord.value
  if (!word?.word) return

  // #ifdef H5 || APP-PLUS
  const utterance = new SpeechSynthesisUtterance(word.word)
  utterance.lang = wordsStore.currentProfile.ttsLang
  utterance.rate = 0.8
  speechSynthesis.speak(utterance)
  // #endif

  // #ifdef MP-WEIXIN || MP-TOUTIAO
  // 自动播放失败静默，手动点按失败才节流提示
  speakWord(word.word, { userInitiated })
  // #endif
}

function replayWord() {
  playWord(true)
}

// ========== 答案检查 ==========
async function checkAnswer() {
  const word = currentWord.value
  if (!word) return

  let input = ''
  if (tapInputActive.value) {
    input = tapPlaced.value.map(t => t.text).join('')
  } else if (displayMode.value === 'blank') {
    input = userInput.value.join('')
  } else {
    input = partialSlots.value.map(s => s.value || s.letter).join('')
  }

  const profile = wordsStore.currentProfile
  const isCorrect = normalizeForCompare(input, profile) === normalizeForCompare(word.word, profile)

  if (isCorrect) {
    // 正确：等级 +1（复用主体系升降级逻辑，封顶 12 级，remembered 仅 12 级判定）
    const beforeLevel = word.level || 1
    const nextLevel = nextLevelOnCorrect(beforeLevel)
    wordsStore.updateWordLevel(word.id, nextLevel)
    vibrateOnJudge('correct')
    if (nextLevel > beforeLevel) triggerLevelUp(beforeLevel, nextLevel)

    stats.value.correct++
    delete errorCountMap.value[currentIndex.value]
    refreshWordList()
    nextWord()
  } else {
    // 错误：等级 -1，不单独"毕业"/重置，只标记需要复习
    await wordsStore.updateWord(word.id, {
      level: nextLevelOnWrong(word.level || 1),
      needsReview: true,
      remembered: false
    })

    vibrateOnJudge('wrong')
    stats.value.wrong++
    errorCountMap.value[currentIndex.value] = (errorCountMap.value[currentIndex.value] || 0) + 1
    refreshWordList()

    // 晃动反馈
    isShaking.value = true
    setTimeout(() => { isShaking.value = false }, 500)

    // 多次错误后自动提示
    if (errorCountMap.value[currentIndex.value] >= MAX_ERRORS_BEFORE_HINT + 2) {
      hintType.value = 'full'
    }

    // 清空输入让用户重新尝试
    if (tapInputActive.value) {
      tapPlaced.value = []
      tapTiles.value.forEach(t => { t.used = false })
    } else if (displayMode.value === 'partial') {
      partialSlots.value.forEach(slot => {
        if (!slot.fixed) slot.value = ''
      })
      nextTick(() => {
        const firstEmpty = partialSlots.value.findIndex(s => !s.fixed)
        if (firstEmpty >= 0) focusedSlotIndex.value = firstEmpty
      })
    } else {
      rawInput.value = ''
      userInput.value = []
      nextTick(() => { inputFocus.value = true })
    }
  }
}

// ========== 单词操作 ==========
async function handleForget() {
  const word = currentWord.value
  if (!word) return

  await wordsStore.updateWord(word.id, {
    level: nextLevelOnWrong(word.level || 1),
    needsReview: true,
    remembered: false
  })

  vibrateOnJudge('wrong')
  stats.value.wrong++
  uni.showToast({ title: `已忘记: ${word.word}`, icon: 'none' })
  refreshWordList()
  nextWord()
}

function handleSkip() {
  nextWord()
}

function prevWord() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    prepareWord()
  }
}

function nextWord() {
  if (wordList.value.length === 0) {
    loadWords().then(() => {
      if (wordList.value.length > 0) {
        prepareWord()
        uni.showToast({ title: '新一轮单词', icon: 'none' })
      }
    })
    return
  }

  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++
    prepareWord()
  } else {
    // 一轮结束，重新加载打乱
    loadWords().then(() => {
      if (wordList.value.length > 0) {
        prepareWord()
        uni.showToast({ title: '新一轮单词', icon: 'none' })
      }
    })
  }
}

// ========== 提示功能 ==========
function showLetterHint() {
  if (!currentWord.value) return

  if (tapInputActive.value) {
    // 点选模式无字母逐个提示，直接展示完整答案
    hintType.value = 'full'
  } else if (displayMode.value === 'partial') {
    const emptySlots = partialSlots.value
      .map((s, i) => ({ slot: s, index: i }))
      .filter(({ slot }) => !slot.fixed && !slot.value)

    if (emptySlots.length > 0) {
      const randomSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)]
      partialSlots.value[randomSlot.index].value = randomSlot.slot.letter

      const allFilled = partialSlots.value.every(s => s.fixed || s.value)
      if (allFilled) {
        hintType.value = 'full'
      }
    } else {
      hintType.value = 'full'
    }
  } else {
    hintType.value = 'full'
  }
}

function showHintDialog() {
  if (!currentWord.value || isShowingHint.value) return

  if (tapInputActive.value) {
    // 点选模式：闪烁显示完整单词后还原已选字母
    const units = currentUnits.value.map(unit => unit.toLowerCase())
    const original = [...tapPlaced.value]
    if (original.length >= units.length) return

    isShowingHint.value = true
    tapTiles.value.forEach(t => { t.used = false })
    tapPlaced.value = units.map((text, i) => ({ id: -1 - i, text }))

    setTimeout(() => {
      tapPlaced.value = original
      tapTiles.value.forEach(t => { t.used = tapPlaced.value.some(p => p.id === t.id) })
      isShowingHint.value = false
    }, 900)
  } else if (displayMode.value === 'partial') {
    // 闪烁提示：临时显示所有空位字母
    const tempValues: { index: number; originalValue: string }[] = []
    const emptySlots: number[] = []

    partialSlots.value.forEach((slot, index) => {
      if (!slot.fixed) {
        tempValues.push({ index, originalValue: slot.value || '' })
        if (!slot.value) emptySlots.push(index)
      }
    })

    if (emptySlots.length === 0) return

    isShowingHint.value = true
    emptySlots.forEach(index => {
      partialSlots.value[index].value = partialSlots.value[index].letter
    })

    setTimeout(() => {
      tempValues.forEach(({ index, originalValue }) => {
        partialSlots.value[index].value = originalValue
      })
      isShowingHint.value = false
      nextTick(() => {
        const firstEmpty = partialSlots.value.findIndex(s => !s.fixed && !s.value)
        if (firstEmpty >= 0) focusedSlotIndex.value = firstEmpty
      })
    }, 900)
  } else {
    // 全盲模式闪烁提示
    const originalInput = [...userInput.value]
    const emptyIndices: number[] = []
    userInput.value.forEach((char, index) => {
      if (!char) emptyIndices.push(index)
    })

    if (emptyIndices.length === 0) return

    isShowingHint.value = true
    emptyIndices.forEach(index => {
      userInput.value[index] = currentUnits.value[index]
    })

    setTimeout(() => {
      userInput.value = [...originalInput]
      isShowingHint.value = false
      nextTick(() => { inputFocus.value = true })
    }, 900)
  }
}

// ========== 选项切换 ==========
function toggleOption(key: 'autoPlay' | 'showPhonetic' | 'showMeaning') {
  options.value[key] = !options.value[key]
}

function togglePartialMode() {
  partialMode.value = !partialMode.value
  prepareWord()
}

/** 切换点选拼写输入（长单词自动回退打字模式，由 tapInputActive 控制） */
function toggleTapMode() {
  tapMode.value = !tapMode.value
  prepareWord()
}

function onRangeChange(e: any) {
  rangeIndex.value = e.detail.value
  loadWords().then(() => {
    if (wordList.value.length > 0) prepareWord()
  })
}

function goToWordbank() {
  uni.navigateTo({ url: '/subPackages/pages-data/wordbank/wordbank' })
}

/** 空态引导：去添加单词页 */
function goAddWord() {
  uni.navigateTo({ url: '/subPackages/pages-tools/add-word/add-word' })
}

// ========== 初始化 ==========
onMounted(async () => {
  await wordsStore.loadWords()
  await loadWords()
  if (wordList.value.length > 0) {
    prepareWord()
  }
})

// 监听词库切换
watch(() => wordsStore.currentBankId, async () => {
  await loadWords()
  if (wordList.value.length > 0) prepareWord()
})

// 退出页面停止发音并清掉升级飘字定时器（对齐 review.vue 的清理口径，避免退出后音频继续播完）
onUnmounted(() => {
  stopSpeaking()
  if (levelUpTimer) clearTimeout(levelUpTimer)
})
</script>

<style scoped>
.dictation-page {
  min-height: 100vh;
  background: var(--sr-bg);
  display: flex;
  flex-direction: column;
}

/* 顶部栏 */
.dictation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 24rpx 32rpx;
  background: var(--sr-card);
  border-bottom: 1rpx solid var(--sr-border);
}

.title {
  font-size: 36rpx;
  font-weight: 600;
  color: var(--sr-text-strong);
}

.progress {
  font-size: 28rpx;
  color: var(--sr-text-3);
  background: var(--sr-card-2);
  padding: 8rpx 20rpx;
  border-radius: 20rpx;
}

/* 范围选择栏 */
.range-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 32rpx;
  background: var(--sr-card);
  border-bottom: 1rpx solid var(--sr-border);
}

.range-picker {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 12rpx 24rpx;
  background: var(--sr-card-2);
  border-radius: 12rpx;
  font-size: 26rpx;
  color: var(--sr-text);
}

.arrow {
  font-size: 20rpx;
  color: var(--sr-text-3);
}

.stats-mini {
  display: flex;
  gap: 24rpx;
  font-size: 26rpx;
}

.stat-correct {
  color: var(--sr-primary);
}

.stat-wrong {
  color: #c0564f;
}

/* 主区域 */
.review-panel {
  flex: 1;
  padding: 40rpx 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  position: relative;
}

/* 提示区域 */
.hints-area {
  width: 100%;
  margin-bottom: 48rpx;
}

.hint-item {
  display: flex;
  align-items: baseline;
  gap: 16rpx;
  margin-bottom: 16rpx;
  padding: 20rpx 28rpx;
  background: var(--sr-card);
  border-radius: 16rpx;
}

.hint-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
  min-width: 60rpx;
}

.hint-content {
  font-size: 28rpx;
  color: var(--sr-text);
  flex: 1;
}

.hint-placeholder {
  justify-content: center;
}

.hint-dim {
  color: var(--sr-text-3);
  text-align: center;
}

/* 输入区域 */
.input-area {
  width: 100%;
  margin-bottom: 40rpx;
  transition: transform 0.05s;
}

/* 点选模式超长回退打字模式的轻提示 */
.tap-fallback-tip {
  width: 100%;
  margin-bottom: 16rpx;
  display: flex;
  justify-content: center;
}

.tap-fallback-text {
  font-size: 24rpx;
  color: var(--sr-primary);
  background: var(--sr-primary-bg);
  padding: 8rpx 24rpx;
  border-radius: 20rpx;
}

.input-area.shaking {
  animation: shake 0.5s ease;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8rpx); }
  20%, 40%, 60%, 80% { transform: translateX(8rpx); }
}

/* 全盲模式 */
.blank-mode {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.input-slots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx;
}

.input-slot {
  width: 72rpx;
  height: 88rpx;
  border: 3rpx solid var(--sr-border);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sr-card);
  transition: all 0.2s;
}

.input-slot.filled {
  border-color: var(--sr-primary);
  background: var(--sr-primary-bg);
}

.input-slot.flashing {
  border-color: #e6a23c;
  background: #fdf6ec;
  animation: flashAnim 0.3s ease 3;
}

@keyframes flashAnim {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.slot-text {
  font-size: 36rpx;
  font-weight: 500;
  color: var(--sr-text-strong);
}

.hidden-input {
  position: absolute;
  left: -9999rpx;
  width: 1rpx;
  height: 1rpx;
  opacity: 0;
}

/* 给一半字母模式 */
.partial-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.letter-slots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx;
}

.letter-slot {
  width: 72rpx;
  height: 88rpx;
  border: 3rpx solid var(--sr-border);
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sr-card);
  transition: all 0.2s;
}

.letter-slot.fixed {
  border-color: #c8d6cc;
  background: var(--sr-primary-bg);
}

.letter-slot.empty {
  border-color: var(--sr-border);
  border-style: dashed;
}

.letter-slot.filled {
  border-color: var(--sr-primary);
  border-style: solid;
  background: var(--sr-primary-bg);
}

.letter-slot.flashing {
  border-color: #e6a23c;
  background: #fdf6ec;
  animation: flashAnim 0.3s ease 3;
}

.fixed-text {
  color: var(--sr-primary);
}

.letter-input {
  width: 100%;
  height: 100%;
  text-align: center;
  font-size: 36rpx;
  font-weight: 500;
  color: var(--sr-text-strong);
  background: transparent;
}

/* 点选拼写模式 */
.tap-mode {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.tap-slots {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 12rpx;
  padding: 24rpx;
}

.tap-slot {
  width: 72rpx;
  height: 88rpx;
  border: 3rpx solid var(--sr-border);
  border-style: dashed;
  border-radius: 12rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--sr-card);
  transition: all 0.2s;
}

.tap-slot.filled {
  border-color: var(--sr-primary);
  border-style: solid;
  background: var(--sr-primary-bg);
}

.tap-slot-text {
  font-size: 36rpx;
  font-weight: 500;
  color: var(--sr-primary);
}

.tap-pool {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 16rpx;
  padding: 28rpx 20rpx;
  margin-top: 16rpx;
  background: var(--sr-card-2);
  border-radius: 16rpx;
  width: 100%;
  box-sizing: border-box;
}

.tap-tile {
  min-width: 80rpx;
  height: 92rpx;
  padding: 0 18rpx;
  background: var(--sr-card);
  border: 3rpx solid var(--sr-border);
  border-radius: 14rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 3rpx 8rpx rgba(82, 121, 111, 0.12);
}

.tap-tile:active {
  transform: scale(0.92);
}

.tap-tile-text {
  font-size: 38rpx;
  font-weight: bold;
  color: var(--sr-text-strong);
}

/* 错误提示区域 */
.hint-area {
  width: 100%;
  margin-bottom: 32rpx;
}

.full-hint {
  padding: 24rpx 32rpx;
  background: var(--sr-primary-bg);
  border-radius: 16rpx;
  text-align: center;
}

.full-hint-text {
  font-size: 30rpx;
  color: var(--sr-primary);
  font-weight: 500;
}

.letter-hint-btn {
  padding: 20rpx 32rpx;
  background: #fdf6ec;
  border-radius: 16rpx;
  text-align: center;
}

.letter-hint-text {
  font-size: 28rpx;
  color: #c07a2b;
}

/* 警告浅橙底（#fdf6ec）：暗色下换为半透明橙，避免刺眼；亮色值保留在上面的基础规则里 */
.theme-dark .input-slot.flashing,
.theme-dark .letter-slot.flashing,
.theme-dark .letter-hint-btn,
.theme-dark .ctrl-btn.forget-btn {
  background: rgba(230, 162, 60, 0.15);
}

/* 控制按钮 */
.control-area {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 24rpx;
  margin-top: 20rpx;
}

.ctrl-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 96rpx;
  height: 96rpx;
  border-radius: 50%;
  background: var(--sr-card);
  box-shadow: 0 2rpx 12rpx rgba(0,0,0,0.08);
  transition: all 0.2s;
}

.ctrl-btn:active {
  transform: scale(0.92);
}

.ctrl-btn.disabled {
  opacity: 0.3;
}

.ctrl-btn.play-btn {
  background: var(--sr-primary);
}

.ctrl-btn.play-btn .ctrl-icon {
  color: var(--sr-on-primary);
}

.ctrl-btn.forget-btn {
  background: #fdf6ec;
}

.ctrl-btn.skip-btn {
  background: var(--sr-card-2);
}

.ctrl-btn.hint-trigger {
  background: var(--sr-primary-bg);
  width: 80rpx;
  height: 80rpx;
}

.ctrl-icon {
  font-size: 32rpx;
  color: var(--sr-text-2);
}

.ctrl-label {
  font-size: 18rpx;
  color: var(--sr-text-3);
  margin-top: 2rpx;
}

/* 空状态 */
.empty-state {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 120rpx;
}

.empty-icon {
  font-size: 96rpx;
  color: var(--sr-primary);
  margin-bottom: 24rpx;
}

.empty-text {
  font-size: 30rpx;
  color: var(--sr-text-3);
}

/* 空态补充说明（词组/句子被过滤） */
.empty-sub {
  font-size: 26rpx;
  color: var(--sr-text-3);
  margin-top: 16rpx;
  text-align: center;
  line-height: 1.6;
  padding: 0 20rpx;
}

/* 空态出口按钮 */
.empty-btn {
  margin-top: 40rpx;
  padding: 20rpx 64rpx;
  background: var(--sr-primary);
  border-radius: 40rpx;
}

.empty-btn:active {
  opacity: 0.85;
}

.empty-btn-text {
  font-size: 30rpx;
  color: var(--sr-on-primary);
}

/* 底部操作栏 */
.footer-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16rpx 24rpx;
  padding-bottom: calc(16rpx + env(safe-area-inset-bottom));
  background: var(--sr-card);
  border-top: 1rpx solid var(--sr-border);
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 12rpx;
  font-size: 24rpx;
  color: var(--sr-text-2);
}

.bank-name {
  color: var(--sr-primary);
  font-weight: 500;
}

.divider {
  color: var(--sr-border);
}

.stat-item {
  color: var(--sr-text-3);
}

.footer-right {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.toggle-btn {
  padding: 8rpx 16rpx;
  border-radius: 8rpx;
  font-size: 22rpx;
  color: var(--sr-text-3);
  background: var(--sr-card-2);
  transition: all 0.2s;
}

.toggle-btn.active {
  color: var(--sr-primary);
  background: var(--sr-primary-bg);
}

/* 点选拼写开关：主色 #52796f 系列 */
.toggle-btn.tap-on {
  color: var(--sr-on-primary);
  background: var(--sr-primary);
}
</style>
