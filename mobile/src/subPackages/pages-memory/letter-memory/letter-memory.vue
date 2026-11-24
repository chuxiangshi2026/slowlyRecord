<template>
  <view class="letter-page" :class="themeClass">
    <AppBackground />
    <!-- 首次引导 -->
    <GuideBar
      v-if="!store.hasAnyProgress"
      text="给每个字母配一个画面：看到 K 就想到钥匙🔑，字母串就能编成故事（KFC = 钥匙→鱼→猫）。先玩「认映射」混个脸熟，点字母可换图。"
      storage-key="letter-memory-guide-done"
    />

    <!-- 进度统计 -->
    <view class="progress-row">
      <view class="progress-stat">
        <text class="stat-num">{{ store.masteredCount }}<text class="stat-total">/{{ store.totalLetters }}</text></text>
        <text class="stat-label">已掌握字母</text>
      </view>
      <view class="progress-stat">
        <text class="stat-num" :class="{ active: store.dueCount > 0 }">{{ store.dueCount }}</text>
        <text class="stat-label">待复习</text>
      </view>
    </view>

    <!-- 练习入口 -->
    <view class="practice-cards">
      <view class="practice-card" hover-class="card-hover" @click="goPractice('recognize')">
        <text class="card-icon">👀</text>
        <text class="card-title">认映射</text>
        <text class="card-desc">看字母 → 选出图像</text>
      </view>
      <view class="practice-card" hover-class="card-hover" @click="goPractice('recall')">
        <text class="card-icon">🧠</text>
        <text class="card-title">背映射</text>
        <text class="card-desc">看字母 → 回忆图像</text>
      </view>
    </view>

    <!-- 编码小工具 -->
    <view class="tool-card">
      <text class="tool-title">字母编码</text>
      <view class="tool-input-row">
        <input
          v-model="encodeInput"
          class="tool-input"
          placeholder="输入字母，如 KFC、shop"
          confirm-type="done"
        >
      </view>
      <view v-if="encodeChain.length" class="chain-view">
        <view class="chain-links">
          <template v-for="(link, i) in encodeChain" :key="i">
            <view class="chain-link">
              <text class="chain-emoji">{{ link.emoji || '❔' }}</text>
              <text class="chain-letter">{{ link.letters }}</text>
            </view>
            <text v-if="i < encodeChain.length - 1" class="chain-arrow">→</text>
          </template>
        </view>
        <text class="chain-story">{{ encodeStory }}</text>
      </view>
    </view>

    <!-- 字母表 -->
    <view class="group">
      <view class="group-header">
        <text class="group-title">26 个字母</text>
        <text class="group-sub">点字母换图</text>
      </view>
      <view class="letter-grid">
        <view
          v-for="letter in LETTER_LIST"
          :key="letter"
          class="letter-card"
          :class="masteryClass(letter)"
          @click="openEdit(letter)"
        >
          <text class="letter-char">{{ letter.toUpperCase() }}</text>
          <text class="letter-emoji">{{ displayOf(letter)?.emoji }}</text>
          <text class="letter-name">{{ displayOf(letter)?.name }}</text>
        </view>
      </view>
    </view>

    <!-- 字母组合 -->
    <view class="group">
      <view class="group-header">
        <text class="group-title">常用组合</text>
        <text class="group-sub">编码时优先按组合匹配</text>
      </view>
      <view class="letter-grid combo">
        <view
          v-for="combo in COMBO_LIST"
          :key="combo"
          class="letter-card"
          @click="openEdit(combo)"
        >
          <text class="letter-char small">{{ combo }}</text>
          <text class="letter-emoji">{{ displayOf(combo)?.emoji }}</text>
          <text class="letter-name">{{ displayOf(combo)?.name }}</text>
        </view>
      </view>
    </view>

    <!-- 编辑弹层 -->
    <view v-if="editing" class="popup-overlay" @click="closeEdit">
      <view class="edit-content" @click.stop>
        <view class="edit-head">
          <text class="edit-letter">{{ editing.toUpperCase() }}</text>
          <text class="edit-keyword">{{ presetOf(editing)?.keyword }}</text>
        </view>

        <view class="edit-block">
          <text class="block-label">预设映射（点选即用）</text>
          <view class="suggestion-list">
            <view
              v-for="(s, i) in presetOf(editing)?.suggestions ?? []"
              :key="i"
              class="suggestion-item"
              :class="{ active: isCurrentMapping(s) }"
              @click="pickSuggestion(s)"
            >
              <text class="suggestion-emoji">{{ s.emoji }}</text>
              <view class="suggestion-texts">
                <text class="suggestion-name">{{ s.name }}</text>
                <text class="suggestion-desc">{{ s.description }}</text>
              </view>
            </view>
          </view>
        </view>

        <view class="edit-block">
          <text class="block-label">自定义映射</text>
          <view class="custom-row">
            <input v-model="customEmoji" class="custom-input emoji" placeholder="emoji" maxlength="4">
            <input v-model="customName" class="custom-input" placeholder="名称，如：皇冠" maxlength="8">
            <button class="btn-save" :disabled="!customName.trim()" @click="saveCustom">保存</button>
          </view>
        </view>

        <button class="btn-close" @click="closeEdit">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  LETTER_LIST,
  COMBO_LIST,
  findLetterPreset,
  type LetterSuggestion,
} from '@/utils/letter-preset'
import { letterChainOf, chainToStory } from './letter-chain'
import { useLetterMemory } from '@/stores/useLetterMemory'

