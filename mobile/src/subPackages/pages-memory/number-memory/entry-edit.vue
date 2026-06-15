<template>
  <view class="page">
    <view class="form">
      <view class="form-row">
        <text class="form-label">标题 *</text>
        <input class="form-input" v-model="form.title" placeholder="如：常用电话" />
      </view>

      <view class="form-row">
        <text class="form-label">数字串 *</text>
        <textarea
          class="form-textarea numbers"
          v-model="form.numbers"
          placeholder="如：13800138000"
          auto-height
        />
        <text v-if="pegHints.length > 0" class="peg-hints">
          桩提示：{{ pegHints.join(' / ') }}
        </text>
      </view>

      <view class="form-row">
        <text class="form-label">标签（逗号分隔）</text>
        <input class="form-input" v-model="tagsInput" placeholder="如：电话,常用,家人" />
      </view>

      <view class="form-row">
        <text class="form-label">备注（可选）</text>
        <textarea
          class="form-textarea"
          v-model="form.description"
          placeholder="任何想记的辅助说明..."
          auto-height
        />
      </view>
    </view>

    <view class="actions">
      <button class="action-btn secondary" @click="onCancel">取消</button>
      <button v-if="isEdit" class="action-btn danger" @click="onDelete">删除</button>
      <button class="action-btn primary" @click="onSubmit">{{ isEdit ? '保存' : '添加' }}</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useNumberMemory } from '@/stores/useNumberMemory'

const store = useNumberMemory()

const editingId = ref<string>('')
const isEdit = computed(() => !!editingId.value)

const form = ref({
  title: '',
  numbers: '',
  description: '',
})
const tagsInput = ref('')

// 拆数字串为两位一组，回查桩
const pegHints = computed(() => {
  const digits = form.value.numbers.replace(/\D/g, '')
  if (!digits) return []
  const hints: string[] = []
  for (let i = 0; i < Math.min(digits.length, 20); i += 2) {
    const pair = digits.slice(i, i + 2).padStart(2, '0')
    const peg = store.getAssociation(pair)
    if (peg?.description) {
      hints.push(`${pair}=${peg.description}`)
    }
  }
  return hints
})

onLoad((opt: any) => {
  store.load()
  if (opt?.id) {
    editingId.value = decodeURIComponent(opt.id)
    const entry = store.entries.find((e) => e._id === editingId.value)
    if (entry) {
      form.value.title = entry.title
      form.value.numbers = entry.numbers
      form.value.description = entry.description || ''
      tagsInput.value = (entry.tags || []).join(', ')
      uni.setNavigationBarTitle({ title: '编辑数字条目' })
    }
  } else {
    uni.setNavigationBarTitle({ title: '添加数字条目' })
  }
})

function parseTags(): string[] {
  return tagsInput.value
    .split(/[,，]/)
    .map((t) => t.trim())
    .filter(Boolean)
}

function onSubmit() {
  const title = form.value.title.trim()
  const numbers = form.value.numbers.trim()
  if (!title) {
    uni.showToast({ title: '请填写标题', icon: 'none' })
    return
  }
  if (!numbers) {
    uni.showToast({ title: '请填写数字串', icon: 'none' })
    return
  }

  if (isEdit.value) {
    store.updateEntry(editingId.value, {
      title,
      numbers,
      tags: parseTags(),
      description: form.value.description.trim() || undefined,
    })
    uni.showToast({ title: '已保存', icon: 'success' })
  } else {
    store.addEntry({
      title,
      numbers,
      tags: parseTags(),
      description: form.value.description.trim() || undefined,
    })
    uni.showToast({ title: '已添加', icon: 'success' })
  }
  setTimeout(() => uni.navigateBack(), 300)
}

function onDelete() {
  uni.showModal({
    title: '删除条目',
    content: '确定删除这个数字条目吗？',
    confirmText: '删除',
    confirmColor: '#e64340',
    success: (res) => {
      if (res.confirm) {
        store.deleteEntry(editingId.value)
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
  padding: 24rpx 24rpx 200rpx;
}

.form {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
}
.form-row {
  margin-bottom: 28rpx;
}
.form-label {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 10rpx;
  display: block;
}
.form-input {
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 0 24rpx;
  height: 76rpx;
  line-height: 76rpx;
  font-size: 28rpx;
  color: #303030;
}
.form-textarea {
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 28rpx;
  color: #303030;
  width: 100%;
  min-height: 120rpx;
  line-height: 1.7;
  box-sizing: border-box;
}
.form-textarea.numbers {
  font-family: 'Courier New', monospace;
  font-size: 32rpx;
  letter-spacing: 4rpx;
}
.peg-hints {
  font-size: 22rpx;
  color: #667eea;
  display: block;
  margin-top: 10rpx;
  line-height: 1.6;
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
