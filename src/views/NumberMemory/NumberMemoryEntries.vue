<template>
  <div class="number-entries-page">
    <!-- 筛选排序条（仿 WordFilter 的 chip 风格） -->
    <div class="number-filter-bar">
      <!-- 搜索输入框 -->
      <div class="filter-input-wrap">
        <el-icon class="filter-search-icon"><Search /></el-icon>
        <input
          v-model="searchKeyword"
          class="filter-input"
          placeholder="搜索标题或数字..."
          @keyup.enter="emitFilterChange"
        />
        <el-icon v-if="searchKeyword" class="filter-clear-icon" @click="searchKeyword = ''"><CircleClose /></el-icon>
      </div>

      <!-- 标签筛选 -->
      <div class="filter-tags">
        <el-popover
          :visible="tagPopoverVisible"
          placement="bottom-start"
          :width="180"
          :show-arrow="false"
          :offset="2"
        >
          <template #reference>
            <span :class="['ftag', { on: selectedTag }]" @click="tagPopoverVisible = !tagPopoverVisible">
              标签<template v-if="selectedTag">: {{ selectedTag }}</template>
            </span>
          </template>
          <div class="popover-body">
            <div class="tag-chip-row">
              <span
                v-for="tag in store.allTags"
                :key="tag"
                :class="['tag-chip', { on: selectedTag === tag }]"
                @click="selectTag(tag)"
              >{{ tag }}</span>
            </div>
            <div v-if="store.allTags.length === 0" class="no-tags">暂无标签</div>
          </div>
        </el-popover>
      </div>

      <!-- 仅看到期 -->
      <span :class="['ftag', { on: onlyDue }]" @click="onlyDue = !onlyDue">仅看到期</span>

      <!-- 分隔 -->
      <div class="filter-divider"></div>

      <!-- 排序 -->
      <div class="sort-chips">
        <span
          v-for="opt in sortOptions"
          :key="opt.key"
          :class="['schip', { on: sortBy === opt.key }]"
          @click="toggleSort(opt.key)"
        >
          {{ opt.label }}<template v-if="sortBy === opt.key">{{ sortAsc ? '↑' : '↓' }}</template>
        </span>
      </div>

      <!-- 匹配数 -->
      <span class="match-count">{{ filteredEntries.length }} 条</span>
    </div>

    <!-- 条目列表 -->
    <div class="entries-list-wrapper" v-loading="store.entriesLoading">
      <el-empty v-if="filteredEntries.length === 0" :description="onlyDue ? '没有到期条目' : '暂无条目'" />

      <div
        v-for="entry in filteredEntries"
        :key="entry._id"
        class="list-item number-entry-item"
      >
        <!-- 标题行 -->
        <p class="entry-title-line">
          <span class="entry-title-text" :title="entry.title">{{ entry.title }}</span>
          <span class="entry-badges">
            <el-tag size="small" effect="light" class="kind-tag">{{ kindLabels[getEntryKind(entry)] }}</el-tag>
            <el-tag
              size="small"
              :type="getEntryLevel(entry) >= 12 ? 'success' : 'info'"
              class="level-tag"
            >
              L{{ getEntryLevel(entry) }}
            </el-tag>
            <span v-if="entry.reviewCount > 0" class="entry-review-count">
              已复习 {{ entry.reviewCount }} 次
            </span>
          </span>
        </p>

        <!-- 数字主内容 -->
        <div class="entry-number-display" :title="entry.numbers">
          {{ segmentNumber(entry.numbers, getEntryKind(entry)) }}
        </div>

        <!-- 助记提示 -->
        <div v-if="entry.mnemonic" class="entry-mnemonic-line" :title="entry.mnemonic">
          <el-icon><MagicStick /></el-icon>
          {{ entry.mnemonic }}
        </div>

        <!-- 标签行 -->
        <div class="entry-tags-line">
          <el-tag
            v-for="tag in entry.tags"
            :key="tag"
            size="small"
            effect="plain"
          >
            {{ tag }}
          </el-tag>
          <el-tag v-if="entry.tags.length === 0" size="small" type="info">无标签</el-tag>
        </div>

        <!-- 元信息 -->
        <div class="entry-meta-line">
          <span class="meta-date">{{ formatDate(entry.createdAt) }}</span>
          <span v-if="entry.description" class="meta-desc" :title="entry.description">{{ entry.description }}</span>
        </div>

        <!-- 操作按钮（inline icon + tooltip） -->
        <div class="operate">
          <div class="operate-group">
            <el-tooltip class="box-item" effect="dark" content="图片联想" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="handleImageAssociation(entry)"><Picture /></el-icon>
            </el-tooltip>
            <el-tooltip class="box-item" effect="dark" content="填空练习" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="handleFillBlanks(entry)"><EditPen /></el-icon>
            </el-tooltip>
            <el-tooltip v-if="dueEntryIds.has(entry._id)" class="box-item" effect="dark" content="到期复习" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover review-due" :size="20" @click="handleFillBlanks(entry)"><AlarmClock /></el-icon>
            </el-tooltip>
            <el-tooltip class="box-item" effect="dark" content="笔记" placement="top" popper-class="small-tooltip">
              <i class="iconfont icon-notebook-1 iconHover" @click="handleNotes(entry)" />
            </el-tooltip>
            <el-tooltip class="box-item" effect="dark" content="提示词" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="handlePrompts(entry)"><Memo /></el-icon>
            </el-tooltip>
          </div>
          <div class="operate-group">
            <el-tooltip class="box-item" effect="dark" content="编辑" placement="top" popper-class="small-tooltip">
              <i class="iconfont icon-edit iconHover" @click="handleEdit(entry)" />
            </el-tooltip>
            <el-tooltip class="box-item" effect="dark" content="删除" placement="top" popper-class="small-tooltip">
              <i class="iconfont icon-delete iconHover" @click="handleDelete(entry)" />
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部工具栏（仿 Word.vue 的 home_footer） -->
    <div class="home_footer">
      <div>
        <span class="footer-stat" @click="goBack">
          <i class="iconfont icon-left"></i>
          返回
        </span>
        <el-divider direction="vertical" />
        <span class="footer-stat">共 {{ store.entries.length }} 条</span>
        <span v-if="selectedTag" class="footer-stat filter-active" @click="selectedTag = ''">
          标签: {{ selectedTag }}
        </span>
        <span v-if="onlyDue" class="footer-stat filter-active" @click="onlyDue = false">
          仅看到期
        </span>
      </div>
      <div>
        <el-tooltip class="box-item" effect="dark" content="添加条目" placement="top" popper-class="small-tooltip">
          <el-icon :size="20" class="footer-icon" @click="showAddDialog = true"><Plus /></el-icon>
        </el-tooltip>

        <!-- 导入下拉菜单（trigger 直接放图标，不要包 el-tooltip：dropdown 会注入 role="button" 导致 tooltip 校验告警） -->
        <el-dropdown @command="handleImportCommand">
          <i class="iconfont icon-import footer-icon" title="导入"></i>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item command="importJson">JSON 导入</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <el-tooltip class="box-item" effect="dark" content="开始训练" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-list footer-icon" @click="goToTraining"></i>
        </el-tooltip>
      </div>
    </div>

    <!-- 隐藏的文件输入，用于导入 JSON -->
    <input
      ref="importFileInput"
      type="file"
      accept=".json,application/json"
      style="display: none"
      @change="handleImportFileChange"
    />

    <!-- 添加/编辑对话框 -->
    <el-dialog
      v-model="showAddDialog"
      :title="editingEntry ? '编辑条目' : '添加数字记忆条目'"
      width="600px"
    >
      <el-form :model="entryForm" label-width="80px">
        <el-form-item label="标题" required>
          <el-input
            v-model="entryForm.title"
            placeholder="输入标题（如：电话号码、纪念日等）"
            maxlength="50"
            show-word-limit
          />
        </el-form-item>
        <el-form-item label="类型">
          <el-select v-model="entryForm.kind" placeholder="选择数字类型" style="width: 100%">
            <el-option
              v-for="(label, key) in kindLabels"
              :key="key"
              :label="label"
              :value="key"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="数字" required>
          <el-input
            v-model="entryForm.numbers"
            placeholder="输入要记忆的数字（如：13800138000）"
            maxlength="100"
            show-word-limit
          />
          <div v-if="entryForm.numbers && !validationResult.valid" class="validation-tip">
            <el-icon><Warning /></el-icon>
            {{ validationResult.message }}
          </div>
        </el-form-item>
        <el-form-item label="助记">
          <el-input
            v-model="entryForm.mnemonic"
            type="textarea"
            :rows="2"
            placeholder="输入顺口溜/谐音助记（可选）"
            maxlength="200"
            show-word-limit
          />
          <div v-if="entryForm.kind === 'pi'" class="mnemonic-example-tip">
            <el-button link type="primary" size="small" @click="fillMnemonicExample">
              <el-icon><MagicStick /></el-icon>
              填入示例谐音
            </el-button>
          </div>
        </el-form-item>
        <el-form-item label="标签">
          <el-select
            v-model="entryForm.tags"
            multiple
            filterable
            allow-create
            default-first-option
            placeholder="选择或输入标签"
            style="width: 100%"
          >
            <el-option
              v-for="tag in store.allTags"
              :key="tag"
              :label="tag"
              :value="tag"
            />
          </el-select>
        </el-form-item>
        <el-form-item label="描述">
          <el-input
            v-model="entryForm.description"
            type="textarea"
            :rows="2"
            placeholder="输入描述或备注（可选）"
            maxlength="200"
            show-word-limit
          />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddDialog = false">取消</el-button>
        <el-button type="primary" @click="saveEntry" :disabled="!canSave">
          保存
        </el-button>
      </template>
    </el-dialog>

    <!-- 图片联想对话框 -->
    <ImageAssociationDialog
      v-model="showImageAssociationDialog"
      :entry="currentEntry"
    />

    <!-- 填空练习对话框 -->
    <NumberFillBlanksDialog
      v-model="showFillBlanksDialog"
      :entry="currentEntry"
    />

    <!-- 笔记对话框 -->
    <NumberNotesDialog
      v-model="showNotesDialog"
      :entry="currentEntry"
    />

    <!-- 提示词对话框 -->
    <NumberPromptsDialog
      v-model="showPromptsDialog"
      :entry="currentEntry"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import { useNumberMemoryStore } from '@/stores/numberMemory';
