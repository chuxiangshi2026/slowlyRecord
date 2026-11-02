<template>
  <div class="word-book-page">
    <header class="page-header">
      <div>
        <el-button text @click="goChapter">← 返回章节</el-button>
        <h2>{{ page?.name || '记忆页' }}</h2>
        <p v-if="page">
          {{ page.words.length }} 个单词 · {{ keyLabel }}
          <span v-if="page.lastReviewedAt"> · 上次 {{ page.lastScore }} 分</span>
          <span v-if="!finished"> · {{ dueLabel(page.nextReviewAt) }}</span>
        </p>
      </div>
      <div v-if="page && !finished" class="toolbar">
        <el-checkbox v-model="hideMeaning" size="small">遮住释义</el-checkbox>
        <el-checkbox v-model="shuffle" size="small" @change="rebuildOrder">打乱顺序</el-checkbox>
        <span class="progress">已记住 <strong>{{ marked.size }}</strong> / {{ page.words.length }}</span>
        <el-button size="small" @click="restart">重新开始</el-button>
      </div>
    </header>

    <div v-loading="store.loading" class="page-content">
      <el-empty v-if="!store.loading && !page" description="学习页不存在或已删除"/>

      <el-result v-else-if="page && finished" icon="success" :title="`本轮完成 · ${page.lastScore ?? 0} 分`"
                 :sub-title="`${page.words.length} 个单词已全部标记 · 下次复习：${dueLabel(page.nextReviewAt)}`">
        <template #extra>
          <el-button type="primary" @click="restart">再记一遍</el-button>
          <el-button @click="goChapter">返回章节</el-button>
        </template>
      </el-result>

      <div v-else-if="page" class="map-wrap">
        <div class="word-map" :style="{ width: `${MAP_SIZE}px`, height: `${MAP_SIZE}px` }">
          <svg class="map-lines" :viewBox="`0 0 ${MAP_SIZE} ${MAP_SIZE}`">
            <line
                v-for="(pos, i) in positions"
                :key="`line-${i}`"
                :x1="MAP_SIZE / 2"
                :y1="MAP_SIZE / 2"
                :x2="pos.x"
                :y2="pos.y"
            />
          </svg>

          <div class="map-center">
            <strong>{{ page.key.value || '主题' }}</strong>
            <span>{{ keyTypeLabel }}</span>
          </div>

          <div
              v-for="(pos, i) in positions"
              :key="`node-${i}`"
              class="map-node"
              :class="{ marked: marked.has(order[i]), wrong: wrongAttempts.has(order[i]) }"
              :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
              @click="reveal(order[i])"
          >
            <span class="node-word">
              <span v-for="(comp, ci) in components(page.words[order[i]].text)" :key="ci"
                    :class="`affix-${comp.type}`">{{ comp.text }}</span>
            </span>
            <span v-if="page.words[order[i]].phonetic" class="node-phonetic">{{ page.words[order[i]].phonetic }}</span>
            <span class="node-explains">
              {{ shouldHide(order[i]) ? '点击显示释义' : (page.words[order[i]].explains || '—') }}
            </span>
            <div class="node-actions" @click.stop>
              <el-button size="small" type="success" plain circle :icon="Check"
                         @click="markRemembered(order[i])"/>
              <el-button size="small" type="danger" plain circle :icon="Close"
                         @click="markForgot(order[i])"/>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import { Check, Close } from '@element-plus/icons-vue'
import { useWordBookStore } from '@/stores/wordBook'
import { analyzeWord } from '@/utils/word-analysis'
import { formatDueLabel } from '@/utils/word-book'

const route = useRoute()
const router = useRouter()
const store = useWordBookStore()

const MAP_SIZE = 600

const pageId = computed(() => String(route.params.pageId || ''))
const page = computed(() => store.getPage(pageId.value))
const keyTypeLabel = computed(() => {
  const map: Record<string, string> = { root: '词根', prefix: '前缀', suffix: '后缀', phonetic: '音标', text: '主题' }
  return map[page.value?.key.type || 'text'] || '主题'
})
const keyLabel = computed(() => (page.value?.key.value ? `${keyTypeLabel.value} ${page.value.key.value}` : keyTypeLabel.value))

const order = ref<number[]>([])
const hideMeaning = ref(false)
const shuffle = ref(false)
const revealed = ref<Set<number>>(new Set())
const marked = ref<Set<number>>(new Set())
const wrongAttempts = ref<Set<number>>(new Set())
const finished = ref(false)
const saving = ref(false)

const positions = computed(() => {
  const n = Math.max(1, order.value.length)
  const center = MAP_SIZE / 2
  const radius = n <= 8 ? 200 : n <= 14 ? 225 : 240
  return order.value.map((_, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2
    return { x: center + Math.cos(angle) * radius, y: center + Math.sin(angle) * radius }
  })
})

onMounted(async () => {
  try {
    await store.loadAll()
    rebuildOrder()
  } catch {
    ElMessage.error('记忆页读取失败')
  }
})

