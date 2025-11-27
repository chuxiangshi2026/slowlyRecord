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

        <audio ref="audioPlayer" hidden></audio>
        <el-tooltip class="box-item" effect="dark" content="释义" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-translate iconHover" @click="translation()"/>
        </el-tooltip>
      </div>
      <div>
        <el-tooltip class="box-item" effect="dark" content="记住" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-check iconHover" @click="remember" :class="{ disabled: disableActions==2 }"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="忘记" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-close iconHover" @click="forget"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="永久记住" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-lock iconHover" @click="remembered" :class="{ disabled: disableActions==2 }"></i>
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
  word: Word,
  disableActions?: number
}>()
const wordModel = defineModel<Word>({required: true})
const emit = defineEmits(['translation', 'remember', 'forget', 'delete'])


import {ref} from "vue";
import {DEFAULT_INTERVALS} from "@/constants";
// import {useUsersStore} from "@/stores/users.ts";
import {useWordsStore} from "@/stores/words.ts";
import {bufferToWave} from "@/utils/audio-util.ts";

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
// 检查 pronunciation 是否包含URL（旧数据）
  if (props.word.pronunciation && props.word.pronunciation.startsWith('http')) {
    // 这是旧的URL数据，需要转换为文件数据
    return null; // 让系统重新下载并缓存
  }

  // 首先检查单词对象中的 pronunciation 字段是否包含缓存数据
  if (props.word.pronunciation && props.word.pronunciation.startsWith('data:audio')) {
    try {
      // 如果 pronunciation 包含数据，则认为是 base64 编码的音频数据
      const byteString = atob(props.word.pronunciation.split(',')[1]);
      const mimeString = props.word.pronunciation.split(',')[0].split(':')[1].split(';')[0];
      const ab = new ArrayBuffer(byteString.length);
      const ia = new Uint8Array(ab);
      for (let i = 0; i < byteString.length; i++) {
        ia[i] = byteString.charCodeAt(i);
      }
      const blob = new Blob([ab], {type: mimeString});
      return URL.createObjectURL(blob);
    } catch (e) {
      console.error('Failed to parse cached audio data from word object:', e);
    }
  }


  // 回退到 localStorage
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
    // const arrayBuffer = await blob.arrayBuffer();
    // const uint8Array = new Uint8Array(arrayBuffer);
    // localStorage.setItem(`audio_${wordId}`, JSON.stringify(Array.from(uint8Array)));


    // 创建一个音频上下文用于处理音频
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();

    // 读取音频数据
    const arrayBuffer = await blob.arrayBuffer();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);

    // 降低音频质量以减小文件大小
    // 降低采样率到 22050Hz (标准是 44100Hz)
    const targetSampleRate = 22050;
    const offlineContext = new OfflineAudioContext(
        audioBuffer.numberOfChannels,
        (audioBuffer.duration * targetSampleRate) | 0,
        targetSampleRate
    );

    // 创建源节点
    const source = offlineContext.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(offlineContext.destination);
    source.start();

    // 渲染降低采样率的音频
    const renderedBuffer = await offlineContext.startRendering();

    // 转换为 WAV 格式的 Blob
    const wavBlob = bufferToWave(renderedBuffer, targetSampleRate);

    // 存储到 localStorage (注意：localStorage 有大小限制)
    const wavArrayBuffer = await wavBlob.arrayBuffer();
    const uint8Array = new Uint8Array(wavArrayBuffer);
    localStorage.setItem(`audio_${wordId}`, JSON.stringify(Array.from(uint8Array)));


    // 同时存储到单词对象的 pronunciation 字段（base64编码）
    const reader = new FileReader();
    reader.onload = () => {
      wordModel.value.pronunciation = reader.result as string;
      // 更新数据库中的单词
      wordsStore.addAndUpdateWord(wordModel.value);
    };
    reader.readAsDataURL(blob);
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

// 添加一个变量来跟踪播放状态
let isPlaying = false;
// 播放音频
const play = async () => {
  // 防止重复点击造成的播放冲突
  if (isPlaying) {
    console.log('播放正在进行中，请稍后再试');
    return;
  }

  isPlaying = true;
  const wordId = props.word.text; // 假设 word 对象有 id 属性
  try {
    // 先尝试从本地获取音频 URL
    localAudioUrl.value = getLocalAudioUrl(wordId);

    // 如果本地没有，则下载并存储
    const url = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(props.word.text)}&type=1`;
    if (!localAudioUrl.value) {
      await downloadAndStoreAudio(url, wordId);
    }

    // 播放音频
    const audioSrc = localAudioUrl.value || url;
    if (audioPlayer.value && audioSrc) {
      audioPlayer.value.src = audioSrc;


      // 监听播放完成事件
      const onEnded = () => {
        isPlaying = false;
        audioPlayer.value!.removeEventListener('ended', onEnded);
      };

      // 监听播放错误事件
      const onError = () => {
        isPlaying = false;
        audioPlayer.value!.removeEventListener('error', onError);
      };

      audioPlayer.value.addEventListener('ended', onEnded);
      audioPlayer.value.addEventListener('error', onError);

      // 等待音频加载完成后再播放
      await new Promise((resolve) => {
        audioPlayer.value!.oncanplay = resolve;
      });

      await audioPlayer.value.play();
    } else {
      console.warn('音频源无效，无法播放');
      isPlaying = false;
    }
  } catch (error) {
    console.error('播放失败:', error);
    isPlaying = false;
  }
};


/**
 * 记住
 */
const remember = () => {

  // 如果disableActions为true，则不执行操作
  if (props.disableActions) return;

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

  if (props.disableActions) return;

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
  console.log("忘记方法",wordModel.value)
  // emit('forget', 'childValue');

  if (wordModel.value?.level >= 12) {
    console.log("12级单词忘记了")
    wordModel.value.level = 1;
    wordModel.value.remember = false;
    wordModel.value.isReview = true;
    wordModel.value.learnDate = new Date();
  }else if (wordModel.value?.level && wordModel.value.level > 1) {
    console.log("降级")
    wordModel.value.level--;
  }
  if (wordModel.value.level < 12) {
    wordModel.value.remember = false;
  }
  wordModel.value.level === 1 ? wordModel.value.explainedHidden = false : wordModel.value.explainedHidden = true;

  wordsStore.addAndUpdateWord(wordModel.value)
}
// 删除单词
const deleteWord = () => {
  // wordModel.value;
  emit('delete');
}

</script>

<style scoped lang="scss">

.disabled {
  opacity: 0.5;
  pointer-events: none;
  color: gray;
}

</style>
