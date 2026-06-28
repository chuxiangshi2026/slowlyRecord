<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="提示词管理"
    width="750px"
    destroy-on-close
    class="prompts-dialog"
  >
    <div v-if="article" class="prompts-container">
      <!-- 头部信息 -->
      <div class="header-info">
        <h3>{{ article.title }}</h3>
        <p class="subtitle">添加提示词帮助记忆，支持拖拽排序</p>
      </div>

      <!-- 写字板模式切换 -->
      <div class="mode-toggle">
        <el-radio-group v-model="displayMode">
          <el-radio-button label="edit">编辑模式</el-radio-button>
          <el-radio-button label="board">写字板模式</el-radio-button>
        </el-radio-group>
      </div>

      <!-- 编辑模式 -->
      <template v-if="displayMode === 'edit'">
        <!-- 添加提示词 -->
        <div class="add-prompt-section">
          <el-form :model="newPromptForm" label-width="60px">
            <el-form-item label="标题">
              <el-input
                v-model="newPromptForm.title"
                placeholder="提示词标题（如：首句提示、关键词等）"
                maxlength="50"
                show-word-limit
              />
            </el-form-item>
            <el-form-item label="内容">
              <el-input
                v-model="newPromptForm.content"
                type="textarea"
                :rows="3"
                placeholder="输入提示词内容..."
                maxlength="1000"
                show-word-limit
              />
            </el-form-item>
          </el-form>
          <div class="add-actions">
            <el-checkbox v-model="newPromptForm.enabled">启用</el-checkbox>
            <el-button
              type="primary"
              @click="addPrompt"
              :disabled="!newPromptForm.title.trim() || !newPromptForm.content.trim()"
            >
              <el-icon><Plus /></el-icon>
              添加提示词
            </el-button>
          </div>
        </div>

        <!-- 提示词列表 -->
        <div class="prompts-list-section">
          <div class="section-header">
            <h4>提示词列表 ({{ textStore.currentPrompts.length }})</h4>
            <el-button link type="primary" @click="showQuickAdd = true">
              <el-icon><MagicStick /></el-icon>
              快速添加
            </el-button>
          </div>

          <el-empty v-if="textStore.currentPrompts.length === 0" description="暂无提示词，添加第一条吧" />
          
          <div v-else class="prompts-list">
              <div
                v-for="(prompt, index) in textStore.currentPrompts"
                :key="prompt._id"
                class="prompt-item"
                :class="{ 'is-disabled': !prompt.enabled }"
                draggable="true"
                @dragstart="handleDragStart($event, index)"
                @dragover.prevent
                @drop="handleDrop($event, index)"
              >
                <div class="drag-handle">
                  <el-icon><Rank /></el-icon>
                </div>
                <div class="prompt-content">
                  <div v-if="editingPromptId === prompt._id" class="edit-mode">
                    <el-input v-model="editingForm.title" placeholder="标题" />
                    <el-input
                      v-model="editingForm.content"
                      type="textarea"
                      :rows="2"
                      placeholder="内容"
                    />
                    <div class="edit-actions">
                      <el-button size="small" @click="cancelEdit">取消</el-button>
                      <el-button type="primary" size="small" @click="saveEdit(prompt)">保存</el-button>
                    </div>
                  </div>
                  <div v-else class="view-mode">
                    <div class="prompt-header">
                      <span class="prompt-title">{{ prompt.title }}</span>
                      <el-tag v-if="!prompt.enabled" type="info" size="small">已禁用</el-tag>
                    </div>
                    <p class="prompt-text">{{ prompt.content }}</p>
                  </div>
                </div>
                <div class="prompt-actions">
                  <el-switch
                    v-model="prompt.enabled"
                    @change="(val: boolean) => togglePrompt(prompt, val)"
                    size="small"
                  />
                  <el-button
                    v-if="editingPromptId !== prompt._id"
                    link
                    type="primary"
                    @click="startEdit(prompt)"
                  >
                    <el-icon><Edit /></el-icon>
                  </el-button>
                  <el-button
                    v-if="editingPromptId !== prompt._id"
                    link
                    type="danger"
                    @click="deletePrompt(prompt._id)"
                  >
                    <el-icon><Delete /></el-icon>
                  </el-button>
                </div>
              </div>
            </div>
        </div>
      </template>

      <!-- 写字板模式 -->
      <template v-else>
        <div class="writing-board">
          <div class="board-header">
            <h4>记忆提示板</h4>
            <div class="board-actions">
              <el-button
                type="primary"
                size="small"
                @click="showQuickAddInBoard = true"
              >
                <el-icon><Plus /></el-icon>
                添加提示词
              </el-button>
              <el-radio-group v-model="boardLayout" size="small">
                <el-radio-button label="list">列表</el-radio-button>
                <el-radio-button label="grid">网格</el-radio-button>
              </el-radio-group>
            </div>
          </div>

          <!-- 临时写字板 -->
          <div class="temp-notepad-section">
            <div class="notepad-header">
              <span class="notepad-title">📝 临时写字板</span>
              <div class="notepad-actions">
                <el-button
                  v-if="notepadContent"
                  link
                  type="primary"
                  size="small"
                  @click="showCompareDialog"
                >
                  <el-icon><View /></el-icon>
                  对比原文
                </el-button>
                <el-button
                  link
                  type="danger"
                  size="small"
                  @click="clearNotepad"
                >
                  <el-icon><Delete /></el-icon>
                  清空
                </el-button>
              </div>
            </div>
            <el-input
              v-model="notepadContent"
              type="textarea"
              :rows="4"
              placeholder="在这里默写原文..."
              class="notepad-input"
              @input="saveNotepad"
            />
          </div>

          <div class="board-content" :class="`layout-${boardLayout}`">
            <div
              v-for="prompt in enabledPrompts"
              :key="prompt._id"
              class="board-card"
              @click="toggleCardExpand(prompt._id)"
              :class="{ 'is-expanded': expandedCards.includes(prompt._id) }"
            >
              <div class="card-header">{{ prompt.title }}</div>
              <div class="card-body">{{ prompt.content }}</div>
            </div>
          </div>

          <el-empty v-if="enabledPrompts.length === 0 && !notepadContent" description="没有启用的提示词" />
        </div>
      </template>

      <!-- 写字板模式快速添加提示词对话框 -->
      <el-dialog
        v-model="showQuickAddInBoard"
        title="添加提示词"
        width="500px"
        append-to-body
      >
        <el-form label-width="60px">
          <el-form-item label="标题">
            <el-input
              v-model="boardNewPromptForm.title"
              placeholder="提示词标题（如：首句提示、关键词等）"
              maxlength="50"
              show-word-limit
            />
          </el-form-item>
          <el-form-item label="内容">
            <el-input
              v-model="boardNewPromptForm.content"
              type="textarea"
              :rows="3"
              placeholder="输入提示词内容..."
              maxlength="1000"
              show-word-limit
            />
          </el-form-item>
        </el-form>
        <template #footer>
          <el-button @click="showQuickAddInBoard = false">取消</el-button>
          <el-button
            type="primary"
            @click="addPromptFromBoard"
            :disabled="!boardNewPromptForm.title.trim() || !boardNewPromptForm.content.trim()"
          >
            添加
          </el-button>
        </template>
      </el-dialog>

      <!-- 对比原文对话框 -->
      <el-dialog
        v-model="showCompare"
        title="默写对比"
        width="800px"
        append-to-body
        class="compare-dialog"
      >
        <div class="compare-wrapper">
          <div class="compare-panel">
            <div class="panel-header">
              <span class="panel-title">📄 原文</span>
              <el-tag size="small" type="info">{{ article?.content?.length || 0 }} 字</el-tag>
            </div>
            <div class="panel-content original-text">{{ article?.content }}</div>
          </div>
          <div class="compare-panel">
            <div class="panel-header">
              <span class="panel-title">✏️ 我的默写</span>
              <el-tag size="small" :type="compareStats.errorCount > 0 ? 'warning' : 'success'">
                {{ compareStats.errorCount }} 处错误
              </el-tag>
            </div>
            <div class="panel-content compared-text" v-html="comparedHtml"></div>
          </div>
        </div>
        <div class="compare-stats">
          <el-statistic title="正确率" :value="compareStats.accuracy" suffix="%" />
          <el-statistic title="字数" :value="compareStats.totalWords" />
          <el-statistic title="错误" :value="compareStats.errorCount" />
          <el-statistic title="遗漏" :value="compareStats.missingCount" />
        </div>
        <template #footer>
          <el-button @click="showCompare = false">关闭</el-button>
        </template>
      </el-dialog>

      <!-- 快速添加对话框 -->
      <el-dialog
        v-model="showQuickAdd"
        title="快速添加提示词"
        width="500px"
        append-to-body
      >
        <el-form label-width="100px">
          <el-form-item label="提示词类型">
            <el-select v-model="quickAddType" placeholder="选择类型" style="width: 100%">
              <el-option label="首句提示" value="firstSentence" />
              <el-option label="末句提示" value="lastSentence" />
              <el-option label="关键词" value="keywords" />
              <el-option label="段落大意" value="summary" />
              <el-option label="作者信息" value="author" />
            </el-select>
          </el-form-item>
        </el-form>
        
        <div v-if="quickAddPreview" class="quick-preview">
          <h5>预览：</h5>
          <p><strong>标题：</strong>{{ quickAddPreview.title }}</p>
          <p><strong>内容：</strong>{{ quickAddPreview.content }}</p>
        </div>
        
        <template #footer>
          <el-button @click="showQuickAdd = false">取消</el-button>
          <el-button type="primary" @click="confirmQuickAdd" :disabled="!quickAddPreview">
            添加
          </el-button>
        </template>
      </el-dialog>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useTextMemoryStore } from '@/stores/textMemory';
