<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="填空练习"
    width="750px"
    destroy-on-close
    class="fill-blanks-dialog"
  >
    <div v-if="article" class="fill-blanks-container">
      <!-- 设置工具栏 -->
      <div class="toolbar">
        <div class="toolbar-left">
          <span class="article-title">{{ article.title }}</span>
          <el-tag size="small" type="info">共 {{ article.content.length }} 字</el-tag>
        </div>
        <div class="toolbar-right">
          <el-form :inline="true" size="small">
            <el-form-item label="填空数量">
              <el-input-number
                v-model="blankCount"
                :min="3"
                :max="30"
                size="small"
              />
            </el-form-item>
            <el-form-item>
              <el-button type="primary" @click="generateNewExercise">
                <el-icon><Refresh /></el-icon>
                重新生成
              </el-button>
              <el-button @click="toggleShowAnswers">
                {{ showAnswers ? '隐藏答案' : '显示答案' }}
              </el-button>
            </el-form-item>
          </el-form>
        </div>
      </div>

      <!-- 练习模式选择 -->
      <div class="mode-selector">
        <el-radio-group v-model="exerciseMode">
          <el-radio-button label="random">随机填空</el-radio-button>
          <el-radio-button label="keyword">关键词填空</el-radio-button>
          <el-radio-button label="sentence">整句填空</el-radio-button>
          <el-radio-button label="semantic">语义填空</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 填空内容区域 -->
      <div class="exercise-area" v-loading="generating">
        <div v-if="exerciseSegments.length > 0" class="exercise-content">
          <template v-for="(segment, index) in exerciseSegments" :key="index">
            <span v-if="segment.type === 'text'" class="text-segment">
              {{ segment.content }}
            </span>
            <span v-else-if="segment.type === 'blank'" class="blank-item" :class="{ 'has-options': segment.options && segment.options.length > 0 }">
              <!-- 语义填空模式：显示选项 -->
              <template v-if="segment.options && segment.options.length > 0">
                <div class="semantic-blank">
                  <div class="options-container">
                    <el-button
                      v-for="(option, optIndex) in segment.options"
                      :key="optIndex"
                      :type="getOptionButtonType(segment, option, optIndex)"
                      :class="{
                        'is-selected': segment.userAnswer === option.content,
                        'is-correct-answer': segment.isChecked && option.isCorrect,
                        'is-wrong-answer': segment.isChecked && segment.userAnswer === option.content && !option.isCorrect
                      }"
                      size="small"
                      @click="selectOption(segment, option.content)"
                      :disabled="segment.isChecked"
                    >
                      {{ option.content }}
                    </el-button>
                  </div>
                  <span v-if="showAnswers || (segment.isChecked && !segment.isCorrect)" class="answer-hint">
                    正确答案：{{ segment.answer }}
                  </span>
                </div>
              </template>
              <!-- 普通填空模式：输入框 -->
              <template v-else>
                <el-input
                  v-model="segment.userAnswer"
                  :class="{
                    'is-correct': segment.isChecked && segment.isCorrect,
                    'is-wrong': segment.isChecked && !segment.isCorrect
                  }"
                  :placeholder="getBlankPlaceholder(segment)"
                  size="small"
                  @keyup.enter="checkAnswer(segment)"
                >
                  <template #suffix>
                    <el-icon v-if="segment.isChecked && segment.isCorrect" class="status-icon correct">
                      <Check />
                    </el-icon>
                    <el-icon v-if="segment.isChecked && !segment.isCorrect" class="status-icon wrong">
                      <Close />
                    </el-icon>
                  </template>
                </el-input>
                <span v-if="showAnswers || (segment.isChecked && !segment.isCorrect)" class="answer-hint">
                  {{ segment.answer }}
                </span>
              </template>
            </span>
          </template>
        </div>
        <el-empty v-else description="点击「重新生成」开始练习" />
      </div>

      <!-- 统计信息 -->
      <div v-if="stats.total > 0" class="stats-bar">
        <el-tag type="info">共 {{ stats.total }} 个填空</el-tag>
        <el-tag type="success">已答对 {{ stats.correct }} 个</el-tag>
        <el-tag type="danger">错误 {{ stats.wrong }} 个</el-tag>
        <el-tag type="warning">未答 {{ stats.total - stats.correct - stats.wrong }} 个</el-tag>
        <el-tag type="primary">正确率 {{ stats.percentage }}%</el-tag>
      </div>

      <!-- 操作按钮 -->
      <div class="action-bar">
        <el-button type="primary" @click="checkAllAnswers" :disabled="!hasBlanks">
          检查答案
        </el-button>
        <el-button @click="resetExercise" :disabled="!hasBlanks">
          重置练习
        </el-button>
        <el-button type="success" @click="saveProgress" :disabled="!hasBlanks">
          保存进度
        </el-button>
        <el-button type="warning" @click="loadProgress" :disabled="!hasSavedProgress">
          恢复进度
        </el-button>
      </div>

      <!-- 提示区域 -->
      <div class="tips-area">
        <el-alert
          :title="exerciseMode === 'semantic' ? '语义填空提示' : '练习提示'"
          type="info"
          :closable="false"
        >
          <template v-if="exerciseMode === 'semantic'">
            <p>1. 根据上下文语境，选择正确的词语</p>
            <p>2. 点击选项后会自动检查答案</p>
          </template>
          <template v-else>
            <p>1. 在输入框中填入缺失的文字</p>
            <p>2. 按 Enter 键或点击"检查答案"验证</p>
            <p>3. 错误的答案会显示正确答案</p>
          </template>
        </el-alert>
      </div>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTextMemoryStore } from '@/stores/textMemory';
