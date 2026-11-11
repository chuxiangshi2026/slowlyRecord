<template>
  <div class="word-page">
    <header class="page-header">
      <div class="page-title">
        <h2>{{ page?.name || '学习页' }}</h2>
        <p v-if="page">{{ statusLine }}</p>
      </div>
      <div v-if="page" class="page-header-actions">
        <el-button size="small" @click="directoryVisible = true">章节目录</el-button>
        <el-radio-group :model-value="mode" size="small" @change="onModeChange">
          <el-radio-button value="view">查看</el-radio-button>
          <el-radio-button value="recall" :disabled="!page.words.length">复习</el-radio-button>
        </el-radio-group>
        <el-button size="small" @click="openWordPicker">＋ 添加单词</el-button>
      </div>
    </header>

    <div v-loading="store.loading" class="page-content">
      <el-empty v-if="!store.loading && !page" description="学习页不存在或已删除"/>

      <template v-else-if="page">
        <div v-if="page.words.length > WORD_GRAPH_MAX_NODES" class="page-warning">
          本页 {{ page.words.length }} 词，建议拆页以保持导图清晰。
        </div>

        <div class="workspace" :class="{ finished: recallFinished }">
          <section class="graph-area">
            <div class="graph-shell" role="group" :aria-label="`${page.name} 中心导图`">
              <svg class="map-lines" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <line v-for="(pos, index) in graphLayout.nodes" :key="`line-${index}`"
                      x1="50" y1="50" :x2="pos.x * 100" :y2="pos.y * 100"/>
              </svg>

              <button type="button" class="map-center"
                      title="编辑学习页名称、中心文本和解释" @click="openPageEditor">
                <strong>{{ centerValue }}</strong>
                <span>{{ keyTypeLabel }}</span>
                <small v-if="page.key.description">{{ page.key.description }}</small>
                <small v-else-if="page.key.type === 'letters'">拼写联想</small>
                <el-icon class="center-edit-icon"><EditPen/></el-icon>
              </button>
              <div v-if="!page.words.length" class="empty-page-tip">
                <p>这一页还没有单词，先添加几个有关系的词。</p>
                <el-button type="primary" plain size="small" @click="openWordPicker">添加单词</el-button>
              </div>

              <div v-for="(word, index) in page.words" :key="word.entryId || `${word.text}-${index}`"
                   class="map-node" :class="[nodeClasses(word), { hoverable: mode === 'view' }]" :style="nodeStyle(index)">
                <button type="button" class="node-main"
                        :aria-label="nodeAriaLabel(word)"
                        :aria-pressed="knownEntryIds.has(word.entryId || '')"
                        @mouseenter="onWordHover(word)" @focus="onWordHover(word)" @click="onNodeClick(word)">
                  <span class="node-word">
                    <span v-for="(part, partIndex) in wordComponents(word)" :key="partIndex"
                          :class="componentClass(part)">{{ part.text }}</span>
                  </span>
                  <span v-if="word.phonetic" class="node-phonetic">{{ word.phonetic }}</span>
                  <span v-if="mode === 'view'" class="node-explains">{{ viewWordMeaning(word) }}</span>
                  <span v-else class="node-explains">
                    {{ isRevealed(word.entryId) ? (word.explains || '—') : '点击显示释义' }}
                  </span>
                </button>
              </div>
            </div>

            <div class="graph-footer">
              <el-button size="small" :disabled="!prevPage" @click="openPageRoute(prevPage!._id)">← 上一页</el-button>
              <el-button v-if="mode === 'view' && !recallFinished" size="small" :loading="readSaving" @click="markRead">
                {{ page.readAt ? '更新已读' : '标记已读' }}
              </el-button>
              <el-button size="small" :disabled="!nextPage" @click="openPageRoute(nextPage!._id)">下一页 →</el-button>
            </div>
          </section>

          <aside class="detail-panel">
            <template v-if="recallFinished && completedRound">
              <h3>本轮完成</h3>
              <div class="round-stats">
                <p>共 {{ completedRound.total }} 词</p>
                <p>首轮想起 {{ completedRound.firstTryKnown }} 词</p>
                <p>重新回忆 {{ completedRound.retriedCount }} 词</p>
              </div>
              <el-alert v-if="practiceRound" type="info" :closable="false" class="panel-alert"
                        title="练习模式：已记录本轮结果，但不调整正式复习时间。"/>
              <el-alert v-else-if="!roundSaveFailed" type="success" :closable="false" class="panel-alert"
                        :title="`下次复习：${dueLabel(page.nextReviewAt)}`"/>
              <div v-if="wrongWords.length" class="wrong-list">
                <h4>首轮需要巩固</h4>
                <div class="wrong-items">
                  <button v-for="word in wrongWords" :key="word.entryId" type="button" class="wrong-item"
                          :title="word.explains" @click="speakWord(word.text)">{{ word.text }}</button>
                </div>
              </div>
              <el-alert v-if="roundSaveFailed" type="error" title="本轮结果保存失败，请重试" :closable="false" class="panel-alert"/>
              <div class="panel-actions">
                <el-button v-if="roundSaveFailed" type="warning" :loading="savingRound" @click="retrySaveRound">重试保存</el-button>
                <el-button v-if="!roundSaveFailed" type="primary" plain @click="startRecall(true)">再练一遍</el-button>
                <el-button v-if="!roundSaveFailed && nextPage" type="primary" @click="openPageRoute(nextPage._id)">下一页</el-button>
              </div>
            </template>

            <template v-else>
              <template v-if="selectedWord">
                <div class="detail-heading">
                  <h3>{{ selectedWord.text }}</h3>
                  <div class="detail-word-actions">
                    <el-button size="small" :icon="Headset" title="播放发音" aria-label="播放单词发音"
                               @click="speakWord(selectedWord.text)">发音</el-button>
                    <el-button size="small" :icon="EditPen" title="编辑单词" aria-label="编辑单词"
                               @click="openWordEditor(selectedWord)">编辑</el-button>
                  </div>
                </div>
                <p v-if="selectedWord.phonetic" class="detail-phonetic">{{ selectedWord.phonetic }}</p>
                <p class="detail-explains">{{ isViewRemembered(selectedWord) ? '已记住，释义已隐藏' : (selectedWord.explains || '暂无释义') }}</p>
                <div v-if="selectedWord.examples?.length && !isViewRemembered(selectedWord)" class="detail-examples">
                  <h4>例句</h4>
                  <p v-for="(example, index) in selectedWord.examples" :key="index">
                    <span class="example-en">{{ example.english }}</span>
                    <span class="example-zh">{{ example.chinese }}</span>
                  </p>
                </div>
                <p v-if="selectedWord.memoryTip" class="detail-memory">💡 {{ selectedWord.memoryTip }}</p>
                <p v-if="selectedWord.note" class="detail-note">{{ selectedWord.note }}</p>
              </template>
              <div v-else class="detail-empty">
                <h3>学习页详情</h3>
                <p>悬停单词自动发音并查看详情；单击标记已记住，全部标记后进入复习。</p>
              </div>

              <div v-if="mode === 'view' && page.note" class="page-note">
                <h4>构词与演变</h4>
                <p>{{ page.note }}</p>
              </div>

              <template v-if="mode === 'recall'">
                <el-divider/>
                <div class="recall-progress">
                  <span>已记住 <strong>{{ knownEntryIds.size }}</strong> / {{ page.words.length }}</span>
                  <span v-if="retryEntryIds.size">待重看 {{ retryEntryIds.size }}</span>
                </div>
                <el-alert v-if="!selectedWord" type="info" :closable="false" class="panel-alert"
                          title="单击显示释义并标记记住，再单击收起并取消。"/>
                <div class="panel-actions">
                  <el-button type="danger" plain :disabled="!selectedWord || savingRound" @click="markSelectedWrong">还没记住</el-button>
                </div>
                <p class="recall-tip">灰色卡片表示已记住；需要重看时点「还没记住」。</p>
              </template>
            </template>
          </aside>
        </div>
      </template>
    </div>

    <el-dialog v-model="directoryVisible" title="章节目录" width="min(1080px, 92vw)" append-to-body>
      <p class="directory-hint">按章节名称排序；点击章节管理内容，点击学习页直接打开。</p>
      <div class="directory-grid">
        <section v-for="(item, index) in chapterDirectory" :key="item.chapter._id"
                 class="directory-chapter" :class="{ current: item.chapter._id === page?.chapterId }">
          <button type="button" class="directory-chapter-title" @click="openChapter(item.chapter._id)">
            <span>{{ index + 1 }}. {{ item.chapter.name }}</span>
            <small>{{ item.pageCount }} 页 · {{ item.wordCount }} 词{{ item.hasSameName ? ' · 同名' : '' }}</small>
          </button>
          <div class="directory-pages">
            <button v-for="itemPage in item.pages" :key="itemPage._id" type="button" class="directory-page"
                    :class="{ current: itemPage._id === pageId }" @click="openPageRoute(itemPage._id)">
              <span>P{{ itemPage.order }}</span>
              <span class="directory-page-name">{{ itemPage.name }}</span>
            </button>
            <span v-if="!item.pages.length" class="directory-empty">暂无学习页</span>
          </div>
        </section>
      </div>
    </el-dialog>

    <el-dialog v-model="pageEditorVisible" title="编辑学习页" width="min(500px, 92vw)" append-to-body
               :close-on-click-modal="false" :before-close="onEditorBeforeClose">
      <el-alert v-if="editSaveError" type="error" :title="editSaveError" :closable="false" class="panel-alert"/>
      <el-form label-position="top" class="edit-form">
        <el-form-item label="学习页名称" required>
          <el-input v-model="draftName" maxlength="40"/>
        </el-form-item>
        <el-form-item label="中心类型">
          <el-select v-model="draftKeyType">
            <el-option v-for="option in keyTypeOptions" :key="option.value" :label="option.label" :value="option.value"/>
          </el-select>
        </el-form-item>
        <el-form-item label="中心文本">
          <el-input v-model="draftKeyValue" maxlength="40" placeholder="如 old / port / /əʊ/"/>
        </el-form-item>
        <el-form-item label="中心解释">
          <el-input v-model="draftKeyDescription" maxlength="80" placeholder="如：携带、运送"/>
        </el-form-item>
        <el-form-item label="页面备注">
          <el-input v-model="draftNote" type="textarea" :rows="2" maxlength="200"/>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="cancelEdit">取消</el-button>
        <el-button type="primary" :disabled="!draftName.trim()" :loading="editSaving" @click="savePageEdit">保存</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="wordEditorVisible" title="编辑单词" width="min(520px, 92vw)" append-to-body
               :close-on-click-modal="false" :before-close="onEditorBeforeClose">
      <template v-if="selectedDraftWord">
        <el-alert v-if="editSaveError" type="error" :title="editSaveError" :closable="false" class="panel-alert"/>
        <el-form label-position="top" class="edit-form">
          <el-form-item label="单词或词组" required>
            <el-input v-model="selectedDraftWord.text" maxlength="120"/>
          </el-form-item>
          <el-form-item label="释义">
            <el-input v-model="selectedDraftWord.explains" type="textarea" :rows="2" maxlength="300"/>
          </el-form-item>
          <el-form-item label="音标">
            <el-input v-model="selectedDraftWord.phonetic" maxlength="80"/>
          </el-form-item>
          <el-form-item label="记忆点">
            <el-input v-model="selectedDraftWord.memoryTip" maxlength="200" placeholder="如：inter- 相互 + act 做 → 互动"/>
          </el-form-item>
          <el-form-item label="例句">
            <div class="example-editor">
              <div v-for="(example, index) in selectedDraftWord.examples" :key="index" class="example-row">
                <el-input v-model="example.english" placeholder="英文例句"/>
                <el-input v-model="example.chinese" placeholder="中文翻译"/>
                <el-button link type="danger" @click="removeDraftExample(index)">删除</el-button>
              </div>
              <el-button link type="primary" @click="addDraftExample">＋ 添加例句</el-button>
            </div>
          </el-form-item>
          <el-form-item label="词条备注">
            <el-input v-model="selectedDraftWord.note" type="textarea" :rows="2" maxlength="200"/>
          </el-form-item>
        </el-form>
        <div class="node-tools">
          <el-button size="small" :disabled="selectedDraftIndex <= 0" @click="moveSelectedUp">上移</el-button>
          <el-button size="small" :disabled="selectedDraftIndex >= draftWords.length - 1" @click="moveSelectedDown">下移</el-button>
          <el-button size="small" type="danger" plain @click="removeSelectedWord">删除词条</el-button>
        </div>
        <div class="node-tools">
          <el-select v-model="moveTargetPageId" placeholder="移动到其他页" class="move-select">
            <el-option v-for="target in otherChapterPages" :key="target._id" :label="target.name" :value="target._id"/>
          </el-select>
          <el-button size="small" :disabled="!moveTargetPageId" @click="moveSelectedToPage">移动</el-button>
          <el-button size="small" @click="splitFromSelected">由此拆分为新页</el-button>
        </div>
      </template>
      <template #footer>
        <el-button @click="cancelEdit">取消</el-button>
        <el-button type="primary" :disabled="!selectedDraftWord?.text.trim()" :loading="editSaving" @click="saveWordEdit">保存</el-button>
      </template>
    </el-dialog>

    <WordBookWordPicker v-model="pickerVisible" :existing-texts="page?.words.map(word => word.text) || []"
                        @select="addPickedWord"/>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { onBeforeRouteLeave, useRoute, useRouter } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import { EditPen, Headset } from '@element-plus/icons-vue'
