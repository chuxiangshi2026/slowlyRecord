<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="选择题练习"
    width="750px"
    destroy-on-close
    class="choice-questions-dialog"
  >
    <div v-if="article" class="choice-container">
      <!-- 工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="article-title">{{ article.title }}</span>
        </div>
        <div class="toolbar-right">
          <el-form :inline="true" size="small">
            <el-form-item label="题目数量">
              <el-input-number
                v-model="questionCount"
                :min="3"
                :max="20"
                size="small"
              />
            </el-form-item>
            <el-form-item label="题型">
              <el-select v-model="selectedTypes" multiple collapse-tags style="width: 150px">
                <el-option
                  v-for="opt in typeOptions"
                  :key="opt.value"
                  :label="opt.label"
                  :value="opt.value"
                  :disabled="!isZhArticle && ZH_ONLY_TYPES.includes(opt.value)"
                />
              </el-select>
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="generateNewQuestions">
                <el-icon><Refresh /></el-icon>
                重新生成
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <!-- 进度条 -->
      <div v-if="questions.length > 0" class="progress-bar">
        <el-progress
          :percentage="progressPercentage"
          :format="progressFormat"
          :status="progressStatus"
        />
      </div>

      <!-- 题目列表 -->
      <div class="questions-area" v-loading="generating">
        <div v-if="questions.length > 0" class="questions-list">
          <div
            v-for="(question, index) in questions"
            :key="question._id"
            class="question-item"
            :class="{
              'is-answered': question.answered,
              'is-correct': question.answered && question.userAnswerIndex === question.correctIndex,
              'is-wrong': question.answered && question.userAnswerIndex !== question.correctIndex
            }"
          >
            <div class="question-header">
              <span class="question-number">{{ index + 1 }}.</span>
              <el-tag size="small" :type="getTypeTagType(question.type)">
                {{ getTypeLabel(question.type) }}
              </el-tag>
            </div>
            
            <div class="question-content">{{ question.question }}</div>
            
            <div v-if="question.originalText" class="original-text">
              原文：{{ question.originalText }}
            </div>
            
            <div class="options-list" :class="{ 'semantic-options': isSemanticQuestion(question.type) }">
              <div
                v-for="(option, optIndex) in question.options"
                :key="optIndex"
                class="option-item"
                :class="{
                  'is-selected': question.userAnswerIndex === optIndex,
                  'is-correct-answer': question.answered && optIndex === question.correctIndex,
                  'is-wrong-answer': question.answered && question.userAnswerIndex === optIndex && optIndex !== question.correctIndex
                }"
                @click="selectAnswer(question, optIndex)"
              >
                <!-- 普通题型显示 ABC -->
                <template v-if="!isSemanticQuestion(question.type)">
                  <span class="option-label">{{ option.label }}.</span>
                  <span class="option-content">{{ option.content }}</span>
                </template>
                <!-- 语义题型直接显示词语 -->
                <template v-else>
                  <span class="semantic-option-content">{{ option.content }}</span>
                </template>
                <el-icon v-if="question.answered && optIndex === question.correctIndex" class="correct-icon">
                  <Check />
                </el-icon>
                <el-icon v-if="question.answered && question.userAnswerIndex === optIndex && optIndex !== question.correctIndex" class="wrong-icon">
                  <Close />
                </el-icon>
              </div>
            </div>
            
            <div v-if="question.answered && question.explanation" class="explanation">
              <el-alert
                :title="question.explanation"
                :type="question.userAnswerIndex === question.correctIndex ? 'success' : 'error'"
                :closable="false"
                show-icon
              />
            </div>
          </div>
        </div>
        <el-empty v-else description="点击「重新生成」开始练习" />
      </div>

      <!-- 统计和操作 -->
      <div v-if="questions.length > 0" class="footer-area">
        <div class="stats">
          <el-tag type="info">共 {{ questions.length }} 题</el-tag>
          <el-tag type="success">正确 {{ correctCount }} 题</el-tag>
          <el-tag type="danger">错误 {{ wrongCount }} 题</el-tag>
          <el-tag type="primary">正确率 {{ accuracy }}%</el-tag>
        </div>
        
        <div class="actions">
          <el-button @click="resetQuestions">重置</el-button>
          <el-button type="primary" @click="submitAnswers">提交答案</el-button>
          <el-button type="success" @click="saveProgress">保存进度</el-button>
          <el-button type="warning" @click="loadProgress" :disabled="!hasSavedProgress">恢复进度</el-button>
        </div>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTextMemoryStore } from '@/stores/textMemory';
import type { TextArticle, ChoiceQuestion } from '@/types/text-memory';
import { ElMessage } from 'element-plus';
import { Refresh, Check, Close } from '@element-plus/icons-vue';
import { getArticleLanguage } from '@/utils/text-memory-util';

// 中文专属题型（依赖中文近反义词库/错别字），非中文文章禁用
const ZH_ONLY_TYPES = ['synonym', 'antonym', 'typo'];

