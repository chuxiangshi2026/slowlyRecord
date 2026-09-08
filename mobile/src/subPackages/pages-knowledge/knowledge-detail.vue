<template>
  <view class="detail-page">
    <view v-if="pack" class="content">
      <!-- 包信息 -->
      <view class="pack-header">
        <text class="pack-name">{{ pack.name }}</text>
        <text class="pack-desc">{{ pack.description }}</text>
        <view class="pack-stats">
          <text class="stat-chip">{{ pack.items.length }} 条</text>
          <text v-if="pack.ordered" class="stat-chip ordered">有序</text>
          <text class="stat-chip mastered-chip">掌握 {{ masteredCount }}/{{ pack.items.length }}</text>
          <text v-if="dueCount > 0" class="stat-chip due-chip">待复习 {{ dueCount }}</text>
        </view>

        <!-- 练习入口 -->
        <view class="practice-actions">
          <button class="btn-practice flip" @click="goPractice('flip')">
            🔄 翻卡练习
          </button>
          <button class="btn-practice choice" @click="goPractice('choice')">
            🎯 四选一
          </button>
        </view>
      </view>

      <!-- 视图切换（仅元素周期表包提供：预览表 / 周期表 / 口诀） -->
      <view v-if="isElements" class="view-tabs">
        <view
          v-for="v in viewTabs"
          :key="v.value"
          class="view-tab"
          :class="{ active: detailView === v.value }"
          @click="detailView = v.value"
        >
          {{ v.label }}
        </view>
      </view>

      <!-- 记忆口诀 -->
      <view v-if="pack.mnemonics?.length && detailView !== 'periodic'" class="mnemonics-card">
        <text class="section-label">🧠 记忆口诀</text>
        <text
          v-for="(m, i) in pack.mnemonics"
          :key="i"
          class="mnemonic-line"
        >{{ m }}</text>
      </view>

      <!-- 周期表视图：按周期分组的列表（第 N 周期一行，行内按序数排列） -->
      <view v-if="detailView === 'periodic'" class="periodic-card">
        <text class="section-label">元素周期表</text>
        <view v-for="row in periodicRows" :key="row.period" class="period-row">
          <text class="period-label">第{{ row.period }}周期</text>
          <view class="period-elements">
            <view
              v-for="item in row.items"
              :key="item.id"
              class="element-chip"
              @click="showElementDetail(item)"
            >
              <text class="element-symbol">{{ item.question }}</text>
              <text class="element-name">{{ item.answer }}</text>
            </view>
          </view>
        </view>
      </view>

      <!-- 条目预览 -->
      <view v-if="detailView === 'list'" class="items-card">
        <text class="section-label">条目预览</text>
        <view class="item-row head">
          <text class="item-q">问题</text>
          <text class="item-a">答案</text>
        </view>
        <view v-for="item in pack.items" :key="item.id" class="item-row">
          <view class="item-q cell">
            <text class="q-text">{{ item.question }}</text>
            <text v-if="extrasPreview(item)" class="q-extras">{{ extrasPreview(item) }}</text>
          </view>
          <text class="item-a cell">{{ item.answer }}</text>
        </view>
      </view>
    </view>

    <!-- 加载/错误 -->
    <view v-else class="loading-state">
      <text class="loading-text">{{ loadError || '加载中…' }}</text>
      <button v-if="loadError" class="btn-back" @click="goBack">返回</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useKnowledgeMemory } from './useKnowledgeMemory'
import type { KnowledgeItem } from '@/stores/useUtils/types'

const store = useKnowledgeMemory()
const packId = ref('')
const loadError = ref('')

const pack = computed(() => store.getPack(packId.value))

const masteredCount = computed(() => store.getMasteredCount(packId.value))
const dueCount = computed(() => store.getDueCount(packId.value))

/** 是否为元素周期表包（该包提供「周期表」视图切换） */
const isElements = computed(() => packId.value === 'elements')

