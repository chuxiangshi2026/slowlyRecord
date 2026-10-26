<template>
  <div class="word-book-page">
    <header class="page-header">
      <el-button text @click="goChapter">← 返回章节</el-button>
      <div>
        <h2>{{ page?.title || '学习页' }}</h2>
        <p v-if="chapter && page">{{ chapter.name }} · {{ page.words.length }} 个单词</p>
      </div>
    </header>

    <div v-loading="store.loading" class="page-content">
      <el-empty v-if="!store.loading && (!chapter || !page)" description="学习页不存在或已删除" />
      <el-result v-else-if="chapter && page && !allowed" icon="warning" title="本页尚未解锁" sub-title="先完成前一页，再来挑战这里">
        <template #extra><el-button @click="goChapter">返回章节</el-button></template>
      </el-result>

      <template v-else-if="chapter && page">
        <section v-if="mode === 'learn'" class="learn-view">
          <div class="map-root">
            <strong>{{ page.title }}</strong>
            <span>点击单词卡查看释义与词根词缀</span>
          </div>
          <div class="map-trunk"></div>
          <div class="word-map">
            <button
              v-for="(word, index) in page.words"
              :key="`${word.sourceId}-${index}`"
              type="button"
              class="word-node"
              :class="{revealed: revealed.has(index)}"
              @click="toggleReveal(index)"
            >
              <span class="word-spelling">
                <span v-for="(component, componentIndex) in components(word.text)" :key="componentIndex" :class="`affix-${component.type}`">{{ component.text }}</span>
              </span>
              <span v-if="word.phonetic" class="word-phonetic">{{ word.phonetic }}</span>
              <span class="word-explains">{{ revealed.has(index) ? word.explains : '点击显示释义' }}</span>
              <span v-if="revealed.has(index) && affixMeanings(word.text)" class="word-affixes">{{ affixMeanings(word.text) }}</span>
            </button>
          </div>
          <div class="start-action">
            <el-button type="primary" size="large" @click="startPractice">开始本页闯关</el-button>
            <p>没记住的词会在本轮末尾重出，全部记住一次即过关。</p>
          </div>
        </section>

        <section v-else-if="mode === 'practice'" class="practice-view">
          <div class="practice-progress">
            <span>已记住 <strong>{{ masteredCount }}</strong> / {{ page.words.length }}</span>
            <span>重出 {{ wrongAttempts }} 次</span>
          </div>
          <div v-if="currentWord" class="practice-card">
            <div class="practice-label">看单词，回忆释义</div>
            <div class="practice-word">{{ currentWord.text }}</div>
            <div v-if="currentWord.phonetic" class="practice-phonetic">{{ currentWord.phonetic }}</div>
            <div v-if="answerVisible" class="practice-answer">
              <div class="practice-components">
                <span v-for="(component, index) in components(currentWord.text)" :key="index" :class="`affix-${component.type}`">{{ component.text }}</span>
              </div>
              <strong>{{ currentWord.explains }}</strong>
              <p v-if="affixMeanings(currentWord.text)">{{ affixMeanings(currentWord.text) }}</p>
              <div class="practice-actions">
                <el-button type="danger" plain @click="assess(false)">没记住，稍后再来</el-button>
                <el-button type="primary" @click="assess(true)">记住了</el-button>
              </div>
            </div>
            <el-button v-else type="primary" plain @click="answerVisible = true">显示释义</el-button>
          </div>
          <el-result v-else icon="warning" title="成绩尚未保存" sub-title="网络或存储出现异常，请重试保存">
            <template #extra><el-button type="primary" :loading="saving" @click="finishPractice">重试保存</el-button></template>
          </el-result>
          <el-button class="back-learn" text @click="mode = 'learn'">返回词图</el-button>
        </section>

        <section v-else class="finish-view">
          <el-result icon="success" :title="`本页过关 · ${finishedScore} 分`" :sub-title="`${page.words.length} 个单词均已记住一次 · 重出 ${wrongAttempts} 次`">
            <template #extra>
              <el-button type="primary" @click="goNext">{{ nextActionText }}</el-button>
              <el-button @click="startPractice">再练一遍</el-button>
            </template>
          </el-result>
        </section>
      </template>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {useWordBookStore} from '@/stores/wordBook';