import type { TextArticle, TextPrompt } from '@/types/text-memory';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Rank, MagicStick, View } from '@element-plus/icons-vue';

// 写字板存储键
const NOTEPAD_KEY = 'slowlyrecord-textmemory-notepad';
const NOTEPAD_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

interface Props {
  modelValue: boolean;
  article: TextArticle | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const textStore = useTextMemoryStore();

// 显示模式
const displayMode = ref<'edit' | 'board'>('edit');
const boardLayout = ref<'list' | 'grid'>('list');

// 新提示词表单
const newPromptForm = ref({
  title: '',
  content: '',
  enabled: true
});

// 编辑状态
const editingPromptId = ref<string | null>(null);
const editingForm = ref({ title: '', content: '' });

// 拖拽
const dragIndex = ref<number | null>(null);

// 快速添加
const showQuickAdd = ref(false);
const quickAddType = ref('');

// 写字板模式添加提示词
const showQuickAddInBoard = ref(false);
const boardNewPromptForm = ref({
  title: '',
  content: '',
  enabled: true
});

// 展开的卡片
const expandedCards = ref<string[]>([]);

// 临时写字板内容
const notepadContent = ref('');

// 对比对话框
const showCompare = ref(false);
const LCS_COMPARE_MAX_CELLS = 1_000_000;

const currentCompareSource = computed(() => ({
  original: props.article?.content || '',
  written: notepadContent.value || ''
}));

const compareResult = computed(() => {
  const { original, written } = currentCompareSource.value;
  return compareText(original, written);
});

// 对比统计
const compareStats = computed(() => {
  if (!props.article) return { accuracy: 0, totalWords: 0, errorCount: 0, missingCount: 0 };

  const original = currentCompareSource.value.original;
  const result = compareResult.value;

  const totalWords = original.length;
  const errorCount = result.errors.length;
  const missingCount = result.missing.length;

  const accuracy = totalWords > 0
    ? Math.round(((totalWords - errorCount - missingCount) / totalWords) * 100)
    : 0;

  return {
    accuracy: Math.max(0, accuracy),
    totalWords,
    errorCount,
    missingCount
  };
});

// 对比后的HTML
const comparedHtml = computed(() => {
  if (!props.article) return '';

  const { written } = currentCompareSource.value;
  return generateComparedHtml(written, compareResult.value);
});

// 启用的提示词
const enabledPrompts = computed(() => 
  textStore.currentPrompts.filter(p => p.enabled)
);

// 快速添加预览
const quickAddPreview = computed(() => {
  if (!props.article || !quickAddType.value) return null;
  
  const content = props.article.content;
  let title = '';
  let previewContent = '';
  
  switch (quickAddType.value) {
    case 'firstSentence':
      title = '首句提示';
      previewContent = content.split(/[。！？；.!?;]/)[0] + '...';
      break;
    case 'lastSentence':
      title = '末句提示';
      const sentences = content.split(/[。！？；.!?;]/).filter(s => s.trim());
      previewContent = '...' + sentences[sentences.length - 1];
      break;
    case 'keywords':
      title = '关键词';
      // 提取关键词（简化处理）
      const words = content.match(/[\u4e00-\u9fa5]{2,4}/g) || [];
      previewContent = [...new Set(words)].slice(0, 5).join('、');
      break;
    case 'summary':
      title = '段落大意';
      previewContent = content.substring(0, 100) + '...';
      break;
    case 'author':
      title = '作者信息';
      previewContent = props.article.author || '未知作者';
      if (props.article.source) {
        previewContent += ` | ${props.article.source}`;
      }
      break;
  }
  
  return { title, content: previewContent };
});

// 监听对话框显示
watch(() => props.modelValue, async (visible) => {
  if (visible && props.article) {
    await textStore.loadPrompts(props.article._id);
    loadNotepad();
  }
});

// 加载写字板内容
function loadNotepad() {
  try {
    const stored = localStorage.getItem(NOTEPAD_KEY);
    if (stored) {
      const data = JSON.parse(stored);
      const now = Date.now();
      // 检查是否超过24小时
      if (now - data.timestamp > NOTEPAD_EXPIRY) {
        notepadContent.value = '';
        localStorage.removeItem(NOTEPAD_KEY);
      } else {
        notepadContent.value = data.content || '';
      }
    } else {
      notepadContent.value = '';
    }
  } catch (e) {
    console.error('加载写字板失败:', e);
    notepadContent.value = '';
  }
}

// 保存写字板内容
function saveNotepad() {
  try {
    const data = {
      content: notepadContent.value,
      timestamp: Date.now()
    };
    localStorage.setItem(NOTEPAD_KEY, JSON.stringify(data));
  } catch (e) {
    console.error('保存写字板失败:', e);
  }
}

// 清空写字板
function clearNotepad() {
  notepadContent.value = '';
  localStorage.removeItem(NOTEPAD_KEY);
  ElMessage.success('写字板已清空');
}

// 添加提示词
async function addPrompt() {
  if (!props.article) return;

  const result = await textStore.addPrompt({
    articleId: props.article._id,
    title: newPromptForm.value.title.trim(),
    content: newPromptForm.value.content.trim(),
    order: textStore.currentPrompts.length,
    enabled: newPromptForm.value.enabled
  });

  if (result.success) {
    ElMessage.success('提示词添加成功');
    newPromptForm.value = { title: '', content: '', enabled: true };
  } else {
    ElMessage.error(result.error || '添加失败');
  }
}

// 从写字板模式添加提示词
async function addPromptFromBoard() {
  if (!props.article) return;

  const result = await textStore.addPrompt({
    articleId: props.article._id,
    title: boardNewPromptForm.value.title.trim(),
    content: boardNewPromptForm.value.content.trim(),
    order: textStore.currentPrompts.length,
    enabled: true
  });

  if (result.success) {
    ElMessage.success('提示词添加成功');
    boardNewPromptForm.value = { title: '', content: '', enabled: true };
    showQuickAddInBoard.value = false;
  } else {
    ElMessage.error(result.error || '添加失败');
  }
}

// 开始编辑
function startEdit(prompt: TextPrompt) {
  editingPromptId.value = prompt._id;
  editingForm.value = {
    title: prompt.title,
    content: prompt.content
  };
}

// 取消编辑
function cancelEdit() {
  editingPromptId.value = null;
  editingForm.value = { title: '', content: '' };
}

// 保存编辑
async function saveEdit(prompt: TextPrompt) {
  if (!editingForm.value.title.trim() || !editingForm.value.content.trim()) {
    ElMessage.warning('标题和内容不能为空');
    return;
  }
  
  const updatedPrompt: TextPrompt = {
    ...prompt,
    title: editingForm.value.title.trim(),
    content: editingForm.value.content.trim()
  };
  
  const result = await textStore.updatePrompt(updatedPrompt);
  
  if (result.success) {
    ElMessage.success('提示词更新成功');
    editingPromptId.value = null;
  } else {
    ElMessage.error(result.error || '更新失败');
  }
}

// 切换启用状态
async function togglePrompt(prompt: TextPrompt, enabled: boolean) {
  const updatedPrompt = { ...prompt, enabled };
  const result = await textStore.updatePrompt(updatedPrompt);
  
  if (!result.success) {
    ElMessage.error(result.error || '操作失败');
  }
}

// 删除提示词
async function deletePrompt(promptId: string) {
  try {
    await ElMessageBox.confirm('确定要删除这个提示词吗？', '确认删除', {
      confirmButtonText: '删除',
      cancelButtonText: '取消',
      type: 'warning'
    });
    
    const result = await textStore.deletePrompt(promptId);
    if (result.success) {
      ElMessage.success('提示词已删除');
    } else {
      ElMessage.error(result.error || '删除失败');
    }
  } catch {
    // 用户取消
  }
}

// 拖拽开始
function handleDragStart(event: DragEvent, index: number) {
  dragIndex.value = index;
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move';
  }
}