import { useWordBookStore } from '@/stores/wordBook'
import { useWordsStore } from '@/stores/words'
import { analyzeWord } from '@/utils/word-analysis'
import {
  WORD_BOOK_KEY_TYPE_LABEL,
  buildWordBookChapterDirectory,
  formatDueLabel,
  hasPageContentUpdate,
  hasPageReviewStarted,
  isPageDue,
  toWordBookWord,
} from '@/utils/word-book'
import { WORD_GRAPH_MAX_NODES, layoutWordGraph } from '@/utils/word-graph-layout'
import { getTtsAdapter } from '@/adapters/tts'
import WordBookWordPicker from './WordBookWordPicker.vue'
import type { WordBookKeyType, WordBookPage, WordBookRoundSummary, WordBookWord } from '@/types/word-book'
import type { Word } from '@/types/words'

type PageMode = 'view' | 'recall'

interface WordComponent {
  text: string
  type: string
  matched?: boolean
}

interface RecallDraft {
  version: 1
  order: string[]
  retry: string[]
  revealed: string[]
  known: string[]
  firstWrong: string[]
  practice: boolean
}

const route = useRoute()
const router = useRouter()
const store = useWordBookStore()
const wordsStore = useWordsStore()

const pageId = computed(() => String(route.params.pageId || ''))
const page = computed(() => store.getPage(pageId.value))

