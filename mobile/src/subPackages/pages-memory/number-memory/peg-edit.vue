<template>
  <view class="page">
    <view class="number-display">
      <text class="number-text">{{ pegNumber }}</text>
      <text class="number-hint">为这个数字编一个易记的桩</text>
    </view>

    <view class="form-card">
      <text class="form-label">文字描述（可加 emoji）</text>
      <textarea
        class="desc-input"
        v-model="description"
        placeholder="如：🧪 药水（与 yào 谐音）"
        auto-height
        :focus="true"
        :maxlength="100"
      />

      <text class="form-tip">💡 例如：00→🧪药水、01→🐦小鸟、12→🌷郁金香、64→🦂蝎子。后期会支持图片。</text>

      <view class="suggest-block" v-if="suggestions.length > 0">
        <text class="suggest-title">这些数字可以联想：</text>
        <view class="suggest-chips">
          <view
            v-for="s in suggestions"
            :key="s"
            class="suggest-chip"
            @click="description = s"
          >
            {{ s }}
          </view>
        </view>
      </view>
    </view>

    <view class="actions">
      <button class="action-btn secondary" @click="onCancel">取消</button>
      <button v-if="hasExisting" class="action-btn danger" @click="onDelete">删除</button>
      <button class="action-btn primary" @click="onSave">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useNumberMemory } from '@/stores/useNumberMemory'

const store = useNumberMemory()

const pegNumber = ref('')
const description = ref('')

const existing = computed(() => store.getAssociation(pegNumber.value))
const hasExisting = computed(() => !!existing.value)

// 一些常用谐音/形似桩位提示
const SUGGESTION_MAP: Record<string, string[]> = {
  '0': ['🥚 蛋', '⭕ 圈'],
  '1': ['🌳 树', '🖊️ 笔', '🚶 一个人'],
  '2': ['🦆 鸭子', '👬 双胞胎'],
  '3': ['🌳 山（外形像3）', '👂 耳朵'],
  '4': ['⛵ 帆船', '🎏 红旗'],
  '5': ['🪝 钩子', '✋ 五指'],
  '6': ['🥄 勺子', '🐌 蜗牛'],
  '7': ['🪓 斧头', '🦵 拐杖'],
  '8': ['👓 眼镜', '⛄ 雪人'],
  '9': ['🎈 气球', '🎯 标枪'],
  '00': ['🧪 药水', '🍩 双甜甜圈'],
  '01': ['🐦 小鸟', '🥚 一个蛋'],
  '12': ['🌷 郁金香', '🕛 中午'],
  '64': ['🦂 蝎子', '🎉 庆典'],
  '99': ['🍑 99桃', '👴 长寿'],
}

const suggestions = computed(() => SUGGESTION_MAP[pegNumber.value] || [])

onLoad((opt: any) => {
  store.load()
  if (opt?.number) {
    pegNumber.value = decodeURIComponent(opt.number)
    uni.setNavigationBarTitle({ title: `数字桩 ${pegNumber.value}` })
    const e = store.getAssociation(pegNumber.value)
    if (e) description.value = e.description
  }
})

function onSave() {
  const desc = description.value.trim()
  if (!desc) {
    uni.showToast({ title: '请填写描述', icon: 'none' })
    return
  }
  store.setAssociation({
    number: pegNumber.value,
    description: desc,
    source: 'user',
  })
  uni.showToast({ title: '已保存', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 300)
}

function onDelete() {
  uni.showModal({
    title: '删除桩位',
    content: `确定删除数字 ${pegNumber.value} 的文字桩？`,
    confirmText: '删除',
    confirmColor: '#e64340',
    success: (res) => {
      if (res.confirm) {
        store.deleteAssociation(pegNumber.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 300)
      }
    },
  })
}

function onCancel() {
  uni.navigateBack()
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
  padding: 40rpx 24rpx 200rpx;
}

.number-display {
  text-align: center;
  padding: 60rpx 0;
}
.number-text {
  font-size: 160rpx;
  font-weight: bold;
  color: #667eea;
  letter-spacing: 8rpx;
  font-family: 'Courier New', monospace;
  display: block;
}
.number-hint {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
}
.form-label {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 12rpx;
  display: block;
}
.desc-input {
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 30rpx;
  color: #303030;
  width: 100%;
  min-height: 140rpx;
  line-height: 1.6;
  box-sizing: border-box;
}
.form-tip {
  font-size: 22rpx;
  color: #999;
  line-height: 1.6;
  display: block;
  margin-top: 20rpx;
}

.suggest-block {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}
.suggest-title {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 12rpx;
  display: block;
}
.suggest-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.suggest-chip {
  padding: 12rpx 20rpx;
  background: #f0eefa;
  color: #667eea;
  border-radius: 24rpx;
  font-size: 24rpx;
}

.actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 16rpx;
  padding: 24rpx;
  background: #fff;
  box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.action-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  border: none;
  margin: 0;
}
.action-btn.primary {
  background: #667eea;
  color: #fff;
}
.action-btn.secondary {
  background: #f5f5f5;
  color: #666;
}
.action-btn.danger {
  background: #fee;
  color: #e64340;
  flex: 0.6;
}
</style>
