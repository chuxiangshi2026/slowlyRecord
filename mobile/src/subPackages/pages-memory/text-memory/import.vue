<template>
  <view class="import-page">
    <!-- Tab 切换 -->
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

    <!-- 粘贴批量 -->
    <view v-if="activeTab === 'paste'" class="tab-content">
      <view class="hint-box">
        <text class="hint-title">批量粘贴格式</text>
        <text class="hint-desc">每篇之间用三个连字符 (---) 分隔；每篇可在开头写「标题：」「作者：」「标签：」「来源：」等元信息，下面接正文。简单粘贴一段诗词也会作为单篇导入。</text>
        <text class="hint-example">{{ examplePaste }}</text>
      </view>

      <textarea
        class="paste-area"
        v-model="pasteContent"
        placeholder="粘贴文本内容..."
        auto-height
      />

      <button class="action-btn primary" @click="handlePasteImport">
        导入（{{ pasteCount }} 篇）
      </button>
    </view>

    <!-- 诗词库 -->
    <view v-if="activeTab === 'poetry'" class="tab-content">
      <view class="filter-row">
        <picker
          mode="selector"
          :range="dynastyLabels"
          :value="dynastyIndex"
          @change="onDynastyChange"
        >
          <view class="picker-display">
            朝代：{{ dynastyLabels[dynastyIndex] }}
          </view>
        </picker>
        <input
          class="filter-input"
          v-model="poetryKeyword"
          placeholder="搜索诗词/作者"
        />
      </view>

      <view class="loading" v-if="poetryLoading">
        <text>加载中...</text>
      </view>

      <view v-else class="lib-toolbar">
        <view class="select-info">
          已选 {{ selectedPoetryIds.size }} / {{ filteredPoetry.length }}
        </view>
        <text class="select-all" @click="togglePoetryAll">
          {{ allPoetrySelected ? '取消全选' : '全选当前' }}
        </text>
      </view>

      <scroll-view scroll-y class="lib-scroll">
        <view
          v-for="poem in filteredPoetry"
          :key="poem.id"
          class="lib-item"
          :class="{ selected: selectedPoetryIds.has(poem.id) }"
          @click="togglePoetry(poem.id)"
        >
          <view class="lib-item-header">
            <text class="lib-item-title">{{ poem.title }}</text>
            <text class="lib-item-author">{{ poem.dynasty }} · {{ poem.author }}</text>
          </view>
          <text class="lib-item-content">{{ shortContent(poem.content) }}</text>
          <view class="lib-item-tags" v-if="poem.tags.length > 0">
            <text v-for="tag in poem.tags.slice(0, 3)" :key="tag" class="lib-mini-tag">
              {{ tag }}
            </text>
          </view>
        </view>
      </scroll-view>

      <button
        class="action-btn primary"
        :disabled="selectedPoetryIds.size === 0"
        @click="handleImportPoetry"
      >
        导入选中（{{ selectedPoetryIds.size }} 首）
      </button>
    </view>

    <!-- 成语库 -->
    <view v-if="activeTab === 'idiom'" class="tab-content">
      <view class="filter-row">
        <picker
          mode="selector"
          :range="idiomCategoryLabels"
          :value="idiomCategoryIndex"
          @change="onIdiomCategoryChange"
        >
          <view class="picker-display">
            分类：{{ idiomCategoryLabels[idiomCategoryIndex] }}
          </view>
        </picker>
        <input
          class="filter-input"
          v-model="idiomKeyword"
          placeholder="搜索成语/释义"
        />
      </view>

      <view class="loading" v-if="idiomLoading">
        <text>加载中...</text>
      </view>

      <view v-else class="lib-toolbar">
        <view class="select-info">
          已选 {{ selectedIdiomIds.size }} / {{ filteredIdioms.length }}
        </view>
        <text class="select-all" @click="toggleIdiomAll">
          {{ allIdiomsSelected ? '取消全选' : '全选当前' }}
        </text>
      </view>

      <scroll-view scroll-y class="lib-scroll">
        <view
          v-for="idiom in filteredIdioms"
          :key="idiom.id"
          class="lib-item"
          :class="{ selected: selectedIdiomIds.has(idiom.id) }"
          @click="toggleIdiom(idiom.id)"
        >
          <view class="lib-item-header">
            <text class="lib-item-title">{{ idiom.title }}</text>
            <text class="lib-item-author">{{ idiom.category }}</text>
          </view>
          <text class="lib-item-content">{{ idiom.meaning }}</text>
          <text v-if="idiom.source" class="lib-item-extra">出处：{{ idiom.source }}</text>
        </view>
      </scroll-view>

      <button
        class="action-btn primary"
        :disabled="selectedIdiomIds.size === 0"
        @click="handleImportIdiom"
      >
        导入选中（{{ selectedIdiomIds.size }} 条）
      </button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useTextMemory } from '@/stores/useTextMemory'
