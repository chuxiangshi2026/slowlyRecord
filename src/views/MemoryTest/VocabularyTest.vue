<template>
  <div class="vocabulary-test">
    <!-- 开始界面 -->
    <div v-if="!isTesting && !showResult" class="intro-section">
      <div class="intro-header">
        <el-icon :size="48" class="test-icon"><Collection /></el-icon>
        <h2>词汇量测试</h2>
        <p class="subtitle">通过科学的抽样测试，准确估算您的英语词汇量</p>
      </div>

      <div class="features">
        <div class="feature-item">
          <el-icon><DocumentChecked /></el-icon>
          <span>基于权威词库（CET4/6、雅思、托福、GRE等）</span>
        </div>
        <div class="feature-item">
          <el-icon><TrendCharts /></el-icon>
          <span>智能算法估算词汇量</span>
        </div>
        <div class="feature-item">
          <el-icon><Reading /></el-icon>
          <span>个性化阅读推荐</span>
        </div>
      </div>

      <div class="test-options">
        <div class="option-item">
          <span>测试轮数：</span>
          <el-radio-group v-model="testConfig.rounds" size="large">
            <el-radio-button :label="3">快速（3轮/约5分钟）</el-radio-button>
            <el-radio-button :label="5">标准（5轮/约8分钟）</el-radio-button>
            <el-radio-button :label="7">精确（7轮/约12分钟）</el-radio-button>
          </el-radio-group>
        </div>
        
        <div class="option-item">
          <span>每轮单词数：</span>
          <el-slider v-model="testConfig.wordsPerRound" :min="5" :max="15" :step="1" show-stops />
          <span class="slider-value">{{ testConfig.wordsPerRound }} 个</span>
        </div>
      </div>

      <el-button type="primary" size="large" @click="startTest" class="start-btn">
        <el-icon><VideoPlay /></el-icon>
        开始测试
      </el-button>

      <!-- 历史记录 -->
      <div v-if="vocabStore.hasTestHistory" class="history-preview">
        <h3>测试历史</h3>
        <div class="history-stats">
          <div class="history-item">
            <span class="label">最新词汇量：</span>
            <span class="value highlight">{{ vocabStore.latestTest?.estimatedVocabulary.toLocaleString() }}</span>
          </div>
          <div class="history-item">
            <span class="label">平均词汇量：</span>
            <span class="value">{{ vocabStore.averageVocabulary.toLocaleString() }}</span>
          </div>
          <div v-if="vocabStore.vocabularyTrend" class="history-item">
            <span class="label">变化趋势：</span>
            <span :class="['value', vocabStore.vocabularyTrend.change >= 0 ? 'up' : 'down']">
              {{ vocabStore.vocabularyTrend.change >= 0 ? '+' : '' }}{{ vocabStore.vocabularyTrend.change }}
              ({{ vocabStore.vocabularyTrend.change >= 0 ? '+' : '' }}{{ vocabStore.vocabularyTrend.percentChange }}%)
            </span>
          </div>
        </div>
        <el-button link type="primary" @click="showHistoryDetail = true">查看详细历史</el-button>
      </div>
    </div>

    <!-- 测试进行中 -->
    <div v-else-if="isTesting" class="testing-section">
      <div class="progress-bar">
        <div class="progress-info">
          <span>第 {{ currentRound }} / {{ totalRounds }} 轮</span>
          <span>{{ currentLevel?.name }}</span>
        </div>
        <el-progress :percentage="progressPercent" :stroke-width="8" />
      </div>

      <div class="word-card">
        <div class="word-display">
          <h3 class="word">{{ currentWord?.word }}</h3>
          <p v-if="currentWord?.phonetic" class="phonetic">{{ currentWord.phonetic }}</p>
        </div>

        <p class="question">请选择该单词的正确释义：</p>

        <div class="options-grid">
          <el-button
            v-for="(option, index) in currentOptions"
            :key="index"
            :class="['option-btn', getOptionClass(index)]"
            @click="selectOption(index)"
            :disabled="hasAnswered"
          >
            {{ option }}
          </el-button>
        </div>

        <div v-if="hasAnswered" class="answer-feedback">
          <div :class="['feedback', isCorrect ? 'correct' : 'wrong']">
            <el-icon :size="24">
              <Check v-if="isCorrect" />
              <Close v-else />
            </el-icon>
            <span>{{ isCorrect ? '回答正确！' : '回答错误' }}</span>
          </div>
          <div class="word-detail">
            <p><strong>{{ currentWord?.word }}</strong> {{ currentWord?.phonetic }}</p>
            <p class="definition">{{ currentWord?.explains }}</p>
          </div>
          <el-button type="primary" @click="nextWord" class="next-btn">
            {{ isLastWord ? '查看结果' : '下一个' }}
            <el-icon><ArrowRight /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 测试结果 -->
    <div v-else-if="showResult" class="result-section">
      <div class="result-header">
        <el-icon :size="64" class="result-icon"><Trophy /></el-icon>
        <h2>测试完成！</h2>
      </div>

      <!-- 测试结果 -->
      <template v-if="testResult">
        <div class="vocabulary-score">
          <div class="score-circle">
            <span class="score-number">{{ testResult.estimatedVocabulary.toLocaleString() }}</span>
            <span class="score-label">预估词汇量</span>
          </div>
        </div>

        <div class="reading-level-card">
          <h3>
            <el-icon><Reading /></el-icon>
            阅读水平：{{ testResult.readingLevel }}
          </h3>
          <p class="level-desc">{{ testResult.readingLevelDesc }}</p>
        </div>

        <div class="level-breakdown">
          <h3>各等级掌握情况</h3>
          <div class="breakdown-list">
            <div 
              v-for="level in levelBreakdown" 
              :key="level.id"
              class="breakdown-item"
            >
              <div class="level-info">
                <span class="level-name">{{ level.name }}</span>
                <span class="level-range">{{ level.range }}词</span>
              </div>
              <div class="level-progress">
                <el-progress 
                  :percentage="level.accuracy" 
                  :color="getAccuracyColor(level.accuracy)"
                  :stroke-width="12"
                />
                <span class="accuracy-text">{{ level.correct }}/{{ level.total }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 书籍推荐 -->
        <div class="recommendations">
          <h3>
            <el-icon><Collection /></el-icon>
            推荐阅读
          </h3>
          <div class="book-list">
            <div v-for="(book, index) in currentRecommendations" :key="index" class="book-card">
              <div class="book-type" :class="book.type">{{ getBookTypeLabel(book.type) }}</div>
              <h4 class="book-title">{{ book.title }}</h4>
              <p class="book-author">{{ book.author }}</p>
              <p class="book-desc">{{ book.description }}</p>
              <el-tag size="small" type="info">{{ book.level }}</el-tag>
            </div>
          </div>
        </div>

        <!-- 阅读计划 -->
        <div class="reading-plan" v-if="currentReadingPlan">
          <h3>
            <el-icon><Calendar /></el-icon>
            阅读计划建议
          </h3>
          <div class="plan-content">
            <div class="plan-stats">
              <div class="plan-stat">
                <span class="stat-label">建议周期</span>
                <span class="stat-value">{{ currentReadingPlan.duration }}</span>
              </div>
              <div class="plan-stat">
                <span class="stat-label">每日阅读量</span>
                <span class="stat-value">{{ currentReadingPlan.dailyPages }} 页</span>
              </div>
              <div class="plan-stat">
                <span class="stat-label">每月目标</span>
                <span class="stat-value">{{ currentReadingPlan.booksPerMonth }} 本</span>
              </div>
            </div>
            <div class="plan-types">
              <span class="types-label">推荐类型：</span>
              <el-tag 
                v-for="type in currentReadingPlan.suggestedTypes" 
                :key="type"
                size="small"
                class="type-tag"
              >
                {{ type }}
              </el-tag>
            </div>
            <div class="plan-tips">
              <h4>学习建议</h4>
              <ul>
                <li v-for="(tip, index) in currentReadingPlan.tips" :key="index">{{ tip }}</li>
              </ul>
            </div>
          </div>
        </div>
      </template>

      <!-- 加载中/无结果提示 -->
      <div v-else class="result-empty">
        <el-empty description="正在计算结果..." />
      </div>

      <div class="result-actions">
        <el-button type="primary" size="large" @click="restartTest">
          <el-icon><RefreshRight /></el-icon>
          再测一次
        </el-button>
        <el-button size="large" @click="showHistoryDetail = true">
          <el-icon><Timer /></el-icon>
          测试历史
        </el-button>
      </div>
    </div>

    <!-- 历史详情弹窗 -->
    <el-dialog
      v-model="showHistoryDetail"
      title="测试历史"
      width="600px"
      :close-on-click-modal="true"
    >
      <div class="history-list">
        <div v-for="record in vocabStore.testHistory" :key="record.id" class="history-record">
          <div class="record-header">
            <span class="record-date">{{ formatDate(record.date) }}</span>
            <span class="record-vocab">{{ record.estimatedVocabulary.toLocaleString() }} 词</span>
          </div>
          <div class="record-levels">
            <el-tag size="small" type="info">{{ record.readingLevel }}</el-tag>
          </div>
        </div>
      </div>
      <template #footer>
        <el-button @click="vocabStore.clearHistory(); showHistoryDetail = false" type="danger" link>
          清除历史
        </el-button>
        <el-button @click="showHistoryDetail = false">关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useVocabularyTestStore, WORD_BANK_LEVELS, type WordBankLevel, type ReadingLevel } from '@/stores/vocabularyTest';
