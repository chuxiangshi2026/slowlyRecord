<template>
  <div class="memory-palace-page">
    <!-- 筛选排序条（仿 WordFilter chip 风格） -->
    <div class="palace-filter-bar">
      <div class="filter-input-wrap">
        <el-icon class="filter-search-icon"><Search /></el-icon>
        <input
          v-model="searchKeyword"
          class="filter-input"
          placeholder="搜索宫殿名称..."
        />
        <el-icon v-if="searchKeyword" class="filter-clear-icon" @click="searchKeyword = ''"><CircleClose /></el-icon>
      </div>

      <div class="filter-divider"></div>

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

      <span class="match-count">{{ filteredPalaces.length }} 座</span>
    </div>

    <!-- 宫殿卡片列表 -->
    <div class="palace-list-wrapper" v-loading="store.loading">
      <el-empty v-if="filteredPalaces.length === 0" description="暂无记忆宫殿，点击右下角新建或导入内置桩库" />

      <div
        v-for="palace in filteredPalaces"
        :key="palace._id"
        class="list-item palace-card"
        @click="goDetail(palace._id)"
      >
        <p class="palace-title-line">
          <span class="palace-name" :title="palace.name">{{ palace.name }}</span>
          <span class="palace-badges">
            <el-tag v-if="palace.sourcePackId" size="small" type="success">内置桩库</el-tag>
            <el-tag size="small" type="info">{{ palace.loci.length }} 桩</el-tag>
          </span>
        </p>

        <div class="palace-stats-line">
          已挂载 {{ mountedCounts[palace._id] || 0 }} / {{ palace.loci.length }}
        </div>

        <div class="palace-loci-preview" :title="lociPreview(palace)">
          {{ lociPreview(palace) }}
        </div>

        <div class="operate" @click.stop>
          <div class="operate-group">
            <el-tooltip effect="dark" content="巡视复习" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="goReview(palace._id)"><View /></el-icon>
            </el-tooltip>
          </div>
          <div class="operate-group">
            <el-tooltip effect="dark" content="编辑" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="goEdit(palace._id)"><Edit /></el-icon>
            </el-tooltip>
            <el-tooltip effect="dark" content="删除" placement="top" popper-class="small-tooltip">
              <el-icon class="iconHover" :size="20" @click="handleDelete(palace)"><Delete /></el-icon>
            </el-tooltip>
          </div>
        </div>
      </div>
    </div>

    <!-- 底部工具行（嵌入文本记忆页内，使用内联布局而非固定底栏，避免页中页） -->
    <div class="palace-toolbar">
      <span class="toolbar-stat">共 {{ store.palaces.length }} 座宫殿</span>
      <div class="toolbar-actions">
        <el-dropdown @command="handleImportPack">
          <el-icon :size="20" class="toolbar-icon" title="导入内置桩库"><Download /></el-icon>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item
                v-for="pack in pegPacks"
                :key="pack.id"
                :command="pack.id"
              >
                {{ pack.name }}（{{ pack.itemCount }} 桩）
              </el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>
        <el-tooltip effect="dark" content="新建宫殿" placement="top" popper-class="small-tooltip">
          <el-icon :size="20" class="toolbar-icon" @click="goEdit('')"><Plus /></el-icon>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onMounted, ref} from 'vue';
import {useRouter} from 'vue-router';
import {ElMessage, ElMessageBox} from 'element-plus';
import {CircleClose, Delete, Download, Edit, Plus, Search, View} from '@element-plus/icons-vue';
import {useMemoryPalaceStore} from '@/stores/memoryPalace';
import type {Palace} from '@/types/memory-palace';

const router = useRouter();
const store = useMemoryPalaceStore();

const searchKeyword = ref('');
const sortBy = ref<'time' | 'name' | 'loci'>('time');
const sortAsc = ref(false);
const sortOptions = [
  {key: 'time' as const, label: '创建时间'},
  {key: 'name' as const, label: '名称'},
  {key: 'loci' as const, label: '桩数'},
];

// 各宫殿已挂载数量缓存
const mountedCounts = ref<Record<string, number>>({});

// 可导入的内置桩库
const pegPacks = computed(() => store.listPegPacks());

