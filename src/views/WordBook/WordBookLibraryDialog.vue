<template>
  <el-dialog :model-value="modelValue" title="添加词集" width="min(620px, 92vw)"
             @update:model-value="(value: boolean) => emit('update:modelValue', value)"
             @open="bookName = '我的词集'">
    <section class="library-section">
      <h3>新建空白词集</h3>
      <div class="create-row">
        <el-input v-model="bookName" maxlength="30" placeholder="词集名称" :disabled="busy" @keyup.enter="createBook"/>
        <el-button type="primary" :disabled="!bookName.trim() || busy" :loading="creating" @click="createBook">新建</el-button>
      </div>
    </section>

    <section class="library-section">
      <div class="section-heading">
        <h3>导入词集</h3>
        <el-button :disabled="busy" :loading="importing" @click="importSharedBookFile">选择 JSON 文件</el-button>
      </div>
      <p>导入其他用户分享的词集文件，会创建一本可编辑的新词集。</p>
    </section>

    <section class="library-section">
      <h3>内置示例</h3>
      <p>用于立即体验和学习编排方式，也可以直接编辑、删除。</p>
      <article v-for="sample in WORDBOOK_SAMPLES" :key="sample.name" class="sample-item">
        <div>
          <strong>{{ sample.name }}</strong>
          <p>{{ sample.desc }}</p>
          <span>{{ sample.chapters.map(chapter => chapter.name).join(' · ') }}</span>
        </div>
        <el-button type="primary" plain :disabled="busy" @click="useSample(sample)">
          {{ hasBook(sample.name) ? '打开' : '使用示例' }}
        </el-button>
      </article>
    </section>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { getFileAdapter } from '@/adapters/file'
import { useWordBookStore } from '@/stores/wordBook'
import { trackEvent } from '@/utils/stats'
import { parseWordBookShareData } from '@/utils/word-book-share'
import { addWordBookSample } from '@/utils/wordbook-seed'
import { WORDBOOK_SAMPLES } from '@/utils/wordbook-samples'
import type { WordBookSampleBook } from '@/utils/wordbook-samples'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'open-book', bookId: string): void
}>()

const store = useWordBookStore()
const bookName = ref('我的词集')
const creating = ref(false)
const importing = ref(false)
const busy = ref(false)

function hasBook(name: string): boolean {
  return store.sortedBooks.some(book => book.name === name)
}

function openBook(bookId: string) {
  emit('update:modelValue', false)
  emit('open-book', bookId)
}

async function createBook() {
  if (!bookName.value.trim() || busy.value) return
  busy.value = true
  creating.value = true
  try {
    const result = await store.createBook(bookName.value.trim())
    if (!result.ok || !result.item) {
      ElMessage.error(result.message || '创建失败')
      return
    }
    openBook(result.item._id)
  } finally {
    busy.value = false
    creating.value = false
  }
}

async function useSample(sample: WordBookSampleBook) {
  if (busy.value) return
  busy.value = true
  try {
    const result = await addWordBookSample(sample)
    if (!result.ok || !result.item) {
      ElMessage.error(result.message || '添加示例失败')
      return
    }
    openBook(result.item._id)
  } finally {
    busy.value = false
  }
}

async function importSharedBookFile() {
  if (busy.value) return
  busy.value = true
  importing.value = true
  try {
    const picked = await getFileAdapter().pickFile({ accept: '.json,application/json' })
    const file = Array.isArray(picked) ? picked[0] : picked
    if (!file) return
    const text = typeof (file as File).text === 'function'
      ? await (file as File).text()
      : await getFileAdapter().readText((file as any).path || (file as any).filePath)
    const data = parseWordBookShareData(JSON.parse(text))
    const result = await store.importSharedBook(data)
    if (!result.ok || !result.item) {
      ElMessage.error(result.message || '导入词集失败')
      return
    }
    trackEvent('feature', 'word_book_import', 'book', data.chapters.reduce((count, chapter) => count + chapter.pages.length, 0))
    ElMessage.success('已导入为新的词集副本')
    openBook(result.item._id)
  } catch (error) {
    console.error('[词集] 导入失败', error)
    ElMessage.error(error instanceof Error ? error.message : '导入词集失败')
  } finally {
    busy.value = false
    importing.value = false
  }
}
</script>

<style scoped lang="scss">
.library-section + .library-section {
  padding-top: 16px;
  margin-top: 16px;
  border-top: 1px solid var(--utools-border-divider);
}

h3,
p {
  margin: 0;
}

h3 {
  color: var(--utools-text-primary);
  font-size: 15px;
}

.library-section > p,
.sample-item p {
  margin-top: 6px;
  color: var(--utools-text-tertiary);
  font-size: 12px;
  line-height: 1.5;
}

.create-row,
.section-heading,
.sample-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}

.create-row {
  margin-top: 10px;
}

.section-heading {
  margin-bottom: 6px;
}

.sample-item {
  padding: 12px;
  margin-top: 10px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;

  > div {
    min-width: 0;
  }

  span {
    display: block;
    margin-top: 6px;
    color: var(--utools-text-secondary);
    font-size: 12px;
  }
}
</style>
