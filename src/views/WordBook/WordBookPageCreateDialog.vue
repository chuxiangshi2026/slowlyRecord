<template>
  <el-dialog :model-value="modelValue" title="添加学习页" width="min(500px, 92vw)"
             :close-on-click-modal="false" @open="reset"
             @update:model-value="(value: boolean) => emit('update:modelValue', value)">
    <el-form label-position="top" class="create-form">
      <el-form-item label="学习页名称" required>
        <el-input v-model="name" maxlength="40" placeholder="如：old 篇" @input="nameTouched = true"/>
      </el-form-item>
      <el-form-item label="中心类型">
        <el-select v-model="keyType">
          <el-option v-for="option in keyTypeOptions" :key="option.value" :label="option.label" :value="option.value"/>
        </el-select>
      </el-form-item>
      <el-form-item label="中心文本">
        <el-input v-model="keyValue" maxlength="40" placeholder="如 old / port / əʊ / 身体" @input="syncName"/>
      </el-form-item>
      <el-form-item label="中心解释">
        <el-input v-model="keyDescription" maxlength="80" placeholder="如：本页单词都包含 old"/>
      </el-form-item>
    </el-form>
    <el-alert type="info" :closable="false" title="先创建空页，进入后即可搜索词库或直接输入单词。"/>
    <template #footer>
      <el-button :disabled="saving" @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :disabled="!name.trim()" :loading="saving" @click="createPage">创建并添加单词</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useWordBookStore } from '@/stores/wordBook'
import { WORD_BOOK_KEY_TYPE_LABEL, getDefaultPageName } from '@/utils/word-book'
import type { WordBookKeyType } from '@/types/word-book'

const props = defineProps<{
  modelValue: boolean
  bookId: string
  chapterId: string
}>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'created', pageId: string): void
}>()
const store = useWordBookStore()
const name = ref('')
const nameTouched = ref(false)
const keyType = ref<WordBookKeyType>('letters')
const keyValue = ref('')
const keyDescription = ref('')
const saving = ref(false)

const keyTypeOptions = computed(() => (Object.keys(WORD_BOOK_KEY_TYPE_LABEL) as WordBookKeyType[]).map(value => ({
  value,
  label: WORD_BOOK_KEY_TYPE_LABEL[value],
})))

function reset() {
  name.value = ''
  nameTouched.value = false
  keyType.value = 'letters'
  keyValue.value = ''
  keyDescription.value = ''
}

function syncName() {
  if (!nameTouched.value) name.value = getDefaultPageName({ type: keyType.value, value: keyValue.value.trim() }, 1, 1)
}

async function createPage() {
  if (!name.value.trim() || saving.value) return
  saving.value = true
  try {
    const claimed = await store.claimSampleBook(props.bookId)
    if (!claimed.ok) {
      ElMessage.error(claimed.message || '示例转换失败')
      return
    }
    const result = await store.createPage({
      bookId: props.bookId,
      chapterId: props.chapterId,
      name: name.value.trim(),
      key: {
        type: keyType.value,
        value: keyValue.value.trim(),
        description: keyDescription.value.trim() || undefined,
      },
      words: [],
      source: { bankName: '手动编排' },
    })
    if (!result.ok || !result.item) {
      ElMessage.error(result.message || '创建学习页失败')
      return
    }
    emit('update:modelValue', false)
    emit('created', result.item._id)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.create-form {
  :deep(.el-form-item) {
    margin-bottom: 12px;
  }

  :deep(.el-select) {
    width: 100%;
  }
}
</style>
