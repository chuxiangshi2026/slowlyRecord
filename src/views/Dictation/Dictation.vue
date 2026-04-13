 <template>
  <div class="dictation-page">
    <!-- 顶部设置栏 -->
    <div class="dictation-header">
      <div class="header-left">
        <el-button link @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </el-button>
        <span class="title">听写练习</span>
      </div>
      <div class="header-right">
        <span class="progress" v-if="dictationMode === 'review' || dictationMode === 'wrong-words-practice'">
          {{ currentIndex + 1 }} / {{ wordList.length }}
        </span>
      </div>
    </div>

    <!-- 设置界面 -->
    <div v-if="dictationMode === 'setup'" class="setup-panel">
      <div class="setup-card">
        <h3>听写设置</h3>

        <div class="setup-item">
          <label>选择词库</label>
          <el-radio-group v-model="wordBank" size="large">
            <el-radio-button label="current">当前词库</el-radio-button>
            <el-radio-button label="cet4">四级词汇</el-radio-button>
            <el-radio-button label="cet6">六级词汇</el-radio-button>
            <el-radio-button label="bec">商务英语</el-radio-button>
            <el-radio-button label="gmat">GMAT词汇</el-radio-button>
            <el-radio-button label="gre">GRE词汇</el-radio-button>
            <el-radio-button label="ielts">雅思词汇</el-radio-button>
            <el-radio-button label="kaogong">考公词汇</el-radio-button>
            <el-radio-button label="kaoyan">考研词汇</el-radio-button>
            <el-radio-button label="level4">专业四级</el-radio-button>
            <el-radio-button label="level8">专业八级</el-radio-button>
            <el-radio-button label="sat">SAT词汇</el-radio-button>
            <el-radio-button label="toefl">托福词汇</el-radio-button>
            <el-radio-button label="zsb">专升本词汇</el-radio-button>
          </el-radio-group>
          <div v-if="wordBank !== 'current' && wordBank !== 'wrong-words'" class="wordbank-info">
            <el-tag size="small" type="info">
              {{ getWordBankInfo(wordBank)?.description }}
              (约{{ getWordBankInfo(wordBank)?.wordCount }}词)
              <span v-if="isWordBankCached(wordBank as WordBankType)" class="cached-badge">已缓存</span>
            </el-tag>
          </div>
          <!-- 显示该词库是否有保存的进度 -->
          <div v-if="wordBank !== 'current' && wordBank !== 'wrong-words' && hasProgressForBank(wordBank)" class="wordbank-progress-info">
            <el-tag size="small" type="warning">
              <el-icon><Timer /></el-icon>
              有保存的进度
            </el-tag>
          </div>
        </div>

        <!-- 错题练习入口 -->
        <div class="setup-item" v-if="banksWithWrongWords.length > 0">
          <label>错题练习</label>
          <div class="wrong-words-banks">
            <el-button
              v-for="bank in banksWithWrongWords"
              :key="bank"
              type="danger"
              size="small"
              @click="startWrongWordsPractice(bank)"
            >
              <el-icon><CircleClose /></el-icon>
              {{ getWordBankName(bank) }} 错题
            </el-button>
          </div>
        </div>

        <div class="setup-item">
          <label>单词数量</label>
          <el-radio-group v-model="wordCount" size="large">
            <el-radio-button :label="10">10个</el-radio-button>
            <el-radio-button :label="20">20个</el-radio-button>
            <el-radio-button :label="50">50个</el-radio-button>
            <el-radio-button :label="100">100个</el-radio-button>
          </el-radio-group>
        </div>

        <div class="setup-item">
          <label>显示模式</label>
          <el-radio-group v-model="displayMode" size="large">
            <el-radio-button label="blank">全盲听写</el-radio-button>
            <el-radio-button label="partial">部分提示</el-radio-button>
          </el-radio-group>
        </div>

        <div class="setup-item">
          <label>选项</label>
          <el-checkbox-group v-model="options">
            <el-checkbox label="autoPlay">自动播放发音</el-checkbox>
            <el-checkbox label="showPhonetic">显示音标</el-checkbox>
            <el-checkbox label="showMeaning">显示释义</el-checkbox>
          </el-checkbox-group>
        </div>

        <div class="setup-actions">
          <el-button v-if="hasSavedProgress" type="warning" size="large" @click="resumeProgress" class="resume-btn">
            继续上次进度
          </el-button>
          <el-button type="primary" size="large" @click="startDictation" class="start-btn">
            开始听写
          </el-button>
        </div>
      </div>
    </div>

    <!-- 听写界面 -->
    <div v-else-if="dictationMode === 'review' || dictationMode === 'wrong-words-practice'" class="review-panel" ref="reviewPanelRef" @keydown="handleDictationKeydown" tabindex="0">
      <div class="word-display" v-if="currentWord">
        <!-- 提示区域 -->
        <div class="hints-area">
          <div v-if="options.includes('showPhonetic')" class="hint phonetic-hint">
            <span class="hint-label">音标</span>
            <span class="hint-content">{{ currentWord.phonetic || '/' + getSimplePhonetic(currentWord.text) + '/' }}</span>
          </div>
          <div v-if="options.includes('showMeaning')" class="hint meaning-hint">
            <span class="hint-label">释义</span>
            <span class="hint-content">{{ currentWord.explains }}</span>
          </div>
        </div>

        <!-- 输入区域 -->
        <div class="input-area" :class="{ shaking: isShaking }">
          <!-- 全盲模式 -->
          <div v-if="displayMode === 'blank'" class="blank-mode">
            <div class="input-slots">
              <div
                v-for="i in currentWord.text.length"
                :key="i"
                class="input-slot"
                :class="{ filled: userInput[i-1] }"
              >
                {{ userInput[i-1] || '' }}
              </div>
            </div>
            <input
              ref="hiddenInput"
              v-model="rawInput"
              class="hidden-input"
              @input="handleInput"
              :maxlength="currentWord.text.length"
            />
          </div>

          <!-- 部分提示模式 -->
          <div v-else class="partial-mode">
            <div class="letter-slots">
              <div
                v-for="(slot, index) in partialSlots"
                :key="index"
                class="letter-slot"
                :class="{
                  fixed: slot.fixed,
                  empty: !slot.fixed,
                  filled: !slot.fixed && slot.value,
                  flashing: flashingSlotIndex === index || (flashingSlotIndex === -2 && !slot.fixed),
                }"
              >
                <span v-if="slot.fixed">{{ slot.letter }}</span>
                <input
                  v-else
                  v-model="slot.value"
                  maxlength="1"
                  class="letter-input"
                  @input="handlePartialInput(index)"
                  @keydown="handlePartialKeydown($event, index)"
                  :ref="(el) => setSlotRef(el, index)"
                />
              </div>
            </div>
          </div>
        </div>

        <!-- 错误提示 -->
        <div v-if="canShowHint" class="hint-area">
          <el-alert
            v-if="hintType === 'full'"
            :title="`正确答案: ${currentWord?.text}`"
            type="info"
            :closable="false"
            show-icon
            class="hint-alert"
          />
          <el-button v-else type="warning" size="small" @click="showLetterHint">
            显示提示 (已错{{ getCurrentErrorCount }}次)
          </el-button>
        </div>

        <!-- 控制按钮 -->
        <div class="control-area">
          <el-button circle size="small" @click="prevWord" :disabled="currentIndex === 0">
            <el-icon><ArrowLeft /></el-icon>
          </el-button>
          <el-button circle size="small" @click="replayWord">
            <el-icon><VideoPlay /></el-icon>
          </el-button>
          <el-button circle size="small" @click="skipWord">
            <el-icon><Right /></el-icon>
          </el-button>
          <el-button circle size="small" type="warning" @click="showHintDialog" title="显示提示">
            <el-icon><QuestionFilled /></el-icon>
          </el-button>
        </div>
      </div>
    </div>

    <!-- 完成界面 -->
    <div v-else-if="dictationMode === 'complete'" class="complete-panel">
      <div class="complete-card">
        <div class="complete-icon">
          <el-icon :size="64" color="#67C23A"><CircleCheck /></el-icon>
        </div>
        <h2>听写完成</h2>

        <div class="stats">
          <div class="stat-item">
            <span class="stat-value">{{ wordList.length }}</span>
            <span class="stat-label">总词数</span>
          </div>
          <div class="stat-item">
            <span class="stat-value success">{{ stats.correct }}</span>
            <span class="stat-label">正确</span>
          </div>
          <div class="stat-item">
            <span class="stat-value error">{{ stats.wrong }}</span>
            <span class="stat-label">错误</span>
          </div>
          <div class="stat-item">
            <span class="stat-value">{{ accuracy }}%</span>
            <span class="stat-label">正确率</span>
          </div>
        </div>

        <div v-if="wrongWords.length > 0" class="wrong-words">
          <h4>需加强的单词</h4>
          <div class="word-tags">
            <span v-for="word in wrongWords" :key="word.text" class="word-tag">
              {{ word.text }}
            </span>
          </div>
        </div>

        <div class="complete-actions">
          <el-button size="large" @click="goBack">返回</el-button>
          <el-button type="warning" size="large" @click="continueNextGroup" v-if="!isWrongWordsMode">
            <el-icon><ArrowRight /></el-icon>
            继续下一组
          </el-button>
          <el-button type="danger" size="large" @click="practiceWrongWords" v-if="sessionWrongWords.length > 0 && !isWrongWordsMode">
            <el-icon><CircleClose /></el-icon>
            练习错题
          </el-button>
          <el-button type="primary" size="large" @click="restart">
            <el-icon><RefreshRight /></el-icon>
            重新开始
          </el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElLoading, ElMessageBox } from 'element-plus';