import { getWordBankInfo, type WordBankType } from '@/utils/wordbank-service';
import { log } from '@/utils/logger';
import {
  Collection,
  DocumentChecked,
  TrendCharts,
  Reading,
  VideoPlay,
  Check,
  Close,
  ArrowRight,
  Trophy,
  Calendar,
  RefreshRight,
  Timer,
} from '@element-plus/icons-vue';
import { ElMessage } from 'element-plus';

interface WordBankItem {
  word: string;
  phonetic?: string;
  explains: string;
}

interface WordItem {
  word: string;
  phonetic: string;
  explains: string;
  level: string;
}

interface TestOption {
  text: string;
  isCorrect: boolean;
}

const vocabStore = useVocabularyTestStore();

// 测试配置
const testConfig = ref({
  rounds: 5,
  wordsPerRound: 10,
});

// 测试状态
const isTesting = ref(false);
const showResult = ref(false);
const isLoading = ref(false);
const currentRound = ref(1);
const currentWordIndex = ref(0);
const testWords = ref<WordItem[]>([]);
const currentOptions = ref<string[]>([]);
const hasAnswered = ref(false);
const isCorrect = ref(false);
const selectedOption = ref<number>(-1);
const results = ref<Record<string, { correct: number; total: number }>>({});
const showHistoryDetail = ref(false);
const testResult = ref<ReturnType<typeof vocabStore.saveTestResult> | null>(null);