import type { NumberMemoryEntry, NumberMemoryKind } from '@/types/number-memory';
import { ElMessage, ElMessageBox } from 'element-plus';
import {
  Plus, Search, CircleClose, EditPen, Memo, Picture, Warning, MagicStick, AlarmClock
} from '@element-plus/icons-vue';
import {
  KIND_LABELS,
  segmentNumber,
  validateNumber,
  getEntryKind,
} from '@/utils/number-memory-format';
import {getEntryLevel, isDue} from '@/utils/number-memory-srs';
import {getMnemonicExample} from '@/utils/number-mnemonic-data';

// 导入子组件
import ImageAssociationDialog from './components/ImageAssociationDialog.vue';
import NumberFillBlanksDialog from './components/NumberFillBlanksDialog.vue';
import NumberNotesDialog from './components/NumberNotesDialog.vue';
import NumberPromptsDialog from './components/NumberPromptsDialog.vue';

const router = useRouter();
const route = useRoute();
const store = useNumberMemoryStore();

// 搜索和筛选
const searchKeyword = ref('');
const selectedTag = ref('');
const tagPopoverVisible = ref(false);
// 「仅看到期」过滤：支持从数字记忆主页到期角标跳转（?due=1）自动开启，与标签筛选叠加
const onlyDue = ref(route.query.due === '1');

