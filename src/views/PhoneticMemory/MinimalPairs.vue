<template>
  <div class="minimal-pairs">
    <div class="header">
      <el-button text @click="goBack" :icon="ArrowLeft" size="large">返回</el-button>
      <div class="title">
        <h2>最小对立对</h2>
        <span class="subtitle">听音 · 二选一</span>
      </div>
      <div class="stats">
        <span class="stat">{{ currentIndex + 1 }}/{{ TOTAL }}</span>
        <span class="stat correct">✓ {{ correctCount }}</span>
        <span class="stat wrong">✗ {{ wrongCount }}</span>
      </div>
    </div>
    <el-progress :percentage="progressPercent" :show-text="false" class="progress"/>

    <div v-if="currentQ && !finished" class="quiz">
      <div class="quiz-prompt">仔细听,你听到的是哪一个?</div>

      <!-- 大喇叭 -->
      <div class="big-speaker" @click="playTarget">
        <el-icon :size="72"><VideoPlay/></el-icon>
        <div class="speaker-hint">点击重听</div>
      </div>

      <!-- 工具:再听 / 慢速 -->
      <div class="tools">
        <el-button @click="playTarget">
          <el-icon><RefreshRight/></el-icon> 再听一次
        </el-button>
        <el-button @click="playTargetSlow">
          <el-icon><Timer/></el-icon> 慢速
        </el-button>
      </div>

      <!-- 选项 -->
      <div class="options">
        <div
            class="option-card"
            :class="optionClass('a')"
            @click="choose('a')"
        >
          <div class="opt-letter">A</div>
          <div class="opt-content">
            <div class="opt-word">{{ currentQ.pair.a }}</div>
            <div class="opt-ipa">/{{ currentQ.pair.phoneticA }}/</div>
          </div>
          <el-icon v-if="answered && currentQ.answer === 'a'" class="opt-icon correct-icon"><CircleCheckFilled/></el-icon>
          <el-icon v-else-if="answered && picked === 'a'" class="opt-icon wrong-icon"><CircleCloseFilled/></el-icon>
        </div>
        <div
            class="option-card"
            :class="optionClass('b')"
            @click="choose('b')"
        >
          <div class="opt-letter">B</div>
          <div class="opt-content">
            <div class="opt-word">{{ currentQ.pair.b }}</div>
            <div class="opt-ipa">/{{ currentQ.pair.phoneticB }}/</div>
          </div>
          <el-icon v-if="answered && currentQ.answer === 'b'" class="opt-icon correct-icon"><CircleCheckFilled/></el-icon>
          <el-icon v-else-if="answered && picked === 'b'" class="opt-icon wrong-icon"><CircleCloseFilled/></el-icon>
        </div>
      </div>

      <!-- 解析:答错时自动对比朗读 -->
      <div v-if="answered" class="explain">
        <div class="explain-row">
          <span class="explain-label">对立点</span>
          <span class="explain-content">{{ currentQ.pair.contrast }}</span>
        </div>
        <div class="explain-actions">
          <el-button @click="speak(currentQ.pair.a)">
            <el-icon><VideoPlay/></el-icon> {{ currentQ.pair.a }}
          </el-button>
          <el-button @click="speak(currentQ.pair.b)">
            <el-icon><VideoPlay/></el-icon> {{ currentQ.pair.b }}
          </el-button>
        </div>
        <el-button type="primary" size="large" class="next-btn" @click="nextQuestion">
          {{ currentIndex + 1 >= TOTAL ? '查看结果' : '下一题' }}
          <el-icon class="el-icon--right"><Right/></el-icon>
        </el-button>
      </div>
    </div>

    <!-- 结果页 -->
    <div v-if="finished" class="result">
      <h2>本轮完成 🎉</h2>
      <div class="result-stats">
        <div class="result-stat">
          <div class="num">{{ correctCount }}</div>
          <div class="label">答对</div>
        </div>
        <div class="result-stat">
          <div class="num">{{ wrongCount }}</div>
          <div class="label">答错</div>
        </div>
        <div class="result-stat">
          <div class="num">{{ accuracy }}%</div>
          <div class="label">正确率</div>
        </div>
      </div>
      <div class="result-actions">
        <el-button size="large" @click="goBack">返回</el-button>
        <el-button type="primary" size="large" @click="restart">再来一轮</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue';
