<template>
  <div class="word-collection-page">
    <header class="collection-header">
      <div>
        <h2>词集</h2>
        <p>把有关系的单词编成一页页导图；示例可直接编辑，保存后归入我的词集。</p>
      </div>
      <div class="header-actions">
        <el-tag v-if="store.dueCount" type="warning" effect="plain" class="due-tag" @click="openFirstDue">
          今日待复习 {{ store.dueCount }} 组
        </el-tag>
        <el-button type="primary" @click="libraryVisible = true">添加词集</el-button>
      </div>
    </header>

    <div v-loading="store.loading" class="collection-body">
      <section v-if="continueTarget" class="continue-card" role="link" tabindex="0"
               @click="openContinue" @keydown.enter="openContinue" @keydown.space.prevent="openContinue">
        <div class="continue-info">
          <span class="continue-label">继续学习</span>
          <strong>{{ continueTarget.page.name }}</strong>
          <span class="continue-meta">{{ continueTarget.book?.name || '词集' }}<template v-if="continueTarget.chapter"> / {{ continueTarget.chapter.name }}</template></span>
        </div>
        <span class="continue-arrow">→</span>
      </section>

      <section v-if="store.duePages.length" class="due-section">
        <h3>今日待复习</h3>
        <div class="due-list">
          <el-button v-for="page in store.duePages.slice(0, 6)" :key="page._id" size="small" plain
                     @click="openPage(page._id)">
            {{ page.name }} · {{ page.words.length }} 词
          </el-button>
          <span v-if="store.duePages.length > 6" class="due-more">共 {{ store.duePages.length }} 组</span>
        </div>
      </section>

      <el-empty v-if="!store.loading && !store.sortedBooks.length"
                description="还没有词集。可以新建、导入，或从内置示例开始。">
        <el-button type="primary" @click="libraryVisible = true">添加词集</el-button>
      </el-empty>

      <template v-else>
        <section v-if="sampleBooks.length" class="book-section">
          <h3>示例词集</h3>
          <div class="book-grid">
            <article v-for="book in sampleBooks" :key="book._id" class="book-card" role="link" tabindex="0"
                     @click="openBook(book._id)" @keydown.enter="openBook(book._id)" @keydown.space.prevent="openBook(book._id)">
              <div class="card-topline">
                <span class="card-kind">示例</span>
                <el-dropdown trigger="click" @command="(cmd: string) => onBookCommand(cmd, book)">
                  <button type="button" class="more" aria-label="更多操作" @click.stop @keydown.enter.stop @keydown.space.stop>⋯</button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="export">导出词集</el-dropdown-item>
                      <el-dropdown-item command="rename">重命名</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <h4>{{ book.name }}</h4>
              <p class="card-desc">{{ book.desc || '可直接编辑，保存后归入我的词集。' }}</p>
              <p class="card-meta">{{ summaryOf(book._id) }}</p>
              <el-progress :percentage="progressOf(book._id)" :stroke-width="8"/>
            </article>
          </div>
        </section>

        <section v-if="myBooks.length" class="book-section">
          <h3>我的词集</h3>
          <div class="book-grid">
            <article v-for="book in myBooks" :key="book._id" class="book-card" role="link" tabindex="0"
                     @click="openBook(book._id)" @keydown.enter="openBook(book._id)" @keydown.space.prevent="openBook(book._id)">
              <div class="card-topline">
                <span class="card-kind">词集</span>
                <el-dropdown trigger="click" :disabled="!!copyingBookId" @command="(cmd: string) => onBookCommand(cmd, book)">
                  <button type="button" class="more" aria-label="更多操作" @click.stop @keydown.enter.stop @keydown.space.stop>⋯</button>
                  <template #dropdown>
                    <el-dropdown-menu>
                      <el-dropdown-item command="rename">重命名</el-dropdown-item>
                      <el-dropdown-item command="copy">复制词集</el-dropdown-item>
                      <el-dropdown-item command="export">导出词集</el-dropdown-item>
                      <el-dropdown-item command="delete" divided>删除</el-dropdown-item>
                    </el-dropdown-menu>
                  </template>
                </el-dropdown>
              </div>
              <h4>{{ book.name }}</h4>
              <p v-if="book.desc" class="card-desc">{{ book.desc }}</p>
              <p class="card-meta">{{ summaryOf(book._id) }}</p>
              <el-progress :percentage="progressOf(book._id)" :stroke-width="8"/>
            </article>
          </div>
        </section>
      </template>
    </div>

    <WordBookLibraryDialog v-model="libraryVisible" @open-book="openBookStart"/>
    <el-dialog v-model="guideVisible" title="快速了解词集" width="min(460px, 92vw)" @close="markGuideSeen">
      <ol class="guide-list">
        <li>打开学习页，围绕中心的字母组合、词根或主题查看单词。</li>
        <li>悬停单词自动发音并在右侧显示详情；单击标记已记住，全部标记后进入复习。</li>
        <li>点击中心编辑本页；顶部可添加单词，右侧详情可修改和删除。</li>
      </ol>
      <template #footer>
        <el-button @click="addFromGuide">添加自己的词集</el-button>
        <el-button type="primary" @click="tryFirstSample">一键体验</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { useWordBookStore } from '@/stores/wordBook'
