<template>
  <div class="app-header">
    <span class="page-name">{{ pageTitle }}</span>

    <!-- 更多：模块导航抽屉，所有页面可达 -->
    <span class="header-action" title="更多功能" @click="uiStore.moreDrawerVisible = true">☰</span>

    <!-- 非单词页：当前模块的一句话状态摘要 -->
    <span v-if="!isWordPage && pageSummary" class="page-summary">{{ pageSummary }}</span>

    <span class="spacer"></span>

    <!-- 同步异常状态点：正常不显示；同步失败/有未同步改动时红色，同步中灰色 -->
    <span
        v-if="syncDotVisible"
        class="sync-dot"
        :class="{ busy: isSyncing, unsynced: syncUnsynced && !isSyncing }"
        :title="syncDotTitle"
        @click="uiStore.openSyncDialog()"
    ></span>

    <!-- 设置：任意页面可达；从其他页面点击会先回单词页再打开设置抽屉 -->
    <span class="header-action" title="设置" @click="openSettings">⋯</span>

    <!-- 打卡 streak：点击进入打卡页 -->
    <span class="streak" :class="{ bumped: streakBumped }" title="连续打卡，点击查看打卡页" @click="goSign">
      🔥 {{ signinStore.streakDays }} 天
    </span>

    <!-- 非主页：返回 -->
    <span v-if="!isWordPage" class="back" @click="goWord">← 返回</span>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref, watch} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {useWordsStore} from '@/stores/words';
import {useSigninStore} from '@/stores/signin';
import {useSyncStore} from '@/stores/sync';
import {useUiStore} from '@/stores/ui';
import {useNumberMemoryStore} from '@/stores/numberMemory';
import {useTextMemoryStore} from '@/stores/textMemory';
import {useSentencesStore} from '@/stores/sentences';
import {useMemoryStore} from '@/stores/memory';
import {useKnowledgeMemoryStore} from '@/stores/knowledgeMemory';
import {refreshSyncDirty, syncDirty} from '@/utils/sync-dirty';
import {ElMessage} from 'element-plus';

const route = useRoute();
const router = useRouter();
const wordsStore = useWordsStore();
const signinStore = useSigninStore();
const syncStore = useSyncStore();
const uiStore = useUiStore();

// 同步状态点：同步中灰色常显；失败或有未同步改动时提示，点击打开同步弹窗
const isSyncing = computed(() => syncStore.status === 'uploading' || syncStore.status === 'downloading');
const syncFailed = computed(() => /失败/.test(syncStore.resultMessage || ''));
const syncUnsynced = computed(() => syncDirty.value);
const syncDotVisible = computed(() => isSyncing.value || syncFailed.value || syncUnsynced.value);
const syncDotTitle = computed(() => {
  if (syncFailed.value) return `同步异常：${syncStore.resultMessage}`;
  if (syncUnsynced.value) return '有未同步改动，点击同步';
  return '正在同步…';
});

// 非单词页顶部状态摘要：按当前路由懒取对应 store，避免首页提前初始化各模块数据
const pageSummary = computed(() => {
  switch (route.name) {
    case 'numberMemory': {
      const s = useNumberMemoryStore();
      const due = s.dueEntries.length;
      return due > 0 ? `⏰ ${due} 条到期` : '';
    }
    case 'textMemory': {
      const s = useTextMemoryStore();
      if (s.currentArticle) {
        const remaining = s.getCurrentArticleRemainingSegments();
        return remaining > 0
          ? `《${s.currentArticle.title}》还剩 ${remaining} 段`
          : `《${s.currentArticle.title}》已练完 🎉`;
      }
      return s.totalArticles > 0 ? `已收集 ${s.totalArticles} 篇` : '';
    }
    case 'sentences': {
      const s = useSentencesStore();
      return s.sentences.length > 0 ? `已收集 ${s.sentences.length} 句` : '';
    }
    case 'memory': {
      const s = useMemoryStore();
      return s.totalTests > 0 ? `已完成 ${s.totalTests} 次` : '';
    }
    case 'knowledgeMemory': {
      const s = useKnowledgeMemoryStore();
      const imported = s.importedIds.length;
      const due = s.importedIds.reduce((sum, id) => sum + s.getDueCount(id), 0);
      if (imported === 0) return '';
      return due > 0 ? `${imported} 个包 · 待复习 ${due} 条` : `${imported} 个包`;
    }
    case 'dictation':
      return wordsStore.forgetCount > 0 ? `待复习 ${wordsStore.forgetCount}` : '今日复习已完成 🎉';
    case 'sign': {
      const now = new Date();
      const monthDays = signinStore.monthSignDays(now.getFullYear(), now.getMonth());
      return `连续 ${signinStore.streakDays} 天 · 本月 ${monthDays} 天`;
    }
    default:
      return '';
  }
});

