<template>
  <view class="page">
    <view class="header">
      <text class="title">🔢 数字记忆</text>
      <text class="subtitle">为每个数字编一个记忆桩，长串数字也能轻松记住</text>
    </view>

    <view class="tabs">
      <view
        v-for="t in tabs"
        :key="t.value"
        class="tab"
        :class="{ active: activeTab === t.value }"
        @click="activeTab = t.value"
      >
        {{ t.label }}
      </view>
    </view>

    <!-- 数字桩 tab -->
    <view v-if="activeTab === 'pegs'" class="content">
      <view class="peg-toolbar">
        <view class="peg-stat">
          已编辑 {{ store.associationCount }} / 100
        </view>
        <view class="range-toggle">
          <view
            v-for="r in ranges"
            :key="r.value"
            class="range-chip"
            :class="{ active: pegRange === r.value }"
            @click="pegRange = r.value"
          >
            {{ r.label }}
          </view>
        </view>
      </view>

      <view class="peg-grid">
        <view
          v-for="num in pegNumbers"
          :key="num"
          class="peg-cell"
          :class="{ filled: store.hasAssociation(num) }"
          @click="onPegClick(num)"
        >
          <text class="peg-number">{{ num }}</text>
          <text class="peg-desc" v-if="store.getAssociation(num)">
            {{ shortDesc(store.getAssociation(num)!.description) }}
          </text>
        </view>
      </view>

      <view class="peg-footer-tip">
        <text>💡 点击数字编辑文字桩。同步时会带到其它设备。</text>
      </view>
    </view>

    <!-- 条目 tab -->
    <view v-if="activeTab === 'entries'" class="content">
      <view class="entry-toolbar">
        <input
          class="entry-search"
          v-model="entryKeyword"
          placeholder="搜索标题或数字"
        />
        <button class="entry-add-btn" @click="goAddEntry">＋ 添加</button>
      </view>

      <view v-if="filteredEntries.length === 0" class="entry-empty">
        <text class="empty-icon">🔢</text>
        <text class="empty-title">{{ entryKeyword ? '没有匹配的条目' : '还没有数字条目' }}</text>
        <text class="empty-tip">添加你想记忆的电话、密码、生日、银行卡号等</text>
      </view>

      <view
        v-for="entry in filteredEntries"
        :key="entry._id"
        class="entry-card"
        @click="goEditEntry(entry._id)"
      >
        <view class="entry-card-header">
          <text class="entry-title">{{ entry.title }}</text>
          <view
            class="more-btn"
            @click.stop="onEntryMore(entry)"
          >
            <text class="more-icon">⋯</text>
          </view>
        </view>
        <text class="entry-numbers">{{ formatNumbers(entry.numbers) }}</text>
        <view class="entry-meta">
          <text v-for="tag in entry.tags" :key="tag" class="entry-tag">{{ tag }}</text>
          <text v-if="entry.description" class="entry-desc">{{ entry.description }}</text>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useNumberMemory } from '@/stores/useNumberMemory'

const store = useNumberMemory()

const tabs = [
  { value: 'pegs', label: '数字桩 0–99' },
  { value: 'entries', label: '数字条目' },
]
const activeTab = ref<'pegs' | 'entries'>('pegs')

// ============ 数字桩 ============

const ranges = [
  { value: 'single', label: '0–9' },
  { value: 'double', label: '10–99' },
  { value: 'all', label: '全部' },
]
const pegRange = ref<'single' | 'double' | 'all'>('all')

const pegNumbers = computed(() => {
  const list: string[] = []
  if (pegRange.value === 'single') {
    for (let i = 0; i <= 9; i++) list.push(String(i).padStart(2, '0'))
  } else if (pegRange.value === 'double') {
    for (let i = 10; i <= 99; i++) list.push(String(i))
  } else {
    for (let i = 0; i <= 99; i++) list.push(String(i).padStart(2, '0'))
  }
  return list
})

function shortDesc(d: string): string {
  if (!d) return ''
  return d.length > 8 ? d.slice(0, 8) + '…' : d
}

function onPegClick(num: string) {
  uni.navigateTo({
    url: `/subPackages/pages-memory/number-memory/peg-edit?number=${encodeURIComponent(num)}`,
  })
}

// ============ 条目 ============

const entryKeyword = ref('')

const filteredEntries = computed(() => {
  let list = store.sortedEntries
  if (entryKeyword.value.trim()) {
    const kw = entryKeyword.value.trim().toLowerCase()
    list = list.filter(
      (e) =>
        e.title.toLowerCase().includes(kw) ||
        e.numbers.includes(kw) ||
        (e.description || '').toLowerCase().includes(kw),
    )
  }
  return list
})

