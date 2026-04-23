<template>
  <div class="shortcut-training-page">
    <div class="training-header">
      <el-button @click="goBack">
        <el-icon><ArrowLeft /></el-icon>
        返回
      </el-button>
      <span class="training-title">
        {{ isKeyPressMode ? '🎯 按键训练' : '🧩 功能选择' }}
        - {{ store.currentCategory }}
      </span>
      <div class="training-stats">
        <el-tag type="success">✓ {{ store.correctCount }}</el-tag>
        <el-tag type="danger">✗ {{ store.wrongCount }}</el-tag>
        <el-tag type="info">
          {{ store.currentQuestionIndex + 1 }} / {{ store.questions.length }}
        </el-tag>
        <template v-if="isKeyPressMode && store.trainingPhase !== 'ready' && !store.isTrainingComplete">
          <el-tag
            v-for="key in displayPressedKeys"
            :key="key"
            size="small"
            :type="store.trainingPhase === 'correct' ? 'success' : store.trainingPhase === 'wrong' ? 'danger' : 'info'"
          >
            {{ key }}
          </el-tag>
          <el-tag v-if="displayPressedKeys.length === 0" type="info" size="small" effect="plain">等待按键</el-tag>
          <el-tag v-else-if="store.trainingPhase === 'correct'" type="success" size="small">正确</el-tag>
          <el-tag v-else-if="store.trainingPhase === 'wrong'" type="danger" size="small">{{ wrongMessage }}</el-tag>
          <el-switch
            v-model="showKeyboardHint"
            inline-prompt
            active-text="显"
            inactive-text="隐"
            style="margin-left: 4px;"
          />
        </template>
      </div>
    </div>

    <el-progress
      :percentage="store.progress"
      :stroke-width="6"
      :show-text="false"
      class="training-progress"
    />

    <div class="training-body">
      <!-- 题目区域 -->
      <div v-if="!store.isTrainingComplete" class="question-area">
        <div class="function-display">
          <div class="function-name">{{ currentQuestion?.functionName }}</div>
          <div class="function-desc">{{ currentQuestion?.description }}</div>
        </div>

        <!-- 按键训练模式 -->
        <template v-if="isKeyPressMode">
          <div class="keypress-area">
            <KeyboardVisual
              :pressed-keys="store.pressedKeys"
              :target-keys="showKeyboardHint && store.trainingPhase === 'showing' ? currentQuestion?.keys : []"
            />
          </div>
        </template>

        <!-- 功能选择模式 -->
        <template v-else>
          <div class="quiz-area">
            <div class="shortcut-display">
              <div
                v-for="(key, index) in currentQuestion?.keys"
                :key="index"
                class="shortcut-key"
              >
                {{ key }}
              </div>
            </div>

            <div class="prompt-area">
              <el-alert
                v-if="store.trainingPhase === 'showing'"
                title="请选择这个快捷键对应的功能描述"
                type="info"
                :closable="false"
                center
                show-icon
              />
              <el-alert
                v-else-if="store.trainingPhase === 'correct'"
                title="回答正确！"
                type="success"
                :closable="false"
                center
                show-icon
              />
              <el-alert
                v-else-if="store.trainingPhase === 'wrong'"
                title="回答错误"
                type="error"
                :closable="false"
                center
                show-icon
              />
            </div>

            <div class="options-grid">
              <el-button
                v-for="option in quizOptions"
                :key="option.id"
                :type="getOptionType(option.id)"
                size="large"
                class="option-btn"
                :disabled="store.trainingPhase !== 'showing'"
                @click="selectOption(option.id)"
              >
                <div class="option-content">
                  <div class="option-name">{{ option.functionName }}</div>
                  <div class="option-desc">{{ option.description }}</div>
                </div>
              </el-button>
            </div>

            <div class="action-area" v-if="store.trainingPhase !== 'showing'">
              <el-button type="primary" size="large" @click="nextQuestion">
                下一题
                <el-icon class="el-icon--right"><ArrowRight /></el-icon>
              </el-button>
            </div>
          </div>
        </template>
      </div>

      <!-- 训练完成 -->
      <div v-else class="training-complete">
        <el-result
          :icon="resultIcon"
          :title="resultTitle"
        >
          <template #sub-title>
            <div class="result-stats">
              <p>总题数：{{ store.questions.length }}</p>
              <p>正确：{{ store.correctCount }}</p>
              <p>错误：{{ store.wrongCount }}</p>
              <p>正确率：{{ Math.round((store.correctCount / store.questions.length) * 100) }}%</p>
            </div>
          </template>
          <template #extra>
            <el-button type="primary" @click="restartTraining">
              再练一次
            </el-button>
            <el-button @click="goBack">
              返回列表
            </el-button>
          </template>
        </el-result>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useShortcutMemoryStore } from '@/stores/shortcutMemory';
