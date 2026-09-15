<template>
  <view class="table-page">
    <view v-if="loading" class="state-tip">加载中…</view>
    <view v-else-if="!pack" class="state-tip">知识包不存在或加载失败</view>
    <template v-else>
      <!-- 元素周期表：专属布局在详情页「完整表格」tab -->
      <view v-if="packId === 'elements'" class="notice-bar">
        周期表布局请用详情页的「完整表格」tab，本页为纯表格预览
      </view>

      <!-- 记忆口诀 -->
      <view v-if="pack.mnemonics?.length" class="mnemonics-card">
        <text class="section-label">🧠 记忆口诀</text>
        <text v-for="(m, i) in pack.mnemonics" :key="i" class="mnemonic-line">{{ m }}</text>
      </view>

      <!-- 横竖双向滚动表格 -->
      <scroll-view scroll-x scroll-y enhanced class="table-scroll">
        <view class="table-inner">
          <view class="tr tr-head">
            <view v-for="col in columns" :key="col.key" class="td th" :style="colStyle(col)">
              {{ col.label }}
            </view>
          </view>
          <view v-for="(item, idx) in pack.items" :key="item.id" class="tr" :class="{ zebra: idx % 2 === 1 }">
            <view v-for="col in columns" :key="col.key" class="td" :style="colStyle(col)">
              {{ cellText(item, col.key) }}
            </view>
          </view>
        </view>
      </scroll-view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useKnowledgeMemory } from './useKnowledgeMemory'
import type { KnowledgeItem } from '@/stores/useUtils/types'

/**
 * 通用横屏表格预览页
 * 所有知识包共用：列 = 问题/答案 + extras 键并集（按出现顺序，最多 4 个 extras 列）。
 * pages.json 声明 pageOrientation: landscape（微信生效，抖音自动降级竖屏宽表）。
 */

const store = useKnowledgeMemory()
const packId = ref('')
const loading = ref(true)

const pack = computed(() => (packId.value ? store.getPack(packId.value) : undefined))

interface Column {
  key: string
  label: string
  /** 列宽 rpx */
  width: number
}

const columns = computed<Column[]>(() => {
  if (!pack.value) return []
  const cols: Column[] = [
    { key: '__question', label: '问题', width: 220 },
    { key: '__answer', label: '答案', width: 220 },
  ]
  const extraKeys: string[] = []
  for (const item of pack.value.items) {
    for (const k of Object.keys(item.extras || {})) {
      if (!extraKeys.includes(k)) extraKeys.push(k)
    }
  }
  for (const k of extraKeys.slice(0, 4)) {
    cols.push({ key: k, label: k, width: 180 })
  }
  return cols
})

function colStyle(col: Column) {
  return { width: col.width + 'rpx' }
}

function cellText(item: KnowledgeItem, key: string): string {
  if (key === '__question') return item.question
  if (key === '__answer') return item.answer
  return item.extras?.[key] ?? ''
}

onLoad(async (options) => {
  packId.value = options?.packId || ''
  if (!packId.value) {
    loading.value = false
    return
  }
  try {
    if (!store.isPackLoaded(packId.value)) {
      await store.loadPack(packId.value)
    }
  } catch (e) {
    console.warn('表格页加载知识包失败:', e)
  } finally {
    loading.value = false
  }
  if (pack.value) {
    uni.setNavigationBarTitle({ title: `${pack.value.name} · 表格` })
  }
})
</script>

<style scoped>
.table-page {
  height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.state-tip {
  padding: 120rpx 40rpx;
  text-align: center;
  font-size: 28rpx;
  color: #999;
}

.notice-bar {
  margin: 16rpx 20rpx 0;
  padding: 14rpx 20rpx;
  background: #fef3e0;
  color: #b97d2a;
  font-size: 22rpx;
  border-radius: 12rpx;
}

.mnemonics-card {
  margin: 16rpx 20rpx 0;
  padding: 20rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.section-label {
  font-size: 26rpx;
  font-weight: 600;
  color: #3d5a52;
  display: block;
  margin-bottom: 12rpx;
}
.mnemonic-line {
  font-size: 26rpx;
  color: #303030;
  line-height: 1.8;
  display: block;
}

.table-scroll {
  flex: 1;
  margin: 16rpx 20rpx 20rpx;
  background: #fff;
  border-radius: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.table-inner {
  display: inline-block;
  min-width: 100%;
}
.tr {
  display: flex;
}
.tr-head {
  position: sticky;
  top: 0;
  z-index: 2;
  background: #52796f;
}
.tr.zebra {
  background: #f7f9f7;
}
.td {
  flex-shrink: 0;
  padding: 16rpx 20rpx;
  font-size: 26rpx;
  color: #303030;
  line-height: 1.5;
  border-bottom: 1rpx solid #eef0ee;
  box-sizing: border-box;
}
.th {
  color: #fff;
  font-weight: 600;
  border-bottom: none;
}
</style>
