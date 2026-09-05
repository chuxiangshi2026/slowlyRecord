<template>
  <div class="number-memory-page">
    <!-- 页面标题栏 -->
    <div class="page-header">
      <span class="page-title">🧠 数字记忆训练</span>
      <div class="header-actions">
        <span v-if="dueCount > 0" class="due-badge" title="有到期待复习的条目，点击查看" @click="goToEntries(true)">
          ⏰ {{ dueCount }} 条到期待复习
        </span>
        <el-button size="small" @click="showGuide = true">
          ❓ 使用帮助
        </el-button>
      </div>
    </div>

    <!-- 未完成的训练进度 -->
    <el-alert
      v-if="unfinishedProgress"
      :title="unfinishedProgressTitle"
      type="warning"
      :closable="false"
      show-icon
      class="progress-alert"
    >
      <template #default>
        <el-button type="primary" size="small" @click="continueTraining">
          继续训练
        </el-button>
        <el-button size="small" @click="abandonProgress">
          放弃进度
        </el-button>
      </template>
    </el-alert>

    <!-- 训练区 -->
    <el-card class="section-card">
      <template #header>
        <span class="section-title">🎯 训练</span>
      </template>
      <div class="mode-cards">
        <div
          class="mode-card"
          :class="{ disabled: !canStartTraining }"
          @click="goToTraining('numberToImage')"
        >
          <div class="mode-icon">🔢➡️🖼️</div>
          <div class="mode-name">数字 → 图片</div>
          <div class="mode-desc">看到数字，选择对应的图片</div>
          <el-tag v-if="!canStartTraining" type="info" size="small">请先保存至少4个数字关联</el-tag>
        </div>
        <div
          class="mode-card"
          :class="{ disabled: !canStartTraining }"
          @click="goToTraining('imageToNumber')"
        >
          <div class="mode-icon">🖼️➡️🔢</div>
          <div class="mode-name">图片 → 数字</div>
          <div class="mode-desc">看到图片，选择对应的数字</div>
          <el-tag v-if="!canStartTraining" type="info" size="small">请先保存至少4个数字关联</el-tag>
        </div>
        <div class="mode-card" @click="goToTraining('randomSequence')">
          <div class="mode-icon">🎲</div>
          <div class="mode-name">随机序列</div>
          <div class="mode-desc">限时记忆随机数字串，逐级加长</div>
        </div>
      </div>
    </el-card>

    <!-- 管理区 -->
    <el-card class="section-card">
      <template #header>
        <span class="section-title">🛠️ 管理</span>
      </template>
      <div class="manage-list">
        <div class="manage-item" @click="goToEntries()">
          <span class="manage-icon">📝</span>
          <div class="manage-info">
            <div class="manage-name">数字记忆条目</div>
            <div class="manage-desc">管理要记忆的电话号码、纪念日等数字条目</div>
          </div>
          <el-icon class="manage-arrow"><ArrowRight /></el-icon>
        </div>
        <div class="manage-item" @click="goToMapping">
          <span class="manage-icon">🖼️</span>
          <div class="manage-info">
            <div class="manage-name">数字-图片映射设置</div>
            <div class="manage-desc">
              已配置 {{ store.associationCount }} 个映射，支持导出图片与打印
            </div>
          </div>
          <el-icon class="manage-arrow"><ArrowRight /></el-icon>
        </div>
      </div>
    </el-card>

    <!-- 训练历史 -->
    <el-card class="section-card">
      <template #header>
        <span class="section-title">📊 训练历史</span>
      </template>
      <div class="history-summary">
        <span class="history-count">共 {{ trainingHistory.length }} 次训练记录</span>
        <el-button size="small" @click="showHistory = true">
          查看训练历史
        </el-button>
      </div>
    </el-card>

    <!-- 数学类知识表（乘法表/元素周期表/公式等） -->
    <el-card class="section-card knowledge-card">
      <template #header>
        <span class="section-title">📚 知识表</span>
      </template>
      <KnowledgePackPanel category="math" />
    </el-card>

    <!-- 底部工具栏：返回单词列表 -->
    <div class="home_footer">
      <div>
        <span class="footer-stat" @click="goBack">
          <i class="iconfont icon-left"></i>
          返回
        </span>
      </div>
      <div></div>
    </div>

    <!-- 训练状态弹窗 -->
    <TrainingHistory
      v-model="showHistory"
      :history="trainingHistory"
      :progress="unfinishedProgress"
      @clear="clearTrainingHistory"
      @continue="continueTraining"
      @abandon="abandonProgress"
    />

    <!-- 新手引导 -->
    <QuickStartGuide v-model="showGuide" @finish="onGuideFinish" />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useNumberMemoryStore } from "@/stores/numberMemory";