import type { MobileTextArticle } from '@/stores/useUtils/types'
import {
  loadPoetryByDynasty,
  loadAllIdioms,
  DYNASTIES,
  IDIOM_CATEGORIES,
  type MobilePoetryItem,
  type MobileIdiomItem,
} from './library'

const store = useTextMemory()
store.load()

const tabs = [
  { value: 'paste', label: '粘贴批量' },
  { value: 'poetry', label: '诗词库' },
  { value: 'idiom', label: '成语库' },
]
const activeTab = ref<'paste' | 'poetry' | 'idiom'>('paste')

// ============ 粘贴批量 ============

const examplePaste = `标题：静夜思
作者：李白
标签：唐诗,思乡
---
床前明月光，疑是地上霜。
举头望明月，低头思故乡。
---
标题：登鹳雀楼
作者：王之涣
---
白日依山尽，黄河入海流。
欲穷千里目，更上一层楼。`

const pasteContent = ref('')

const pasteCount = computed(() => parsePaste(pasteContent.value).length)

function parsePaste(text: string): Partial<MobileTextArticle>[] {
  if (!text.trim()) return []
  const sections = text
    .split(/-{3,}/g)
    .map((s) => s.trim())
    .filter(Boolean)
  const articles: Partial<MobileTextArticle>[] = []
  for (const section of sections) {
    const lines = section.split('\n')
    const meta: Record<string, string> = {}
    const contentLines: string[] = []
    for (const line of lines) {
      const m = line.match(/^(标题|作者|朝代|标签|来源|位置)[：:]\s*(.+)$/)
      if (m) {
        meta[m[1]] = m[2].trim()
      } else {
        contentLines.push(line)
      }
    }
    const content = contentLines.join('\n').trim()
    if (!content && !meta['标题']) continue
    articles.push({
      title: meta['标题'] || (content.split('\n')[0] || '').slice(0, 20) || '未命名',
      author: meta['作者'],
      dynasty: meta['朝代'],
      source: meta['来源'],
      location: meta['位置'],
      tags: meta['标签'] ? meta['标签'].split(/[,，]/).map((t) => t.trim()).filter(Boolean) : [],
      content,
    })
  }
  return articles
}

function handlePasteImport() {
  const list = parsePaste(pasteContent.value)
  if (list.length === 0) {
    uni.showToast({ title: '没有可导入的内容', icon: 'none' })
    return
  }
  const created = store.addArticles(
    list.map((a) => ({
      title: a.title || '未命名',
      content: a.content || '',
      author: a.author,
      dynasty: a.dynasty,
      source: a.source,
      location: a.location,
      tags: a.tags || [],
    })),
  )
  uni.showToast({ title: `已导入 ${created.length} 篇`, icon: 'success' })
  pasteContent.value = ''
  setTimeout(() => uni.navigateBack(), 600)
}

// ============ 诗词库 ============

const dynastyLabels = ['全部', ...DYNASTIES.map((d) => d.name)]
const dynastyIndex = ref(0)
const poetryKeyword = ref('')
const poetryAll = ref<MobilePoetryItem[]>([])
const poetryLoading = ref(false)
const selectedPoetryIds = ref<Set<string>>(new Set())

function onDynastyChange(e: any) {
  dynastyIndex.value = e.detail.value
}

async function loadPoetry() {
  if (poetryAll.value.length > 0) return
  poetryLoading.value = true
  try {
    const lists = await Promise.all(DYNASTIES.map((d) => loadPoetryByDynasty(d.code)))
    poetryAll.value = lists.flat()
  } catch (e) {
    uni.showToast({ title: '加载诗词库失败', icon: 'none' })
  } finally {
    poetryLoading.value = false
  }
}

