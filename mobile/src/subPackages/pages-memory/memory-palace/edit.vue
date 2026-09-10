<template>
  <view class="edit-container">
    <view class="form-card">
      <text class="label">宫殿名称</text>
      <input v-model="name" class="input" placeholder="如：我的家" maxlength="20" />
    </view>

    <view class="section-title">记忆钩子（按顺序排列）</view>
    <view v-if="loci.length === 0" class="empty-loci">还没有钩子，点击下方添加</view>
    <view v-for="(locus, idx) in loci" :key="idx" class="locus-item">
      <view class="locus-order">{{ idx + 1 }}</view>
      <view class="locus-body">
        <input v-model="locus.name" class="input" placeholder="钩子名称，如：大门" maxlength="12" />
        <input v-model="locus.description" class="input sub" placeholder="描述（可选）" maxlength="30" />
      </view>
      <view class="locus-actions">
        <text v-if="idx > 0" class="action-btn" @click="moveLocus(idx, -1)">↑</text>
        <text v-if="idx < loci.length - 1" class="action-btn" @click="moveLocus(idx, 1)">↓</text>
        <text class="action-btn danger" @click="removeLocus(idx)">×</text>
      </view>
    </view>

    <button class="add-locus-btn" @click="addLocus">＋ 添加钩子</button>

    <view class="footer">
      <button class="btn-cancel" @click="goBack">取消</button>
      <button class="btn-save" @click="save">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useMemoryPalace } from '@/stores/useMemoryPalace'

const store = useMemoryPalace()
const palaceId = ref('')
const name = ref('')
const loci = ref<{ name: string; description?: string }[]>([])

onMounted(() => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  palaceId.value = current?.$page?.options?.id || ''
  if (palaceId.value) {
    store.load()
    const palace = store.getPalace(palaceId.value)
    if (palace) {
      name.value = palace.name
      loci.value = palace.loci.map(l => ({ name: l.name, description: l.description }))
    }
  }
})

function addLocus() {
  loci.value.push({ name: '' })
}

function removeLocus(idx: number) {
  loci.value.splice(idx, 1)
}

function moveLocus(idx: number, dir: -1 | 1) {
  const target = idx + dir
  if (target < 0 || target >= loci.value.length) return
  const arr = [...loci.value]
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
  loci.value = arr
}

function save() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    uni.showToast({ title: '请输入宫殿名称', icon: 'none' })
    return
  }
  const validLoci = loci.value.filter(l => l.name.trim())
  if (validLoci.length === 0) {
    uni.showToast({ title: '至少添加一个钩子', icon: 'none' })
    return
  }
  if (palaceId.value) {
    // 编辑：改名称 + 全量替换钩子（简单可靠，进度挂在 pegs 上按 locusOrder 保留）
    store.updatePalace(palaceId.value, trimmed)
    // 重建钩子：先删后加
    const existing = store.getPalace(palaceId.value)?.loci.length || 0
    for (let i = existing; i >= 1; i--) store.removeLocus(palaceId.value, i)
    validLoci.forEach(l => store.addLocus(palaceId.value, l))
  } else {
    const palace = store.createPalace(trimmed)
    validLoci.forEach(l => store.addLocus(palace._id, l))
  }
  uni.showToast({ title: palaceId.value ? '已保存' : '已创建', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 300)
}

function goBack() {
  uni.navigateBack()
}
</script>

<style scoped>
.edit-container {
  min-height: 100vh;
  background: #f5f7f5;
  padding: 20rpx;
  padding-bottom: 120rpx;
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
  display: block;
}

.input {
  border: 1rpx solid #e0e6e2;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 30rpx;
  background: #fafcfa;
}

.input.sub {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #666;
}

.section-title {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  margin: 24rpx 0 12rpx;
}

.empty-loci {
  text-align: center;
  color: #999;
  font-size: 26rpx;
  padding: 40rpx 0;
}

.locus-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
}

.locus-order {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #eaf1ea;
  color: #52796f;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.locus-body {
  flex: 1;
  margin-left: 16rpx;
}

.locus-actions {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-left: 12rpx;
}

.action-btn {
  font-size: 32rpx;
  color: #52796f;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.danger {
  color: #c0564f;
}

.add-locus-btn {
  background: #fff;
  border: 2rpx dashed #52796f;
  color: #52796f;
  border-radius: 16rpx;
  font-size: 28rpx;
  margin-top: 8rpx;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  background: #f5f7f5;
  border-top: 1rpx solid #e8ede9;
}

.btn-cancel {
  flex: 1;
  background: #fff;
  color: #666;
  border-radius: 16rpx;
  font-size: 30rpx;
}

.btn-save {
  flex: 1;
  background: #52796f;
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
}
</style>