import { addWordBookSample, seedWordBookSamples } from '@/utils/wordbook-seed'
import { WORDBOOK_SAMPLES } from '@/utils/wordbook-samples'
import { isPageDue } from '@/utils/word-book'
import { buildWordBookShareFile, wordBookShareFileName } from '@/utils/word-book-share'
import { getFileAdapter } from '@/adapters/file'
import { trackEvent } from '@/utils/stats'
import WordBookLibraryDialog from './WordBookLibraryDialog.vue'
import { confirmAndCopyWordBook } from './word-book-copy'
import type { WordBookBook, WordBookPage } from '@/types/word-book'

const GUIDE_KEY = 'sr_wordbook_guide_v1'
const router = useRouter()
const store = useWordBookStore()
const copyingBookId = ref('')
const libraryVisible = ref(false)
const guideVisible = ref(false)
const guideBusy = ref(false)

const sampleBooks = computed(() => store.sortedBooks.filter(book => book.isSample))
const myBooks = computed(() => store.sortedBooks.filter(book => !book.isSample))

const continueTarget = computed(() => {
  const page = store.continuePage
  if (!page) return null
  return {
    page,
    book: store.getBook(page.bookId),
    chapter: store.getChapter(page.chapterId),
  }
})

onMounted(async () => {
  try {
    await seedWordBookSamples()
    await store.loadAll(true)
  } catch {
    ElMessage.error('词集数据读取失败')
  }
  try {
    if (!localStorage.getItem(GUIDE_KEY)) guideVisible.value = true
  } catch {
    guideVisible.value = true
  }
})

function pagesOfBook(bookId: string): WordBookPage[] {
  const chapterIds = new Set(store.chaptersOf(bookId).map(chapter => chapter._id))
  return store.pages.filter(page => chapterIds.has(page.chapterId))
}

function summaryOf(bookId: string): string {
  const chapters = store.chaptersOf(bookId).length
  const pages = pagesOfBook(bookId)
  const read = pages.filter(page => page.readAt || page.lastRound || page.completedAt).length
  const due = pages.filter(page => isPageDue(page)).length
  return `${chapters} 章 · ${pages.length} 页 · 已读 ${read} 页${due ? ` · 待复习 ${due} 组` : ''}`
}

function progressOf(bookId: string): number {
  const pages = pagesOfBook(bookId)
  if (!pages.length) return 0
  const done = pages.filter(page => page.readAt || page.lastRound || page.completedAt).length
  return Math.round(done / pages.length * 100)
}

function openBook(bookId: string) {
  router.push(`/word-book/${bookId}`)
}

function openBookStart(bookId: string) {
  const firstChapter = store.chaptersOf(bookId)[0]
  const firstPage = firstChapter ? store.pagesOf(firstChapter._id)[0] : undefined
  if (firstPage) openPage(firstPage._id)
  else openBook(bookId)
}

function openPage(pageId: string) {
  router.push(`/word-book/page/${pageId}`)
}

function openFirstDue() {
  const first = store.duePages[0]
  if (first) openPage(first._id)
}

function openContinue() {
  if (continueTarget.value) openPage(continueTarget.value.page._id)
}

function markGuideSeen() {
  try {
    localStorage.setItem(GUIDE_KEY, '1')
  } catch { /* 无法持久化时仅在本次关闭 */ }
}

async function tryFirstSample() {
  if (guideBusy.value) return
  guideBusy.value = true
  markGuideSeen()
  try {
    const result = await addWordBookSample(WORDBOOK_SAMPLES[0])
    if (!result.item) {
      ElMessage.error(result.message || '示例打开失败')
      return
    }
    guideVisible.value = false
    openBookStart(result.item._id)
  } finally {
    guideBusy.value = false
  }
}