import { useWordsStore } from "@/stores/words";
import { ElMessage } from "element-plus";
import { ArrowRight } from "@element-plus/icons-vue";
import TrainingHistory from "./components/TrainingHistory.vue";
import QuickStartGuide from "./components/QuickStartGuide.vue";
import KnowledgePackPanel from "@/views/TextMemory/components/KnowledgePackPanel.vue";
import type { TrainingResult } from "@/types/number-memory";
import { clearAllTrainingResults, getTrainingProgress, clearTrainingProgress } from "@/utils/number-memory-db";

const router = useRouter();
const store = useNumberMemoryStore();
const wordsStore = useWordsStore();

// State
const showHistory = ref(false);
const showGuide = ref(false);
const trainingHistory = ref<TrainingResult[]>([]);
const unfinishedProgress = ref<{ mode: string; current: number; total: number } | null>(null);

// Computed
const unfinishedProgressTitle = computed(() => {
  if (!unfinishedProgress.value) return '';
  const modeText = unfinishedProgress.value.mode === 'numberToImage' ? '数字→图片' : '图片→数字';
  return `未完成的训练：${modeText}（第 ${unfinishedProgress.value.current}/${unfinishedProgress.value.total} 题）`;
});

// 与训练页一致：数字→图片 / 图片→数字 模式需要至少 4 个数字关联
const canStartTraining = computed(() => store.associationCount >= 4);

// 到期条目数（角标用，为 0 不显示）
const dueCount = computed(() => store.dueEntries.length);

// Methods
function goToTraining(mode: "numberToImage" | "imageToNumber" | "randomSequence") {
  if (mode !== "randomSequence" && !canStartTraining.value) {
    ElMessage.warning("请先保存至少4个数字-图片关联");
    return;
  }
  router.push("/number-memory/training");
}

function continueTraining() {
  router.push("/number-memory/training");
}

function abandonProgress() {
  clearTrainingProgress();
  unfinishedProgress.value = null;
  ElMessage.info("已放弃训练进度");
}

function goToEntries(onlyDue = false) {
  router.push(onlyDue ? '/number-memory/entries?due=1' : '/number-memory/entries');
}

function goToMapping() {
  router.push("/number-memory/mapping");
}

function goBack() {
  router.push("/word");
}

// 加载训练历史和未完成的进度
function loadTrainingHistory() {
  trainingHistory.value = store.getTrainingHistory();

  const progress = getTrainingProgress();
  if (progress && progress.questions.length > 0) {
    unfinishedProgress.value = {
      mode: progress.mode,
      current: progress.currentQuestionIndex + 1,
      total: progress.questions.length
    };
  } else {
    unfinishedProgress.value = null;
  }
}

// 清空训练历史
async function clearTrainingHistory() {
  clearAllTrainingResults();
  trainingHistory.value = [];
  showHistory.value = false;
  ElMessage.success("训练历史已清空");
}

function onGuideFinish() {
  showGuide.value = false;
}

onMounted(() => {
  loadTrainingHistory();

  // 加载条目以计算到期角标
  store.loadEntries();

  // 检查是否是首次使用
  const guideShown = localStorage.getItem("numberMemoryGuideShown");
  if (!guideShown) {
    showGuide.value = true;
  }

  // 记录最后访问的页面
  wordsStore.setLastVisitedPage('/number-memory');
});
</script>