// 排序
const sortBy = ref<'time' | 'title' | 'review'>('time');
const sortAsc = ref(false);
const sortOptions = [
  { key: 'time' as const, label: '创建时间' },
  { key: 'title' as const, label: '标题' },
  { key: 'review' as const, label: '复习次数' }
];

// 对话框显示状态
const showAddDialog = ref(false);
const showImageAssociationDialog = ref(false);
const showFillBlanksDialog = ref(false);
const showNotesDialog = ref(false);
const showPromptsDialog = ref(false);

// 当前操作
const editingEntry = ref<NumberMemoryEntry | null>(null);
const currentEntry = ref<NumberMemoryEntry | null>(null);

// 表单
const entryForm = ref({
  title: '',
  numbers: '',
  kind: 'custom' as NumberMemoryKind,
  tags: [] as string[],
  description: '',
  mnemonic: ''
});

// 类型标签
const kindLabels = KIND_LABELS;

// 表单校验提示（仅提示，不阻断保存）
const validationResult = computed(() => {
  return validateNumber(entryForm.value.numbers, entryForm.value.kind);
});

// 导入文件输入
const importFileInput = ref<HTMLInputElement | null>(null);

// 过滤并排序后的条目
const filteredEntries = computed(() => {
  let result = [...store.entries];

  // 按关键词搜索
  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(entry =>
      entry.title.toLowerCase().includes(keyword) ||
      entry.numbers.includes(keyword)
    );
  }

  // 按标签筛选
  if (selectedTag.value) {
    result = result.filter(entry =>
      entry.tags.includes(selectedTag.value)
    );
  }

  // 仅看到期（与搜索/标签筛选叠加）
  if (onlyDue.value) {
    const now = Date.now();
    result = result.filter(entry => isDue(entry, now));
  }

  // 排序
  result.sort((a, b) => {
    let compare = 0;
    switch (sortBy.value) {
      case 'time':
        compare = a.createdAt - b.createdAt;
        break;
      case 'title':
        compare = a.title.localeCompare(b.title, 'zh-CN');
        break;
      case 'review':
        compare = a.reviewCount - b.reviewCount;
        break;
    }
    return sortAsc.value ? compare : -compare;
  });

  return result;
});

