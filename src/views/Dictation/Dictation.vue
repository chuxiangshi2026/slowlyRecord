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
        <span class="progress" v-if="dictationMode === 'review'">
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
            <el-radio-button label="cet4">四级词库</el-radio-button>
            <el-radio-button label="cet6">六级词库</el-radio-button>
            <el-radio-button label="import">导入词库</el-radio-button>
          </el-radio-group>
        </div>

        <div class="setup-item" v-if="wordBank !== 'import'">
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
          <el-button type="primary" size="large" @click="startDictation" class="start-btn">
            开始听写
          </el-button>
        </div>
      </div>
    </div>

    <!-- 听写界面 -->
    <div v-else-if="dictationMode === 'review'" class="review-panel">
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
          <el-button type="primary" size="large" @click="restart">再来一次</el-button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import { ArrowLeft, VideoPlay, CircleCheck, Right } from '@element-plus/icons-vue';
import { useWordsStore } from '@/stores/words';
import type { Word } from '@/types/words';

const router = useRouter();
const wordsStore = useWordsStore();

// ========== 状态 ==========
type DictationMode = 'setup' | 'review' | 'complete';
const dictationMode = ref<DictationMode>('setup');

const wordBank = ref<'current' | 'cet4' | 'cet6' | 'import'>('current');
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

const partialSlots = ref<{ fixed: boolean; letter: string; value?: string }[]>([]);
const slotRefs = ref<Record<number, HTMLInputElement>>({});
const hiddenInput = ref<HTMLInputElement>();

// ========== 计算属性 ==========
const currentWord = computed(() => wordList.value[currentIndex.value] || null);

const accuracy = computed(() => {
  if (wordList.value.length === 0) return 0;
  return Math.round((stats.value.correct / wordList.value.length) * 100);
});

// ========== 方法 ==========
function goBack() {
  router.push('/word');
}

function getSimplePhonetic(text: string): string {
  return text;
}

async function startDictation() {
  let words: Word[] = [];

  switch (wordBank.value) {
    case 'current':
      if (wordsStore.words.length === 0) {
        ElMessage.warning('当前词库为空');
        return;
      }
      words = [...wordsStore.words]
        .filter(w => w.text && w.text.match(/^[a-zA-Z]+$/))
        .sort(() => Math.random() - 0.5)
        .slice(0, wordCount.value);
      break;

    case 'cet4':
    case 'cet6':
      ElMessage.info(`${wordBank.value === 'cet4' ? '四级' : '六级'}词库开发中，使用当前词库`);
      words = [...wordsStore.words]
        .filter(w => w.text && w.text.match(/^[a-zA-Z]+$/))
        .sort(() => Math.random() - 0.5)
        .slice(0, wordCount.value);
      break;

    case 'import':
      await importWordBank();
      return;
  }

  if (words.length === 0) {
    ElMessage.warning('没有可用的单词');
    return;
  }

  wordList.value = words;
  currentIndex.value = 0;
  stats.value = { correct: 0, wrong: 0 };
  wrongWords.value = [];
  dictationMode.value = 'review';
  prepareWord();
}