import { ArrowLeft, VideoPlay, CircleCheck, Right, ArrowRight, RefreshRight, Timer, CircleClose, QuestionFilled } from '@element-plus/icons-vue';
import { useWordsStore } from '@/stores/words';
import type { Word } from '@/types/words';
import {
  fetchWordBank,
  WORDBANK_LIST,
  type WordBankType,
  isWordBankCached
} from '@/utils/wordbank-service';
import { getWordBank, getCurrentWordBankId } from '@/utils/wordbank-manager';
import {
  getDictationProgress,
  saveDictationProgress,
  removeDictationProgress,
  hasDictationProgress,
  getWrongWordsRecord,
  saveWrongWords,
  getWrongWordsBanks
} from '@/utils/dictation-db';

const router = useRouter();
const wordsStore = useWordsStore();

// ========== 常量 ==========
const MAX_ERRORS_BEFORE_HINT = 3; // 错误3次后显示提示

// ========== 状态 ==========
type DictationMode = 'setup' | 'review' | 'complete' | 'wrong-words-practice';
const dictationMode = ref<DictationMode>('setup');

const wordBank = ref<'current' | WordBankType | 'import' | 'wrong-words'>('current');
const wordCount = ref(20);
const displayMode = ref<'blank' | 'partial'>('partial');
const options = ref<string[]>(['autoPlay', 'showPhonetic', 'showMeaning']);