// 是否可以保存
const canSave = computed(() => {
  return entryForm.value.title.trim() && entryForm.value.numbers.trim();
});

// 初始化加载
onMounted(async () => {
  await store.loadEntries();
  document.addEventListener('click', onDocClick, true);
});

onUnmounted(() => {
  document.removeEventListener('click', onDocClick, true);
});

// 点击外部关闭标签 popover
const onDocClick = (e: MouseEvent) => {
  if (tagPopoverVisible.value) {
    const target = e.target as HTMLElement;
    if (!target.closest('.el-popover') && !target.closest('.ftag')) {
      tagPopoverVisible.value = false;
    }
  }
};

// 选择标签
const selectTag = (tag: string) => {
  selectedTag.value = selectedTag.value === tag ? '' : tag;
  tagPopoverVisible.value = false;
};

// 切换排序
const toggleSort = (key: 'time' | 'title' | 'review') => {
  if (sortBy.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortBy.value = key;
    sortAsc.value = key === 'title';
  }
};

// 搜索框回车触发筛选（主要用于收起键盘等场景）
const emitFilterChange = () => {
  // 搜索框回车占位：筛选已实时响应，无需额外动作
};

// 格式化日期
function formatDate(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleDateString('zh-CN');
}

// 返回
function goBack() {
  router.push('/number-memory');
}

// 去训练
function goToTraining() {
  router.push('/number-memory/training');
}

