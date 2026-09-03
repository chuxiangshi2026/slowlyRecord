<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="📝 数字填空练习"
    width="700px"
    destroy-on-close
    class="number-fill-blanks-dialog"
  >
    <div v-if="entry" class="fill-blanks-container">
      <!-- 头部信息 -->
      <div class="header-info">
        <div>
          <h3>{{ entry.title }}</h3>
          <div v-if="entry.mnemonic" class="mnemonic-hint">
            <el-icon><MagicStick /></el-icon>
            {{ entry.mnemonic }}
          </div>
        </div>
        <el-tag size="small" type="info">共 {{ entry.numbers.length }} 位数字</el-tag>
      </div>

      <!-- 设置工具栏 -->
      <div class="toolbar">
        <el-form :inline="true" size="small">
          <el-form-item label="填空数量">
            <el-input-number
              v-model="blankCount"
              :min="1"
              :max="Math.min(entry.numbers.length - 1, 20)"
              size="small"
            />
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="generateNewExercise">
              <el-icon><Refresh /></el-icon>
              重新生成
            </el-button>
            <el-button @click="toggleShowAnswers">
              {{ showAnswers ? '隐藏答案' : '显示答案' }}
            </el-button>
            <el-button
              type="warning"
              @click="showPromptsPanel = !showPromptsPanel"
              :disabled="enabledPrompts.length === 0"
            >
              <el-icon><Memo /></el-icon>
              {{ showPromptsPanel ? '隐藏提示词' : '显示提示词' }}
            </el-button>
          </el-form-item>
        </el-form>
      </div>

      <!-- 提示词面板 -->
      <div v-if="showPromptsPanel && enabledPrompts.length > 0" class="prompts-panel">
        <div class="prompts-header">
          <span class="prompts-title">💡 记忆提示</span>
          <el-tag size="small" type="info">{{ enabledPrompts.length }} 个提示词</el-tag>
        </div>
        <div class="prompts-list">
          <div
            v-for="prompt in enabledPrompts"
            :key="prompt._id"
            class="prompt-card"
          >
            <div class="prompt-title">{{ prompt.title }}</div>
            <div class="prompt-content">{{ prompt.content }}</div>
          </div>
        </div>
      </div>

      <!-- 练习区域 -->
      <div class="exercise-area">
        <div class="numbers-display">
          <template v-for="(item, index) in exerciseItems" :key="index">
            <span v-if="item.type === 'show'" class="number-show">{{ item.number }}</span>
            <span v-else class="number-blank">
              <el-input
                v-model="item.userAnswer"
                :class="{
                  'is-correct': item.isChecked && item.isCorrect,
                  'is-wrong': item.isChecked && !item.isCorrect
                }"
                maxlength="1"
                style="width: 40px"
                @keyup.enter="checkAnswer(item)"
              />
              <span v-if="showAnswers || (item.isChecked && !item.isCorrect)" class="answer-hint">
                {{ item.number }}
              </span>
            </span>
          </template>
        </div>
      </div>

      <!-- 统计信息 -->
      <div v-if="stats.total > 0" class="stats-bar">
        <el-tag type="info">共 {{ stats.total }} 个填空</el-tag>
        <el-tag type="success">已答对 {{ stats.correct }} 个</el-tag>
        <el-tag type="danger">错误 {{ stats.wrong }} 个</el-tag>
        <el-tag type="warning">未答 {{ stats.total - stats.correct - stats.wrong }} 个</el-tag>
        <el-tag type="primary">正确率 {{ stats.percentage }}%</el-tag>
      </div>

      <!-- 操作按钮 -->
      <div class="action-bar">
        <el-button type="primary" @click="checkAllAnswers" :disabled="!hasBlanks">
          检查答案
        </el-button>
        <el-button @click="resetExercise" :disabled="!hasBlanks">
          重置练习
        </el-button>
        <el-button type="success" @click="saveProgress" :disabled="!hasBlanks">
          保存进度
        </el-button>
        <el-button type="warning" @click="loadProgress" :disabled="!hasSavedProgress">
          恢复进度
        </el-button>
      </div>

      <!-- 提示区域 -->
      <div class="tips-area">
        <el-alert
          title="练习提示"
          type="info"
          :closable="false"
        >
          <p>1. 根据记忆填写缺失的数字</p>
          <p>2. 按 Enter 键或点击"检查答案"验证</p>
          <p>3. 可以先使用"图片联想"功能记忆数字</p>
        </el-alert>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useNumberMemoryStore } from '@/stores/numberMemory';
