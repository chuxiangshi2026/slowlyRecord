<template>
  <div class="memory-test">
    <div class="header">
      <h2>记忆力测试</h2>
      <div class="mode-tabs">
        <el-radio-group v-model="currentMode" size="large" @change="resetTest">
          <el-radio-button label="number">数字记忆</el-radio-button>
          <el-radio-button label="word">单词记忆</el-radio-button>
          <el-radio-button label="pattern">图案记忆</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="content">
      <!-- 设置区域 -->
      <div v-if="!isTesting && !showResult" class="settings">
        <div class="setting-item">
          <span>难度选择：</span>
          <el-radio-group v-model="difficulty">
            <el-radio-button label="easy">简单</el-radio-button>
            <el-radio-button label="medium">中等</el-radio-button>
            <el-radio-button label="hard">困难</el-radio-button>
          </el-radio-group>
        </div>
        <el-button type="primary" size="large" @click="startTest">开始测试</el-button>
      </div>

      <!-- 测试区域 -->
      <div v-else-if="isTesting" class="test-area">
        <div class="stage-info">第 {{ currentStage }} 轮</div>

        <!-- 数字记忆 -->
        <template v-if="currentMode === 'number'">
          <div v-if="showingNumbers" class="display-area">
            <div class="number-display">{{ currentNumber }}</div>
            <div class="timer">{{ displayTime }}s</div>
          </div>
          <div v-else class="input-area">
            <p>请输入刚才的数字：</p>
            <el-input
                v-model="userInput"
                size="large"
                placeholder="输入数字"
                @keyup.enter="submitAnswer"
            />
            <el-button type="primary" @click="submitAnswer">确认</el-button>
          </div>
        </template>

        <!-- 单词记忆 -->
        <template v-if="currentMode === 'word'">
          <div v-if="showingWords" class="display-area">
            <div class="word-display">
              <div v-for="(word, index) in currentWords" :key="index" class="word-item">
                {{ word }}
              </div>
            </div>
            <div class="timer">{{ displayTime }}s</div>
          </div>
          <div v-else class="input-area">
            <p>请输入刚才的单词（用逗号分隔）：</p>
            <el-input
                v-model="userInput"
                size="large"
                type="textarea"
                :rows="3"
                placeholder="输入单词，用逗号分隔"
                @keyup.enter="submitAnswer"
            />
            <el-button type="primary" @click="submitAnswer">确认</el-button>
          </div>
        </template>

        <!-- 图案记忆 -->
        <template v-if="currentMode === 'pattern'">
          <div v-if="showingPattern" class="display-area">
            <div class="pattern-grid" :style="gridStyle">
              <div
                  v-for="(cell, index) in patternCells"
                  :key="index"
                  class="pattern-cell"
                  :class="{ active: activeCells.includes(index) }"
              />
            </div>
            <div class="timer">{{ displayTime }}s</div>
          </div>
          <div v-else class="input-area">
            <p>请按顺序点击刚才亮起的格子：</p>
            <div class="pattern-grid" :style="gridStyle">
              <div
                  v-for="(cell, index) in patternCells"
                  :key="index"
                  class="pattern-cell clickable"
                  :class="{ selected: userSelectedCells.includes(index), correct: showCorrect && correctCells.includes(index), wrong: showCorrect && wrongCells.includes(index) }"
                  @click="selectCell(index)"
              />
            </div>
            <el-button type="primary" @click="submitPattern">确认</el-button>
          </div>
        </template>
      </div>

      <!-- 结果展示 -->
      <div v-if="showResult" class="result-area">
        <h3>测试完成！</h3>
        <div class="stats">
          <div class="stat-item">
            <span class="label">模式：</span>
            <span>{{ modeText }}</span>
          </div>
          <div class="stat-item">
            <span class="label">难度：</span>
            <span>{{ difficultyText }}</span>
          </div>
          <div class="stat-item">
            <span class="label">完成轮数：</span>
            <span>{{ currentStage - 1 }}</span>
          </div>
          <div class="stat-item">
            <span class="label">最高通过：</span>
            <span>第 {{ maxStage }} 轮</span>
          </div>
        </div>
        <el-button type="primary" @click="resetTest">再测一次</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

// 测试模式
type TestMode = 'number' | 'word' | 'pattern';
type Difficulty = 'easy' | 'medium' | 'hard';

const currentMode = ref<TestMode>('number');
const difficulty = ref<Difficulty>('easy');
const isTesting = ref(false);
const showResult = ref(false);
const currentStage = ref(1);
const maxStage = ref(0);

// 显示相关
const showingNumbers = ref(false);
const showingWords = ref(false);
const showingPattern = ref(false);
const displayTime = ref(0);
let timerInterval: number | null = null;

