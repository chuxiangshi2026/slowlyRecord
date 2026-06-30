<template>
  <div class="phonetic-recognition">
    <div class="header">
      <el-button text @click="goBack" :icon="ArrowLeft" size="large">返回</el-button>
      <div class="title">
        <h2>{{ direction === 'forward' ? '音标识别' : '反向识别' }}</h2>
        <span class="subtitle">{{ direction === 'forward' ? '看音标 · 选例词' : '看单词 · 选音标' }}</span>
      </div>
      <div class="stats">
        <span class="stat">{{ currentIndex + 1 }}/{{ TOTAL }}</span>
        <span class="stat correct">✓ {{ correctCount }}</span>
        <span class="stat wrong">✗ {{ wrongCount }}</span>
      </div>
    </div>

    <!-- 进度条 -->
    <el-progress :percentage="progressPercent" :show-text="false" class="progress"/>

    <!-- 题目区:正向 -->
    <div v-if="currentQ && !finished" class="quiz">
      <template v-if="direction === 'forward'">
        <div class="quiz-prompt">下列哪个单词包含此音素?</div>
        <div class="ipa-display" @click="speakCurrentArticulation">
          <span class="ipa-text">/{{ currentQ.phoneme.ipa }}/</span>
          <el-icon size="22" class="speaker"><VideoPlay/></el-icon>
        </div>
        <div class="ipa-meta">
          <el-tag size="small" :type="currentQ.phoneme.type === 'vowel' ? 'success' : 'warning'">
            {{ currentQ.phoneme.groupLabel }}
          </el-tag>
        </div>
      </template>

      <!-- 题目区:反向 -->
      <template v-else>
        <div class="quiz-prompt">下列哪个音标对应此单词的发音?</div>
        <div class="word-display" @click="speakCurrentWord">
          <span class="word-text">{{ currentQ.targetWord }}</span>
          <el-icon size="22" class="speaker"><VideoPlay/></el-icon>
        </div>
        <div class="ipa-meta">
          <el-tag size="small" type="info">点击单词听发音</el-tag>
        </div>
      </template>

      <!-- 选项 -->
      <div class="options">
        <div
            v-for="(opt, idx) in currentQ.options"
            :key="opt + idx"
            class="option-card"
            :class="optionClass(idx)"
            @click="choose(idx)"
        >
          <span class="opt-letter">{{ ['A', 'B', 'C', 'D'][idx] }}</span>
          <span class="opt-word" :class="{ 'opt-ipa-text': direction === 'backward' }">
            {{ direction === 'backward' ? `/${opt}/` : opt }}
          </span>
          <el-icon v-if="answered && idx === currentQ.answerIdx" class="opt-icon"><CircleCheckFilled /></el-icon>
          <el-icon v-else-if="answered && idx === pickedIdx" class="opt-icon"><CircleCloseFilled /></el-icon>
        </div>
      </div>

      <!-- 解析 -->
      <div v-if="answered" class="explain">
        <div class="explain-row">
          <span class="explain-label">正解</span>
          <span class="explain-word">
            {{ direction === 'forward'
              ? currentQ.options[currentQ.answerIdx]
              : `/${currentQ.options[currentQ.answerIdx]}/` }}
          </span>
          <el-button text size="small" @click="speak(currentQ.targetWord)">
            <el-icon size="14"><VideoPlay /></el-icon>
            听一下
          </el-button>
        </div>
        <div class="explain-row">
          <span class="explain-label">要点</span>
          <span class="explain-tip">{{ currentQ.phoneme.tip }}</span>
        </div>
        <el-button type="primary" size="large" class="next-btn" @click="nextQuestion">
          {{ currentIndex + 1 >= TOTAL ? '查看结果' : '下一题' }}
          <el-icon class="el-icon--right"><Right /></el-icon>
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
        <el-button size="large" @click="goBack">返回音标表</el-button>
        <el-button type="primary" size="large" @click="restart">再来一轮</el-button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref, computed, onMounted} from 'vue';
import {useRouter, useRoute} from 'vue-router';
import {ArrowLeft, VideoPlay, Right, CircleCheckFilled, CircleCloseFilled} from '@element-plus/icons-vue';
import {ALL_PHONEMES, findPhoneme, type Phoneme} from '@/utils/phoneme-data';
import {speakWithEdgeTTS, speakWithWebSpeech} from '@/utils/translation-api';
import {usePhoneticMemoryStore} from '@/stores/phoneticMemory';

