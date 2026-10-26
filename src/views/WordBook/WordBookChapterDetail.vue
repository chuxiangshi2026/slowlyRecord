<template>
  <div class="word-book-page">
    <header class="book-header">
      <div>
        <el-button text @click="goList">← 词图章节</el-button>
        <h2>{{ chapter?.name || '章节详情' }}</h2>
        <p v-if="chapter">{{ completedCount }} / {{ chapter.pages.length }} 页已过关 · 按页顺序挑战</p>
      </div>
    </header>

    <div v-loading="store.loading" class="chapter-content">
      <el-empty v-if="!store.loading && !chapter" description="章节不存在或已删除" />
      <el-result v-else-if="chapter && !store.chapterUnlocked(chapterId)" icon="warning" title="本章尚未解锁" sub-title="先完成上一章的全部学习页">
        <template #extra><el-button @click="goList">返回章节列表</el-button></template>
      </el-result>
      <div v-else-if="chapter" class="page-grid">
        <article
          v-for="page in chapter.pages"
          :key="page.id"
          class="page-card"
          :class="{locked: !store.pageUnlocked(chapterId, page.id), completed: !!page.completedAt}"
          @click="openPage(page.id)"
        >
          <div class="page-topline">
            <span class="page-order">PAGE {{ page.order }}</span>
            <span class="page-status">{{ statusText(page.id, page.completedAt) }}</span>
          </div>
          <h3>{{ page.title }}</h3>
          <p class="word-preview">{{ preview(page.words.map(word => word.text)) }}</p>
          <div class="page-meta">
            <span>{{ page.words.length }} 词</span>
            <span v-if="page.bestScore !== undefined">最佳 {{ page.bestScore }} 分</span>
            <span v-else>尚未挑战</span>
          </div>
          <el-button size="small" :disabled="!store.pageUnlocked(chapterId, page.id)">
            {{ page.completedAt ? '再学一遍' : store.pageUnlocked(chapterId, page.id) ? '开始学习' : '完成前页后解锁' }}
          </el-button>
        </article>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ElMessage} from 'element-plus';
import {useWordBookStore} from '@/stores/wordBook';

const route = useRoute();
const router = useRouter();
const store = useWordBookStore();
const chapterId = computed(() => String(route.params.chapterId || ''));
const chapter = computed(() => store.getChapter(chapterId.value));
const completedCount = computed(() => chapter.value?.pages.filter(page => !!page.completedAt).length || 0);

onMounted(() => {
  void store.loadChapters().catch(() => ElMessage.error('章节读取失败'));
});

function preview(words: string[]): string {
  return words.slice(0, 6).join(' · ') + (words.length > 6 ? ' …' : '');
}

function statusText(pageId: string, completedAt?: number): string {
  if (completedAt) return '已过关';
  return store.pageUnlocked(chapterId.value, pageId) ? '待挑战' : '未解锁';
}

function openPage(pageId: string) {
  if (!store.pageUnlocked(chapterId.value, pageId)) {
    ElMessage.info('先完成前一页');
    return;
  }
  router.push(`/word-book/${chapterId.value}/page/${pageId}`);
}

function goList() {
  router.push('/word-book');
}
</script>

<style scoped lang="scss">
.word-book-page {
  min-height: 100vh;
  padding: 20px 4%;
  box-sizing: border-box;
  background: var(--utools-bg-secondary);
}

.book-header,
.chapter-content {
  max-width: 1000px;
  margin: 0 auto;
}

.book-header {
  margin-bottom: 18px;

  h2 {
    margin: 8px 0 0;
    color: var(--utools-text-primary);
    font-size: 20px;
  }

  p {
    margin: 6px 0 0;
    color: var(--utools-text-tertiary);
    font-size: 13px;
  }
}

.chapter-content {
  min-height: 180px;
}

.page-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 14px;
}

.page-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 16px;
  cursor: pointer;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 10px;

  &.completed {
    border-color: var(--utools-primary);
  }

  &.locked {
    cursor: not-allowed;
    opacity: 0.58;
  }

  .page-topline,
  .page-meta {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .page-order {
    color: var(--utools-primary);
    font-size: 11px;
    font-weight: 600;
    letter-spacing: 0.08em;
  }

  .page-status {
    color: var(--utools-text-tertiary);
    font-size: 12px;
  }

  h3 {
    margin: 12px 0 8px;
    color: var(--utools-text-primary);
    font-size: 16px;
  }

  .word-preview {
    flex: 1;
    min-height: 42px;
    margin: 0 0 12px;
    color: var(--utools-text-secondary);
    font-size: 13px;
    line-height: 1.6;
  }

  .page-meta {
    margin-bottom: 12px;
    color: var(--utools-text-tertiary);
    font-size: 12px;
  }
}
</style>