const mode = ref<PageMode>('view')
const selectedEntryId = ref('')
const readSaving = ref(false)
const directoryVisible = ref(false)

const pickerVisible = ref(false)
const pageEditorVisible = ref(false)
const wordEditorVisible = ref(false)
const editSaving = ref(false)
const editSaveError = ref('')
const draftName = ref('')
const draftKeyType = ref<WordBookKeyType>('text')
const draftKeyValue = ref('')
const draftKeyDescription = ref('')
const draftNote = ref('')
const draftWords = ref<WordBookWord[]>([])
const moveTargetPageId = ref('')

const knownEntryIds = ref<Set<string>>(new Set())
const revealedEntryIds = ref<Set<string>>(new Set())
const firstWrongEntryIds = ref<Set<string>>(new Set())
const retryEntryIds = ref<Set<string>>(new Set())
const recallOrder = ref<string[]>([])
const recallFinished = ref(false)
const practiceRound = ref(false)
const savingRound = ref(false)
const roundSaveFailed = ref(false)
const pendingRound = ref<WordBookRoundSummary | null>(null)

const keyTypeOptions = (Object.keys(WORD_BOOK_KEY_TYPE_LABEL) as WordBookKeyType[]).map(value => ({
  value,
  label: WORD_BOOK_KEY_TYPE_LABEL[value],
}))

const graphLayout = computed(() => layoutWordGraph(page.value?.words.length || 0, 900, 620))
const chapterDirectory = computed(() => page.value
  ? buildWordBookChapterDirectory(store.chaptersOf(page.value.bookId), store.pages)
  : [])
const chapterPages = computed(() => page.value ? store.pagesOf(page.value.chapterId) : [])
const currentPageIndex = computed(() => chapterPages.value.findIndex(item => item._id === pageId.value))
const prevPage = computed(() => currentPageIndex.value > 0 ? chapterPages.value[currentPageIndex.value - 1] : undefined)
const nextPage = computed(() => currentPageIndex.value >= 0 && currentPageIndex.value < chapterPages.value.length - 1
  ? chapterPages.value[currentPageIndex.value + 1]
  : undefined)
const otherChapterPages = computed(() => chapterPages.value.filter(item => item._id !== pageId.value))

const selectedWord = computed(() => page.value?.words.find(word => word.entryId === selectedEntryId.value))
const selectedDraftWord = computed(() => wordEditorVisible.value
  ? draftWords.value.find(word => word.entryId === selectedEntryId.value)
  : undefined)
const selectedDraftIndex = computed(() => draftWords.value.findIndex(word => word.entryId === selectedEntryId.value))

const keyTypeLabel = computed(() => WORD_BOOK_KEY_TYPE_LABEL[page.value?.key.type || 'text'])
const centerValue = computed(() => page.value?.key.value || '自定义主题')
const completedRound = computed(() => pendingRound.value || page.value?.lastRound)
const wrongWords = computed(() => {
  const ids = new Set(completedRound.value?.firstTryWrongEntryIds || [])
  return (page.value?.words || []).filter(word => word.entryId && ids.has(word.entryId))
})

const statusLine = computed(() => {
  if (!page.value) return ''
  const parts = [`${page.value.words.length} 个单词`, keyTypeLabel.value]
  if (isPageDue(page.value)) parts.push('今天到期')
  else if (hasPageContentUpdate(page.value)) parts.push('内容有更新')
  else if (hasPageReviewStarted(page.value)) parts.push(`下次复习 ${formatDueLabel(page.value.nextReviewAt)}`)
  else if (page.value.readAt) parts.push('已读')
  else parts.push('未学习')
  return parts.join(' · ')
})

const editDirty = computed(() => {
  if (!page.value) return false
  if (pageEditorVisible.value) {
    return JSON.stringify({
      name: draftName.value,
      keyType: draftKeyType.value,
      keyValue: draftKeyValue.value,
      keyDescription: draftKeyDescription.value,
      note: draftNote.value,
    }) !== JSON.stringify({
      name: page.value.name,
      keyType: page.value.key.type,
      keyValue: page.value.key.value,
      keyDescription: page.value.key.description || '',
      note: page.value.note || '',
    })
  }
  if (wordEditorVisible.value) return JSON.stringify(draftWords.value) !== JSON.stringify(page.value.words)
  return false
})

const roundStorageKey = computed(() => `sr_wordbook_round_${pageId.value}`)

