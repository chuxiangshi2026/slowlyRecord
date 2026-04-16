<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="跟打练习"
    width="750px"
    destroy-on-close
    class="typing-practice-dialog"
    @opened="handleOpened"
    @closed="handleClosed"
  >
    <div v-if="article" class="typing-container">
      <!-- 统计信息 -->
      <div class="stats-panel">
        <el-row :gutter="16">
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">速度</div>
              <div class="stat-value">{{ wpm }} <span class="unit">字/分</span></div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">正确率</div>
              <div class="stat-value" :class="accuracyClass">{{ accuracy }}<span class="unit">%</span></div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">用时</div>
              <div class="stat-value">{{ elapsedTime }} <span class="unit">秒</span></div>
            </div>
          </el-col>
          <el-col :span="6">
            <div class="stat-item">
              <div class="stat-label">进度</div>
              <div class="stat-value">{{ progress }}<span class="unit">%</span></div>
            </div>
          </el-col>
        </el-row>
      </div>

      <!-- 原文显示区域 -->
      <div class="original-text-container">
        <div class="section-title">
          原文
          <el-tag size="small" type="info" style="margin-left: 8px">第 {{ currentLine + 1 }} 行 / 共 {{ lineStartIndices.length }} 行</el-tag>
        </div>
        <div ref="originalTextRef" class="original-text">
          <template v-for="(lineStart, lineIdx) in lineStartIndices" :key="lineIdx">
            <div class="text-line" :class="{ 'current-line': lineIdx === currentLine }">
              <span
                v-for="(char, charIdx) in getLineText(lineIdx)"
                :key="`${lineIdx}-${charIdx}`"
                :class="[
                  'char',
                  {
                    'current': getGlobalIndex(lineIdx, charIdx) === currentIndex,
                    'correct': typedStatus[getGlobalIndex(lineIdx, charIdx)] === 'correct',
                    'incorrect': typedStatus[getGlobalIndex(lineIdx, charIdx)] === 'incorrect',
                    'pending': getGlobalIndex(lineIdx, charIdx) > currentIndex
                  }
                ]"
              >{{ char }}</span>
            </div>
          </template>
        </div>
      </div>

      <!-- 输入区域 -->
      <div class="input-area">
        <div class="section-title">
          跟打输入
          <el-tag v-if="isFinished" type="success" size="small" style="margin-left: 8px">已完成</el-tag>
        </div>
        <div class="typing-input-container">
          <!-- 隐藏的 textarea 用于接收输入 -->
          <textarea
            ref="inputRef"
            v-model="userInput"
            class="hidden-input"
            :disabled="isFinished"
            @keydown="handleKeydown"
            @beforeinput="handleBeforeInput"
            @input="handleTextareaInput"
            @compositionstart="isComposing = true"
            @compositionend="handleCompositionEnd"
          ></textarea>
          <!-- 显示的 div 用于展示输入 -->
          <div class="typing-display" @click="focusInput">
            <template v-for="(lineStart, lineIdx) in lineStartIndices" :key="lineIdx">
              <div class="input-line" :class="{ 'current-line': lineIdx === currentLine }">
                <span
                  v-for="(char, charIdx) in getInputLineText(lineIdx)"
                  :key="`${lineIdx}-${charIdx}`"
                  :class="[
                    'input-char',
                    {
                      'correct': typedStatus[getGlobalIndex(lineIdx, charIdx)] === 'correct',
                      'incorrect': typedStatus[getGlobalIndex(lineIdx, charIdx)] === 'incorrect',
                      'cursor': getGlobalIndex(lineIdx, charIdx) === currentIndex
                    }
                  ]"
                >{{ char }}</span>
                <span v-if="lineIdx === currentLine && !isFinished" class="cursor-blink">|</span>
              </div>
            </template>
          </div>
        </div>
      </div>

      <!-- 控制按钮 -->
    <div class="controls">
        <el-button @click="handleReset">
          <el-icon><Refresh /></el-icon> 重新开始
        </el-button>
        <el-button type="primary" @click="handlePause" :disabled="isFinished">
          <el-icon><VideoPause v-if="!isPaused" /><VideoPlay v-else /></el-icon>
          {{ isPaused ? '继续' : '暂停' }}
        </el-button>
        <el-button type="success" @click="handleFinish" :disabled="isFinished || userInput.length === 0">
          <el-icon><Check /></el-icon> 完成
        </el-button>
        <el-button type="warning" @click="loadProgress" :disabled="!hasSavedProgress">
          恢复进度
        </el-button>
      </div>

      <!-- 结果显示 -->
      <div v-if="isFinished" class="result-panel">
        <el-divider />
        <el-result
          :icon="resultIcon"
          :title="resultTitle"
          :sub-title="resultSubtitle"
        >
          <template #extra>
            <el-button type="primary" @click="handleReset">再练一次</el-button>
            <el-button @click="handleClose">返回</el-button>
          </template>
        </el-result>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick } from 'vue';
