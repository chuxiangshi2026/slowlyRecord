<template>
  <view v-if="visible && payload" class="bottom-sheet">
    <!-- 顶部 handle + 标题 -->
    <view class="sheet-header">
      <view class="handle-bar" />
      <view class="title-row">
        <text class="location-name">📍 {{ payload.locationName }}</text>
        <text class="count-badge">
          {{ totalCount }} {{ isPoetryOnly ? '首' : isIdiomOnly ? '条' : '项' }}
        </text>
        <view class="close-btn" @click="onClose">×</view>
      </view>
    </view>

    <!-- 工具栏：全选 / 已选 -->
    <view class="sheet-toolbar">
      <view class="select-all" @click="toggleAll">
        <view class="checkbox" :class="{ checked: allSelected, indeterminate: someSelected && !allSelected }">
          <text v-if="allSelected" class="check-mark">✓</text>
          <text v-else-if="someSelected" class="check-mark">−</text>
        </view>
        <text class="select-all-label">{{ allSelected ? '取消全选' : '全选当前' }}</text>
      </view>
      <text class="selected-info">已选 {{ selectedInThisSheet }} / {{ totalCount }}</text>
    </view>

    <!-- 列表 -->
    <scroll-view scroll-y class="sheet-list">
      <!-- 诗词 -->
      <view
        v-for="poem in payload.poems"
        :key="`p-${poem.id}`"
        class="sheet-item"
        :class="{ selected: selectedPoetryIds.has(poem.id) }"
        @click="$emit('togglePoetry', poem)"
      >
        <view class="item-check">
          <view class="checkbox" :class="{ checked: selectedPoetryIds.has(poem.id) }">
            <text v-if="selectedPoetryIds.has(poem.id)" class="check-mark">✓</text>
          </view>
        </view>
        <view class="item-body">
          <view class="item-title-row">
            <text class="item-title">{{ poem.title }}</text>
            <text class="tag tag-poetry">诗词</text>
          </view>
          <text class="item-meta">{{ poem.dynasty }} · {{ poem.author }}</text>
          <text class="item-preview">{{ previewContent(poem.content) }}</text>
        </view>
      </view>

      <!-- 成语 -->
      <view
        v-for="item in payload.idioms"
        :key="`i-${item.id}`"
        class="sheet-item"
        :class="{ selected: selectedIdiomIds.has(item.id) }"
        @click="$emit('toggleIdiom', item)"
      >
        <view class="item-check">
          <view class="checkbox" :class="{ checked: selectedIdiomIds.has(item.id) }">
            <text v-if="selectedIdiomIds.has(item.id)" class="check-mark">✓</text>
          </view>
        </view>
        <view class="item-body">
          <view class="item-title-row">
            <text class="item-title">{{ item.title }}</text>
            <text class="tag tag-idiom">成语</text>
            <text v-if="item.pinyin" class="pinyin">{{ item.pinyin }}</text>
          </view>
          <text class="item-meta">{{ item.category }}</text>
          <text class="item-preview">【释义】{{ item.meaning }}</text>
          <text v-if="item.source" class="item-preview muted">出处：{{ item.source }}</text>
        </view>
      </view>
    </scroll-view>
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { MarkerTapPayload } from './map-types'
import type { MobilePoetryItem, MobileIdiomItem } from '../library'

interface Props {
  visible: boolean
  payload: MarkerTapPayload | null
  selectedPoetryIds: Set<string>
  selectedIdiomIds: Set<string>
}

const props = defineProps<Props>()
const emit = defineEmits<{
  (e: 'update:visible', value: boolean): void
  (e: 'togglePoetry', item: MobilePoetryItem): void
  (e: 'toggleIdiom', item: MobileIdiomItem): void
  /** 把当前 sheet 内的全部 / 取消全部 */
  (e: 'toggleAll', items: { poems: MobilePoetryItem[]; idioms: MobileIdiomItem[] }, allSelected: boolean): void
}>()

const totalCount = computed(() => {
  if (!props.payload) return 0
  return props.payload.poems.length + props.payload.idioms.length
})

const isPoetryOnly = computed(() => !!props.payload && props.payload.idioms.length === 0)
const isIdiomOnly = computed(() => !!props.payload && props.payload.poems.length === 0)

