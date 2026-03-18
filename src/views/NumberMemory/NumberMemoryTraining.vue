<template>
  <div class="training-page">
    <el-card class="training-card">
      <template #header>
        <div class="card-header">
          <span class="title">🎯 记忆训练</span>
          <el-button @click="goBack">返回</el-button>
        </div>
      </template>

      <!-- 模式选择 -->
      <div v-if="!currentMode" class="mode-selection">
        <h3>选择训练模式</h3>
        <el-row :gutter="20">
          <el-col :span="12">
            <el-card 
              class="mode-card" 
              shadow="hover" 
              @click="startTraining('numberToImage')"
              :class="{ disabled: !canStartTraining }"
            >
              <div class="mode-icon">🔢➡️🖼️</div>
              <h4>数字 → 图片</h4>
              <p>看到数字，选择对应的图片</p>
              <el-tag v-if="!canStartTraining" type="info">请先保存至少4个数字关联</el-tag>
            </el-card>
          </el-col>
          <el-col :span="12">
            <el-card 
              class="mode-card" 
              shadow="hover" 
              @click="startTraining('imageToNumber')"
              :class="{ disabled: !canStartTraining }"
            >
              <div class="mode-icon">🖼️➡️🔢</div>
              <h4>图片 → 数字</h4>
              <p>看到图片，选择对应的数字</p>
              <el-tag v-if="!canStartTraining" type="info">请先保存至少4个数字关联</el-tag>
            </el-card>
          </el-col>
        </el-row>
      </div>

      <!-- 训练进行中 -->
      <div v-else-if="!isFinished" class="training-area">
        <!-- 进度条 -->
        <div class="progress-bar">
          <el-progress 
            :percentage="progressPercentage" 
            :stroke-width="20"
            :status="progressStatus"
          />
          <span class="progress-text">{{ currentQuestionIndex + 1 }} / {{ questions.length }}</span>
        </div>

        <!-- 计时器 -->
        <div class="timer">
          <el-icon><Timer /></el-icon>
          <span>{{ formatTime(elapsedTime) }}</span>
        </div>

        <!-- 题目区域 -->
        <div class="question-area">
          <!-- 数字→图片模式 -->
          <template v-if="currentMode === 'numberToImage'">
            <div class="question-number">
              <span class="label">这是什么数字的图片？</span>
              <div class="number-display">{{ currentQuestion?.question }}</div>
            </div>
            <div class="options-grid image-options">
              <div
                v-for="(option, index) in currentQuestion?.options"
                :key="index"
                class="option-item"
                :class="{
                  selected: selectedAnswer === option,
                  correct: hasAnswered && option === currentQuestion?.correctAnswer,
                  wrong: hasAnswered && selectedAnswer === option && option !== currentQuestion?.correctAnswer
                }"
                @click="selectAnswer(option)"
              >
                <!-- 用户上传的base64图片 -->
                <img v-if="isBase64Image(option)" :src="option" alt="选项图片" />
                <!-- 预设emoji图片 -->
                <span v-else class="emoji-option">{{ option }}</span>
              </div>
            </div>
          </template>

          <!-- 图片→数字模式 -->
          <template v-else>
            <div class="question-image">
              <span class="label">这张图片代表什么数字？</span>
              <!-- 用户上传的base64图片 -->
              <img v-if="isBase64Image(currentQuestion?.question || '')" :src="currentQuestion?.question" alt="题目图片" />
              <!-- 预设emoji图片 -->
              <div v-else class="emoji-question">{{ currentQuestion?.question }}</div>
            </div>
            <div class="options-grid number-options">
              <div
                v-for="(option, index) in currentQuestion?.options"
                :key="index"
                class="option-item"
                :class="{
                  selected: selectedAnswer === option,
                  correct: hasAnswered && option === currentQuestion?.correctAnswer,
                  wrong: hasAnswered && selectedAnswer === option && option !== currentQuestion?.correctAnswer
                }"
                @click="selectAnswer(option)"
              >
                <span class="number-text">{{ option }}</span>
              </div>
            </div>
          </template>
        </div>

        <!-- 反馈区域 -->
        <div v-if="hasAnswered" class="feedback-area">
          <el-alert
            :title="isCorrect ? '🎉 回答正确！' : '😢 回答错误'"
            :type="isCorrect ? 'success' : 'error'"
            :description="feedbackMessage"
            :closable="false"
            center
            show-icon
          />
          <el-button type="primary" @click="nextQuestion" class="next-btn">
            {{ isLastQuestion ? '查看结果' : '下一题' }}
          </el-button>
        </div>
      </div>

      <!-- 训练结果 -->
      <div v-else class="result-area">
        <div class="result-header">
          <el-result
            :icon="resultIcon"
            :title="resultTitle"
            :sub-title="resultSubtitle"
          />
        </div>

        <div class="result-stats">
          <el-row :gutter="20">
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ correctCount }}</div>
                <div class="stat-label">正确题数</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ accuracy }}%</div>
                <div class="stat-label">正确率</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ formatTime(elapsedTime) }}</div>
                <div class="stat-label">用时</div>
              </div>
            </el-col>
          </el-row>
        </div>

        <!-- 详细记录 -->
        <el-divider />
        <h4>答题详情</h4>
        <el-table :data="answerDetails" style="width: 100%">
          <el-table-column type="index" label="题号" width="60" align="center" />
          <el-table-column label="题目" align="center">
            <template #default="{ row }">
              <span v-if="currentMode === 'numberToImage'" class="table-number">{{ row.question }}</span>
              <template v-else>
                <!-- 用户上传的base64图片 -->
                <img v-if="isBase64Image(row.question)" :src="row.question" class="table-image" alt="题目" />
                <!-- 预设emoji图片 -->
                <span v-else class="table-emoji">{{ row.question }}</span>
              </template>
            </template>
          </el-table-column>
          <el-table-column label="你的答案" align="center">
            <template #default="{ row }">
              <template v-if="currentMode === 'numberToImage'">
                <!-- 用户上传的base64图片 -->
                <img v-if="isBase64Image(row.yourAnswer)" :src="row.yourAnswer" class="table-image" alt="答案" />
                <!-- 预设emoji图片 -->
                <span v-else class="table-emoji">{{ row.yourAnswer }}</span>
              </template>
              <span v-else class="table-number" :class="{ wrong: !row.correct }">{{ row.yourAnswer }}</span>
            </template>
          </el-table-column>
          <el-table-column label="正确答案" align="center">
            <template #default="{ row }">
              <template v-if="currentMode === 'numberToImage'">
                <!-- 用户上传的base64图片 -->
                <img v-if="isBase64Image(row.correctAnswer)" :src="row.correctAnswer" class="table-image" alt="正确答案" />
                <!-- 预设emoji图片 -->
                <span v-else class="table-emoji">{{ row.correctAnswer }}</span>
              </template>
              <span v-else class="table-number">{{ row.correctAnswer }}</span>
            </template>
          </el-table-column>
          <el-table-column label="结果" width="100" align="center">
            <template #default="{ row }">
              <el-tag :type="row.correct ? 'success' : 'danger'">
                {{ row.correct ? '✓' : '✗' }}
              </el-tag>
            </template>
          </el-table-column>
        </el-table>

        <div class="result-actions">
          <el-button type="primary" @click="restartTraining">再练一次</el-button>
          <el-button @click="goBack">返回设置</el-button>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from "vue";