onMounted(async () => {
  try {
    await store.loadAll()
    initPageState()
    openPickerFromQuery()
  } catch {
    ElMessage.error('学习页读取失败')
  }
})

watch(pageId, () => {
  initPageState()
  openPickerFromQuery()
})
watch(() => route.query.addWord, openPickerFromQuery)

function openPickerFromQuery() {
  if (route.query.addWord !== '1' || !page.value) return
  const { addWord: _addWord, ...rest } = route.query
  void router.replace({ query: rest })
  openWordPicker()
}

onBeforeRouteLeave(() => !editDirty.value || window.confirm('当前编辑尚未保存，确定离开吗？'))

function initPageState() {
  mode.value = 'view'
  selectedEntryId.value = ''
  pickerVisible.value = false
  clearRecallState(false)
  clearEditDraft()
  if (page.value && restoreRecallDraft()) mode.value = 'recall'
}

function nodeStyle(index: number) {
  const pos = graphLayout.value.nodes[index]
  if (!pos) return {}
  return { left: `${pos.x * 100}%`, top: `${pos.y * 100}%` }
}

function nodeClasses(word: WordBookWord) {
  const entryId = word.entryId || ''
  return {
    selected: selectedEntryId.value === entryId,
    known: knownEntryIds.value.has(entryId),
    wrong: firstWrongEntryIds.value.has(entryId),
    pending: mode.value === 'recall' && !knownEntryIds.value.has(entryId),
  }
}

function nodeAriaLabel(word: WordBookWord): string {
  if (mode.value === 'recall') return `${word.text}，显示或收起释义并切换记住状态`
  return `${word.text}，${knownEntryIds.value.has(word.entryId || '') ? '已记住，点击取消标记' : '标记为已记住'}`
}

function isViewRemembered(word: WordBookWord): boolean {
  return mode.value === 'view' && knownEntryIds.value.has(word.entryId || '')
}

function viewWordMeaning(word: WordBookWord): string {
  return isViewRemembered(word) ? '已记住' : (word.explains || '—')
}

function onWordHover(word: WordBookWord) {
  if (mode.value !== 'view' || !word.entryId) return
  selectedEntryId.value = word.entryId
  speakWord(word.text)
}

/** 中心词缀与解析出的成分同族即可高亮：-tion 可命中 -ation，spect 可命中 spec */
function isKeyComponent(component: WordComponent, keyType: string, keyValue: string) {
  if (component.type !== keyType) return false
  const text = component.text.toLowerCase()
  const value = String(keyValue || '').toLowerCase()
  if (!value) return false
  if (text === value) return true
  if (text.length < 3 || value.length < 3) return false
  return text.includes(value) || value.includes(text)
}

function wordComponents(word: WordBookWord): WordComponent[] {
  const key = page.value?.key
  const text = String(word.text || '')
  if (!text.trim()) return [{ text, type: 'whole' }]
  if (key?.type === 'letters' && key.value) {
    const lower = text.toLowerCase()
    const target = key.value.toLowerCase()
    const index = lower.indexOf(target)
    if (index >= 0) {
      return [
        ...(index > 0 ? [{ text: text.slice(0, index), type: 'plain' }] : []),
        { text: text.slice(index, index + target.length), type: 'match', matched: true },
        ...(index + target.length < text.length ? [{ text: text.slice(index + target.length), type: 'plain' }] : []),
      ]
    }
    return [{ text, type: 'whole' }]
  }
  if (key?.type === 'root' || key?.type === 'prefix' || key?.type === 'suffix') {
    return analyzeWord(text).map(component => ({
      ...component,
      matched: isKeyComponent(component, key.type, key.value),
    }))
  }
  return analyzeWord(text)
}

function componentClass(part: WordComponent) {
  if (part.matched) return page.value?.key.type === 'root' ? 'key-match key-match-root' : 'key-match'
  if (part.type === 'plain') return ''
  return `affix-${part.type}`
}

function onNodeClick(word: WordBookWord) {
  if (!word.entryId) return
  selectedEntryId.value = word.entryId
  if (wordsStore.autoSpeak) speakWord(word.text)

  if (mode.value === 'view') {
    const entryId = word.entryId
    const next = new Set(knownEntryIds.value)
    if (next.has(entryId)) next.delete(entryId)
    else next.add(entryId)
    knownEntryIds.value = next
    if (page.value && next.size === page.value.words.length) startRecall()
    return
  }

  if (recallFinished.value) return
  const entryId = word.entryId

  if (knownEntryIds.value.has(entryId)) {
    knownEntryIds.value = new Set([...knownEntryIds.value].filter(id => id !== entryId))
    revealedEntryIds.value = new Set([...revealedEntryIds.value].filter(id => id !== entryId))
    if (firstWrongEntryIds.value.has(entryId)) retryEntryIds.value = new Set([...retryEntryIds.value, entryId])
    persistRecallDraft()
    return
  }

  revealedEntryIds.value = new Set([...revealedEntryIds.value, entryId])
  knownEntryIds.value = new Set([...knownEntryIds.value, entryId])
  retryEntryIds.value = new Set([...retryEntryIds.value].filter(id => id !== entryId))
  persistRecallDraft()
  if (page.value && knownEntryIds.value.size === page.value.words.length) void finishRecall()
}

function speakWord(text: string) {
  if (!text.trim()) return
  getTtsAdapter().speak(text, { lang: 'en' })
}

function openPageRoute(targetPageId: string) {
  directoryVisible.value = false
  if (!targetPageId || targetPageId === pageId.value) return
  router.push(`/word-book/page/${targetPageId}`)
}

function openChapter(chapterId: string) {
  directoryVisible.value = false
  if (!page.value) return
  router.push(`/word-book/${page.value.bookId}/${chapterId}`)
}

async function markRead() {
  if (!page.value || readSaving.value) return
  readSaving.value = true
  try {
    const result = await store.markPageRead(page.value._id)
    if (result.ok) ElMessage.success('已记录阅读进度')
    else ElMessage.error(result.message || '已读状态保存失败')
  } finally {
    readSaving.value = false
  }
}

function onModeChange(value: string | number | boolean | undefined) {
  if (String(value) === 'recall') {
    startRecall()
    return
  }
  mode.value = 'view'
  clearRecallState()
}

function clearEditDraft() {
  pageEditorVisible.value = false
  wordEditorVisible.value = false
  draftName.value = ''
  draftKeyType.value = 'text'
  draftKeyValue.value = ''
  draftKeyDescription.value = ''
  draftNote.value = ''
  draftWords.value = []
  moveTargetPageId.value = ''
  editSaveError.value = ''
}