import {useRouter} from 'vue-router';
import {ArrowLeft, VideoPlay, Right, CircleCheckFilled, CircleCloseFilled, RefreshRight, Timer} from '@element-plus/icons-vue';
import {MINIMAL_PAIRS, type MinimalPair} from '@/utils/phoneme-data';
import {speakWithEdgeTTS, speakWithWebSpeech} from '@/utils/translation-api';
import {usePhoneticMemoryStore} from '@/stores/phoneticMemory';

const router = useRouter();
const TOTAL = 15;
const phoneticStore = usePhoneticMemoryStore();

interface Question {
    pair: MinimalPair;
    /** 'a' = 播放 A 词,'b' = 播放 B 词;用户需选对应的 */
    answer: 'a' | 'b';
}

const questions = ref<Question[]>([]);
const currentIndex = ref(0);
const correctCount = ref(0);
const wrongCount = ref(0);
const picked = ref<'a' | 'b' | null>(null);
const answered = ref(false);
const finished = ref(false);

const currentQ = computed<Question | null>(() => questions.value[currentIndex.value] || null);

const progressPercent = computed(() =>
    Math.round(((currentIndex.value + (answered.value ? 1 : 0)) / TOTAL) * 100),
);

const accuracy = computed(() => {
    const total = correctCount.value + wrongCount.value;
    return total ? Math.round((correctCount.value / total) * 100) : 0;
});

function generateQuestions() {
    // 按间隔重复优先级抽对子
    const picked = phoneticStore.pickPairsForSession(MINIMAL_PAIRS, TOTAL);
    questions.value = picked.map<Question>(pair => ({
        pair,
        answer: Math.random() < 0.5 ? 'a' : 'b',
    }));
}

async function startSession() {
    await phoneticStore.ensureLoaded();
    generateQuestions();
    currentIndex.value = 0;
    correctCount.value = 0;
    wrongCount.value = 0;
    picked.value = null;
    answered.value = false;
    finished.value = false;
    setTimeout(playTarget, 350);
}

function choose(option: 'a' | 'b') {
    if (answered.value || !currentQ.value) return;
    picked.value = option;
    answered.value = true;
    const isCorrect = option === currentQ.value.answer;
    if (isCorrect) {
        correctCount.value++;
    } else {
        wrongCount.value++;
        // 答错时自动对比朗读两个词,帮助辨别
        setTimeout(() => speak(currentQ.value!.pair.a), 200);
        setTimeout(() => speak(currentQ.value!.pair.b), 1300);
    }
    phoneticStore.markPair(currentQ.value.pair.a, currentQ.value.pair.b, isCorrect);
}

function optionClass(option: 'a' | 'b') {
    if (!answered.value) return '';
    if (!currentQ.value) return '';
    if (option === currentQ.value.answer) return 'correct';
    if (option === picked.value) return 'wrong';
    return 'disabled';
}

function nextQuestion() {
    if (currentIndex.value + 1 >= TOTAL) {
        finished.value = true;
        return;
    }
    currentIndex.value++;
    picked.value = null;
    answered.value = false;
    setTimeout(playTarget, 300);
}

function playTarget() {
    if (!currentQ.value) return;
    const word = currentQ.value.answer === 'a' ? currentQ.value.pair.a : currentQ.value.pair.b;
    speak(word);
}

function playTargetSlow() {
    if (!currentQ.value || !('speechSynthesis' in window)) return;
    const word = currentQ.value.answer === 'a' ? currentQ.value.pair.a : currentQ.value.pair.b;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.6;
    u.pitch = 1;
    u.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /en-US/i.test(v.lang) && /Aria|Jenny|Zira|Google/i.test(v.name))
        || voices.find(v => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
}

async function speak(word: string) {
    const ok = await speakWithEdgeTTS(word).catch(() => false);
    if (!ok) speakWithWebSpeech(word);
}

function restart() {
    startSession();
}

function goBack() {
    router.push('/phonetic-memory');
}

onMounted(startSession);
</script>

<style scoped lang="scss">
.minimal-pairs {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--utools-bg-primary, #fafafa);
}