import { useRouter } from "vue-router";
import { useNumberMemoryStore } from "@/stores/numberMemory";
import { ElMessage } from "element-plus";
import { Timer } from "@element-plus/icons-vue";

/**
 * 判断是否为base64格式的图片
 */
function isBase64Image(url: string): boolean {
  return url?.startsWith('data:image/') || false;
}

const router = useRouter();
const store = useNumberMemoryStore();

// State
const currentMode = ref<"numberToImage" | "imageToNumber" | null>(null);
const questions = ref<any[]>([]);
const currentQuestionIndex = ref(0);
const selectedAnswer = ref<any>(null);
const hasAnswered = ref(false);
const isCorrect = ref(false);
const isFinished = ref(false);
const elapsedTime = ref(0);
const answerResults = ref<{ question: string; selectedImage: string | null; selectedNumber: string | null; correct: boolean; responseTime: number }[]>([]);

// Timer
let timer: number | null = null;
let questionStartTime = 0;

// Computed
const canStartTraining = computed(() => store.associationCount >= 4);

const currentQuestion = computed(() => {
  return questions.value[currentQuestionIndex.value] || null;
});

const isLastQuestion = computed(() => {
  return currentQuestionIndex.value === questions.value.length - 1;
});

const progressPercentage = computed(() => {
  if (questions.value.length === 0) return 0;
  return Math.round(((currentQuestionIndex.value + (hasAnswered.value ? 1 : 0)) / questions.value.length) * 100);
});