// 拖拽放置
function handleDrop(event: DragEvent, index: number) {
  event.preventDefault();
  if (dragIndex.value === null || dragIndex.value === index) return;
  
  // 重新排序
  const prompts = [...textStore.currentPrompts];
  const [moved] = prompts.splice(dragIndex.value, 1);
  prompts.splice(index, 0, moved);
  
  // 更新顺序
  textStore.reorderPrompts(prompts);
  
  dragIndex.value = null;
}

// 确认快速添加
async function confirmQuickAdd() {
  if (!props.article || !quickAddPreview.value) return;
  
  const result = await textStore.addPrompt({
    articleId: props.article._id,
    title: quickAddPreview.value.title,
    content: quickAddPreview.value.content,
    order: textStore.currentPrompts.length,
    enabled: true
  });
  
  if (result.success) {
    ElMessage.success('提示词添加成功');
    showQuickAdd.value = false;
    quickAddType.value = '';
  } else {
    ElMessage.error(result.error || '添加失败');
  }
}

// 切换卡片展开
function toggleCardExpand(promptId: string) {
  const index = expandedCards.value.indexOf(promptId);
  if (index === -1) {
    expandedCards.value.push(promptId);
  } else {
    expandedCards.value.splice(index, 1);
  }
}

// 显示对比对话框
function showCompareDialog() {
  if (!notepadContent.value.trim()) {
    ElMessage.warning('请先输入默写内容');
    return;
  }
  showCompare.value = true;
}