const store = useLetterMemory()
const editing = ref('')
const customName = ref('')
const customEmoji = ref('')
const encodeInput = ref('')

onShow(() => {
  store.ensureLoaded()
})

function displayOf(letter: string): LetterSuggestion | undefined {
  return store.getDisplay(letter)
}

function presetOf(letter: string) {
  return findLetterPreset(letter)
}

function masteryClass(letter: string): string {
  const entry = store.getEntry(letter)
  if (!entry) return ''
  if (entry.level >= store.MASTERED_LEVEL) return 'mastered'
  return 'learning'
}

function openEdit(letter: string) {
  editing.value = letter
  customName.value = ''
  customEmoji.value = ''
}

function closeEdit() {
  editing.value = ''
}

function isCurrentMapping(s: LetterSuggestion): boolean {
  const d = displayOf(editing.value)
  return d?.name === s.name && d?.emoji === s.emoji
}

function pickSuggestion(s: LetterSuggestion) {
  store.setMapping(editing.value, s, 'preset')
}

function saveCustom() {
  const name = customName.value.trim()
  if (!name) return
  store.setMapping(
    editing.value,
    { name, emoji: customEmoji.value.trim() || '📌', description: '自定义映射' },
    'custom',
  )
  customName.value = ''
  customEmoji.value = ''
}

/** 编码小工具：实时生成图像链 */
const encodeChain = computed(() =>
  encodeInput.value.trim() ? letterChainOf(encodeInput.value, (l) => store.getDisplay(l)) : [],
)
const encodeStory = computed(() => chainToStory(encodeChain.value))

function goPractice(mode: 'recognize' | 'recall') {
  uni.navigateTo({ url: `/subPackages/pages-memory/letter-memory/letter-practice?mode=${mode}` })
}
</script>

<style scoped>
.letter-page {
  min-height: 100vh;
  padding: 20rpx 24rpx 60rpx;
}

.progress-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.progress-stat {
  flex: 1;
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.stat-num {
  font-size: 44rpx;
  font-weight: bold;
  color: var(--sr-text);
}

.stat-num.active {
  color: var(--sr-primary);
}

.stat-total {
  font-size: 24rpx;
  color: var(--sr-text-3);
  font-weight: 400;
}

.stat-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
}

.practice-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-bottom: 24rpx;
}

.practice-card {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 24rpx;
  text-align: center;
}

.practice-card.card-hover {
  opacity: 0.75;
}

.card-icon {
  font-size: 44rpx;
  display: block;
}

.card-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--sr-text);
  margin-top: 8rpx;
  display: block;
}

.card-desc {
  font-size: 22rpx;
  color: var(--sr-text-3);
  margin-top: 4rpx;
  display: block;
}

.tool-card {
  background: var(--sr-card);
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 30rpx;
}