// 保存条目
async function saveEntry() {
  // 校验不通过时仅提示，不阻断保存
  const validation = validateNumber(entryForm.value.numbers, entryForm.value.kind);
  if (!validation.valid) {
    ElMessage.warning(validation.message || '格式可能有误，仍允许保存');
  }

  if (editingEntry.value) {
    // 更新
    const updated: NumberMemoryEntry = {
      ...editingEntry.value,
      title: entryForm.value.title.trim(),
      numbers: entryForm.value.numbers.trim(),
      kind: entryForm.value.kind,
      tags: entryForm.value.tags,
      description: entryForm.value.description?.trim(),
      mnemonic: entryForm.value.mnemonic?.trim()
    };
    const result = await store.updateEntryItem(updated);
    if (result.ok) {
      ElMessage.success('更新成功');
      showAddDialog.value = false;
      resetForm();
    } else {
      ElMessage.error('更新失败');
    }
  } else {
    // 新增
    const result = await store.addEntry(
      entryForm.value.title.trim(),
      entryForm.value.numbers.trim(),
      entryForm.value.tags,
      entryForm.value.description?.trim(),
      entryForm.value.kind,
      entryForm.value.mnemonic?.trim()
    );
    if (result.ok) {
      ElMessage.success('添加成功');
      showAddDialog.value = false;
      resetForm();
    } else {
      ElMessage.error('添加失败');
    }
  }
}

// 重置表单
function resetForm() {
  entryForm.value = {
    title: '',
    numbers: '',
    kind: 'custom',
    tags: [],
    description: '',
    mnemonic: ''
  };
  editingEntry.value = null;
}

// 编辑条目
function handleEdit(entry: NumberMemoryEntry) {
  editingEntry.value = entry;
  entryForm.value = {
    title: entry.title,
    numbers: entry.numbers,
    kind: getEntryKind(entry),
    tags: [...entry.tags],
    description: entry.description || '',
    mnemonic: entry.mnemonic || ''
  };
  showAddDialog.value = true;
}

// 填入谐音示例
function fillMnemonicExample() {
  const example = getMnemonicExample(entryForm.value.kind, entryForm.value.numbers);
  if (example) {
    entryForm.value.mnemonic = example;
  } else {
    ElMessage.info('暂无该类型的示例助记');
  }
}

// 到期条目的 id 集合：渲染前按当前条目列表预计算，避免对每条目重复判定
const dueEntryIds = computed(() => {
  const now = Date.now();
  const ids = new Set<string>();
  for (const entry of store.entries) {
    if (isDue(entry, now)) {
      ids.add(entry._id);
    }
  }
  return ids;
});

// 删除条目
async function handleDelete(entry: NumberMemoryEntry) {
  try {
    await ElMessageBox.confirm(
      `确定要删除条目 "${entry.title}" 吗？相关的笔记和提示词也会被删除。`,
      '确认删除',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning'
      }
    );

    const result = await store.deleteEntryItem(entry._id);
    if (result.ok) {
      ElMessage.success('删除成功');
    } else {
      ElMessage.error('删除失败');
    }
  } catch {
    // 用户取消
  }
}

// 图片联想
function handleImageAssociation(entry: NumberMemoryEntry) {
  currentEntry.value = entry;
  showImageAssociationDialog.value = true;
}

// 填空练习
function handleFillBlanks(entry: NumberMemoryEntry) {
  currentEntry.value = entry;
  showFillBlanksDialog.value = true;
}

// 笔记
function handleNotes(entry: NumberMemoryEntry) {
  currentEntry.value = entry;
  showNotesDialog.value = true;
}

// 提示词
function handlePrompts(entry: NumberMemoryEntry) {
  currentEntry.value = entry;
  showPromptsDialog.value = true;
}

// 导入命令
const handleImportCommand = (command: string) => {
  if (command === 'importJson') {
    importFileInput.value?.click();
  }
};

