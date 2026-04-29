<template>
  <el-dialog
    v-model="visible"
    title="📊 训练状态"
    width="700px"
    :close-on-click-modal="false"
  >
    <!-- 未完成的训练进度 -->
    <div v-if="progress" class="progress-section">
      <h4 class="section-title">📝 未完成的训练</h4>
      <el-card class="history-card" size="small">
        <div class="record-header">
          <el-tag :type="progress.mode === 'numberToImage' ? 'primary' : 'success'">
            {{ progress.mode === 'numberToImage' ? '数字→图片' : '图片→数字' }}
          </el-tag>
          <span class="progress-text">
            第 {{ progress.current }}/{{ progress.total }} 题
          </span>
        </div>
        <div class="record-stats">
          <div class="stat">
            <span class="label">状态:</span>
            <span class="value warning">进行中</span>
          </div>
        </div>
        <div class="progress-actions">
          <el-button type="primary" size="small" @click="onContinue">
            继续训练
          </el-button>
          <el-button size="small" @click="onAbandon">
            放弃进度
          </el-button>
        </div>
      </el-card>
    </div>

    <!-- 已完成的训练历史 -->
    <h4 v-if="history.length > 0" class="section-title">📋 已完成记录</h4>
    <div v-if="history.length === 0 && !progress" class="empty-history">
      <el-empty description="暂无训练记录" :image-size="120" />
    </div>
    <div v-else-if="history.length > 0" class="history-content">
      <el-timeline>
        <el-timeline-item
          v-for="(record, index) in history"
          :key="index"
          :type="getTimelineType(record)"
          :timestamp="formatDate(record.createdAt)"
          placement="top"
        >
          <el-card class="history-card" size="small">
            <div class="record-header">
              <el-tag :type="record.mode === 'numberToImage' ? 'primary' : 'success'">
                {{ record.mode === 'numberToImage' ? '数字→图片' : '图片→数字' }}
              </el-tag>
              <span class="accuracy" :class="getAccuracyClass(record)">
                {{ calculateAccuracy(record) }}%
              </span>
            </div>
            <div class="record-stats">
              <div class="stat">
                <span class="label">正确:</span>
                <span class="value correct">{{ record.correctAnswers }}/{{ record.totalQuestions }}</span>
              </div>
              <div class="stat">
                <span class="label">用时:</span>
                <span class="value">{{ formatTime(record.duration) }}</span>
              </div>
              <div class="stat">
                <span class="label">平均:</span>
                <span class="value">{{ calculateAvgTime(record) }}秒/题</span>
              </div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
    </div>
    <template #footer>
      <el-button @click="visible = false">关闭</el-button>
      <el-button type="danger" @click="clearHistory" v-if="history.length > 0">
        清空历史
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import type { TrainingResult } from "@/types/number-memory";

const props = defineProps<{
  modelValue: boolean;
  history: TrainingResult[];
  progress?: {
    mode: string;
    current: number;
    total: number;
  } | null;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: boolean): void;
  (e: "clear"): void;
  (e: "continue"): void;
  (e: "abandon"): void;
}>();

const visible = ref(props.modelValue);

watch(() => props.modelValue, (val) => {
  visible.value = val;
});

watch(visible, (val) => {
  emit("update:modelValue", val);
});

function onContinue() {
  visible.value = false;
  emit("continue");
}

async function onAbandon() {
  try {
    await ElMessageBox.confirm("确定要放弃当前的训练进度吗？", "确认放弃", {
      type: "warning"
    });
    visible.value = false;
    emit("abandon");
    ElMessage.success("已放弃训练进度");
  } catch {
    // 用户取消
  }
}

function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}分${secs}秒`;
}

function calculateAccuracy(record: TrainingResult): number {
  return Math.round((record.correctAnswers / record.totalQuestions) * 100);
}

function calculateAvgTime(record: TrainingResult): number {
  if (record.totalQuestions === 0) return 0;
  return Math.round((record.duration / record.totalQuestions) * 10) / 10;
}

function getAccuracyClass(record: TrainingResult): string {
  const accuracy = calculateAccuracy(record);
  if (accuracy >= 80) return "excellent";
  if (accuracy >= 60) return "good";
  return "poor";
}

function getTimelineType(record: TrainingResult): "success" | "warning" | "danger" | "info" {
  const accuracy = calculateAccuracy(record);
  if (accuracy >= 80) return "success";
  if (accuracy >= 60) return "warning";
  return "danger";
}

async function clearHistory() {
  try {
    await ElMessageBox.confirm("确定要清空所有训练历史吗？", "确认清空", {
      type: "warning"
    });
    emit("clear");
    ElMessage.success("历史记录已清空");
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.empty-history {
  padding: 40px 0;
}

.section-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  color: var(--utools-text-secondary);
}

.progress-section {
  margin-bottom: 20px;
}

.progress-actions {
  margin-top: 12px;
  display: flex;
  gap: 10px;
}

.progress-text {
  font-weight: bold;
  color: var(--utools-text-primary);
}

.history-content {
  max-height: 500px;
  overflow-y: auto;
  padding: 10px;
}

.history-card {
  background-color: var(--utools-bg-card);
  border-color: var(--utools-border-primary);

  .record-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;

    .accuracy {
      font-size: 20px;
      font-weight: bold;

      &.excellent {
        color: var(--utools-success);
      }

      &.good {
        color: var(--utools-warning);
      }

      &.poor {
        color: var(--utools-danger);
      }
    }
  }

  .record-stats {
    display: flex;
    gap: 20px;

    .stat {
      .label {
        color: var(--utools-text-tertiary);
        font-size: 12px;
      }

      .value {
        margin-left: 5px;
        font-weight: bold;
        color: var(--utools-text-primary);

        &.correct {
          color: var(--utools-success);
        }

        &.warning {
          color: var(--utools-warning);
        }
      }
    }
  }
}
</style>