const wordList = ref<Word[]>([]);
const currentIndex = ref(0);
const userInput = ref<string[]>([]);
const rawInput = ref('');
const isShaking = ref(false);
const stats = ref({ correct: 0, wrong: 0 });
const wrongWords = ref<Word[]>([]);
const sessionWrongWords = ref<Word[]>([]); // 本次练习的错题

// 错误次数和提示状态
const errorCountMap = ref<Record<number, number>>({}); // 每个单词的错误次数
const showHint = ref(false); // 是否显示提示
const hintType = ref<'none' | 'letter' | 'full'>('none'); // 提示类型
const flashingSlotIndex = ref<number>(-1); // 正在闪烁的输入框索引
const reviewPanelRef = ref<HTMLDivElement>(); // 听写面板引用

const partialSlots = ref<{ fixed: boolean; letter: string; value?: string }[]>([]);
const slotRefs = ref<Record<number, HTMLInputElement>>({});
const hiddenInput = ref<HTMLInputElement>();

// 是否有保存的进度
const hasSavedProgress = ref(false);

// 有错题的词库列表
const banksWithWrongWords = ref<string[]>([]);

// 当前是否为错题练习模式
const isWrongWordsMode = computed(() => wordBank.value === 'wrong-words');

// ========== 计算属性 ==========
const currentWord = computed(() => wordList.value[currentIndex.value] || null);

const accuracy = computed(() => {
  if (wordList.value.length === 0) return 0;
  return Math.round((stats.value.correct / wordList.value.length) * 100);
});

// 当前单词的错误次数
const getCurrentErrorCount = computed(() => {
  return errorCountMap.value[currentIndex.value] || 0;
});

// 是否可以显示提示（错误次数达到阈值）
const canShowHint = computed(() => {
  const count = errorCountMap.value[currentIndex.value] || 0;
  return count >= MAX_ERRORS_BEFORE_HINT;
});

// ========== 方法 ==========
async function goBack() {
  // 离开前保存进度
  await saveProgress();
  // 返回上一页
  router.back();
}

// ========== 进度保存与恢复 ==========
async function saveProgress() {
  if ((dictationMode.value !== 'review' && dictationMode.value !== 'wrong-words-practice') || wordList.value.length === 0) {
    return;
  }

  // 只保存普通词库的进度，不保存错题练习的进度
  if (wordBank.value !== 'wrong-words') {
    await saveDictationProgress({
      wordList: wordList.value,
      currentIndex: currentIndex.value,
      stats: stats.value,
      wrongWords: wrongWords.value,
      errorCountMap: errorCountMap.value,
      wordBank: wordBank.value,
      wordCount: wordCount.value,
      displayMode: displayMode.value,
      options: options.value
    });
  }
}

function loadSavedProgress(): boolean {
  if (wordBank.value === 'wrong-words') return false;
  return hasDictationProgress(wordBank.value);
}

function hasProgressForBank(bank: string): boolean {
  if (bank === 'current' || bank === 'wrong-words') return false;
  return hasDictationProgress(bank);
}

