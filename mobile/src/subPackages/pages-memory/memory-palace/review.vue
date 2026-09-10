<template>
  <view class="palace-review-container">
    <!-- 顶部：进度 + 回忆模式开关 -->
    <view v-if="palace && !finished" class="review-header">
      <text class="header-exit" @click="goBack">‹ 退出</text>
      <text class="header-progress">{{ currentIndex + 1 }} / {{ total }}</text>
      <view class="recall-switch" @click="recallMode = !recallMode">
        <view class="recall-track" :class="{ on: recallMode }">
          <view class="recall-thumb" :class="{ on: recallMode }"></view>
        </view>
        <text class="recall-label">回忆模式</text>
      </view>
    </view>

    <view v-if="!palace" class="review-body">
      <text class="empty-text">宫殿不存在或已被删除</text>
    </view>

    <!-- 巡视完成 -->
    <view v-else-if="finished" class="review-body finished">
      <text class="finished-icon">✅</text>
      <text class="finished-title">已经过完一遍</text>
      <text class="finished-stat">记住 {{ stats.remembered }} · 忘记 {{ stats.forgotten }} · 跳过 {{ stats.skipped }}</text>
      <view class="finished-actions">
        <button class="btn primary" @click="restart">再来一轮</button>
        <button v-if="!signinStore.hasSignedToday" class="btn guide" @click="goSignin">📅 去打卡</button>
        <button class="btn plain" @click="goBack">返回宫殿</button>
      </view>
    </view>

    <!-- 巡视主体 -->
    <view v-else-if="currentLocus" class="review-body">
      <view class="locus-card" @click="reveal">
        <!-- 桩图：渲染失败（如抖音小程序不支持 SVG dataURL）时自动隐藏，只留文字 -->
        <image
          v-if="currentLocus.imageUrl && !imageFailed"
          class="locus-image"
          :src="currentLocus.imageUrl"
          mode="aspectFit"
          @error="imageFailed = true"
        />
        <text class="locus-order">#{{ currentLocus.order }}</text>
        <text class="locus-name">{{ currentLocus.name }}</text>
        <text v-if="currentLocus.description" class="locus-desc">{{ currentLocus.description }}</text>

        <!-- 答案区：回忆模式下点击卡片才揭示 -->
        <view v-if="answerVisible" class="answer-area">
          <template v-if="resolved.deleted">
            <text class="answer-deleted">内容已删除</text>
          </template>
          <template v-else-if="resolved.text">
            <text class="answer-text">{{ resolved.text }}</text>
            <text v-if="resolved.articleTitle" class="answer-source">—— 《{{ resolved.articleTitle }}》</text>
            <text v-if="currentPeg?.mnemonic" class="answer-mnemonic">助记：{{ currentPeg.mnemonic }}</text>
          </template>
          <text v-else class="answer-none">该钩子没挂内容</text>
        </view>
        <text v-else-if="recallMode" class="reveal-tip">口头回忆挂上的内容，点击卡片查看答案</text>
      </view>

      <!-- 自评 / 翻页 -->
      <view class="assess-actions">
        <template v-if="answerVisible && currentPeg && !resolved.deleted">
          <button class="btn danger" @click="assess(false)">忘记</button>
          <button class="btn primary" @click="assess(true)">记住</button>
        </template>
        <button v-else-if="answerVisible" class="btn plain" @click="next">下一个</button>
      </view>
      <view class="review-nav">
        <text class="nav-btn" :class="{ disabled: currentIndex === 0 }" @click="prev">‹ 上一个</text>
        <text class="nav-btn edit-content" @click="showPegEdit = true">挂内容</text>
        <text class="nav-btn" @click="next">跳过 ›</text>
      </view>
    </view>

    <!-- 桩内容编辑弹层 -->
    <view v-if="showPegEdit" class="peg-edit-overlay" @click="showPegEdit = false">
      <view class="peg-edit-sheet" @click.stop>
        <text class="peg-edit-title">#{{ currentLocus?.order }} {{ currentLocus?.name }}</text>
        <textarea v-model="pegFreeText" class="peg-edit-input" placeholder="要记的内容（如：圆周率前 10 位）" maxlength="200" />
        <input v-model="pegMnemonic" class="peg-edit-mnemonic" placeholder="助记口诀（可选）" maxlength="50" />
        <view class="peg-edit-actions">
          <button class="btn plain" @click="removePegContent" v-if="currentPeg">移除内容</button>
          <button class="btn primary" @click="savePegContent">保存</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useMemoryPalace } from '@/stores/useMemoryPalace'
