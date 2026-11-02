<template>
  <div class="word-book-page">
    <header class="book-header">
      <div>
        <h2>词图闯关</h2>
        <p>一本书是一个学习维度，章是主题，页是一个记忆单元；用法：单词页筛选（如词根 old）→ 生成学习页 → 在记忆页逐词标记，词库单词不会被改动。</p>
      </div>
      <div class="header-actions">
        <el-tag v-if="store.dueCount" type="warning" effect="plain" class="due-tag" @click="scrollToDue">
          今日到期 {{ store.dueCount }} 篇
        </el-tag>
        <el-button type="primary" @click="createBook">新建书</el-button>
      </div>
    </header>

    <div v-loading="store.loading" class="book-body">
      <section v-if="store.duePages.length" class="due-section">
        <h3>今天该复习</h3>
        <div class="due-list">
          <el-tag v-for="page in store.duePages" :key="page._id" class="due-item" effect="light"
                  @click="openPage(page._id)">
            {{ page.name }} · {{ page.words.length }} 词
          </el-tag>
        </div>
      </section>

      <el-empty v-if="!store.loading && !store.sortedBooks.length"
                description="还没有书，新建一本，再从单词页的筛选结果生成学习页">
        <el-button type="primary" @click="createBook">新建书</el-button>
      </el-empty>

      <div v-else class="book-grid">
        <article v-for="book in store.sortedBooks" :key="book._id" class="book-card" @click="openBook(book._id)">
          <div class="card-topline">
            <span class="card-order">书</span>
            <el-dropdown trigger="click" @command="(cmd: string) => onBookCommand(cmd, book)">
              <span class="more" @click.stop>⋯</span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item command="rename">重命名</el-dropdown-item>
                  <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <h3>{{ book.name }}</h3>
          <p class="card-meta">{{ summaryOf(book._id) }}</p>
          <el-progress :percentage="progressOf(book._id)" :stroke-width="8"/>
          <div class="card-actions">
            <el-button text type="primary" size="small">进入 →</el-button>
          </div>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWordBookStore } from '@/stores/wordBook'
import { seedWordBookSamples } from '@/utils/wordbook-seed'
import type { WordBookBook } from '@/types/word-book'

const router = useRouter()
const store = useWordBookStore()

onMounted(async () => {
  try {
    await seedWordBookSamples()
    await store.loadAll(true)
  } catch {
    ElMessage.error('词图数据读取失败')
  }
})

function pagesOfBook(bookId: string) {
  const chapterIds = new Set(store.chaptersOf(bookId).map(chapter => chapter._id))
  return store.pages.filter(page => chapterIds.has(page.chapterId))
}

function summaryOf(bookId: string): string {
  const chapters = store.chaptersOf(bookId).length
  const pages = pagesOfBook(bookId)
  const done = pages.filter(page => page.completedAt).length
  return `${chapters} 章 · ${pages.length} 页 · 已过关 ${done} 页`
}

function progressOf(bookId: string): number {
  const pages = pagesOfBook(bookId)
  if (!pages.length) return 0
  return Math.round(pages.filter(page => page.completedAt).length / pages.length * 100)
}

function openBook(bookId: string) {
  router.push(`/word-book/${bookId}`)
}

function openPage(pageId: string) {
  router.push(`/word-book/page/${pageId}`)
}

function scrollToDue() {
  document.querySelector('.due-section')?.scrollIntoView({ behavior: 'smooth' })
}

async function createBook() {
  try {
    const { value } = await ElMessageBox.prompt('给这本书起个名字，如「四级词根」', '新建书', {
      inputValue: '我的词根书',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
    })
    const book = await store.createBook(String(value || '').trim())
    router.push(`/word-book/${book._id}`)
  } catch { /* 取消 */ }
}

async function onBookCommand(command: string, book: WordBookBook) {
  if (command === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('新的书名', '重命名', {
        inputValue: book.name,
        inputPattern: /\S+/,
        inputErrorMessage: '名称不能为空',
      })
      await store.renameBook(book._id, String(value || '').trim())
      ElMessage.success('已重命名')
    } catch { /* 取消 */ }
    return
  }
  try {
    await ElMessageBox.confirm(`删除「${book.name}」及其下所有章和页？原词库中的单词不会删除。`, '删除书', { type: 'warning' })
  } catch {
    return
  }
  const result = await store.deleteBook(book._id)
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
    margin: 0;
    color: var(--utools-text-primary);
    font-size: 20px;
  }

  p {
    margin: 6px 0 0;
    color: var(--utools-text-tertiary);
    font-size: 12px;
    line-height: 1.6;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.due-tag {
  cursor: pointer;
}

.book-body {
  max-width: 960px;
  min-height: 200px;
  margin: 0 auto;
}

.due-section {
  margin-bottom: 16px;

  h3 {
    margin: 0 0 8px;
    color: var(--utools-text-secondary);
    font-size: 13px;
    font-weight: 600;
  }
}

.due-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.due-item {
  cursor: pointer;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
}

.book-card {
  padding: 16px;
  cursor: pointer;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 10px;
  transition: border-color 0.2s, transform 0.2s;

  &:hover {
    border-color: var(--utools-primary);
    transform: translateY(-2px);
  }

  h3 {
    margin: 12px 0 6px;
    color: var(--utools-text-primary);
    font-size: 18px;
  }
}

.card-topline,
.card-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.card-order {
  color: var(--utools-primary);
  font-size: 12px;
  font-weight: 600;
}

.more {
  color: var(--utools-text-tertiary);
  cursor: pointer;
  padding: 0 4px;
}

.card-meta {
  margin: 0 0 12px;
  color: var(--utools-text-secondary);
  font-size: 13px;
}

@media (max-width: 640px) {
  .book-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
