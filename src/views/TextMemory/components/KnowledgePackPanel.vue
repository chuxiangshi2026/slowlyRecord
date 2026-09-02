<template>
  <!-- 知识包卡片面板：只展示「已导入」的知识包（math → 数字记忆，text → 文本记忆），仿内置词库导入模式 -->
  <div class="knowledge-pack-panel" v-loading="store.loading">
    <!-- 顶部工具行：导入入口 -->
    <div class="panel-toolbar">
      <el-button size="small" type="primary" plain @click="showImportDialog = true">导入</el-button>
    </div>

    <el-empty v-if="packs.length === 0" description="暂无知识库，点击右上角导入" />

    <div
      v-for="pack in packs"
      :key="pack.id"
      class="list-item knowledge-pack-card"
      @click="goPack(pack.id)"
    >
      <div class="pack-header-line">
        <span class="pack-name" :title="pack.name">{{ pack.name }}</span>
        <span class="pack-count">{{ getTotal(pack.id) }} 条</span>
      </div>

      <p class="pack-desc" :title="pack.description">{{ pack.description }}</p>

      <div class="pack-tags">
        <el-tag v-if="pack.ordered" size="small" type="warning">有序</el-tag>
        <el-tag v-if="pack.usableAsPeg" size="small" type="success">可用作桩库</el-tag>
        <el-tag v-if="!pack.ordered && !pack.usableAsPeg" size="small" type="info">无序</el-tag>
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
        <!-- 移除仅下架展示，进度保留 -->
        <el-button
          class="pack-remove-btn"
          size="small"
          text
          type="danger"
          @click.stop="handleRemove(pack.id, pack.name)"
        >移除</el-button>
      </div>
    </div>

    <!-- 导入对话框：列出当前分类的全部内置包 -->
    <el-dialog v-model="showImportDialog" title="导入知识库" width="520px" append-to-body>
      <div v-if="allPacks.length === 0" class="import-empty">暂无可导入的知识库</div>
      <div
        v-for="p in allPacks"
        :key="p.id"
        class="import-pack-row"
      >
        <div class="import-pack-info">
          <div class="import-pack-name">
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
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage, ElMessageBox } from 'element-plus';
import { useKnowledgeMemoryStore } from '@/stores/knowledgeMemory';
import type { KnowledgePackCategory } from '@/types/knowledge-memory';

const props = defineProps<{
  category: KnowledgePackCategory;
}>();

const router = useRouter();
const store = useKnowledgeMemoryStore();

const showImportDialog = ref(false);

// 已导入的包（面板只展示这些）
const packs = computed(() =>
  store.packList.filter(p => p.category === props.category && store.importedIds.includes(p.id)),
);

// 当前分类下的全部内置包（导入对话框候选）
const allPacks = computed(() => store.packList.filter(p => p.category === props.category));

function isImported(packId: string): boolean {
  return store.importedIds.includes(packId);
}

function getTotal(packId: string): number {
  return store.isPackLoaded(packId) ? store.getTotalCount(packId) : (store.packList.find(p => p.id === packId)?.itemCount ?? 0);
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

// 加载已导入清单（含老用户进度自动并入），再加载已导入包内容用于进度统计，失败静默忽略
onMounted(async () => {
  try {
    await store.loadImportedIds();
  } catch {
    // 清单加载失败时按空清单展示
    return;
  }
  packs.value.forEach(p => {
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
  justify-content: flex-end;
  margin-bottom: 8px;
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

// 导入对话框行样式
.import-pack-row {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 4px;
  border-bottom: 1px solid var(--utools-border-light);

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