import type { NumberMemoryEntry, NumberMemoryPrompt } from '@/types/number-memory';
import { ElMessage } from 'element-plus';
import { Refresh, Memo, MagicStick } from '@element-plus/icons-vue';

interface Props {
  modelValue: boolean;
  entry: NumberMemoryEntry | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const store = useNumberMemoryStore();

// 练习设置
const blankCount = ref(3);
const showPromptsPanel = ref(false);
const showAnswers = ref(false);

// 练习项
interface ExerciseItem {
  type: 'show' | 'blank';
  number: string;
  userAnswer: string;
  isChecked: boolean;
  isCorrect: boolean;
}

const exerciseItems = ref<ExerciseItem[]>([]);

// 是否有填空
const hasBlanks = computed(() => {
  return exerciseItems.value.some(item => item.type === 'blank');
});

// 统计信息
const stats = computed(() => {
  const blanks = exerciseItems.value.filter(item => item.type === 'blank');
  const total = blanks.length;
  const correct = blanks.filter(item => item.isCorrect).length;
  const wrong = blanks.filter(item => item.isChecked && !item.isCorrect).length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { total, correct, wrong, percentage };
});

// 是否有保存的进度
const hasSavedProgress = computed(() => {
  if (!props.entry) return false;
  const key = `number_fill_blanks_${props.entry._id}`;
  const saved = localStorage.getItem(key);
  return !!saved;
});

// 启用的提示词
const enabledPrompts = computed(() => store.currentPrompts.filter(p => p.enabled));

// 生成新的练习
function generateNewExercise() {
  if (!props.entry) return;

  const numbers = props.entry.numbers.split('');
  const totalLength = numbers.length;
  
  // 随机选择要隐藏的位置（不能全部隐藏）
  const indices = Array.from({ length: totalLength }, (_, i) => i);
  const shuffled = indices.sort(() => Math.random() - 0.5);
  const blankIndices = new Set(shuffled.slice(0, Math.min(blankCount.value, totalLength - 1)));

  exerciseItems.value = numbers.map((num, index) => {
    const isBlank = blankIndices.has(index);
    return {
      type: isBlank ? 'blank' : 'show',
      number: num,
      userAnswer: '',
      isChecked: false,
      isCorrect: false
    };
  });

  showAnswers.value = false;
}

// 检查单个答案
function checkAnswer(item: ExerciseItem) {
  if (item.type !== 'blank') return;

  item.isChecked = true;
  item.isCorrect = item.userAnswer === item.number;

  if (item.isCorrect) {
    ElMessage.success('回答正确！');
  } else {
    ElMessage.error(`回答错误，正确答案是：${item.number}`);
  }
}

// 切换显示答案
function toggleShowAnswers() {
  showAnswers.value = !showAnswers.value;
}

// 检查所有答案
function checkAllAnswers() {
  let correct = 0;
  let total = 0;

  exerciseItems.value.forEach(item => {
    if (item.type === 'blank') {
      total++;
      item.isChecked = true;
      item.isCorrect = item.userAnswer === item.number;
      if (item.isCorrect) correct++;
    }
  });

  const percentage = total > 0 ? (correct / total) * 100 : 0;
  if (correct === total) {
    ElMessage.success(`恭喜！全部正确！(${correct}/${total})`);
    if (props.entry) {
      store.markEntryCorrect(props.entry._id);
      updateReviewCount();
    }
  } else if (percentage < 50) {
    ElMessage.warning(`答对 ${correct}/${total} 题，正确率不足 50%，已降级`);
    if (props.entry) {
      store.markEntryWrong(props.entry._id);
    }
  } else {
    ElMessage.warning(`答对 ${correct}/${total} 题，继续加油！`);
    if (props.entry) {
      updateReviewCount();
    }
  }
}

// 重置练习
function resetExercise() {
  exerciseItems.value.forEach(item => {
    if (item.type === 'blank') {
      item.userAnswer = '';
      item.isChecked = false;
      item.isCorrect = false;
    }
  });
  showAnswers.value = false;
  ElMessage.info('练习已重置');
}

// 保存进度
function saveProgress() {
  if (!props.entry) return;

  const progress = {
    blankCount: blankCount.value,
    items: exerciseItems.value,
    stats: stats.value,
    timestamp: Date.now()
  };

  const key = `number_fill_blanks_${props.entry._id}`;
  localStorage.setItem(key, JSON.stringify(progress));
  ElMessage.success('进度已保存');
}

// 加载进度
function loadProgress() {
  if (!props.entry) return;

  const key = `number_fill_blanks_${props.entry._id}`;
  const saved = localStorage.getItem(key);
  
  if (saved) {
    try {
      const progress = JSON.parse(saved);
      blankCount.value = progress.blankCount || 3;
      exerciseItems.value = progress.items || [];
      ElMessage.success('进度已恢复');
    } catch (e) {
      ElMessage.error('恢复进度失败');
    }
  } else {
    ElMessage.warning('没有找到保存的进度');
  }
}

// 更新复习次数
async function updateReviewCount() {
  if (!props.entry) return;
  await store.updateReviewCount(props.entry._id);
}

// 监听条目变化
watch(() => props.entry, async (newEntry) => {
  if (newEntry) {
    // 加载提示词
    await store.loadPrompts(newEntry._id);
    
    // 尝试加载上次的进度
    const key = `number_fill_blanks_${newEntry._id}`;
    const saved = localStorage.getItem(key);
    
    if (saved) {
      try {
        const progress = JSON.parse(saved);
        // 检查是否是最近24小时内的进度
        const now = Date.now();
        if (now - progress.timestamp < 24 * 60 * 60 * 1000) {
          blankCount.value = progress.blankCount || 3;
          exerciseItems.value = progress.items || [];
          ElMessage.info('已恢复上次的练习进度');
          return;
        }
      } catch (e) {
        // 解析失败，生成新的练习
      }
    }
    
    // 生成新的练习
    generateNewExercise();
  }
}, { immediate: true });
</script>

<style scoped lang="scss">
.fill-blanks-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.header-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;

