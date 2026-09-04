<template>
  <!-- 知识包卡片面板：只展示「已导入」的知识包（math → 数字记忆，text → 文本记忆），仿内置词库导入模式 -->
  <div class="knowledge-pack-panel" v-loading="store.loading">
    <!-- 顶部工具行：关键词搜索 + 导入入口（useExternalImport 时导入入口由宿主页统一按钮承担，不重复渲染） -->
    <div v-if="cards.length > 0 || !useExternalImport" class="panel-toolbar">
      <el-input
        v-if="cards.length > 0"
        v-model="keyword"
        class="pack-search"
        size="small"
        clearable
        :prefix-icon="Search"
        placeholder="搜索知识库名称或描述"
      />
      <el-button size="small" type="primary" plain @click="handleOpenImport">导入</el-button>
    </div>

    <el-empty v-if="cards.length === 0" description="暂无知识库，点击右上角导入" />
    <el-empty
      v-else-if="cardGroups.length === 0"
      :description="`没有匹配「${keyword.trim()}」的知识库`"
    />

    <div v-for="group in cardGroups" :key="group.label" class="pack-group">
      <div class="pack-group-title">
        {{ group.label }}<span class="group-count">{{ group.count }}</span>
      </div>

      <div
        v-for="pack in group.packs"
        :key="pack.id"
        class="list-item knowledge-pack-card"
        @click="goPack(pack.id)"
      >
        <div class="pack-header-line">
          <span v-if="emojisOf(pack.id)" class="pack-emojis">{{ emojisOf(pack.id) }}</span>
          <span class="pack-name" :title="pack.name">{{ pack.name }}</span>
          <span class="pack-count">{{ getTotal(pack.id) }} 条</span>
        </div>

        <p class="pack-desc" :title="pack.description">{{ pack.description }}</p>

        <div class="pack-tags">
          <el-tag v-if="pack.custom" size="small" type="warning">自建</el-tag>
          <template v-else>
            <el-tag v-if="pack.ordered" size="small" type="warning">有序</el-tag>
            <el-tag v-if="pack.usableAsPeg" size="small" type="success">可用作桩库</el-tag>
            <el-tag v-if="!pack.ordered && !pack.usableAsPeg" size="small" type="info">无序</el-tag>
          </template>
        </div>

        <div class="pack-progress">
          <div class="progress-bar">
            <div
              class="progress-fill"
              :style="{ width: getProgressPercent(pack.id) + '%' }"
            ></div>
          </div>
          <span class="progress-text">
            已掌握 {{ getMastered(pack.id) }} / {{ getTotal(pack.id) }}
            <template v-if="getDue(pack.id) > 0">· 待复习 {{ getDue(pack.id) }}</template>
          </span>
          <!-- 内置包「移除」仅下架展示（进度保留）；自建集「删除」会连条目和进度一起删除 -->
          <el-button
            v-if="pack.custom"
            class="pack-remove-btn"
            size="small"
            text
            type="danger"
            @click.stop="handleDeleteCustom(pack)"
          >删除</el-button>
          <el-button
            v-else
            class="pack-remove-btn"
            size="small"
            text
            type="danger"
            @click.stop="handleRemove(pack.id, pack.name)"
          >移除</el-button>
        </div>
      </div>
    </div>

    <!-- 导入对话框：列出当前分类的全部内置包，按「可否作桩库」分组（useExternalImport 时由宿主统一对话框承担） -->
    <el-dialog
      v-if="!useExternalImport"
      v-model="showImportDialog"
      title="导入知识库"
      width="560px"
      append-to-body
    >
      <el-input
        v-model="dialogKeyword"
        class="import-search"
        size="small"
        clearable
        placeholder="搜索知识库名称或描述"
      />
      <div v-if="importGroups.length === 0" class="import-empty">
        {{ dialogKeyword.trim() ? '没有匹配的知识库' : '暂无可导入的知识库' }}
      </div>
      <div v-for="group in importGroups" :key="group.label" class="import-group">
        <div class="import-group-title">{{ group.label }}</div>
        <div
          v-for="p in group.packs"
          :key="p.id"
          class="import-pack-row"
          :class="{ imported: isImported(p.id) }"
        >
          <div class="import-pack-info">
            <div class="import-pack-name">
              <span v-if="emojisOf(p.id)" class="pack-emojis">{{ emojisOf(p.id) }}</span>
              {{ p.name }}
              <span class="import-pack-count">{{ p.itemCount }} 条</span>
            </div>
            <div class="import-pack-desc" :title="p.description">{{ p.description }}</div>
          </div>
          <el-button
            size="small"
            type="primary"
            :disabled="isImported(p.id)"
            @click="handleImport(p.id)"
          >
            {{ isImported(p.id) ? '已导入' : '导入' }}
          </el-button>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {ElMessage, ElMessageBox} from 'element-plus';
