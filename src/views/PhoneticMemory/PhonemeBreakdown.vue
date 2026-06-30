<template>
  <div class="phoneme-breakdown">
    <div class="header">
      <el-button text @click="goBack" :icon="ArrowLeft" size="large">返回</el-button>
      <div class="title">
        <h2>音素拆解</h2>
        <span class="subtitle">把单词拆成音素</span>
      </div>
      <div class="stats">
        <span class="stat">{{ currentIndex + 1 }}/{{ TOTAL }}</span>
        <span class="stat correct">✓ {{ correctCount }}</span>
        <span class="stat wrong">✗ {{ wrongCount }}</span>
      </div>
    </div>
    <el-progress :percentage="progressPercent" :show-text="false" class="progress"/>

    <div v-if="currentQ && !finished" class="quiz">
      <!-- 目标单词 + 难度 -->
      <div class="target-row">
        <div class="word-card" @click="speakTarget">
          <span class="word-text">{{ currentQ.word.word }}</span>
          <el-icon size="20" class="speaker"><VideoPlay/></el-icon>
        </div>
        <el-tag size="small" type="info">{{ difficultyLabel(currentQ.word.difficulty) }}</el-tag>
      </div>

      <div class="quiz-prompt">点击下面的音素,按顺序拼出这个单词的发音</div>

      <!-- 槽位 -->
      <div class="slots" :class="{ shake: shaking }">
        <div
            v-for="(slot, idx) in slots"
            :key="idx"
            class="slot"
            :class="{
              filled: slot.filled,
              current: idx === currentSlotIndex,
              correct: answered && slot.filled && slotCorrect[idx],
              wrong: answered && slot.filled && !slotCorrect[idx],
            }"
            @click="onSlotClick(idx)"
        >
          <span v-if="slot.filled" class="slot-ipa">/{{ slot.ipa }}/</span>
          <span v-else class="slot-placeholder">·</span>
        </div>
      </div>

      <!-- 音素池 -->
      <div class="pool">
        <div
            v-for="opt in pool"
            :key="opt.id"
            class="pool-item"
            :class="{ used: opt.used }"
            @click="onPoolClick(opt)"
        >
          /{{ opt.ipa }}/
        </div>
      </div>

      <!-- 操作 -->
      <div class="actions" v-if="!answered">
        <el-button @click="resetSlots" :icon="RefreshLeft">重置</el-button>
        <el-button
            type="primary"
            :disabled="!allFilled"
            @click="checkAnswer"
            :icon="Check"
        >提交</el-button>
      </div>

      <!-- 解析 -->
      <div v-if="answered" class="explain">
        <div class="explain-row">
          <span class="explain-label">正确</span>
          <span class="explain-ipa">/{{ currentQ.word.phonetic }}/</span>
        </div>
        <div class="explain-row">
          <span class="explain-label">分解</span>
          <span class="explain-decomp">
            <span
                v-for="(ph, i) in currentQ.target"
                :key="i"
                class="decomp-chip"
                :class="{ wrongChip: slotCorrect[i] === false }"
            >/{{ ph.ipa }}/</span>
          </span>
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
import {ArrowLeft, VideoPlay, Right, RefreshLeft, Check} from '@element-plus/icons-vue';
import {BREAKDOWN_WORDS, breakdownPhonetic, type BreakdownWord} from '@/utils/phoneme-breakdown';
import {ALL_PHONEMES, type Phoneme} from '@/utils/phoneme-data';
import {speakWithEdgeTTS, speakWithWebSpeech} from '@/utils/translation-api';
import {usePhoneticMemoryStore} from '@/stores/phoneticMemory';

const router = useRouter();
const TOTAL = 10;
const phoneticStore = usePhoneticMemoryStore();

interface BreakdownQuestion {
    word: BreakdownWord;
    target: Phoneme[];          // 正确切分序列
    distractors: Phoneme[];     // 干扰音素
}

interface Slot {
    filled: boolean;
    ipa: string;
    /** 该填充来自池中哪个 id,用于点回时还原 */
    fromPoolId: number;
}

interface PoolItem {
    id: number;
    ipa: string;
    /** Phoneme 对象 */
    phoneme: Phoneme;
    used: boolean;
}

const questions = ref<BreakdownQuestion[]>([]);
const currentIndex = ref(0);
const correctCount = ref(0);
const wrongCount = ref(0);
const slots = ref<Slot[]>([]);
const pool = ref<PoolItem[]>([]);
const slotCorrect = ref<boolean[]>([]);  // 提交后的逐位对错
const answered = ref(false);
const finished = ref(false);
const shaking = ref(false);