async function importWordBank() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,.txt';
  input.onchange = async (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const content = ev.target?.result as string;
        let words: Word[] = [];

        if (file.name.endsWith('.json')) {
          const data = JSON.parse(content);
          words = Array.isArray(data) ? data : data.words || [];
        } else {
          words = content.split('\n')
            .map(l => l.trim())
            .filter(l => l)
            .map(text => ({ text } as Word));
        }

        words = words.filter(w => w.text?.match(/^[a-zA-Z]+$/));
        if (words.length === 0) {
          ElMessage.warning('没有有效的单词');
          return;
        }

        wordList.value = words.sort(() => Math.random() - 0.5);
        currentIndex.value = 0;
        stats.value = { correct: 0, wrong: 0 };
        wrongWords.value = [];
        dictationMode.value = 'review';
        prepareWord();
        ElMessage.success(`导入 ${words.length} 个单词`);
      } catch {
        ElMessage.error('导入失败');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function prepareWord() {
  userInput.value = [];
  rawInput.value = '';
  isShaking.value = false;
  partialSlots.value = [];

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
      const firstEmpty = partialSlots.value.findIndex(s => !s.fixed);
      if (firstEmpty >= 0) slotRefs.value[firstEmpty]?.focus();
    });
  } else {
    nextTick(() => {
      hiddenInput.value?.focus();
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
    nextWord();
  } else {
    stats.value.wrong++;
    wrongWords.value.push(word);
    // 晃动提示
    isShaking.value = true;
    setTimeout(() => {
      isShaking.value = false;
    }, 500);
  }
}

function prevWord() {
  if (currentIndex.value > 0) {
    currentIndex.value--;
    prepareWord();
  }
}

function skipWord() {
  if (currentWord.value) {
    wrongWords.value.push(currentWord.value);
    stats.value.wrong++;
  }
  nextWord();
}

function nextWord() {
  if (currentIndex.value < wordList.value.length - 1) {
    currentIndex.value++;
    prepareWord();
  } else {
    dictationMode.value = 'complete';
  }
}

function restart() {
  dictationMode.value = 'setup';
  wordList.value = [];
  currentIndex.value = 0;
}

onMounted(() => {
  // 页面加载时自动开始（如果有参数）
});
</script>

<style scoped lang="scss">
.dictation-page {
  min-height: 100vh;
  background: #fafafa;
  display: flex;
  flex-direction: column;
}

// 顶部栏
.dictation-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 24px;
  background: #fff;
  border-bottom: 1px solid #e8e8e8;

  .header-left {
    display: flex;
    align-items: center;
    gap: 16px;

    .title {
      font-size: 18px;
      font-weight: 500;
      color: #262626;
    }
  }

  .header-right {
    .progress {
      font-size: 14px;
      color: #8c8c8c;
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
    background: #fff;
    padding: 40px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    max-width: 600px;
    width: 100%;

    h3 {
      margin: 0 0 32px;
      font-size: 24px;
      color: #262626;
      text-align: center;
    }

    .setup-item {
      margin-bottom: 24px;

      label {
        display: block;
        margin-bottom: 12px;
        font-size: 14px;
        color: #595959;
      }
    }

    .setup-actions {
      margin-top: 32px;
      text-align: center;

      .start-btn {
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
        color: #8c8c8c;
        text-align: right;
        margin-right: 16px;
      }

      .hint-content {
        font-size: 18px;
        color: #262626;
      }

      &.phonetic-hint .hint-content {
        color: #1890ff;
        font-family: 'Times New Roman', serif;
      }

      &.meaning-hint .hint-content {
        color: #595959;
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
          border: 2px solid #d9d9d9;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 500;
          color: #262626;
          background: #fff;
          transition: all 0.2s;

          &.filled {
            border-color: #1890ff;
            background: #f0f7ff;
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
          border: 2px solid #d9d9d9;
          border-radius: 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          font-weight: 500;
          transition: all 0.2s;

          &.fixed {
            background: #f5f5f5;
            border-color: #d9d9d9;
            color: #8c8c8c;
          }

          &.empty {
            background: #fff;
            border-color: #1890ff;
            border-style: dashed;
          }

          &.filled {
            background: #f0f7ff;
          }

          .letter-input {
            width: 100%;
            height: 100%;
            border: none;
            background: transparent;
            text-align: center;
            font-size: 28px;
            font-weight: 500;
            color: #262626;
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
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10%, 30%, 50%, 70%, 90% { transform: translateX(-8px); }
  20%, 40%, 60%, 80% { transform: translateX(8px); }
}

// 完成面板
.complete-panel {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;

  .complete-card {
    background: #fff;
    padding: 48px;
    border-radius: 8px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
    text-align: center;
    max-width: 500px;
    width: 100%;

    .complete-icon {
      margin-bottom: 24px;
    }

    h2 {
      margin: 0 0 32px;
      font-size: 28px;
      color: #262626;
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
          color: #262626;
          margin-bottom: 4px;

          &.success {
            color: #52c41a;
          }

          &.error {
            color: #ff4d4f;
          }
        }

        .stat-label {
          font-size: 14px;
          color: #8c8c8c;
        }
      }
    }

    .wrong-words {
      margin-bottom: 32px;
      padding-top: 24px;
      border-top: 1px solid #e8e8e8;

      h4 {
        margin: 0 0 16px;
        font-size: 14px;
        color: #595959;
      }

      .word-tags {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 8px;

        .word-tag {
          padding: 6px 12px;
          background: #fff2f0;
          border: 1px solid #ffccc7;
          border-radius: 4px;
          font-size: 14px;
          color: #ff4d4f;
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