// 数字记忆
const currentNumber = ref('');

// 单词记忆
const currentWords = ref<string[]>([]);
const commonWords = [
  'apple', 'book', 'cat', 'dog', 'egg', 'fish', 'girl', 'hat', 'ice', 'jump',
  'kite', 'lamp', 'moon', 'nest', 'orange', 'pen', 'queen', 'rose', 'sun', 'tree',
  'umbrella', 'violin', 'water', 'box', 'yellow', 'zoo', 'ant', 'bird', 'car', 'desk'
];

// 图案记忆
const patternCells = ref(Array(16).fill(0));
const activeCells = ref<number[]>([]);
const userSelectedCells = ref<number[]>([]);
const showCorrect = ref(false);
const wrongCells = ref<number[]>([]);
const correctCells = ref<number[]>([]);

// 用户输入
const userInput = ref('');

const modeText = computed(() => {
  const map: Record<TestMode, string> = {
    number: '数字记忆',
    word: '单词记忆',
    pattern: '图案记忆'
  };
  return map[currentMode.value];
});

const difficultyText = computed(() => {
  const map: Record<Difficulty, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };
  return map[difficulty.value];
});

const gridStyle = computed(() => {
  const size = difficulty.value === 'easy' ? 3 : difficulty.value === 'medium' ? 4 : 5;
  return {
    gridTemplateColumns: `repeat(${size}, 1fr)`,
    gridTemplateRows: `repeat(${size}, 1fr)`
  };
});

function getDisplayDuration(): number {
  const base = difficulty.value === 'easy' ? 3 : difficulty.value === 'medium' ? 2 : 1.5;
  return Math.max(1, base + currentStage.value * 0.5);
}

function getNumberLength(): number {
  const base = difficulty.value === 'easy' ? 4 : difficulty.value === 'medium' ? 6 : 8;
  return base + Math.floor((currentStage.value - 1) / 2) * 2;
}

function getWordCount(): number {
  const base = difficulty.value === 'easy' ? 3 : difficulty.value === 'medium' ? 5 : 7;
  return Math.min(base + Math.floor((currentStage.value - 1) / 2), 12);
}

function getGridSize(): number {
  return difficulty.value === 'easy' ? 9 : difficulty.value === 'medium' ? 16 : 25;
}

function getActiveCellCount(): number {
  const base = difficulty.value === 'easy' ? 3 : difficulty.value === 'medium' ? 5 : 7;
  return Math.min(base + Math.floor((currentStage.value - 1) / 2), getGridSize() - 1);
}

function generateNumber(): string {
  const length = getNumberLength();
  let num = '';
  for (let i = 0; i < length; i++) {
    num += Math.floor(Math.random() * 10);
  }
  return num;
}

function generateWords(): string[] {
  const count = getWordCount();
  const words: string[] = [];
  const used = new Set<string>();
  while (words.length < count) {
    const word = commonWords[Math.floor(Math.random() * commonWords.length)];
    if (!used.has(word)) {
      used.add(word);
      words.push(word);
    }
  }
  return words;
}

function generatePattern(): number[] {
  const gridSize = getGridSize();
  const count = getActiveCellCount();
  const cells: number[] = [];
  const used = new Set<number>();
  while (cells.length < count) {
    const idx = Math.floor(Math.random() * gridSize);
    if (!used.has(idx)) {
      used.add(idx);
      cells.push(idx);
    }
  }
  return cells;
}

function startTimer(duration: number, callback: () => void) {
  displayTime.value = Math.ceil(duration);
  timerInterval = window.setInterval(() => {
    displayTime.value--;
    if (displayTime.value <= 0) {
      clearInterval(timerInterval!);
      callback();
    }
  }, 1000);
}

function startTest() {
  isTesting.value = true;
  showResult.value = false;
  currentStage.value = 1;
  maxStage.value = 0;
  startStage();
}

function startStage() {
  userInput.value = '';
  userSelectedCells.value = [];
  showCorrect.value = false;
  wrongCells.value = [];
  correctCells.value = [];

  if (currentMode.value === 'number') {
    currentNumber.value = generateNumber();
    showingNumbers.value = true;
    startTimer(getDisplayDuration(), () => {
      showingNumbers.value = false;
    });
  } else if (currentMode.value === 'word') {
    currentWords.value = generateWords();
    showingWords.value = true;
    startTimer(getDisplayDuration(), () => {
      showingWords.value = false;
    });
  } else if (currentMode.value === 'pattern') {
    const gridSize = getGridSize();
    patternCells.value = Array(gridSize).fill(0);
    activeCells.value = generatePattern();
    showingPattern.value = true;
    startTimer(getDisplayDuration(), () => {
      showingPattern.value = false;
    });
  }
}

