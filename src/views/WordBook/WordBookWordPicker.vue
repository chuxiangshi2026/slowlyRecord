<template>
  <el-dialog :model-value="modelValue" title="添加单词" width="520px" :close-on-click-modal="false"
             @update:model-value="(v: boolean) => emit('update:modelValue', v)">
    <el-input v-model="keyword" clearable maxlength="120" placeholder="搜索词库，或输入新单词、词组"
              @input="page = 0" @keyup.enter="onKeywordEnter"/>
    <div v-loading="loading" class="picker-list">
      <el-empty v-if="!loading && !candidates.length"
                :description="keywordTrimmed ? '当前词库没有匹配结果，可直接添加到本页' : '没有候选单词，可在上方直接输入'"/>
      <button v-for="word in pagedCandidates" :key="word.id || word.text" type="button" class="picker-item"
              @click="choose(word)">
        <span class="picker-word">{{ word.text }}</span>
        <span v-if="word.phonetic" class="picker-phonetic">{{ word.phonetic }}</span>
        <span class="picker-meaning">{{ word.explains || '—' }}</span>
      </button>
    </div>
    <div v-if="candidates.length > pageSize" class="picker-footer">
      <el-button size="small" :disabled="page === 0" @click="page--">上一页</el-button>
      <span>{{ page + 1 }} / {{ pageCount }}</span>
      <el-button size="small" :disabled="page >= pageCount - 1" @click="page++">下一页</el-button>
    </div>
    <div v-if="keywordTrimmed" class="custom-add">
      <span v-if="alreadyInPage" class="existing-tip">「{{ keywordTrimmed }}」已在当前学习页</span>
      <template v-else-if="!hasExactCandidate">
        <el-button type="primary" plain @click="addCustom">直接添加「{{ keywordTrimmed }}」到本页</el-button>
        <p>自定义词条不写入主词库，添加后可继续补充释义和音标。</p>
      </template>
    </div>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useWordsStore } from '@/stores/words'
import type { Word } from '@/types/words'

const props = defineProps<{
  modelValue: boolean
  existingTexts: string[]
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'select', word: Word): void
}>()

const wordsStore = useWordsStore()
const keyword = ref('')
const page = ref(0)
const pageSize = 8
const loading = ref(false)

const existing = computed(() => new Set(props.existingTexts.map(text => text.trim().toLowerCase()).filter(Boolean)))

const candidates = computed(() => {
  const query = keyword.value.trim().toLowerCase()
  return wordsStore.words
    .filter(word => !existing.value.has(String(word.text || '').trim().toLowerCase()))
    .filter(word => {
      if (!query) return true
      return String(word.text || '').toLowerCase().includes(query)
        || String(word.phonetic || '').toLowerCase().includes(query)
        || String(word.explains || '').toLowerCase().includes(query)
    })
    .slice(0, 100)
})

const pageCount = computed(() => Math.max(1, Math.ceil(candidates.value.length / pageSize)))
const pagedCandidates = computed(() => candidates.value.slice(page.value * pageSize, (page.value + 1) * pageSize))
const keywordTrimmed = computed(() => keyword.value.trim())
const alreadyInPage = computed(() => existing.value.has(keywordTrimmed.value.toLowerCase()))
const hasExactCandidate = computed(() => candidates.value.some(word =>
  String(word.text || '').trim().toLowerCase() === keywordTrimmed.value.toLowerCase()))
const canCustomAdd = computed(() => !!keywordTrimmed.value && !alreadyInPage.value && !hasExactCandidate.value)

watch(() => props.modelValue, async (open) => {
  if (!open) return
  keyword.value = ''
  page.value = 0
  loading.value = true
  try {
    if (!wordsStore.count) await wordsStore.listWords()
  } finally {
    loading.value = false
  }
})

function choose(word: Word) {
  emit('select', word)
  emit('update:modelValue', false)
}

function onKeywordEnter() {
  if (!keywordTrimmed.value) return
  const exact = candidates.value.find(word => String(word.text || '').trim().toLowerCase() === keywordTrimmed.value.toLowerCase())
  if (exact) {
    choose(exact)
    return
  }
  if (pagedCandidates.value.length === 1) {
    choose(pagedCandidates.value[0])
    return
  }
  addCustom()
}

function addCustom() {
  if (!canCustomAdd.value) return
  const now = new Date()
  choose({
    _id: '',
    text: keywordTrimmed.value,
    explains: '',
    isReview: false,
    ctime: now,
    learnDate: now,
    explainedHidden: false,
    level: 0,
    remember: false,
  })
}
</script>

<style scoped lang="scss">
.picker-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 180px;
  margin-top: 12px;
}

.picker-item {
  display: grid;
  grid-template-columns: minmax(90px, 140px) minmax(90px, 150px) 1fr;
  gap: 10px;
  align-items: center;
  width: 100%;
  padding: 10px 12px;
  cursor: pointer;
  text-align: left;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  border-radius: 8px;
  color: var(--utools-text-primary);

  &:hover,
  &:focus-visible {
    border-color: var(--utools-primary);
    outline: none;
  }
}

.picker-word {
  font-weight: 600;
}

.picker-phonetic,
.picker-meaning {
  overflow: hidden;
  color: var(--utools-text-tertiary);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-footer {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 12px;
  margin-top: 10px;
  color: var(--utools-text-tertiary);
  font-size: 12px;
}

.custom-add {
  padding-top: 12px;
  margin-top: 12px;
  text-align: center;
  border-top: 1px solid var(--utools-border-divider);

  p {
    margin: 8px 0 0;
    color: var(--utools-text-tertiary);
    font-size: 12px;
    line-height: 1.5;
  }
}

.existing-tip {
  color: var(--utools-warning);
  font-size: 13px;
}
</style>
