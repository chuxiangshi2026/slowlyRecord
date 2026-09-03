<template>
  <div class="palace-review-page">
    <!-- 顶部进度条 -->
    <div class="review-header">
      <span class="footer-stat" @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        退出巡视
      </span>
      <span class="review-progress">{{ currentIndex + 1 }} / {{ total }}</span>
    </div>

    <div v-if="!palace" class="review-body">
      <el-empty description="宫殿不存在或已被删除" />
    </div>

    <!-- 巡视完成 -->
    <div v-else-if="finished" class="review-body finished-body">
      <el-result
        icon="success"
        title="巡视完成"
        :sub-title="`记住 ${stats.remembered} · 忘记 ${stats.forgotten} · 跳过 ${stats.skipped}`"
      >
        <template #extra>
          <el-button type="primary" @click="restart">再来一轮</el-button>
          <el-button @click="goBack">返回宫殿</el-button>
        </template>
      </el-result>
    </div>

    <!-- 巡视主体 -->
    <div v-else-if="currentLocus" class="review-body">
      <div class="locus-stage" @click="showAnswer">
        <img v-if="currentLocus.imageUrl" :src="currentLocus.imageUrl" class="stage-image" alt="桩图片" />
        <div class="stage-order">#{{ currentLocus.order }}</div>
        <h2 class="stage-name">{{ currentLocus.name }}</h2>
        <p v-if="currentLocus.description" class="stage-desc">{{ currentLocus.description }}</p>
      </div>

      <!-- 答案区：点击/下滑显示 -->
      <transition name="el-fade-in">
        <div v-if="answerVisible" class="answer-area">
          <template v-if="resolvedContent.deleted">
            <span class="answer-deleted">内容已删除</span>
          </template>
          <template v-else-if="resolvedContent.text">
            <p class="answer-text">{{ resolvedContent.text }}</p>
            <p v-if="resolvedContent.articleTitle" class="answer-source">
              —— 《{{ resolvedContent.articleTitle }}》
            </p>
            <p v-if="currentPeg?.mnemonic" class="answer-mnemonic">
              助记：{{ currentPeg.mnemonic }}
            </p>
          </template>
          <span v-else class="answer-none">该桩未挂载内容</span>
        </div>
      </transition>
      <p v-if="!answerVisible" class="reveal-tip">口头回忆挂载内容，点击卡片查看答案</p>

      <!-- 自评按钮 -->
      <div class="assess-actions">
        <template v-if="answerVisible && currentPeg && !resolvedContent.deleted">
          <el-button type="danger" plain size="large" @click="assess(false)">忘记</el-button>
          <el-button type="success" size="large" @click="assess(true)">记住</el-button>
        </template>
        <el-button v-else-if="answerVisible" size="large" @click="next">下一个</el-button>
      </div>
    </div>

    <!-- 底部导航 -->
    <div v-if="palace && !finished" class="review-nav">
      <el-button text :disabled="currentIndex === 0" @click="prev">
        <el-icon><ArrowLeft /></el-icon>
        上一个
      </el-button>
      <el-button text @click="next">
        跳过
        <el-icon><ArrowRight /></el-icon>
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRoute, useRouter} from 'vue-router';
import {ArrowLeft, ArrowRight} from '@element-plus/icons-vue';
import {ElMessage} from 'element-plus';
import {useMemoryPalaceStore} from '@/stores/memoryPalace';
import {useTextMemoryStore} from '@/stores/textMemory';
import {resolvePegContent} from '@/utils/memory-palace-util';
import type {PalaceLocus, ResolvedPegContent} from '@/types/memory-palace';

const route = useRoute();
const router = useRouter();
const store = useMemoryPalaceStore();
const textStore = useTextMemoryStore();

const palaceId = route.params.id as string;

const currentIndex = ref(0);
const answerVisible = ref(false);
const finished = ref(false);
const stats = ref({remembered: 0, forgotten: 0, skipped: 0});
// 记录已评/已跳过的桩序号，防止返回重新自评时重复累加统计
const rememberedOrders = ref<Set<number>>(new Set());
const forgottenOrders = ref<Set<number>>(new Set());
const skippedOrders = ref<Set<number>>(new Set());

const palace = computed(() => store.currentPalace);

// 按顺序排列的桩
const sortedLoci = computed<PalaceLocus[]>(() => {
  if (!palace.value) return [];
  return [...palace.value.loci].sort((a, b) => a.order - b.order);
});

const total = computed(() => sortedLoci.value.length);
const currentLocus = computed(() => sortedLoci.value[currentIndex.value] || null);

// 当前桩的挂载与解析内容
const currentPeg = computed(() => {
  if (!currentLocus.value) return undefined;
  return store.getPegByLocus(currentLocus.value.order);
});