import { ElMessage } from 'element-plus';
import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
import type { ShortcutItem } from '@/types/shortcut-memory';
import KeyboardVisual from './components/KeyboardVisual.vue';

const router = useRouter();
const route = useRoute();
const store = useShortcutMemoryStore();

const isKeyPressMode = ref(true);
const quizOptions = ref<ShortcutItem[]>([]);
const wrongMessage = ref('');
const showKeyboardHint = ref(true);
let autoNextTimer: ReturnType<typeof setTimeout> | null = null;

const currentQuestion = computed(() => store.currentQuestion);

const displayPressedKeys = computed(() => {
  return Array.from(store.pressedKeys);
});

const resultIcon = computed(() => {
  const rate = store.correctCount / store.questions.length;
  if (rate >= 0.8) return 'success';
  if (rate >= 0.5) return 'warning';
  return 'error';
});

const resultTitle = computed(() => {
  const rate = store.correctCount / store.questions.length;
  if (rate >= 0.8) return '太棒了！';
  if (rate >= 0.5) return '继续加油！';
  return '还需努力！';
});

function getOptionType(optionId: string): string {
  if (store.trainingPhase === 'showing') return 'default';
  if (optionId === currentQuestion.value?.id) return 'success';
  return 'danger';
}

function startTraining() {
  store.showCurrentQuestion();
  if (!isKeyPressMode.value) {
    quizOptions.value = store.generateQuizOptions();
  }
}

function nextQuestion() {
  store.nextQuestion();
  if (!isKeyPressMode.value && !store.isTrainingComplete) {
    quizOptions.value = store.generateQuizOptions();
  }
}

function selectOption(optionId: string) {
  const isCorrect = store.checkFunctionSelect(optionId);
  if (!isCorrect) {
    const correct = currentQuestion.value;
    wrongMessage.value = `正确答案是：${correct?.functionName}`;
  }
}

function restartTraining() {
  if (isKeyPressMode.value) {
    store.initKeyPressTraining(store.currentCategory);
  } else {
    store.initFunctionSelectTraining(store.currentCategory);
  }
  startTraining();
}

function goBack() {
  router.push('/shortcut-memory');
}

// 键盘事件处理
function handleKeyDown(event: KeyboardEvent) {
  if (!isKeyPressMode.value || store.trainingPhase !== 'showing') return;
  if (store.isTrainingComplete) return;

  event.preventDefault();
  event.stopPropagation();

  // 处理修饰键
  if (event.ctrlKey) store.addPressedKey('ctrl');
  if (event.altKey) store.addPressedKey('alt');
  if (event.shiftKey) store.addPressedKey('shift');
  if (event.metaKey) store.addPressedKey('win');

  const key = event.key;
  // 处理普通按键（避免重复添加修饰键）
  if (!event.ctrlKey && !event.altKey && !event.shiftKey && !event.metaKey) {
    store.addPressedKey(key);
  } else if (key !== 'Control' && key !== 'Alt' && key !== 'Shift' && key !== 'Meta') {
    store.addPressedKey(key);
  }

  // 检查是否匹配
  // 只有在按下非修饰键时才进行匹配判断，避免按组合键过程中（只按了修饰键）就触发错误
  if (!['Control', 'Alt', 'Shift', 'Meta'].includes(key)) {
    const isCorrect = store.checkKeyPress();
    if (isCorrect) {
      // 正确：延迟 600ms 自动进入下一题
      if (autoNextTimer) clearTimeout(autoNextTimer);
      autoNextTimer = setTimeout(() => {
        nextQuestion();
      }, 600);
    } else {
      // 错误：显示错误提示，延迟 1200ms 后重新监听
      const correct = currentQuestion.value;
      wrongMessage.value = `答案：${correct?.keys.join('+')}`;
      if (autoNextTimer) clearTimeout(autoNextTimer);
      autoNextTimer = setTimeout(() => {
        store.clearPressedKeys();
        store.trainingPhase = 'showing';
      }, 1200);
    }
  }
}

