<template>
  <div class="word-book-page">
    <header class="book-header">
      <div>
        <el-button text @click="goBooks">← 书列表</el-button>
        <h2>{{ book?.name || '书' }}</h2>
        <p>章是主题（一个词根、一个音标）；每章下可以放多页。</p>
      </div>
      <el-button type="primary" @click="createChapter">新建章</el-button>
    </header>

    <div v-loading="store.loading" class="chapter-list">
      <el-empty v-if="!store.loading && !chapters.length" description="这本书还没有章，先新建一个主题">
        <el-button type="primary" @click="createChapter">新建章</el-button>
      </el-empty>

      <article v-for="chapter in chapters" :key="chapter._id" class="chapter-card">
        <div class="chapter-topline">
          <span class="chapter-order">章</span>
          <el-dropdown trigger="click" @command="(cmd: string) => onChapterCommand(cmd, chapter)">
            <span class="more" @click.stop>⋯</span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item command="levelSize">每关页数</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <h3 @click="openChapter(chapter._id)">{{ chapter.name }}</h3>
        <p class="card-meta">{{ summaryOf(chapter._id) }}</p>
        <el-progress :percentage="progressOf(chapter._id)" :stroke-width="8"/>
        <div class="chapter-actions">
          <el-button text type="primary" size="small" @click="openChapter(chapter._id)">进入章节 →</el-button>
          <el-button text size="small" @click="addPage(chapter._id)">＋ 添加页</el-button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWordBookStore } from '@/stores/wordBook'
import type { WordBookChapter } from '@/types/word-book'

const route = useRoute()
const router = useRouter()
const store = useWordBookStore()

const bookId = computed(() => String(route.params.bookId || ''))
const book = computed(() => store.getBook(bookId.value))
const chapters = computed(() => store.chaptersOf(bookId.value))

onMounted(async () => {
  try {
    await store.loadAll()
    if (!store.getBook(bookId.value)) {
      await store.loadAll(true)
    }
  } catch {
    ElMessage.error('词图数据读取失败')
  }
})

function pagesOf(chapterId: string) {
  return store.pagesOf(chapterId)
}

function summaryOf(chapterId: string): string {
  const pages = pagesOf(chapterId)
  const done = pages.filter(page => page.completedAt).length
  return `${pages.length} 页 · 已过关 ${done} 页`
}

function progressOf(chapterId: string): number {
  const pages = pagesOf(chapterId)
  if (!pages.length) return 0
  return Math.round(pages.filter(page => page.completedAt).length / pages.length * 100)
}

function goBooks() {
  router.push('/word-book')
}

function openChapter(chapterId: string) {
  router.push(`/word-book/${bookId.value}/${chapterId}`)
}

function addPage(chapterId: string) {
  router.push({ path: '/word', query: { filter: '1', bookId: bookId.value, chapterId } })
}

async function createChapter() {
  try {
    const { value } = await ElMessageBox.prompt('给这个主题起个名字，如「词根 old」', '新建章', {
      inputValue: '新主题',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
    })
    const chapter = await store.createChapter(bookId.value, String(value || '').trim())
    router.push(`/word-book/${bookId.value}/${chapter._id}`)
  } catch { /* 取消 */ }
}

async function onChapterCommand(command: string, chapter: WordBookChapter) {
  if (command === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('新的章名', '重命名', {
        inputValue: chapter.name,
        inputPattern: /\S+/,
        inputErrorMessage: '名称不能为空',
      })
      await store.renameChapter(chapter._id, String(value || '').trim())
      ElMessage.success('已重命名')
    } catch { /* 取消 */ }
    return
  }
  if (command === 'levelSize') {
    try {
      const { value } = await ElMessageBox.prompt('多少页算一关', '关卡设置', {
        inputValue: String(chapter.levelSize || 5),
        inputPattern: /^\d+$/,
        inputErrorMessage: '请输入正整数',
      })
      await store.setChapterLevelSize(chapter._id, Math.max(1, Number(value) || 5))
      ElMessage.success('已更新')
    } catch { /* 取消 */ }
    return
  }
  try {
    await ElMessageBox.confirm(`删除「${chapter.name}」及其下所有页？原词库中的单词不会删除。`, '删除章', { type: 'warning' })
  } catch {
    return
  }
  const result = await store.deleteChapter(chapter._id)
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

.chapter-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
  gap: 14px;
  max-width: 960px;
  min-height: 180px;
  margin: 0 auto;
}

.chapter-card {
  padding: 16px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 10px;

  h3 {
    margin: 12px 0 6px;
    color: var(--utools-text-primary);
    font-size: 17px;
    cursor: pointer;
  }
}

.chapter-topline,
.chapter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.chapter-order {
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
</style>