async function resumeProgress() {
  try {
    const progress = getDictationProgress(wordBank.value);
    if (!progress) {
      ElMessage.warning('没有保存的进度');
      return;
    }

    wordList.value = progress.wordList;
    currentIndex.value = progress.currentIndex;
    stats.value = progress.stats;
    wrongWords.value = progress.wrongWords;
    errorCountMap.value = progress.errorCountMap || {};
    wordBank.value = progress.wordBank as any;
    wordCount.value = progress.wordCount;
    displayMode.value = progress.displayMode;
    options.value = progress.options;

    dictationMode.value = 'review';
    hintType.value = 'none';
    showHint.value = false;

    prepareWord();
    ElMessage.success(`已恢复进度：第 ${currentIndex.value + 1} / ${wordList.value.length} 词`);
  } catch {
    ElMessage.error('恢复进度失败');
    removeDictationProgress(wordBank.value);
  }
}

function clearProgress() {
  if (wordBank.value !== 'wrong-words') {
    removeDictationProgress(wordBank.value);
  }
  hasSavedProgress.value = false;
}

function getWordBankName(bankId: string): string {
  if (bankId === 'current') return '当前词库';
  if (bankId === 'wrong-words') return '错题';
  const info = getWordBankInfo(bankId);
  return info?.name || bankId;
}

function getSimplePhonetic(text: string): string {
  return text;
}

function getWordBankInfo(type: string) {
  return WORDBANK_LIST.find(wb => wb.id === type);
}

async function startDictation() {
  let words: Word[] = [];

  switch (wordBank.value) {
    case 'current': {
      // 获取当前选择的词库
      const currentBankId = await getCurrentWordBankId();
      const bank = await getWordBank(currentBankId);
      if (!bank || bank.words.length === 0) {
        ElMessage.warning('当前词库为空');
        return;
      }
      words = [...bank.words]
        .filter(w => w.text && w.text.match(/^[a-zA-Z]+$/))
        .sort(() => Math.random() - 0.5)
        .slice(0, wordCount.value);
      break;
    }

    case 'cet4':
    case 'cet6':
    case 'bec':
    case 'gmat':
    case 'gre':
    case 'ielts':
    case 'kaogong':
    case 'kaoyan':
    case 'level4':
    case 'level8':
    case 'sat':
    case 'toefl':
    case 'zsb':
      const bankType = wordBank.value as WordBankType;
      const info = getWordBankInfo(bankType);

      // 显示加载状态
      const loading = ElLoading.service({
        lock: true,
        text: `正在加载${info?.name || bankType}...`,
        background: 'rgba(0, 0, 0, 0.7)',
      });

      try {
        const bankWords = await fetchWordBank(bankType, { useCache: true });
        loading.close();

        if (bankWords.length === 0) {
          ElMessage.warning('词库加载失败，请检查词库文件');
          return;
        }

        words = bankWords
          .sort(() => Math.random() - 0.5)
          .slice(0, wordCount.value);

        ElMessage.success(`已加载 ${info?.name}，共 ${bankWords.length} 词`);
      } catch (error) {
        loading.close();
        ElMessage.error('词库加载失败');
        console.error(error);
        return;
      }
      break;
  }

  if (words.length === 0) {
    ElMessage.warning('没有可用的单词');
    return;
  }

  wordList.value = words;
  currentIndex.value = 0;
  stats.value = { correct: 0, wrong: 0 };
  wrongWords.value = [];
  errorCountMap.value = {};
  hintType.value = 'none';
  showHint.value = false;
  dictationMode.value = 'review';

  // 清除旧进度，开始新进度
  clearProgress();
  saveProgress();

  prepareWord();
}

function prepareWord() {
  userInput.value = [];
  rawInput.value = '';
  isShaking.value = false;
  partialSlots.value = [];
  hintType.value = 'none';
  showHint.value = false;

  const word = currentWord.value;
  if (!word) return;

  if (displayMode.value === 'partial') {
    const letters = word.text.split('');
    const len = letters.length;
    let hideCount = Math.floor(len * 0.5);
    if (hideCount < 1) hideCount = 1;
    if (hideCount >= len) hideCount = len - 1;

    const hideIndices = new Set<number>();
    while (hideIndices.size < hideCount) {
      hideIndices.add(Math.floor(Math.random() * len));
    }

    partialSlots.value = letters.map((letter, index) => ({
      fixed: !hideIndices.has(index),
      letter,
      value: hideIndices.has(index) ? '' : undefined
    }));

    nextTick(() => {
      setTimeout(() => {
        const firstEmpty = partialSlots.value.findIndex(s => !s.fixed);
        if (firstEmpty >= 0) slotRefs.value[firstEmpty]?.focus();
      }, 100);
    });
  } else {
    nextTick(() => {
      setTimeout(() => {
        hiddenInput.value?.focus();
      }, 100);
    });
  }

  // 自动播放
  if (options.value.includes('autoPlay')) {
    setTimeout(() => playWord(), 300);
  }
}

function handleInput() {
  const word = currentWord.value;
  if (!word) return;

  userInput.value = rawInput.value.split('').slice(0, word.text.length);

  // 输入完成自动检查
  if (userInput.value.length === word.text.length) {
    checkAnswer();
  }
}