import {useKnowledgeMemoryStore} from '@/stores/knowledgeMemory';
import {Search} from '@element-plus/icons-vue';
import {loadPackPreviews, packPreviewEmojis} from '@/utils/knowledge-pack-preview';
import type {KnowledgePackCategory, KnowledgePackInfo} from '@/types/knowledge-memory';

/** 面板卡片：元数据 + 是否自建集标记 */
type PackCard = KnowledgePackInfo & {custom: boolean};

const props = defineProps<{
  category: KnowledgePackCategory;
  // true 时点击「导入」改为 emit('openImport') 通知父级打开统一对话框，不再使用内置导入对话框
  useExternalImport?: boolean;
}>();

const emit = defineEmits<{
  (e: 'openImport'): void;
}>();

const router = useRouter();
const store = useKnowledgeMemoryStore();

const showImportDialog = ref(false);
// 卡片搜索关键词
const keyword = ref('');
// 导入对话框搜索关键词
const dialogKeyword = ref('');
// 按需加载的包配图缩略预览（packId → emoji 串）
const previewMap = ref<Record<string, string>>({});

// 关键词匹配：名称或描述包含即可
function matchKeyword(info: KnowledgePackInfo, kw: string): boolean {
  if (!kw) return true;
  return info.name.toLowerCase().includes(kw) || info.description.toLowerCase().includes(kw);
}

// 已导入的包（面板只展示这些）
const packs = computed(() =>
  store.packList.filter(p => p.category === props.category && store.importedIds.includes(p.id)),
);

// 自建知识集（仅文本记忆分类展示，与内置包同样的卡片样式，标签为「自建」）
const customPacks = computed(() =>
  props.category === 'text' ? store.customPackList : [],
);

// 面板卡片列表：已导入内置包 + 自建知识集
const cards = computed<Array<KnowledgePackInfo & {custom: boolean}>>(() => [
  ...packs.value.map(p => ({...p, custom: false})),
  ...customPacks.value.map(p => ({...p, custom: true})),
]);

// 按「内置 / 自建」分组的卡片（先过滤关键词，再分组；过滤掉某组则不渲染组标题）
const cardGroups = computed<Array<{label: string; count: number; packs: PackCard[]}>>(() => {
  const kw = keyword.value.trim().toLowerCase();
  const groups: Array<{label: string; packs: PackCard[]}> = [
    {label: '内置知识库', packs: packs.value.filter(p => matchKeyword(p, kw)).map(p => ({...p, custom: false}))},
    {label: '自建知识集', packs: customPacks.value.filter(p => matchKeyword(p, kw)).map(p => ({...p, custom: true}))},
  ].filter(g => g.packs.length > 0);
  return groups.map(g => ({label: g.label, count: g.packs.length, packs: g.packs}));
});

// 当前分类下的全部内置包（导入对话框候选）
const allPacks = computed(() => store.packList.filter(p => p.category === props.category));

// 导入对话框候选分组：可用作记忆宫殿桩库的包优先展示
const importGroups = computed<Array<{label: string; count: number; packs: KnowledgePackInfo[]}>>(() => {
  const kw = dialogKeyword.value.trim().toLowerCase();
  const filtered = allPacks.value.filter(p => matchKeyword(p, kw));
  const groups: Array<{label: string; packs: KnowledgePackInfo[]}> = [
    {label: '可用作记忆宫殿桩库', packs: filtered.filter(p => p.usableAsPeg)},
    {label: '普通知识库', packs: filtered.filter(p => !p.usableAsPeg)},
  ].filter(g => g.packs.length > 0);
  return groups.map(g => {
    return {label: g.label, count: g.packs.length, packs: g.packs};
  });
});

function isImported(packId: string): boolean {
  return store.importedIds.includes(packId);
}

// 包配图缩略串：优先取已加载到 store 的包内容，其次取按需加载的预览
function emojisOf(packId: string): string {
  return packPreviewEmojis(store.getPack(packId)?.items) || previewMap.value[packId] || '';
}

function getTotal(packId: string): number {
  if (store.isPackLoaded(packId)) return store.getTotalCount(packId);
  const info = store.packList.find(p => p.id === packId) ?? store.customPackList.find((p: KnowledgePackInfo) => p.id === packId);
  return info?.itemCount ?? 0;
}

function getMastered(packId: string): number {
  return store.isPackLoaded(packId) ? store.getMasteredCount(packId) : 0;
}

function getDue(packId: string): number {
  return store.isPackLoaded(packId) ? store.getDueCount(packId) : 0;
}

function getProgressPercent(packId: string): number {
  const total = getTotal(packId);
  if (total === 0) return 0;
  return Math.round((getMastered(packId) / total) * 100);
}

function goPack(packId: string) {
  router.push(`/knowledge-memory/${packId}`);
}

// 点击「导入」：外部模式通知父级，否则打开内置导入对话框并顺带加载缩略预览
function handleOpenImport() {
  if (props.useExternalImport) {
    emit('openImport');
    return;
  }
  showImportDialog.value = true;
  loadPackPreviews(allPacks.value).then(map => {
    Object.assign(previewMap.value, map);
  });
}