watch(activeTab, (val) => {
  if (val === 'poetry') loadPoetry()
  if (val === 'idiom') loadIdioms()
})

const filteredPoetry = computed(() => {
  let list = poetryAll.value
  const dCode = dynastyIndex.value > 0 ? DYNASTIES[dynastyIndex.value - 1].code : ''
  if (dCode) list = list.filter((p) => p.dynastyCode === dCode)
  if (poetryKeyword.value.trim()) {
    const kw = poetryKeyword.value.trim().toLowerCase()
    list = list.filter(
      (p) =>
        p.title.toLowerCase().includes(kw) ||
        p.author.toLowerCase().includes(kw) ||
        p.content.toLowerCase().includes(kw),
    )
  }
  return list
})

const allPoetrySelected = computed(
  () =>
    filteredPoetry.value.length > 0 &&
    filteredPoetry.value.every((p) => selectedPoetryIds.value.has(p.id)),
)

function togglePoetry(id: string) {
  const next = new Set(selectedPoetryIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedPoetryIds.value = next
}

function togglePoetryAll() {
  const next = new Set(selectedPoetryIds.value)
  if (allPoetrySelected.value) {
    filteredPoetry.value.forEach((p) => next.delete(p.id))
  } else {
    filteredPoetry.value.forEach((p) => next.add(p.id))
  }
  selectedPoetryIds.value = next
}

function handleImportPoetry() {
  const picked = poetryAll.value.filter((p) => selectedPoetryIds.value.has(p.id))
  if (picked.length === 0) return
  const created = store.addArticles(
    picked.map((p) => ({
      title: p.title,
      content: p.content,
      author: p.author,
      dynasty: p.dynasty,
      location: p.location,
      source: p.source || p.dynasty,
      year: typeof p.year === 'number' ? p.year : undefined,
      tags: p.tags,
      category: 'poetry',
    })),
  )
  uni.showToast({ title: `已导入 ${created.length} 首`, icon: 'success' })
  selectedPoetryIds.value = new Set()
  setTimeout(() => uni.navigateBack(), 600)
}

// ============ 成语库 ============

const idiomCategoryLabels = ['全部', ...IDIOM_CATEGORIES]
const idiomCategoryIndex = ref(0)
const idiomKeyword = ref('')
const idiomAll = ref<MobileIdiomItem[]>([])
const idiomLoading = ref(false)
const selectedIdiomIds = ref<Set<string>>(new Set())

function onIdiomCategoryChange(e: any) {
  idiomCategoryIndex.value = e.detail.value
}

async function loadIdioms() {
  if (idiomAll.value.length > 0) return
  idiomLoading.value = true
  try {
    idiomAll.value = await loadAllIdioms()
  } catch (e) {
    uni.showToast({ title: '加载成语库失败', icon: 'none' })
  } finally {
    idiomLoading.value = false
  }
}

const filteredIdioms = computed(() => {
  let list = idiomAll.value
  const cat = idiomCategoryIndex.value > 0 ? IDIOM_CATEGORIES[idiomCategoryIndex.value - 1] : ''
  if (cat) list = list.filter((it) => it.category === cat)
  if (idiomKeyword.value.trim()) {
    const kw = idiomKeyword.value.trim().toLowerCase()
    list = list.filter(
      (it) =>
        it.title.toLowerCase().includes(kw) ||
        it.meaning.toLowerCase().includes(kw) ||
        (it.pinyin || '').toLowerCase().includes(kw),
    )
  }
  return list
})

const allIdiomsSelected = computed(
  () =>
    filteredIdioms.value.length > 0 &&
    filteredIdioms.value.every((it) => selectedIdiomIds.value.has(it.id)),
)

function toggleIdiom(id: string) {
  const next = new Set(selectedIdiomIds.value)
  if (next.has(id)) next.delete(id)
  else next.add(id)
  selectedIdiomIds.value = next
}

function toggleIdiomAll() {
  const next = new Set(selectedIdiomIds.value)
  if (allIdiomsSelected.value) {
    filteredIdioms.value.forEach((it) => next.delete(it.id))
  } else {
    filteredIdioms.value.forEach((it) => next.add(it.id))
  }
  selectedIdiomIds.value = next
}

function handleImportIdiom() {
  const picked = idiomAll.value.filter((it) => selectedIdiomIds.value.has(it.id))
  if (picked.length === 0) return
  const created = store.addArticles(
    picked.map((it) => ({
      title: it.title,
      content: [
        it.pinyin && `【拼音】${it.pinyin}`,
        `【释义】${it.meaning}`,
        it.source && `【出处】${it.source}`,
        it.story && `【典故】${it.story}`,
        it.example && `【例句】${it.example}`,
      ]
        .filter(Boolean)
        .join('\n'),
      tags: ['成语', it.category, ...it.tags].filter(Boolean),
      source: it.source || '成语库',
      location: it.location,
      category: 'idiom',
    })),
  )
  uni.showToast({ title: `已导入 ${created.length} 条`, icon: 'success' })
  selectedIdiomIds.value = new Set()
  setTimeout(() => uni.navigateBack(), 600)
}

function shortContent(content: string): string {
  const t = content.replace(/\n/g, ' ').trim()
  return t.length > 50 ? t.slice(0, 50) + '…' : t
}
</script>

<style scoped>
.import-page {
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
  color: #43a047;
  font-weight: 600;
}
.tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 30%;
  right: 30%;
  height: 4rpx;
  background: #43a047;
  border-radius: 2rpx;
}