function prepareEditing(): boolean {
  if (!page.value) return false
  clearRecallState()
  mode.value = 'view'
  editSaveError.value = ''
  return true
}

function openPageEditor() {
  if (!prepareEditing() || !page.value) return
  draftName.value = page.value.name
  draftKeyType.value = page.value.key.type
  draftKeyValue.value = page.value.key.value
  draftKeyDescription.value = page.value.key.description || ''
  draftNote.value = page.value.note || ''
  draftWords.value = []
  pageEditorVisible.value = true
}

function openWordPicker() {
  if (!prepareEditing()) return
  pickerVisible.value = true
}

function openWordEditor(word: WordBookWord) {
  if (!prepareEditing() || !page.value || !word.entryId) return
  draftWords.value = page.value.words.map(item => ({
    ...item,
    examples: item.examples?.map(example => ({ ...example })),
  }))
  selectedEntryId.value = word.entryId
  moveTargetPageId.value = ''
  wordEditorVisible.value = true
}

function addDraftExample() {
  const word = selectedDraftWord.value
  if (!word) return
  word.examples = [...(word.examples || []), { english: '', chinese: '' }]
}

function removeDraftExample(index: number) {
  selectedDraftWord.value?.examples?.splice(index, 1)
}

async function persistPageContent(content: {
  name: string
  key: WordBookPage['key']
  words: WordBookWord[]
  note?: string
}): Promise<boolean> {
  if (!page.value || editSaving.value) return false
  editSaving.value = true
  editSaveError.value = ''
  try {
    const claimed = await store.claimSampleBook(page.value.bookId)
    if (!claimed.ok) {
      editSaveError.value = claimed.message || '示例转换失败'
      return false
    }
    const result = await store.updatePageContent(page.value._id, content)
    if (!result.ok) {
      editSaveError.value = result.message || '学习页保存失败'
      return false
    }
    return true
  } finally {
    editSaving.value = false
  }
}

function currentPageContent(words: WordBookWord[]) {
  return {
    name: page.value!.name,
    key: { ...page.value!.key },
    words,
    note: page.value!.note,
  }
}

async function savePageEdit() {
  if (!page.value || !draftName.value.trim()) return
  const saved = await persistPageContent({
    name: draftName.value.trim(),
    key: {
      type: draftKeyType.value,
      value: draftKeyValue.value.trim(),
      description: draftKeyDescription.value.trim() || undefined,
    },
    words: page.value.words,
    note: draftNote.value.trim() || undefined,
  })
  if (!saved) return
  clearEditDraft()
  ElMessage.success('学习页已保存')
}

async function saveWordEdit(): Promise<boolean> {
  if (!page.value || !selectedDraftWord.value) return false
  const text = selectedDraftWord.value.text.trim()
  if (!text) {
    editSaveError.value = '单词或词组不能为空'
    return false
  }
  const duplicate = draftWords.value.some(word => word.entryId !== selectedEntryId.value
    && word.text.trim().toLowerCase() === text.toLowerCase())
  if (duplicate) {
    editSaveError.value = '该单词已在当前学习页'
    return false
  }
  const words = draftWords.value.map(word => {
    if (word.entryId !== selectedEntryId.value) return word
    const examples = (word.examples || [])
      .map(example => ({ english: example.english.trim(), chinese: example.chinese.trim() }))
      .filter(example => example.english || example.chinese)
    return {
      ...word,
      text,
      examples: examples.length ? examples : undefined,
      memoryTip: word.memoryTip?.trim() || undefined,
    }
  })
  const saved = await persistPageContent(currentPageContent(words))
  if (!saved) return false
  clearEditDraft()
  ElMessage.success('单词已保存')
  return true
}

async function confirmDiscardEdit(): Promise<boolean> {
  if (!editDirty.value) return true
  return ElMessageBox.confirm('放弃当前编辑内容？', '取消编辑', { type: 'warning' }).then(() => true).catch(() => false)
}

async function cancelEdit() {
  if (await confirmDiscardEdit()) clearEditDraft()
}

function onEditorBeforeClose(done: () => void) {
  void confirmDiscardEdit().then(discard => {
    if (discard) done()
  })
}

async function addPickedWord(word: Word) {
  if (!page.value || editSaving.value) return
  const snapshot = toWordBookWord(word)
  const exists = page.value.words.some(item => item.text.trim().toLowerCase() === snapshot.text.trim().toLowerCase())
  if (exists) {
    ElMessage.warning('该单词已在当前学习页')
    return
  }
  const saved = await persistPageContent(currentPageContent([...page.value.words, snapshot]))
  if (!saved) {
    ElMessage.error(editSaveError.value || '添加单词失败')
    return
  }
  selectedEntryId.value = snapshot.entryId || ''
  ElMessage.success(`已添加 ${snapshot.text}`)
}

async function removeSelectedWord() {
  if (!page.value || selectedDraftIndex.value < 0) return
  const confirmed = await ElMessageBox.confirm(
    `从本页删除「${selectedDraftWord.value?.text}」？原词库中的单词不会删除。`,
    '删除词条',
    { type: 'warning' },
  ).then(() => true).catch(() => false)
  if (!confirmed) return
  const removedIndex = selectedDraftIndex.value
  const words = draftWords.value.filter(word => word.entryId !== selectedEntryId.value)
  const saved = await persistPageContent(currentPageContent(words))
  if (!saved) return
  selectedEntryId.value = words[Math.min(removedIndex, words.length - 1)]?.entryId || ''
  clearEditDraft()
  ElMessage.success('已从本页删除')
}

function moveSelectedUp() {
  const index = selectedDraftIndex.value
  if (index <= 0) return
  const next = [...draftWords.value]
  ;[next[index - 1], next[index]] = [next[index], next[index - 1]]
  draftWords.value = next
}

function moveSelectedDown() {
  const index = selectedDraftIndex.value
  if (index < 0 || index >= draftWords.value.length - 1) return
  const next = [...draftWords.value]
  ;[next[index], next[index + 1]] = [next[index + 1], next[index]]
  draftWords.value = next
}

