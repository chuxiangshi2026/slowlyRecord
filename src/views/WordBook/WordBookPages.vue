<template>
  <div class="word-collection-page">
    <header class="collection-header">
      <div>
        <h2>{{ chapter?.name || '章节' }}</h2>
        <p>{{ pages.length }} 个学习页；点击卡片查看，点击右上角管理本页。</p>
      </div>
      <el-button type="primary" @click="addPage">＋ 添加学习页</el-button>
    </header>

    <div v-loading="store.loading" class="page-body">
      <el-empty v-if="!store.loading && !pages.length"
                description="这一章还没有学习页，可以直接创建并添加单词。">
        <el-button type="primary" @click="addPage">添加学习页</el-button>
      </el-empty>

      <div v-else class="page-list">
        <article v-for="page in pages" :key="page._id" class="page-card" role="link" tabindex="0"
                 :class="{ due: isPageDue(page) }" @click="openPage(page._id)"
                 @keydown.enter="openPage(page._id)" @keydown.space.prevent="openPage(page._id)">
          <div class="page-topline">
            <span class="page-order">第 {{ page.order }} 页</span>
            <el-dropdown trigger="click" @command="(cmd: string) => onPageCommand(cmd, page)">
              <button type="button" class="more" aria-label="更多操作" @click.stop>⋯</button>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <h3>{{ page.name }}</h3>
          <p class="word-preview">{{ page.words.length ? preview(page.words.map(word => word.text)) : '空白学习页，点击进入添加单词' }}</p>
          <div class="page-meta">
            <span>{{ page.words.length }} 词</span>
            <span :class="statusClass(page)">{{ statusOf(page) }}</span>
          </div>
        </article>
      </div>
    </div>
    <WordBookPageCreateDialog v-model="pageCreateVisible" :book-id="bookId" :chapter-id="chapterId"
                              @created="onPageCreated"/>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWordBookStore } from '@/stores/wordBook'
import { formatDueLabel, hasPageContentUpdate, isPageDue } from '@/utils/word-book'
import WordBookPageCreateDialog from './WordBookPageCreateDialog.vue'
import type { WordBookPage } from '@/types/word-book'

const route = useRoute()
const router = useRouter()
const store = useWordBookStore()

const bookId = computed(() => String(route.params.bookId || ''))
const chapterId = computed(() => String(route.params.chapterId || ''))
const chapter = computed(() => store.getChapter(chapterId.value))
const pages = computed(() => store.pagesOf(chapterId.value))
const pageCreateVisible = ref(false)

onMounted(async () => {
  try {
    await store.loadAll()
  } catch {
    ElMessage.error('词集数据读取失败')
  }
})

function preview(words: string[]): string {
  return words.slice(0, 6).join(' · ') + (words.length > 6 ? ' …' : '')
}

function statusOf(page: WordBookPage): string {
  if (isPageDue(page)) return '今天到期'
  if (hasPageContentUpdate(page)) return '内容有更新'
  if (page.lastRound || page.completedAt) return formatDueLabel(page.nextReviewAt)
  if (page.readAt) return '已读'
  return '未学习'
}

function statusClass(page: WordBookPage): string {
  if (isPageDue(page)) return 'due-text'
  if (hasPageContentUpdate(page)) return 'updated-text'
  if (page.lastRound || page.completedAt || page.readAt) return 'ok-text'
  return ''
}

function openPage(pageId: string) {
  router.push(`/word-book/page/${pageId}`)
}

function addPage() {
  pageCreateVisible.value = true
}

function onPageCreated(pageId: string) {
  router.push({ path: `/word-book/page/${pageId}`, query: { addWord: '1' } })
}

async function prepareBookEdit(): Promise<boolean> {
  const result = await store.claimSampleBook(bookId.value)
  if (!result.ok) ElMessage.error(result.message || '示例转换失败')
  return result.ok
}

async function onPageCommand(command: string, page: WordBookPage) {
  if (command === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('新的学习页名称', '重命名', {
        inputValue: page.name,
        inputPattern: /\S+/,
        inputErrorMessage: '名称不能为空',
      })
      if (!await prepareBookEdit()) return
      const result = await store.renamePage(page._id, String(value || '').trim())
      if (result.ok) ElMessage.success('已重命名')
      else ElMessage.error(result.message || '重命名失败')
    } catch { /* 取消 */ }
    return
  }
  try {
    await ElMessageBox.confirm(`删除「${page.name}」？原词库中的单词不会删除。`, '删除学习页', { type: 'warning' })
  } catch {
    return
  }
  if (!await prepareBookEdit()) return
  const result = await store.deletePage(page._id)
  if (result.ok) ElMessage.success('已删除')
  else ElMessage.error(result.message || '删除失败')
}
</script>

<style scoped lang="scss">
.word-collection-page {
  min-height: 100vh;
  padding: 20px 4%;
  box-sizing: border-box;
  background: var(--utools-bg-secondary);
}

.collection-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 1080px;
  margin: 0 auto 16px;

  h2 {
    margin: 0;
    color: var(--utools-text-primary);
    font-size: 22px;
  }

  p {
    margin: 6px 0 0;
    color: var(--utools-text-tertiary);
    font-size: 12px;
  }
}

.page-body {
  max-width: 1080px;
  min-height: 180px;
  margin: 0 auto;
}

.page-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.page-card {
  padding: 14px;
  cursor: pointer;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 12px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--utools-primary);
  }

  &.due {
    border-color: var(--utools-warning);
  }

  h3 {
    margin: 10px 0 6px;
    color: var(--utools-text-primary);
    font-size: 16px;
  }
}

.page-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.page-order {
  color: var(--utools-primary);
  font-size: 12px;
  font-weight: 600;
}

.more {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 24px;
  padding: 0;
  cursor: pointer;
  color: var(--utools-text-secondary);
  font-size: 20px;
  line-height: 1;
  background: transparent;
  border: 0;
  border-radius: 6px;

  &:hover,
  &:focus-visible {
    color: var(--utools-primary);
    background: var(--utools-bg-hover);
    outline: none;
  }
}

.word-preview {
  margin: 0 0 10px;
  color: var(--utools-text-tertiary);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.page-meta {
  display: flex;
  gap: 10px;
  color: var(--utools-text-secondary);
  font-size: 12px;
}

.page-card:focus-visible {
  outline: 2px solid var(--utools-primary);
  outline-offset: 2px;
}

.ok-text {
  color: var(--utools-success);
}

.due-text {
  color: var(--utools-warning);
}

.updated-text {
  color: var(--utools-primary);
}
</style>