const currentQ = computed<BreakdownQuestion | null>(() => questions.value[currentIndex.value] || null);

const progressPercent = computed(() =>
    Math.round(((currentIndex.value + (answered.value ? 1 : 0)) / TOTAL) * 100),
);

const accuracy = computed(() => {
    const total = correctCount.value + wrongCount.value;
    return total ? Math.round((correctCount.value / total) * 100) : 0;
});

const allFilled = computed(() => slots.value.every(s => s.filled));

const currentSlotIndex = computed(() => slots.value.findIndex(s => !s.filled));

function shuffle<T>(arr: T[]): T[] {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function difficultyLabel(d: 1 | 2 | 3): string {
    return d === 1 ? '入门' : d === 2 ? '中级' : '进阶';
}

/**
 * 为单词构造一道拆解题:
 * - target:正确切分序列(已去重)
 * - distractors:从全集随机抽 N 个不在 target 中的音素作干扰
 */
function buildQuestion(word: BreakdownWord): BreakdownQuestion | null {
    const {phonemes, complete} = breakdownPhonetic(word.phonetic);
    if (!complete || phonemes.length === 0) return null;
    const targetIpas = new Set(phonemes.map(p => p.ipa));
    const distractorPool = ALL_PHONEMES.filter(p => !targetIpas.has(p.ipa));
    // 干扰数量 = max(2, ceil(target/2)),保证总池子不会太大也不会太空
    const distractorCount = Math.max(2, Math.ceil(phonemes.length / 2));
    const distractors = shuffle(distractorPool).slice(0, distractorCount);
    return {word, target: phonemes, distractors};
}

function generateQuestions() {
    // 取所有可拆解的词,按难度均匀打散
    const built = shuffle(BREAKDOWN_WORDS)
        .map(buildQuestion)
        .filter((q): q is BreakdownQuestion => q !== null)
        .slice(0, TOTAL);
    questions.value = built;
}

function setupQuiz() {
    if (!currentQ.value) return;
    const q = currentQ.value;
    slots.value = q.target.map<Slot>(() => ({filled: false, ipa: '', fromPoolId: -1}));
    slotCorrect.value = [];
    // 池子 = target 音素 + distractors,打散
    let nextId = 0;
    const allItems: PoolItem[] = [
        ...q.target.map(ph => ({id: nextId++, ipa: ph.ipa, phoneme: ph, used: false})),
        ...q.distractors.map(ph => ({id: nextId++, ipa: ph.ipa, phoneme: ph, used: false})),
    ];
    pool.value = shuffle(allItems);
    answered.value = false;
    shaking.value = false;
}

async function startSession() {
    await phoneticStore.ensureLoaded();
    generateQuestions();
    currentIndex.value = 0;
    correctCount.value = 0;
    wrongCount.value = 0;
    finished.value = false;
    setupQuiz();
    setTimeout(speakTarget, 300);
}

function onPoolClick(item: PoolItem) {
    if (answered.value || item.used) return;
    const idx = currentSlotIndex.value;
    if (idx === -1) return; // 全填满了
    slots.value[idx] = {filled: true, ipa: item.ipa, fromPoolId: item.id};
    item.used = true;
}

/** 点已填的槽位 = 取回到池子 */
function onSlotClick(idx: number) {
    if (answered.value) return;
    const slot = slots.value[idx];
    if (!slot.filled) return;
    const poolItem = pool.value.find(p => p.id === slot.fromPoolId);
    if (poolItem) poolItem.used = false;
    slots.value[idx] = {filled: false, ipa: '', fromPoolId: -1};
}

function resetSlots() {
    if (answered.value) return;
    for (const s of slots.value) {
        if (s.filled) {
            const poolItem = pool.value.find(p => p.id === s.fromPoolId);
            if (poolItem) poolItem.used = false;
        }
    }
    slots.value = slots.value.map(() => ({filled: false, ipa: '', fromPoolId: -1}));
}

function checkAnswer() {
    if (!currentQ.value || !allFilled.value) return;
    const target = currentQ.value.target;
    const correctness: boolean[] = slots.value.map((s, i) => s.ipa === target[i].ipa);
    slotCorrect.value = correctness;
    answered.value = true;

    const allRight = correctness.every(Boolean);
    if (allRight) {
        correctCount.value++;
    } else {
        wrongCount.value++;
        shaking.value = true;
        setTimeout(() => (shaking.value = false), 400);
        // 答错时播一遍正确发音
        speakTarget();
    }

    // 给每个涉及到的音素都记一次进度(对了 +1,错了 -1)
    target.forEach((ph, i) => {
        phoneticStore.markPhoneme(ph.ipa, correctness[i]);
    });
}

function nextQuestion() {
    if (currentIndex.value + 1 >= TOTAL) {
        finished.value = true;
        return;
    }
    currentIndex.value++;
    setupQuiz();
    setTimeout(speakTarget, 250);
}

function speakTarget() {
    if (currentQ.value) speak(currentQ.value.word.word);
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
.phoneme-breakdown {
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
  padding: 24px 20px;
  overflow-y: auto;
}

.target-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 18px;
}

.word-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 24px;
  background: var(--utools-bg-secondary, #fff);
  border: 2px solid var(--utools-border-primary, #e4e7ed);
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.15s;

  &:hover {
    border-color: var(--utools-primary, #409eff);
  }

  .word-text {
    font-size: 32px;
    font-weight: 600;
    color: var(--utools-text-primary, #303133);
    letter-spacing: 1px;
  }

  .speaker {
    color: var(--utools-primary, #409eff);
  }
}

.quiz-prompt {
  font-size: 13px;
  color: var(--utools-text-tertiary, #909399);
  margin-bottom: 14px;
}

.slots {
  display: flex;
  gap: 10px;
  margin-bottom: 28px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 4px;

  &.shake {
    animation: shake 0.4s ease;
  }
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  20% { transform: translateX(-6px); }
  40% { transform: translateX(6px); }
  60% { transform: translateX(-4px); }
  80% { transform: translateX(4px); }
}

.slot {
  min-width: 64px;
  height: 56px;
  padding: 0 12px;
  border: 2px dashed var(--utools-border-primary, #c0c4cc);
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--utools-bg-secondary, #fff);
  cursor: pointer;
  transition: all 0.15s;

  &.filled {
    border-style: solid;
    border-color: var(--utools-primary, #409eff);

    &:hover {
      background: #fef2f2;
      border-color: #f56c6c;
    }
  }

  &.current {
    border-color: var(--utools-primary, #409eff);
    box-shadow: 0 0 0 3px rgba(64, 158, 255, 0.18);
  }

  &.correct {
    border-color: #67c23a !important;
    background: #f0f9eb;
  }

  &.wrong {
    border-color: #f56c6c !important;
    background: #fef0f0;
  }

  .slot-ipa {
    font-size: 18px;
    font-weight: 600;
    color: var(--utools-text-primary, #303133);
    font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  }

  .slot-placeholder {
    color: var(--utools-text-tertiary, #c0c4cc);
    font-size: 22px;
  }
}

.pool {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: center;
  margin-bottom: 24px;
  max-width: 520px;
}

.pool-item {
  padding: 10px 16px;
  background: var(--utools-bg-secondary, #fff);
  border: 1px solid var(--utools-border-primary, #e4e7ed);
  border-radius: 8px;
  cursor: pointer;
  font-size: 17px;
  font-weight: 500;
  color: var(--utools-text-primary, #303133);
  font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  transition: all 0.15s;
  user-select: none;

  &:hover:not(.used) {
    border-color: var(--utools-primary, #409eff);
    transform: translateY(-2px);
    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.06);
  }

  &.used {
    opacity: 0.3;
    cursor: default;
    pointer-events: none;
  }
}

.actions {
  display: flex;
  gap: 12px;
  margin-bottom: 12px;
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
  }

  .explain-label {
    font-size: 12px;
    color: var(--utools-text-tertiary, #909399);
    width: 36px;
    flex-shrink: 0;
  }

  .explain-ipa {
    font-size: 18px;
    font-weight: 600;
    color: var(--utools-text-primary, #303133);
    font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
  }

  .explain-decomp {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .decomp-chip {
    padding: 3px 8px;
    background: #f0f9eb;
    border: 1px solid #b3e19d;
    border-radius: 6px;
    font-size: 13px;
    font-family: "Charis SIL", "Doulos SIL", "Times New Roman", serif;
    color: #5daf34;

    &.wrongChip {
      background: #fef0f0;
      border-color: #fbc4c4;
      color: #f56c6c;
    }
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