function formatNumbers(nums: string): string {
  // 每 4 位加一个空格，提升可读性
  return nums.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function goAddEntry() {
  uni.navigateTo({ url: '/subPackages/pages-memory/number-memory/entry-edit' })
}

function goEditEntry(id: string) {
  uni.navigateTo({
    url: `/subPackages/pages-memory/number-memory/entry-edit?id=${encodeURIComponent(id)}`,
  })
}

function onEntryMore(entry: any) {
  uni.showActionSheet({
    itemList: ['编辑', '删除'],
    success: (res) => {
      if (res.tapIndex === 0) goEditEntry(entry._id)
      else if (res.tapIndex === 1) confirmDelete(entry)
    },
  })
}

function confirmDelete(entry: any) {
  uni.showModal({
    title: '删除条目',
    content: `确定删除「${entry.title}」吗？`,
    confirmText: '删除',
    confirmColor: '#e64340',
    success: (res) => {
      if (res.confirm) {
        store.deleteEntry(entry._id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    },
  })
}

onMounted(() => store.load())
onShow(() => store.load())
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 40rpx;
}

.header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  padding: 60rpx 40rpx 40rpx;
  text-align: center;
}
.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}
.subtitle {
  font-size: 24rpx;
  color: rgba(255, 255, 255, 0.85);
  margin-top: 8rpx;
  display: block;
}

.tabs {
  display: flex;
  background: #fff;
  margin: 0;
}
.tab {
  flex: 1;
  padding: 24rpx 0;
  text-align: center;
  font-size: 26rpx;
  color: #888;
  position: relative;
}
.tab.active {
  color: #667eea;
  font-weight: 600;
}
.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 4rpx;
  background: #667eea;
  border-radius: 2rpx;
}

.content {
  padding: 20rpx;
}

/* 数字桩 */
.peg-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 8rpx 20rpx;
}
.peg-stat {
  font-size: 24rpx;
  color: #666;
}
.range-toggle {
  display: flex;
  background: #fff;
  border-radius: 24rpx;
  padding: 4rpx;
}
.range-chip {
  padding: 6rpx 18rpx;
  font-size: 22rpx;
  color: #888;
  border-radius: 20rpx;
}
.range-chip.active {
  background: #667eea;
  color: #fff;
}

.peg-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 12rpx;
}
.peg-cell {
  background: #fff;
  border-radius: 12rpx;
  height: 130rpx;
  padding: 12rpx 8rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border: 2rpx solid transparent;
}
.peg-cell.filled {
  background: #f0eefa;
  border-color: #667eea;
}
.peg-number {
  font-size: 32rpx;
  font-weight: bold;
  color: #667eea;
}
.peg-desc {
  font-size: 20rpx;
  color: #555;
  margin-top: 4rpx;
  text-align: center;
  line-height: 1.3;
}

.peg-footer-tip {
  font-size: 22rpx;
  color: #999;
  text-align: center;
  margin-top: 24rpx;
  padding: 0 24rpx;
  line-height: 1.6;
}

/* 条目 */
.entry-toolbar {
  display: flex;
  gap: 12rpx;
  margin-bottom: 20rpx;
}
.entry-search {
  flex: 1;
  background: #fff;
  border-radius: 12rpx;
  padding: 0 24rpx;
  height: 76rpx;
  line-height: 76rpx;
  font-size: 26rpx;
}
.entry-add-btn {
  height: 76rpx;
  line-height: 76rpx;
  padding: 0 28rpx;
  background: #667eea;
  color: #fff;
  font-size: 26rpx;
  border-radius: 38rpx;
  border: none;
  margin: 0;
}

.entry-empty {
  text-align: center;
  padding: 100rpx 40rpx;
}
.empty-icon {
  font-size: 80rpx;
  display: block;
  margin-bottom: 16rpx;
}
.empty-title {
  font-size: 28rpx;
  color: #666;
  display: block;
  margin-bottom: 8rpx;
}
.empty-tip {
  font-size: 24rpx;
  color: #aaa;
  display: block;
}

.entry-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.entry-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12rpx;
}
.entry-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #303030;
  flex: 1;
  margin-right: 16rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.more-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: -16rpx;
}
.more-icon {
  font-size: 36rpx;
  color: #999;
}
.entry-numbers {
  font-size: 36rpx;
  font-weight: 500;
  color: #667eea;
  font-family: 'Courier New', monospace;
  letter-spacing: 4rpx;
  display: block;
  margin-bottom: 12rpx;
  word-break: break-all;
}
.entry-meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
}
.entry-tag {
  font-size: 20rpx;
  background: #f0eefa;
  color: #667eea;
  border-radius: 4rpx;
  padding: 2rpx 12rpx;
}
.entry-desc {
  font-size: 22rpx;
  color: #888;
  line-height: 1.5;
}
</style>