// 文本对比算法 - 智能对齐：使用LCS(最长公共子序列)算法
interface CompareResult {
  errors: Array<{ char: string; position: number }>;
  missing: Array<{ position: number }>;
  extra: Array<{ char: string; position: number }>;
}

function compareTextLinear(original: string, written: string): CompareResult {
  const errors: Array<{ char: string; position: number }> = [];
  const missing: Array<{ position: number }> = [];
  const extra: Array<{ char: string; position: number }> = [];
  const commonLength = Math.min(original.length, written.length);

  for (let i = 0; i < commonLength; i++) {
    if (original[i] !== written[i]) {
      errors.push({ char: written[i], position: i });
    }
  }

  for (let i = written.length; i < original.length; i++) {
    missing.push({ position: i });
  }

  for (let i = original.length; i < written.length; i++) {
    extra.push({ char: written[i], position: i });
  }

  return { errors, missing, extra };
}

function compareText(original: string, written: string): CompareResult {
  const errors: Array<{ char: string; position: number }> = [];
  const missing: Array<{ position: number }> = [];
  const extra: Array<{ char: string; position: number }> = [];

  // 使用动态规划计算LCS
  const m = original.length;
  const n = written.length;
  if (m * n > LCS_COMPARE_MAX_CELLS) {
    return compareTextLinear(original, written);
  }
  const dp: number[][] = Array(m + 1).fill(null).map(() => Array(n + 1).fill(0));

  // 填充DP表
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (original[i - 1] === written[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  // 回溯找出差异
  let i = m, j = n;
  const matchedOrig = new Set<number>();
  const matchedWrit = new Set<number>();

  while (i > 0 && j > 0) {
    if (original[i - 1] === written[j - 1]) {
      matchedOrig.add(i - 1);
      matchedWrit.add(j - 1);
      i--;
      j--;
    } else if (dp[i - 1][j] >= dp[i][j - 1]) {
      i--;
    } else {
      j--;
    }
  }

  // 找出错误（位置对齐但不匹配）
  // 找出遗漏和多余
  let origIdx = 0, writIdx = 0;
  while (origIdx < m || writIdx < n) {
    const origMatched = matchedOrig.has(origIdx);
    const writMatched = matchedWrit.has(writIdx);

    if (origIdx < m && writIdx < n && origMatched && writMatched) {
      // 正确匹配
      origIdx++;
      writIdx++;
    } else if (origIdx < m && !origMatched && writIdx < n && !writMatched) {
      // 都不匹配：可能是错误字符
      errors.push({ char: written[writIdx], position: writIdx });
      origIdx++;
      writIdx++;
    } else if (origIdx < m && !origMatched) {
      // 原文有，默写没有：遗漏
      missing.push({ position: origIdx });
      origIdx++;
    } else if (writIdx < n && !writMatched) {
      // 默写有，原文没有：多余
      extra.push({ char: written[writIdx], position: writIdx });
      writIdx++;
    } else {
      origIdx++;
      writIdx++;
    }
  }

  return { errors, missing, extra };
}

// 生成对比HTML
function generateComparedHtml(written: string, result: CompareResult): string {
  if (!written) return '<span class="empty-hint">未输入内容</span>';

  let html = '';

  const errorSet = new Set(result.errors.map(e => e.position));
  const extraSet = new Set(result.extra.map(e => e.position));

  // 构建带高亮的HTML
  for (let i = 0; i < written.length; i++) {
    const char = written[i];
    // 转义HTML特殊字符
    const escapedChar = char
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

    if (errorSet.has(i)) {
      html += `<span class="char-error" title="错误字符">${escapedChar}</span>`;
    } else if (extraSet.has(i)) {
      html += `<span class="char-extra" title="多余字符">${escapedChar}</span>`;
    } else {
      html += escapedChar;
    }
  }

  // 添加遗漏提示
  if (result.missing.length > 0) {
    html += `<div class="missing-hint">遗漏 ${result.missing.length} 个字符</div>`;
  }

  return html || '<span class="empty-hint">无内容</span>';
}
</script>

<style scoped lang="scss">
.prompts-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header-info {
  text-align: center;
  
  h3 {
    margin: 0 0 8px 0;
    color: var(--utools-text-primary);
  }
  
  .subtitle {
    margin: 0;
    color: var(--utools-text-secondary);
    font-size: 13px;
  }
}

.mode-toggle {
  display: flex;
  justify-content: center;
}

.add-prompt-section {
  padding: 16px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  
  .add-actions {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-top: 12px;
  }
}

.prompts-list-section {
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    h4 {
      margin: 0;
      color: var(--utools-text-primary);
    }
  }
}

.prompts-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 350px;
  overflow-y: auto;
}