function handlePartialInput(index: number) {
  const slot = partialSlots.value[index];
  if (slot?.value) {
    slot.value = slot.value.toLowerCase();
    // 自动跳到下一个
    const nextIndex = partialSlots.value.findIndex((s, i) => i > index && !s.fixed && !s.value);
    if (nextIndex >= 0) {
      slotRefs.value[nextIndex]?.focus();
    } else {
      // 输入完成自动检查
      const allFilled = partialSlots.value.every(s => s.fixed || s.value);
      if (allFilled) {
        checkAnswer();
      }
    }
  }
}

function handlePartialKeydown(e: KeyboardEvent, index: number) {
  if (e.key === 'Backspace' && !partialSlots.value[index]?.value) {
    e.preventDefault();
    const prevIndices = partialSlots.value
      .map((s, i) => ({ s, i }))
      .filter(({ s, i }) => i < index && !s.fixed)
      .map(({ i }) => i);
    if (prevIndices.length > 0) {
      slotRefs.value[prevIndices[prevIndices.length - 1]]?.focus();
    }
  }
}

function setSlotRef(el: any, index: number) {
  if (el) slotRefs.value[index] = el;
}

function playWord() {
  const word = currentWord.value;
  if (!word?.text) return;

  const utterance = new SpeechSynthesisUtterance(word.text);
  utterance.lang = 'en-US';
  utterance.rate = 0.8;
  window.speechSynthesis.speak(utterance);
}

function replayWord() {
  playWord();
}

function checkAnswer() {
  const word = currentWord.value;
  if (!word) return;

  let userAnswer = '';
  if (displayMode.value === 'blank') {
    userAnswer = userInput.value.join('').toLowerCase();
  } else {
    userAnswer = partialSlots.value.map(s => s.value || s.letter).join('').toLowerCase();
  }

  const isCorrect = userAnswer === word.text.toLowerCase();

  if (isCorrect) {
    stats.value.correct++;
    // 清除该单词的错误记录
    delete errorCountMap.value[currentIndex.value];
    saveProgress();
    nextWord();
  } else {
    stats.value.wrong++;
    wrongWords.value.push(word);

    // 记录到本次错题（用于错题练习）
    if (!sessionWrongWords.value.find(w => w.text === word.text)) {
      sessionWrongWords.value.push(word);
    }

    // 记录错误次数
    errorCountMap.value[currentIndex.value] = (errorCountMap.value[currentIndex.value] || 0) + 1;

    // 保存进度
    saveProgress();

    // 晃动提示
    isShaking.value = true;
    setTimeout(() => {
      isShaking.value = false;
    }, 500);

    // 如果错误次数达到阈值，自动显示完整提示
    if (errorCountMap.value[currentIndex.value] >= MAX_ERRORS_BEFORE_HINT + 2) {
      hintType.value = 'full';
      showHint.value = true;
    }
  }
}

function prevWord() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    prepareWord();
    saveProgress();
  }
}

async function skipWord() {
  if (currentWord.value) {
    wrongWords.value.push(currentWord.value);
    // 记录到本次错题
    if (!sessionWrongWords.value.find(w => w.text === currentWord.value!.text)) {
      sessionWrongWords.value.push(currentWord.value);
    }
    stats.value.wrong++;
    errorCountMap.value[currentIndex.value] = (errorCountMap.value[currentIndex.value] || 0) + 1;
  }
  await saveProgress();
  await nextWord();
}

async function nextWord() {
  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++;
    prepareWord();
    saveProgress();
  } else {
    dictationMode.value = 'complete';
    // 保存本次的错题到数据库（排除错题练习模式和导入模式）
    if (sessionWrongWords.value.length > 0 && wordBank.value !== 'wrong-words' && wordBank.value !== 'import') {
      // 使用实际的词库名称保存错题，'current' 转换为实际的词库标识
      const actualBank = wordBank.value === 'current' ? 'current' : wordBank.value;
      await saveWrongWords(actualBank, sessionWrongWords.value);
      // 刷新错题词库列表
      banksWithWrongWords.value = getWrongWordsBanks();
    }
    clearProgress(); // 完成后清除进度
  }
}

// ========== 提示功能 ==========
function showLetterHint() {
  if (!currentWord.value) return;

  hintType.value = 'full';
  showHint.value = true;

  // 显示更多字母提示
  if (displayMode.value === 'partial') {
    // 找出一个未填的空位填入正确字母
    const emptySlots = partialSlots.value
      .map((s, i) => ({ slot: s, index: i }))
      .filter(({ slot }) => !slot.fixed && !slot.value);

    if (emptySlots.length > 0) {
      const randomSlot = emptySlots[Math.floor(Math.random() * emptySlots.length)];
      partialSlots.value[randomSlot.index].value = randomSlot.slot.letter;

      // 检查是否全部填满
      const allFilled = partialSlots.value.every(s => s.fixed || s.value);
      if (allFilled) {
        hintType.value = 'full';
      }
    } else {
      hintType.value = 'full';
    }
  }
}