async function moveSelectedToPage() {
  if (!page.value || !selectedDraftWord.value || !moveTargetPageId.value) return
  const entryId = selectedDraftWord.value.entryId!
  const confirmed = await ElMessageBox.confirm(
    '移动前会保存当前修改，并将该词条从本页移除。继续吗？',
    '移动词条',
    { type: 'warning' },
  ).then(() => true).catch(() => false)
  if (!confirmed) return
  const saved = await persistPageContent(currentPageContent(draftWords.value))
  if (!saved) return
  const moveResult = await store.moveEntryToPage(page.value._id, entryId, moveTargetPageId.value)
  if (!moveResult.ok) {
    editSaveError.value = moveResult.message || '移动词条失败'
    return
  }
  clearEditDraft()
  ElMessage.success('已移动词条')
}

async function splitFromSelected() {
  if (!page.value || selectedDraftIndex.value <= 0) {
    ElMessage.warning('请选择第二个或之后的词条作为拆分位置')
    return
  }
  const index = selectedDraftIndex.value
  const confirmed = await ElMessageBox.confirm(
    '当前词条及之后内容会进入新页，未保存修改会先保存。继续吗？',
    '拆分学习页',
    { type: 'warning' },
  ).then(() => true).catch(() => false)
  if (!confirmed) return
  const saved = await persistPageContent(currentPageContent(draftWords.value))
  if (!saved) return
  const splitResult = await store.splitPageAtIndex(page.value._id, index)
  if (!splitResult.ok || !splitResult.item) {
    editSaveError.value = splitResult.message || '拆分失败'
    return
  }
  clearEditDraft()
  openPageRoute(splitResult.item._id)
}

// ===== 复习 =====

function shouldPracticeRound(): boolean {
  return !!page.value && hasPageReviewStarted(page.value) && !isPageDue(page.value)
}

function shuffle<T>(list: T[]): T[] {
  const next = [...list]
  for (let i = next.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[next[i], next[j]] = [next[j], next[i]]
  }
  return next
}

function startRecall(practice?: boolean) {
  if (!page.value || !page.value.words.length) return
  clearEditDraft()
  mode.value = 'recall'
  practiceRound.value = practice ?? shouldPracticeRound()
  recallOrder.value = shuffle(page.value.words.map(word => word.entryId || ''))
  knownEntryIds.value = new Set()
  revealedEntryIds.value = new Set()
  firstWrongEntryIds.value = new Set()
  retryEntryIds.value = new Set()
  recallFinished.value = false
  roundSaveFailed.value = false
  pendingRound.value = null
  selectedEntryId.value = ''
  persistRecallDraft()
}

function isRevealed(entryId?: string): boolean {
  return !!entryId && revealedEntryIds.value.has(entryId)
}

function markSelectedWrong() {
  const entryId = selectedEntryId.value
  if (!entryId || recallFinished.value || savingRound.value) return
  knownEntryIds.value = new Set([...knownEntryIds.value].filter(id => id !== entryId))
  firstWrongEntryIds.value = new Set([...firstWrongEntryIds.value, entryId])
  retryEntryIds.value = new Set([...retryEntryIds.value, entryId])
  revealedEntryIds.value = new Set([...revealedEntryIds.value, entryId])
  persistRecallDraft()
}

async function finishRecall() {
  if (!page.value || savingRound.value) return
  savingRound.value = true
  roundSaveFailed.value = false
  const finishedAt = Date.now()
  const firstWrong = [...firstWrongEntryIds.value]
  pendingRound.value = {
    total: page.value.words.length,
    firstTryKnown: Math.max(0, page.value.words.length - firstWrong.length),
    retriedCount: firstWrong.length,
    firstTryWrongEntryIds: firstWrong,
    finishedAt,
  }
  recallFinished.value = true
  try {
    const result = await store.completeRound(page.value._id, pendingRound.value, { practice: practiceRound.value })
    if (!result.ok) {
      roundSaveFailed.value = true
      ElMessage.error(result.message || '本轮结果保存失败')
      return
    }
    clearRecallDraft()
  } finally {
    savingRound.value = false
  }
}

async function retrySaveRound() {
  if (!page.value || !pendingRound.value) return
  savingRound.value = true
  roundSaveFailed.value = false
  try {
    const result = await store.completeRound(page.value._id, pendingRound.value, { practice: practiceRound.value })
    if (!result.ok) {
      roundSaveFailed.value = true
      ElMessage.error(result.message || '本轮结果保存失败')
      return
    }
    recallFinished.value = true
    clearRecallDraft()
  } finally {
    savingRound.value = false
  }
}

function persistRecallDraft() {
  if (!page.value) return
  if (mode.value !== 'recall' || recallFinished.value) {
    clearRecallDraft()
    return
  }
  const draft: RecallDraft = {
    version: 1,
    order: recallOrder.value,
    retry: [...retryEntryIds.value],
    revealed: [...revealedEntryIds.value],
    known: [...knownEntryIds.value],
    firstWrong: [...firstWrongEntryIds.value],
    practice: practiceRound.value,
  }
  try {
    localStorage.setItem(roundStorageKey.value, JSON.stringify(draft))
  } catch { /* 存储不可用时本轮只保留在内存 */ }
}

function restoreRecallDraft(): boolean {
  if (!page.value) return false
  try {
    const raw = localStorage.getItem(roundStorageKey.value)
    if (!raw) return false
    const draft = JSON.parse(raw) as RecallDraft
    const currentIds = new Set(page.value.words.map(word => word.entryId || ''))
    if (draft.version !== 1 || draft.order.length !== currentIds.size || !draft.order.every(id => currentIds.has(id))) {
      clearRecallDraft()
      return false
    }
    recallOrder.value = draft.order
    retryEntryIds.value = new Set(draft.retry)
    revealedEntryIds.value = new Set(draft.revealed)
    knownEntryIds.value = new Set(draft.known)
    firstWrongEntryIds.value = new Set(draft.firstWrong)
    practiceRound.value = !!draft.practice
    recallFinished.value = false
    roundSaveFailed.value = false
    pendingRound.value = null
    return true
  } catch {
    clearRecallDraft()
    return false
  }
}

function clearRecallState(removeStorage = true) {
  knownEntryIds.value = new Set()
  revealedEntryIds.value = new Set()
  firstWrongEntryIds.value = new Set()
  retryEntryIds.value = new Set()
  recallOrder.value = []
  recallFinished.value = false
  roundSaveFailed.value = false
  pendingRound.value = null
  practiceRound.value = false
  if (removeStorage) clearRecallDraft()
}

function clearRecallDraft() {
  try {
    if (pageId.value) localStorage.removeItem(`sr_wordbook_round_${pageId.value}`)
  } catch { /* ignore */ }
}

function dueLabel(nextReviewAt: number): string {
  return formatDueLabel(nextReviewAt)
}
</script>

