<template>
  <view class="knowledge-page">
    <view class="tabs">
      <view
        v-for="t in tabs"
        :key="t.value"
        class="tab"
        :class="{ active: activeTab === t.value }"
        @click="switchTab(t.value)"
      >
        {{ t.label }}
      </view>
    </view>

    <view class="tab-content">
      <!-- 我的知识库 -->
      <template v-if="activeTab === 'mine'">
        <view v-if="importedPacks.length === 0" class="empty">
          <text class="empty-icon">📚</text>
          <text class="empty-title">还没有导入知识包</text>
          <text class="empty-tip">去「内置知识库」挑选感兴趣的知识包导入吧</text>
          <button class="btn-goto-builtin" @click="activeTab = 'builtin'">去逛内置知识库</button>
        </view>

        <view
          v-for="info in importedPacks"
          :key="info.id"
          class="pack-card"
          @click="goDetail(info.id)"
        >
          <view class="pack-main">
            <text class="pack-name">{{ info.name }}</text>
            <text class="pack-desc">{{ info.desc }}</text>
            <view v-if="info.total > 0" class="pack-progress">
              <text class="progress-text">掌握 {{ info.mastered }}/{{ info.total }}</text>
              <text v-if="info.due > 0" class="progress-due">待复习 {{ info.due }}</text>
            </view>
          </view>
          <view class="pack-side">
            <text class="remove-btn" @click.stop="onRemove(info)">移除</text>
            <text class="arrow">›</text>
          </view>
        </view>
      </template>

      <!-- 内置知识库 -->
      <template v-else>
        <!-- 分类筛选条（横向滚动） -->
        <scroll-view scroll-x class="category-bar" :show-scrollbar="false">
          <view
            v-for="opt in categoryOptions"
            :key="opt.value"
            class="category-chip"
            :class="{ active: activeCategory === opt.value }"
            @click="activeCategory = opt.value"
          >
            {{ opt.label }}
          </view>
        </scroll-view>

        <view v-if="builtinGroups.length === 0" class="empty-filter">
          <text class="empty-filter-text">该分类下暂无知识包</text>
        </view>

        <view v-for="group in builtinGroups" :key="group.label" class="category-group">
          <view class="category-header">
            <text class="category-title">{{ group.label }}</text>
            <text class="category-count">{{ group.packs.length }} 个</text>
          </view>
          <view
            v-for="info in group.packs"
            :key="info.id"
            class="pack-card"
            @click="goDetail(info.id)"
          >
            <view class="pack-main">
              <text class="pack-name">{{ info.name }}</text>
              <text class="pack-desc">{{ info.desc }}</text>
              <text class="pack-meta">{{ info.itemCount }} 条{{ info.ordered ? ' · 按顺序记' : '' }}</text>
            </view>
            <view class="pack-side">
              <template v-if="info.imported">
                <text class="imported-badge">已导入 ✓</text>
                <text class="remove-btn" @click.stop="onRemove(info)">移除</text>
              </template>
              <button
                v-else
                class="import-btn"
                @click.stop="onImport(info)"
              >导入</button>
            </view>
          </view>
        </view>
      </template>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useKnowledgeMemory } from './useKnowledgeMemory'
import {
  PACK_CATEGORY_OPTIONS,
  getPackDisplayCategory,
} from './utils/pack-category'
import type { KnowledgePackInfo } from '@/stores/useUtils/types'

const store = useKnowledgeMemory()

const tabs = [
  { value: 'mine', label: '我的知识库' },
  { value: 'builtin', label: '内置知识库' },
] as const
type TabValue = (typeof tabs)[number]['value']
const activeTab = ref<TabValue>('mine')

// 内置知识库的分类筛选（全部/数学/物理/化学/语文/记忆桩/地理/其他）
const categoryOptions = PACK_CATEGORY_OPTIONS
const activeCategory = ref<(typeof PACK_CATEGORY_OPTIONS)[number]['value']>('all')

// 展示模型：从 packList 派生，附带导入状态与进度
interface PackRow {
  id: string
  name: string
  desc: string
  itemCount: number
  ordered: boolean
  imported: boolean
  total: number
  mastered: number
  due: number
}

function toRow(info: KnowledgePackInfo): PackRow {
  const loaded = store.isPackLoaded(info.id)
  return {
    id: info.id,
    name: info.name,
    desc: info.description,
    itemCount: info.itemCount,
    ordered: info.ordered,
    imported: store.isPackImported(info.id),
    total: loaded ? store.getTotalCount(info.id) : 0,
    mastered: loaded ? store.getMasteredCount(info.id) : 0,
    due: loaded ? store.getDueCount(info.id) : 0,
  }
}

const importedPacks = computed<PackRow[]>(() => {
  if (!store.importedLoaded) return []
  return store.packList
    .filter(p => store.isPackImported(p.id))
    .map(toRow)
})