// 处理导入文件选择
const handleImportFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;

  try {
    const text = await file.text();
    const data = JSON.parse(text);

    if (!Array.isArray(data)) {
      throw new Error('文件格式错误：根节点必须是数组');
    }

    let successCount = 0;
    for (const item of data) {
      const title = String(item.title || '').trim();
      const numbers = String(item.numbers || '').trim();
      if (!title || !numbers) continue;

      const tags = Array.isArray(item.tags) ? item.tags.map(String).filter(Boolean) : [];
      const description = item.description ? String(item.description).trim() : undefined;
      const kind = item.kind || 'custom';
      const mnemonic = item.mnemonic ? String(item.mnemonic).trim() : undefined;

      const result = await store.addEntry(title, numbers, tags, description, kind, mnemonic);
      if (result.ok) {
        successCount++;
      }
    }

    ElMessage.success(`成功导入 ${successCount} 条条目`);
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败');
  } finally {
    // 清空 input，允许重复选择同一文件
    input.value = '';
  }
};

// 监听对话框关闭
watch(showAddDialog, (val) => {
  if (!val) {
    resetForm();
  }
});

// 各功能对话框关闭后清理当前条目引用，避免残留
watch(
  [showImageAssociationDialog, showFillBlanksDialog, showNotesDialog, showPromptsDialog],
  () => {
    if (
      !showImageAssociationDialog.value &&
      !showFillBlanksDialog.value &&
      !showNotesDialog.value &&
      !showPromptsDialog.value
    ) {
      currentEntry.value = null;
    }
  }
);
</script>

<style scoped lang="scss">
.number-entries-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
  padding-bottom: 55px; // 为底部工具栏留出空间
  box-sizing: border-box;
}

// ---- 筛选排序条（复用 WordFilter 的 chip 风格） ----
.number-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  background: var(--utools-bg-card);
  border-bottom: 1px solid var(--utools-border-divider);
  position: relative;
  z-index: 10;
  font-size: 12px;
}

.filter-input-wrap {
  display: flex;
  align-items: center;
  flex: 1;
  min-width: 120px;
  max-width: 260px;
  height: 24px;
  background: var(--utools-bg-tertiary);
  border-radius: 4px;
  border: 1px solid var(--utools-border-divider);
  padding: 0 6px;
  transition: border-color 0.2s;

  &:focus-within {
    border-color: var(--utools-primary);
  }

  .filter-search-icon,
  .filter-clear-icon {
    font-size: 13px;
    color: var(--utools-text-tertiary);
    flex-shrink: 0;
  }

  .filter-clear-icon {
    cursor: pointer;
    &:hover { color: var(--utools-text-secondary); }
  }

  .filter-input {
    flex: 1;
    border: none;
    outline: none;
    background: transparent;
    font-size: 12px;
    color: var(--utools-text-primary);
    padding: 0 4px;
    height: 100%;
    min-width: 0;

    &::placeholder {
      color: var(--utools-text-tertiary);
    }
  }
}

.filter-tags {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.ftag {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-tertiary);
  color: var(--utools-text-secondary);
  white-space: nowrap;
  user-select: none;
  transition: all 0.15s;

  &:hover {
    border-color: var(--utools-primary);
    color: var(--utools-primary);
  }

  &.on {
    background: var(--utools-primary);
    color: var(--utools-text-inverse);
    border-color: var(--utools-primary);
  }
}

.filter-divider {
  width: 1px;
  height: 16px;
  background: var(--utools-border-divider);
  flex-shrink: 0;
}

.sort-chips {
  display: flex;
  align-items: center;
  gap: 3px;
  flex-shrink: 0;
}

.schip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 7px;
  border-radius: 3px;
  cursor: pointer;
  color: var(--utools-text-tertiary);
  user-select: none;
  white-space: nowrap;
  transition: all 0.15s;

  &:hover {
    color: var(--utools-text-primary);
    background: var(--utools-bg-hover);
  }

  &.on {
    color: var(--utools-primary);
    font-weight: 500;
  }
}

.match-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--utools-text-tertiary);
  flex-shrink: 0;
}

