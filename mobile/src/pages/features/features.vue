<template>
  <view class="features-container">
    <view class="section-title">全部功能</view>
    <view class="menu-list">
      <view class="menu-item" v-for="item in features" :key="item.text" @click="item.action">
        <view class="menu-icon" :class="item.cls">{{ item.icon }}</view>
        <view class="menu-info">
          <text class="menu-text">{{ item.text }}</text>
          <text class="menu-desc">{{ item.desc }}</text>
        </view>
        <text class="menu-arrow">›</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
// 「全部功能」列表页：收纳首页宫格收敛后移除的入口，路由保持不变
const navigate = (url: string) => {
  uni.navigateTo({ url })
}

const features = [
  {
    icon: '➕',
    cls: 'add',
    text: '添加单词',
    desc: '手动添加或拍照取词',
    action: () => navigate('/subPackages/pages-tools/add-word/add-word'),
  },
  {
    icon: '📚',
    cls: 'bank',
    text: '词库管理',
    desc: '切换 / 导入 / 管理词库',
    action: () => navigate('/subPackages/pages-data/wordbank/wordbank'),
  },
  {
    icon: '🔤',
    cls: 'phonetic',
    text: '音标学习',
    desc: '音标识别 / 最小对立对',
    action: () => navigate('/subPackages/pages-memory/phonetic-memory/phonetic-memory'),
  },
  {
    icon: '🧠',
    cls: 'test',
    text: '记忆测试',
    desc: '测评当前记忆水平',
    action: () => navigate('/subPackages/pages-memory/memory-test/memory-test'),
  },
  {
    icon: '📖',
    cls: 'knowledge',
    text: '知识库',
    desc: '内置知识包学习',
    action: () => navigate('/subPackages/pages-knowledge/knowledge-list'),
  },
  {
    icon: '🏛️',
    cls: 'palace',
    text: '记忆宫殿',
    desc: '查看宫殿 / 巡视复习',
    action: () => navigate('/subPackages/pages-memory/memory-palace/list'),
  },
  {
    icon: '🌙',
    cls: 'focus',
    text: '专注模式',
    desc: '沉浸式学习 / 连播听词（防熄屏）',
    action: () => navigate('/subPackages/pages-tools/focus/focus'),
  },
]
</script>

<style scoped>
.features-container {
  min-height: 100vh;
  background: #f5f7f5;
  padding: 20rpx;
}

.section-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
  padding: 20rpx 10rpx;
}

.menu-list {
  background: #fff;
  border-radius: 16rpx;
  overflow: hidden;
  box-shadow: 0 2rpx 12rpx rgba(0, 0, 0, 0.06);
}

.menu-item {
  display: flex;
  align-items: center;
  padding: 30rpx;
  border-bottom: 1rpx solid #f0f2f0;
}

.menu-item:last-child {
  border-bottom: none;
}

.menu-icon {
  width: 72rpx;
  height: 72rpx;
  border-radius: 16rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32rpx;
  color: #fff;
  margin-right: 24rpx;
}

/* 主色 #52796f 系列的低饱和同族色 */
.menu-icon.add { background: #74937d; }
.menu-icon.bank { background: #52796f; }
.menu-icon.phonetic { background: #6f9a8d; }
.menu-icon.test { background: #3d5a52; }
.menu-icon.knowledge { background: #83a89a; }
.menu-icon.palace { background: #4a6b62; }
.menu-icon.focus { background: #5c7a6b; }

.menu-info {
  flex: 1;
}

.menu-text {
  font-size: 30rpx;
  color: #333;
  display: block;
}

.menu-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 6rpx;
  display: block;
}

.menu-arrow {
  font-size: 36rpx;
  color: #ccc;
}
</style>