// 词库缓存
const wordBankCache = ref<Record<string, WordItem[]>>({});

// 计算属性
const totalRounds = computed(() => testConfig.value.rounds);
const progressPercent = computed(() => 
  Math.round(((currentRound.value - 1) * testConfig.value.wordsPerRound + currentWordIndex.value) / 
  (totalRounds.value * testConfig.value.wordsPerRound) * 100)
);

const currentLevel = computed(() => {
  const levelIndex = Math.min(currentRound.value - 1, WORD_BANK_LEVELS.length - 1);
  return WORD_BANK_LEVELS[levelIndex];
});

const currentWord = computed(() => 
  testWords.value[(currentRound.value - 1) * testConfig.value.wordsPerRound + currentWordIndex.value]
);

const isLastWord = computed(() => 
  currentRound.value === totalRounds.value && 
  currentWordIndex.value === testConfig.value.wordsPerRound - 1
);

const levelBreakdown = computed(() => {
  return WORD_BANK_LEVELS.filter(level => results.value[level.id]).map(level => {
    const result = results.value[level.id];
    return {
      id: level.id,
      name: level.name,
      range: `${level.minWords}-${level.maxWords}`,
      correct: result.correct,
      total: result.total,
      accuracy: Math.round((result.correct / result.total) * 100),
    };
  });
});