import { useTextMemory } from '@/stores/useTextMemory'
import { useSignin } from '@/stores/useSignin'
import { resolvePegContent } from '../../../utils/memory-palace'
import type { MobilePalaceLocus } from '@/stores/useUtils/types'

// 宫殿巡视复习（查看版精简实现，对应桌面端 MemoryPalaceReview）：
// 按桩顺序翻页巡视，支持回忆模式（先桩位提示、点击揭示）与记住/忘记自评
const palaceStore = useMemoryPalace()
const textStore = useTextMemory()
// 打卡数据用于完成页"去打卡"引导判断
const signinStore = useSignin()
signinStore.loadRecords()

const palaceId = ref('')
const palace = computed(() => palaceStore.getPalace(palaceId.value))

const currentIndex = ref(0)
const answerVisible = ref(false)
const recallMode = ref(true)
const imageFailed = ref(false)
const finished = ref(false)
const stats = ref({ remembered: 0, forgotten: 0, skipped: 0 })
// 已评/已跳过桩序号，返回重评时不重复累计
const assessedOrders = ref(new Set<number>())

// 桩内容编辑弹层
const showPegEdit = ref(false)
const pegFreeText = ref('')
const pegMnemonic = ref('')

watch(showPegEdit, (show) => {
  if (show) {
    pegFreeText.value = currentPeg.value?.freeText || ''
    pegMnemonic.value = currentPeg.value?.mnemonic || ''
  }
})

function savePegContent() {
  const order = currentLocus.value?.order
  if (order === undefined) return
  const text = pegFreeText.value.trim()
  if (!text) {
    uni.showToast({ title: '请输入内容', icon: 'none' })
    return
  }
  palaceStore.setPegContent(palaceId.value, order, text, pegMnemonic.value.trim() || undefined)
  showPegEdit.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}

function removePegContent() {
  const order = currentLocus.value?.order
  if (order === undefined) return
  palaceStore.removePegContent(palaceId.value, order)
  showPegEdit.value = false
  uni.showToast({ title: '已移除', icon: 'success' })
}

const sortedLoci = computed<MobilePalaceLocus[]>(() => {
  if (!palace.value) return []
  return [...palace.value.loci].sort((a, b) => a.order - b.order)
})
const total = computed(() => sortedLoci.value.length)
const currentLocus = computed(() => sortedLoci.value[currentIndex.value] || null)
const currentPeg = computed(() => {
  if (!currentLocus.value) return undefined
  return palaceStore.pegsOf(palaceId.value).find(p => p.locusOrder === currentLocus.value!.order)
})
const resolved = computed(() => {
  if (!currentPeg.value) return { text: '', deleted: false }
  return resolvePegContent(currentPeg.value, textStore.articles)
})

onLoad((query) => {
  palaceId.value = String(query?.palaceId || '')
  palaceStore.load()
  textStore.load()
  if (total.value === 0) {
    finished.value = true
  }
})

function resetCard() {
  answerVisible.value = !recallMode.value
  imageFailed.value = false
}

function reveal() {
  answerVisible.value = true
}

function bumpStat(key: 'remembered' | 'forgotten' | 'skipped', delta: 1 | -1) {
  stats.value = { ...stats.value, [key]: stats.value[key] + delta }
}

async function assess(remembered: boolean) {
  const order = currentLocus.value?.order
  if (order !== undefined) {
    if (!assessedOrders.value.has(order)) {
      assessedOrders.value.add(order)
      bumpStat(remembered ? 'remembered' : 'forgotten', 1)
    }
    palaceStore.assess(palaceId.value, order, remembered)
  }
  next()
}

function next() {
  const order = currentLocus.value?.order
  if (order !== undefined && !assessedOrders.value.has(order)) {
    assessedOrders.value.add(order)
    bumpStat('skipped', 1)
  }
  if (currentIndex.value >= total.value - 1) {
    finished.value = true
  } else {
    currentIndex.value++
    resetCard()
  }
}

function prev() {
  if (currentIndex.value > 0) {
    currentIndex.value--
    resetCard()
  }
}

function restart() {
  currentIndex.value = 0
  assessedOrders.value = new Set()
  stats.value = { remembered: 0, forgotten: 0, skipped: 0 }
  finished.value = false
  resetCard()
}

function goBack() {
  uni.navigateBack()
}

// 完成页引导：今日未打卡时引导去打卡页
function goSignin() {
  uni.navigateTo({ url: '/subPackages/pages-data/signin/signin' })
}

// 回忆模式开关切换时，按新模式重置当前卡片的揭示状态
watch(recallMode, () => {
  answerVisible.value = !recallMode.value
})
</script>

