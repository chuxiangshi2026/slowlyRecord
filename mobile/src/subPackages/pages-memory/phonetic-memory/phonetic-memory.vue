<template>
  <view class="phonetic-page">
    <!-- 进度统计 -->
    <view class="progress-row">
      <view class="progress-stat">
        <text class="stat-num">{{ phoneticStore.masteredCount }}<text class="stat-total">/48</text></text>
        <text class="stat-label">已掌握音</text>
      </view>
      <view class="progress-stat">
        <text class="stat-num" :class="{ active: phoneticStore.dueCount > 0 }">{{ phoneticStore.dueCount }}</text>
        <text class="stat-label">待练习音</text>
      </view>
    </view>

    <!-- 练习入口 -->
    <view class="practice-cards">
      <view class="practice-card" @click="goRecognition('forward')">
        <text class="card-icon">🎯</text>
        <text class="card-title">音标识别</text>
        <text class="card-desc">看音标 → 选例词</text>
      </view>
      <view class="practice-card" @click="goRecognition('backward')">
        <text class="card-icon">🔁</text>
        <text class="card-title">反向识别</text>
        <text class="card-desc">看单词 → 选音标</text>
      </view>
      <view class="practice-card" @click="goMinimalPairs">
        <text class="card-icon">🎧</text>
        <text class="card-title">辨音练习</text>
        <text class="card-desc">听音 → 二选一</text>
      </view>
      <view class="practice-card" @click="goBreakdown">
        <text class="card-icon">🧩</text>
        <text class="card-title">拆音练习</text>
        <text class="card-desc">单词 → 拆成音</text>
      </view>
    </view>

    <!-- 音标表 -->
    <view
      v-for="(group, gIdx) in PHONEME_TABLE"
      :key="gIdx"
      class="group"
      :class="`group--${gIdx === 0 ? 'vowel' : 'consonant'}`"
    >
      <view class="group-header">
        <text class="group-title">{{ group.title }}</text>
        <text class="group-sub">{{ group.subtitle }}</text>
      </view>

      <view v-for="(section, sIdx) in group.sections" :key="sIdx" class="section">
        <view class="section-label">
          <text class="cn">{{ section.label }}</text>
          <text class="en">{{ section.en }}</text>
          <text class="count">· {{ section.phonemes.length }}</text>
        </view>

        <view class="phoneme-grid">
          <view
            v-for="ph in section.phonemes"
            :key="ph.ipa"
            class="phoneme-card"
            :class="masteryClass(ph.ipa)"
            @click="selectPhoneme(ph)"
          >
            <text class="ipa">/{{ ph.ipa }}/</text>
            <text class="first-example">{{ ph.examples[0] }}</text>
            <text v-if="ph.voiced === true" class="badge voiced">浊</text>
            <text v-if="ph.voiced === false" class="badge voiceless">清</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 详情弹层 -->
    <view v-if="activePhoneme" class="popup-overlay" @click="closeDetail">
      <view class="detail-content" @click.stop>
        <view class="detail-ipa-row">
          <text class="detail-ipa" @click="speakArticulation(activePhoneme)">/{{ activePhoneme.ipa }}/ 🔊</text>
          <view class="detail-tags">
            <text class="tag" :class="activePhoneme.type === 'vowel' ? 'vowel' : 'consonant'">
              {{ activePhoneme.type === 'vowel' ? '元音' : '辅音' }}
            </text>
            <text class="tag plain">{{ activePhoneme.groupLabel }}</text>
            <text v-if="activePhoneme.voiced === true" class="tag voiced-tag">浊辅音</text>
            <text v-if="activePhoneme.voiced === false" class="tag plain">清辅音</text>
          </view>
        </view>

        <view class="detail-block">
          <text class="block-label">发音要点</text>
          <text class="tip">{{ activePhoneme.tip }}</text>
        </view>

        <view class="detail-block">
          <text class="block-label">例词（点击发音）</text>
          <view class="examples">
            <text
              v-for="word in activePhoneme.examples"
              :key="word"
              class="example-chip"
              @click="speakWord(word)"
            >🔊 {{ word }}</text>
          </view>
        </view>

        <view v-if="activePhoneme.similar?.length" class="detail-block">
          <text class="block-label">易混淆</text>
          <view class="similar">
            <text
              v-for="ipa in activePhoneme.similar"
              :key="ipa"
              class="similar-tag"
              @click="jumpToSimilar(ipa)"
            >/{{ ipa }}/</text>
          </view>
        </view>

        <button class="btn-close" @click="closeDetail">关闭</button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { PHONEME_TABLE, findPhoneme, type Phoneme } from '@/utils/phoneme-data'