const isWordPage = computed(() => route.name === 'word');
const pageTitle = computed(() => (route.meta?.title as string) || '慢记');

const goSign = () => router.push('/sign');
const goWord = () => router.push('/word');

// 设置入口：任意页面直接打开全局设置抽屉（挂在 Home 层，不再先回单词页）
const openSettings = () => {
  uiStore.settingsDrawerVisible = true;
};

// 今日首次复习/添加后，轻提示连续打卡天数并触发头部动画
const congratsShown = ref(false);
const streakBumped = ref(false);
const headerMounted = ref(false);

watch(
  () => signinStore.hasSignedToday,
  (hasSigned) => {
    // 仅在应用启动并完成初始化后，由 false -> true 的第一次变化触发
    if (headerMounted.value && hasSigned && !congratsShown.value) {
      congratsShown.value = true;
      streakBumped.value = true;
      ElMessage.success(`已连续打卡 ${signinStore.streakDays} 天`);
      setTimeout(() => {
        streakBumped.value = false;
      }, 1200);
    }
  }
);

onMounted(() => {
  signinStore.loadRecords();
  refreshSyncDirty();
  // 避免应用在已打卡状态下重新打开时重复提示
  setTimeout(() => {
    headerMounted.value = true;
  }, 300);
});
</script>

<style scoped lang="scss">
.app-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  font-size: 13px;
  color: var(--utools-text-secondary);
  background: var(--utools-bg-primary);
  border-bottom: 1px solid var(--utools-border-divider);
  user-select: none;

  .page-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--utools-primary);
    margin-right: 10px;
  }

  .page-summary {
    font-size: 12px;
    color: var(--utools-text-tertiary);
  }

  .spacer {
    flex: 1;
  }

  .sync-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #e6a23c;
    margin-right: 6px;
    cursor: pointer;
    flex: none;

    &.busy {
      background: var(--utools-text-tertiary);
      animation: sync-pulse 1.2s ease-in-out infinite;
    }

    &.unsynced {
      background: var(--el-color-warning);
    }
  }

  @keyframes sync-pulse {
    0%, 100% { opacity: 0.35; }
    50% { opacity: 1; }
  }

  .header-action {
    cursor: pointer;
    padding: 0 6px;
    border-radius: 6px;
    font-size: 16px;
    line-height: 1;
    color: var(--utools-text-tertiary);

    &:hover {
      background: var(--utools-bg-hover);
      color: var(--utools-text-primary);
    }
  }

  .streak {
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 6px;
    color: #b07503;
    transition: transform 0.2s;

    &:hover {
      background: var(--utools-bg-hover);
    }

    &.bumped {
      animation: streak-bump 1.2s ease;
    }
  }

  @keyframes streak-bump {
    0%, 100% { transform: scale(1); }
    25% { transform: scale(1.25); }
    50% { transform: scale(0.95); }
    75% { transform: scale(1.1); }
  }

  .back {
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 6px;
    color: var(--utools-primary);

    &:hover {
      background: var(--utools-bg-hover);
    }
  }
}
</style>