import {advanceWordBookPractice} from '@/utils/word-book';
import {analyzeWord, generateSimpleTooltip} from '@/utils/word-analysis';
import type {WordBookWord} from '@/types/word-book';

const route = useRoute();
const router = useRouter();
const store = useWordBookStore();
const chapterId = computed(() => String(route.params.chapterId || ''));
const pageId = computed(() => String(route.params.pageId || ''));
const chapter = computed(() => store.getChapter(chapterId.value));
const page = computed(() => chapter.value?.pages.find(item => item.id === pageId.value));
const allowed = computed(() => store.pageUnlocked(chapterId.value, pageId.value));

const mode = ref<'learn' | 'practice' | 'finished'>('learn');
const revealed = ref<Set<number>>(new Set());
const remaining = ref<WordBookWord[]>([]);
const masteredCount = ref(0);
const wrongAttempts = ref(0);
const answerVisible = ref(false);
const saving = ref(false);
const finishedScore = ref(0);
const currentWord = computed(() => remaining.value[0]);
const nextPage = computed(() => {
  const index = chapter.value?.pages.findIndex(item => item.id === pageId.value) ?? -1;
  return index >= 0 ? chapter.value?.pages[index + 1] : undefined;
});
const nextChapter = computed(() => {
  const index = store.chapters.findIndex(item => item._id === chapterId.value);
  return index >= 0 ? store.chapters[index + 1] : undefined;
});
const nextActionText = computed(() => nextPage.value ? '进入下一页' : nextChapter.value ? '进入下一章' : '返回章节列表');

onMounted(() => {
  void store.loadChapters().catch(() => ElMessage.error('学习页读取失败'));
});

watch(() => route.fullPath, () => {
  mode.value = 'learn';
  revealed.value = new Set();
  remaining.value = [];
  answerVisible.value = false;
});

function components(text: string) {
  if (/\s/.test(text.trim())) return [{text, type: 'whole' as const}];
  return analyzeWord(text);
}

function affixMeanings(text: string): string {
  return generateSimpleTooltip(analyzeWord(text));
}

function toggleReveal(index: number) {
  const next = new Set(revealed.value);
  if (next.has(index)) next.delete(index);
  else next.add(index);
  revealed.value = next;
}

function startPractice() {
  if (!page.value) return;
  remaining.value = page.value.words.map(word => ({...word}));
  masteredCount.value = 0;
  wrongAttempts.value = 0;
  answerVisible.value = false;
  finishedScore.value = 0;
  mode.value = 'practice';
}

async function assess(remembered: boolean) {
  if (!answerVisible.value || !currentWord.value || !page.value) return;
  remaining.value = advanceWordBookPractice(remaining.value, remembered);
  if (remembered) masteredCount.value += 1;
  else wrongAttempts.value += 1;
  answerVisible.value = false;
  if (masteredCount.value === page.value.words.length) await finishPractice();
}

async function finishPractice() {
  if (!page.value || saving.value) return;
  saving.value = true;
  const total = page.value.words.length;
  const score = Math.round(total / (total + wrongAttempts.value) * 100);
  try {
    const result = await store.completePage(chapterId.value, pageId.value, wrongAttempts.value);
    if (!result.ok) {
      ElMessage.error(result.message || '成绩保存失败，请重试');
      return;
    }
    finishedScore.value = score;
    mode.value = 'finished';
  } catch {
    ElMessage.error('成绩保存失败，请重试');
  } finally {
    saving.value = false;
  }
}

function goChapter() {
  router.push(`/word-book/${chapterId.value}`);
}

function goNext() {
  if (nextPage.value) router.push(`/word-book/${chapterId.value}/page/${nextPage.value.id}`);
  else if (nextChapter.value) router.push(`/word-book/${nextChapter.value._id}`);
  else router.push('/word-book');
}
</script>

<style scoped lang="scss">
.word-book-page {
  min-height: 100vh;
  padding: 18px 4% 32px;
  box-sizing: border-box;
  background: var(--utools-bg-secondary);
}

.page-header,
.page-content {
  max-width: 1080px;
  margin: 0 auto;
}