// 导入知识包：加入清单并加载
async function handleImport(packId: string) {
  await store.importPack(packId);
  ElMessage.success('导入成功');
}

// 移除知识包：确认后下架（进度文档保留）
async function handleRemove(packId: string, name: string) {
  try {
    await ElMessageBox.confirm(
      `移除「${name}」后将不再显示在列表中，学习进度会保留，重新导入后可继续。`,
      '移除知识库',
      {
        confirmButtonText: '移除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    // 用户取消
    return;
  }
  await store.removeImportedPack(packId);
  ElMessage.success('已移除');
}

// 删除自建知识集：确认后删除该集全部条目及进度（不可恢复）
async function handleDeleteCustom(pack: KnowledgePackInfo) {
  try {
    await ElMessageBox.confirm(
      `删除「${pack.name}」将永久删除该集全部 ${pack.itemCount} 条自建条目及学习进度，且不可恢复。`,
      '删除自建知识集',
      {
        confirmButtonText: '删除',
        cancelButtonText: '取消',
        type: 'warning',
      },
    );
  } catch {
    // 用户取消
    return;
  }
  await store.removeCustomSet(pack.name);
  ElMessage.success('已删除');
}

// 加载已导入清单（含老用户进度自动并入）与自建条目，再加载各包内容用于进度统计，失败静默忽略
onMounted(async () => {
  try {
    await store.loadImportedIds();
    await store.loadCustomItems();
  } catch {
    // 清单加载失败时按空清单展示
    return;
  }
  cards.value.forEach(p => {
    if (!store.isPackLoaded(p.id)) {
      store.loadPack(p.id).catch(() => undefined);
    }
  });
});
</script>

<style scoped lang="scss">
.knowledge-pack-panel {
  width: 100%;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.panel-toolbar {
  width: 92%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 8px;

  .pack-search {
    width: 260px;
    flex-shrink: 0;
  }
}

// 卡片分组标题（内置知识库 / 自建知识集）
.pack-group-title {
  width: 92%;
  display: flex;
  align-items: baseline;
  gap: 6px;
  margin: 4px 0 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--utools-text-secondary);

  .group-count {
    font-size: 12px;
    font-weight: 400;
    color: var(--utools-text-tertiary);
  }
}

// 缩略配图（emoji 串）
.pack-emojis {
  flex-shrink: 0;
  margin-right: 6px;
  font-size: 15px;
  letter-spacing: 1px;
  line-height: 1;
}

// 卡片样式仿原知识包列表页
.knowledge-pack-card {
  width: 92%;
  min-height: auto;
  max-height: none;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;

  .pack-header-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;

    .pack-name {
      font-size: 16px;
      font-weight: 600;
      color: var(--utools-text-primary);
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .pack-count {
      font-size: 12px;
      color: var(--utools-text-tertiary);
      flex-shrink: 0;
    }
  }

  .pack-desc {
    margin: 0 0 10px 0;
    font-size: 13px;
    color: var(--utools-text-secondary);
    line-height: 1.5;
    overflow: hidden;
    text-overflow: ellipsis;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    -webkit-box-orient: vertical;
  }

  .pack-tags {
    display: flex;
    gap: 6px;
    margin-bottom: 10px;
  }

  .pack-progress {
    display: flex;
    align-items: center;
    gap: 10px;

    .progress-bar {
      flex: 1;
      height: 6px;
      background: var(--utools-bg-tertiary);
      border-radius: 3px;
      overflow: hidden;

      .progress-fill {
        height: 100%;
        background: var(--utools-primary);
        border-radius: 3px;
        transition: width 0.3s;
      }
    }

    .progress-text {
      font-size: 12px;
      color: var(--utools-text-secondary);
      flex-shrink: 0;
    }

    .pack-remove-btn {
      flex-shrink: 0;
      margin-left: auto;
    }
  }
}

// 导入对话框：搜索框
.import-search {
  margin-bottom: 8px;
}

// 导入对话框：候选包分组标题
.import-group-title {
  padding: 8px 4px 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--utools-text-secondary);

  &:first-child {
    padding-top: 4px;
  }
}

// 导入对话框行样式
.import-pack-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--utools-border-light);

  // 已导入的行整体置灰，弱化视觉干扰
  &.imported {
    opacity: 0.5;
  }

  &:last-child {
    border-bottom: none;
  }

  .import-pack-info {
    flex: 1;
    min-width: 0;
  }

  .import-pack-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--utools-text-primary);

    .import-pack-count {
      margin-left: 8px;
      font-size: 12px;
      font-weight: 400;
      color: var(--utools-text-tertiary);
    }
  }

  .import-pack-desc {
    margin-top: 4px;
    font-size: 12px;
    color: var(--utools-text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
}

.import-empty {
  padding: 24px 0;
  text-align: center;
  font-size: 13px;
  color: var(--utools-text-secondary);
}
</style>