const router = useRouter();
const route = useRoute();
const TOTAL = 20;
const phoneticStore = usePhoneticMemoryStore();

/** forward = 给 IPA 选例词;backward = 给例词选 IPA */
const direction = computed<'forward' | 'backward'>(() =>
    route.query.direction === 'backward' ? 'backward' : 'forward'
);

interface Question {
    phoneme: Phoneme;          // 题目对应的音素(双向都是这个音素)
    targetWord: string;         // 正向题的正确选项 / 反向题的题干单词
    options: string[];          // 正向:4 个单词;反向:4 个 IPA 字符串
    answerIdx: number;
}

const questions = ref<Question[]>([]);
const currentIndex = ref(0);
const correctCount = ref(0);
const wrongCount = ref(0);
const pickedIdx = ref<number | null>(null);
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

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

/**
 * 正向题:题干是 IPA,正确选项是该音素的例词,干扰项从 similar 抽
 */
function buildForwardQuestion(phoneme: Phoneme): Question {
    const correct = phoneme.examples[Math.floor(Math.random() * phoneme.examples.length)];
    const distractors: string[] = [];
    const similarIpas = phoneme.similar || [];
    for (const ipa of similarIpas) {
        const ph = findPhoneme(ipa);
        if (!ph) continue;
        const word = ph.examples[Math.floor(Math.random() * ph.examples.length)];
        if (word !== correct && !distractors.includes(word)) distractors.push(word);
        if (distractors.length >= 3) break;
    }
    while (distractors.length < 3) {
        const ph = ALL_PHONEMES[Math.floor(Math.random() * ALL_PHONEMES.length)];
        if (ph.ipa === phoneme.ipa) continue;
        const word = ph.examples[Math.floor(Math.random() * ph.examples.length)];
        if (word !== correct && !distractors.includes(word)) distractors.push(word);
    }
    const options = shuffle([correct, ...distractors]);
    return {phoneme, targetWord: correct, options, answerIdx: options.indexOf(correct)};
}

/**
 * 反向题:题干是单词,正确选项是该词所含某个音素的 IPA(取例词时这个音素就是焦点),
 * 干扰项从 similar 抽其它音素的 IPA。
 */
function buildBackwardQuestion(phoneme: Phoneme): Question {
    const targetWord = phoneme.examples[Math.floor(Math.random() * phoneme.examples.length)];
    const correctIpa = phoneme.ipa;
    const distractors: string[] = [];
    for (const ipa of phoneme.similar || []) {
        if (!distractors.includes(ipa) && ipa !== correctIpa) distractors.push(ipa);
        if (distractors.length >= 3) break;
    }
    while (distractors.length < 3) {
        const ph = ALL_PHONEMES[Math.floor(Math.random() * ALL_PHONEMES.length)];
        if (ph.ipa !== correctIpa && !distractors.includes(ph.ipa)) distractors.push(ph.ipa);
    }
    const options = shuffle([correctIpa, ...distractors]);
    return {phoneme, targetWord, options, answerIdx: options.indexOf(correctIpa)};
}

function generateQuestions() {
    // 间隔重复:让 store 按 due → fresh → others 优先级抽
    const picked = phoneticStore.pickPhonemesForSession(TOTAL);
    const builder = direction.value === 'forward' ? buildForwardQuestion : buildBackwardQuestion;
    questions.value = picked.map(builder);
}

async function startSession() {
    await phoneticStore.ensureLoaded();
    generateQuestions();
    currentIndex.value = 0;
    correctCount.value = 0;
    wrongCount.value = 0;
    pickedIdx.value = null;
    answered.value = false;
    finished.value = false;
    setTimeout(autoSpeakPrompt, 250);
}

function choose(idx: number) {
    if (answered.value || !currentQ.value) return;
    pickedIdx.value = idx;
    answered.value = true;
    const isCorrect = idx === currentQ.value.answerIdx;
    if (isCorrect) {
        correctCount.value++;
        speak(currentQ.value.targetWord);
    } else {
        wrongCount.value++;
        speak(currentQ.value.targetWord);
    }
    // 异步回写间隔重复进度,不阻塞 UI
    phoneticStore.markPhoneme(currentQ.value.phoneme.ipa, isCorrect);
}