function submitAnswer() {
  let correct = false;

  if (currentMode.value === 'number') {
    correct = userInput.value === currentNumber.value;
  } else if (currentMode.value === 'word') {
    const inputWords = userInput.value.toLowerCase().split(/[,，\s]+/).filter(w => w);
    const targetWords = currentWords.value.map(w => w.toLowerCase());
    correct = inputWords.length === targetWords.length &&
        inputWords.every((w, i) => w === targetWords[i]);
  }

  if (correct) {
    maxStage.value = currentStage.value;
    currentStage.value++;
    startStage();
  } else {
    endTest();
  }
}

function selectCell(index: number) {
  if (showCorrect.value) return;
  if (userSelectedCells.value.includes(index)) {
    userSelectedCells.value = userSelectedCells.value.filter(i => i !== index);
  } else {
    userSelectedCells.value.push(index);
  }
}

function submitPattern() {
  showCorrect.value = true;
  const correct = activeCells.value.every(idx => userSelectedCells.value.includes(idx)) &&
      userSelectedCells.value.length === activeCells.value.length;

  wrongCells.value = userSelectedCells.value.filter(idx => !activeCells.value.includes(idx));
  correctCells.value = activeCells.value;

  setTimeout(() => {
    if (correct) {
      maxStage.value = currentStage.value;
      currentStage.value++;
      startStage();
    } else {
      endTest();
    }
  }, 1500);
}

function endTest() {
  isTesting.value = false;
  showResult.value = true;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

function resetTest() {
  isTesting.value = false;
  showResult.value = false;
  currentStage.value = 1;
  maxStage.value = 0;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

onUnmounted(() => {
  if (timerInterval) {
    clearInterval(timerInterval);
  }
});
</script>

<style scoped>
.memory-test {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
}

.header {
  text-align: center;
  margin-bottom: 30px;
}

.header h2 {
  margin-bottom: 20px;
  color: var(--utools-text-primary);
}

.mode-tabs {
  margin-bottom: 20px;
}

.content {
  background: var(--utools-bg-card);
  border-radius: 8px;
  padding: 30px;
  box-shadow: var(--utools-shadow-sm);
}

.settings {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 20px;
}

.setting-item {
  display: flex;
  align-items: center;
  gap: 10px;
  color: var(--utools-text-primary);
}

.test-area {
  text-align: center;
}

.stage-info {
  font-size: 18px;
  color: var(--utools-text-secondary);
  margin-bottom: 20px;
}

.display-area {
  margin: 30px 0;
}

.number-display {
  font-size: 48px;
  font-weight: bold;
  letter-spacing: 10px;
  color: var(--utools-text-primary);
  margin-bottom: 20px;
}

.word-display {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 15px;
  margin-bottom: 20px;
}

.word-item {
  font-size: 24px;
  padding: 10px 20px;
  background: var(--utools-bg-tertiary);
  border-radius: 4px;
  color: var(--utools-text-primary);
}

.timer {
  font-size: 24px;
  color: var(--utools-primary);
  font-weight: bold;
}

.input-area {
  margin-top: 20px;
}

.input-area p {
  margin-bottom: 15px;
  color: var(--utools-text-secondary);
}

.input-area .el-input,
.input-area .el-textarea {
  max-width: 400px;
  margin-bottom: 15px;
}

.pattern-grid {
  display: grid;
  gap: 10px;
  max-width: 400px;
  margin: 20px auto;
}

.pattern-cell {
  aspect-ratio: 1;
  background: var(--utools-bg-tertiary);
  border-radius: 4px;
  transition: all 0.2s;
}

.pattern-cell.active {
  background: var(--utools-primary);
}

.pattern-cell.clickable {
  cursor: pointer;
}

.pattern-cell.clickable:hover {
  background: var(--utools-border-primary);
}

.pattern-cell.selected {
  background: var(--utools-success);
}

.pattern-cell.correct {
  background: var(--utools-success);
}

.pattern-cell.wrong {
  background: var(--utools-danger);
}

.result-area {
  text-align: center;
  background: var(--utools-bg-secondary);
  border: 1px solid var(--utools-border-divider);
  border-radius: 8px;
  padding: 30px;
  margin: 20px 0;
}

.result-area h3 {
  margin-bottom: 20px;
  color: var(--utools-text-primary);
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 30px;
}

.stat-item {
  font-size: 16px;
  color: var(--utools-text-primary);
}

.stat-item .label {
  color: var(--utools-text-secondary);
  margin-right: 10px;
}
</style>