watch(pageId, () => {
  rebuildOrder()
})

function rebuildOrder() {
  const total = page.value?.words.length || 0
  const list = Array.from({ length: total }, (_, i) => i)
  if (shuffle.value) {
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[list[i], list[j]] = [list[j], list[i]]
    }
  }
  order.value = list
}

function restart() {
  revealed.value = new Set()
  marked.value = new Set()
  wrongAttempts.value = new Set()
  finished.value = false
  rebuildOrder()
}

function components(text: string) {
  if (/\s/.test(String(text || '').trim())) return [{ text, type: 'whole' as const }]
  return analyzeWord(text)
}

function shouldHide(index: number): boolean {
  return hideMeaning.value && !revealed.value.has(index)
}

function reveal(index: number) {
  if (!shouldHide(index)) return
  const next = new Set(revealed.value)
  next.add(index)
  revealed.value = next
}

function markRemembered(index: number) {
  if (marked.value.has(index)) return
  const nextMarked = new Set(marked.value)
  nextMarked.add(index)
  marked.value = nextMarked
  const nextWrong = new Set(wrongAttempts.value)
  nextWrong.delete(index)
  wrongAttempts.value = nextWrong
  if (nextMarked.size === (page.value?.words.length || 0)) void finishRound()
}

function markForgot(index: number) {
  const nextMarked = new Set(marked.value)
  nextMarked.delete(index)
  marked.value = nextMarked
  const nextWrong = new Set(wrongAttempts.value)
  nextWrong.add(index)
  wrongAttempts.value = nextWrong
  const nextRevealed = new Set(revealed.value)
  nextRevealed.add(index)
  revealed.value = nextRevealed
}

async function finishRound() {
  if (!page.value || saving.value) return
  saving.value = true
  const current = page.value
  try {
    const result = await store.completePage(current._id, wrongAttempts.value.size)
    if (!result.ok) {
      ElMessage.error(result.message || '成绩保存失败')
      return
    }
    finished.value = true
  } catch {
    ElMessage.error('成绩保存失败，请重试')
  } finally {
    saving.value = false
  }
}

function dueLabel(nextReviewAt: number): string {
  return formatDueLabel(nextReviewAt)
}

function goChapter() {
  if (!page.value) {
    router.push('/word-book')
    return
  }
  router.push(`/word-book/${page.value.bookId}/${page.value.chapterId}`)
}
</script>

<style scoped lang="scss">
.word-book-page {
  min-height: 100vh;
  padding: 20px 4%;
  box-sizing: border-box;
  background: var(--utools-bg-secondary);
}

.page-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  max-width: 1000px;
  margin: 0 auto 12px;

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

.toolbar {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.progress {
  color: var(--utools-text-secondary);
  font-size: 13px;

  strong {
    color: var(--utools-primary);
  }
}

.page-content {
  display: flex;
  justify-content: center;
  max-width: 1000px;
  min-height: 320px;
  margin: 0 auto;
}

.map-wrap {
  overflow: auto;
  max-width: 100%;
}

.word-map {
  position: relative;
  margin: 0 auto;
}

.map-lines {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;

  line {
    stroke: var(--utools-border-divider);
    stroke-width: 1.5;
  }
}

.map-center {
  position: absolute;
  left: 50%;
  top: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 132px;
  height: 132px;
  border-radius: 50%;
  background: var(--utools-primary-light);
  border: 2px solid var(--utools-primary);
  color: var(--utools-primary);
  text-align: center;

  strong {
    font-size: 20px;
    line-height: 1.2;
    word-break: break-word;
    padding: 0 8px;
  }

  span {
    margin-top: 4px;
    font-size: 12px;
    opacity: 0.8;
  }
}

.map-node {
  position: absolute;
  transform: translate(-50%, -50%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  width: 132px;
  padding: 10px 8px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 10px;
  cursor: pointer;
  transition: border-color 0.2s, box-shadow 0.2s;

  &:hover {
    border-color: var(--utools-primary);
  }

  &.marked {
    border-color: var(--utools-success);
    background: var(--utools-success-light);
  }

  &.wrong {
    border-color: var(--utools-warning);
  }

  .node-word {
    font-size: 15px;
    font-weight: 600;
    color: var(--utools-text-primary);
    word-break: break-word;
    text-align: center;
  }

  .node-phonetic {
    color: var(--utools-text-tertiary);
    font-size: 11px;
  }

  .node-explains {
    color: var(--utools-text-secondary);
    font-size: 12px;
    line-height: 1.35;
    text-align: center;
    max-height: 3.2em;
    overflow: hidden;
    word-break: break-word;
  }

  .node-actions {
    display: flex;
    gap: 6px;
    margin-top: 4px;
  }
}

/* 词根词缀着色（与其他页面一致的低饱和配色） */
.affix-root {
  color: var(--utools-primary);
}

.affix-prefix {
  color: var(--utools-warning);
}

.affix-suffix {
  color: var(--utools-success);
}
</style>