const resolvedContent = computed<ResolvedPegContent>(() => {
  if (!currentPeg.value) return {text: '', deleted: false};
  return resolvePegContent(currentPeg.value, textStore.articles);
});

onMounted(async () => {
  await store.loadPalaces();
  await store.loadPegs(palaceId);
  await textStore.loadArticles();
  if (total.value === 0) {
    finished.value = true;
  }
});

function showAnswer() {
  answerVisible.value = true;
}

// 自评并进入下一桩
async function assess(remembered: boolean) {
  const peg = currentPeg.value;
  const order = currentLocus.value?.order;
  if (peg) {
    const result = await store.assessPeg(peg, remembered);
    if (!result.ok) {
      ElMessage.error('自评结果保存失败，请重试');
      return;
    }
  }
  // 按桩序号去重统计，返回上一桩重新自评不重复计数
  if (order !== undefined) {
    if (remembered) {
      if (!rememberedOrders.value.has(order)) {
        rememberedOrders.value.add(order);
        stats.value.remembered++;
      }
      // 从跳过/忘记集合中移除，保证最终统计只计一次
      if (skippedOrders.value.delete(order)) stats.value.skipped--;
      if (forgottenOrders.value.delete(order)) stats.value.forgotten--;
    } else {
      if (!forgottenOrders.value.has(order)) {
        forgottenOrders.value.add(order);
        stats.value.forgotten++;
      }
      if (skippedOrders.value.delete(order)) stats.value.skipped--;
      if (rememberedOrders.value.delete(order)) stats.value.remembered--;
    }
  }
  next();
}

function next() {
  // 跳过当前桩时计入跳过统计（已评过的桩不再重复计跳过）
  const order = currentLocus.value?.order;
  if (order !== undefined && !rememberedOrders.value.has(order) && !forgottenOrders.value.has(order)) {
    if (!skippedOrders.value.has(order)) {
      skippedOrders.value.add(order);
      stats.value.skipped++;
    }
  }
  answerVisible.value = false;
  if (currentIndex.value >= total.value - 1) {
    finished.value = true;
  } else {
    currentIndex.value++;
  }
}

function prev() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    answerVisible.value = false;
  }
}

function restart() {
  currentIndex.value = 0;
  answerVisible.value = false;
  finished.value = false;
  stats.value = {remembered: 0, forgotten: 0, skipped: 0};
  rememberedOrders.value.clear();
  forgottenOrders.value.clear();
  skippedOrders.value.clear();
}

function goBack() {
  router.push(`/memory-palace/${palaceId}`);
}
</script>

<style scoped lang="scss">
.palace-review-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
  display: flex;
  flex-direction: column;
  box-sizing: border-box;
}

.review-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 40px;
  padding: 0 12px;
  background: var(--utools-bg-card);
  border-bottom: 1px solid var(--utools-border-divider);

  .footer-stat {
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--utools-text-secondary);
  }

  .review-progress {
    font-size: 13px;
    color: var(--utools-text-tertiary);
  }
}

.review-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 20px;
}

.locus-stage {
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  user-select: none;

  .stage-image {
    width: 220px;
    height: 220px;
    object-fit: cover;
    border-radius: 12px;
    border: 1px solid var(--utools-border-divider);
    margin-bottom: 16px;
  }

  .stage-order {
    font-size: 13px;
    color: var(--utools-text-tertiary);
  }

  .stage-name {
    font-size: 28px;
    color: var(--utools-text-primary);
    margin: 4px 0;
  }

  .stage-desc {
    font-size: 14px;
    color: var(--utools-text-secondary);
    margin: 0;
  }
}

.reveal-tip {
  margin-top: 24px;
  font-size: 13px;
  color: var(--utools-text-tertiary);
}

.answer-area {
  margin-top: 20px;
  max-width: 560px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 8px;
  padding: 14px 18px;
  text-align: center;

  .answer-text {
    font-size: 16px;
    color: var(--utools-text-primary);
    margin: 0;
    word-break: break-all;
  }

  .answer-source {
    font-size: 12px;
    color: var(--utools-text-tertiary);
    margin: 6px 0 0 0;
  }

  .answer-mnemonic {
    font-size: 13px;
    color: var(--utools-warning);
    margin: 8px 0 0 0;
  }

  .answer-deleted {
    color: var(--utools-warning);
    font-size: 14px;
  }

  .answer-none {
    color: var(--utools-text-tertiary);
    font-size: 14px;
  }
}

.assess-actions {
  margin-top: 24px;
  display: flex;
  gap: 16px;
}

.review-nav {
  display: flex;
  justify-content: space-between;
  padding: 10px 16px;
  border-top: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-card);
}

.finished-body {
  :deep(.el-result__title p) {
    color: var(--utools-text-primary);
  }
}
</style>
