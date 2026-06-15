<template>
  <view class="edit-page">
    <view class="form">
      <view class="form-row">
        <text class="form-label">标题 *</text>
        <input class="form-input" v-model="form.title" placeholder="如：静夜思" />
      </view>

      <view class="form-row">
        <text class="form-label">作者</text>
        <input class="form-input" v-model="form.author" placeholder="如：李白" />
      </view>

      <view class="form-row two-col">
        <view class="form-col">
          <text class="form-label">朝代</text>
          <input class="form-input" v-model="form.dynasty" placeholder="如：唐" />
        </view>
        <view class="form-col">
          <text class="form-label">年份</text>
          <input class="form-input" type="number" v-model="form.year" placeholder="如：742" />
        </view>
      </view>

      <view class="form-row">
        <text class="form-label">位置</text>
        <input class="form-input" v-model="form.location" placeholder="如：扬州" />
      </view>

      <view class="form-row">
        <text class="form-label">类型</text>
        <view class="category-options">
          <view
            v-for="opt in categoryOptions"
            :key="opt.value"
            class="category-chip"
            :class="{ active: form.category === opt.value }"
            @click="form.category = opt.value"
          >
            {{ opt.label }}
          </view>
        </view>
      </view>

      <view class="form-row">
        <text class="form-label">标签（逗号分隔）</text>
        <input class="form-input" v-model="tagsInput" placeholder="如：唐诗,思乡,必背" />
      </view>

      <view class="form-row">
        <text class="form-label">正文 *</text>
        <textarea
          class="form-textarea"
          v-model="form.content"
          placeholder="粘贴或输入文本内容..."
          auto-height
        />
      </view>

      <view class="form-row">
        <text class="form-label">出处（可选）</text>
        <input class="form-input" v-model="form.source" placeholder="如：《李太白集》" />
      </view>
    </view>

    <view class="actions">
      <button class="action-btn secondary" @click="onCancel">取消</button>
      <button class="action-btn primary" @click="onSubmit">{{ isEdit ? '保存' : '添加' }}</button>
      <button v-if="isEdit" class="action-btn danger" @click="onDelete">删除</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useTextMemory } from '@/stores/useTextMemory'
import type { MobileTextArticle } from '@/stores/useUtils/types'

const store = useTextMemory()

const editingId = ref<string>('')
const isEdit = computed(() => !!editingId.value)

const categoryOptions: { value: 'poetry' | 'idiom' | 'article' | undefined; label: string }[] = [
  { value: undefined, label: '未分类' },
  { value: 'poetry', label: '诗词' },
  { value: 'idiom', label: '成语' },
  { value: 'article', label: '文章' },
]

const form = ref<{
  title: string
  author: string
  dynasty: string
  year: string
  location: string
  category: 'poetry' | 'idiom' | 'article' | undefined
  content: string
  source: string
}>({
  title: '',
  author: '',
  dynasty: '',
  year: '',
  location: '',
  category: undefined,
  content: '',
  source: '',
})
const tagsInput = ref('')

onLoad((opt: any) => {
  store.load()
  if (opt?.id) {
    editingId.value = decodeURIComponent(opt.id)
    const article = store.articles.find((a) => a._id === editingId.value)
    if (article) {
      form.value.title = article.title
      form.value.author = article.author || ''
      form.value.dynasty = article.dynasty || ''
      form.value.year = article.year != null ? String(article.year) : ''
      form.value.location = article.location || ''
      form.value.category = article.category
      form.value.content = article.content
      form.value.source = article.source || ''
      tagsInput.value = (article.tags || []).join(', ')
      uni.setNavigationBarTitle({ title: '编辑文章' })
    }
  } else {
    uni.setNavigationBarTitle({ title: '添加文章' })
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
  const content = form.value.content.trim()
  if (!title) {
    uni.showToast({ title: '请填写标题', icon: 'none' })
    return
  }
  if (!content) {
    uni.showToast({ title: '请填写正文', icon: 'none' })
    return
  }

  const yearNum = form.value.year ? Number(form.value.year) : undefined
  const patch: Partial<MobileTextArticle> = {
    title,
    author: form.value.author.trim() || undefined,
    dynasty: form.value.dynasty.trim() || undefined,
    year: Number.isFinite(yearNum) ? yearNum : undefined,
    location: form.value.location.trim() || undefined,
    category: form.value.category,
    content,
    source: form.value.source.trim() || undefined,
    tags: parseTags(),
  }

  if (isEdit.value) {
    store.updateArticle(editingId.value, patch)
    uni.showToast({ title: '已保存', icon: 'success' })
  } else {
    store.addArticle({ title, content, ...patch })
    uni.showToast({ title: '已添加', icon: 'success' })
  }
  setTimeout(() => uni.navigateBack(), 300)
}

function onDelete() {
  uni.showModal({
    title: '删除文章',
    content: '确定删除这篇文章吗？',
    confirmText: '删除',
    confirmColor: '#e64340',
    success: (res) => {
      if (res.confirm) {
        store.deleteArticle(editingId.value)
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
.edit-page {
  min-height: 100vh;
  background: #f5f6fa;
  padding: 24rpx 24rpx 200rpx;
}

.form {
  background: #fff;
  border-radius: 16rpx;
  padding: 24rpx;
}

.form-row {
  margin-bottom: 28rpx;
}

.form-row.two-col {
  display: flex;
  gap: 16rpx;
}

.form-col {
  flex: 1;
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
  min-height: 240rpx;
  line-height: 1.8;
  box-sizing: border-box;
}

.category-options {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}

.category-chip {
  padding: 12rpx 28rpx;
  background: #f7f8fa;
  border-radius: 30rpx;
  font-size: 26rpx;
  color: #666;
  border: 1rpx solid transparent;
}

.category-chip.active {
  background: #e8f5e9;
  color: #2e7d32;
  border-color: #43a047;
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
  background: #43a047;
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
