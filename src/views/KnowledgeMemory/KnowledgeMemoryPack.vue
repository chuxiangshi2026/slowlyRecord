<template>
  <div class="knowledge-pack-page">
    <!-- 顶部：返回 + 标题 + 预留按钮 -->
    <div class="pack-header">
      <div class="left">
        <el-button text @click="goBack" :icon="ArrowLeft" size="large">返回</el-button>
      </div>
      <div class="center">
        <h2>{{ pack?.name || '知识包练习' }}</h2>
        <span v-if="pack" class="subtitle">{{ pack.items.length }} 条 · 已掌握 {{ masteredCount }}</span>
      </div>
      <div class="right">
        <el-tooltip effect="dark" content="打印完整表 / 填空自测表（后续实现）" placement="bottom">
          <el-button text :icon="Printer" disabled>打印</el-button>
        </el-tooltip>
        <el-tooltip effect="dark" content="保存图片（后续实现）" placement="bottom">
          <el-button text :icon="Picture" disabled>存图</el-button>
        </el-tooltip>
      </div>
    </div>

    <!-- 主体 -->
    <div v-if="!pack" class="pack-empty" v-loading="store.loading">
      <el-empty description="知识包加载中或不存在" />
    </div>

    <template v-else>
      <!-- 进度统计 -->
      <div class="progress-row">
        <div class="progress-stat">
          <div class="stat-num">{{ masteredCount }}<span class="stat-total">/{{ totalCount }}</span></div>
          <div class="stat-label">已掌握</div>
        </div>
        <div class="progress-stat">
          <div class="stat-num" :class="{ active: dueCount > 0 }">{{ dueCount }}</div>
          <div class="stat-label">待复习</div>
        </div>
        <div class="progress-stat">
          <div class="stat-num">{{ currentIndex + 1 }}<span class="stat-total">/{{ sessionItems.length }}</span></div>
          <div class="stat-label">当前进度</div>
        </div>
      </div>

      <!-- 模式选择 -->
      <div class="mode-chips">
        <span
          v-for="m in availableModes"
          :key="m.key"
          :class="['mode-chip', { on: currentMode === m.key }]"
          @click="switchMode(m.key)"
        >{{ m.label }}</span>
      </div>

      <!-- 练习卡片 -->
      <div class="practice-area">
        <!-- 已完成 -->
        <div v-if="sessionFinished" class="session-summary">
          <el-result
            :icon="summaryCorrect >= summaryWrong ? 'success' : 'warning'"
            :title="`本轮完成 ${sessionItems.length} 题`"
            :sub-title="`正确 ${summaryCorrect} · 错误 ${summaryWrong}`"
          />
          <div class="summary-actions">
            <el-button type="primary" @click="restartSession">再来一轮</el-button>
            <el-button @click="goBack">返回列表</el-button>
          </div>
        </div>

        <template v-else-if="currentItem">
          <!-- Q→A / A→Q 翻卡 -->
          <div v-if="currentMode === 'q2a' || currentMode === 'a2q'" class="flip-card">
            <div class="prompt-label">{{ currentMode === 'q2a' ? '问题' : '答案' }}</div>
            <div class="prompt-main">{{ currentMode === 'q2a' ? currentItem.question : currentItem.answer }}</div>

            <div v-if="showAnswer" class="answer-section">
              <div class="answer-label">{{ currentMode === 'q2a' ? '答案' : '问题' }}</div>
              <div class="answer-main">{{ currentMode === 'q2a' ? currentItem.answer : currentItem.question }}</div>
              <div v-if="currentItem.extras && Object.keys(currentItem.extras).length" class="extras-row">
                <el-tag v-for="(value, key) in currentItem.extras" :key="key" size="small" type="info">{{ key }}: {{ value }}</el-tag>
              </div>

              <div class="self-assess">
                <el-button type="success" :icon="CircleCheck" @click="handleSelfAssess(true)">记住了</el-button>
                <el-button type="danger" :icon="CircleClose" @click="handleSelfAssess(false)">没记住</el-button>
              </div>
            </div>

            <div v-else class="flip-actions">
              <el-button type="primary" :icon="View" @click="showAnswer = true">显示答案</el-button>
            </div>
          </div>

          <!-- 四选一 -->
          <div v-else-if="currentMode === 'choice'" class="choice-card">
            <div class="prompt-label">问题</div>
            <div class="prompt-main">{{ currentItem.question }}</div>
            <div v-if="currentItem.extras && Object.keys(currentItem.extras).length" class="extras-row">
              <el-tag v-for="(value, key) in currentItem.extras" :key="key" size="small" type="info">{{ key }}: {{ value }}</el-tag>
            </div>
            <div class="options-grid">
              <el-button
                v-for="(opt, idx) in options"
                :key="idx"
                :class="['option-btn', { correct: feedback.show && isCorrectOption(opt), wrong: feedback.show && selectedOption === opt && !feedback.correct }]"
                :disabled="feedback.show"
                @click="handleChoice(opt)"
              >{{ opt }}</el-button>
            </div>
          </div>

          <!-- 顺序回忆 -->
          <div v-else-if="currentMode === 'ordered'" class="input-card">
            <div class="prompt-label">
              顺序回忆
              <template v-if="currentItem.order"> · 第 {{ currentItem.order }} 项</template>
            </div>
            <div v-if="previousItem" class="ordered-prompt">
              前一项是 <strong>{{ previousItem.question }}</strong>，下一项是？
            </div>
            <div v-else class="ordered-prompt">
              这是第一项，请回答：
            </div>
            <div class="prompt-main">{{ currentItem.question }}</div>

            <el-input
              v-model="inputAnswer"
              class="answer-input"
              placeholder="输入下一项的答案..."
              clearable
              @keyup.enter="handleInputSubmit"
            />
            <el-button type="primary" :disabled="!inputAnswer.trim() || feedback.show" @click="handleInputSubmit">提交</el-button>
          </div>

          <!-- 输入模式 -->
          <div v-else-if="currentMode === 'input'" class="input-card">
            <div class="prompt-label">问题</div>
            <div class="prompt-main">{{ currentItem.question }}</div>
            <div v-if="currentItem.extras && Object.keys(currentItem.extras).length" class="extras-row">
              <el-tag v-for="(value, key) in currentItem.extras" :key="key" size="small" type="info">{{ key }}: {{ value }}</el-tag>
            </div>
            <el-input
              v-model="inputAnswer"
              class="answer-input"
              placeholder="输入答案..."
              clearable
              @keyup.enter="handleInputSubmit"
            />
            <el-button type="primary" :disabled="!inputAnswer.trim() || feedback.show" @click="handleInputSubmit">提交</el-button>
          </div>

          <!-- 反馈条 -->
          <div v-if="feedback.show" class="feedback-bar" :class="feedback.correct ? 'is-correct' : 'is-wrong'">
            <el-icon :size="18"><component :is="feedback.correct ? CircleCheck : CircleClose" /></el-icon>
            <span>{{ feedback.message }}</span>
          </div>
        </template>
      </div>
    </template>

    <!-- 底部工具栏 -->
    <div v-if="pack" class="home_footer">
      <div>
        <span class="footer-stat" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </span>
        <el-divider direction="vertical" />
        <span class="footer-stat">{{ pack.name }}</span>
      </div>
      <div>
        <el-tooltip effect="dark" content="重置本包进度" placement="top" popper-class="small-tooltip">
          <el-icon :size="20" class="footer-icon" @click="handleResetProgress"><RefreshRight /></el-icon>
        </el-tooltip>
        <el-tooltip effect="dark" content="重新开始" placement="top" popper-class="small-tooltip">
          <el-icon :size="20" class="footer-icon" @click="restartSession"><RefreshRight /></el-icon>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  ArrowLeft,
  Printer,
  Picture,
  View,
  CircleCheck,
  CircleClose,
  RefreshRight,
} from '@element-plus/icons-vue';
import { useKnowledgeMemoryStore } from '@/stores/knowledgeMemory';
import type {KnowledgeItem, KnowledgePracticeMode} from '@/types/knowledge-memory';

