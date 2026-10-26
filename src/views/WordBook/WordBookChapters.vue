<template>
  <div class="word-book-page">
    <header class="book-header">
      <div>
        <h2>词图闯关</h2>
        <p>一章包含多页；每页所有词记住一次即可过关，完成整章解锁下一章。</p>
      </div>
      <el-button type="primary" @click="goWords">从筛选生成学习页</el-button>
    </header>

    <div v-loading="store.loading" class="chapter-list">
      <el-empty v-if="!store.loading && store.chapters.length === 0" description="还没有词图章节，先从单词页的筛选结果生成" />
      <article
        v-for="(chapter, index) in store.chapters"
        :key="chapter._id"
        class="chapter-card"
        :class="{locked: !store.chapterUnlocked(chapter._id)}"
        @click="openChapter(chapter._id)"
      >
        <div class="chapter-topline">
          <span class="chapter-order">第 {{ index + 1 }} 章</span>
          <el-tag v-if="isComplete(chapter)" size="small" type="success">已完成</el-tag>
          <el-tag v-else-if="!store.chapterUnlocked(chapter._id)" size="small" type="info">未解锁</el-tag>
          <el-tag v-else size="small" type="warning">闯关进行中</el-tag>
        </div>
        <h3>{{ chapter.name }}</h3>
        <p>{{ completedCount(chapter) }} / {{ chapter.pages.length }} 页已过关</p>
        <el-progress :percentage="progress(chapter)" :stroke-width="8" />
        <div class="chapter-actions">
          <el-button text type="danger" size="small" @click.stop="removeChapter(chapter._id, chapter.name)">删除</el-button>
          <el-button text type="primary" size="small">{{ store.chapterUnlocked(chapter._id) ? '进入章节 →' : '先完成上一章' }}</el-button>
        </div>
      </article>
    </div>
  </div>
</template>

<script setup lang="ts">
import {onMounted} from 'vue';
import {useRouter} from 'vue-router';
import {ElMessage, ElMessageBox} from 'element-plus';
import {useWordBookStore} from '@/stores/wordBook';
import {isWordBookChapterComplete} from '@/utils/word-book';
import type {WordBookChapter} from '@/types/word-book';

const router = useRouter();
const store = useWordBookStore();

onMounted(() => {
  void store.loadChapters().catch(() => ElMessage.error('章节读取失败'));
});

function completedCount(chapter: WordBookChapter): number {
  return chapter.pages.filter(page => !!page.completedAt).length;
}

function isComplete(chapter: WordBookChapter): boolean {
  return isWordBookChapterComplete(chapter);
}

function progress(chapter: WordBookChapter): number {
  return chapter.pages.length ? Math.round(completedCount(chapter) / chapter.pages.length * 100) : 0;
}

function openChapter(chapterId: string) {
  if (!store.chapterUnlocked(chapterId)) {
    ElMessage.info('先完成上一章，再来挑战这里');
    return;
  }
  router.push(`/word-book/${chapterId}`);
}

function goWords() {
  router.push('/word');
}

async function removeChapter(chapterId: string, name: string) {
  try {
    await ElMessageBox.confirm(`删除「${name}」及其闯关进度？原词库中的单词不会删除。`, '删除章节', {type: 'warning'});
  } catch {
    return;
  }
  try {
    const result = await store.deleteChapter(chapterId);
    if (result.ok) ElMessage.success('章节已删除');
    else ElMessage.error(result.message || '删除失败');
  } catch {
    ElMessage.error('删除失败，请重试');
  }
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
  margin: 0 auto 18px;

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
  cursor: pointer;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 10px;
  transition: border-color 0.2s, transform 0.2s;

  &:hover {
    border-color: var(--utools-primary);
    transform: translateY(-2px);
  }

  &.locked {
    cursor: not-allowed;
    opacity: 0.62;

    &:hover {
      border-color: var(--utools-border-divider);
      transform: none;
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

  h3 {
    margin: 14px 0 6px;
    color: var(--utools-text-primary);
    font-size: 18px;
  }

  p {
    margin: 0 0 14px;
    color: var(--utools-text-secondary);
    font-size: 13px;
  }

  .chapter-actions {
    margin-top: 8px;
  }
}

@media (max-width: 640px) {
  .book-header {
    align-items: flex-start;
    flex-direction: column;
  }
}
</style>