  h3 {
    margin: 0 0 6px 0;
    color: var(--utools-text-primary);
  }

  .mnemonic-hint {
    font-size: 13px;
    color: var(--utools-warning);
    display: flex;
    align-items: center;
    gap: 4px;
  }
}

.toolbar {
  display: flex;
  justify-content: center;
}

.exercise-area {
  min-height: 150px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 30px 20px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;

  .numbers-display {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 10px;
    font-size: 32px;
    font-family: monospace;

    .number-show {
      width: 40px;
      height: 50px;
      line-height: 50px;
      text-align: center;
      background: var(--utools-bg-card);
      border: 2px solid var(--utools-border-primary);
      border-radius: 6px;
      color: var(--utools-text-primary);
      font-weight: bold;
    }

    .number-blank {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;

      :deep(.el-input) {
        .el-input__inner {
          height: 50px;
          text-align: center;
          font-size: 24px;
          font-weight: bold;
          padding: 0;
        }

        &.is-correct .el-input__inner {
          background-color: #f0f9eb;
          border-color: #67c23a;
          color: #67c23a;
        }

        &.is-wrong .el-input__inner {
          background-color: #fef0f0;
          border-color: #f56c6c;
          color: #f56c6c;
        }
      }

      .answer-hint {
        font-size: 14px;
        color: #67c23a;
        font-weight: 500;
      }
    }
  }
}

.stats-bar {
  display: flex;
  justify-content: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 12px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
}

.action-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.tips-area {
  p {
    margin: 4px 0;
    font-size: 13px;
  }
}

// 提示词面板样式
.prompts-panel {
  padding: 16px;
  background: linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%);
  border: 1px solid #ffe58f;
  border-radius: 8px;

  .prompts-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;

    .prompts-title {
      font-weight: 600;
      color: #d48806;
      font-size: 14px;
    }
  }

  .prompts-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .prompt-card {
    padding: 12px;
    background: rgba(255, 255, 255, 0.8);
    border-radius: 6px;
    border-left: 3px solid #faad14;

    .prompt-title {
      font-weight: 600;
      color: #d48806;
      font-size: 13px;
      margin-bottom: 6px;
    }

    .prompt-content {
      color: #595959;
      font-size: 13px;
      line-height: 1.6;
    }
  }
}
</style>