<style scoped lang="scss">
.number-memory-page {
  padding: 20px;
  padding-bottom: 75px; // 为底部工具栏留出空间
  width: 100%;
  box-sizing: border-box;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);

  .page-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 15px;

    .page-title {
      font-size: 18px;
      font-weight: bold;
      color: var(--utools-text-primary);
    }

    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    // 到期复习角标（语义警示色，点击跳转条目页并开启「仅看到期」）
    .due-badge {
      display: inline-flex;
      align-items: center;
      font-size: 12px;
      color: var(--el-color-warning);
      border: 1px solid var(--el-color-warning);
      border-radius: 12px;
      padding: 2px 10px;
      cursor: pointer;
      transition: all 0.2s;
      white-space: nowrap;

      &:hover {
        background-color: var(--el-color-warning-light-9);
      }
    }
  }

  .progress-alert {
    margin-bottom: 15px;

    .el-button {
      margin-left: 10px;
    }
  }

  .section-card {
    margin-bottom: 15px;
    background-color: var(--utools-bg-card);
    border-color: var(--utools-border-primary);

    .section-title {
      font-weight: bold;
      color: var(--utools-text-primary);
    }
  }

  // ---- 训练区：模式卡片 ----
  .mode-cards {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
    gap: 15px;

    .mode-card {
      border: 2px solid var(--utools-border-primary);
      border-radius: 8px;
      padding: 15px;
      text-align: center;
      cursor: pointer;
      transition: all 0.3s;
      background-color: var(--utools-bg-card);

      &:hover {
        border-color: var(--utools-primary);
        transform: translateY(-2px);
      }

      &.disabled {
        opacity: 0.6;
        cursor: not-allowed;

        &:hover {
          border-color: var(--utools-border-primary);
          transform: none;
        }
      }

      .mode-icon {
        font-size: 32px;
        margin-bottom: 8px;
      }

      .mode-name {
        font-weight: bold;
        font-size: 15px;
        margin-bottom: 4px;
        color: var(--utools-text-primary);
      }

      .mode-desc {
        font-size: 12px;
        color: var(--utools-text-tertiary);
        margin-bottom: 6px;
      }
    }
  }

  // ---- 管理区：入口列表 ----
  .manage-list {
    display: flex;
    flex-direction: column;
    gap: 10px;

    .manage-item {
      display: flex;
      align-items: center;
      gap: 12px;
      border: 1px solid var(--utools-border-primary);
      border-radius: 8px;
      padding: 12px 15px;
      cursor: pointer;
      transition: all 0.2s;
      background-color: var(--utools-bg-card);

      &:hover {
        border-color: var(--utools-primary);

        .manage-arrow {
          color: var(--utools-primary);
        }
      }

      .manage-icon {
        font-size: 24px;
        flex-shrink: 0;
      }

      .manage-info {
        flex: 1;
        min-width: 0;

        .manage-name {
          font-weight: bold;
          font-size: 14px;
          color: var(--utools-text-primary);
          margin-bottom: 2px;
        }

        .manage-desc {
          font-size: 12px;
          color: var(--utools-text-tertiary);
        }
      }

      .manage-arrow {
        color: var(--utools-text-tertiary);
        flex-shrink: 0;
      }
    }
  }

  // ---- 训练历史 ----
  .history-summary {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .history-count {
      font-size: 13px;
      color: var(--utools-text-secondary);
    }
  }

  .knowledge-card {
    // 面板内卡片在 el-card 中拉通宽度
    :deep(.knowledge-pack-panel) {
      padding: 0;

      .knowledge-pack-card {
        width: 100%;
      }
    }
  }

  // ---- 底部工具栏（复用条目页的 home_footer 结构） ----
  .home_footer {
    position: fixed;
    bottom: 0;
    left: 0;
    right: 0;
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    background-color: var(--utools-bg-card);
    height: 55px;
    border-top: 1px solid var(--utools-border-divider);
    padding: 0 12px;
    box-sizing: border-box;
    color: var(--utools-text-primary);
    z-index: 20;

    > div {
      display: flex;
      align-items: center;
      gap: 6px;
    }

    .footer-stat {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 13px;
      color: var(--utools-text-secondary);
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        color: var(--utools-primary);
      }

      i {
        font-size: 14px;
      }
    }
  }
}
</style>
