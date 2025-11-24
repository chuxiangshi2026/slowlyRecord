<template>

  <!--ref="root"-->
  <div class="list-item" ref="itemRef">
    <p class="word">
      {{ word.text }}
      <span class="phonetic">{{ word.phonetic }}</span>
    </p>
    <div class="level">
      <i :class="`iconfont icon-level-${word.level}`"></i>
    </div>
    <div class="operate">
      <div>
        <el-tooltip class="box-item" effect="dark" content="播放" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-player iconHover" @click="play"/>
        </el-tooltip>
        <!-- 添加audio标签  -->

        <audio ref="audioPlayer" :src="word.pronunciation" hidden></audio>
        <el-tooltip class="box-item" effect="dark" content="释义" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-translate iconHover" @click="translation()"/>
        </el-tooltip>
      </div>
      <div>
        <el-tooltip class="box-item" effect="dark" content="记住" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-check iconHover" @click="remember"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="忘记" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-close iconHover" @click="forget"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="永久记住" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-lock iconHover" @click="remembered"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="删除" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-delete iconHover" @click="deleteWord"></i>
        </el-tooltip>
      </div>
    </div>
    <div>
      <div class="translation" :hidden="word.explainedHidden">
        <div class="translate-editable" contenteditable="true">{{ word.explains }}</div>
      </div>
      <div class="sentence_wrapper achieve"></div>
    </div>
  </div>


</template>

<script setup lang="ts">
import type {Word} from "@/types/words";

const itemRef = ref<HTMLElement | null>(null);


defineExpose({
  $el: itemRef
});

// 接收word传参，并传递给子组件
const props = defineProps<{
  word: Word
}>()
const wordModel = defineModel<Word>({required: true})
const emit = defineEmits(['translation', 'remember', 'forget', 'delete'])


import {ref} from "vue";
import {DEFAULT_INTERVALS} from "@/constants";
import {useUsersStore} from "@/stores/users.ts";
import {useWordsStore} from "@/stores/words.ts";

const wordsStore = useWordsStore();

// 翻译
const translation = () => {
  wordModel.value.explainedHidden = !wordModel.value.explainedHidden;
}


// 获取audio元素的引用
const audioPlayer = ref<HTMLAudioElement | null>(null);
const localAudioUrl = ref<string | null>(null);

// 获取本地存储的音频 Blob URL
const getLocalAudioUrl = (wordId: string): string | null => {
  const stored = localStorage.getItem(`audio_${wordId}`);
  if (stored) {
    try {
      const blob = new Blob([new Uint8Array(JSON.parse(stored))], {type: 'audio/mpeg'});
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Failed to parse stored audio data:', e);
    }
  }
  return null;
};

// 下载并存储音频文件
const downloadAndStoreAudio = async (url: string, wordId: string) => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();

    // 存储到 localStorage (注意：localStorage 有大小限制)
    const arrayBuffer = await blob.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    localStorage.setItem(`audio_${wordId}`, JSON.stringify(Array.from(uint8Array)));

    // 创建本地 URL
    localAudioUrl.value = URL.createObjectURL(blob);
  } catch (error) {
    console.error('Failed to download and store audio:', error);
  }
};
// 播放语音
/*
const play = () => {

  if (audioPlayer.value) {
    audioPlayer.value.play().catch(error => {
      console.error('播放失败:', error);
    });
  }

}
*/

// 播放音频
const play = async () => {
  const wordId = props.word.text; // 假设 word 对象有 id 属性

  // 先尝试从本地获取音频 URL
  localAudioUrl.value = getLocalAudioUrl(wordId);

  // 如果本地没有，则下载并存储
  if (!localAudioUrl.value && props.word.pronunciation) {
    await downloadAndStoreAudio(props.word.pronunciation, wordId);
  }

  // 播放音频
  const audioSrc = localAudioUrl.value || props.word.pronunciation;
  if (audioPlayer.value && audioSrc) {
    audioPlayer.value.src = audioSrc;
    audioPlayer.value.play().catch(error => {
      console.error('播放失败:', error);
    });
  } else {
    console.warn('音频源无效，无法播放');
  }
};


/**
 * 记住
 */
const remember = () => {

  //如果 当前时间大于  上次复习时间+当前等级*默认复习间隔 且小于上次复习时间+（当前等级+3）*默认复习间隔  等级+1
  // 当前时间
  const now = new Date().getTime();
  let learnDate = wordModel.value.learnDate;

  // 确保 learnDate 是 Date 对象

  // 开始复习时间 (上次复习时间 + 当前等级对应的默认复习间隔)
  let level = wordModel.value.level;
  // todo 这里序列化不是时间类型
  /*if (!learnDate || !(learnDate instanceof Date)) {
    console.log(typeof learnDate + 'fddddddddd');
  }*/

  const startLearnDate = learnDate.getTime() + DEFAULT_INTERVALS[level] * 60 * 1000;

  // 结束复习时间 (上次复习时间 + (当前等级 + 3) 对应的默认复习间隔)
  const endLearnDate = learnDate.getTime() + DEFAULT_INTERVALS[Math.min(level + 3, DEFAULT_INTERVALS.length - 1)] * 60 * 1000;


  if (wordModel.value.level >= 12) {
    wordModel.value.remember = true;
  }


  //更新复习时间  ,todo 如果一直复习,可以一直无法升级,如果只有升级后更新 可能一开始就无法更新,
  wordModel.value.learnDate = new Date();

  // 是否复习，改为false
  wordModel.value.isReview = false;

  wordModel.value.explainedHidden = true;


  // 发送事件通知父组件
  // emit('remember', props.word);

  console.log('缓存单词数据', JSON.stringify(props.word));

  // 判断是否满足条件
  if (now > startLearnDate && now < endLearnDate) {
    // 等级+1
    wordModel.value.level++;
  } else {
    // 否则等级不变，仅更新复习时间
    console.log("未满足升级条件");
    // console.log(wordModel.value.learnDate.toLocaleTimeString()+'3333333');
  }
  wordsStore.addAndUpdateWord(wordModel.value)
}

/**
 * 永久记住,不再复习
 */
const remembered = () => {

  // 更新复习时间
  wordModel.value.learnDate = new Date();

  wordModel.value.level = 12
  // 是否复习，改为false
  wordModel.value.isReview = false;

  wordModel.value.explainedHidden = true;

  wordModel.value.remember = true;


  wordsStore.addAndUpdateWord(wordModel.value)
}

// 忘记
const forget = () => {
  // emit('forget', 'childValue');
  if (wordModel.value && wordModel.value.level > 0) {
    wordModel.value.level--;
  }
  if (wordModel.value.level < 12) {
    wordModel.value.remember = false;
  }
  wordModel.value.level === 0 ? wordModel.value.explainedHidden = false : wordModel.value.explainedHidden = true;

  wordsStore.addAndUpdateWord(wordModel.value)
}
// 删除单词
const deleteWord = () => {
  // wordModel.value;
  emit('delete');
}

</script>

<style scoped lang="scss">

</style>
