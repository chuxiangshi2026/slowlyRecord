<template>


  <div class="list-item">
    <p class="word">
      {{ word.text }}
      <span class="phonetic">{{ word.phonetic }}</span>
    </p>
    <div class="level">
      <i :class="`iconfont icon-level-${word.level}`"></i>
    </div>
    <div class="operate">
      <div>
        <i class="iconfont icon-player iconHover" @click="play"></i>
        <i class="iconfont icon-translate iconHover" @click="translation"></i>
      </div>
      <div>
        <i class="iconfont icon-check iconHover" @click="remember"></i>
        <i class="iconfont icon-close iconHover" @click="forget"></i>
        <i class="iconfont icon-delete iconHover" @click="deleteWord"></i>
      </div>
    </div>
    <div>
      <div class="translation" :hidden="explainedHidden">
        <div class="translate-editable" contenteditable="true">{{ word.explainedInChinese }}</div>
      </div>
      <div class="sentence_wrapper achieve"></div>
    </div>
  </div>


</template>

<script setup lang="ts">
import type {Word} from "@/types/words";
// 接收word传参，并传递给子组件
defineProps<{
  word: Word
}>()
defineEmits(['translation'])


import {ref} from "vue";


const explainedHidden = ref(true);


// defineEmits(['enlarge-text'])

// 翻译
const translation = (): boolean => {
  explainedHidden.value = !explainedHidden.value;
  return explainedHidden.value;
}


// 播放语音
const play = () => {

}


// 记住
const remember = () => {
}
// 忘记
const forget = () => {
}
// 删除单词
const deleteWord = () => {
}

</script>

<style scoped lang="scss">

</style>