function restart() {
  dictationMode.value = 'setup';
  wordList.value = [];
  currentIndex.value = 0;
  errorCountMap.value = {};
  hintType.value = 'none';
  showHint.value = false;
  sessionWrongWords.value = [];
  wordBank.value = 'current';
  clearProgress();
  banksWithWrongWords.value = getWrongWordsBanks();
}

// ========== 新功能：继续下一组 ==========
async function continueNextGroup() {
  // 保存本次的错题到数据库（排除错题练习模式和导入模式）
  if (sessionWrongWords.value.length > 0 && wordBank.value !== 'wrong-words' && wordBank.value !== 'import') {
    const actualBank = wordBank.value === 'current' ? 'current' : wordBank.value;
    await saveWrongWords(actualBank, sessionWrongWords.value);
    // 刷新错题词库列表
    banksWithWrongWords.value = getWrongWordsBanks();
  }

  // 清除当前进度
  clearProgress();

  // 重新开始一组新的单词
  sessionWrongWords.value = [];
  stats.value = { correct: 0, wrong: 0 };
  wrongWords.value = [];
  errorCountMap.value = {};
  hintType.value = 'none';
  showHint.value = false;

  // 重新加载单词列表
  if (wordBank.value === 'import') {
    // 导入的词库需要重新选择文件
    ElMessage.info('请重新选择要导入的词库文件');
    dictationMode.value = 'setup';
  } else if (wordBank.value !== 'current') {
    // 系统词库直接开始新的一组
    await startDictation();
  } else {
    // 当前词库
    const words = [...wordsStore.words]
      .filter(w => w.text && w.text.match(/^[a-zA-Z]+$/))
      .sort(() => Math.random() - 0.5)
      .slice(0, wordCount.value);

    if (words.length === 0) {
      ElMessage.warning('当前词库为空');
      dictationMode.value = 'setup';
      return;
    }

    wordList.value = words;
    currentIndex.value = 0;
    dictationMode.value = 'review';
    prepareWord();
    ElMessage.success('开始新的一组单词');
  }
}

// ========== 新功能：错题练习 ==========
async function startWrongWordsPractice(bank: string) {
  const record = getWrongWordsRecord(bank);
  if (!record || record.wrongWords.length === 0) {
    ElMessage.warning('该词库暂无错题记录');
    return;
  }

  // 设置错题练习模式
  wordBank.value = 'wrong-words';
  wordList.value = [...record.wrongWords].sort(() => Math.random() - 0.5);
  currentIndex.value = 0;
  stats.value = { correct: 0, wrong: 0 };
  sessionWrongWords.value = [];
  wrongWords.value = [];
  errorCountMap.value = {};
  hintType.value = 'none';
  showHint.value = false;

  dictationMode.value = 'wrong-words-practice';
  prepareWord();
  ElMessage.success(`开始练习 ${getWordBankName(bank)} 的 ${wordList.value.length} 个错题`);
}

async function practiceWrongWords() {
  // 练习本次的错题
  if (sessionWrongWords.value.length === 0) {
    ElMessage.warning('本次练习暂无错题');
    return;
  }

  wordList.value = [...sessionWrongWords.value].sort(() => Math.random() - 0.5);
  currentIndex.value = 0;
  stats.value = { correct: 0, wrong: 0 };
  // 保留本次的错题用于下一轮，但要清空当前记录
  sessionWrongWords.value = [];
  wrongWords.value = [];
  errorCountMap.value = {};
  hintType.value = 'none';
  showHint.value = false;

  dictationMode.value = 'wrong-words-practice';
  prepareWord();
  ElMessage.success(`开始练习 ${wordList.value.length} 个错题`);
}

// ========== 新功能：显示提示 ==========
// 临时保存原始值，用于闪烁后恢复
const tempSlotValues = ref<{ index: number; originalValue: string }[]>([]);
const isShowingHint = ref(false);

// 部分提示模式：显示所有空缺填入正确内容后闪烁
function showPartialHint() {
  if (!currentWord.value || isShowingHint.value) return;

  // 保存当前状态
  tempSlotValues.value = [];
  const emptySlots: number[] = [];

  partialSlots.value.forEach((slot, index) => {
    if (!slot.fixed) {
      tempSlotValues.value.push({ index, originalValue: slot.value || '' });
      if (!slot.value) {
        emptySlots.push(index);
      }
    }
  });

  if (emptySlots.length === 0) return;

  isShowingHint.value = true;

  // 填入正确答案
  emptySlots.forEach(index => {
    partialSlots.value[index].value = partialSlots.value[index].letter;
  });

  // 设置所有空缺的闪烁状态
  flashingSlotIndex.value = -2; // 特殊值表示全部闪烁

  // 闪烁3次后恢复空缺
  setTimeout(() => {
    flashingSlotIndex.value = -1;
    // 恢复原始值（清空填入的提示）
    tempSlotValues.value.forEach(({ index, originalValue }) => {
      partialSlots.value[index].value = originalValue;
    });
    isShowingHint.value = false;
    // 聚焦到第一个空缺输入框
    nextTick(() => {
      const firstEmpty = partialSlots.value.findIndex(s => !s.fixed && !s.value);
      if (firstEmpty >= 0) slotRefs.value[firstEmpty]?.focus();
    });
  }, 900); // 3次闪烁，每次300ms
}