import { ElMessage } from 'element-plus';
import { Refresh, VideoPause, VideoPlay, Check } from '@element-plus/icons-vue';
import { useTextMemoryStore } from '@/stores/textMemory';
import type { TextArticle } from '@/types/text-memory';

const textStore = useTextMemoryStore();

interface Props {
  modelValue: boolean;
  article: TextArticle | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

// 限制显示的文本长度（太长的文章不适合跟打）
const MAX_TEXT_LENGTH = 500;

// 响应式数据
const userInput = ref('');
const currentIndex = ref(0);
const typedStatus = ref<('correct' | 'incorrect' | 'pending')[]>([]);
const isFinished = ref(false);
const isPaused = ref(false);
const startTime = ref<number | null>(null);
const elapsedTime = ref(0);
const timer = ref<number | null>(null);
const wpm = ref(0);

// 行级锁定相关
const lineStartIndices = ref<number[]>([0]); // 每行的起始字符索引
const currentLine = ref(0); // 当前行号
const LINE_LENGTH = 32; // 每行固定字数（根据显示区域宽度调整）

// 中文输入法相关
const isComposing = ref(false); // 是否正在输入法输入中

// Refs
const inputRef = ref<HTMLInputElement | null>(null);
const originalTextRef = ref<HTMLElement | null>(null);

// 处理后的文本（限制长度）
const displayText = computed(() => {
  if (!props.article) return '';
  return props.article.content.slice(0, MAX_TEXT_LENGTH);
});

// 计算每行的起始位置
function calculateLineBreaks() {
  const text = displayText.value;
  const breaks: number[] = [0];
  for (let i = LINE_LENGTH; i < text.length; i += LINE_LENGTH) {
    breaks.push(i);
  }
  lineStartIndices.value = breaks;
}

// 进度百分比
const progress = computed(() => {
  if (displayText.value.length === 0) return 0;
  return Math.round((currentIndex.value / displayText.value.length) * 100);
});

// 正确率
const accuracy = computed(() => {
  const typed = typedStatus.value.filter(s => s !== 'pending');
  if (typed.length === 0) return 100;
  const correct = typed.filter(s => s === 'correct').length;
  return Math.round((correct / typed.length) * 100);
});

// 正确率样式
const accuracyClass = computed(() => {
  if (accuracy.value >= 95) return 'excellent';
  if (accuracy.value >= 80) return 'good';
  if (accuracy.value >= 60) return 'fair';
  return 'poor';
});

// 结果图标
const resultIcon = computed(() => {
  if (accuracy.value >= 95) return 'success';
  if (accuracy.value >= 80) return 'success';
  if (accuracy.value >= 60) return 'warning';
  return 'error';
});

// 结果标题
const resultTitle = computed(() => {
  if (accuracy.value >= 95) return '太棒了！';
  if (accuracy.value >= 80) return '做得很好！';
  if (accuracy.value >= 60) return '继续加油！';
  return '还需要练习';
});

// 结果副标题
const resultSubtitle = computed(() => {
  return `速度: ${wpm.value} 字/分 | 正确率: ${accuracy.value}% | 用时: ${elapsedTime.value} 秒`;
});

// 监听对话框打开
watch(() => props.modelValue, (newVal) => {
  if (newVal && props.article) {
    // 尝试加载上次的进度
    const savedProgress = textStore.getLearningProgress(props.article._id, 'typing');
    if (savedProgress?.progress?.userInput && !savedProgress.progress.isFinished) {
      restoreProgress(savedProgress.progress);
      ElMessage.info('已恢复上次的练习进度');
    } else {
      resetPractice();
    }
  }
});

// 是否有保存的进度
const hasSavedProgress = computed(() => {
  if (!props.article) return false;
  const progress = textStore.getLearningProgress(props.article._id, 'typing');
  return !!progress?.progress?.userInput && !progress?.progress?.isFinished;
});

// 恢复进度
function restoreProgress(savedProgress: any) {
  userInput.value = savedProgress.userInput || '';
  typedStatus.value = savedProgress.typedStatus || [];
  currentIndex.value = savedProgress.currentIndex || 0;
  elapsedTime.value = savedProgress.elapsedTime || 0;
  wpm.value = savedProgress.wpm || 0;
  isFinished.value = false;
  isPaused.value = false;
  calculateLineBreaks();
  currentLine.value = getLineIndex(currentIndex.value);
}

// 获取指定行的文本
function getLineText(lineIdx: number): string {
  const start = lineStartIndices.value[lineIdx];
  const end = lineStartIndices.value[lineIdx + 1] || displayText.value.length;
  return displayText.value.slice(start, end);
}

// 获取输入行文本
function getInputLineText(lineIdx: number): string {
  const start = lineStartIndices.value[lineIdx];
  const end = lineStartIndices.value[lineIdx + 1] || displayText.value.length;
  const input = userInput.value.replace(/\n/g, '');
  return input.slice(start, end);
}

// 获取全局字符索引
function getGlobalIndex(lineIdx: number, charIdx: number): number {
  return lineStartIndices.value[lineIdx] + charIdx;
}

// 对话框打开后的处理
function handleOpened() {
  nextTick(() => {
    initTypedStatus();
    setTimeout(() => {
      inputRef.value?.focus();
    }, 100);
  });
}

// 对话框关闭后的处理
function handleClosed() {
  stopTimer();
}

// 初始化打字状态
function initTypedStatus() {
  typedStatus.value = new Array(displayText.value.length).fill('pending');
  calculateLineBreaks();
  currentLine.value = 0;
}

// 获取指定索引所在的行号
function getLineIndex(charIndex: number): number {
  for (let i = lineStartIndices.value.length - 1; i >= 0; i--) {
    if (charIndex >= lineStartIndices.value[i]) {
      return i;
    }
  }
  return 0;
}

// 聚焦到输入框
function focusInput() {
  inputRef.value?.focus();
}

// 处理 textarea 输入
function handleTextareaInput() {
  if (isPaused.value || isFinished.value) return;
  if (isComposing.value) return; // 输入法输入中不处理
  
  if (!startTime.value) {
    startTimer();
  }

  processInput();
}

// 处理输入内容
function processInput() {
  const input = userInput.value.replace(/\n/g, '');
  const original = displayText.value;

  // 更新每个字符的状态
  for (let i = 0; i < original.length; i++) {
    if (i < input.length) {
      typedStatus.value[i] = input[i] === original[i] ? 'correct' : 'incorrect';
    } else {
      typedStatus.value[i] = 'pending';
    }
  }

  // 更新当前索引
  currentIndex.value = input.length;

  // 更新当前行
  currentLine.value = getLineIndex(currentIndex.value);

  // 计算 WPM
  if (startTime.value) {
    const minutes = elapsedTime.value / 60;
    if (minutes > 0) {
      wpm.value = Math.round(input.length / minutes);
    }
  }

  // 滚动原文到可视区域
  scrollToCurrentChar();

  // 检查是否完成
  if (input.length >= original.length) {
    handleFinish();
  }
}

// 处理单个字符输入（从键盘事件触发）
function handleInput(char: string) {
  if (isPaused.value || isFinished.value) return;
  
  if (!startTime.value) {
    startTimer();
  }

  // 添加字符到输入
  userInput.value += char;
  processInput();
}

// 处理 beforeinput 事件，用于阻止回车输入
function handleBeforeInput(e: InputEvent) {
  // 阻止回车键输入换行符
  if (e.data === '\n' || e.inputType === 'insertLineBreak') {
    e.preventDefault();
    handleEnterKey();
    return;
  }
}

// 处理回车键逻辑
function handleEnterKey() {
  if (isPaused.value || isFinished.value) return;
  
  const currentLineIndex = getLineIndex(currentIndex.value);
  
  // 获取当前行的起始和结束位置
  const lineStart = lineStartIndices.value[currentLineIndex];
  const nextLineStart = lineStartIndices.value[currentLineIndex + 1];
  const lineEnd = nextLineStart !== undefined ? nextLineStart : displayText.value.length;
  
  // 计算当前行已输入的字符数
  const input = userInput.value.replace(/\n/g, '');
  const currentLineInputLength = input.length - lineStart;
  const currentLineLength = lineEnd - lineStart;
  
  // 只有当当前行打完了，才允许换行
  if (currentLineInputLength >= currentLineLength && nextLineStart !== undefined) {
    // 完成当前行，进入下一行
    userInput.value += '\n'; // 添加换行符到输入
    currentLine.value = currentLineIndex + 1;
    
    // 滚动到下一行
    nextTick(() => {
      scrollToCurrentChar();
    });
  } else if (currentIndex.value >= displayText.value.length) {
    // 最后一行且已打完，完成练习
    handleFinish();
  }
}

// 处理键盘事件
function handleKeydown(e: KeyboardEvent) {
  // 输入法输入中不处理
  if (isComposing.value) return;
  
  // 阻止回退到上一行
  if (e.key === 'Backspace') {
    e.preventDefault();
    const newIndex = currentIndex.value - 1;
    const currentLineIndex = getLineIndex(currentIndex.value);
    const prevLineIndex = getLineIndex(newIndex);
    
    // 如果回退会到上一行，或者已经在开头，阻止回退
    if (prevLineIndex < currentLine.value || currentIndex.value <= 0) {
      return;
    }
    
    // 删除最后一个字符
    userInput.value = userInput.value.slice(0, -1);
    
    // 重新计算状态
    processInput();
    return;
  }
  
  // 回车键在 beforeinput 中处理，这里只需要阻止默认行为
  if (e.key === 'Enter') {
    e.preventDefault();
    return;
  }
}

// 处理中文输入法输入完成
function handleCompositionEnd(e: CompositionEvent) {
  isComposing.value = false;
  // 中文输入完成后，直接处理当前的输入值
  nextTick(() => {
    processInput();
  });
}

// 滚动到当前行
function scrollToCurrentChar() {
  // 使用 requestAnimationFrame 确保 DOM 已更新
  requestAnimationFrame(() => {
    nextTick(() => {
      const container = originalTextRef.value;
      if (!container) return;

      // 优先滚动到当前行
      const currentLineEl = container.querySelector('.text-line.current-line') as HTMLElement;
      if (currentLineEl) {
        // 使用容器滚动而不是 scrollIntoView
        const containerRect = container.getBoundingClientRect();
        const lineRect = currentLineEl.getBoundingClientRect();
        const lineTop = lineRect.top - containerRect.top + container.scrollTop;
        const containerHeight = containerRect.height;
        const lineHeight = lineRect.height;
        
        // 计算目标滚动位置，将当前行居中显示
        const targetScrollTop = lineTop - containerHeight / 2 + lineHeight / 2;
        
        container.scrollTo({
          top: targetScrollTop,
          behavior: 'smooth'
        });
        return;
      }

      // 如果没有当前行，滚动到当前字符
      const currentChar = container.querySelector('.char.current') as HTMLElement;
      if (currentChar) {
        currentChar.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  });
}

// 开始计时
function startTimer() {
  startTime.value = Date.now();
  timer.value = window.setInterval(() => {
    if (!isPaused.value) {
      elapsedTime.value = Math.floor((Date.now() - startTime.value!) / 1000);
    }
  }, 1000);
}

// 停止计时
function stopTimer() {
  if (timer.value) {
    clearInterval(timer.value);
    timer.value = null;
  }
}

// 暂停/继续
function handlePause() {
  if (isFinished.value) return;
  isPaused.value = !isPaused.value;
  if (!isPaused.value) {
    inputRef.value?.focus();
  }
}

// 完成练习
function handleFinish() {
  if (isFinished.value) return;
  isFinished.value = true;
  stopTimer();
  
  // 保存练习记录
  savePracticeRecord();
}

// 保存练习记录
async function savePracticeRecord() {
  if (!props.article) return;
  
  const record = {
    articleId: props.article._id,
    articleTitle: props.article.title,
    wpm: wpm.value,
    accuracy: accuracy.value,
    elapsedTime: elapsedTime.value,
    date: Date.now()
  };

  // 从 localStorage 读取历史记录
  const history = JSON.parse(localStorage.getItem('typing_practice_history') || '[]');
  history.unshift(record);
  // 只保留最近 50 条记录
  if (history.length > 50) {
    history.pop();
  }
  localStorage.setItem('typing_practice_history', JSON.stringify(history));

  // 保存当前进度到 store
  const progress = {
    userInput: userInput.value,
    typedStatus: typedStatus.value,
    currentIndex: currentIndex.value,
    elapsedTime: elapsedTime.value,
    wpm: wpm.value,
    isFinished: isFinished.value,
    currentLine: currentLine.value
  };
  await textStore.saveLearningProgress(props.article._id, 'typing', progress);
}

// 加载进度
function loadProgress() {
  if (!props.article) return;
  
  const savedProgress = textStore.getLearningProgress(props.article._id, 'typing');
  if (savedProgress?.progress?.userInput && !savedProgress.progress.isFinished) {
    restoreProgress(savedProgress.progress);
    ElMessage.success('进度已恢复');
  } else {
    ElMessage.warning('没有找到保存的进度');
  }
}

// 重置练习
function handleReset() {
  resetPractice();
  nextTick(() => {
    inputRef.value?.focus();
  });
}

// 重置状态
function resetPractice() {
  userInput.value = '';
  currentIndex.value = 0;
  isFinished.value = false;
  isPaused.value = false;
  startTime.value = null;
  elapsedTime.value = 0;
  wpm.value = 0;
  currentLine.value = 0;
  stopTimer();
  initTypedStatus();
}

// 关闭对话框
function handleClose() {
  emit('update:modelValue', false);
}
</script>

<style scoped lang="scss">
.typing-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.stats-panel {
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  padding: 12px 16px;

  .stat-item {
    text-align: center;

    .stat-label {
      font-size: 12px;
      color: var(--utools-text-secondary);
      margin-bottom: 4px;
    }

    .stat-value {
      font-size: 24px;
      font-weight: 600;
      color: var(--utools-text-primary);

      .unit {
        font-size: 12px;
        font-weight: normal;
        color: var(--utools-text-secondary);
        margin-left: 2px;
      }

      &.excellent {
        color: var(--utools-success);
      }

      &.good {
        color: #67c23a;
      }

      &.fair {
        color: var(--utools-warning);
      }

      &.poor {
        color: var(--utools-danger);
      }
    }
  }
}

.section-title {
  font-size: 14px;
  font-weight: 500;
  color: var(--utools-text-secondary);
  margin-bottom: 8px;
}

.original-text-container {
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  padding: 16px;

  .original-text {
    font-size: 18px;
    line-height: 2;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    max-height: 144px;
    overflow-y: auto;
    scroll-behavior: smooth;

    &::-webkit-scrollbar {
      width: 6px;
    }

    &::-webkit-scrollbar-thumb {
      background: var(--utools-border-color);
      border-radius: 3px;
    }

    .text-line {
      display: block;
      padding: 2px 4px;
      border-radius: 4px;
      transition: background-color 0.2s;
      white-space: nowrap;
      overflow: hidden;
      height: 36px;

      &.current-line {
        background: rgba(64, 158, 255, 0.1);
        border-left: 3px solid var(--utools-primary);
        padding-left: 8px;
      }
    }

    .char {
      padding: 2px 1px;
      border-radius: 2px;
      transition: all 0.1s;

      &.pending {
        color: var(--utools-text-secondary);
      }

      &.current {
        background: var(--utools-primary);
        color: white;
        animation: blink 1s infinite;
      }

      &.correct {
        color: var(--utools-success);
        background: rgba(103, 194, 58, 0.1);
      }

      &.incorrect {
        color: var(--utools-danger);
        background: rgba(245, 108, 108, 0.1);
        text-decoration: underline;
      }
    }
  }
}

@keyframes blink {
  0%, 50% {
    opacity: 1;
  }
  51%, 100% {
    opacity: 0.7;
  }
}

.input-area {
  .typing-input-container {
    position: relative;
    font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
    font-size: 18px;
    line-height: 2;
    background: var(--utools-bg-primary);
    border: 1px solid var(--utools-border-color);
    border-radius: 8px;
    min-height: 144px;
    max-height: 144px;
    overflow: hidden;

    &:focus-within {
      border-color: var(--utools-primary);
    }

    .hidden-input {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      opacity: 0;
      z-index: 1;
      cursor: text;
      resize: none;
      border: none;
      outline: none;
      padding: 16px;
      font-size: 18px;
      line-height: 2;
    }

    .typing-display {
      position: relative;
      z-index: 0;
      padding: 16px;
      min-height: 144px;
      max-height: 144px;
      overflow-y: auto;
      pointer-events: none;
      scroll-behavior: smooth;

      .input-line {
        display: block;
        padding: 2px 4px;
        border-radius: 4px;
        transition: background-color 0.2s;
        min-height: 36px;

        &.current-line {
          background: rgba(64, 158, 255, 0.05);
        }
      }

      .input-char {
        padding: 2px 1px;
        border-radius: 2px;
        transition: all 0.1s;

        &.correct {
          color: var(--utools-success);
        }

        &.incorrect {
          color: var(--utools-danger);
          text-decoration: underline;
        }
      }

      .cursor-blink {
        animation: blink 1s infinite;
        color: var(--utools-primary);
      }
    }
  }
}

.controls {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.result-panel {
  margin-top: 8px;
}
</style>
