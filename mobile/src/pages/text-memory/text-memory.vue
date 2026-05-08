<template>
  <view class="text-memory-container">
    <view class="header">
      <text class="title">📜 诗词记忆</text>
      <text class="subtitle">经典诗词，日积月累</text>
    </view>

    <view class="category-tabs">
      <view
        v-for="cat in categories"
        :key="cat.value"
        class="tab-item"
        :class="{ active: currentCategory === cat.value }"
        @click="currentCategory = cat.value"
      >
        <text>{{ cat.label }}</text>
      </view>
    </view>

    <view class="poem-list">
      <view
        v-for="(poem, index) in filteredPoems"
        :key="index"
        class="poem-card"
        @click="showPoemDetail(poem)"
      >
        <view class="poem-header">
          <text class="poem-title">{{ poem.title }}</text>
          <text class="poem-author">{{ poem.dynasty }} · {{ poem.author }}</text>
        </view>
        <text class="poem-preview">{{ poem.content.slice(0, 30) }}...</text>
        <view class="poem-tags">
          <text class="tag">{{ poem.category }}</text>
        </view>
      </view>
    </view>

    <view v-if="filteredPoems.length === 0" class="empty-state">
      <text class="empty-text">暂无该分类诗词</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'

interface Poem {
  title: string
  author: string
  dynasty: string
  content: string
  category: string
}

const categories = [
  { value: 'all', label: '全部' },
  { value: 'tang', label: '唐诗' },
  { value: 'song', label: '宋词' },
  { value: 'yuan', label: '元曲' },
  { value: 'ancient', label: '古诗' },
]

const currentCategory = ref('all')

const poems: Poem[] = [
  {
    title: '静夜思',
    author: '李白',
    dynasty: '唐',
    content: '床前明月光，疑是地上霜。举头望明月，低头思故乡。',
    category: 'tang'
  },
  {
    title: '春晓',
    author: '孟浩然',
    dynasty: '唐',
    content: '春眠不觉晓，处处闻啼鸟。夜来风雨声，花落知多少。',
    category: 'tang'
  },
  {
    title: '登鹳雀楼',
    author: '王之涣',
    dynasty: '唐',
    content: '白日依山尽，黄河入海流。欲穷千里目，更上一层楼。',
    category: 'tang'
  },
  {
    title: '水调歌头',
    author: '苏轼',
    dynasty: '宋',
    content: '明月几时有？把酒问青天。不知天上宫阙，今夕是何年。',
    category: 'song'
  },
  {
    title: '念奴娇·赤壁怀古',
    author: '苏轼',
    dynasty: '宋',
    content: '大江东去，浪淘尽，千古风流人物。故垒西边，人道是，三国周郎赤壁。',
    category: 'song'
  },
  {
    title: '天净沙·秋思',
    author: '马致远',
    dynasty: '元',
    content: '枯藤老树昏鸦，小桥流水人家，古道西风瘦马。夕阳西下，断肠人在天涯。',
    category: 'yuan'
  },
  {
    title: '关雎',
    author: '佚名',
    dynasty: '先秦',
    content: '关关雎鸠，在河之洲。窈窕淑女，君子好逑。',
    category: 'ancient'
  },
  {
    title: '短歌行',
    author: '曹操',
    dynasty: '汉',
    content: '对酒当歌，人生几何！譬如朝露，去日苦多。',
    category: 'ancient'
  }
]

const filteredPoems = computed(() => {
  if (currentCategory.value === 'all') return poems
  return poems.filter(p => p.category === currentCategory.value)
})

const showPoemDetail = (poem: Poem) => {
  uni.showModal({
    title: poem.title,
    content: `${poem.dynasty} · ${poem.author}\n\n${poem.content}`,
    showCancel: false
  })
}
</script>

<style scoped>
.text-memory-container {
  min-height: 100vh;
  background: #f5f5f5;
}

.header {
  background: linear-gradient(135deg, #43a047 0%, #2e7d32 100%);
  padding: 60rpx 40rpx;
  text-align: center;
}

.title {
  font-size: 40rpx;
  font-weight: bold;
  color: #fff;
  display: block;
}

.subtitle {
  font-size: 26rpx;
  color: rgba(255,255,255,0.8);
  margin-top: 10rpx;
  display: block;
}

.category-tabs {
  display: flex;
  gap: 16rpx;
  padding: 20rpx;
  background: #fff;
  overflow-x: auto;
}

.tab-item {
  padding: 16rpx 32rpx;
  background: #f5f5f5;
  border-radius: 32rpx;
  font-size: 26rpx;
  color: #666;
  white-space: nowrap;
}

.tab-item.active {
  background: #43a047;
  color: #fff;
}

.poem-list {
  padding: 20rpx;
}

.poem-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 16rpx;
}

.poem-header {
  margin-bottom: 16rpx;
}

.poem-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  display: block;
}

.poem-author {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.poem-preview {
  font-size: 28rpx;
  color: #666;
  line-height: 1.6;
  display: block;
}

.poem-tags {
  margin-top: 16rpx;
}

.tag {
  display: inline-block;
  padding: 4rpx 16rpx;
  background: #e8f5e9;
  color: #43a047;
  border-radius: 20rpx;
  font-size: 22rpx;
}

.empty-state {
  text-align: center;
  padding: 100rpx 40rpx;
}

.empty-text {
  font-size: 28rpx;
  color: #999;
}
</style>