import { usePhoneticMemory } from '@/stores/usePhoneticMemory'
import { getTtsAdapter } from '@/adapters/index'

const phoneticStore = usePhoneticMemory()
const activeIpa = ref('')

const activePhoneme = computed<Phoneme | undefined>(() =>
  activeIpa.value ? findPhoneme(activeIpa.value) : undefined,
)

onMounted(() => {
  phoneticStore.ensureLoaded()
})

// 从练习页返回时刷新掌握度
onShow(() => {
  phoneticStore.ensureLoaded()
})

/** 掌握度着色：已掌握 / 学习中 / 未学 */
function masteryClass(ipa: string): string {
  const prog = phoneticStore.getPhonemeProgress(ipa)
  if (!prog) return ''
  if (prog.level >= phoneticStore.MASTERED_LEVEL) return 'mastered'
  return 'learning'
}

function selectPhoneme(ph: Phoneme) {
  activeIpa.value = ph.ipa
  speakArticulation(ph)
}

function jumpToSimilar(ipa: string) {
  const ph = findPhoneme(ipa)
  if (ph) {
    activeIpa.value = ph.ipa
    speakArticulation(ph)
  }
}

function closeDetail() {
  activeIpa.value = ''
}

/** 小程序无 Web Speech，统一走有道 dictvoice */
function speakWord(word: string) {
  try {
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(word)}&type=2`
    getTtsAdapter().playAudio(url).catch(() => {})
  } catch {}
}

/** 朗读"音素本身"：用 phonics 代理串（如 /p/→'puh'）由 TTS 拟音 */
function speakArticulation(ph: Phoneme) {
  speakWord(ph.articulation)
}

function goRecognition(direction: 'forward' | 'backward') {
  uni.navigateTo({ url: `/subPackages/pages-memory/phonetic-memory/phonetic-recognition?direction=${direction}` })
}

function goMinimalPairs() {
  uni.navigateTo({ url: '/subPackages/pages-memory/phonetic-memory/phonetic-minimal-pairs' })
}

function goBreakdown() {
  uni.navigateTo({ url: '/subPackages/pages-memory/phonetic-memory/phonetic-breakdown' })
}
</script>

<style scoped>
.phonetic-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding: 20rpx 24rpx 60rpx;
}

/* 进度统计 */
.progress-row {
  display: flex;
  gap: 16rpx;
  margin-bottom: 20rpx;
}

.progress-stat {
  flex: 1;
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  display: flex;
  align-items: baseline;
  gap: 14rpx;
}

.stat-num {
  font-size: 44rpx;
  font-weight: bold;
  color: #303030;
}

.stat-num.active {
  color: #52796f;
}

.stat-total {
  font-size: 24rpx;
  color: #999;
  font-weight: 400;
}

.stat-label {
  font-size: 24rpx;
  color: #999;
}

/* 练习入口 */
.practice-cards {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16rpx;
  margin-bottom: 30rpx;
}

.practice-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  text-align: center;
}

.card-icon {
  font-size: 44rpx;
  display: block;
}

.card-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #303030;
  margin-top: 8rpx;
  display: block;
}

.card-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}

/* 分组 */
.group {
  margin-bottom: 30rpx;
}

.group-header {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  padding: 4rpx 0 4rpx 16rpx;
  margin-bottom: 16rpx;
  border-left: 8rpx solid #e6a23c;
}

.group--vowel .group-header {
  border-left-color: #52796f;
}

.group-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #303030;
}

.group-sub {
  font-size: 22rpx;
  color: #999;
}

.section {
  margin-bottom: 20rpx;
}

.section-label {
  display: flex;
  align-items: baseline;
  gap: 8rpx;
  margin-bottom: 10rpx;
  padding-left: 4rpx;
}

.section-label .cn {
  font-size: 26rpx;
  font-weight: bold;
  color: #303030;
}

.section-label .en {
  font-size: 22rpx;
  color: #999;
}

.section-label .count {
  font-size: 20rpx;
  color: #bbb;
}

/* 音标卡网格 */
.phoneme-grid {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12rpx;
}

.phoneme-card {
  position: relative;
  padding: 16rpx 6rpx 12rpx;
  background: #fff;
  border: 2rpx solid #eef0f4;
  border-radius: 12rpx;
  text-align: center;
}

.phoneme-card.learning {
  border-color: #ffe2b8;
  background: #fffaf2;
}

.phoneme-card.mastered {
  border-color: #c8d6cc;
  background: #f4faf5;
}

.ipa {
  font-size: 30rpx;
  font-weight: bold;
  color: #303030;
  font-family: 'Times New Roman', serif;
  display: block;
}

.first-example {
  margin-top: 4rpx;
  font-size: 20rpx;
  color: #999;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.badge {
  position: absolute;
  top: 6rpx;
  right: 8rpx;
  font-size: 16rpx;
  padding: 2rpx 6rpx;
  border-radius: 6rpx;
}

.badge.voiced {
  background: #dbe7de;
  color: #5daf34;
}

.badge.voiceless {
  background: #e9e9eb;
  color: #909399;
}

/* 详情弹层 */
.popup-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
}

.detail-content {
  background: #fff;
  border-radius: 20rpx;
  padding: 40rpx;
  width: 620rpx;
  max-height: 80vh;
  overflow-y: auto;
}

.detail-ipa-row {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  margin-bottom: 28rpx;
}

.detail-ipa {
  font-size: 56rpx;
  font-weight: bold;
  color: #303030;
  font-family: 'Times New Roman', serif;
}

.detail-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.tag {
  font-size: 20rpx;
  padding: 4rpx 14rpx;
  border-radius: 8rpx;
  background: #eef4f0;
  color: #52796f;
}

.tag.plain {
  background: #f5f5f5;
  color: #888;
}

.tag.vowel {
  background: #eaf1ea;
  color: #52796f;
}

.tag.consonant {
  background: #fdf6ec;
  color: #e6a23c;
}

.tag.voiced-tag {
  background: #dbe7de;
  color: #5daf34;
}

.detail-block {
  margin-bottom: 26rpx;
}

.block-label {
  font-size: 22rpx;
  color: #999;
  font-weight: bold;
  margin-bottom: 10rpx;
  display: block;
}

.tip {
  font-size: 28rpx;
  color: #555;
  line-height: 1.6;
}

.examples {
  display: flex;
  flex-wrap: wrap;
  gap: 14rpx;
}

.example-chip {
  font-size: 26rpx;
  color: #52796f;
  background: #eef4f0;
  padding: 12rpx 24rpx;
  border-radius: 12rpx;
}

.similar {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.similar-tag {
  font-size: 26rpx;
  color: #52796f;
  font-family: 'Times New Roman', serif;
  background: #f5f5f5;
  padding: 8rpx 20rpx;
  border-radius: 10rpx;
}

.btn-close {
  margin-top: 10rpx;
  background: #f5f5f5;
  color: #666;
  border-radius: 44rpx;
  height: 84rpx;
  font-size: 28rpx;
  border: none;
}
</style>