// 题型下拉选项
const typeOptions = [
  { label: '近义词', value: 'synonym' },
  { label: '反义词', value: 'antonym' },
  { label: '错别字', value: 'typo' },
  { label: '无厘头', value: 'nonsense' },
];

interface Props {
  modelValue: boolean;
  article: TextArticle | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const textStore = useTextMemoryStore();

// 文章语言（缺省视为中文）
const isZhArticle = computed(() => getArticleLanguage(props.article) === 'zh');

// 非中文文章默认只保留语言无关题型
const defaultSelectedTypes = computed(() =>
  isZhArticle.value ? ['synonym', 'antonym', 'typo', 'nonsense'] : ['nonsense']
);

// 练习设置
const questionCount = ref(5);
const selectedTypes = ref<string[]>(['synonym', 'antonym', 'typo', 'nonsense']);
const generating = ref(false);

// 题目列表
const questions = ref<ChoiceQuestion[]>([]);

// 统计
const correctCount = computed(() => 
  questions.value.filter(q => q.answered && q.userAnswerIndex === q.correctIndex).length
);
const wrongCount = computed(() => 
  questions.value.filter(q => q.answered && q.userAnswerIndex !== q.correctIndex).length
);
const accuracy = computed(() => {
  const answered = questions.value.filter(q => q.answered).length;
  return answered > 0 ? Math.round((correctCount.value / answered) * 100) : 0;
});
const progressPercentage = computed(() => {
  const answered = questions.value.filter(q => q.answered).length;
  return questions.value.length > 0 ? Math.round((answered / questions.value.length) * 100) : 0;
});
const progressStatus = computed(() => {
  if (accuracy.value >= 80) return 'success';
  if (accuracy.value >= 60) return '';
  return 'exception';
});

// 监听文章变化
watch(() => props.article, (newArticle) => {
  if (newArticle) {
    // 尝试加载上次的进度
    const savedProgress = textStore.getLearningProgress(newArticle._id, 'choice');
    if (savedProgress?.progress?.questions) {
      questionCount.value = savedProgress.progress.questionCount || 5;
      selectedTypes.value = sanitizeSelectedTypes(savedProgress.progress.selectedTypes);
      questions.value = savedProgress.progress.questions;
      ElMessage.info('已恢复上次的练习进度');
    } else {
      selectedTypes.value = [...defaultSelectedTypes.value];
      generateNewQuestions();
    }
  }
}, { immediate: true });

// 按文章语言过滤题型：非中文文章剔除中文专属题型，空则回退无厘头
function sanitizeSelectedTypes(types?: string[]): string[] {
  const source = types?.length ? types : defaultSelectedTypes.value;
  const filtered = source.filter(t => isZhArticle.value || !ZH_ONLY_TYPES.includes(t));
  return filtered.length > 0 ? filtered : ['nonsense'];
}

// 是否有保存的进度
const hasSavedProgress = computed(() => {
  if (!props.article) return false;
  const progress = textStore.getLearningProgress(props.article._id, 'choice');
  return !!progress?.progress?.questions?.length;
});

// 生成新题目
function generateNewQuestions() {
  if (!props.article) return;
  
  generating.value = true;
  
  setTimeout(() => {
    // 使用 store 中的方法生成题目
    const generatedQuestions = textStore.generateChoiceQuestions(
      props.article!._id,
      props.article!.content,
      questionCount.value
    );
    
    // 过滤题型（非中文文章再兜底剔除中文专属题型）
    const allowedTypes = selectedTypes.value.filter(t => isZhArticle.value || !ZH_ONLY_TYPES.includes(t));
    if (allowedTypes.length > 0) {
      questions.value = generatedQuestions.filter(q =>
        allowedTypes.includes(q.type)
      );
    } else {
      questions.value = generatedQuestions;
    }
    
    generating.value = false;
  }, 100);
}

// 选择答案
function selectAnswer(question: ChoiceQuestion, index: number) {
  if (question.answered) return; // 已答题的不允许修改
  question.userAnswerIndex = index;
}

// 提交答案
function submitAnswers() {
  let unanswered = 0;
  let correct = 0;
  
  questions.value.forEach(question => {
    if (question.userAnswerIndex === undefined) {
      unanswered++;
    } else {
      question.answered = true;
      if (question.userAnswerIndex === question.correctIndex) {
        correct++;
      }
    }
  });
  
  if (unanswered > 0) {
    ElMessage.warning(`还有 ${unanswered} 道题未作答`);
  } else {
    if (correct === questions.value.length) {
      ElMessage.success('恭喜！全部正确！');
      // 更新复习次数
      if (props.article) {
        textStore.updateReviewCount(props.article._id);
      }
    } else {
      ElMessage.info(`答对 ${correct}/${questions.value.length} 题`);
    }
  }
}

// 重置题目
function resetQuestions() {
  questions.value.forEach(question => {
    question.answered = false;
    question.userAnswerIndex = undefined;
  });
  ElMessage.info('已重置所有答案');
}

// 保存进度
async function saveProgress() {
  if (!props.article) return;
  
  const progress = {
    questionCount: questionCount.value,
    selectedTypes: selectedTypes.value,
    questions: questions.value
  };
  
  const success = await textStore.saveLearningProgress(
    props.article._id,
    'choice',
    progress
  );
  
  if (success) {
    ElMessage.success('进度已保存');
  } else {
    ElMessage.error('保存进度失败');
  }
}

// 加载进度
function loadProgress() {
  if (!props.article) return;
  
  const savedProgress = textStore.getLearningProgress(props.article._id, 'choice');
  if (savedProgress?.progress?.questions) {
    questionCount.value = savedProgress.progress.questionCount || 5;
    selectedTypes.value = sanitizeSelectedTypes(savedProgress.progress.selectedTypes);
    questions.value = savedProgress.progress.questions;
    ElMessage.success('进度已恢复');
  } else {
    ElMessage.warning('没有找到保存的进度');
  }
}

// 获取题型标签
function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    synonym: '近义词',
    antonym: '反义词',
    typo: '错别字',
    nonsense: '无厘头',
    judgment: '判断题'
  };
  return labels[type] || type;
}