import type { TextArticle } from '@/types/text-memory';
import { ElMessage } from 'element-plus';
import { Refresh, Check, Close } from '@element-plus/icons-vue';

interface Props {
  modelValue: boolean;
  article: TextArticle | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const textStore = useTextMemoryStore();

// 练习设置
const blankCount = ref(10);
const exerciseMode = ref<'random' | 'keyword' | 'sentence' | 'semantic'>('random');
const showAnswers = ref(false);
const generating = ref(false);
const semanticType = ref<'synonym' | 'antonym'>('synonym'); // 语义填空类型

// 选项
interface BlankOption {
  content: string;
  isCorrect?: boolean;
}

// 练习段落
interface ExerciseSegment {
  type: 'text' | 'blank';
  content?: string;
  userAnswer?: string;
  answer?: string;
  isChecked?: boolean;
  isCorrect?: boolean;
  // 语义填空专用
  options?: BlankOption[];  // 选项列表
  questionType?: 'synonym' | 'antonym';  // 题目类型
  context?: string;  // 上下文提示
}

const exerciseSegments = ref<ExerciseSegment[]>([]);

// 是否有填空
const hasBlanks = computed(() => {
  return exerciseSegments.value.some(s => s.type === 'blank');
});

// 统计信息
const stats = computed(() => {
  const blanks = exerciseSegments.value.filter(s => s.type === 'blank');
  const total = blanks.length;
  const correct = blanks.filter(s => s.isCorrect).length;
  const wrong = blanks.filter(s => s.isChecked && !s.isCorrect).length;
  const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
  return { total, correct, wrong, percentage };
});

// 监听文章变化
watch(() => props.article, (newArticle) => {
  if (newArticle) {
    // 尝试加载上次的进度
    const savedProgress = textStore.getLearningProgress(newArticle._id, 'fillBlanks');
    if (savedProgress?.progress?.segments) {
      // 恢复上次的练习
      exerciseMode.value = savedProgress.progress.mode || 'random';
      blankCount.value = savedProgress.progress.blankCount || 10;
      exerciseSegments.value = savedProgress.progress.segments;
      ElMessage.info('已恢复上次的练习进度');
    } else {
      generateNewExercise();
    }
  }
}, { immediate: true });

// 是否有保存的进度
const hasSavedProgress = computed(() => {
  if (!props.article) return false;
  const progress = textStore.getLearningProgress(props.article._id, 'fillBlanks');
  return !!progress?.progress?.segments?.length;
});

// 监听模式变化
watch(exerciseMode, () => {
  generateNewExercise();
});

// 生成新的练习
function generateNewExercise() {
  if (!props.article) return;

  generating.value = true;
  showAnswers.value = false;

  setTimeout(() => {
    const content = props.article!.content;
    const segments: ExerciseSegment[] = [];

    switch (exerciseMode.value) {
      case 'random':
        generateRandomBlanks(content, segments);
        break;
      case 'keyword':
        generateKeywordBlanks(content, segments);
        break;
      case 'sentence':
        generateSentenceBlanks(content, segments);
        break;
      case 'semantic':
        generateSemanticBlanks(content, segments);
        break;
    }

    exerciseSegments.value = segments;
    generating.value = false;
  }, 100);
}

// 随机填空
function generateRandomBlanks(content: string, segments: ExerciseSegment[]) {
  // 找出所有可能的2-4字词语位置
  const allWords: { word: string; start: number; end: number; len: number }[] = [];
  
  // 提取2-4字词语（优先较长的词）
  for (let len = 4; len >= 2; len--) {
    for (let i = 0; i <= content.length - len; i++) {
      const word = content.substring(i, i + len);
      // 只取纯中文词语
      if (/^[\u4e00-\u9fa5]+$/.test(word)) {
        allWords.push({ word, start: i, end: i + len, len });
      }
    }
  }
  
  if (allWords.length === 0) {
    segments.push({ type: 'text', content });
    return;
  }
  
  // 随机打乱
  const shuffledWords = [...allWords].sort(() => Math.random() - 0.5);
  
  // 选择不重叠的填空
  const selectedWords: typeof allWords = [];
  const usedRanges: { start: number; end: number }[] = [];
  
  for (const word of shuffledWords) {
    // 检查是否与已选的关键词重叠
    const overlap = usedRanges.some(range => 
      !(word.end <= range.start || word.start >= range.end)
    );
    
    if (!overlap) {
      selectedWords.push(word);
      usedRanges.push({ start: word.start, end: word.end });
      
      if (selectedWords.length >= blankCount.value) {
        break;
      }
    }
  }
  
  if (selectedWords.length === 0) {
    segments.push({ type: 'text', content });
    return;
  }
  
  // 按位置排序
  selectedWords.sort((a, b) => a.start - b.start);
  
  // 构建段落
  let lastEnd = 0;
  selectedWords.forEach(word => {
    // 添加文本段
    if (word.start > lastEnd) {
      segments.push({
        type: 'text',
        content: content.substring(lastEnd, word.start)
      });
    }
    
    // 添加填空
    segments.push({
      type: 'blank',
      answer: word.word,
      userAnswer: '',
      isChecked: false,
      isCorrect: false
    });
    
    lastEnd = word.end;
  });
  
  // 添加剩余文本
  if (lastEnd < content.length) {
    segments.push({
      type: 'text',
      content: content.substring(lastEnd)
    });
  }
}

// 关键词填空
function generateKeywordBlanks(content: string, segments: ExerciseSegment[]) {
  // 按优先级提取关键词：4字成语 > 3字词组 > 2字词语
  const allKeywords: { word: string; start: number; end: number; priority: number }[] = [];
  
  // 提取4字成语或词组（优先级最高）
  for (let i = 0; i <= content.length - 4; i++) {
    const word = content.substring(i, i + 4);
    // 匹配4个中文字符，排除纯标点
    if (/^[\u4e00-\u9fa5]{4}$/.test(word)) {
      allKeywords.push({ word, start: i, end: i + 4, priority: 3 });
    }
  }
  
  // 提取3字词组
  for (let i = 0; i <= content.length - 3; i++) {
    const word = content.substring(i, i + 3);
    if (/^[\u4e00-\u9fa5]{3}$/.test(word)) {
      // 检查是否与已存在的4字词重叠
      const overlap4 = allKeywords.some(k => 
        k.priority === 3 && !(i + 3 <= k.start || i >= k.end)
      );
      if (!overlap4) {
        allKeywords.push({ word, start: i, end: i + 3, priority: 2 });
      }
    }
  }
  
  // 提取2字词语
  for (let i = 0; i <= content.length - 2; i++) {
    const word = content.substring(i, i + 2);
    if (/^[\u4e00-\u9fa5]{2}$/.test(word)) {
      // 检查是否与已存在的3字或4字词重叠
      const overlap = allKeywords.some(k => 
        (k.priority === 3 || k.priority === 2) && !(i + 2 <= k.start || i >= k.end)
      );
      if (!overlap) {
        allKeywords.push({ word, start: i, end: i + 2, priority: 1 });
      }
    }
  }
  
  if (allKeywords.length === 0) {
    // 回退到随机填空
    generateRandomBlanks(content, segments);
    return;
  }
  
  // 按优先级排序（高优先级在前），同优先级随机打乱
  allKeywords.sort((a, b) => {
    if (b.priority !== a.priority) {
      return b.priority - a.priority;
    }
    return Math.random() - 0.5;
  });
  
  // 选择不重叠的关键词
  const selectedKeywords: typeof allKeywords = [];
  const usedRanges: { start: number; end: number }[] = [];
  
  for (const keyword of allKeywords) {
    // 检查是否与已选的关键词重叠
    const overlap = usedRanges.some(range => 
      !(keyword.end <= range.start || keyword.start >= range.end)
    );
    
    if (!overlap) {
      selectedKeywords.push(keyword);
      usedRanges.push({ start: keyword.start, end: keyword.end });
      
      if (selectedKeywords.length >= blankCount.value) {
        break;
      }
    }
  }
  
  if (selectedKeywords.length === 0) {
    generateRandomBlanks(content, segments);
    return;
  }
  
  // 按位置排序
  selectedKeywords.sort((a, b) => a.start - b.start);
  
  // 构建段落
  let lastEnd = 0;
  selectedKeywords.forEach(keyword => {
    if (keyword.start > lastEnd) {
      segments.push({
        type: 'text',
        content: content.substring(lastEnd, keyword.start)
      });
    }
    
    segments.push({
      type: 'blank',
      answer: keyword.word,
      userAnswer: '',
      isChecked: false,
      isCorrect: false
    });
    
    lastEnd = keyword.end;
  });
  
  if (lastEnd < content.length) {
    segments.push({
      type: 'text',
      content: content.substring(lastEnd)
    });
  }
}

// 整句填空
function generateSentenceBlanks(content: string, segments: ExerciseSegment[]) {
  // 按标点分割句子（使用更精确的匹配）
  const sentences: { text: string; start: number; end: number }[] = [];
  
  // 匹配中文标点结尾的句子
  const regex = /[^。！？；.!?;\n]+[。！？；.!?;]?/g;
  let match;
  
  while ((match = regex.exec(content)) !== null) {
    const text = match[0].trim();
    if (text.length >= 5) { // 只保留长度足够的句子
      sentences.push({
        text: text,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }
  
  // 如果没有找到带标点的句子，尝试按行分割
  if (sentences.length === 0) {
    const lines = content.split('\n').filter(line => line.trim().length >= 5);
    let currentPos = 0;
    lines.forEach(line => {
      const trimmedLine = line.trim();
      const start = content.indexOf(trimmedLine, currentPos);
      if (start !== -1) {
        sentences.push({
          text: trimmedLine,
          start: start,
          end: start + trimmedLine.length
        });
        currentPos = start + trimmedLine.length;
      }
    });
  }
  
  if (sentences.length === 0) {
    segments.push({ type: 'text', content });
    return;
  }
  
  // 随机打乱句子顺序
  const shuffledSentences = [...sentences].sort(() => Math.random() - 0.5);
  
  // 选择不重叠的句子（优先选择靠前面的句子以保持原文顺序）
  const selectedSentences: typeof sentences = [];
  const usedRanges: { start: number; end: number }[] = [];
  
  // 先按原文顺序排序
  const sortedByPosition = [...shuffledSentences].sort((a, b) => a.start - b.start);
  
  for (const sentence of sortedByPosition) {
    // 检查是否与已选句子重叠（句子不应该重叠，但以防万一）
    const overlap = usedRanges.some(range => 
      !(sentence.end <= range.start || sentence.start >= range.end)
    );
    
    if (!overlap) {
      selectedSentences.push(sentence);
      usedRanges.push({ start: sentence.start, end: sentence.end });
      
      if (selectedSentences.length >= blankCount.value) {
        break;
      }
    }
  }
  
  if (selectedSentences.length === 0) {
    segments.push({ type: 'text', content });
    return;
  }
  
  // 按位置排序以重建原文顺序
  selectedSentences.sort((a, b) => a.start - b.start);
  
  // 构建段落
  let lastEnd = 0;
  selectedSentences.forEach(sentence => {
    if (sentence.start > lastEnd) {
      segments.push({
        type: 'text',
        content: content.substring(lastEnd, sentence.start)
      });
    }
    
    segments.push({
      type: 'blank',
      answer: sentence.text,
      userAnswer: '',
      isChecked: false,
      isCorrect: false
    });
    
    lastEnd = sentence.end;
  });
  
  if (lastEnd < content.length) {
    segments.push({
      type: 'text',
      content: content.substring(lastEnd)
    });
  }
}

// 获取填空占位符
function getBlankPlaceholder(segment: ExerciseSegment): string {
  if (!segment.answer) return '';
  return '□'.repeat(segment.answer.length);
}

// ========== 语义填空逻辑 ==========

// 语义关联词库（可扩展）
const semanticWordBank: Record<string, { synonym: string[]; antonym: string[] }> = {
  // 形容词
  '美丽': { synonym: ['漂亮', '秀丽', '优美', '动人'], antonym: ['丑陋', '难看', '丑恶'] },
  '高兴': { synonym: ['快乐', '开心', '愉快', '欢喜'], antonym: ['悲伤', '难过', '伤心', '沮丧'] },
  '快速': { synonym: ['迅速', '飞快', '敏捷', '急速'], antonym: ['缓慢', '迟缓', '慢慢', '徐缓'] },
  '巨大': { synonym: ['庞大', '宏大', '硕大', '雄伟'], antonym: ['微小', '渺小', '细小', '娇小'] },
  '聪明': { synonym: ['聪慧', '智慧', '聪颖', '机智'], antonym: ['愚蠢', '笨拙', '愚笨', '迟钝'] },
  '温暖': { synonym: ['暖和', '温馨', '和煦', '温热'], antonym: ['寒冷', '冰冷', '凉爽', '严寒'] },
  '明亮': { synonym: ['光亮', '光明', '灿烂', '辉煌'], antonym: ['黑暗', '昏暗', '阴暗', '暗淡'] },
  '安静': { synonym: ['宁静', '寂静', '静谧', '平静'], antonym: ['喧闹', '吵闹', '嘈杂', '喧嚣'] },
  '喜欢': { synonym: ['喜爱', '钟爱', '爱好', '倾心'], antonym: ['讨厌', '厌恶', '憎恨', '反感'] },
  '认真': { synonym: ['仔细', '用心', '专注', '严谨'], antonym: ['马虎', '草率', '敷衍', '粗心'] },
  '简单': { synonym: ['容易', '简易', '浅显', '简明'], antonym: ['复杂', '困难', '繁琐', '艰难'] },
  '丰富': { synonym: ['丰盛', '充裕', '多彩', '富饶'], antonym: ['贫乏', '单调', '匮乏', '稀缺'] },
  // 动词
  '开始': { synonym: ['开端', '启动', '起始', '着手'], antonym: ['结束', '停止', '终结', '完毕'] },
  '增加': { synonym: ['增长', '增添', '增多', '加强'], antonym: ['减少', '降低', '减弱', '削减'] },
  '成功': { synonym: ['胜利', '达成', '成就', '获胜'], antonym: ['失败', '挫折', '落败', '失手'] },
  '支持': { synonym: ['赞同', '拥护', '赞成', '支撑'], antonym: ['反对', '抵制', '反驳', '抗拒'] },
  '相信': { synonym: ['信任', '信赖', '信服', '笃信'], antonym: ['怀疑', '猜疑', '质疑', '不信'] },
  '前进': { synonym: ['前行', '推进', '迈进', '进步'], antonym: ['后退', '退缩', '倒退', '撤退'] },
  // 名词
  '朋友': { synonym: ['友人', '伙伴', '知己', '好友'], antonym: ['敌人', '仇人', '对手', '敌手'] },
  '幸福': { synonym: ['快乐', '美满', '甜蜜', '幸运'], antonym: ['痛苦', '不幸', '悲惨', '苦难'] },
  '优点': { synonym: ['长处', '优势', '亮点', '特长'], antonym: ['缺点', '短处', '劣势', '缺陷'] },
  '天堂': { synonym: ['天国', '仙境', '乐园'], antonym: ['地狱', '深渊', '苦海'] }
};

// 根据上下文智能生成近义词选项
function generateSynonymOptionsByContext(keyword: string, context: string): string[] {
  const wordData = semanticWordBank[keyword];
  const options: string[] = [keyword]; // 正确答案

  if (wordData && wordData.synonym.length > 0) {
    // 使用词库中的近义词
    const synonyms = wordData.synonym.slice(0, 3);
    options.push(...synonyms);
  } else {
    // 如果没有词库，从上下文中找相似长度的词作为干扰项
    const contextWords = extractContextWords(context, keyword.length);
    options.push(...contextWords.slice(0, 3));
  }

  // 确保有4个选项
  while (options.length < 4) {
    options.push(generateSimilarWord(keyword, options));
  }

  return shuffleArray(options);
}

// 根据上下文智能生成反义词选项
function generateAntonymOptionsByContext(keyword: string, context: string): string[] {
  const wordData = semanticWordBank[keyword];
  const options: string[] = [];

  if (wordData && wordData.antonym.length > 0) {
    // 使用词库中的反义词作为正确答案
    options.push(wordData.antonym[0]);
    // 添加一些近义词作为干扰
    if (wordData.synonym.length > 0) {
      options.push(...wordData.synonym.slice(0, 2));
    }
  } else {
    // 如果没有词库，随机生成
    options.push('不' + keyword);
    options.push(keyword);
  }

  // 确保有4个选项
  while (options.length < 4) {
    options.push(generateSimilarWord(keyword, options));
  }

  return shuffleArray(options);
}

// 从上下文中提取相似长度的词
function extractContextWords(context: string, targetLength: number): string[] {
  const words: string[] = [];
  for (let len = targetLength; len <= targetLength + 1; len++) {
    for (let i = 0; i <= context.length - len; i++) {
      const word = context.substring(i, i + len);
      if (/^[\u4e00-\u9fa5]+$/.test(word) && !words.includes(word)) {
        words.push(word);
      }
    }
  }
  return words.sort(() => Math.random() - 0.5);
}

// 生成相似词（作为干扰项）
function generateSimilarWord(keyword: string, existingOptions: string[]): string {
  // 简单的干扰项生成
  const prefixes = ['新', '大', '小', '真', '假', '美', '好', '初', '老'];
  const suffixes = ['化', '性', '度', '力', '感', '者', '家', '人', '物'];

  let newWord = keyword;
  if (keyword.length === 2) {
    const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
    newWord = prefix + keyword[1];
  } else if (keyword.length >= 3) {
    const suffix = suffixes[Math.floor(Math.random() * suffixes.length)];
    newWord = keyword.substring(0, 2) + suffix;
  }

  if (existingOptions.includes(newWord)) {
    return '相关词' + Math.floor(Math.random() * 100);
  }
  return newWord;
}

// 打乱数组
function shuffleArray<T>(array: T[]): T[] {
  const newArray = [...array];
  for (let i = newArray.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
  }
  return newArray;
}

// 生成语义填空
function generateSemanticBlanks(content: string, segments: ExerciseSegment[]) {
  // 按句子分割
  const sentences: { text: string; start: number; end: number }[] = [];
  const regex = /[^。！？；.!?;\n]+[。！？；.!?;]?/g;
  let match;

  while ((match = regex.exec(content)) !== null) {
    const text = match[0].trim();
    if (text.length >= 10) {
      sentences.push({
        text,
        start: match.index,
        end: match.index + match[0].length
      });
    }
  }

  if (sentences.length === 0) {
    segments.push({ type: 'text', content });
    return;
  }

  // 随机选择要挖空的句子
  const selectedSentences = sentences
    .sort(() => Math.random() - 0.5)
    .slice(0, Math.min(blankCount.value, sentences.length))
    .sort((a, b) => a.start - b.start);

  // 从每个句子中提取关键词
  const blankItems: { sentence: typeof sentences[0]; keyword: string; type: 'synonym' | 'antonym' }[] = [];

  for (const sentence of selectedSentences) {
    // 提取2-4字的关键词
    const keywords: { word: string; priority: number }[] = [];

    for (let len = 4; len >= 2; len--) {
      for (let i = 0; i <= sentence.text.length - len; i++) {
        const word = sentence.text.substring(i, i + len);
        if (/^[\u4e00-\u9fa5]+$/.test(word)) {
          // 优先选择词库中有的词
          const inBank = semanticWordBank[word];
          keywords.push({
            word,
            priority: inBank ? len + 10 : len // 词库中的词优先级更高
          });
        }
      }
    }

    if (keywords.length === 0) continue;

    // 按优先级排序
    keywords.sort((a, b) => b.priority - a.priority);
    const selectedKeyword = keywords[0];

    // 随机决定是近义词还是反义词
    const type: 'synonym' | 'antonym' = Math.random() > 0.5 ? 'synonym' : 'antonym';

    blankItems.push({
      sentence,
      keyword: selectedKeyword.word,
      type
    });
  }

  if (blankItems.length === 0) {
    segments.push({ type: 'text', content });
    return;
  }

  // 构建段落
  let lastEnd = 0;

  for (const item of blankItems) {
    const { sentence, keyword, type } = item;

    // 添加句子前的文本
    if (sentence.start > lastEnd) {
      segments.push({
        type: 'text',
        content: content.substring(lastEnd, sentence.start)
      });
    }

    // 在句子中找到关键词的位置
    const keywordIndex = sentence.text.indexOf(keyword);
    if (keywordIndex === -1) continue;

    // 添加句子中关键词前的部分
    if (keywordIndex > 0) {
      segments.push({
        type: 'text',
        content: sentence.text.substring(0, keywordIndex)
      });
    }

    // 生成选项
    let options: string[];
    if (type === 'synonym') {
      options = generateSynonymOptionsByContext(keyword, sentence.text);
    } else {
      options = generateAntonymOptionsByContext(keyword, sentence.text);
    }

    // 添加语义填空
    const correctIndex = options.indexOf(type === 'synonym' ? keyword : semanticWordBank[keyword]?.antonym?.[0] || ('不' + keyword));
    segments.push({
      type: 'blank',
      answer: keyword,
      userAnswer: '',
      isChecked: false,
      isCorrect: false,
      options: options.map((opt, idx) => ({
        content: opt,
        isCorrect: type === 'synonym' ? opt === keyword : idx === (correctIndex >= 0 ? correctIndex : 0)
      })),
      questionType: type,
      context: sentence.text
    });

    // 添加句子中关键词后的部分（包括标点）
    const afterKeyword = sentence.text.substring(keywordIndex + keyword.length);
    segments.push({
      type: 'text',
      content: afterKeyword
    });

    lastEnd = sentence.end;
  }

  // 添加剩余文本
  if (lastEnd < content.length) {
    segments.push({
      type: 'text',
      content: content.substring(lastEnd)
    });
  }
}

// 检查单个答案
function checkAnswer(segment: ExerciseSegment) {
  if (!segment.answer || segment.userAnswer === undefined) return;

  segment.isChecked = true;
  segment.isCorrect = segment.userAnswer.trim() === segment.answer;

  if (segment.isCorrect) {
    ElMessage.success('回答正确！');
  } else {
    ElMessage.error(`回答错误，正确答案是：${segment.answer}`);
  }
}

// 选择选项（语义填空）
function selectOption(segment: ExerciseSegment, optionContent: string) {
  if (segment.isChecked) return;
  segment.userAnswer = optionContent;
  // 自动检查答案
  checkAnswer(segment);
}

// 获取选项按钮类型
function getOptionButtonType(segment: ExerciseSegment, option: BlankOption, index: number): string {
  if (!segment.isChecked) {
    return segment.userAnswer === option.content ? 'primary' : 'default';
  }
  // 已检查时显示正确答案和错误答案
  if (option.isCorrect) {
    return 'success';
  }
  if (segment.userAnswer === option.content && !option.isCorrect) {
    return 'danger';
  }
  return 'default';
}

// 切换显示答案
function toggleShowAnswers() {
  showAnswers.value = !showAnswers.value;
}

// 检查所有答案
function checkAllAnswers() {
  let correct = 0;
  let total = 0;
  
  exerciseSegments.value.forEach(segment => {
    if (segment.type === 'blank' && segment.answer) {
      total++;
      segment.isChecked = true;
      segment.isCorrect = segment.userAnswer?.trim() === segment.answer;
      if (segment.isCorrect) correct++;
    }
  });
  
  if (correct === total) {
    ElMessage.success(`恭喜！全部正确！(${correct}/${total})`);
    // 更新复习次数
    if (props.article) {
      textStore.updateReviewCount(props.article._id);
    }
  } else {
    ElMessage.warning(`答对 ${correct}/${total} 题，继续加油！`);
  }
}

// 重置练习
function resetExercise() {
  exerciseSegments.value.forEach(segment => {
    if (segment.type === 'blank') {
      segment.userAnswer = '';
      segment.isChecked = false;
      segment.isCorrect = false;
    }
  });
  showAnswers.value = false;
  ElMessage.info('练习已重置');
}

// 保存进度
async function saveProgress() {
  if (!props.article) return;
  
  const progress = {
    mode: exerciseMode.value,
    blankCount: blankCount.value,
    segments: exerciseSegments.value,
    stats: stats.value
  };
  
  const success = await textStore.saveLearningProgress(
    props.article._id,
    'fillBlanks',
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
  
  const savedProgress = textStore.getLearningProgress(props.article._id, 'fillBlanks');
  if (savedProgress?.progress?.segments) {
    exerciseMode.value = savedProgress.progress.mode || 'random';
    blankCount.value = savedProgress.progress.blankCount || 10;
    exerciseSegments.value = savedProgress.progress.segments;
    ElMessage.success('进度已恢复');
  } else {
    ElMessage.warning('没有找到保存的进度');
  }
}
</script>

<style scoped lang="scss">
.fill-blanks-container {
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
    margin-right: 12px;
    color: var(--utools-text-primary);
  }
}

.mode-selector {
  display: flex;
  justify-content: center;
}

.exercise-area {
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  padding: 20px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  line-height: 2;
}

.exercise-content {
  font-size: 16px;
  line-height: 2.5;
  color: var(--utools-text-primary);
}

.text-segment {
  white-space: pre-wrap;
}

.blank-item {
  display: inline-flex;
  align-items: center;
  margin: 0 4px;
  vertical-align: middle;
  
  :deep(.el-input) {
    width: auto;
    min-width: 80px;
    
    .el-input__inner {
      text-align: center;
      font-size: 16px;
    }
    
    &.is-correct .el-input__inner {
      background-color: #f0f9eb;
      border-color: #67c23a;
      color: #67c23a;
    }
    
    &.is-wrong .el-input__inner {
      background-color: #fef0f0;
      border-color: #f56c6c;
      color: #f56c6c;
    }
  }
  
  .status-icon {
    font-size: 14px;
    
    &.correct {
      color: #67c23a;
    }
    
    &.wrong {
      color: #f56c6c;
    }
  }
  
  .answer-hint {
    margin-left: 8px;
    color: #67c23a;
    font-size: 14px;
    font-weight: 500;
  }
}

.stats-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: center;
  padding: 12px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
}

.action-bar {
  display: flex;
  justify-content: center;
  gap: 12px;
}

.tips-area {
  p {
    margin: 4px 0;
    font-size: 13px;
  }

  .tag-demo {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 500;

    &.synonym {
      background: #e6f7e6;
      color: #52c41a;
      border: 1px solid #b7eb8f;
    }

    &.antonym {
      background: #fff2e8;
      color: #fa8c16;
      border: 1px solid #ffbb96;
    }
  }
}

// 语义填空样式
.blank-item.has-options {
  display: inline-flex;
  flex-direction: column;
  align-items: flex-start;
  margin: 8px 4px;
  vertical-align: top;

  .semantic-blank {
    display: flex;
    flex-direction: column;
    gap: 6px;
    padding: 8px 12px;
    background: var(--utools-bg-primary);
    border-radius: 8px;
    border: 1px solid var(--utools-border-color);
    min-width: 200px;

    .blank-type-tag {
      font-size: 12px;
      padding: 2px 8px;
      border-radius: 4px;
      font-weight: 500;
      align-self: flex-start;

      &.synonym {
        background: #e6f7e6;
        color: #52c41a;
        border: 1px solid #b7eb8f;
      }

      &.antonym {
        background: #fff2e8;
        color: #fa8c16;
        border: 1px solid #ffbb96;
      }
    }

    .options-container {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;

      .el-button {
        min-width: 80px;

        &.is-selected {
          border-width: 2px;
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
    }

    .answer-hint {
      margin-left: 0;
      margin-top: 4px;
      font-size: 13px;
      color: #67c23a;
      font-weight: 500;
    }
  }
}

// 语义填空提示
.semantic-tips {
  margin-top: 8px;
  padding: 8px 12px;
  background: var(--utools-bg-primary);
  border-radius: 6px;
  font-size: 13px;
  color: var(--utools-text-secondary);

  .tip-item {
    display: flex;
    align-items: center;
    gap: 6px;
    margin: 4px 0;

    .tag-demo {
      display: inline-block;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 11px;

      &.synonym {
        background: #e6f7e6;
        color: #52c41a;
      }

      &.antonym {
        background: #fff2e8;
        color: #fa8c16;
      }
    }
  }
}
</style>