function optionClass(idx: number) {
    if (!answered.value) return '';
    if (!currentQ.value) return '';
    if (idx === currentQ.value.answerIdx) return 'correct';
    if (idx === pickedIdx.value) return 'wrong';
    return 'disabled';
}

function nextQuestion() {
    if (currentIndex.value + 1 >= TOTAL) {
        finished.value = true;
        return;
    }
    currentIndex.value++;
    pickedIdx.value = null;
    answered.value = false;
    setTimeout(autoSpeakPrompt, 200);
}

/** 进入每题时自动播放题干提示音 */
function autoSpeakPrompt() {
    if (!currentQ.value) return;
    if (direction.value === 'forward') speakCurrentArticulation();
    else speakCurrentWord();
}

/** 朗读音素本身(phonics 代理串,按音素类型调速) */
function speakCurrentArticulation() {
    if (!currentQ.value || !('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const ph = currentQ.value.phoneme;
    const u = new SpeechSynthesisUtterance(ph.articulation);
    u.lang = 'en-US';
    if (ph.group === 'short') u.rate = 0.95;
    else if (ph.group === 'long') u.rate = 0.5;
    else if (ph.group === 'diphthong') u.rate = 0.7;
    else u.rate = 0.75;
    u.pitch = 1;
    u.volume = 1;
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v => /en-US/i.test(v.lang) && /Aria|Jenny|Zira|Google/i.test(v.name))
        || voices.find(v => /^en/i.test(v.lang));
    if (preferred) u.voice = preferred;
    window.speechSynthesis.speak(u);
}

function speakCurrentWord() {
    if (currentQ.value) speak(currentQ.value.targetWord);
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
.phonetic-recognition {
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
  padding: 32px 24px;
  overflow-y: auto;
}

.quiz-prompt {
  font-size: 14px;
  color: var(--utools-text-tertiary, #909399);
  margin-bottom: 16px;
}

.ipa-display,
.word-display {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 36px;
  background: var(--utools-bg-secondary, #fff);
  border: 2px solid var(--utools-border-primary, #e4e7ed);
  border-radius: 16px;
  cursor: pointer;
  margin-bottom: 8px;
  transition: all 0.2s;

  &:hover {
    border-color: var(--utools-primary, #409eff);
    transform: scale(1.02);
  }

  .speaker {
    color: var(--utools-primary, #409eff);
  }
}

.ipa-display .ipa-text {
  font-size: 56px;
  font-weight: 700;
  color: var(--utools-text-primary, #303133);
  font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  line-height: 1;
}

.word-display .word-text {
  font-size: 42px;
  font-weight: 600;
  color: var(--utools-text-primary, #303133);
  line-height: 1;
  letter-spacing: 1px;
}

.ipa-meta {
  margin-bottom: 24px;
}

.options {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  width: 100%;
  max-width: 480px;
  margin-bottom: 20px;
}

.option-card {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: var(--utools-bg-secondary, #fff);
  border: 2px solid var(--utools-border-primary, #e4e7ed);
  border-radius: 10px;
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
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--utools-bg-tertiary, #f0f2f5);
    color: var(--utools-text-secondary, #606266);
    display: inline-flex;
    align-items: center;
    justify-content: center;
    font-size: 13px;
    font-weight: 600;
    flex-shrink: 0;
  }

  .opt-word {
    flex: 1;
    font-size: 18px;
    font-weight: 500;
    color: var(--utools-text-primary, #303133);
  }

  .opt-ipa-text {
    font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  }

  .opt-icon {
    font-size: 22px;
  }

  &.correct .opt-icon { color: #67c23a; }
  &.wrong .opt-icon { color: #f56c6c; }
}

.explain {
  width: 100%;
  max-width: 480px;
  padding: 14px 16px;
  background: var(--utools-bg-secondary, #fff);
  border-radius: 10px;
  border: 1px solid var(--utools-border-primary, #e4e7ed);

  .explain-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 10px;
    font-size: 13px;
  }

  .explain-label {
    font-size: 12px;
    color: var(--utools-text-tertiary, #909399);
    width: 36px;
    flex-shrink: 0;
  }

  .explain-word {
    font-size: 16px;
    font-weight: 600;
    color: var(--utools-text-primary, #303133);
    font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  }

  .explain-tip {
    color: var(--utools-text-secondary, #606266);
    line-height: 1.5;
  }

  .next-btn {
    width: 100%;
    margin-top: 8px;
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
