<template>
  <div class="knowledge-memory-page">
    <!-- 筛选排序条（仿 WordFilter chip 风格） -->
    <div class="knowledge-filter-bar">
      <div class="filter-input-wrap">
        <el-icon class="filter-search-icon"><Search /></el-icon>
        <input
          v-model="searchKeyword"
          class="filter-input"
          placeholder="搜索知识包名称或描述..."
          @keyup.enter="emitFilterChange"
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

      <span class="match-count">{{ filteredPacks.length }} 个</span>
    </div>

    <!-- 知识包卡片列表 -->
    <div class="knowledge-list-wrapper" v-loading="store.loading">
      <el-empty v-if="filteredPacks.length === 0" description="暂无知识包" />

      <div
        v-for="pack in filteredPacks"
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
        </div>
      </div>
    </div>

    <!-- 底部工具栏 -->
    <div class="home_footer">
      <div>
        <span class="footer-stat" @click="goBack">
          <el-icon><ArrowLeft /></el-icon>
          返回
        </span>
        <el-divider direction="vertical" />
        <span class="footer-stat">共 {{ store.packList.length }} 个知识包</span>
      </div>
      <div>
        <el-tooltip effect="dark" content="刷新知识包" placement="top" popper-class="small-tooltip">
          <el-icon :size="20" class="footer-icon" @click.stop="refreshAll">
            <RefreshRight />
          </el-icon>
        </el-tooltip>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Search, CircleClose, ArrowLeft, RefreshRight } from '@element-plus/icons-vue';
import { useKnowledgeMemoryStore } from '@/stores/knowledgeMemory';
import type { KnowledgePackInfo } from '@/types/knowledge-memory';

const router = useRouter();
const store = useKnowledgeMemoryStore();

const searchKeyword = ref('');
const sortBy = ref<'name' | 'total' | 'mastered' | 'due'>('name');
const sortAsc = ref(true);
const sortOptions = [
  { key: 'name' as const, label: '名称' },
  { key: 'total' as const, label: '条目数' },
  { key: 'mastered' as const, label: '已掌握' },
  { key: 'due' as const, label: '待复习' },
];

const filteredPacks = computed(() => {
  let result = [...store.packList];

  if (searchKeyword.value) {
    const keyword = searchKeyword.value.toLowerCase();
    result = result.filter(
      pack =>
        pack.name.toLowerCase().includes(keyword) ||
        pack.description.toLowerCase().includes(keyword),
    );
  }

  result.sort((a, b) => {
    let compare = 0;
    switch (sortBy.value) {
      case 'name':
        compare = a.name.localeCompare(b.name, 'zh-CN');
        break;
      case 'total':
        compare = a.itemCount - b.itemCount;
        break;
      case 'mastered':
        compare = getMastered(a.id) - getMastered(b.id);
        break;
      case 'due':
        compare = getDue(a.id) - getDue(b.id);
        break;
    }
    return sortAsc.value ? compare : -compare;
  });

  return result;
});

function toggleSort(key: 'name' | 'total' | 'mastered' | 'due') {
  if (sortBy.value === key) {
    sortAsc.value = !sortAsc.value;
  } else {
    sortBy.value = key;
    sortAsc.value = key === 'name';
  }
}

function emitFilterChange() {
  // 搜索为响应式，回车仅用于收起键盘
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

function goBack() {
  router.push('/word');
}

async function refreshAll() {
  await Promise.all(store.packList.map(p => store.loadPack(p.id).catch(() => undefined)));
}

onMounted(() => {
  refreshAll();
});
</script>

<style scoped lang="scss">
.knowledge-memory-page {
  width: 100%;
  min-height: 100vh;
  background-color: var(--utools-bg-secondary);
  padding-bottom: 55px;
  box-sizing: border-box;
}

.knowledge-filter-bar {
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

.knowledge-list-wrapper {
  width: 100%;
  min-height: calc(100vh - 32px - 55px);
  padding: 10px 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}

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
