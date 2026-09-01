<template>
  <!-- 知识包卡片面板：按 category 展示宿主模块对应的知识包（math → 数字记忆，text → 文本记忆） -->
  <div class="knowledge-pack-panel" v-loading="store.loading">
    <el-empty v-if="packs.length === 0" description="暂无知识包" />

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
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useKnowledgeMemoryStore } from '@/stores/knowledgeMemory';
import type { KnowledgePackCategory } from '@/types/knowledge-memory';

const props = defineProps<{
  category: KnowledgePackCategory;
}>();

const router = useRouter();
const store = useKnowledgeMemoryStore();

// 当前分类下的知识包
const packs = computed(() => store.packList.filter(p => p.category === props.category));

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

// 加载本分类全部包（用于掌握进度统计），失败静默忽略
onMounted(() => {
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
  }
}
</style>
