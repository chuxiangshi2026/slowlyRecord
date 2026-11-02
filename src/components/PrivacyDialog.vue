<template>
  <el-dialog v-model="visible" title="隐私说明" width="min(720px, 92vw)" append-to-body>
    <!-- 直接内嵌 privacy.html：uTools/Electron 是 file:// 页面，a[target=_blank] 打不开，
         iframe 同目录加载反而在两端（file:// 与 web）都能显示 -->
    <iframe class="privacy-frame" src="privacy.html" title="隐私说明"></iframe>
  </el-dialog>
</template>

<script setup lang="ts">
import {computed} from 'vue'

const props = defineProps<{ modelValue: boolean }>()
const emit = defineEmits<{(e: 'update:modelValue', v: boolean): void}>()

const visible = computed({
  get: () => props.modelValue,
  set: (v: boolean) => emit('update:modelValue', v),
})
</script>

<style scoped>
.privacy-frame {
  width: 100%;
  height: min(70vh, 620px);
  border: 0;
  border-radius: 6px;
  background: #fff;
}
</style>