// 详情页视图：list 预览表 / periodic 周期表 / mnemonic 口诀
type DetailView = 'list' | 'periodic' | 'mnemonic'
const viewTabs: { value: DetailView; label: string }[] = [
  { value: 'list', label: '预览表' },
  { value: 'periodic', label: '周期表' },
  { value: 'mnemonic', label: '口诀' },
]
const detailView = ref<DetailView>('list')

// 各周期最大序数边界（第 1~7 周期），运行时按元素 extras.序数 推导周期归属
const PERIOD_MAX_ATOMIC_NUMBERS = [2, 10, 18, 36, 54, 86, 118]

/** 取元素序数（extras「序数」），解析失败返回 NaN */
function atomicNumberOf(item: KnowledgeItem): number {
  return Number.parseInt(String(item.extras?.['序数'] ?? ''), 10)
}

/** 周期表分组：每个周期一行，行内按序数升序 */
const periodicRows = computed(() => {
  const rows: { period: number; items: KnowledgeItem[] }[] = []
  for (const item of pack.value?.items ?? []) {
    const n = atomicNumberOf(item)
    if (!Number.isFinite(n) || n <= 0) continue
    let period = PERIOD_MAX_ATOMIC_NUMBERS.findIndex(max => n <= max) + 1
    if (period <= 0) period = PERIOD_MAX_ATOMIC_NUMBERS.length
    const row = rows[period - 1] ?? (rows[period - 1] = { period, items: [] })
    row.items.push(item)
  }
  for (const row of rows) {
    row.items.sort((a, b) => atomicNumberOf(a) - atomicNumberOf(b))
  }
  return rows.filter(Boolean)
})

/** 点击查看元素详情（名称/符号/序数/拼音/类别） */
function showElementDetail(item: KnowledgeItem) {
  const n = atomicNumberOf(item)
  const pinyin = item.extras?.['拼音']
  const kind = item.extras?.['类别']
  const lines = [`序数：${Number.isFinite(n) ? n : '未知'}`]
  if (pinyin) lines.push(`拼音：${pinyin}`)
  if (kind) lines.push(`类别：${kind}`)
  uni.showModal({
    title: `${item.answer}（${item.question}）`,
    content: lines.join('\n'),
    showCancel: false,
  })
}

/** 拼接 extras 摘要（最多 2 个键值） */
function extrasPreview(item: KnowledgeItem): string {
  if (!item.extras) return ''
  return Object.entries(item.extras)
    .slice(0, 2)
    .map(([k, v]) => `${k}:${v}`)
    .join(' · ')
}

function goPractice(mode: 'flip' | 'choice') {
  uni.navigateTo({
    url: `/subPackages/pages-knowledge/knowledge-practice?packId=${packId.value}&mode=${mode}`,
  })
}

function goBack() {
  uni.navigateBack()
}

onLoad(async (opt: any) => {
  store.loadImportedIds()
  if (opt?.packId) {
    packId.value = opt.packId
    try {
      if (!store.isPackLoaded(packId.value)) {
        await store.loadPack(packId.value)
      }
    } catch (e) {
      console.error('加载知识包失败:', e)
      loadError.value = '知识包加载失败，请返回重试'
    }
  }
})
</script>

<style scoped>
.detail-page {
  min-height: 100vh;
  background: #f5f6fa;
}

.content {
  padding: 24rpx;
}

/* 包信息 */
.pack-header {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.pack-name {
  font-size: 36rpx;
  font-weight: bold;
  color: #303030;
  display: block;
}

.pack-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 10rpx;
  display: block;
  line-height: 1.6;
}

.pack-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
  margin-top: 18rpx;
}

.stat-chip {
  font-size: 22rpx;
  background: #f5f5f5;
  color: #666;
  padding: 6rpx 18rpx;
  border-radius: 22rpx;
}