// 全盲模式下的输入框闪烁
function showBlankHint() {
  if (!currentWord.value || isShowingHint.value) return;

  // 保存当前输入
  const originalInput = [...userInput.value];
  const emptyIndices: number[] = [];

  userInput.value.forEach((char, index) => {
    if (!char) {
      emptyIndices.push(index);
    }
  });

  if (emptyIndices.length === 0) return;

  isShowingHint.value = true;

  // 填入正确答案
  const word = currentWord.value.text;
  emptyIndices.forEach(index => {
    userInput.value[index] = word[index];
  });

  // 获取对应的输入框元素并添加闪烁
  const inputSlots = document.querySelectorAll('.blank-mode .input-slot');
  inputSlots.forEach(slot => slot.classList.add('flashing'));

  // 闪烁3次后恢复
  setTimeout(() => {
    inputSlots.forEach(slot => slot.classList.remove('flashing'));
    // 恢复原始值
    userInput.value = [...originalInput];
    isShowingHint.value = false;
    // 聚焦到隐藏输入框
    nextTick(() => {
      hiddenInput.value?.focus();
    });
  }, 900);
}

function showHintDialog() {
  if (!currentWord.value) return;

  if (displayMode.value === 'partial') {
    showPartialHint();
  } else {
    showBlankHint();
  }
}

// 键盘快捷键监听
function handleDictationKeydown(e: KeyboardEvent) {
  // 检查快捷键是否启用
  if (!wordsStore.shortcutEnabled) {
    return;
  }

  // Shift+H 显示提示
  if (e.shiftKey && e.key.toLowerCase() === 'h') {
    e.preventDefault();
    showHintDialog();
    return;
  }

  // Shift+左箭头 - 上一个单词
  if (e.shiftKey && e.key === 'ArrowLeft') {
    e.preventDefault();
    prevWord();
    return;
  }

  // Shift+右箭头 - 下一个单词
  if (e.shiftKey && e.key === 'ArrowRight') {
    e.preventDefault();
    nextWord();
    return;
  }

  // 空格键 - 播放发音
  if (e.key === ' ') {
    e.preventDefault();
    replayWord();
    return;
  }

  // Enter - 跳过单词
  if (e.key === 'Enter') {
    e.preventDefault();
    skipWord();
    return;
  }
}

onMounted(() => {
  // 检查当前词库是否有保存的进度
  hasSavedProgress.value = loadSavedProgress();
  // 加载有错题的词库列表
  banksWithWrongWords.value = getWrongWordsBanks();
  // 记录最后访问的页面
  wordsStore.setLastVisitedPage('/dictation');
});

// 监听词库变化，更新进度状态
watch(() => wordBank.value, () => {
  hasSavedProgress.value = loadSavedProgress();
});
</script>

<style scoped lang="scss">
.dictation-page {
  min-height: 100vh;
  background: var(--utools-bg-secondary);
  display: flex;
  flex-direction: column;
}

// 顶部栏
.dictation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: var(--utools-bg-card);
  border-bottom: 1px solid var(--utools-border-divider);

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .title {
      font-size: 18px;
      font-weight: 500;
      color: var(--utools-text-primary);
    }
  }

  .header-right {
    .progress {
      font-size: 14px;
      color: var(--utools-text-secondary);
    }
  }
}

// 设置面板
.setup-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;

  .setup-card {
    background: var(--utools-bg-card);
    padding: 40px;
    border-radius: 8px;
    box-shadow: var(--utools-shadow-sm);
    max-width: 600px;
    width: 100%;

    h3 {
      margin: 0 0 32px;
      font-size: 24px;
      color: var(--utools-text-primary);
      text-align: center;
    }

    .setup-item {
      margin-bottom: 24px;

      label {
        display: block;
        margin-bottom: 12px;
        font-size: 14px;
        color: var(--utools-text-secondary);
      }

      .wordbank-info {
        margin-top: 8px;

        .cached-badge {
          color: var(--utools-success);
          margin-left: 4px;
        }
      }

      .wordbank-progress-info {
        margin-top: 8px;
      }

      .wrong-words-banks {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        margin-top: 8px;
      }
    }

    .setup-actions {
      margin-top: 32px;
      text-align: center;
      display: flex;
      justify-content: center;
      gap: 16px;

      .start-btn,
      .resume-btn {
        min-width: 160px;
      }
    }
  }
}

