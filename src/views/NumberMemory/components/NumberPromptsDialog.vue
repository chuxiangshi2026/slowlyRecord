<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    title="💡 数字记忆提示词"
    width="700px"
    destroy-on-close
    class="number-prompts-dialog"
  >
    <div v-if="entry" class="prompts-container">
      <!-- 头部信息 -->
      <div class="header-info">
        <h3>{{ entry.title }}</h3>
        <div class="numbers-display">{{ entry.numbers }}</div>
      </div>

      <!-- 模式切换 -->
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
                placeholder="提示词标题（如：分段提示、首数字提示等）"
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
            <h4>提示词列表 ({{ store.currentPrompts.length }})</h4>
          </div>

          <el-empty v-if="store.currentPrompts.length === 0" description="暂无提示词，添加第一条吧" />
          
          <div v-else class="prompts-list">
            <div
              v-for="(prompt, index) in store.currentPrompts"
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
              <el-button type="primary" size="small" @click="displayMode = 'edit'">
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
              <span class="notepad-title">📝 临时默写板</span>
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
              placeholder="在这里默写数字..."
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

      <!-- 对比对话框 -->
      <el-dialog
        v-model="showCompare"
        title="默写对比"
        width="600px"
        append-to-body
      >
        <div class="compare-wrapper">
          <div class="compare-panel">
            <div class="panel-header">
              <span class="panel-title">📄 原数字</span>
              <el-tag size="small" type="info">{{ entry?.numbers?.length || 0 }} 位</el-tag>
            </div>
            <div class="panel-content original-text">{{ entry?.numbers }}</div>
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
          <el-statistic title="位数" :value="compareStats.totalDigits" />
          <el-statistic title="错误" :value="compareStats.errorCount" />
        </div>
        <template #footer>
          <el-button @click="showCompare = false">关闭</el-button>
        </template>
      </el-dialog>
    </div>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useNumberMemoryStore } from '@/stores/numberMemory';
import type { NumberMemoryEntry, NumberMemoryPrompt } from '@/types/number-memory';
import { ElMessage, ElMessageBox } from 'element-plus';
import { Plus, Edit, Delete, Rank, View } from '@element-plus/icons-vue';

// 写字板存储键
const NOTEPAD_KEY_PREFIX = 'slowlyrecord-numbermemory-notepad-';
const NOTEPAD_EXPIRY = 24 * 60 * 60 * 1000; // 24小时

interface Props {
  modelValue: boolean;
  entry: NumberMemoryEntry | null;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
}>();

const store = useNumberMemoryStore();

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

// 展开的卡片
const expandedCards = ref<string[]>([]);

// 临时写字板内容
const notepadContent = ref('');

// 对比对话框
const showCompare = ref(false);

// 启用的提示词
const enabledPrompts = computed(() => 
  store.currentPrompts.filter(p => p.enabled)
);

// 对比统计
const compareStats = computed(() => {
  if (!props.entry) return { accuracy: 0, totalDigits: 0, errorCount: 0 };
  
  const original = props.entry.numbers || '';
  const written = notepadContent.value || '';
  
  const totalDigits = original.length;
  let errorCount = 0;
  
  for (let i = 0; i < Math.max(original.length, written.length); i++) {
    if (original[i] !== written[i]) {
      errorCount++;
    }
  }
  
  const accuracy = totalDigits > 0 
    ? Math.round(((totalDigits - errorCount) / totalDigits) * 100) 
    : 0;
  
  return {
    accuracy: Math.max(0, accuracy),
    totalDigits,
    errorCount
  };
});

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// 对比后的HTML
const comparedHtml = computed(() => {
  if (!props.entry) return '';
  
  const original = props.entry.numbers || '';
  const written = notepadContent.value || '';
  
  let html = '';
  for (let i = 0; i < written.length; i++) {
    const char = escapeHtml(written[i]);
    const expected = escapeHtml(original[i] || '无');
    const isCorrect = original[i] === written[i];

    if (isCorrect) {
      html += char;
    } else {
      html += `<span class="char-error" title="应为 ${expected}">${char}</span>`;
    }
  }
  
  // 添加遗漏提示
  if (written.length < original.length) {
    html += `<div class="missing-hint">遗漏 ${original.length - written.length} 位数字</div>`;
  }
  
  return html || '<span class="empty-hint">未输入内容</span>';
});

// 监听对话框显示
watch(() => props.modelValue, async (visible) => {
  if (visible && props.entry) {
    await store.loadPrompts(props.entry._id);
    loadNotepad();
  }
});

