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
          <el-col :span="12">
            <el-card
              class="mode-card"
              shadow="hover"
              @click="startTraining('randomSequence')"
            >
              <div class="mode-icon">🎲</div>
              <h4>随机序列</h4>
              <p>限时记忆随机数字串，逐级加长</p>
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
          <span class="progress-text">
            {{ currentMode === 'randomSequence' ? `第 ${randomSequenceRound} 轮 · ${randomSequenceLength} 位` : `${currentQuestionIndex + 1} / ${questions.length}` }}
          </span>
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
          <template v-else-if="currentMode === 'imageToNumber'">
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

          <!-- 随机序列模式 -->
          <template v-else-if="currentMode === 'randomSequence'">
            <div class="random-sequence-area">
              <div v-if="randomSequenceShow" class="random-sequence-display">
                {{ randomSequenceQuestion }}
              </div>
              <div v-else-if="!isFinished" class="random-sequence-input-area">
                <div class="random-sequence-label">
                  请输入刚才显示的数字（{{ randomSequenceLength }} 位）
                </div>
                <el-input
                  v-model="randomSequenceInput"
                  class="random-sequence-input"
                  maxlength="100"
                  placeholder="输入记忆中的数字"
                  @keyup.enter="checkRandomSequence"
                />
                <div class="random-sequence-actions">
                  <el-button type="primary" @click="checkRandomSequence">提交</el-button>
                </div>
              </div>
            </div>
          </template>
        </div>

        <!-- 反馈区域 -->
        <div v-if="hasAnswered && currentMode !== 'randomSequence'" class="feedback-area">
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
                <div class="stat-value">{{ currentMode === 'randomSequence' ? randomSequenceScore : correctCount }}</div>
                <div class="stat-label">{{ currentMode === 'randomSequence' ? '最高位数' : '正确题数' }}</div>
              </div>
            </el-col>
            <el-col :span="8">
              <div class="stat-item">
                <div class="stat-value">{{ currentMode === 'randomSequence' ? randomSequenceRound - 1 : accuracy + '%' }}</div>
                <div class="stat-label">{{ currentMode === 'randomSequence' ? '完成轮数' : '正确率' }}</div>
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
        <el-divider v-if="currentMode !== 'randomSequence'" />
        <h4 v-if="currentMode !== 'randomSequence'">答题详情</h4>
        <el-table v-if="currentMode !== 'randomSequence'" :data="answerDetails" style="width: 100%">
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
import { useWordsStore } from "@/stores/words";
import { ElMessage, ElMessageBox } from "element-plus";
import { Timer } from "@element-plus/icons-vue";
import {
  saveTrainingProgress,
  getTrainingProgress,
  clearTrainingProgress
} from "@/utils/number-memory-db";
import type { TrainingProgress } from "@/types/number-memory";

/**
 * 判断是否为base64格式的图片
 */
function isBase64Image(url: string): boolean {
  return url?.startsWith('data:image/') || false;
}

const router = useRouter();
const store = useNumberMemoryStore();
const wordsStore = useWordsStore();

// State
const currentMode = ref<"numberToImage" | "imageToNumber" | "randomSequence" | null>(null);
const questions = ref<any[]>([]);
const currentQuestionIndex = ref(0);
const selectedAnswer = ref<any>(null);
const hasAnswered = ref(false);
const isCorrect = ref(false);
const isFinished = ref(false);
const elapsedTime = ref(0);
const answerResults = ref<{ question: string; selectedImage: string | null; selectedNumber: string | null; correct: boolean; responseTime: number }[]>([]);

// 随机序列训练状态（结束时按轮写入训练历史）
const randomSequenceLength = ref(5);
const randomSequenceMin = 5;
const randomSequenceMax = 100;
const randomSequenceQuestion = ref("");
const randomSequenceInput = ref("");
const randomSequenceShow = ref(false);
const randomSequenceScore = ref(0);
const randomSequenceRound = ref(1);
// 按轮沉淀的结果（训练历史用）：每轮一条
const randomSequenceResults = ref<{ number: string; correct: boolean; responseTime: number }[]>([]);
let randomSequenceRoundStart = 0;
let randomSequenceTimer: number | null = null;

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
  if (currentMode.value === 'randomSequence') {
    if (randomSequenceScore.value >= 20) return "success";
    if (randomSequenceScore.value >= 10) return "warning";
    return "error";
  }
  if (accuracy.value >= 80) return "success";
  if (accuracy.value >= 60) return "warning";
  return "error";
});

