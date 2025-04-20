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
        <i class="iconfont icon-translate iconHover" @click="translation()"></i>
      </div>
      <div>
        <i class="iconfont icon-check iconHover" @click="remember"></i>
        <i class="iconfont icon-close iconHover" @click="forget"></i>
        <i class="iconfont icon-delete iconHover" @click="deleteWord"></i>
      </div>
    </div>
    <div>
      <div class="translation" :hidden="word.explainedHidden">
        <div class="translate-editable" contenteditable="true">{{ word.explainedInChinese }}</div>
      </div>
      <div class="sentence_wrapper achieve"></div>
    </div>
  </div>


</template>

<script setup lang="ts">
import type {Word} from "@/types/words";
// 接收word传参，并传递给子组件
const props = defineProps<{
  word: Word
}>()
const wordModel = defineModel<Word>({required: true})
const emit = defineEmits(['translation', 'remember', 'forget', 'delete'])


import {ref} from "vue";
import {DEFAULT_INTERVALS} from "@/constants";
import {useWordsStore} from "@/stores/words.ts";
import {storeToRefs} from "pinia";


// const explainedHidden = ref(true);


const wordsStore = useWordsStore();
// const {words} = storeToRefs(wordsStore)

// 翻译
const translation = () => {
  wordModel.value.explainedHidden = !wordModel.value.explainedHidden;
}


// 播放语音
const play = () => {

}


// 记住
const remember = () => {

  //如果 当前时间大于  上次复习时间+当前等级*默认复习间隔 且小于上次复习时间+（当前等级+3）*默认复习间隔  等级+1
  // 当前时间
  const now = new Date().getTime();
  let reviewTime = wordModel.value.reviewTime;
  // 开始复习时间 (上次复习时间 + 当前等级对应的默认复习间隔)
  let level = wordModel.value.level;
  // todo 这里序列化不是时间类型
  /*if (!reviewTime || !(reviewTime instanceof Date)) {
    console.log(typeof reviewTime + 'fddddddddd');
  }*/

  const startReviewTime = reviewTime.getTime() + DEFAULT_INTERVALS[level] * 60 * 1000;

  // 结束复习时间 (上次复习时间 + (当前等级 + 3) 对应的默认复习间隔)
  const endReviewTime = reviewTime.getTime() + DEFAULT_INTERVALS[Math.min(level + 3, DEFAULT_INTERVALS.length - 1)] * 60 * 1000;

  // 判断是否满足条件
  if (now > startReviewTime && now < endReviewTime) {
    // 等级+1
    wordModel.value.level++;
  } else {
    // 否则等级不变，仅更新复习时间
    console.log("未满足升级条件");
    // console.log(wordModel.value.reviewTime.toLocaleTimeString()+'3333333');
  }

  // 更新复习时间
  wordModel.value.reviewTime = new Date();

  // 是否复习，改为false
  wordModel.value.isReview = false;

  wordModel.value.explainedHidden = true;

  // wordsStore.updateWord(wordModel.value)


  // 发送事件通知父组件
  // emit('remember', props.word);

  console.log(JSON.stringify(props.word) + '123');
}
// 忘记
const forget = () => {
  // emit('forget', 'childValue');
  if (wordModel.value && wordModel.value.level > 0) {
    wordModel.value.level--;
  }
  wordModel.value.level===0?wordModel.value.explainedHidden=false:wordModel.value.explainedHidden=true;

}
// 删除单词
const deleteWord = () => {
  // wordModel.value;
  emit('delete');
}

</script>

<style scoped lang="scss">

</style>
