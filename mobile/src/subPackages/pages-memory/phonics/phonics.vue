<template>
  <view class="phonics-page" :class="themeClass">
    <AppBackground />
    <!-- 首次引导 -->
    <GuideBar
      text="零基础从这里开始：先点下面字母块听发音、看例词，再玩「拼读练习」把音拼成词；听音选词和看词分块是进阶。"
      storage-key="phonics-guide-done"
    />
    <!-- 进度统计 -->
    <view class="progress-row">
      <view class="progress-stat">
        <text class="stat-num">{{ phonicsStore.masteredCount }}<text class="stat-total">/{{ phonicsStore.totalRules }}</text></text>
        <text class="stat-label">已掌握规则</text>
      </view>
      <view class="progress-stat">
        <text class="stat-num" :class="{ active: phonicsStore.dueCount > 0 }">{{ phonicsStore.dueCount }}</text>
        <text class="stat-label">待练习规则</text>
      </view>
    </view>

    <!-- 练习入口 -->
    <view class="practice-cards">
      <view class="practice-card" hover-class="card-hover" @click="goPractice('blend')">
        <text class="card-icon">🧩</text>
        <text class="card-title">拼读练习</text>
        <text class="card-desc">逐块发音 → 合成整词</text>
      </view>
      <view class="practice-card" hover-class="card-hover" @click="goPractice('listen')">
        <text class="card-icon">🎧</text>
        <text class="card-title">听音选词</text>
        <text class="card-desc">听发音 → 选出单词</text>
      </view>
      <view class="practice-card" hover-class="card-hover" @click="goPractice('split')">
        <text class="card-icon">✂️</text>
        <text class="card-title">看词分块</text>
        <text class="card-desc">选出正确的拼读分块</text>
      </view>
    </view>

    <!-- 规则表 -->
    <view v-for="group in ruleGroups" :key="group.title" class="group">
      <view class="group-header">
        <text class="group-title">{{ group.title }}</text>
        <text class="group-sub">{{ group.subtitle }}</text>
      </view>
      <view class="rule-grid">
        <view
          v-for="rule in group.rules"
          :key="rule.id"
          class="rule-card"
          :class="masteryClass(rule.id)"
          @click="selectRule(rule)"
        >
          <text class="grapheme">{{ rule.grapheme }}</text>
          <text class="rule-ipa">/{{ rule.ipa }}/</text>
        </view>
      </view>
    </view>

    <!-- 详情弹层 -->
    <view v-if="activeRule" class="popup-overlay" @click="closeDetail">
      <view class="detail-content" @click.stop>
        <view class="detail-head">
          <text class="detail-grapheme" @click="speakRule(activeRule)">{{ activeRule.grapheme }} 🔊</text>
          <text class="detail-ipa">/{{ activeRule.ipa }}/</text>
        </view>
        <text class="detail-tip">{{ activeRule.tip }}</text>

        <view class="detail-block">
          <text class="block-label">例词（点击播放整词，点拼读块听单音）</text>
          <view v-for="e in activeRule.examples" :key="e.word" class="example-row">
            <view class="example-blocks">
              <text
                v-for="(b, i) in e.blocks"
                :key="i"
                class="block-chip"
                :class="{ target: isRuleBlock(b) }"
                @click="speakBlock(b)"
              >{{ displayBlock(b) }}</text>
            </view>
            <text class="example-word" @click="speakWord(e.word)">🔊 {{ e.word }} {{ e.meaning }}</text>
          </view>
        </view>

        <button class="btn-close" @click="closeDetail">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import {
  LETTER_RULES_ONLY,
  COMBO_RULES_ONLY,
  findPhonicsRule,
  type PhonicsRule,
} from '@/utils/phonics-data'
import { blockSoundText } from '@/utils/phonics-practice'
import { findPhoneme } from '@/utils/phoneme-data'
import { playPhoneme } from '@/utils/phoneme-audio'
import { usePhonicsMemory } from '@/stores/usePhonicsMemory'
import { getTtsAdapter } from '@/adapters/index'

const phonicsStore = usePhonicsMemory()
const activeRuleId = ref('')

const activeRule = computed<PhonicsRule | undefined>(() =>
  activeRuleId.value ? findPhonicsRule(activeRuleId.value) : undefined,
)