const resultTitle = computed(() => {
  if (currentMode.value === 'randomSequence') {
    if (randomSequenceScore.value >= 20) return "记忆大师！";
    if (randomSequenceScore.value >= 10) return "记忆力不错！";
    return "继续练习！";
  }
  if (accuracy.value >= 80) return "太棒了！";
  if (accuracy.value >= 60) return "还不错！";
  return "继续加油！";
});

const resultSubtitle = computed(() => {
  if (currentMode.value === 'randomSequence') {
    return `本次最高记忆到 ${randomSequenceScore.value} 位数字`;
  }
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

function startTraining(mode: "numberToImage" | "imageToNumber" | "randomSequence") {
  if (mode !== "randomSequence" && !canStartTraining.value) {
    ElMessage.warning("请先保存至少4个数字-图片关联");
    return;
  }

  currentMode.value = mode;

  if (mode === "numberToImage") {
    questions.value = store.generateNumberToImageQuiz(5);
  } else if (mode === "imageToNumber") {
    questions.value = store.generateImageToNumberQuiz(5);
  } else {
    // 随机序列模式：重置状态并开始第一轮
    resetRandomSequenceState();
    startTimer();
    startRandomSequenceRound();
    return;
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

// 随机序列模式：重置状态
function resetRandomSequenceState() {
  randomSequenceLength.value = randomSequenceMin;
  randomSequenceScore.value = 0;
  randomSequenceRound.value = 1;
  randomSequenceInput.value = "";
  randomSequenceQuestion.value = "";
  randomSequenceResults.value = [];
  isFinished.value = false;
  elapsedTime.value = 0;
  answerResults.value = [];
  stopRandomSequenceTimer();
}

// 随机序列模式：生成指定长度的随机数字串
function generateRandomSequence(length: number): string {
  let result = "";
  for (let i = 0; i < length; i++) {
    result += Math.floor(Math.random() * 10).toString();
  }
  return result;
}

// 随机序列模式：开始一轮
function startRandomSequenceRound() {
  randomSequenceQuestion.value = generateRandomSequence(randomSequenceLength.value);
  randomSequenceInput.value = "";
  randomSequenceShow.value = true;
  hasAnswered.value = false;
  randomSequenceRoundStart = Date.now();

  // 限时显示：每 5 位 1 秒，最低 2 秒
  const displaySeconds = Math.max(2, Math.ceil(randomSequenceLength.value / 5));

  stopRandomSequenceTimer();
  randomSequenceTimer = window.setTimeout(() => {
    randomSequenceShow.value = false;
  }, displaySeconds * 1000);
}

// 随机序列模式：停止显示计时器
function stopRandomSequenceTimer() {
  if (randomSequenceTimer) {
    clearTimeout(randomSequenceTimer);
    randomSequenceTimer = null;
  }
}

// 随机序列模式：检查输入
function checkRandomSequence() {
  if (hasAnswered.value || randomSequenceShow.value) return;

  hasAnswered.value = true;
  const input = randomSequenceInput.value.trim();
  const correct = input === randomSequenceQuestion.value;
  isCorrect.value = correct;

  // 沉淀本轮结果（训练历史用）
  randomSequenceResults.value.push({
    number: randomSequenceQuestion.value,
    correct,
    responseTime: Date.now() - randomSequenceRoundStart,
  });

  if (correct) {
    randomSequenceScore.value = Math.max(randomSequenceScore.value, randomSequenceLength.value);
    ElMessage.success(`正确！进入 ${randomSequenceLength.value + 1} 位挑战`);

    if (randomSequenceLength.value < randomSequenceMax) {
      randomSequenceLength.value++;
      randomSequenceRound.value++;
      setTimeout(() => {
        startRandomSequenceRound();
      }, 800);
    } else {
      finishRandomSequence();
    }
  } else {
    ElMessage.error(`回答错误，正确答案是：${randomSequenceQuestion.value}`);
    finishRandomSequence();
  }
}

// 随机序列模式：结束
async function finishRandomSequence() {
  stopRandomSequenceTimer();
  stopTimer();
  isFinished.value = true;
  // 未通过任何轮时保持 0，避免首轮答错显示 "最高记忆到 4 位" 这类误导数字
  if (randomSequenceScore.value > 0) {
    randomSequenceScore.value = Math.max(randomSequenceScore.value, randomSequenceLength.value - 1);
  }

  // 按轮保存训练结果：totalQuestions=完成轮数、correctAnswers=答对轮数
  const rounds = randomSequenceResults.value;
  if (rounds.length === 0) return;
  const correctRounds = rounds.filter(r => r.correct).length;
  const result = await store.saveResult('randomSequence', rounds.length, correctRounds, elapsedTime.value, [...rounds]);
  if (result.ok) {
    ElMessage.success("训练结果已保存");
  }
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

  // 训练完成，清除进度
  clearTrainingProgress();

  // 保存训练结果
  const details = answerResults.value.map((r, i) => ({
    number: currentMode.value === 'numberToImage'
      ? questions.value[i].question
      : questions.value[i].correctAnswer,
    correct: r.correct,
    responseTime: r.responseTime
  }));

  const result = await store.saveResult(
    currentMode.value!,
    questions.value.length,
    correctCount.value,
    elapsedTime.value,
    details
  );

  if (result.ok) {
    ElMessage.success("训练结果已保存");
  } else {
    ElMessage.error("训练结果保存失败");
  }
}

function restartTraining() {
  if (currentMode.value) {
    startTraining(currentMode.value);
  }
}

async function goBack() {
  await saveCurrentProgress();
  router.push("/number-memory");
}

// 保存当前训练进度
async function saveCurrentProgress() {
  if (!currentMode.value || isFinished.value || currentMode.value === 'randomSequence') return;
  if (questions.value.length === 0) return;

  const progress: TrainingProgress = {
    _id: 'number_memory_progress',
    type: 'number_memory_progress',
    mode: currentMode.value,
    questions: questions.value,
    currentQuestionIndex: currentQuestionIndex.value,
    answerResults: answerResults.value,
    elapsedTime: elapsedTime.value,
    hasAnswered: hasAnswered.value,
    selectedAnswer: selectedAnswer.value,
    isCorrect: isCorrect.value,
    createdAt: Date.now(),
    updatedAt: Date.now()
  };

  await saveTrainingProgress(progress);
}

// 恢复训练进度
async function restoreProgress() {
  const progress = getTrainingProgress();
  if (!progress) return false;

  currentMode.value = progress.mode;
  questions.value = progress.questions;
  currentQuestionIndex.value = progress.currentQuestionIndex;
  answerResults.value = progress.answerResults;
  elapsedTime.value = progress.elapsedTime;
  hasAnswered.value = progress.hasAnswered;
  selectedAnswer.value = progress.selectedAnswer;
  isCorrect.value = progress.isCorrect;
  isFinished.value = false;
  questionStartTime = Date.now();

  startTimer();
  return true;
}

// Lifecycle
onMounted(async () => {
  store.loadAssociations();
  // 记录最后访问的页面
  wordsStore.setLastVisitedPage('/number-memory/training');

  // 检查是否有未完成的训练进度（随机序列模式不恢复）
  const progress = getTrainingProgress();
  if (progress && (progress.mode as string) !== 'randomSequence' && progress.questions.length > 0) {
    try {
      await ElMessageBox.confirm(
        `检测到未完成的训练（${progress.mode === 'numberToImage' ? '数字→图片' : '图片→数字'}，第 ${progress.currentQuestionIndex + 1}/${progress.questions.length} 题），是否继续？`,
        '继续训练',
        {
          confirmButtonText: '继续',
          cancelButtonText: '重新开始',
          type: 'info'
        }
      );
      await restoreProgress();
    } catch {
      // 用户选择重新开始，清除进度
      clearTrainingProgress();
    }
  }
});

onUnmounted(() => {
  stopTimer();
  stopRandomSequenceTimer();
  saveCurrentProgress();
});
</script>

<style scoped lang="scss">
.training-page {
  padding: 20px;
  width: 100%;
  box-sizing: border-box;
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

  // 随机序列模式样式
  .random-sequence-area {
    text-align: center;
    padding: 30px 20px;
    background: var(--utools-bg-secondary);
    border-radius: 8px;
    min-height: 200px;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;

    .random-sequence-display {
      font-size: 48px;
      font-weight: bold;
      color: var(--utools-primary);
      font-family: monospace;
      letter-spacing: 8px;
      word-break: break-all;
    }

    .random-sequence-input-area {
      width: 100%;
      max-width: 500px;

      .random-sequence-label {
        font-size: 16px;
        color: var(--utools-text-secondary);
        margin-bottom: 20px;
      }

      .random-sequence-input {
        margin-bottom: 20px;

        :deep(.el-input__inner) {
          height: 60px;
          text-align: center;
          font-size: 28px;
          font-family: monospace;
          letter-spacing: 4px;
        }
      }
    }
  }
}
</style>