const currentRecommendations = computed(() => {
  if (!testResult.value) return [];
  const level = vocabStore.getReadingLevel(testResult.value.estimatedVocabulary);
  return level.recommendations;
});

const currentReadingPlan = computed(() => {
  if (!testResult.value) return null;
  return vocabStore.getReadingPlan(testResult.value.readingLevel);
});

// 加载词库数据
async function loadWordBank(levelId: string): Promise<WordItem[]> {
  if (wordBankCache.value[levelId]) {
    return wordBankCache.value[levelId];
  }

  try {
    const response = await fetch(`/wordbanks/${levelId}.json`);
    const words = await response.json();
    const wordItems: WordItem[] = words.map((w: WordBankItem) => ({
      word: w.word,
      phonetic: w.phonetic || '',
      explains: w.explains,
      level: levelId,
    }));
    wordBankCache.value[levelId] = wordItems;
    return wordItems;
  } catch (error) {
    log.e(`加载词库 ${levelId} 失败`, error);
    return [];
  }
}

// 生成测试单词
async function generateTestWords() {
  const words: WordItem[] = [];
  
  for (let i = 0; i < totalRounds.value; i++) {
    const level = WORD_BANK_LEVELS[Math.min(i, WORD_BANK_LEVELS.length - 1)];
    const bankWords = await loadWordBank(level.id);
    
    if (bankWords.length === 0) continue;
    
    // 随机选择单词
    const selected: WordItem[] = [];
    const used = new Set<string>();
    
    while (selected.length < testConfig.value.wordsPerRound && used.size < bankWords.length) {
      const randomIndex = Math.floor(Math.random() * bankWords.length);
      const word = bankWords[randomIndex];
      if (!used.has(word.word)) {
        used.add(word.word);
        selected.push(word);
      }
    }
    
    words.push(...selected);
  }
  
  testWords.value = words;
}

// 生成选项
async function generateOptions(correctWord: WordItem) {
  const options = [correctWord.explains];
  
  // 从同一词库获取干扰项
  const bankWords = await loadWordBank(correctWord.level);
  const used = new Set<string>([correctWord.word]);
  
  while (options.length < 4 && used.size < bankWords.length) {
    const randomWord = bankWords[Math.floor(Math.random() * bankWords.length)];
    if (!used.has(randomWord.word)) {
      used.add(randomWord.word);
      options.push(randomWord.explains);
    }
  }
  
  // 打乱顺序
  currentOptions.value = options.sort(() => Math.random() - 0.5);
}

// 开始测试
async function startTest() {
  isLoading.value = true;
  try {
    isTesting.value = true;
    showResult.value = false;
    currentRound.value = 1;
    currentWordIndex.value = 0;
    results.value = {};
    testResult.value = null;

    await generateTestWords();

    if (testWords.value.length > 0) {
      await generateOptions(currentWord.value);
    } else {
      ElMessage.error('词库加载失败，请重试');
      isTesting.value = false;
    }
  } catch (error) {
    log.e('开始测试失败', error);
    ElMessage.error('测试启动失败，请重试');
    isTesting.value = false;
  } finally {
    isLoading.value = false;
  }
}

// 选择答案
function selectOption(index: number) {
  if (hasAnswered.value) return;
  
  selectedOption.value = index;
  hasAnswered.value = true;
  
  const correctAnswer = currentWord.value.explains;
  isCorrect.value = currentOptions.value[index] === correctAnswer;
  
  // 记录结果
  const levelId = currentLevel.value.id;
  if (!results.value[levelId]) {
    results.value[levelId] = { correct: 0, total: 0 };
  }
  results.value[levelId].total++;
  if (isCorrect.value) {
    results.value[levelId].correct++;
  }
}