function handleKeyUp(event: KeyboardEvent) {
  if (!isKeyPressMode.value) return;

  const key = event.key;

  // 延迟清除，让用户能看到按下的组合键
  setTimeout(() => {
    if (key === 'Control') store.removePressedKey('ctrl');
    else if (key === 'Alt') store.removePressedKey('alt');
    else if (key === 'Shift') store.removePressedKey('shift');
    else if (key === 'Meta') store.removePressedKey('win');
    else store.removePressedKey(key);
  }, 200);
}

// 监听训练完成
watch(() => store.isTrainingComplete, (complete) => {
  if (complete) {
    store.saveTrainingResult(isKeyPressMode.value ? 'keyPress' : 'functionSelect');
  }
});

onMounted(() => {
  const mode = route.query.mode as string;
  isKeyPressMode.value = mode !== 'functionSelect';

  if (!store.currentCategory) {
    router.push('/shortcut-memory');
    return;
  }

  if (isKeyPressMode.value) {
    store.initKeyPressTraining(store.currentCategory);
  } else {
    store.initFunctionSelectTraining(store.currentCategory);
  }

  // 直接进入第一题，不再显示准备页面
  startTraining();

  window.addEventListener('keydown', handleKeyDown, true);
  window.addEventListener('keyup', handleKeyUp, true);
});

onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown, true);
  window.removeEventListener('keyup', handleKeyUp, true);
  if (autoNextTimer) clearTimeout(autoNextTimer);
});
</script>

<style scoped lang="scss">
.shortcut-training-page {
  width: 100%;
  box-sizing: border-box;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
  display: flex;
  flex-direction: column;

  .training-header {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 12px 16px;
    border-bottom: 1px solid var(--utools-border-primary);
    background-color: var(--utools-bg-card);

    .training-title {
      font-size: 16px;
      font-weight: bold;
      color: var(--utools-text-primary);
      flex: 1;
    }

    .training-stats {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
      align-items: center;
      justify-content: flex-end;
    }
  }

  .training-progress {
    margin: 0;
    :deep(.el-progress-bar__outer) {
      border-radius: 0;
    }
    :deep(.el-progress-bar__inner) {
      border-radius: 0;
    }
  }

  .training-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    padding: 12px 16px;
    overflow: auto;
  }

  .question-area {
    flex: 1;
    display: flex;
    flex-direction: column;

    .function-display {
      text-align: center;
      margin-bottom: 16px;
      padding: 16px;
      background: var(--utools-bg-secondary);
      border-radius: 12px;

      .function-name {
        font-size: 22px;
        font-weight: bold;
        color: var(--utools-text-primary);
        margin-bottom: 8px;
      }

      .function-desc {
        font-size: 14px;
        color: var(--utools-text-secondary);
      }
    }

    .keypress-area {
      flex: 1;
      display: flex;
      align-items: center;
      justify-content: center;
      min-height: 0;
    }

    .quiz-area {
      flex: 1;
      display: flex;
      flex-direction: column;

      .shortcut-display {
        display: flex;
        justify-content: center;
        gap: 16px;
        margin-bottom: 24px;

        .shortcut-key {
          min-width: 64px;
          height: 64px;
          border: 2px solid var(--utools-primary);
          border-radius: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 20px;
          font-weight: bold;
          color: var(--utools-primary);
          background: var(--utools-bg-secondary);
        }
      }

      .prompt-area {
        margin-bottom: 20px;
      }

      .options-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 16px;
        margin-bottom: 24px;

        .option-btn {
          height: auto;
          padding: 16px;
          text-align: left;

          .option-content {
            .option-name {
              font-size: 16px;
              font-weight: bold;
              margin-bottom: 6px;
            }

            .option-desc {
              font-size: 13px;
              opacity: 0.85;
              line-height: 1.4;
            }
          }
        }
      }

      .action-area {
        text-align: center;
        margin-top: auto;
        padding-bottom: 16px;
      }
    }
  }

  .training-complete {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 0;

    .result-stats {
      text-align: center;
      line-height: 1.8;
    }
  }
}

@media (max-width: 768px) {
  .shortcut-training-page {
    .options-grid {
      grid-template-columns: 1fr !important;
    }
  }
}
</style>
