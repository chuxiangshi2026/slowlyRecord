<template>
  <el-dialog
    :model-value="modelValue"
    @update:model-value="$emit('update:modelValue', $event)"
    :title="isEdit ? '编辑文本' : '添加文本'"
    width="700px"
    destroy-on-close
  >
    <TextEditForm
      ref="editFormRef"
      :article="article"
      @submit="handleSubmit"
    />

    <template #footer>
      <el-button @click="handleClose">取消</el-button>
      <el-button type="primary" @click="handleSave" :loading="saving">
        保存
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import type { TextArticle } from '@/types/text-memory';
import TextEditForm from './TextEditForm.vue';

interface Props {
  modelValue: boolean;
  article?: TextArticle;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void;
  (e: 'save', article: any): void;
}>();

const editFormRef = ref<InstanceType<typeof TextEditForm>>();
const saving = ref(false);

// 判断是否为编辑模式
const isEdit = computed(() => !!props.article);

// 关闭对话框
function handleClose() {
  emit('update:modelValue', false);
}

// 保存：触发表单校验与提交
async function handleSave() {
  saving.value = true;
  try {
    await editFormRef.value?.submit();
  } finally {
    saving.value = false;
  }
}

// 表单校验通过后透传保存事件
function handleSubmit(article: any) {
  emit('save', article);
}
</script>