const route = useRoute();
const router = useRouter();
const store = useKnowledgeMemoryStore();

const packId = computed<string>(() => {
  const id = route.params.id;
  return Array.isArray(id) ? id[0] : id;
});

const pack = computed(() => store.getPack(packId.value));
const masteredCount = computed(() => store.getMasteredCount(packId.value));
const dueCount = computed(() => store.getDueCount(packId.value));
const totalCount = computed(() => store.getTotalCount(packId.value));

const currentMode = ref<KnowledgePracticeMode>('q2a');
const sessionItems = ref<KnowledgeItem[]>([]);
const currentIndex = ref(0);
const showAnswer = ref(false);
const options = ref<string[]>([]);
const inputAnswer = ref('');
const selectedOption = ref('');
const feedback = ref({show: false, correct: false, message: ''});
const sessionFinished = ref(false);
const summaryCorrect = ref(0);
const summaryWrong = ref(0);

const currentItem = computed<KnowledgeItem | undefined>(() => sessionItems.value[currentIndex.value]);
const previousItem = computed<KnowledgeItem | undefined>(() =>
    currentItem.value ? store.getPreviousOrderedItem(packId.value, currentItem.value) : undefined,
);

const availableModes = computed(() => {
  const base = [
    {key: 'q2a' as KnowledgePracticeMode, label: 'Q→A 翻卡'},
    {key: 'a2q' as KnowledgePracticeMode, label: 'A→Q 反向'},
    {key: 'choice' as KnowledgePracticeMode, label: '四选一'},
    {key: 'input' as KnowledgePracticeMode, label: '输入模式'},
  ];
  if (pack.value?.ordered) {
    base.push({key: 'ordered' as KnowledgePracticeMode, label: '顺序回忆'});
  }
  return base;
});

