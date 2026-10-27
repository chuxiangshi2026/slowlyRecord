<template>
  <div class="pinyin-lines" :class="`align-${align}`">
    <div v-for="(line, index) in lines" :key="index" class="pinyin-line-block">
      <template v-if="line.text">
        <div v-if="line.pinyin" class="pinyin-line">{{ line.pinyin }}</div>
        <div v-if="mode !== 'pinyin'" class="text-line">{{ line.text }}</div>
      </template>
      <div v-else class="line-gap"></div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { splitAnnotatedLines } from '@/utils/pinyin-util'

const props = withDefaults(defineProps<{
  content: string
  pinyin?: string
  align?: 'left' | 'center'
  /** both：拼音+正文；pinyin：只显示拼音（练习中避免露出原文答案） */
  mode?: 'both' | 'pinyin'
}>(), {
  pinyin: '',
  align: 'left',
  mode: 'both',
})

const lines = computed(() => splitAnnotatedLines(props.content, props.pinyin))
</script>

<style scoped lang="scss">
.pinyin-lines {
  line-height: 1.9;

  &.align-center {
    text-align: center;
  }
}

.pinyin-line {
  font-size: 12px;
  line-height: 1.5;
  color: #909399;
  letter-spacing: 0.02em;
  white-space: pre-wrap;
  word-break: break-word;
}

.text-line {
  white-space: pre-wrap;
  word-break: break-word;
}

.line-gap {
  height: 0.8em;
}
</style>