const progressStatus = computed(() => {
  if (isFinished.value) return "success";
  return "";
});

const correctCount = computed(() => {
  return answerResults.value.filter(r => r.correct).length;
});

const accuracy = computed(() => {
  if (answerResults.value.length === 0) return 0;
  return Math.round((correctCount.value / answerResults.value.length) * 100);
});

const resultIcon = computed(() => {
  if (accuracy.value >= 80) return "success";
  if (accuracy.value >= 60) return "warning";
  return "error";
});

const resultTitle = computed(() => {
  if (accuracy.value >= 80) return "太棒了！";
  if (accuracy.value >= 60) return "还不错！";
  return "继续加油！";
});

const resultSubtitle = computed(() => {
  return `你答对了 ${correctCount.value}/${answerResults.value.length} 题，正确率 ${accuracy.value}%`;
});

const feedbackMessage = computed(() => {
  if (isCorrect.value) {
    const messages = ["记忆力真棒！", "继续保持！", "答对了！"];
    return messages[Math.floor(Math.random() * messages.length)];
  } else {
    return `正确答案是 ${currentMode.value === 'numberToImage' ? '上面的图片' : currentQuestion.value?.correctAnswer}`;
  }
});

const answerDetails = computed(() => {
  return questions.value.map((q, index) => {
    const result = answerResults.value[index];
    return {
      question: q.question,
      yourAnswer: result ? (currentMode.value === 'numberToImage' ? result.selectedImage : result.selectedNumber) : '-',
      correctAnswer: q.correctAnswer,
      correct: result?.correct || false
    };
  });
});

// Methods
function startTimer() {
  timer = window.setInterval(() => {
    elapsedTime.value++;
  }, 1000);
}