onMounted(async () => {
  if (!store.isPackLoaded(packId.value)) {
    await store.loadPack(packId.value).catch((e: unknown) => {
      ElMessage.error(e instanceof Error ? e.message : '知识包加载失败');
    });
  }
  if (pack.value) {
    startSession('q2a');
  }
});

watch(pack, (val) => {
  if (val && sessionItems.value.length === 0) {
    startSession('q2a');
  }
});

function switchMode(mode: KnowledgePracticeMode) {
  if (currentMode.value === mode) return;
  startSession(mode);
}

function startSession(mode: KnowledgePracticeMode) {
  currentMode.value = mode;
  currentIndex.value = 0;
  showAnswer.value = false;
  inputAnswer.value = '';
  selectedOption.value = '';
  feedback.value = {show: false, correct: false, message: ''};
  sessionFinished.value = false;
  summaryCorrect.value = 0;
  summaryWrong.value = 0;

  const p = pack.value;
  if (!p) return;

  if (mode === 'ordered' && p.ordered) {
    sessionItems.value = [...p.items]
      .filter(i => typeof i.order === 'number')
      .sort((a, b) => (a.order! - b.order!));
  } else {
    sessionItems.value = store.pickItemsForSession(packId.value, 10);
  }

  if (mode === 'choice') {
    generateCurrentOptions();
  }
}

function restartSession() {
  startSession(currentMode.value);
}

function generateCurrentOptions() {
  const item = currentItem.value;
  if (!item) return;
  options.value = store.generateChoices(packId.value, item, 'q2a', 4);
}

function goBack() {
  router.push('/knowledge-memory');
}

function isCorrectOption(opt: string): boolean {
  const item = currentItem.value;
  if (!item) return false;
  return opt === item.answer;
}

async function handleSelfAssess(isCorrect: boolean) {
  const item = currentItem.value;
  if (!item) return;
  await store.markItem(packId.value, item.id, isCorrect);
  if (isCorrect) summaryCorrect.value++;
  else summaryWrong.value++;
  nextItem();
}

async function handleChoice(opt: string) {
  const item = currentItem.value;
  if (!item || feedback.value.show) return;
  selectedOption.value = opt;
  const isCorrect = store.judgeAnswer(packId.value, item, opt, 'choice');
  await store.markItem(packId.value, item.id, isCorrect);
  showFeedback(isCorrect, isCorrect ? '回答正确' : `正确答案是：${item.answer}`);
  if (isCorrect) summaryCorrect.value++;
  else summaryWrong.value++;
  setTimeout(nextItem, 1200);
}

async function handleInputSubmit() {
  const item = currentItem.value;
  if (!item || feedback.value.show) return;
  const isCorrect = store.judgeAnswer(packId.value, item, inputAnswer.value, currentMode.value);
  await store.markItem(packId.value, item.id, isCorrect);
  const correctText = currentMode.value === 'ordered' && previousItem.value
    ? `${item.question}（${item.answer}）`
    : item.answer;
  showFeedback(isCorrect, isCorrect ? '回答正确' : `正确答案是：${correctText}`);
  if (isCorrect) summaryCorrect.value++;
  else summaryWrong.value++;
  setTimeout(nextItem, 1200);
}

function showFeedback(correct: boolean, message: string) {
  feedback.value = {show: true, correct, message};
}

function nextItem() {
  feedback.value = {show: false, correct: false, message: ''};
  showAnswer.value = false;
  inputAnswer.value = '';
  selectedOption.value = '';

  if (currentIndex.value >= sessionItems.value.length - 1) {
    sessionFinished.value = true;
    return;
  }
  currentIndex.value++;
  if (currentMode.value === 'choice') {
    generateCurrentOptions();
  }
}

async function handleResetProgress() {
  try {
    await ElMessageBox.confirm('确定要清空本知识包的学习进度吗？', '确认重置', {
      confirmButtonText: '重置',
      cancelButtonText: '取消',
      type: 'warning',
    });
    await store.resetPackProgress(packId.value);
    ElMessage.success('进度已重置');
    restartSession();
  } catch {
    // 取消
  }
}
</script>

<style scoped lang="scss">
.knowledge-pack-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
  padding-bottom: 55px;
  box-sizing: border-box;
}