const builtinGroups = computed(() => {
  if (!store.importedLoaded) return []
  // 先按分类筛选条的展示分类过滤，再按包原有的 math/text 大类分组
  const filtered = store.packList.filter(
    p => activeCategory.value === 'all' || getPackDisplayCategory(p.id) === activeCategory.value,
  )
  const groups = [
    { label: '数字 · 公式 · 理科', category: 'math' as const },
    { label: '常识 · 记忆桩', category: 'text' as const },
  ]
  return groups
    .map(g => ({
      label: g.label,
      packs: filtered.filter(p => p.category === g.category).map(toRow),
    }))
    .filter(g => g.packs.length > 0)
})

function switchTab(tab: TabValue) {
  activeTab.value = tab
}

function goDetail(packId: string) {
  uni.navigateTo({ url: `/subPackages/pages-knowledge/knowledge-detail?packId=${packId}` })
}

async function onImport(info: PackRow) {
  await store.importPack(info.id)
  uni.showToast({ title: '已导入', icon: 'success' })
}

function onRemove(info: PackRow) {
  uni.showModal({
    title: '移除知识包',
    content: `移除「${info.name}」后不再显示，学习进度会保留。`,
    success: (res) => {
      if (res.confirm) {
        store.removeImportedPack(info.id)
        uni.showToast({ title: '已移除', icon: 'success' })
      }
    },
  })
}

onMounted(() => {
  store.loadImportedIds()
})

// 从详情/练习页返回时刷新进度
onShow(() => {
  if (!store.importedLoaded) {
    store.loadImportedIds()
  }
  // 已导入的包按需加载内容以显示进度
  for (const id of store.importedIds) {
    if (!store.isPackLoaded(id)) {
      store.loadPack(id).catch(() => {})
    }
  }
})
</script>

<style scoped>
.knowledge-page {
  min-height: 100vh;
  background: #f5f6fa;
  display: flex;
  flex-direction: column;
}

.tabs {
  display: flex;
  background: #fff;
  border-bottom: 1rpx solid #eee;
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
  color: #52796f;
  font-weight: 600;
}

.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 4rpx;
  background: #52796f;
  border-radius: 2rpx;
}

.tab-content {
  flex: 1;
  padding: 24rpx;
}

/* 空状态 */
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 120rpx 40rpx;
}

.empty-icon {
  font-size: 90rpx;
}

.empty-title {
  font-size: 32rpx;
  color: #303030;
  font-weight: bold;
  margin-top: 24rpx;
}

.empty-tip {
  font-size: 24rpx;
  color: #999;
  margin-top: 12rpx;
}

.btn-goto-builtin {
  margin-top: 40rpx;
  background: #52796f;
  color: #fff;
  border-radius: 40rpx;
  font-size: 28rpx;
  border: none;
  padding: 0 50rpx;
  height: 80rpx;
  line-height: 80rpx;
}

/* 分类筛选条 */
.category-bar {
  white-space: nowrap;
  margin-bottom: 20rpx;
}

.category-chip {
  display: inline-block;
  font-size: 24rpx;
  color: #666;
  background: #fff;
  padding: 12rpx 30rpx;
  border-radius: 30rpx;
  margin-right: 16rpx;
  border: 1rpx solid #e8e8e8;
}

.category-chip.active {
  background: #52796f;
  color: #fff;
  border-color: #52796f;
}

.empty-filter {
  padding: 80rpx 0;
  text-align: center;
}

.empty-filter-text {
  font-size: 24rpx;
  color: #999;
}

/* 分类组 */
.category-group {
  margin-bottom: 30rpx;
}

.category-header {
  display: flex;
  align-items: baseline;
  gap: 12rpx;
  padding: 8rpx 8rpx 16rpx;
}

.category-title {
  font-size: 28rpx;
  font-weight: bold;
  color: #303030;
}

.category-count {
  font-size: 22rpx;
  color: #999;
}

/* 包卡片 */
.pack-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 26rpx;
  margin-bottom: 18rpx;
  display: flex;
  align-items: center;
  gap: 16rpx;
}

.pack-main {
  flex: 1;
  min-width: 0;
}

.pack-name {
  font-size: 30rpx;
  font-weight: bold;
  color: #303030;
  display: block;
}

.pack-desc {
  font-size: 22rpx;
  color: #999;
  margin-top: 6rpx;
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.pack-meta {
  font-size: 22rpx;
  color: #bbb;
  margin-top: 6rpx;
  display: block;
}

.pack-progress {
  display: flex;
  gap: 20rpx;
  margin-top: 10rpx;
}

.progress-text {
  font-size: 22rpx;
  color: #52796f;
}

.progress-due {
  font-size: 22rpx;
  color: #e6a23c;
}

.pack-side {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10rpx;
  flex-shrink: 0;
}

.import-btn {
  background: #52796f;
  color: #fff;
  border: none;
  border-radius: 30rpx;
  font-size: 24rpx;
  padding: 0 30rpx;
  height: 60rpx;
  line-height: 60rpx;
  margin: 0;
}

.imported-badge {
  font-size: 22rpx;
  color: #52796f;
  background: rgba(82, 121, 111, 0.1);
  padding: 8rpx 22rpx;
  border-radius: 26rpx;
}

.remove-btn {
  font-size: 22rpx;
  color: #e64340;
  background: #fee;
  padding: 8rpx 22rpx;
  border-radius: 26rpx;
}

.arrow {
  font-size: 32rpx;
  color: #ccc;
}
</style>