// 获取题型标签样式
function getTypeTagType(type: string): any {
  const types: Record<string, any> = {
    synonym: 'success',
    antonym: 'warning',
    typo: 'danger',
    nonsense: 'info',
    judgment: 'primary'
  };
  return types[type] || 'info';
}

// 进度格式化
function progressFormat(percentage: number): string {
  const answered = questions.value.filter(q => q.answered).length;
  return `${answered}/${questions.value.length}`;
}

// 判断是否是语义类题目（近义词/反义词）
function isSemanticQuestion(type: string): boolean {
  return type === 'synonym' || type === 'antonym';
}
</script>

<style scoped lang="scss">
.choice-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  
  .article-title {
    font-weight: 600;
    color: var(--utools-text-primary);
  }
}

.progress-bar {
  padding: 0 12px;
}

.questions-area {
  max-height: 450px;
  overflow-y: auto;
  padding: 0 8px;
}

.questions-list {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.question-item {
  padding: 16px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.3s;
  
  &.is-answered.is-correct {
    border-color: #67c23a;
    background: #f0f9eb;
  }
  
  &.is-answered.is-wrong {
    border-color: #f56c6c;
    background: #fef0f0;
  }
}

.question-header {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}

.question-number {
  font-weight: 600;
  font-size: 16px;
  color: var(--utools-text-primary);
}

.question-content {
  font-size: 15px;
  line-height: 1.6;
  color: var(--utools-text-primary);
  margin-bottom: 10px;
}

.original-text {
  font-size: 13px;
  color: var(--utools-text-secondary);
  margin-bottom: 12px;
  padding: 8px;
  background: var(--utools-bg-primary);
  border-radius: 4px;
  border-left: 3px solid var(--utools-primary);
}

.options-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.option-item {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: var(--utools-bg-primary);
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
  
  &:hover {
    background: var(--utools-bg-hover);
  }
  
  &.is-selected {
    border-color: var(--utools-primary);
    background: var(--utools-bg-active);
  }

  &.is-correct-answer {
    border-color: #67c23a;
    background: #f0f9eb;
  }
  
  &.is-wrong-answer {
    border-color: #f56c6c;
    background: #fef0f0;
  }
}

.option-label {
  font-weight: 600;
  margin-right: 8px;
  color: var(--utools-text-secondary);
  min-width: 24px;
}

.option-content {
  flex: 1;
  color: var(--utools-text-primary);
}

// 语义选项样式（近义词/反义词）
.options-list.semantic-options {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;

  .option-item {
    justify-content: center;
    padding: 14px 16px;
    font-size: 15px;
    font-weight: 500;

    .semantic-option-content {
      flex: 1;
      text-align: center;
      color: var(--utools-text-primary);
    }

    &:hover {
      background: var(--utools-bg-hover);
      transform: translateY(-1px);
    }

    &.is-selected {
      border-color: var(--utools-primary);
      background: var(--utools-bg-active);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }

    &.is-correct-answer {
      border-color: #67c23a;
      background: #f0f9eb;
      color: #67c23a;
    }

    &.is-wrong-answer {
      border-color: #f56c6c;
      background: #fef0f0;
      color: #f56c6c;
    }
  }
}

.correct-icon {
  color: #67c23a;
  font-size: 18px;
}

.wrong-icon {
  color: #f56c6c;
  font-size: 18px;
}

.explanation {
  margin-top: 12px;
}

.footer-area {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  
  .stats {
    display: flex;
    gap: 10px;
    flex-wrap: wrap;
  }
  
  .actions {
    display: flex;
    gap: 10px;
  }
}
</style>