.prompt-item {
  display: flex;
  gap: 10px;
  padding: 12px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  border: 2px solid transparent;
  transition: all 0.3s;
  cursor: move;
  
  &.is-disabled {
    opacity: 0.6;
    background: var(--utools-bg-primary);
  }
  
  &:hover {
    border-color: var(--utools-border-color);
  }
}

.drag-handle {
  display: flex;
  align-items: center;
  color: var(--utools-text-secondary);
  cursor: grab;
}

.prompt-content {
  flex: 1;
}

.view-mode {
  .prompt-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 6px;
  }
  
  .prompt-title {
    font-weight: 600;
    color: var(--utools-text-primary);
  }
  
  .prompt-text {
    margin: 0;
    color: var(--utools-text-secondary);
    font-size: 13px;
    line-height: 1.5;
  }
}

.edit-mode {
  display: flex;
  flex-direction: column;
  gap: 8px;
  
  .edit-actions {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
  }
}

.prompt-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
  align-items: center;
}

// 写字板样式
.writing-board {
  .board-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;

    h4 {
      margin: 0;
      color: var(--utools-text-primary);
    }

    .board-actions {
      display: flex;
      align-items: center;
      gap: 12px;
    }
  }

  .temp-notepad-section {
    margin-bottom: 20px;
    padding: 16px;
    background: linear-gradient(135deg, #f6ffed 0%, #f0f5ff 100%);
    border: 1px solid #b7eb8f;
    border-radius: 8px;

    .notepad-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;

      .notepad-title {
        font-weight: 600;
        color: #52c41a;
        font-size: 14px;
      }

      .notepad-actions {
        display: flex;
        gap: 8px;
      }
    }

    .notepad-input {
      :deep(.el-textarea__inner) {
        background: rgba(255, 255, 255, 0.8);
        resize: none;
        font-size: 14px;
        line-height: 1.6;
      }
    }
  }
  
  .board-content {
    display: flex;
    gap: 12px;
    
    &.layout-list {
      flex-direction: column;
    }
    
    &.layout-grid {
      flex-direction: row;
      flex-wrap: wrap;
      
      .board-card {
        flex: 1;
        min-width: 200px;
        max-width: calc(50% - 6px);
      }
    }
  }
  
  .board-card {
    padding: 16px;
    background: linear-gradient(135deg, #fffbe6 0%, #fff7e6 100%);
    border: 1px solid #ffe58f;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    
    &:hover {
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      transform: translateY(-2px);
    }
    
    &.is-expanded {
      background: linear-gradient(135deg, #e6f7ff 0%, #f0f5ff 100%);
      border-color: #91d5ff;
    }
    
    .card-header {
      font-weight: 600;
      color: #d48806;
      margin-bottom: 8px;
      font-size: 14px;
    }
    
    .card-body {
      color: #595959;
      font-size: 13px;
      line-height: 1.6;
      display: -webkit-box;
      -webkit-line-clamp: 3;
      -webkit-box-orient: vertical;
      overflow: hidden;
    }
    
    &.is-expanded .card-body {
      -webkit-line-clamp: unset;
    }
  }
}

.quick-preview {
  margin-top: 16px;
  padding: 12px;
  background: var(--utools-bg-secondary);
  border-radius: 6px;

  h5 {
    margin: 0 0 8px 0;
    color: var(--utools-text-primary);
  }

  p {
    margin: 4px 0;
    color: var(--utools-text-secondary);
    font-size: 13px;
  }
}

// 对比对话框样式
.compare-dialog {
  :deep(.el-dialog__body) {
    padding: 20px;
    max-width: 760px;
    box-sizing: border-box;
  }
}

.compare-wrapper {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;
  width: 100%;
  box-sizing: border-box;

  .compare-panel {
    flex: 1;
    width: calc(50% - 8px);
    min-width: 0;
    max-width: 360px;
    border: 1px solid var(--utools-border-color);
    border-radius: 8px;
    overflow: hidden;
    box-sizing: border-box;

    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px 16px;
      background: var(--utools-bg-secondary);
      border-bottom: 1px solid var(--utools-border-color);

      .panel-title {
        font-weight: 600;
        color: var(--utools-text-primary);
      }
    }

    .panel-content {
      padding: 16px;
      max-height: 400px;
      overflow-y: auto;
      overflow-x: hidden;
      font-size: 14px;
      line-height: 1.8;
      white-space: pre-wrap;
      word-break: break-all;
      box-sizing: border-box;

      &.original-text {
        background: #f6ffed;
        color: #389e0d;
      }

      &.compared-text {
        background: #fff;

        :deep(.char-error) {
          background: #ff4d4f !important;
          color: #fff !important;
          padding: 0 2px;
          border-radius: 2px;
          text-decoration: line-through;
        }

        :deep(.char-extra) {
          background: #faad14 !important;
          color: #fff !important;
          padding: 0 2px;
          border-radius: 2px;
        }

        :deep(.missing-hint) {
          margin-top: 12px;
          padding: 8px 12px;
          background: #fff2f0;
          border: 1px solid #ffccc7;
          border-radius: 4px;
          color: #cf1322;
          font-size: 13px;
        }

        :deep(.empty-hint) {
          color: var(--utools-text-secondary);
          font-style: italic;
        }
      }
    }
  }
}

.compare-stats {
  display: flex;
  justify-content: space-around;
  padding: 16px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;

  :deep(.el-statistic__content) {
    font-size: 24px;
    font-weight: 600;
    color: var(--utools-text-primary);
  }

  :deep(.el-statistic__title) {
    font-size: 13px;
    color: var(--utools-text-secondary);
  }
}
</style>
