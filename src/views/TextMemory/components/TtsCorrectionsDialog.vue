<template>
  <el-dialog :model-value="modelValue" title="发音纠错" width="min(560px, 92vw)" append-to-body
             @update:model-value="emit('update:modelValue', $event)" @open="onOpen">
    <p class="corrections-hint">
      机读多音字读错时，把易错片段替换为同音字（如「银行家」→「银杭家」）。仅影响朗读，显示仍是原文；全局生效。
    </p>
    <div class="corrections-list">
      <div v-for="(item, index) in draft" :key="index" class="correction-row">
        <el-input v-model="item.from" placeholder="原文片段" maxlength="30"/>
        <span class="row-arrow">→</span>
        <el-input v-model="item.to" placeholder="朗读替换（同音字）" maxlength="30"/>
        <el-button link type="danger" @click="draft.splice(index, 1)">删除</el-button>
      </div>
      <el-empty v-if="!draft.length" description="还没有纠错项" :image-size="60"/>
    </div>
    <el-button link type="primary" :disabled="draft.length >= 100" @click="draft.push({ from: '', to: '' })">＋ 添加一条</el-button>
    <template #footer>
      <el-button @click="emit('update:modelValue', false)">取消</el-button>
      <el-button type="primary" :loading="saving" @click="save">保存</el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { loadTtsCorrections, saveTtsCorrections, type TtsCorrection } from '@/utils/tts-corrections'

defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const draft = ref<TtsCorrection[]>([])
const saving = ref(false)

async function onOpen() {
  try {
    draft.value = await loadTtsCorrections()
  } catch {
    draft.value = []
    ElMessage.error('发音纠错读取失败')
  }
}

async function save() {
  if (saving.value) return
  const list = draft.value.filter(item => item.from.trim() && item.to.trim())
  if (list.some(item => item.from.trim() === item.to.trim())) {
    ElMessage.warning('存在原文与替换相同的条目，请修改')
    return
  }
  saving.value = true
  try {
    const ok = await saveTtsCorrections(list)
    if (!ok) {
      ElMessage.error('保存失败，请重试')
      return
    }
    ElMessage.success('发音纠错已保存，下次朗读生效')
    emit('update:modelValue', false)
  } finally {
    saving.value = false
  }
}
</script>

<style scoped lang="scss">
.corrections-hint {
  margin: 0 0 12px;
  color: var(--utools-text-secondary);
  font-size: 13px;
  line-height: 1.6;
}

.corrections-list {
  max-height: 320px;
  overflow-y: auto;
}

.correction-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 8px;

  .row-arrow {
    color: var(--utools-text-tertiary);
    flex-shrink: 0;
  }
}
</style>
