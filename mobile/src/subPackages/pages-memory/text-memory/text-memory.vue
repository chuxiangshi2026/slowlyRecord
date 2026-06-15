<template>
  <view class="text-memory-page">
    <!-- 头部 -->
    <view class="header">
      <text class="title">📜 文本记忆</text>
      <text class="subtitle">收藏诗词、成语与文章，慢慢记忆</text>
    </view>

    <!-- 工具栏 -->
    <view class="toolbar">
      <view class="search-box">
        <input
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索标题、作者或正文"
          confirm-type="search"
        />
      </view>
      <view class="action-btns">
        <button class="btn-add" @click="goAdd">
          <text>＋ 添加</text>
        </button>
        <button class="btn-import" @click="goImport">
          <text>↓ 导入</text>
        </button>
      </view>
    </view>

    <!-- 标签筛选 -->
    <scroll-view scroll-x class="tag-bar" v-if="store.allTags.length > 0">
      <view
        class="tag-chip"
        :class="{ active: !selectedTag }"
        @click="selectedTag = ''"
      >
        全部
      </view>
      <view
        v-for="tag in store.allTags"
        :key="tag"
        class="tag-chip"
        :class="{ active: selectedTag === tag }"
        @click="selectedTag = tag"
      >
        {{ tag }}
      </view>
    </scroll-view>

    <!-- 统计 -->
    <view class="stats-bar">
      <text class="stat-text">共 {{ filtered.length }} 篇</text>
      <text class="stat-divider" v-if="store.allTags.length > 0">·</text>
      <text class="stat-text" v-if="store.allTags.length > 0">{{ store.allTags.length }} 个标签</text>
    </view>

    <!-- 列表 -->
    <view class="article-list" v-if="filtered.length > 0">
      <view
        v-for="article in filtered"
        :key="article._id"
        class="article-card"
        @click="onCardClick(article)"
      >
        <view class="article-header">
          <text class="article-title">{{ article.title }}</text>
          <view
            class="more-btn"
            @click.stop="onMoreClick(article)"
          >
            <text class="more-icon">⋯</text>
          </view>
        </view>

        <view class="article-meta">
          <text v-if="article.category === 'idiom'" class="meta-tag idiom">成语</text>
          <text v-else-if="article.dynasty" class="meta-tag dynasty">{{ article.dynasty }}</text>
          <text v-else-if="article.category === 'poetry'" class="meta-tag poetry">诗词</text>
          <text v-if="article.author" class="meta-text">{{ article.author }}</text>
          <text v-if="article.location" class="meta-text">📍 {{ article.location }}</text>
        </view>

        <text class="article-preview">
          {{ getPreview(article.content) }}
        </text>

        <view class="article-tags" v-if="article.tags.length > 0">
          <text v-for="tag in article.tags.slice(0, 4)" :key="tag" class="article-tag">
            {{ tag }}
          </text>
          <text v-if="article.tags.length > 4" class="article-tag">+{{ article.tags.length - 4 }}</text>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <text class="empty-icon">📖</text>
      <text class="empty-title">{{ searchKeyword || selectedTag ? '没有匹配的文章' : '还没有文章' }}</text>
      <text class="empty-tip">点击上方「添加」或「导入」开始</text>
    </view>

    <!-- 详情弹窗 -->
    <view v-if="detailArticle" class="detail-mask" @click="detailArticle = null">
      <view class="detail-card" @click.stop>
        <text class="detail-title">{{ detailArticle.title }}</text>
        <view class="detail-meta">
          <text v-if="detailArticle.category === 'idiom'" class="meta-tag idiom">成语</text>
          <text v-else-if="detailArticle.dynasty" class="meta-tag dynasty">{{ detailArticle.dynasty }}</text>
          <text v-if="detailArticle.author" class="meta-text">{{ detailArticle.author }}</text>
          <text v-if="detailArticle.location" class="meta-text">📍 {{ detailArticle.location }}</text>
        </view>
        <scroll-view scroll-y class="detail-content-wrap">
          <text class="detail-content" selectable>{{ detailArticle.content }}</text>
        </scroll-view>
        <text v-if="detailArticle.source" class="detail-source">出处：{{ detailArticle.source }}</text>
        <view class="detail-actions">
          <button class="detail-btn secondary" @click="detailArticle = null">关闭</button>
          <button class="detail-btn primary" @click="onEditFromDetail">编辑</button>
        </view>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onActivated } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useTextMemory } from '@/stores/useTextMemory'
import type { MobileTextArticle } from '@/stores/useUtils/types'

const store = useTextMemory()

const searchKeyword = ref('')
const selectedTag = ref('')
const detailArticle = ref<MobileTextArticle | null>(null)

const filtered = computed(() => {
  let list = store.sortedArticles
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(a =>
      a.title.toLowerCase().includes(kw) ||
      (a.author || '').toLowerCase().includes(kw) ||
      a.content.toLowerCase().includes(kw)
    )
  }
  if (selectedTag.value) {
    list = list.filter(a => a.tags.includes(selectedTag.value))
  }
  return list
})

onMounted(() => {
  store.load()
})

// 从编辑/导入页返回时刷新
onShow(() => {
  store.load()
})

