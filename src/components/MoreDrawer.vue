<template>
  <el-drawer
      v-model="visible"
      direction="btt"
      size="62%"
      :with-header="false"
      class="more-drawer"
  >
    <!-- 导入/导出 二级面板 -->
    <template v-if="ioPanel !== 'none'">
      <div class="drawer-title" @click="ioPanel = 'none'">
        <span class="back-link">‹ 返回</span>
        导入 / 导出
      </div>
      <div :class="['d-item', { disabled: importDisabled }]" @click="onImportCommand('importJson')">
        <span>JSON 导入</span>
        <small v-if="importDisabled">仅「待复习」模式可用</small>
      </div>
      <div :class="['d-item', { disabled: importDisabled }]" @click="onImportCommand('importText')">
        <span>TXT / CSV 导入</span>
        <small v-if="importDisabled">仅「待复习」模式可用</small>
      </div>
      <div :class="['d-item', { disabled: importDisabled }]" @click="onImportCommand('importFromWordBank')">
        <span>从内置词库导入</span>
        <small v-if="importDisabled">仅「待复习」模式可用</small>
      </div>
      <div class="d-item" @click="onExportCommand('exportJson')"><span>导出 JSON</span></div>
      <div class="d-item" @click="onExportCommand('exportText')"><span>导出 TXT</span></div>
    </template>

    <!-- 主面板 -->
    <template v-else>
      <h4>记忆训练</h4>
      <div v-for="item in memoryItems" :key="item.key" class="d-item" @click="go(item.key, item.path)">
        <span>{{ item.label }}</span>
        <small>{{ item.summary }}</small>
      </div>

      <h4>工具与评估</h4>
      <div v-for="item in toolItems" :key="item.key" class="d-item" @click="go(item.key, item.path)">
        <span>{{ item.label }}</span>
        <small>{{ item.summary }}</small>
      </div>

      <h4>辅助</h4>
      <div class="d-item" @click="go('letter-memory', '/letter-memory')"><span>🔤 字母映射</span></div>
      <div class="d-item" @click="go('phonetic-memory', '/phonetic-memory')"><span>🎵 音标学习</span></div>
      <div class="d-item" @click="go('memory-palace', '/memory-palace')">
        <span>🏛️ 记忆宫殿</span>
        <small>{{ memoryPalaceSummary }}</small>
      </div>
      <div class="d-item" @click="go('shortcut-memory', '/shortcut-memory')"><span>⌨️ 快捷键记忆</span></div>

      <h4>数据</h4>
      <div class="d-item" @click="openImportExportPanel">
        <span>📥 导入 / 📤 导出</span>
        <small v-if="importDisabled">导入仅「待复习」模式可用</small>
      </div>
      <div class="d-item" @click="onSync"><span>☁️ 同步与备份</span></div>
      <div class="d-item" @click="onSettings"><span>⚙️ 设置</span><small>翻译引擎 · API Key · 快捷键</small></div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRouter, useRoute} from 'vue-router';
import {useNumberMemoryStore} from '@/stores/numberMemory';
import {useTextMemoryStore} from '@/stores/textMemory';
import {useKnowledgeMemoryStore} from '@/stores/knowledgeMemory';
import {useSentencesStore} from '@/stores/sentences';
import {useMemoryStore} from '@/stores/memory';
import {useMemoryPalaceStore} from '@/stores/memoryPalace';
import {getDbStorage} from '@/adapters/db';

const props = defineProps<{
  modelValue: boolean;
  /** 已复习/已记完模式下禁用导入（与原工具栏导入下拉一致） */
  importDisabled?: boolean;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void;
  (e: 'importCommand', cmd: string): void;
  (e: 'exportCommand', cmd: string): void;
  (e: 'sync'): void;
  (e: 'settings'): void;
}>();

const router = useRouter();
const route = useRoute();
const ioPanel = ref<'none' | 'io'>('none');

// ===== 「更多」菜单使用频率排序（P2） =====
const USAGE_KEY = 'slowlyrecord_more_usage';
const usageCounts = ref<Record<string, number>>({});

function loadUsage() {
  try {
    const raw = getDbStorage().getItem(USAGE_KEY);
    usageCounts.value = raw && typeof raw === 'object' ? raw : {};
  } catch {
    usageCounts.value = {};
  }
}

function recordUsage(key: string) {
  const next = {...usageCounts.value, [key]: (usageCounts.value[key] || 0) + 1};
  usageCounts.value = next;
  try {
    getDbStorage().setItem(USAGE_KEY, next);
  } catch { /* 忽略：存储不可用不影响跳转 */ }
}

/** 按使用频率降序排序（未用过的保持原顺序） */
function sortByUsage<T extends {key: string}>(list: T[]): T[] {
  return [...list].sort((a, b) => (usageCounts.value[b.key] || 0) - (usageCounts.value[a.key] || 0));
}