const filteredPalaces = computed(() => {
  let result = [...store.palaces];

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(p => p.name.toLowerCase().includes(keyword));
  }

  result.sort((a, b) => {
    let compare = 0;
    switch (sortBy.value) {
      case 'time':
        compare = a.ctime - b.ctime;
        break;
      case 'name':
        compare = a.name.localeCompare(b.name, 'zh-CN');
        break;
      case 'loci':
        compare = a.loci.length - b.loci.length;
        break;
    }
    return sortAsc.value ? compare : -compare;
  });

  return result;
});

onMounted(async () => {
  await store.loadPalaces();
  refreshMountedCounts();
});

// 刷新各宫殿挂载数
function refreshMountedCounts() {
  const counts: Record<string, number> = {};
  for (const p of store.palaces) {
    counts[p._id] = store.mountedCount(p._id);
  }
  mountedCounts.value = counts;
}

function toggleSort(key: 'time' | 'name' | 'loci') {
  if (sortBy.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortBy.value = key;
    sortAsc.value = key === 'name';
  }
}

// 桩名称预览（前几个）
function lociPreview(palace: Palace): string {
  const names = palace.loci.slice(0, 6).map(l => l.name);
  const suffix = palace.loci.length > 6 ? '…' : '';
  return names.join(' → ') + suffix;
}

function goDetail(id: string) {
  router.push(`/memory-palace/${id}`);
}

function goReview(id: string) {
  router.push(`/memory-palace/${id}/review`);
}

function goEdit(id: string) {
  router.push(id ? `/memory-palace/edit/${id}` : '/memory-palace/edit');
}

// 导入内置桩库为宫殿
async function handleImportPack(packId: string) {
  try {
    const {result, palace} = await store.importPackAsPalace(packId);
    if (result.ok) {
      ElMessage.success(`已导入宫殿「${palace.name}」`);
      refreshMountedCounts();
    } else {
      ElMessage.error('导入失败');
    }
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : '导入失败');
  }
}

// 删除宫殿
async function handleDelete(palace: Palace) {
  try {
    await ElMessageBox.confirm(
      `确定要删除宫殿「${palace.name}」吗？桩上的挂载会一并删除，但不会删除引用的文章。`,
      '确认删除',
      {confirmButtonText: '删除', cancelButtonText: '取消', type: 'warning'},
    );
    const result = await store.deletePalace(palace._id);
    if (result.ok) {
      ElMessage.success('删除成功');
      // 清理被删宫殿的挂载数缓存，避免残留过期 key
      delete mountedCounts.value[palace._id];
    } else {
      ElMessage.error('删除失败');
    }
  } catch {
    // 用户取消
  }
}
</script>

<style scoped lang="scss">
.memory-palace-page {
  width: 100%;
  background-color: var(--utools-bg-secondary);
  box-sizing: border-box;
}

// ---- 筛选排序条（chip 风格，与 NumberMemoryEntries 一致） ----
.palace-filter-bar {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 32px;
  padding: 0 10px;
  background: var(--utools-bg-card);
  border-bottom: 1px solid var(--utools-border-divider);
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

// ---- 列表区域 ----
.palace-list-wrapper {
  width: 100%;
  min-height: 200px;
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

.palace-card {
  width: 92%;
  min-height: auto;
  max-height: none;
  padding: 12px;
  margin-bottom: 8px;
  cursor: pointer;

  .palace-title-line {
    display: flex;
    align-items: center;
    justify-content: space-between;
    font-size: 16px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--utools-text-primary);

    .palace-name {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .palace-badges {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      flex-shrink: 0;
    }
  }

  .palace-stats-line {
    font-size: 13px;
    color: var(--utools-text-secondary);
    margin-bottom: 6px;
  }

  .palace-loci-preview {
    font-size: 12px;
    color: var(--utools-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    margin-bottom: 8px;
  }

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
  }
}

// ---- 底部工具行（内联，嵌入宿主页面使用） ----
.palace-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: var(--utools-bg-card);
  height: 40px;
  border-top: 1px solid var(--utools-border-divider);
  padding: 0 12px;
  box-sizing: border-box;
  color: var(--utools-text-primary);

  .toolbar-stat {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--utools-text-secondary);
  }

  .toolbar-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .toolbar-icon {
    font-size: 20px;
    cursor: pointer;
    padding: 6px;
    border-radius: 6px;
    color: var(--utools-text-primary);
    transition: all 0.2s;

    &:hover {
      background-color: var(--utools-bg-hover);
    }
  }
}
</style>