const ruleGroups = [
  { title: '字母基础音', subtitle: '26 个字母最常见的发音', rules: LETTER_RULES_ONLY },
  { title: '字母组合', subtitle: '高频组合：sh/ch/th/magic-e…', rules: COMBO_RULES_ONLY },
]

onShow(() => {
  phonicsStore.ensureLoaded()
})

function masteryClass(ruleId: string): string {
  const prog = phonicsStore.getRuleProgress(ruleId)
  if (!prog) return ''
  if (prog.level >= phonicsStore.MASTERED_LEVEL) return 'mastered'
  return 'learning'
}

function selectRule(rule: PhonicsRule) {
  activeRuleId.value = rule.id
  speakRule(rule)
}

function closeDetail() {
  activeRuleId.value = ''
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

/** 规则发音：优先 CDN 预合成音素音频，失败回退代理串 */
function speakRule(rule: PhonicsRule) {
  playPhoneme(rule.ipa, findPhoneme(rule.ipa)?.articulation ?? rule.grapheme)
}

/** 拼读块发音：是规则则发对应音素，否则按原串读 */
function speakBlock(block: string) {
  const fallback = blockSoundText(block, (ipa) => findPhoneme(ipa)?.articulation)
  const rule = findPhonicsRule(block)
  if (rule) {
    playPhoneme(rule.ipa, fallback)
  } else {
    speak(fallback)
  }
}

/** 块是否对应某条拼读规则（高亮显示） */
function isRuleBlock(block: string): boolean {
  return !!findPhonicsRule(block)
}

/** 展示用：magic-e 块显示 'a-e' 形式 */
function displayBlock(block: string): string {
  return findPhonicsRule(block)?.grapheme ?? block
}

function goPractice(mode: 'blend' | 'listen' | 'split') {
  uni.navigateTo({ url: `/subPackages/pages-memory/phonics/phonics-practice?mode=${mode}` })
}
</script>

<style scoped>
.phonics-page {
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
  grid-template-columns: repeat(3, 1fr);
  gap: 16rpx;
  margin-bottom: 30rpx;
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

.rule-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}

.rule-card {
  background: var(--sr-card);
  border-radius: 14rpx;
  padding: 18rpx 8rpx;
  text-align: center;
  border: 2rpx solid transparent;
}

.rule-card.mastered {
  border-color: var(--sr-primary);
}

.rule-card.learning {
  border-color: var(--sr-warning, #e6a23c);
}

.grapheme {
  font-size: 34rpx;
  font-weight: bold;
  color: var(--sr-text);
  display: block;
}

.rule-ipa {
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

.detail-content {
  width: 100%;
  box-sizing: border-box;
  background: var(--sr-card);
  border-radius: 24rpx 24rpx 0 0;
  padding: 32rpx 32rpx 48rpx;
  max-height: 80vh;
  overflow-y: auto;
}

.detail-head {
  display: flex;
  align-items: baseline;
  gap: 20rpx;
}

.detail-grapheme {
  font-size: 56rpx;
  font-weight: bold;
  color: var(--sr-primary);
}

.detail-ipa {
  font-size: 32rpx;
  color: var(--sr-text-2);
}

.detail-tip {
  display: block;
  font-size: 26rpx;
  color: var(--sr-text-2);
  margin: 16rpx 0 8rpx;
}

.detail-block {
  margin-top: 20rpx;
}

.block-label {
  font-size: 24rpx;
  color: var(--sr-text-3);
  display: block;
  margin-bottom: 12rpx;
}

.example-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16rpx;
  padding: 14rpx 0;
  border-bottom: 1rpx solid var(--sr-border, rgba(0, 0, 0, 0.06));
}

.example-blocks {
  display: flex;
  gap: 8rpx;
  flex-wrap: wrap;
}

.block-chip {
  font-size: 28rpx;
  font-weight: bold;
  color: var(--sr-text);
  background: var(--sr-bg);
  border-radius: 10rpx;
  padding: 6rpx 14rpx;
}

.block-chip.target {
  color: var(--sr-primary);
}

.example-word {
  font-size: 26rpx;
  color: var(--sr-text-2);
  flex-shrink: 0;
}

.btn-close {
  margin-top: 32rpx;
  background: var(--sr-bg);
  color: var(--sr-text-2);
  border-radius: 999rpx;
  font-size: 28rpx;
}
</style>
