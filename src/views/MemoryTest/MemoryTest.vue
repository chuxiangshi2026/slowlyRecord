<template>
  <div class="memory-test">
    <div class="header">
      <h2>记忆力测试</h2>
      <div class="mode-tabs">
        <el-radio-group v-model="currentMode" size="large" @change="resetTest">
          <el-radio-button label="number">数字记忆</el-radio-button>
          <el-radio-button label="word">单词记忆</el-radio-button>
          <el-radio-button label="pattern">图案记忆</el-radio-button>
          <el-radio-button label="vocabulary">词汇量测试</el-radio-button>
        </el-radio-group>
      </div>
    </div>

    <div class="content">
      <!-- 词汇量测试组件 -->
      <VocabularyTest v-if="currentMode === 'vocabulary'" />

      <!-- 设置区域 -->
      <div v-else-if="!isTesting && !showResult" class="settings">
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
        <div class="result-header">
          <el-icon :size="48" :color="getLevelColor(testConclusion?.level)"><Trophy /></el-icon>
          <h3>测试完成！</h3>
          <el-tag :type="getLevelTagType(testConclusion?.level)" size="large" class="level-tag">
            {{ testConclusion?.levelText || '测试中' }}
          </el-tag>
        </div>

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

        <!-- 测试结论 -->
        <div v-if="testConclusion" class="conclusion-section">
          <div class="conclusion-card">
            <h4><el-icon><User /></el-icon> 测试结论</h4>
            <p class="conclusion-summary">{{ testConclusion.summary }}</p>
            <ul class="conclusion-details">
              <li v-for="(detail, index) in testConclusion.details" :key="index">
                <el-icon><Check /></el-icon>
                {{ detail }}
              </li>
            </ul>
          </div>

          <!-- 训练建议 -->
          <div class="training-card">
            <h4>
              <el-icon><Reading /></el-icon>
              推荐训练方法：{{ testConclusion.recommendedTraining.method }}
            </h4>
            <p class="training-desc">{{ testConclusion.recommendedTraining.description }}</p>

            <div class="training-info">
              <el-tag :type="getDifficultyTag(testConclusion.recommendedTraining.difficulty)">
                难度：{{ getDifficultyText(testConclusion.recommendedTraining.difficulty) }}
              </el-tag>
              <el-tag type="info">
                <el-icon><Clock /></el-icon>
                {{ testConclusion.recommendedTraining.frequency }}
              </el-tag>
            </div>

            <div class="training-steps">
              <h5>训练步骤：</h5>
              <ol>
                <li v-for="(step, index) in testConclusion.recommendedTraining.steps" :key="index">
                  {{ step }}
                </li>
              </ol>
            </div>
          </div>
        </div>

        <div class="result-actions">
          <el-button type="primary" size="large" @click="resetTest">
            <el-icon><RefreshRight /></el-icon>
            再测一次
          </el-button>
          <el-button size="large" @click="goToTraining">
            <el-icon><TrendCharts /></el-icon>
            开始训练
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useWordsStore } from '@/stores/words';
import { useMemoryStore, type TestConclusion } from '@/stores/memory';
import VocabularyTest from './VocabularyTest.vue';
import {
  Trophy,
  User,
  Check,
  Reading,
  Clock,
  RefreshRight,
  TrendCharts
} from '@element-plus/icons-vue';
import { useRouter } from 'vue-router';

// 测试模式
type TestMode = 'number' | 'word' | 'pattern' | 'vocabulary';
type Difficulty = 'easy' | 'medium' | 'hard';

const wordsStore = useWordsStore();
const memoryStore = useMemoryStore();
const router = useRouter();

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

// 测试结论
const testConclusion = ref<TestConclusion | null>(null);