.tab-content {
  flex: 1;
  padding: 24rpx;
  display: flex;
  flex-direction: column;
}

/* 粘贴 */
.hint-box {
  background: #fffaf0;
  border: 1rpx solid #ffe2b8;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 20rpx;
}
.hint-title {
  font-size: 26rpx;
  font-weight: 600;
  color: #e6a23c;
  display: block;
  margin-bottom: 8rpx;
}
.hint-desc {
  font-size: 24rpx;
  color: #888;
  line-height: 1.6;
  display: block;
  margin-bottom: 12rpx;
}
.hint-example {
  font-size: 22rpx;
  color: #666;
  line-height: 1.6;
  white-space: pre-line;
  display: block;
  background: #fff;
  padding: 12rpx;
  border-radius: 8rpx;
  font-family: monospace;
}
.paste-area {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  font-size: 26rpx;
  color: #303030;
  width: 100%;
  min-height: 320rpx;
  line-height: 1.7;
  box-sizing: border-box;
  margin-bottom: 24rpx;
}

/* 库类共用 */
.filter-row {
  display: flex;
  gap: 12rpx;
  margin-bottom: 16rpx;
}
.picker-display {
  background: #fff;
  border-radius: 12rpx;
  padding: 0 24rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
  color: #303030;
  min-width: 200rpx;
}
.filter-input {
  flex: 1;
  background: #fff;
  border-radius: 12rpx;
  padding: 0 24rpx;
  height: 64rpx;
  line-height: 64rpx;
  font-size: 26rpx;
  color: #303030;
}

.loading {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 26rpx;
  color: #888;
}

.lib-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8rpx 4rpx 16rpx;
  font-size: 24rpx;
}
.select-info {
  color: #888;
}
.select-all {
  color: #43a047;
}

.lib-scroll {
  flex: 1;
  margin-bottom: 20rpx;
  height: 100rpx; /* flex 兜底 */
}

.lib-item {
  background: #fff;
  border-radius: 12rpx;
  padding: 20rpx;
  margin-bottom: 12rpx;
  border: 2rpx solid transparent;
}
.lib-item.selected {
  border-color: #43a047;
  background: #f4faf5;
}
.lib-item-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 8rpx;
}
.lib-item-title {
  font-size: 28rpx;
  font-weight: 600;
  color: #303030;
}
.lib-item-author {
  font-size: 22rpx;
  color: #888;
}
.lib-item-content {
  font-size: 24rpx;
  color: #666;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.lib-item-extra {
  font-size: 22rpx;
  color: #aaa;
  display: block;
  margin-top: 6rpx;
}
.lib-item-tags {
  margin-top: 8rpx;
  display: flex;
  gap: 6rpx;
}
.lib-mini-tag {
  font-size: 20rpx;
  background: #f5f5f5;
  color: #888;
  border-radius: 4rpx;
  padding: 0 8rpx;
}

.action-btn {
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
.action-btn[disabled] {
  background: #e5e5e5;
  color: #999;
}
</style>