// ---- Popover 内容 ----
.popover-body {
  padding: 6px 8px;
}

.tag-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  max-height: 200px;
  overflow-y: auto;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  height: 22px;
  padding: 0 8px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid var(--utools-border-divider);
  background: var(--utools-bg-tertiary);
  color: var(--utools-text-secondary);
  font-size: 12px;
  white-space: nowrap;
  user-select: none;
  transition: all 0.15s;

  &:hover {
    border-color: var(--utools-primary);
    color: var(--utools-primary);
  }

  &.on {
    background: var(--utools-primary);
    color: var(--utools-text-inverse);
    border-color: var(--utools-primary);
  }
}

.no-tags {
  font-size: 12px;
  color: var(--utools-text-tertiary);
  padding: 4px 0;
}

// ---- 列表区域 ----
.entries-list-wrapper {
  width: 100%;
  min-height: calc(100vh - 32px - 55px);
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

// ---- 复用全局 .list-item 并针对数字条目做局部调整 ----
.number-entry-item {
  width: 92%;
  min-height: auto;
  max-height: none;
  padding: 12px;
  margin-bottom: 8px;

  .entry-title-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 16px;
    font-weight: 600;
    padding: 0;
    margin: 0 0 8px 0;
    color: var(--utools-text-primary);

    .entry-title-text {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .entry-badges {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;

      .kind-tag,
      .level-tag {
        font-size: 11px;
      }
    }

    .entry-review-count {
      font-size: 12px;
      font-weight: normal;
      color: var(--utools-text-tertiary);
      margin-left: 8px;
      flex-shrink: 0;
    }
  }

  .entry-number-display {
    font-size: 28px;
    font-weight: bold;
    color: var(--utools-primary);
    letter-spacing: 4px;
    font-family: monospace;
    margin-bottom: 10px;
    word-break: break-all;
  }

  .entry-tags-line {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    margin-bottom: 8px;
  }

  .entry-mnemonic-line {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--utools-warning);
    margin-bottom: 8px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .entry-meta-line {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    font-size: 12px;
    color: var(--utools-text-secondary);
    margin-bottom: 8px;

    .meta-desc {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      color: var(--utools-text-tertiary);
    }
  }

  // 操作按钮：保持与 MyListItem 一致的 inline 风格
  .operate {
    margin-top: 4px;

    .operate-group {
      display: inline-flex;
      align-items: center;
      gap: 8px;
    }

    .iconHover {
      font-size: 20px;
      padding: 6px;
      border-radius: 6px;
      transition: all 0.2s;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      justify-content: center;

      &:hover {
        background-color: var(--utools-bg-hover);
        transform: scale(1.1);
      }
    }

    // 覆盖全局 .list-item .operate i + i 的 12px 外边距，统一使用 flex gap
    .operate-group .iconHover + .iconHover {
      margin-left: 0;
    }

    .review-due {
      color: var(--utools-warning);

      &:hover {
        background-color: color-mix(in srgb, var(--utools-warning) 12%, transparent);
      }
    }
  }
}

// 表单校验提示
.validation-tip {
  margin-top: 4px;
  font-size: 12px;
  color: var(--utools-warning);
  display: flex;
  align-items: center;
  gap: 4px;
}

.mnemonic-example-tip {
  margin-top: 4px;
}

// ---- 底部工具栏（复用 Word.vue 的 home_footer 结构） ----
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
  border-radius: 0;
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

    i {
      font-size: 14px;
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
    vertical-align: middle;
    color: var(--utools-text-primary);

    &:hover {
      background-color: var(--utools-bg-hover);
      transform: scale(1.1);
    }
  }

  .filter-active {
    color: var(--utools-primary);
    background-color: var(--utools-bg-hover);
    border-radius: 4px;
    padding: 2px 6px;
  }
}

// 覆盖 el-dropdown 触发区域，使其与相邻图标一致
.home_footer .el-dropdown {
  display: inline-flex;
  align-items: center;
}
</style>