<style scoped lang="scss">
.word-page {
  display: flex;
  flex-direction: column;
  width: 100%;
  height: 100%;
  min-height: 0;
  padding: 8px 2%;
  box-sizing: border-box;
  overflow: hidden;
  background: var(--utools-bg-secondary);
}

.page-header {
  display: flex;
  flex: none;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  width: 100%;
  max-width: 1280px;
  margin: 0 auto 6px;
}

.page-title {
  min-width: 0;

  h2 {
    margin: 0;
    overflow: hidden;
    color: var(--utools-text-primary);
    font-size: 18px;
    line-height: 1.25;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  p {
    margin: 2px 0 0;
    color: var(--utools-text-tertiary);
    font-size: 11px;
    line-height: 1.3;
  }
}

.page-header-actions {
  display: flex;
  flex: none;
  align-items: center;
  gap: 6px;

  :deep(.el-button) {
    margin-left: 0;
  }
}

.page-content {
  display: flex;
  flex: 1;
  flex-direction: column;
  width: 100%;
  max-width: 1280px;
  min-height: 0;
  margin: 0 auto;
}

.page-warning {
  flex: none;
  margin-bottom: 4px;
  color: var(--utools-warning);
  font-size: 11px;
  text-align: center;
}

.workspace {
  display: grid;
  flex: 1;
  grid-template-columns: minmax(0, 1fr) 270px;
  gap: 10px;
  width: 100%;
  min-height: 0;
}

.graph-area {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.graph-shell {
  position: relative;
  flex: 1;
  width: 100%;
  max-width: 960px;
  min-height: 0;
  margin: 0 auto;
  overflow: hidden;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 12px;
}

.map-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;

  line {
    stroke: var(--utools-border-divider);
    stroke-width: 1;
    vector-effect: non-scaling-stroke;
  }
}

.map-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  z-index: 2;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: clamp(100px, 15%, 140px);
  min-height: 92px;
  padding: 10px;
  box-sizing: border-box;
  cursor: pointer;
  border-radius: 50%;
  background: var(--utools-primary-light);
  border: 2px solid var(--utools-primary);
  color: var(--utools-primary);
  text-align: center;
  font: inherit;

  &:hover {
    background: var(--utools-bg-hover);
  }

  &:focus-visible {
    outline: 2px solid var(--utools-primary);
    outline-offset: 3px;
  }

  strong {
    max-width: 100%;
    font-size: 17px;
    line-height: 1.2;
    word-break: break-word;
  }

  span {
    margin-top: 3px;
    font-size: 11px;
    opacity: 0.85;
  }

  small {
    max-width: 100%;
    margin-top: 2px;
    font-size: 10px;
    line-height: 1.2;
    word-break: break-word;
    opacity: 0.75;
  }
}

.center-edit-icon {
  position: absolute;
  top: 10px;
  right: 11px;
  font-size: 12px;
  opacity: 0.7;
}

.empty-page-tip {
  position: absolute;
  left: 50%;
  top: 73%;
  transform: translateX(-50%);
  width: min(300px, 70%);
  color: var(--utools-text-tertiary);
  font-size: 12px;
  text-align: center;

  p {
    margin: 0 0 8px;
  }
}

.map-node {
  position: absolute;
  transform: translate(-50%, -50%);
  z-index: 1;
  width: clamp(96px, 18%, 148px);
  min-height: 96px;
  box-sizing: border-box;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 9px;
  color: var(--utools-text-primary);
  transition: border-color 0.15s, box-shadow 0.15s, background-color 0.15s, transform 0.15s;

  &:hover {
    border-color: var(--utools-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--utools-primary) 18%, transparent);
  }

  &.hoverable:hover {
    z-index: 3;
    transform: translate(-50%, -50%) scale(1.04);
  }

  .key-match-root {
    color: var(--utools-danger);
  }

  &.selected {
    border-color: var(--utools-primary);
    box-shadow: 0 0 0 2px color-mix(in srgb, var(--utools-primary) 20%, transparent);
  }

  &.known,
  &.known.wrong {
    border-color: var(--utools-border-divider);
    background: var(--utools-bg-secondary);
    color: var(--utools-text-tertiary);
    box-shadow: none;

    .node-phonetic,
    .node-explains,
    .key-match,
    .affix-root,
    .affix-prefix,
    .affix-suffix,
    .affix-compound {
      color: inherit;
    }
  }

  &.wrong {
    border-color: var(--utools-warning);
  }
}

.node-main {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 3px;
  width: 100%;
  min-height: 96px;
  padding: 8px 6px;
  box-sizing: border-box;
  cursor: pointer;
  text-align: center;
  background: transparent;
  border: 0;
  border-radius: inherit;
  color: inherit;
  font: inherit;

  &:focus-visible {
    outline: 2px solid var(--utools-primary);
    outline-offset: 2px;
  }
}

.node-word {
  max-width: 100%;
  font-size: 16px;
  font-weight: 600;
  line-height: 1.2;
  text-align: center;
  word-break: break-word;
}

.node-phonetic {
  max-width: 100%;
  overflow: hidden;
  color: var(--utools-text-tertiary);
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.node-explains {
  display: -webkit-box;
  max-width: 100%;
  overflow: hidden;
  color: var(--utools-text-secondary);
  font-size: 13px;
  line-height: 1.3;
  text-align: center;
  word-break: break-word;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.key-match {
  color: var(--utools-primary);
  font-weight: 700;
}

.affix-root {
  color: var(--utools-primary);
}

.affix-prefix {
  color: var(--utools-warning);
}

.affix-suffix {
  color: var(--utools-success);
}

.affix-compound {
  color: var(--utools-warning);
}

.graph-footer {
  display: flex;
  flex: none;
  justify-content: center;
  gap: 8px;
  max-width: 960px;
  margin: 6px auto 0;

  :deep(.el-button) {
    margin-left: 0;
  }
}

.detail-panel {
  min-height: 0;
  padding: 12px;
  overflow-x: hidden;
  overflow-y: auto;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 10px;

  h3 {
    margin: 0 0 8px;
    color: var(--utools-text-primary);
    font-size: 15px;
  }

  h4 {
    margin: 10px 0 6px;
    color: var(--utools-text-primary);
    font-size: 13px;
  }

  :deep(.el-divider) {
    margin: 10px 0;
  }
}

.detail-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;

  h3 {
    min-width: 0;
    margin: 0;
    word-break: break-word;
  }
}

.detail-word-actions {
  display: flex;
  flex: none;
  gap: 4px;

  :deep(.el-button) {
    margin-left: 0;
    padding: 5px 8px;
  }
}

.panel-alert {
  margin-bottom: 8px;
}

.edit-form {
  :deep(.el-form-item) {
    margin-bottom: 10px;
  }

  :deep(.el-select) {
    width: 100%;
  }
}

.node-tools {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 6px;
  margin: 8px 0;

  :deep(.el-button) {
    margin-left: 0;
  }
}

.move-select {
  width: min(180px, 100%);
}

.panel-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 10px;

  :deep(.el-button) {
    margin-left: 0;
  }
}