// 获取选项样式
function getOptionClass(index: number): string {
  if (!hasAnswered.value) return '';
  
  const correctAnswer = currentWord.value.explains;
  const isThisCorrect = currentOptions.value[index] === correctAnswer;
  
  if (isThisCorrect) return 'correct-answer';
  if (index === selectedOption.value && !isThisCorrect) return 'wrong-answer';
  return 'disabled';
}

// 下一题
async function nextWord() {
  if (isLastWord.value) {
    finishTest();
    return;
  }
  
  currentWordIndex.value++;
  
  // 检查是否需要进入下一轮
  if (currentWordIndex.value >= testConfig.value.wordsPerRound) {
    currentWordIndex.value = 0;
    currentRound.value++;
  }
  
  // 重置状态
  hasAnswered.value = false;
  isCorrect.value = false;
  selectedOption.value = -1;
  
  await generateOptions(currentWord.value);
}

// 完成测试
function finishTest() {
  isTesting.value = false;
  showResult.value = true;
  
  // 计算测试结果
  const testedLevels = Object.keys(results.value);
  const correctByLevel: Record<string, number> = {};
  const totalByLevel: Record<string, number> = {};
  
  for (const levelId of testedLevels) {
    correctByLevel[levelId] = results.value[levelId].correct;
    totalByLevel[levelId] = results.value[levelId].total;
  }
  
  testResult.value = vocabStore.saveTestResult(testedLevels, correctByLevel, totalByLevel);
}

// 重新开始
function restartTest() {
  showResult.value = false;
  testResult.value = null;
}

// 获取准确率颜色
function getAccuracyColor(accuracy: number): string {
  if (accuracy >= 80) return '#67C23A';
  if (accuracy >= 60) return '#E6A23C';
  return '#F56C6C';
}

// 获取书籍类型标签
function getBookTypeLabel(type: string): string {
  const map: Record<string, string> = {
    'fiction': '小说',
    'non-fiction': '非虚构',
    'graded': '分级读物',
  };
  return map[type] || type;
}

// 格式化日期
function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString('zh-CN');
}

onMounted(() => {
  vocabStore.loadHistory();
});
</script>

<style scoped>
.vocabulary-test {
  padding: 20px;
  max-width: 900px;
  margin: 0 auto;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
}

/* 开始界面 */
.intro-section {
  text-align: center;
}

.intro-header {
  margin-bottom: 30px;
}

.test-icon {
  color: var(--utools-primary);
  margin-bottom: 15px;
}

.intro-header h2 {
  color: var(--utools-text-primary);
  margin-bottom: 10px;
  font-size: 28px;
}

.subtitle {
  color: var(--utools-text-secondary);
  font-size: 16px;
}

.features {
  display: flex;
  justify-content: center;
  gap: 30px;
  margin-bottom: 40px;
  flex-wrap: wrap;
}

.feature-item {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--utools-text-secondary);
  font-size: 14px;
}

.feature-item .el-icon {
  color: var(--utools-primary);
}

.test-options {
  background: var(--utools-bg-card);
  border-radius: 12px;
  padding: 30px;
  margin-bottom: 30px;
  box-shadow: var(--utools-shadow-sm);
}

.option-item {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 20px;
  color: var(--utools-text-primary);
}

.option-item:last-child {
  margin-bottom: 0;
}

.option-item span:first-child {
  min-width: 100px;
  text-align: right;
}

.slider-value {
  min-width: 60px;
  color: var(--utools-primary);
  font-weight: 500;
}

.start-btn {
  padding: 15px 50px;
  font-size: 18px;
  margin-bottom: 40px;
}

.start-btn .el-icon {
  margin-right: 8px;
}

/* 历史预览 */
.history-preview {
  background: var(--utools-bg-card);
  border-radius: 12px;
  padding: 25px;
  margin-top: 30px;
}

.history-preview h3 {
  color: var(--utools-text-primary);
  margin-bottom: 20px;
  font-size: 18px;
}

.history-stats {
  display: flex;
  justify-content: center;
  gap: 40px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.history-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
}

.history-item .label {
  color: var(--utools-text-secondary);
  font-size: 14px;
}

.history-item .value {
  font-size: 24px;
  font-weight: 600;
  color: var(--utools-text-primary);
}