// 加载写字板内容
function loadNotepad() {
  if (!props.entry) return;
  
  try {
    const key = NOTEPAD_KEY_PREFIX + props.entry._id;
    const stored = localStorage.getItem(key);
    if (stored) {
      const data = JSON.parse(stored);
      const now = Date.now();
      // 检查是否超过24小时
      if (now - data.timestamp > NOTEPAD_EXPIRY) {
        notepadContent.value = '';
        localStorage.removeItem(key);
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
  if (!props.entry) return;
  
  try {
    const key = NOTEPAD_KEY_PREFIX + props.entry._id;
    const data = {
      content: notepadContent.value,
      timestamp: Date.now()
    };
    localStorage.setItem(key, JSON.stringify(data));
  } catch (e) {
    console.error('保存写字板失败:', e);
  }
}

// 清空写字板
function clearNotepad() {
  notepadContent.value = '';
  if (props.entry) {
    const key = NOTEPAD_KEY_PREFIX + props.entry._id;
    localStorage.removeItem(key);
  }
  ElMessage.success('写字板已清空');
}

// 添加提示词
async function addPrompt() {
  if (!props.entry) return;

  const result = await store.addPrompt({
    entryId: props.entry._id,
    title: newPromptForm.value.title.trim(),
    content: newPromptForm.value.content.trim(),
    order: store.currentPrompts.length,
    enabled: newPromptForm.value.enabled
  });

  if (result.ok) {
    ElMessage.success('提示词添加成功');
    newPromptForm.value = { title: '', content: '', enabled: true };
  } else {
    ElMessage.error(typeof result.error === 'string' ? result.error : '添加失败');
  }
}

// 开始编辑
function startEdit(prompt: NumberMemoryPrompt) {
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
async function saveEdit(prompt: NumberMemoryPrompt) {
  if (!editingForm.value.title.trim() || !editingForm.value.content.trim()) {
    ElMessage.warning('标题和内容不能为空');
    return;
  }
  
  const updatedPrompt: NumberMemoryPrompt = {
    ...prompt,
    title: editingForm.value.title.trim(),
    content: editingForm.value.content.trim()
  };
  
  const result = await store.updatePromptItem(updatedPrompt);
  
  if (result.ok) {
    ElMessage.success('提示词更新成功');
    editingPromptId.value = null;
  } else {
    ElMessage.error(typeof result.error === 'string' ? result.error : '更新失败');
  }
}

// 切换启用状态
async function togglePrompt(prompt: NumberMemoryPrompt, enabled: boolean) {
  const updatedPrompt = { ...prompt, enabled };
  const result = await store.updatePromptItem(updatedPrompt);
  
  if (!result.ok) {
    ElMessage.error(typeof result.error === 'string' ? result.error : '操作失败');
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
    
    const result = await store.deletePromptItem(promptId);
    if (result.ok) {
      ElMessage.success('提示词已删除');
    } else {
      ElMessage.error(typeof result.error === 'string' ? result.error : '删除失败');
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
  const prompts = [...store.currentPrompts];
  const [moved] = prompts.splice(dragIndex.value, 1);
  prompts.splice(index, 0, moved);
  
  // 更新顺序
  store.reorderPromptsList(prompts);
  
  dragIndex.value = null;
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
</script>

<style scoped lang="scss">
.prompts-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.header-info {
  padding: 16px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  text-align: center;

  h3 {
    margin: 0 0 10px 0;
    color: var(--utools-text-primary);
  }

  .numbers-display {
    font-size: 24px;
    font-weight: bold;
    color: var(--utools-primary);
    letter-spacing: 4px;
    font-family: monospace;
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
  max-height: 300px;
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
        font-size: 18px;
        line-height: 1.8;
        letter-spacing: 4px;
        font-family: monospace;
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

// 对比样式
.compare-wrapper {
  display: flex;
  gap: 16px;
  margin-bottom: 20px;

  .compare-panel {
    flex: 1;
    border: 1px solid var(--utools-border-color);
    border-radius: 8px;
    overflow: hidden;

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
      max-height: 200px;
      overflow-y: auto;
      font-size: 18px;
      line-height: 2;
      letter-spacing: 4px;
      font-family: monospace;
      word-break: break-all;

      &.original-text {
        background: #f6ffed;
        color: #389e0d;
      }

      &.compared-text {
        background: #fff;

        :deep(.char-error) {
          background: #ff4d4f !important;
          color: #fff !important;
          padding: 0 4px;
          border-radius: 2px;
          text-decoration: line-through;
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