function stopTimer() {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

function startTraining(mode: "numberToImage" | "imageToNumber") {
  if (!canStartTraining.value) {
    ElMessage.warning("请先保存至少4个数字-图片关联");
    return;
  }

  currentMode.value = mode;
  
  if (mode === "numberToImage") {
    questions.value = store.generateNumberToImageQuiz(5);
  } else {
    questions.value = store.generateImageToNumberQuiz(5);
  }

  currentQuestionIndex.value = 0;
  selectedAnswer.value = null;
  hasAnswered.value = false;
  isFinished.value = false;
  elapsedTime.value = 0;
  answerResults.value = [];
  questionStartTime = Date.now();
  
  startTimer();
}

function selectAnswer(answer: any) {
  if (hasAnswered.value) return;

  selectedAnswer.value = answer;
  hasAnswered.value = true;

  const responseTime = Date.now() - questionStartTime;
  const correct = answer === currentQuestion.value?.correctAnswer;
  isCorrect.value = correct;

  answerResults.value.push({
    question: currentQuestion.value?.question,
    selectedImage: currentMode.value === 'numberToImage' ? answer : null,
    selectedNumber: currentMode.value === 'imageToNumber' ? answer : null,
    correct,
    responseTime
  });
}

function nextQuestion() {
  if (isLastQuestion.value) {
    finishTraining();
  } else {
    currentQuestionIndex.value++;
    selectedAnswer.value = null;
    hasAnswered.value = false;
    isCorrect.value = false;
    questionStartTime = Date.now();
  }
}

async function finishTraining() {
  stopTimer();
  isFinished.value = true;

  // 保存训练结果
  const details = answerResults.value.map((r, i) => ({
    number: questions.value[i].question,
    correct: r.correct,
    responseTime: r.responseTime
  }));

  await store.saveResult(
    currentMode.value!,
    questions.value.length,
    correctCount.value,
    elapsedTime.value,
    details
  );
}

function restartTraining() {
  if (currentMode.value) {
    startTraining(currentMode.value);
  }
}

function goBack() {
  router.push("/number-memory");
}

// Lifecycle
onMounted(() => {
  store.loadAssociations();
});

onUnmounted(() => {
  stopTimer();
});
</script>

<style scoped lang="scss">
.training-page {
  padding: 20px;
  max-width: 1000px;
  margin: 0 auto;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);

  :deep(.el-card) {
    background-color: var(--utools-bg-card);
    border-color: var(--utools-border-primary);
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;

    .title {
      font-size: 18px;
      font-weight: bold;
      color: var(--utools-text-primary);
    }
  }

  .mode-selection {
    text-align: center;
    padding: 20px;

    h3 {
      margin-bottom: 30px;
      color: var(--utools-text-primary);
    }

    .mode-card {
      cursor: pointer;
      transition: all 0.3s;
      text-align: center;
      padding: 20px;
      background-color: var(--utools-bg-card);

      &:hover:not(.disabled) {
        transform: translateY(-5px);
        box-shadow: var(--utools-shadow-md);
      }

      &.disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }

      .mode-icon {
        font-size: 48px;
        margin-bottom: 15px;
      }

      h4 {
        margin-bottom: 10px;
        color: var(--utools-primary);
      }

      p {
        color: var(--utools-text-secondary);
        margin-bottom: 10px;
      }
    }
  }

  .training-area {
    .progress-bar {
      display: flex;
      align-items: center;
      gap: 15px;
      margin-bottom: 20px;

      .el-progress {
        flex: 1;
      }

      .progress-text {
        font-weight: bold;
        color: var(--utools-primary);
        min-width: 60px;
        text-align: right;
      }
    }

    .timer {
      text-align: center;
      margin-bottom: 20px;
      font-size: 18px;
      color: var(--utools-text-secondary);

      .el-icon {
        margin-right: 5px;
        color: var(--utools-primary);
      }
    }

    .question-area {
      .label {
        display: block;
        text-align: center;
        font-size: 16px;
        color: var(--utools-text-secondary);
        margin-bottom: 20px;
      }

      .question-number {
        text-align: center;
        margin-bottom: 30px;

        .number-display {
          font-size: 72px;
          font-weight: bold;
          color: var(--utools-primary);
          margin-top: 20px;
        }
      }

      .question-image {
        text-align: center;
        margin-bottom: 30px;

        img {
          width: 150px;
          height: 150px;
          object-fit: contain;
          border: 3px solid var(--utools-border-primary);
          border-radius: 12px;
          margin-top: 20px;
        }

        .emoji-question {
          font-size: 100px;
          line-height: 150px;
          margin-top: 20px;
        }
      }

      .options-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 20px;
        max-width: 600px;
        margin: 0 auto;

        &.image-options {
          .option-item {
            height: 150px;
            background-color: var(--utools-bg-card);
            
            img {
              max-width: 100%;
              max-height: 100%;
              object-fit: contain;
            }

            .emoji-option {
              font-size: 64px;
              line-height: 150px;
            }
          }
        }

        &.number-options {
          .option-item {
            height: 100px;

            .number-text {
              font-size: 48px;
              font-weight: bold;
              color: var(--utools-text-primary);
            }
          }
        }

        .option-item {
          border: 3px solid var(--utools-border-primary);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          transition: all 0.3s;
          background-color: var(--utools-bg-card);

          &:hover:not(.selected):not(.correct):not(.wrong) {
            border-color: var(--utools-primary);
            transform: scale(1.02);
          }

          &.selected {
            border-color: var(--utools-primary);
            background-color: var(--utools-primary-light);
          }

          &.correct {
            border-color: var(--utools-success);
            background-color: rgba(103, 194, 58, 0.1);
          }

          &.wrong {
            border-color: var(--utools-danger);
            background-color: rgba(245, 108, 108, 0.1);
          }
        }
      }
    }

    .feedback-area {
      margin-top: 30px;
      text-align: center;

      .next-btn {
        margin-top: 20px;
      }
    }
  }

  .result-area {
    .result-stats {
      margin: 20px 0;

      .stat-item {
        text-align: center;
        padding: 20px;
        background-color: var(--utools-bg-tertiary);
        border-radius: 8px;

        .stat-value {
          font-size: 32px;
          font-weight: bold;
          color: var(--utools-primary);
          margin-bottom: 8px;
        }

        .stat-label {
          color: var(--utools-text-secondary);
        }
      }
    }

    .table-image {
      width: 50px;
      height: 50px;
      object-fit: contain;
    }

    .table-emoji {
      font-size: 32px;
      line-height: 50px;
    }

    .table-number {
      font-size: 24px;
      font-weight: bold;
      color: var(--utools-text-primary);
      
      &.wrong {
        color: var(--utools-danger);
        text-decoration: line-through;
      }
    }

    .result-actions {
      margin-top: 30px;
      text-align: center;
    }
  }
}
</style>