.history-item .value.highlight {
  color: var(--utools-primary);
}

.history-item .value.up {
  color: #67C23A;
}

.history-item .value.down {
  color: #F56C6C;
}

/* 测试界面 */
.testing-section {
  max-width: 700px;
  margin: 0 auto;
}

.progress-bar {
  margin-bottom: 30px;
}

.progress-info {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  color: var(--utools-text-secondary);
}

.word-card {
  background: var(--utools-bg-card);
  border-radius: 16px;
  padding: 40px;
  box-shadow: var(--utools-shadow-sm);
}

.word-display {
  text-align: center;
  margin-bottom: 30px;
  padding-bottom: 30px;
  border-bottom: 1px solid var(--utools-border-divider);
}

.word {
  font-size: 36px;
  color: var(--utools-text-primary);
  margin-bottom: 10px;
}

.phonetic {
  font-size: 18px;
  color: var(--utools-text-secondary);
  font-family: 'Times New Roman', serif;
}

.question {
  color: var(--utools-text-secondary);
  margin-bottom: 20px;
  font-size: 16px;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 20px;
}

.option-btn {
  padding: 20px;
  font-size: 15px;
  line-height: 1.5;
  text-align: left;
  white-space: normal;
  height: auto;
  min-height: 80px;
  align-items: flex-start;
}

.option-btn.correct-answer {
  background-color: #f0f9eb;
  border-color: #67C23A;
  color: #67C23A;
}

.option-btn.wrong-answer {
  background-color: #fef0f0;
  border-color: #F56C6C;
  color: #F56C6C;
}

.option-btn.disabled {
  opacity: 0.5;
}

.answer-feedback {
  margin-top: 30px;
  padding-top: 30px;
  border-top: 1px solid var(--utools-border-divider);
}

.feedback {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  font-size: 20px;
  margin-bottom: 20px;
}

.feedback.correct {
  color: #67C23A;
}

.feedback.wrong {
  color: #F56C6C;
}