function getPreview(content: string): string {
  const cleaned = content.replace(/\n/g, ' ').trim()
  return cleaned.length > 60 ? cleaned.slice(0, 60) + '…' : cleaned
}

function onCardClick(article: MobileTextArticle) {
  detailArticle.value = article
}

function onMoreClick(article: MobileTextArticle) {
  uni.showActionSheet({
    itemList: ['编辑', '删除'],
    success: (res) => {
      if (res.tapIndex === 0) goEdit(article)
      else if (res.tapIndex === 1) confirmDelete(article)
    },
  })
}

function onEditFromDetail() {
  if (!detailArticle.value) return
  const a = detailArticle.value
  detailArticle.value = null
  goEdit(a)
}

function goAdd() {
  uni.navigateTo({ url: '/subPackages/pages-memory/text-memory/edit' })
}

function goEdit(article: MobileTextArticle) {
  uni.navigateTo({
    url: `/subPackages/pages-memory/text-memory/edit?id=${encodeURIComponent(article._id)}`,
  })
}

function goImport() {
  uni.navigateTo({ url: '/subPackages/pages-memory/text-memory/import' })
}

function confirmDelete(article: MobileTextArticle) {
  uni.showModal({
    title: '删除文章',
    content: `确定删除「${article.title}」吗？`,
    confirmText: '删除',
    confirmColor: '#e64340',
    success: (res) => {
      if (res.confirm) {
        store.deleteArticle(article._id)
        uni.showToast({ title: '已删除', icon: 'success' })
      }
    },
  })
}
</script>

<style scoped>
.text-memory-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 40rpx;
}

.header {
  background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%);
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

.toolbar {
  display: flex;
  align-items: center;
  gap: 16rpx;
  padding: 24rpx 24rpx 12rpx;
}
.search-box {
  flex: 1;
  background: #fff;
  border-radius: 32rpx;
  padding: 0 24rpx;
  height: 64rpx;
  display: flex;
  align-items: center;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.04);
}
.search-input {
  flex: 1;
  font-size: 26rpx;
  color: #333;
}
.action-btns {
  display: flex;
  gap: 10rpx;
}
.btn-add,
.btn-import {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 22rpx;
  font-size: 24rpx;
  border-radius: 32rpx;
  border: none;
  margin: 0;
}
.btn-add {
  background: #43a047;
  color: #fff;
}
.btn-import {
  background: #fff;
  color: #43a047;
  border: 1rpx solid #43a047;
}

.tag-bar {
  white-space: nowrap;
  padding: 4rpx 24rpx 12rpx;
}
.tag-chip {
  display: inline-block;
  padding: 8rpx 22rpx;
  background: #fff;
  color: #666;
  border-radius: 24rpx;
  font-size: 24rpx;
  margin-right: 12rpx;
  border: 1rpx solid transparent;
}
.tag-chip.active {
  background: #e8f5e9;
  color: #2e7d32;
  border-color: #43a047;
}

.stats-bar {
  padding: 0 28rpx 12rpx;
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.stat-text {
  font-size: 22rpx;
  color: #999;
}
.stat-divider {
  color: #ccc;
}

.article-list {
  padding: 0 20rpx;
}
.article-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.article-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12rpx;
}
.article-title {
  font-size: 30rpx;
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
.article-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 12rpx;
}
.meta-tag {
  display: inline-block;
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  font-weight: 500;
}
.meta-tag.idiom {
  background: #fef3e0;
  color: #e6a23c;
}
.meta-tag.dynasty,
.meta-tag.poetry {
  background: #ecf5ff;
  color: #409eff;
}
.meta-text {
  font-size: 22rpx;
  color: #888;
}
.article-preview {
  font-size: 26rpx;
  color: #666;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.article-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-top: 12rpx;
}
.article-tag {
  display: inline-block;
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  background: #f5f5f5;
  color: #888;
  border-radius: 6rpx;
}

.empty-state {
  text-align: center;
  padding: 120rpx 40rpx;
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

.detail-mask {
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
  padding: 40rpx;
}
.detail-card {
  width: 100%;
  max-height: 70vh;
  background: #fff;
  border-radius: 20rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
}
.detail-title {
  font-size: 34rpx;
  font-weight: bold;
  color: #303030;
  margin-bottom: 16rpx;
  display: block;
}
.detail-meta {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8rpx;
  margin-bottom: 20rpx;
}
.detail-content-wrap {
  max-height: 50vh;
  margin-bottom: 16rpx;
}
.detail-content {
  font-size: 28rpx;
  color: #303030;
  line-height: 1.9;
  white-space: pre-line;
  display: block;
}
.detail-source {
  font-size: 22rpx;
  color: #999;
  margin-bottom: 16rpx;
  display: block;
}
.detail-actions {
  display: flex;
  gap: 16rpx;
}
.detail-btn {
  flex: 1;
  height: 76rpx;
  line-height: 76rpx;
  border-radius: 38rpx;
  font-size: 28rpx;
  border: none;
  margin: 0;
}
.detail-btn.secondary {
  background: #f5f5f5;
  color: #666;
}
.detail-btn.primary {
  background: #43a047;
  color: #fff;
}
</style>
