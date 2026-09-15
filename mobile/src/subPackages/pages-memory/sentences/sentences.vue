<template>
  <view class="sentences-page">
    <!-- 头部 -->
    <view class="header">
      <text class="title">💬 句子收藏</text>
      <text class="subtitle">收藏喜欢的句子与译文</text>
    </view>

    <!-- 工具栏 -->
    <view class="toolbar">
      <view class="search-box">
        <input
          class="search-input"
          v-model="searchKeyword"
          placeholder="搜索句子或译文"
          confirm-type="search"
        />
      </view>
      <button class="btn-add" @click="showAddPanel = !showAddPanel">
        <text>{{ showAddPanel ? '收起' : '＋ 添加' }}</text>
      </button>
    </view>

    <!-- 添加面板 -->
    <view v-if="showAddPanel" class="add-panel">
      <textarea
        class="add-textarea"
        v-model="newText"
        placeholder="输入句子原文"
        :maxlength="500"
      />
      <input
        class="add-input"
        v-model="newTranslation"
        placeholder="译文（可选）"
        :maxlength="500"
      />
      <button class="btn-save" :disabled="!newText.trim()" @click="onAdd">保存</button>
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
      <text class="stat-text">共 {{ filtered.length }} 句</text>
      <text class="stat-divider">·</text>
      <text class="stat-text">{{ favoriteCount }} 条收藏</text>
    </view>

    <!-- 列表 -->
    <view class="sentence-list" v-if="filtered.length > 0">
      <view v-for="s in filtered" :key="s.id" class="sentence-card">
        <view class="sentence-main">
          <text class="sentence-text" selectable>{{ s.text }}</text>
          <text v-if="s.translation" class="sentence-translation" selectable>{{ s.translation }}</text>
        </view>
        <view class="sentence-footer">
          <text class="lang-tag" :class="s.lang">{{ langLabel(s.lang) }}</text>
          <view class="fav-btn" @click="store.toggleFavorite(s.id)">
            <text class="fav-icon" :class="{ active: s.favorite }">{{ s.favorite ? '★' : '☆' }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- 空状态 -->
    <view v-else class="empty-state">
      <text class="empty-icon">💬</text>
      <text class="empty-title">{{ searchKeyword || selectedTag ? '没有匹配的句子' : '还没有收藏句子' }}</text>
      <text class="empty-tip">点击上方「添加」记录第一句</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onShow } from '@dcloudio/uni-app'
import { useSentences } from '@/stores/useSentences'

const store = useSentences()

const searchKeyword = ref('')
const selectedTag = ref('')
const showAddPanel = ref(false)
const newText = ref('')
const newTranslation = ref('')

const filtered = computed(() => {
  let list = store.sortedSentences
  if (searchKeyword.value.trim()) {
    const kw = searchKeyword.value.trim().toLowerCase()
    list = list.filter(
      (s) =>
        s.text.toLowerCase().includes(kw) ||
        (s.translation || '').toLowerCase().includes(kw),
    )
  }
  if (selectedTag.value) {
    list = list.filter((s) => s.tags.includes(selectedTag.value))
  }
  return list
})

const favoriteCount = computed(() => store.sentences.filter((s) => s.favorite).length)

onMounted(() => store.load())
onShow(() => store.load())

function langLabel(lang: string): string {
  return lang === 'zh' ? '中文' : lang === 'en' ? '英文' : '其他'
}

function onAdd() {
  const created = store.addSentence(newText.value, newTranslation.value)
  if (!created) return
  newText.value = ''
  newTranslation.value = ''
  showAddPanel.value = false
  uni.showToast({ title: '已保存', icon: 'success' })
}
</script>

<style scoped>
.sentences-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding-bottom: 40rpx;
}

.header {
  background: linear-gradient(135deg, #52796f 0%, #3d5a52 100%);
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
.btn-add {
  height: 64rpx;
  line-height: 64rpx;
  padding: 0 22rpx;
  font-size: 24rpx;
  border-radius: 32rpx;
  border: none;
  margin: 0;
  background: #52796f;
  color: #fff;
}

.add-panel {
  margin: 0 24rpx 12rpx;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.add-textarea {
  width: 100%;
  min-height: 140rpx;
  font-size: 26rpx;
  color: #333;
  background: #f8f9fb;
  border-radius: 12rpx;
  padding: 16rpx;
  box-sizing: border-box;
}
.add-input {
  width: 100%;
  height: 72rpx;
  font-size: 26rpx;
  color: #333;
  background: #f8f9fb;
  border-radius: 12rpx;
  padding: 0 16rpx;
  margin-top: 16rpx;
  box-sizing: border-box;
}
.btn-save {
  margin-top: 16rpx;
  height: 72rpx;
  line-height: 72rpx;
  border-radius: 36rpx;
  font-size: 28rpx;
  border: none;
  background: #52796f;
  color: #fff;
}
.btn-save[disabled] {
  background: #c8cfcb;
  color: #fff;
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
  background: #eaf1ea;
  color: #3d5a52;
  border-color: #52796f;
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

.sentence-list {
  padding: 0 20rpx;
}
.sentence-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx 28rpx;
  margin-bottom: 16rpx;
  box-shadow: 0 1rpx 4rpx rgba(0, 0, 0, 0.05);
}
.sentence-main {
  display: flex;
  flex-direction: column;
}
.sentence-text {
  font-size: 28rpx;
  color: #303030;
  line-height: 1.7;
}
.sentence-translation {
  font-size: 24rpx;
  color: #888;
  line-height: 1.6;
  margin-top: 10rpx;
}
.sentence-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 16rpx;
}
.lang-tag {
  font-size: 20rpx;
  padding: 2rpx 12rpx;
  border-radius: 8rpx;
  background: #f0f0f0;
  color: #595959;
}
.lang-tag.en {
  background: #eaf1ea;
  color: #3d5a52;
}
.fav-btn {
  width: 60rpx;
  height: 60rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  margin-right: -16rpx;
}
.fav-icon {
  font-size: 40rpx;
  color: #ccc;
}
.fav-icon.active {
  color: #e6a23c;
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
</style>