// 听写面板
.review-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;

  .word-display {
    width: 100%;
    max-width: 800px;
    text-align: center;
  }

  .hints-area {
    margin-bottom: 48px;

    .hint {
      margin-bottom: 16px;

      .hint-label {
        display: inline-block;
        width: 60px;
        font-size: 14px;
        color: var(--utools-text-tertiary);
        text-align: right;
        margin-right: 16px;
      }

      .hint-content {
        font-size: 18px;
        color: var(--utools-text-primary);
      }

      &.phonetic-hint .hint-content {
        color: var(--utools-primary);
        font-family: 'Times New Roman', serif;
      }

      &.meaning-hint .hint-content {
        color: var(--utools-text-secondary);
      }
    }
  }

  .input-area {
    margin-bottom: 32px;

    &.shaking {
      animation: shake 0.5s ease-in-out;
    }

    .blank-mode {
      position: relative;

      .input-slots {
        display: flex;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;

        .input-slot {
          width: 56px;
          height: 56px;
          border: 2px solid var(--utools-border-primary);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 500;
          color: var(--utools-text-primary);
          background: var(--utools-bg-card);
          transition: all 0.2s;

          &.filled {
            border-color: var(--utools-primary);
            background: var(--utools-primary-light);
          }
        }
      }

      .hidden-input {
        position: absolute;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        opacity: 0;
        cursor: default;
      }
    }

    .partial-mode {
      .letter-slots {
        display: flex;
        justify-content: center;
        gap: 8px;
        flex-wrap: wrap;

        .letter-slot {
          width: 56px;
          height: 56px;
          border: 2px solid var(--utools-border-primary);
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 500;
          transition: all 0.2s;

          &.fixed {
            background: var(--utools-bg-tertiary);
            border-color: var(--utools-border-primary);
            color: var(--utools-text-tertiary);
          }

          &.empty {
            background: var(--utools-bg-card);
            border-color: var(--utools-primary);
            border-style: dashed;
          }

          &.filled {
            background: var(--utools-primary-light);
          }

          .letter-input {
            width: 100%;
            height: 100%;
            border: none;
            background: transparent;
            text-align: center;
            font-size: 28px;
            font-weight: 500;
            color: var(--utools-text-primary);
            text-transform: lowercase;
            outline: none;
          }
        }
      }
    }
  }

  .control-area {
    display: flex;
    justify-content: center;
    gap: 12px;
  }

  .hint-area {
    margin-bottom: 24px;

    .hint-alert {
      max-width: 400px;
      margin: 0 auto;
    }
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}

// 闪烁动画
@keyframes flash {
  0%, 100% {
    background-color: var(--utools-warning);
    box-shadow: 0 0 0 0 var(--utools-warning);
  }
  50% {
    background-color: var(--utools-warning-light);
    box-shadow: 0 0 10px 2px var(--utools-warning);
  }
}

.letter-slot.flashing {
  animation: flash 0.3s ease-in-out 3;
}

.input-slot.flashing {
  animation: flash 0.3s ease-in-out 3;
}

// 完成面板
.complete-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;

  .complete-card {
    background: var(--utools-bg-card);
    padding: 48px;
    border-radius: 8px;
    box-shadow: var(--utools-shadow-sm);
    text-align: center;
    max-width: 500px;
    width: 100%;

    .complete-icon {
      margin-bottom: 24px;
    }

    h2 {
      margin: 0 0 32px;
      font-size: 28px;
      color: var(--utools-text-primary);
    }

    .stats {
      display: flex;
      justify-content: center;
      gap: 32px;
      margin-bottom: 32px;

      .stat-item {
        text-align: center;

        .stat-value {
          display: block;
          font-size: 32px;
          font-weight: 600;
          color: var(--utools-text-primary);
          margin-bottom: 4px;

          &.success {
            color: var(--utools-success);
          }

          &.error {
            color: var(--utools-danger);
          }
        }

        .stat-label {
          font-size: 14px;
          color: var(--utools-text-tertiary);
        }
      }
    }

    .wrong-words {
      margin-bottom: 32px;
      padding-top: 24px;
      border-top: 1px solid var(--utools-border-divider);

      h4 {
        margin: 0 0 16px;
        font-size: 14px;
        color: var(--utools-text-secondary);
      }

      .word-tags {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;

        .word-tag {
          padding: 6px 12px;
          background: rgba(245, 108, 108, 0.1);
          border: 1px solid var(--utools-danger);
          border-radius: 4px;
          font-size: 14px;
          color: var(--utools-danger);
        }
      }
    }

    .complete-actions {
      display: flex;
      justify-content: center;
      gap: 16px;
    }
  }
}
</style>