.detail-empty {
  color: var(--utools-text-tertiary);
  font-size: 12px;
  line-height: 1.5;

  p {
    margin: 0;
  }
}

.detail-phonetic {
  margin: -4px 0 6px;
  color: var(--utools-text-tertiary);
  font-size: 12px;
}

.detail-explains {
  display: -webkit-box;
  margin: 0 0 8px;
  overflow: hidden;
  color: var(--utools-text-primary);
  font-size: 13px;
  line-height: 1.5;
  word-break: break-word;
  -webkit-line-clamp: 4;
  -webkit-box-orient: vertical;
}

.detail-examples {
  margin: 8px 0;

  h4 {
    margin: 0 0 4px;
    color: var(--utools-text-secondary);
    font-size: 12px;
    font-weight: 600;
  }

  p {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 6px 8px;
    margin: 0 0 4px;
    background: var(--utools-bg-secondary);
    border-radius: 6px;
  }

  .example-en {
    color: var(--utools-text-primary);
    font-size: 12px;
    line-height: 1.45;
  }

  .example-zh {
    color: var(--utools-text-tertiary);
    font-size: 11px;
    line-height: 1.4;
  }
}

.detail-memory {
  padding: 6px 8px;
  margin: 0 0 8px;
  color: var(--utools-text-secondary);
  font-size: 11px;
  line-height: 1.5;
  background: var(--utools-primary-light);
  border-radius: 6px;
}

.example-editor {
  width: 100%;

  .example-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
    gap: 6px;
    margin-bottom: 6px;
  }
}

.detail-note {
  display: -webkit-box;
  padding: 6px 8px;
  margin: 0;
  overflow: hidden;
  color: var(--utools-text-secondary);
  font-size: 11px;
  line-height: 1.4;
  background: var(--utools-bg-secondary);
  border-radius: 6px;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.page-note {
  padding-top: 10px;
  margin-top: 12px;
  border-top: 1px solid var(--utools-border-divider);

  h4 {
    margin: 0 0 6px;
    color: var(--utools-text-secondary);
    font-size: 12px;
    font-weight: 600;
  }

  p {
    margin: 0;
    color: var(--utools-text-secondary);
    font-size: 12px;
    line-height: 1.6;
    word-break: break-word;
  }
}

.recall-progress {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 12px;
  margin-bottom: 8px;
  color: var(--utools-text-secondary);
  font-size: 12px;

  strong {
    color: var(--utools-primary);
  }
}

.recall-tip {
  margin: 8px 0 0;
  color: var(--utools-text-tertiary);
  font-size: 11px;
  line-height: 1.4;
}

.round-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 10px;
  margin-bottom: 8px;
  color: var(--utools-text-secondary);
  font-size: 12px;

  p {
    margin: 0;
  }
}

.wrong-list {
  margin-top: 8px;
}

.wrong-items {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
}

.wrong-item {
  padding: 4px 7px;
  cursor: pointer;
  color: var(--utools-text-secondary);
  font-size: 11px;
  background: var(--utools-bg-secondary);
  border: 1px solid var(--utools-border-divider);
  border-radius: 6px;

  &:hover,
  &:focus-visible {
    color: var(--utools-primary);
    border-color: var(--utools-primary);
    outline: none;
  }
}

.directory-hint {
  margin: -4px 0 10px;
  color: var(--utools-text-tertiary);
  font-size: 12px;
}

.directory-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 10px 14px;
  max-height: min(68vh, 620px);
  overflow-y: auto;
}

.directory-chapter {
  min-width: 0;
  padding: 4px 0;
  border-bottom: 1px solid var(--utools-border-divider);

  &.current .directory-chapter-title {
    color: var(--utools-primary);
  }
}

.directory-chapter-title {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 6px;
  width: 100%;
  padding: 3px 4px;
  color: var(--utools-text-primary);
  font-size: 13px;
  font-weight: 600;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;

  span {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  small {
    flex-shrink: 0;
    color: var(--utools-text-tertiary);
    font-size: 10px;
    font-weight: 400;
  }

  &:hover,
  &:focus-visible {
    color: var(--utools-primary);
    background: var(--utools-bg-hover);
    outline: none;
  }
}

.directory-pages {
  padding: 1px 0 3px 8px;
  border-left: 1px solid var(--utools-border-divider);
}

.directory-page {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  min-height: 24px;
  padding: 2px 5px;
  color: var(--utools-text-secondary);
  font-size: 12px;
  text-align: left;
  background: transparent;
  border: 0;
  border-radius: 4px;
  cursor: pointer;

  span:first-child {
    flex: none;
    color: var(--utools-text-tertiary);
    font-size: 10px;
  }

  &:hover,
  &:focus-visible {
    color: var(--utools-primary);
    background: var(--utools-bg-hover);
    outline: none;
  }

  &.current {
    color: var(--utools-primary);
    font-weight: 600;
  }
}

.directory-page-name {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.directory-empty {
  display: block;
  padding: 4px 6px;
  color: var(--utools-text-tertiary);
  font-size: 11px;
}

@media (max-width: 900px) {
  .word-page {
    padding-right: 10px;
    padding-left: 10px;
  }

  .workspace {
    grid-template-columns: minmax(0, 1fr) 230px;
  }

  .map-node {
    width: clamp(80px, 18%, 120px);
  }
}

@media (max-height: 640px) {
  .word-page {
    padding-top: 4px;
    padding-bottom: 4px;
  }

  .page-header {
    margin-bottom: 4px;
  }

  .page-title p,
  .detail-note {
    display: none;
  }

  .graph-footer {
    margin-top: 4px;
  }

  .map-center {
    min-height: 80px;
  }

  .map-node,
  .node-main {
    min-height: 86px;
  }

  .node-main {
    padding-top: 6px;
    padding-bottom: 6px;
  }

  .detail-panel {
    padding: 10px;
  }
}
</style>