const numberMemoryStore = useNumberMemoryStore();
const textMemoryStore = useTextMemoryStore();
const knowledgeMemoryStore = useKnowledgeMemoryStore();
const sentencesStore = useSentencesStore();
const memoryStore = useMemoryStore();
const memoryPalaceStore = useMemoryPalaceStore();

const visible = computed({
  get: () => props.modelValue,
  set: (v) => {
    emit('update:modelValue', v);
    if (!v) ioPanel.value = 'none';
  },
});

const close = () => { visible.value = false; };

const go = (key: string, path: string) => {
  recordUsage(key);
  close();
  router.push({ path, query: { from: route.fullPath } });
};

const openImportExportPanel = () => {
  ioPanel.value = 'io';
};

const onImportCommand = (cmd: string) => {
  if (props.importDisabled) return;
  close();
  emit('importCommand', cmd);
};

const onExportCommand = (cmd: string) => {
  close();
  emit('exportCommand', cmd);
};

const onSync = () => {
  close();
  emit('sync');
};

const onSettings = () => {
  close();
  emit('settings');
};

// 状态摘要
const numberMemorySummary = computed(() => {
  const due = numberMemoryStore.dueEntries?.length ?? 0;
  if (due > 0) return `⏰ ${due} 条到期`;
  const count = numberMemoryStore.associationCount ?? 0;
  return count > 0 ? `已配置 ${count} 条映射` : '';
});

const textMemorySummary = computed(() => {
  const total = textMemoryStore.totalArticles ?? 0;
  return total > 0 ? `已收集 ${total} 篇` : '';
});

const knowledgeMemorySummary = computed(() => {
  const imported = knowledgeMemoryStore.importedIds?.length ?? 0;
  return imported > 0 ? `已导入 ${imported} 个包` : '';
});

const sentencesSummary = computed(() => {
  const count = sentencesStore.sentences?.length ?? 0;
  return count > 0 ? `已收集 ${count} 句` : '';
});

const memoryTestSummary = computed(() => {
  const total = memoryStore.totalTests ?? 0;
  return total > 0 ? `已完成 ${total} 次` : '';
});

const memoryPalaceSummary = computed(() => {
  const count = memoryPalaceStore.palaces?.length ?? 0;
  return count > 0 ? `已创建 ${count} 座宫殿` : '';
});

// 按使用频率排序后的菜单项（P2：高频功能自动上浮）
const memoryItems = computed(() => sortByUsage([
  {key: 'number-memory', label: '🔢 数字记忆', summary: numberMemorySummary.value, path: '/number-memory'},
  {key: 'text-memory', label: '📜 文本记忆', summary: textMemorySummary.value, path: '/text-memory'},
  {key: 'knowledge-memory', label: '🎓 知识库', summary: knowledgeMemorySummary.value, path: '/knowledge-memory'},
  {key: 'sentences', label: '📖 句子库', summary: sentencesSummary.value, path: '/sentences'},
]));

const toolItems = computed(() => sortByUsage([
  {key: 'translate', label: '⚡ 快速翻译', summary: '', path: '/translate'},
  {key: 'memory', label: '🧪 记忆力测试', summary: memoryTestSummary.value, path: '/memory'},
]));

onMounted(async () => {
  loadUsage();
  // 静默预加载各模块状态，用于抽屉摘要展示
  try {
    numberMemoryStore.loadAssociations();
    await numberMemoryStore.loadEntries();
  } catch (e) { /* ignore */ }
  try {
    await textMemoryStore.loadArticles();
  } catch (e) { /* ignore */ }
  try {
    await knowledgeMemoryStore.loadImportedIds();
  } catch (e) { /* ignore */ }
  try {
    await sentencesStore.load();
  } catch (e) { /* ignore */ }
  try {
    await memoryPalaceStore.loadPalaces();
  } catch (e) { /* ignore */ }
});
</script>

<style lang="scss">
/* 抽屉内容样式（非 scoped：el-drawer 挂载在 body 下） */
.more-drawer {
  .el-drawer__body {
    padding: 14px 18px 20px;
    background: var(--utools-bg-tertiary);
  }

  h4 {
    font-size: 13px;
    color: var(--utools-text-tertiary);
    margin: 12px 0 6px;
    font-weight: 500;
  }

  .drawer-title {
    font-size: 14px;
    font-weight: 600;
    color: var(--utools-text-primary);
    margin-bottom: 10px;
    cursor: pointer;

    .back-link {
      color: var(--utools-primary);
      margin-right: 10px;
      font-weight: 400;
    }
  }

  .d-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--utools-bg-card);
    border-radius: 10px;
    padding: 12px 14px;
    margin-bottom: 8px;
    font-size: 14px;
    color: var(--utools-text-primary);
    cursor: pointer;

    &:hover {
      background: var(--utools-bg-hover);
    }

    &.disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    small {
      color: var(--utools-text-tertiary);
      font-size: 12px;
    }
  }
}
</style>