.tool-title {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--sr-text);
  display: block;
  margin-bottom: 16rpx;
}

.tool-input {
  background: var(--sr-bg);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 30rpx;
  color: var(--sr-text);
}

.chain-view {
  margin-top: 20rpx;
}

.chain-links {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10rpx;
}

.chain-link {
  display: flex;
  flex-direction: column;
  align-items: center;
  background: var(--sr-bg);
  border-radius: 12rpx;
  padding: 10rpx 16rpx;
}

.chain-emoji {
  font-size: 40rpx;
}

.chain-letter {
  font-size: 22rpx;
  color: var(--sr-text-3);
  margin-top: 2rpx;
}

.chain-arrow {
  font-size: 28rpx;
  color: var(--sr-text-3);
}

.chain-story {
  display: block;
  margin-top: 16rpx;
  font-size: 26rpx;
  color: var(--sr-text-2);
  line-height: 1.5;
}

.group {
  margin-bottom: 24rpx;
}

.group-header {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  margin-bottom: 14rpx;
}

.group-title {
  font-size: 30rpx;
  font-weight: bold;
  color: var(--sr-text);
}

.group-sub {
  font-size: 22rpx;
  color: var(--sr-text-3);
}

.letter-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}

.letter-grid.combo {
  grid-template-columns: repeat(4, 1fr);
}

.letter-card {
  background: var(--sr-card);
  border-radius: 14rpx;
  padding: 14rpx 8rpx;
  text-align: center;
  border: 2rpx solid transparent;
}

.letter-card.mastered {
  border-color: var(--sr-primary);
}

.letter-card.learning {
  border-color: var(--sr-warning, #e6a23c);
}

.letter-char {
  font-size: 32rpx;
  font-weight: bold;
  color: var(--sr-text);
  display: block;
}

.letter-char.small {
  font-size: 26rpx;
}

.letter-emoji {
  font-size: 36rpx;
  display: block;
  margin-top: 6rpx;
}

.letter-name {
  font-size: 20rpx;
  color: var(--sr-text-3);
  display: block;
  margin-top: 2rpx;
}

.popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: flex-end;
  justify-content: center;
  z-index: 100;
}

.edit-content {
  width: 100%;
  box-sizing: border-box;
  background: var(--sr-card);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx 48rpx;
  max-height: 80vh;
  overflow-y: auto;
}

.edit-head {
  display: flex;
  align-items: baseline;
  gap: 20rpx;
}

.edit-letter {
  font-size: 56rpx;
  font-weight: bold;
  color: var(--sr-primary);
}

.edit-keyword {
  font-size: 26rpx;
  color: var(--sr-text-3);
}

.edit-block {
  margin-top: 24rpx;
}

.block-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
  display: block;
  margin-bottom: 12rpx;
}

.suggestion-item {
  display: flex;
  align-items: center;
  gap: 20rpx;
  background: var(--sr-bg);
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  margin-bottom: 12rpx;
  border: 2rpx solid transparent;
}

.suggestion-item.active {
  border-color: var(--sr-primary);
}

.suggestion-emoji {
  font-size: 44rpx;
}

.suggestion-texts {
  flex: 1;
}

.suggestion-name {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--sr-text);
  display: block;
}

.suggestion-desc {
  font-size: 22rpx;
  color: var(--sr-text-3);
  display: block;
  margin-top: 2rpx;
}

.custom-row {
  display: flex;
  gap: 12rpx;
  align-items: center;
}

.custom-input {
  flex: 1;
  background: var(--sr-bg);
  border-radius: 12rpx;
  padding: 14rpx 20rpx;
  font-size: 28rpx;
  color: var(--sr-text);
}

.custom-input.emoji {
  flex: 0 0 120rpx;
  text-align: center;
}

.btn-save {
  background: var(--sr-primary);
  color: #fff;
  border-radius: 12rpx;
  font-size: 26rpx;
  padding: 0 28rpx;
  line-height: 2.4;
  margin: 0;
}

.btn-close {
  margin-top: 32rpx;
  background: var(--sr-bg);
  color: var(--sr-text-2);
  border-radius: 999rpx;
  font-size: 28rpx;
}
</style>