const modeText = computed(() => {
  const map: Record<TestMode, string> = {
    number: '数字记忆',
    word: '单词记忆',
    pattern: '图案记忆',
    vocabulary: '词汇量测试'
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

  // 生成测试结论
  if (currentMode.value !== 'vocabulary') {
    testConclusion.value = memoryStore.generateConclusion(
      currentMode.value as 'number' | 'word' | 'pattern',
      maxStage.value,
      difficulty.value
    );

    // 保存测试记录
    memoryStore.addHistory({
      mode: currentMode.value as 'number' | 'word' | 'pattern',
      modeText: modeText.value,
      success: maxStage.value >= (difficulty.value === 'easy' ? 3 : difficulty.value === 'medium' ? 5 : 7),
      result: `最高第 ${maxStage.value} 轮`,
      time: new Date().toLocaleString('zh-CN')
    });

    // 更新统计数据
    if (currentMode.value === 'number') {
      memoryStore.updateNumberStats(false, maxStage.value);
    } else if (currentMode.value === 'word') {
      const wordCount = (difficulty.value === 'easy' ? 3 : difficulty.value === 'medium' ? 5 : 7) + Math.floor((maxStage.value - 1) / 2);
      memoryStore.updateWordStats(Math.min(12, wordCount), maxStage.value > 1 ? Math.min(12, wordCount) : 0);
    } else if (currentMode.value === 'pattern') {
      memoryStore.updatePatternStats(false);
    }
  }

  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// 获取等级颜色
function getLevelColor(level?: string): string {
  const colors: Record<string, string> = {
    excellent: '#67C23A',
    good: '#409EFF',
    average: '#E6A23C',
    needs_improvement: '#F56C6C'
  };
  return colors[level || 'average'];
}

// 获取等级标签类型
function getLevelTagType(level?: string): 'success' | 'warning' | 'danger' | 'info' {
  const types: Record<string, 'success' | 'warning' | 'danger' | 'info'> = {
    excellent: 'success',
    good: 'info',
    average: 'warning',
    needs_improvement: 'danger'
  };
  return types[level || 'average'];
}

// 获取难度标签
function getDifficultyTag(difficulty: string): 'success' | 'warning' | 'danger' {
  const tags: Record<string, 'success' | 'warning' | 'danger'> = {
    easy: 'success',
    medium: 'warning',
    hard: 'danger'
  };
  return tags[difficulty] || 'info';
}

// 获取难度文本
function getDifficultyText(difficulty: string): string {
  const texts: Record<string, string> = {
    easy: '简单',
    medium: '中等',
    hard: '困难'
  };
  return texts[difficulty] || difficulty;
}

// 前往训练页面
function goToTraining() {
  const routes: Record<string, string> = {
    number: '/number-memory',
    word: '/text-memory',
    pattern: '/memory'
  };
  const route = routes[currentMode.value];
  if (route) {
    router.push(route);
  }
}

function resetTest() {
  isTesting.value = false;
  showResult.value = false;
  currentStage.value = 1;
  maxStage.value = 0;
  testConclusion.value = null;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

onMounted(() => {
  // 记录最后访问的页面
  wordsStore.setLastVisitedPage('/memory');
});

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

/* 结果头部 */
.result-header {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
  margin-bottom: 25px;
}

.result-header h3 {
  margin: 0;
  color: var(--utools-text-primary);
}

.level-tag {
  font-size: 16px;
  padding: 8px 20px;
}

/* 结论区域 */
.conclusion-section {
  margin: 30px 0;
  text-align: left;
}

.conclusion-card {
  background: var(--utools-bg-card);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 20px;
  box-shadow: var(--utools-shadow-sm);
}

.conclusion-card h4 {
  color: var(--utools-text-primary);
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.conclusion-card h4 .el-icon {
  color: var(--utools-primary);
}

.conclusion-summary {
  color: var(--utools-text-primary);
  font-size: 16px;
  line-height: 1.6;
  margin-bottom: 15px;
  padding: 15px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  border-left: 4px solid var(--utools-primary);
}

.conclusion-details {
  list-style: none;
  padding: 0;
  margin: 0;
}

.conclusion-details li {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--utools-text-secondary);
  padding: 8px 0;
  border-bottom: 1px dashed var(--utools-border-divider);
}

.conclusion-details li:last-child {
  border-bottom: none;
}

.conclusion-details .el-icon {
  color: #67C23A;
  font-size: 16px;
}

/* 训练卡片 */
.training-card {
  background: linear-gradient(135deg, var(--utools-bg-card) 0%, var(--utools-bg-secondary) 100%);
  border-radius: 12px;
  padding: 25px;
  box-shadow: var(--utools-shadow-sm);
  border: 1px solid var(--utools-border-primary);
}

.training-card h4 {
  color: var(--utools-text-primary);
  margin-bottom: 15px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.training-card h4 .el-icon {
  color: var(--utools-primary);
}

.training-desc {
  color: var(--utools-text-secondary);
  font-size: 15px;
  line-height: 1.6;
  margin-bottom: 15px;
}

.training-info {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.training-info .el-tag {
  display: flex;
  align-items: center;
  gap: 4px;
}

.training-steps {
  background: var(--utools-bg-card);
  border-radius: 8px;
  padding: 20px;
}

.training-steps h5 {
  color: var(--utools-text-primary);
  margin-bottom: 12px;
  font-size: 15px;
}

.training-steps ol {
  margin: 0;
  padding-left: 20px;
  color: var(--utools-text-secondary);
}

.training-steps li {
  padding: 6px 0;
  line-height: 1.5;
}

/* 结果操作按钮 */
.result-actions {
  display: flex;
  gap: 15px;
  justify-content: center;
  margin-top: 30px;
}

.result-actions .el-button {
  padding: 12px 30px;
  font-size: 15px;
}

.result-actions .el-icon {
  margin-right: 6px;
}

@media (max-width: 768px) {
  .training-info {
    flex-direction: column;
  }

  .result-actions {
    flex-direction: column;
  }

  .result-actions .el-button {
    width: 100%;
  }
}
</style>