.stat-chip.ordered {
  background: #fff7e6;
  color: #e6a23c;
}

.stat-chip.mastered-chip {
  background: #f2fbf4;
  color: #4caf50;
}

.stat-chip.due-chip {
  background: #fff7e6;
  color: #e6a23c;
}

.practice-actions {
  display: flex;
  gap: 20rpx;
  margin-top: 26rpx;
}

.btn-practice {
  flex: 1;
  height: 84rpx;
  border-radius: 42rpx;
  font-size: 28rpx;
  border: none;
  line-height: 84rpx;
}

.btn-practice.flip {
  background: #667eea;
  color: #fff;
}

.btn-practice.choice {
  background: #fff;
  color: #667eea;
  border: 2rpx solid #667eea;
}

/* 口诀 */
.mnemonics-card {
  background: #fffbf0;
  border: 1rpx solid #ffe9b8;
  border-radius: 16rpx;
  padding: 26rpx;
  margin-bottom: 20rpx;
}

.mnemonic-line {
  font-size: 26rpx;
  color: #8a6d1a;
  line-height: 1.8;
  display: block;
}

/* 视图切换（仅元素周期表包） */
.view-tabs {
  display: flex;
  background: #fff;
  border-radius: 16rpx;
  padding: 8rpx;
  margin-bottom: 20rpx;
}

.view-tab {
  flex: 1;
  text-align: center;
  font-size: 26rpx;
  color: #666;
  padding: 14rpx 0;
  border-radius: 12rpx;
}

.view-tab.active {
  background: #52796f;
  color: #fff;
  font-weight: 600;
}

/* 周期表视图 */
.periodic-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 26rpx;
}

.period-row {
  margin-bottom: 24rpx;
}

.period-row:last-child {
  margin-bottom: 0;
}

.period-label {
  font-size: 24rpx;
  color: #52796f;
  font-weight: 600;
  display: block;
  margin-bottom: 12rpx;
}

.period-elements {
  display: flex;
  flex-wrap: wrap;
  gap: 10rpx;
}

.element-chip {
  width: 72rpx;
  padding: 10rpx 0 8rpx;
  background: #f0f5f1;
  border-radius: 12rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.element-symbol {
  font-size: 30rpx;
  font-weight: bold;
  color: #303030;
  line-height: 1.2;
}

.element-name {
  font-size: 18rpx;
  color: #888;
  margin-top: 2rpx;
}

/* 条目预览 */
.items-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 26rpx;
}

.section-label {
  font-size: 26rpx;
  font-weight: bold;
  color: #303030;
  margin-bottom: 16rpx;
  display: block;
}

.item-row {
  display: flex;
  padding: 18rpx 0;
  border-bottom: 1rpx solid #f5f5f5;
  align-items: baseline;
}

.item-row:last-child {
  border-bottom: none;
}

.item-row.head {
  padding-bottom: 10rpx;
  border-bottom: 2rpx solid #f0f0f0;
}

.item-row.head .item-q,
.item-row.head .item-a {
  font-size: 22rpx;
  color: #bbb;
  font-weight: normal;
}

.item-q {
  width: 45%;
  flex-shrink: 0;
  padding-right: 16rpx;
  box-sizing: border-box;
}

.item-a {
  flex: 1;
}

.q-text {
  font-size: 26rpx;
  color: #303030;
  display: block;
}

.q-extras {
  font-size: 20rpx;
  color: #999;
  margin-top: 4rpx;
  display: block;
}

.cell {
  font-size: 26rpx;
  color: #555;
  word-break: break-all;
}

/* 加载/错误态 */
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 200rpx 40rpx;
}

.loading-text {
  font-size: 28rpx;
  color: #999;
}

.btn-back {
  margin-top: 30rpx;
  background: #f5f5f5;
  color: #666;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
  padding: 0 60rpx;
  height: 80rpx;
  line-height: 80rpx;
}
</style>