.page-header {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;

  h2 {
    margin: 0;
    color: var(--utools-text-primary);
    font-size: 19px;
  }

  p {
    margin: 4px 0 0;
    color: var(--utools-text-tertiary);
    font-size: 12px;
  }
}

.page-content {
  min-height: 180px;
}

.map-root {
  width: fit-content;
  max-width: 90%;
  margin: 0 auto;
  padding: 12px 24px;
  display: flex;
  flex-direction: column;
  align-items: center;
  color: var(--utools-text-primary);
  background: var(--utools-bg-card);
  border: 2px solid var(--utools-primary);
  border-radius: 12px;

  strong {
    font-size: 17px;
  }

  span {
    margin-top: 4px;
    color: var(--utools-text-tertiary);
    font-size: 11px;
  }
}

.map-trunk {
  width: 2px;
  height: 24px;
  margin: 0 auto;
  background: var(--utools-primary);
}

.word-map {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 22px 16px;
  padding-top: 24px;

  &::before {
    content: '';
    position: absolute;
    top: 0;
    left: 16.66%;
    right: 16.66%;
    height: 2px;
    background: var(--utools-primary);
  }
}

.word-node {
  position: relative;
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 16px 12px;
  cursor: pointer;
  color: var(--utools-text-primary);
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 10px;
  font: inherit;
  text-align: center;

  &::before {
    content: '';
    position: absolute;
    top: -24px;
    left: 50%;
    width: 2px;
    height: 24px;
    background: var(--utools-primary);
  }

  &:hover,
  &.revealed {
    border-color: var(--utools-primary);
  }

  .word-spelling {
    font-size: 20px;
    line-height: 1.4;
    word-break: break-word;
  }

  .word-phonetic {
    margin-top: 4px;
    color: var(--utools-text-tertiary);
    font-size: 12px;
  }

  .word-explains {
    margin-top: 10px;
    color: var(--utools-text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }

  .word-affixes {
    margin-top: 8px;
    color: var(--utools-primary);
    font-size: 11px;
    line-height: 1.5;
  }
}

.affix-root {
  color: var(--utools-primary);
  font-weight: 700;
  border-bottom: 2px solid var(--utools-primary);
}

.affix-prefix,
.affix-suffix {
  color: var(--utools-text-secondary);
  text-decoration: underline;
  text-decoration-style: dotted;
  text-underline-offset: 3px;
}

.start-action {
  margin-top: 26px;
  text-align: center;

  p {
    margin: 8px 0 0;
    color: var(--utools-text-tertiary);
    font-size: 12px;
  }
}

.practice-view {
  max-width: 680px;
  margin: 0 auto;
  text-align: center;
}

.practice-progress {
  display: flex;
  justify-content: center;
  gap: 24px;
  margin-bottom: 16px;
  color: var(--utools-text-secondary);
  font-size: 13px;

  strong {
    color: var(--utools-primary);
    font-size: 20px;
  }
}

.practice-card {
  padding: 34px 24px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 12px;

  .practice-label {
    color: var(--utools-text-tertiary);
    font-size: 12px;
  }

  .practice-word {
    margin-top: 18px;
    color: var(--utools-text-primary);
    font-size: 34px;
    font-weight: 600;
    word-break: break-word;
  }

  .practice-phonetic {
    margin: 8px 0 22px;
    color: var(--utools-text-tertiary);
  }

  .practice-answer {
    margin-top: 20px;
    padding-top: 20px;
    border-top: 1px solid var(--utools-border-divider);

    strong {
      display: block;
      margin-top: 12px;
      color: var(--utools-text-primary);
      font-size: 18px;
      line-height: 1.6;
    }

    p {
      color: var(--utools-primary);
      font-size: 12px;
    }
  }

  .practice-components {
    font-size: 22px;
  }

  .practice-actions {
    display: flex;
    justify-content: center;
    gap: 10px;
    margin-top: 24px;
  }
}

.back-learn {
  margin-top: 12px;
}

@media (max-width: 760px) {
  .word-map {
    grid-template-columns: repeat(2, minmax(0, 1fr));

    &::before {
      left: 25%;
      right: 25%;
    }
  }
}

@media (max-width: 480px) {
  .word-map {
    grid-template-columns: 1fr;

    &::before {
      display: none;
    }
  }

  .practice-actions {
    flex-direction: column;
  }
}
</style>
