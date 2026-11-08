<template>
  <div class="word-collection-page">
    <header class="collection-header">
      <div>
        <h2>{{ book?.name || '词集' }}</h2>
        <p v-if="book?.isSample">示例可直接编辑；第一次保存内容修改后归入我的词集。</p>
        <p v-else>章节是词集里的主题，每个章节下可以放多个学习页。</p>
      </div>
      <el-button type="primary" @click="createChapter">新建章节</el-button>
    </header>

    <div v-loading="store.loading" class="chapter-list">
      <el-empty v-if="!store.loading && !chapters.length" description="这本词集还没有章节，先新建一个主题">
        <el-button type="primary" @click="createChapter">新建章节</el-button>
      </el-empty>

      <article v-for="chapter in chapters" :key="chapter._id" class="chapter-card" role="link" tabindex="0"
               @click="openChapter(chapter._id)" @keydown.enter="openChapter(chapter._id)"
               @keydown.space.prevent="openChapter(chapter._id)">
        <div class="chapter-topline">
          <span class="chapter-kind">章节</span>
          <el-dropdown trigger="click" @command="(cmd: string) => onChapterCommand(cmd, chapter)">
            <button type="button" class="more" aria-label="更多操作" @click.stop>⋯</button>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="rename">重命名</el-dropdown-item>
                <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
        <h3>{{ chapter.name }}</h3>
        <p class="card-meta">{{ summaryOf(chapter._id) }}</p>
        <el-progress :percentage="progressOf(chapter._id)" :stroke-width="8"/>
        <div class="chapter-actions">
          <el-button text size="small" @click.stop="addPage(chapter._id)">＋ 添加学习页</el-button>
        </div>
      </article>
    </div>
    <WordBookPageCreateDialog v-model="pageCreateVisible" :book-id="bookId" :chapter-id="pageCreateChapterId"
                              @created="onPageCreated"/>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWordBookStore } from '@/stores/wordBook'
import { isPageDue } from '@/utils/word-book'
import WordBookPageCreateDialog from './WordBookPageCreateDialog.vue'
import type { WordBookChapter } from '@/types/word-book'

const route = useRoute()
const router = useRouter()
const store = useWordBookStore()

const bookId = computed(() => String(route.params.bookId || ''))
const book = computed(() => store.getBook(bookId.value))
const chapters = computed(() => store.chaptersOf(bookId.value))
const pageCreateVisible = ref(false)
const pageCreateChapterId = ref('')

onMounted(async () => {
  try {
    await store.loadAll()
    if (!store.getBook(bookId.value)) await store.loadAll(true)
  } catch {
    ElMessage.error('词集数据读取失败')
  }
})

function summaryOf(chapterId: string): string {
  const pages = store.pagesOf(chapterId)
  const read = pages.filter(page => page.readAt || page.lastRound || page.completedAt).length
  const due = pages.filter(page => isPageDue(page)).length
  return `${pages.length} 页 · 已读 ${read} 页${due ? ` · 待复习 ${due} 组` : ''}`
}

function progressOf(chapterId: string): number {
  const pages = store.pagesOf(chapterId)
  if (!pages.length) return 0
  const done = pages.filter(page => page.readAt || page.lastRound || page.completedAt).length
  return Math.round(done / pages.length * 100)
}

function openChapter(chapterId: string) {
  router.push(`/word-book/${bookId.value}/${chapterId}`)
}

function addPage(chapterId: string) {
  pageCreateChapterId.value = chapterId
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

async function createChapter() {
  try {
    const { value } = await ElMessageBox.prompt('给这个章节起个名字，如「字母组合」', '新建章节', {
      inputValue: '新主题',
      inputPattern: /\S+/,
      inputErrorMessage: '名称不能为空',
    })
    if (!await prepareBookEdit()) return
    const result = await store.createChapter(bookId.value, String(value || '').trim())
    if (!result.ok || !result.item) {
      ElMessage.error(result.message || '创建失败')
      return
    }
    router.push(`/word-book/${bookId.value}/${result.item._id}`)
  } catch { /* 取消 */ }
}

async function onChapterCommand(command: string, chapter: WordBookChapter) {
  if (command === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('新的章节名称', '重命名', {
        inputValue: chapter.name,
        inputPattern: /\S+/,
        inputErrorMessage: '名称不能为空',
      })
      if (!await prepareBookEdit()) return
      const result = await store.renameChapter(chapter._id, String(value || '').trim())
      if (result.ok) ElMessage.success('已重命名')
      else ElMessage.error(result.message || '重命名失败')
    } catch { /* 取消 */ }
    return
  }
  try {
    await ElMessageBox.confirm(`删除「${chapter.name}」及其下所有学习页？原词库中的单词不会删除。`, '删除章节', { type: 'warning' })
  } catch {
    return
  }
  if (!await prepareBookEdit()) return
  const result = await store.deleteChapter(chapter._id)
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

.chapter-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
  max-width: 1080px;
  min-height: 180px;
  margin: 0 auto;
}

.chapter-card {
  padding: 16px;
  cursor: pointer;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 12px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--utools-primary);
  }

  h3 {
    margin: 12px 0 6px;
    color: var(--utools-text-primary);
    font-size: 17px;
  }
}

.chapter-topline,
.chapter-actions {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.chapter-actions {
  justify-content: flex-end;
}

.chapter-card:focus-visible {
  outline: 2px solid var(--utools-primary);
  outline-offset: 2px;
}

.chapter-kind {
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

.card-meta {
  margin: 0 0 12px;
  color: var(--utools-text-secondary);
  font-size: 13px;
}
</style>