.pack-header {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-card);

  .left, .right {
    flex: 1;
    display: flex;
    align-items: center;
  }

  .right {
    justify-content: flex-end;
    gap: 6px;
  }

  .center {
    text-align: center;
    flex: 2;
    min-width: 0;

    h2 {
      margin: 0;
      font-size: 17px;
      color: var(--utools-text-primary);
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .subtitle {
      font-size: 12px;
      color: var(--utools-text-tertiary);
    }
  }
}

.pack-empty {
  padding: 40px 0;
}

.progress-row {
  display: flex;
  gap: 12px;
  padding: 14px 16px;
}

.progress-stat {
  flex: 1;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-primary);
  border-radius: 10px;
  padding: 12px 14px;
  display: flex;
  align-items: baseline;
  gap: 8px;

  .stat-num {
    font-size: 22px;
    font-weight: 700;
    color: var(--utools-text-primary);

    &.active {
      color: var(--utools-primary);
    }
  }

  .stat-total {
    font-size: 13px;
    color: var(--utools-text-tertiary);
    font-weight: 400;
  }

  .stat-label {
    font-size: 12px;
    color: var(--utools-text-tertiary);
  }
}

.mode-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: 0 16px 14px;
}

.mode-chip {
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border-radius: 14px;
  cursor: pointer;
  border: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-card);
  color: var(--utools-text-secondary);
  font-size: 13px;
  transition: all 0.15s;

  &:hover {
    border-color: var(--utools-primary);
    color: var(--utools-primary);
  }

  &.on {
    background: var(--utools-primary);
    color: #fff;
    border-color: var(--utools-primary);
  }
}

.practice-area {
  padding: 0 16px 20px;
}

.flip-card,
.choice-card,
.input-card {
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-primary);
  border-radius: 12px;
  padding: 24px 20px;
  text-align: center;
}

.prompt-label {
  font-size: 12px;
  color: var(--utools-text-tertiary);
  margin-bottom: 10px;
  letter-spacing: 0.5px;
}

.prompt-main {
  font-size: 32px;
  font-weight: 700;
  color: var(--utools-text-primary);
  margin-bottom: 16px;
  word-break: break-all;
  line-height: 1.3;
}

.extras-row {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  margin-bottom: 20px;
}

.answer-section {
  border-top: 1px dashed var(--utools-border-divider);
  padding-top: 20px;
  margin-top: 10px;

  .answer-label {
    font-size: 12px;
    color: var(--utools-text-tertiary);
    margin-bottom: 8px;
  }

  .answer-main {
    font-size: 24px;
    font-weight: 600;
    color: var(--utools-primary);
    margin-bottom: 16px;
    word-break: break-all;
  }
}

.flip-actions,
.self-assess {
  display: flex;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
}

.options-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
  margin-top: 10px;

  .option-btn {
    height: auto;
    min-height: 44px;
    white-space: normal;
    line-height: 1.3;

    &.correct {
      background: var(--utools-success);
      color: #fff;
      border-color: var(--utools-success);
    }

    &.wrong {
      background: var(--utools-danger);
      color: #fff;
      border-color: var(--utools-danger);
    }
  }
}

.ordered-prompt {
  font-size: 14px;
  color: var(--utools-text-secondary);
  margin-bottom: 12px;

  strong {
    color: var(--utools-primary);
  }
}

.answer-input {
  max-width: 360px;
  margin: 0 auto 16px;
  display: block;
}

.feedback-bar {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  margin-top: 16px;
  padding: 10px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;

  &.is-correct {
    background: rgba(103, 194, 58, 0.12);
    color: var(--utools-success);
  }

  &.is-wrong {
    background: rgba(245, 108, 108, 0.12);
    color: var(--utools-danger);
  }
}

.session-summary {
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-primary);
  border-radius: 12px;
  padding: 24px;

  .summary-actions {
    display: flex;
    justify-content: center;
    gap: 12px;
    margin-top: 16px;
  }
}

.home_footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--utools-bg-card);
  height: 55px;
  border-top: 1px solid var(--utools-border-divider);
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--utools-text-primary);
  z-index: 20;

  > div:first-child {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  > div:last-child {
    display: flex;
    align-items: center;
    gap: 2px;
  }

  .footer-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--utools-text-secondary);
    cursor: pointer;
    transition: all 0.2s;

    &:hover {
      color: var(--utools-primary);
    }
  }

  .footer-icon {
    font-size: 20px;
    padding: 6px;
    border-radius: 6px;
    transition: all 0.2s;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: var(--utools-text-primary);

    &:hover {
      background-color: var(--utools-bg-hover);
      transform: scale(1.1);
    }
  }
}
</style>