<style scoped>
.palace-review-container {
  min-height: 100vh;
  background: #f5f7f5;
  display: flex;
  flex-direction: column;
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20rpx 24rpx;
  background: #fff;
  border-bottom: 1rpx solid #eee;
}

.header-exit {
  font-size: 30rpx;
  color: #52796f;
  width: 140rpx;
}

.header-progress {
  font-size: 28rpx;
  color: #999;
}

.recall-switch {
  display: flex;
  align-items: center;
  gap: 10rpx;
  width: 200rpx;
  justify-content: flex-end;
}

.recall-track {
  width: 56rpx;
  height: 32rpx;
  border-radius: 16rpx;
  background: #ddd;
  position: relative;
  transition: background 0.2s;
}

.recall-track.on {
  background: #52796f;
}

.recall-thumb {
  width: 28rpx;
  height: 28rpx;
  border-radius: 50%;
  background: #fff;
  position: absolute;
  top: 2rpx;
  left: 2rpx;
  transition: left 0.2s;
}

.recall-thumb.on {
  left: 26rpx;
}

.recall-label {
  font-size: 24rpx;
  color: #666;
}

.review-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}

.locus-card {
  width: 100%;
  background: #fff;
  border-radius: 20rpx;
  padding: 50rpx 40rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.locus-image {
  width: 300rpx;
  height: 300rpx;
  margin-bottom: 24rpx;
}

.locus-order {
  font-size: 26rpx;
  color: #aaa;
}

.locus-name {
  font-size: 44rpx;
  font-weight: bold;
  color: #333;
  margin-top: 8rpx;
}

.locus-desc {
  font-size: 28rpx;
  color: #666;
  margin-top: 12rpx;
  text-align: center;
}

.reveal-tip {
  font-size: 26rpx;
  color: #aaa;
  margin-top: 40rpx;
}

.answer-area {
  margin-top: 30rpx;
  width: 100%;
  background: #f0f5f1;
  border-radius: 12rpx;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.answer-text {
  font-size: 30rpx;
  color: #333;
  text-align: center;
  line-height: 1.6;
}

.answer-source {
  font-size: 24rpx;
  color: #999;
  margin-top: 12rpx;
}

.answer-mnemonic {
  font-size: 26rpx;
  color: #c07a2b;
  margin-top: 12rpx;
}

.answer-deleted {
  font-size: 28rpx;
  color: #c07a2b;
}

.answer-none {
  font-size: 28rpx;
  color: #999;
}

.assess-actions {
  display: flex;
  gap: 30rpx;
  margin-top: 40rpx;
}

.btn {
  width: 220rpx;
  height: 80rpx;
  line-height: 80rpx;
  border-radius: 40rpx;
  font-size: 30rpx;
  border: none;
}

.btn.primary {
  background: #52796f;
  color: #fff;
}

.btn.danger {
  background: #fdf0ef;
  color: #c0574b;
}

.btn.plain {
  background: #eee;
  color: #666;
}

.btn.guide {
  background: #e8f0ec;
  color: #52796f;
}

.review-nav {
  display: flex;
  justify-content: space-between;
  width: 100%;
  margin-top: 30rpx;
  padding: 0 20rpx;
}

.nav-btn {
  font-size: 28rpx;
  color: #52796f;
}

.nav-btn.disabled {
  color: #ccc;
}

.nav-btn.edit-content {
  color: #74937d;
  font-size: 24rpx;
}

/* 桩内容编辑弹层 */
.peg-edit-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0,0,0,0.5);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.peg-edit-sheet {
  width: 100%;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  padding: 40rpx 30rpx;
  padding-bottom: calc(40rpx + env(safe-area-inset-bottom));
}

.peg-edit-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  margin-bottom: 20rpx;
  display: block;
}

.peg-edit-input {
  width: 100%;
  height: 160rpx;
  border: 1rpx solid #e0e6e2;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 28rpx;
  background: #fafcfa;
  box-sizing: border-box;
}

.peg-edit-mnemonic {
  width: 100%;
  margin-top: 16rpx;
  border: 1rpx solid #e0e6e2;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  background: #fafcfa;
  box-sizing: border-box;
}

.peg-edit-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 24rpx;
}

.peg-edit-actions .btn {
  flex: 1;
}

.finished {
  gap: 20rpx;
}

.finished-icon {
  font-size: 80rpx;
}

.finished-title {
  font-size: 36rpx;
  font-weight: bold;
  color: #333;
}

.finished-stat {
  font-size: 28rpx;
  color: #666;
}

.finished-actions {
  display: flex;
  gap: 24rpx;
  margin-top: 30rpx;
}
</style>