.header {
  display: flex;
  align-items: center;
  padding: 12px 20px;
  border-bottom: 1px solid var(--utools-border-primary, #eee);
  background: var(--utools-bg-secondary, #fff);
  gap: 16px;

  .title {
    flex: 1;
    h2 {
      margin: 0;
      font-size: 17px;
      color: var(--utools-text-primary, #303133);
    }
    .subtitle {
      font-size: 12px;
      color: var(--utools-text-tertiary, #909399);
    }
  }

  .stats {
    display: flex;
    gap: 10px;
    font-size: 13px;
    .stat {
      color: var(--utools-text-secondary, #606266);
      &.correct { color: #67c23a; font-weight: 600; }
      &.wrong { color: #f56c6c; font-weight: 600; }
    }
  }
}

.progress {
  margin: 0;
  height: 4px;
  flex-shrink: 0;
  :deep(.el-progress-bar__outer) {
    border-radius: 0;
  }
}

.quiz {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  overflow-y: auto;
}

.quiz-prompt {
  font-size: 14px;
  color: var(--utools-text-tertiary, #909399);
  margin-bottom: 20px;
}

.big-speaker {
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: var(--utools-bg-secondary, #fff);
  border: 3px solid var(--utools-primary, #409eff);
  color: var(--utools-primary, #409eff);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  margin-bottom: 16px;
  transition: all 0.2s;
  position: relative;

  &:hover {
    transform: scale(1.05);
    box-shadow: 0 8px 24px rgba(64, 158, 255, 0.25);
  }

  .speaker-hint {
    font-size: 11px;
    margin-top: 4px;
    color: var(--utools-text-tertiary, #909399);
  }
}

.tools {
  display: flex;
  gap: 12px;
  margin-bottom: 28px;
}

.options {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
  width: 100%;
  max-width: 420px;
  margin-bottom: 20px;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px 18px;
  background: var(--utools-bg-secondary, #fff);
  border: 2px solid var(--utools-border-primary, #e4e7ed);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;
  position: relative;

  &:hover:not(.correct):not(.wrong):not(.disabled) {
    border-color: var(--utools-primary, #409eff);
    transform: translateY(-1px);
  }

  &.correct {
    border-color: #67c23a;
    background: #f0f9eb;
  }

  &.wrong {
    border-color: #f56c6c;
    background: #fef0f0;
  }

  &.disabled {
    opacity: 0.55;
    cursor: default;
  }

  .opt-letter {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--utools-bg-tertiary, #f0f2f5);
    color: var(--utools-text-secondary, #606266);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 14px;
    font-weight: 700;
    flex-shrink: 0;
  }

  .opt-content {
    flex: 1;
  }

  .opt-word {
    font-size: 22px;
    font-weight: 600;
    color: var(--utools-text-primary, #303133);
    line-height: 1.1;
  }

  .opt-ipa {
    margin-top: 2px;
    font-size: 13px;
    color: var(--utools-text-tertiary, #909399);
    font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  }

  .opt-icon {
    font-size: 26px;
  }

  .correct-icon { color: #67c23a; }
  .wrong-icon { color: #f56c6c; }
}

.explain {
  width: 100%;
  max-width: 420px;
  padding: 14px 16px;
  background: var(--utools-bg-secondary, #fff);
  border-radius: 10px;
  border: 1px solid var(--utools-border-primary, #e4e7ed);

  .explain-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
  }

  .explain-label {
    font-size: 12px;
    color: var(--utools-text-tertiary, #909399);
    width: 48px;
    flex-shrink: 0;
  }

  .explain-content {
    font-size: 14px;
    color: var(--utools-text-primary, #303133);
    font-weight: 600;
    font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  }

  .explain-actions {
    display: flex;
    gap: 10px;
    margin: 12px 0 14px;
  }

  .next-btn {
    width: 100%;
  }
}

.result {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px;

  h2 {
    font-size: 28px;
    margin-bottom: 32px;
  }
}

.result-stats {
  display: flex;
  gap: 24px;
  margin-bottom: 36px;
}

.result-stat {
  text-align: center;
  padding: 20px 28px;
  background: var(--utools-bg-secondary, #fff);
  border-radius: 12px;
  min-width: 100px;
  border: 1px solid var(--utools-border-primary, #e4e7ed);

  .num {
    font-size: 36px;
    font-weight: 700;
    color: var(--utools-primary, #409eff);
    line-height: 1.1;
  }

  .label {
    font-size: 12px;
    color: var(--utools-text-tertiary, #909399);
    margin-top: 4px;
  }
}

.result-actions {
  display: flex;
  gap: 16px;
}
</style>
