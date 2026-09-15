<template>
  <div class="knowledge-memory-page">
    <!-- 分类切换：桩库 / 数理化 / 文史常识 -->
    <div class="category-switch">
      <span
          v-for="tab in tabs"
          :key="tab.value"
          :class="['category-chip', { on: category === tab.value }]"
          @click="category = tab.value"
      >
        {{ tab.label }}
        <b v-if="countOf(tab.value) > 0">{{ countOf(tab.value) }}</b>
      </span>
    </div>

    <KnowledgePackPanel :key="category" :category="category"/>
  </div>
</template>

<script setup lang="ts">
import {onMounted, ref} from 'vue';
import KnowledgePackPanel from '@/views/TextMemory/components/KnowledgePackPanel.vue';
import {useKnowledgeMemoryStore} from '@/stores/knowledgeMemory';
import type {KnowledgePackCategory} from '@/types/knowledge-memory';

const store = useKnowledgeMemoryStore();
// 默认停在「数理化」
const category = ref<KnowledgePackCategory>('math');

const tabs: Array<{ label: string; value: KnowledgePackCategory }> = [
  {label: '桩库', value: 'peg'},
  {label: '数理化', value: 'math'},
  {label: '文史常识', value: 'text'},
];

// 各 tab 计数：桩库 = 可用作桩的包（跨 math/text 大类）；数理化/文史常识 = 对应大类且非桩库（桩库已单列，不重复计数）
const countOf = (c: KnowledgePackCategory) =>
  store.importedIds.filter(id => {
    const info = store.packList.find(p => p.id === id);
    if (!info) return false;
    return c === 'peg' ? info.usableAsPeg : info.category === c && !info.usableAsPeg;
  }).length;

onMounted(async () => {
  await store.loadImportedIds().catch(() => {});
});
</script>

<style scoped lang="scss">
.knowledge-memory-page {
  padding: 10px 12px 16px;

  .category-switch {
    display: flex;
    gap: 8px;
    margin-bottom: 10px;

    .category-chip {
      padding: 4px 12px;
      border-radius: 14px;
      font-size: 13px;
      color: var(--utools-text-secondary);
      background: var(--utools-bg-card);
      cursor: pointer;
      transition: all 0.2s;

      &:hover {
        background: var(--utools-bg-hover);
      }

      &.on {
        color: var(--utools-primary);
        background: var(--utools-bg-hover);
        font-weight: 600;
      }

      b {
        margin-left: 4px;
        font-weight: 600;
      }
    }
  }
}
</style>
