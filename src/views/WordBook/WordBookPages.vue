<template>
  <div class="word-book-page">
    <header class="book-header">
      <div>
        <el-button text @click="goChapters">← {{ book?.name || '章列表' }}</el-button>
        <h2>{{ chapter?.name || '章' }}</h2>
        <p v-if="pages.length">
          {{ pages.length }} 页 · 每 {{ levelSize }} 页一关 · 已达成 {{ chapter?.levels?.length || 0 }} 关
        </p>
        <p v-else>还没有页，去单词页筛选后生成</p>
      </div>
      <el-button type="primary" @click="addPage">＋ 添加页</el-button>
    </header>

    <div v-loading="store.loading" class="page-body">
      <el-empty v-if="!store.loading && !pages.length"
                description="这一章还没有学习页：在单词页设置筛选条件，点「生成学习页」并选到这一章">
        <el-button type="primary" @click="addPage">去单词页生成</el-button>
      </el-empty>

      <section v-for="group in levelGroups" :key="group.index" class="level-group">
        <div class="level-head">
          <span class="level-title">第 {{ group.index }} 关</span>
          <el-tag v-if="group.completed" size="small" type="success">已达成</el-tag>
          <span v-else class="level-meta">{{ completedIn(group) }} / {{ group.pages.length }} 页</span>
        </div>
        <div class="page-grid">
          <article v-for="page in group.pages" :key="page._id" class="page-card"
                   :class="{ completed: !!page.completedAt, due: isPageDue(page) }"
                   @click="openPage(page._id)">
            <div class="page-topline">
              <span class="page-order">P{{ page.order }}</span>
              <el-dropdown trigger="click" @command="(cmd: string) => onPageCommand(cmd, page)">
                <span class="more" @click.stop>⋯</span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item command="rename">重命名</el-dropdown-item>
                    <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <h3>{{ page.name }}</h3>
            <p class="word-preview">{{ preview(page.words.map(word => word.text)) }}</p>
            <div class="page-meta">
              <span>{{ page.words.length }} 词</span>
              <span v-if="page.completedAt" class="ok">已过关</span>
              <span v-else-if="isPageDue(page)" class="due">今天到期</span>
              <span v-else>{{ dueLabel(page.nextReviewAt) }}</span>
            </div>
            <el-button size="small" type="primary" plain>{{ page.completedAt ? '再记一遍' : '开始记忆' }}</el-button>
          </article>
        </div>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWordBookStore } from '@/stores/wordBook'
import { formatDueLabel, groupPagesIntoLevels, isPageDue } from '@/utils/word-book'
import type { WordBookPage } from '@/types/word-book'

const route = useRoute()
const router = useRouter()
const store = useWordBookStore()

const bookId = computed(() => String(route.params.bookId || ''))
const chapterId = computed(() => String(route.params.chapterId || ''))
const book = computed(() => store.getBook(bookId.value))
const chapter = computed(() => store.getChapter(chapterId.value))
const pages = computed(() => store.pagesOf(chapterId.value))
const levelSize = computed(() => chapter.value?.levelSize || 5)
const levelGroups = computed(() => groupPagesIntoLevels(pages.value, levelSize.value))

onMounted(async () => {
  try {
    await store.loadAll()
  } catch {
    ElMessage.error('词图数据读取失败')
  }
})

function preview(words: string[]): string {
  return words.slice(0, 6).join(' · ') + (words.length > 6 ? ' …' : '')
}

function completedIn(group: { pages: WordBookPage[] }): number {
  return group.pages.filter(page => page.completedAt).length
}

function dueLabel(nextReviewAt: number): string {
  return formatDueLabel(nextReviewAt)
}

function goChapters() {
  router.push(`/word-book/${bookId.value}`)
}

function openPage(pageId: string) {
  router.push(`/word-book/page/${pageId}`)
}

function addPage() {
  router.push({ path: '/word', query: { filter: '1', bookId: bookId.value, chapterId: chapterId.value } })
}

async function onPageCommand(command: string, page: WordBookPage) {
  if (command === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('新的页名', '重命名', {
        inputValue: page.name,
        inputPattern: /\S+/,
        inputErrorMessage: '名称不能为空',
      })
      await store.renamePage(page._id, String(value || '').trim())
      ElMessage.success('已重命名')
    } catch { /* 取消 */ }
    return
  }
  try {
    await ElMessageBox.confirm(`删除「${page.name}」？原词库中的单词不会删除。`, '删除页', { type: 'warning' })
  } catch {
    return
  }
  const result = await store.deletePage(page._id)
  if (result.ok) ElMessage.success('已删除')
  else ElMessage.error(result.message || '删除失败')
}
</script>

<style scoped lang="scss">
.word-book-page {
  min-height: 100vh;
  padding: 20px 4%;
  box-sizing: border-box;
  background: var(--utools-bg-secondary);
}

.book-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  max-width: 960px;
  margin: 0 auto 16px;

  h2 {
    margin: 6px 0 0;
    color: var(--utools-text-primary);
    font-size: 20px;
  }

  p {
    margin: 6px 0 0;
    color: var(--utools-text-tertiary);
    font-size: 12px;
  }
}

.page-body {
  max-width: 960px;
  min-height: 180px;
  margin: 0 auto;
}

.level-group {
  margin-bottom: 18px;
}

.level-head {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;
}

.level-title {
  color: var(--utools-text-secondary);
  font-size: 13px;
  font-weight: 600;
}

.level-meta {
  color: var(--utools-text-tertiary);
  font-size: 12px;
}

.page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 12px;
}

.page-card {
  padding: 14px;
  cursor: pointer;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 10px;
  transition: border-color 0.2s, transform 0.2s;

  &:hover {
    border-color: var(--utools-primary);
    transform: translateY(-2px);
  }

  &.completed {
    border-color: var(--utools-success);
  }

  &.due {
    box-shadow: 0 0 0 1px var(--utools-warning);
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
  color: var(--utools-text-tertiary);
  cursor: pointer;
  padding: 0 4px;
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
  margin-bottom: 10px;
  color: var(--utools-text-secondary);
  font-size: 12px;

  .ok {
    color: var(--utools-success);
  }

  .due {
    color: var(--utools-warning);
  }
}
</style>