const selectedInThisSheet = computed(() => {
  if (!props.payload) return 0
  let n = 0
  for (const p of props.payload.poems) if (props.selectedPoetryIds.has(p.id)) n++
  for (const it of props.payload.idioms) if (props.selectedIdiomIds.has(it.id)) n++
  return n
})

const allSelected = computed(() => totalCount.value > 0 && selectedInThisSheet.value === totalCount.value)
const someSelected = computed(() => selectedInThisSheet.value > 0)

function onClose() {
  emit('update:visible', false)
}

function toggleAll() {
  if (!props.payload) return
  emit(
    'toggleAll',
    { poems: props.payload.poems, idioms: props.payload.idioms },
    !allSelected.value,
  )
}

function previewContent(content: string): string {
  const t = content.replace(/\n/g, ' ').trim()
  return t.length > 60 ? t.slice(0, 60) + '…' : t
}
</script>

<style scoped>
.bottom-sheet {
  background: #fff;
  border-top-left-radius: 24rpx;
  border-top-right-radius: 24rpx;
  box-shadow: 0 -6rpx 20rpx rgba(0, 0, 0, 0.08);
  display: flex;
  flex-direction: column;
  height: 100%;
  overflow: hidden;
}

/* 顶部 */
.sheet-header {
  padding: 16rpx 24rpx 12rpx;
  border-bottom: 1rpx solid #f0f0f0;
}

.handle-bar {
  width: 60rpx;
  height: 6rpx;
  background: #ddd;
  border-radius: 3rpx;
  margin: 0 auto 16rpx;
}

.title-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
}

.location-name {
  font-size: 30rpx;
  font-weight: 600;
  color: #303030;
}

.count-badge {
  font-size: 22rpx;
  color: #888;
  background: #f5f6fa;
  padding: 4rpx 14rpx;
  border-radius: 20rpx;
}

.close-btn {
  margin-left: auto;
  width: 56rpx;
  height: 56rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 40rpx;
  color: #999;
  border-radius: 50%;
  background: #f5f6fa;
}

/* 工具栏 */
.sheet-toolbar {
  display: flex;
  align-items: center;
  padding: 14rpx 24rpx;
  border-bottom: 1rpx solid #f0f0f0;
  background: #fafbfc;
}

.select-all {
  display: flex;
  align-items: center;
  gap: 10rpx;
}

.select-all-label {
  font-size: 26rpx;
  color: #43a047;
}

.selected-info {
  margin-left: auto;
  font-size: 24rpx;
  color: #888;
  font-variant-numeric: tabular-nums;
}

/* checkbox */
.checkbox {
  width: 36rpx;
  height: 36rpx;
  border: 2rpx solid #ccc;
  border-radius: 8rpx;
  background: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.15s;
}
.checkbox.checked {
  background: #43a047;
  border-color: #43a047;
}
.checkbox.indeterminate {
  background: #43a047;
  border-color: #43a047;
}
.check-mark {
  color: #fff;
  font-size: 26rpx;
  line-height: 1;
}

/* 列表 */
.sheet-list {
  flex: 1;
  padding: 12rpx 0 24rpx;
}

.sheet-item {
  display: flex;
  gap: 16rpx;
  padding: 20rpx 24rpx;
  border-bottom: 1rpx solid #f4f5f7;
  background: #fff;
  transition: background 0.15s;
}
.sheet-item.selected {
  background: #f4faf5;
}
.sheet-item:active {
  background: #f0f0f0;
}

.item-check {
  padding-top: 4rpx;
}

.item-body {
  flex: 1;
  min-width: 0;
}

.item-title-row {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 4rpx;
  flex-wrap: wrap;
}

.item-title {
  font-size: 30rpx;
  font-weight: 600;
  color: #303030;
}

.pinyin {
  font-size: 22rpx;
  color: #999;
}

.tag {
  font-size: 20rpx;
  padding: 2rpx 10rpx;
  border-radius: 6rpx;
  line-height: 1.6;
}
.tag-poetry {
  background: #ecf5ff;
  color: #409eff;
}
.tag-idiom {
  background: #fdf6ec;
  color: #e6a23c;
}

.item-meta {
  font-size: 22rpx;
  color: #888;
  display: block;
  margin-bottom: 6rpx;
}

.item-preview {
  font-size: 24rpx;
  color: #666;
  line-height: 1.5;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.item-preview.muted {
  color: #999;
  font-size: 22rpx;
  margin-top: 4rpx;
}
</style>