function addFromGuide() {
  markGuideSeen()
  guideVisible.value = false
  libraryVisible.value = true
}

async function copyBook(book: WordBookBook) {
  if (copyingBookId.value) return
  copyingBookId.value = book._id
  try {
    const result = await confirmAndCopyWordBook(store, book)
    if (!result) return
    ElMessage.success(result.created ? `已创建「${result.book.name}」` : `已打开「${result.book.name}」`)
    openBook(result.book._id)
  } finally {
    copyingBookId.value = ''
  }
}

async function exportBook(book: WordBookBook) {
  try {
    const file = buildWordBookShareFile(book, store.chaptersOf(book._id), pagesOfBook(book._id))
    await getFileAdapter().downloadFile(JSON.stringify(file, null, 2), wordBookShareFileName(file.book))
    trackEvent('feature', 'word_book_export', 'book', pagesOfBook(book._id).length)
    ElMessage.success('词集文件已开始下载')
  } catch (e) {
    console.error('[词集] 导出失败', e)
    ElMessage.error('导出词集失败')
  }
}

async function onBookCommand(command: string, book: WordBookBook) {
  if (command === 'copy') {
    await copyBook(book)
    return
  }
  if (command === 'export') {
    await exportBook(book)
    return
  }
  if (command === 'rename') {
    try {
      const { value } = await ElMessageBox.prompt('新的词集名称', '重命名', {
        inputValue: book.name,
        inputPattern: /\S+/,
        inputErrorMessage: '名称不能为空',
      })
      const claimed = await store.claimSampleBook(book._id)
      if (!claimed.ok) {
        ElMessage.error(claimed.message || '示例转换失败')
        return
      }
      const result = await store.renameBook(book._id, String(value || '').trim())
      if (result.ok) ElMessage.success('已重命名')
      else ElMessage.error(result.message || '重命名失败')
    } catch { /* 取消 */ }
    return
  }
  try {
    await ElMessageBox.confirm(`删除「${book.name}」及其下所有章节和学习页？原词库中的单词不会删除。`, '删除词集', { type: 'warning' })
  } catch {
    return
  }
  const result = await store.deleteBook(book._id)
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
    font-size: 13px;
    line-height: 1.6;
  }
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.due-tag {
  cursor: pointer;
}

.collection-body {
  max-width: 1080px;
  min-height: 220px;
  margin: 0 auto;
}

.continue-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 16px 18px;
  margin-bottom: 16px;
  cursor: pointer;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-primary);
  border-radius: 12px;
}

.continue-info {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 0;

  strong {
    color: var(--utools-text-primary);
    font-size: 17px;
  }
}

.continue-label {
  color: var(--utools-primary);
  font-size: 12px;
  font-weight: 600;
}

.continue-meta {
  color: var(--utools-text-tertiary);
  font-size: 12px;
}

.due-section {
  margin-bottom: 18px;

  h3,
  .book-section h3 {
    margin: 0 0 10px;
    color: var(--utools-text-secondary);
    font-size: 14px;
    font-weight: 600;
  }
}

.due-list {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.due-more {
  color: var(--utools-text-tertiary);
  font-size: 12px;
}

.book-section {
  margin-bottom: 22px;
}

.book-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.book-card {
  padding: 16px;
  cursor: pointer;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 12px;
  transition: border-color 0.2s;

  &:hover {
    border-color: var(--utools-primary);
  }

  &:focus-visible {
    outline: 2px solid var(--utools-primary);
    outline-offset: 2px;
  }

  h4 {
    margin: 12px 0 6px;
    color: var(--utools-text-primary);
    font-size: 18px;
  }
}

.card-topline {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.card-kind {
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

.card-desc {
  min-height: 20px;
  margin: 0 0 6px;
  color: var(--utools-text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.card-meta {
  margin: 0 0 12px;
  color: var(--utools-text-secondary);
  font-size: 13px;
}

.continue-card:focus-visible {
  outline: 2px solid var(--utools-primary);
  outline-offset: 2px;
}

.continue-arrow {
  color: var(--utools-primary);
  font-size: 20px;
}

.guide-list {
  padding-left: 22px;
  margin: 0;
  color: var(--utools-text-secondary);
  font-size: 13px;
  line-height: 1.8;

  li + li {
    margin-top: 8px;
  }
}

@media (max-width: 640px) {
  .collection-header {
    align-items: flex-start;
    flex-direction: column;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