.word-detail {
  background: var(--utools-bg-secondary);
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.word-detail .definition {
  color: var(--utools-text-secondary);
  margin-top: 10px;
}

.next-btn {
  width: 100%;
  padding: 15px;
  font-size: 16px;
}

/* 结果界面 */
.result-section {
  max-width: 800px;
  margin: 0 auto;
}

.result-header {
  text-align: center;
  margin-bottom: 30px;
}

.result-icon {
  color: #E6A23C;
  margin-bottom: 15px;
}

.result-header h2 {
  color: var(--utools-text-primary);
  font-size: 28px;
}

.vocabulary-score {
  display: flex;
  justify-content: center;
  margin-bottom: 30px;
}

.score-circle {
  width: 200px;
  height: 200px;
  border-radius: 50%;
  background: linear-gradient(135deg, var(--utools-primary) 0%, var(--utools-primary-light, #409EFF) 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  color: white;
  box-shadow: 0 8px 32px rgba(64, 158, 255, 0.3);
}

.score-number {
  font-size: 48px;
  font-weight: 700;
}

.score-label {
  font-size: 16px;
  opacity: 0.9;
  margin-top: 5px;
}

.reading-level-card {
  background: var(--utools-bg-card);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 25px;
  text-align: center;
  box-shadow: var(--utools-shadow-sm);
}

.reading-level-card h3 {
  color: var(--utools-text-primary);
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.reading-level-card h3 .el-icon {
  color: var(--utools-primary);
}

.level-desc {
  color: var(--utools-text-secondary);
}

.level-breakdown {
  background: var(--utools-bg-card);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: var(--utools-shadow-sm);
}

.level-breakdown h3 {
  color: var(--utools-text-primary);
  margin-bottom: 20px;
}

.breakdown-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.breakdown-item {
  display: flex;
  align-items: center;
  gap: 15px;
}

.level-info {
  min-width: 150px;
  display: flex;
  flex-direction: column;
}

.level-name {
  font-weight: 600;
  color: var(--utools-text-primary);
}

.level-range {
  font-size: 12px;
  color: var(--utools-text-secondary);
}

.level-progress {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}

.accuracy-text {
  min-width: 50px;
  text-align: right;
  color: var(--utools-text-secondary);
  font-size: 14px;
}

/* 推荐书籍 */
.recommendations {
  background: var(--utools-bg-card);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: var(--utools-shadow-sm);
}

.recommendations h3 {
  color: var(--utools-text-primary);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.recommendations h3 .el-icon {
  color: var(--utools-primary);
}

.book-list {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 15px;
}

.book-card {
  background: var(--utools-bg-secondary);
  border-radius: 10px;
  padding: 20px;
  position: relative;
}

.book-type {
  position: absolute;
  top: 10px;
  right: 10px;
  padding: 3px 8px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 500;
}

.book-type.fiction {
  background: #e6f7ff;
  color: #1890ff;
}

.book-type.non-fiction {
  background: #f6ffed;
  color: #52c41a;
}

.book-type.graded {
  background: #fff7e6;
  color: #fa8c16;
}

.book-title {
  color: var(--utools-text-primary);
  font-size: 16px;
  margin-bottom: 5px;
  padding-right: 50px;
}

.book-author {
  color: var(--utools-text-secondary);
  font-size: 13px;
  margin-bottom: 10px;
}

.book-desc {
  color: var(--utools-text-secondary);
  font-size: 13px;
  line-height: 1.5;
  margin-bottom: 10px;
}

/* 阅读计划 */
.reading-plan {
  background: var(--utools-bg-card);
  border-radius: 12px;
  padding: 25px;
  margin-bottom: 25px;
  box-shadow: var(--utools-shadow-sm);
}

.reading-plan h3 {
  color: var(--utools-text-primary);
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  gap: 8px;
}

.reading-plan h3 .el-icon {
  color: var(--utools-primary);
}

.plan-stats {
  display: flex;
  justify-content: space-around;
  margin-bottom: 20px;
  padding-bottom: 20px;
  border-bottom: 1px solid var(--utools-border-divider);
}

.plan-stat {
  text-align: center;
}

.stat-label {
  display: block;
  color: var(--utools-text-secondary);
  font-size: 13px;
  margin-bottom: 5px;
}

.stat-value {
  display: block;
  color: var(--utools-text-primary);
  font-size: 20px;
  font-weight: 600;
}

.plan-types {
  margin-bottom: 20px;
}

.types-label {
  color: var(--utools-text-secondary);
  margin-right: 10px;
}

.type-tag {
  margin-right: 8px;
  margin-bottom: 5px;
}

.plan-tips {
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  padding: 20px;
}

.plan-tips h4 {
  color: var(--utools-text-primary);
  margin-bottom: 10px;
}

.plan-tips ul {
  margin: 0;
  padding-left: 20px;
  color: var(--utools-text-secondary);
}

.plan-tips li {
  margin-bottom: 5px;
}

.result-actions {
  display: flex;
  justify-content: center;
  gap: 20px;
}

.result-actions .el-button {
  padding: 12px 30px;
}

/* 历史弹窗 */
.history-list {
  max-height: 400px;
  overflow-y: auto;
}

.history-record {
  padding: 15px;
  border-bottom: 1px solid var(--utools-border-divider);
}

.history-record:last-child {
  border-bottom: none;
}

.record-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 10px;
}

.record-date {
  color: var(--utools-text-secondary);
  font-size: 14px;
}

.record-vocab {
  color: var(--utools-primary);
  font-size: 18px;
  font-weight: 600;
}

.record-levels {
  display: flex;
  gap: 8px;
}

@media (max-width: 768px) {
  .options-grid {
    grid-template-columns: 1fr;
  }
  
  .features {
    flex-direction: column;
    gap: 15px;
  }
  
  .option-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .option-item span:first-child {
    text-align: left;
  }
  
  .history-stats {
    flex-direction: column;
    gap: 20px;
  }
  
  .plan-stats {
    flex-direction: column;
    gap: 15px;
  }
  
  .breakdown-item {
    flex-direction: column;
    align-items: flex-start;
  }
  
  .level-progress {
    width: 100%;
  }
}
</style>
