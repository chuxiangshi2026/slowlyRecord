<template>
  <div class="knowledge-memory-page">
    <!-- 分类切换：数字知识包 / 文本知识包 -->
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
import {computed, onMounted, ref} from 'vue';
import KnowledgePackPanel from '@/views/TextMemory/components/KnowledgePackPanel.vue';
import {useKnowledgeMemoryStore} from '@/stores/knowledgeMemory';
import type {KnowledgePackCategory} from '@/types/knowledge-memory';

const store = useKnowledgeMemoryStore();
const category = ref<KnowledgePackCategory>('math');

const tabs: Array<{ label: string; value: KnowledgePackCategory }> = [
  {label: '数字知识包', value: 'math'},
  {label: '文本知识包', value: 'text'},
];

const importedCount = computed(() => store.importedIds.length);
const mathCount = computed(() => store.importedIds.filter(id => store.packList.find(p => p.id === id)?.category === 'math').length);
const textCount = computed(() => importedCount.value - mathCount.value);

const countOf = (c: KnowledgePackCategory) => (c === 'math' ? mathCount.value : textCount.value);

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
