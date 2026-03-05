<template>

  <!--ref="root"-->
  <div class="list-item" :class="{ 'shortcut-enabled': wordsStore.shortcutEnabled, 'first-item': isFocus }"
       ref="itemRef" :data-word="word.text" tabindex="0" @keydown="handleKeyDown" @click="onClick">

    <p class="word">
      {{ word.text }}
      <span class="phonetic">{{ displayPhonetic }}</span>
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
          <i class="iconfont icon-check iconHover" @click="remember" :class="{ disabled: disableActions!=0 }"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="忘记" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-close iconHover" @click="forget"
             :class="{ disabled: disableActions==1||disableActions==3}"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="永久记住" placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-lock iconHover" @click="remembered" :class="{ disabled: disableActions!=0 }"></i>
        </el-tooltip>
        <el-tooltip class="box-item" effect="dark" content="删除"
                    placement="top" popper-class="small-tooltip">
          <i class="iconfont icon-delete iconHover" @click="deleteWord" :class="{ disabled: disableActions==1 }"></i>
        </el-tooltip>
      </div>
    </div>
    <div>
<!--      hiddenExplain===word.text?word.explainedHidden: -->
      <div class="translation" :hidden="(showExplained===-1?!word.explainedHidden:showExplained) == 0">
        <!--             @keydown.ctrl.enter="saveExplanation"-->
        <div class="translate-editable" contenteditable="true"
             @blur="saveExplanation"
             @keydown="handleKeydown"
             ref="explanationRef"
        >{{ word.explains }}
        </div>
        <!--        <div class="edit-tip"></div>-->
        <!--&lt;!&ndash;        按 Ctrl+Enter 保存编辑&ndash;&gt;-->
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
const props = withDefaults(defineProps<{
  word: Word,
  disableActions?: number  //0 待复习  1已复习  2 永久记住 3 全部
  showExplained?: number  //-1 显示原逻辑， 1显示全部 0 隐藏全部
  isFirst?: boolean  // 是否是第一个元素
  // hiddenExplain?: string
}>(), {
  disableActions: 0,
  showExplained: -1,
  // hiddenExplain: ''
});
const wordModel = defineModel<Word>({required: true})

const emit = defineEmits(['translation', 'remember', 'forget', 'delete'])

// 删除锁，防止连续点击
const isDeleting = ref(false)


import {DEFAULT_INTERVALS} from "@/constants";
// import {useUsersStore} from "@/stores/users.ts";
import {useWordsStore} from "@/stores/words.ts";
import {bufferToWave, downloadAndStoreAudio} from "@/utils/audio-util.ts";
import {computed, nextTick, onMounted, ref, toRef} from "vue";
import {ElMessage} from "element-plus";

const wordsStore = useWordsStore();
// 是否处于焦点状态
const isFocus = ref(false);

// 显示音标（过滤掉URL，防止发音链接显示为音标）
const displayPhonetic = computed(() => {
  const phonetic = props.word.phonetic || '';
  // 如果音标字段包含URL（http/https），则不显示
  if (phonetic.match(/^https?:\/\//i)) {
    return '';
  }
  return phonetic;
});
onMounted(async () => {
  // 如果是第一个元素，则自动获取焦点
  if (props.isFirst) {
    await nextTick(); // 确保DOM渲染完成
    setTimeout(() => {
      if (wordsStore.shortcutEnabled && itemRef.value) {
        itemRef.value.focus();
        isFocus.value = true;
      }
    }, 100); // 延迟确保DOM完全渲染
  }
});
/*
   编辑释义+快捷键保存
 */
const explanationRef = ref<HTMLElement | null>(null);
// 处理键盘事件
const handleKeydown = (event: KeyboardEvent) => {
  // 检查快捷键是否启用
  /*if (!wordsStore.shortcutEnabled) {
    return;
  }*/
  // 检查是否按下了 Ctrl+Enter
  if (event.ctrlKey && event.key === 'Enter') {
    saveExplanation(event);
    // 保存后失去焦点
    if (explanationRef.value) {
      explanationRef.value.blur();
    }
    // 阻止默认行为
    event.preventDefault();
  }
};

// 检查快捷键是否启用
// const isShortcutEnabled = () => {
//   wordsStore.shortcutEnabled
//   const savedStatus = localStorage.getItem('shortcutEnabled');
//   return savedStatus !== null ? savedStatus === 'true' : true; // 默认启用
// };

// 新增键盘事件处理
const handleKeyDown = (event: KeyboardEvent) => {

  // 检查快捷键是否启用
  if (!wordsStore.shortcutEnabled) {
    return;
  }
  // console.log("快捷键")
  // 检查是否按下 Shift+R (记住)
  if (event.shiftKey && event.key.toLowerCase() === 'r') {
    console.log("shift+r快捷键被按下")
    event.preventDefault();
    remember();
  }
  // 检查是否按下 Shift+F (忘记)
  else if (event.shiftKey && event.key.toLowerCase() === 'f') {
    console.log("shift+f快捷键被按下")
    event.preventDefault();
    forget();
  }
  // 检查是否按下 Shift+P (发音)
  else if (event.shiftKey && event.key.toLowerCase() === 'p') {
    console.log("shift+p快捷键被按下")
    event.preventDefault();
    play();
  }
  // 检查是否按下 Shift+T (翻译)
  else if (event.shiftKey && event.key.toLowerCase() === 't') {
    console.log("shift+t快捷键被按下")
    event.preventDefault();
    translation();
  }
};

// 点击事件处理 - 获取焦点
const onClick = () => {
  // 检查快捷键是否启用，只有启用时才获取焦点
  if (wordsStore.shortcutEnabled && itemRef.value) {
    itemRef.value.focus();
  }
};
// 获得焦点时的处理
const onFocus = () => {
  console.log("组件获得焦点");
};


// 保存释义
const saveExplanation = (event: Event) => {
  const target = event.target as HTMLElement;
  const newExplanation = target.innerText.trim();

  // 只有当内容发生变化时才更新
  if (newExplanation !== wordModel.value.explains) {
    wordModel.value.explains = newExplanation;
    wordsStore.addAndUpdateWord(wordModel.value);
  }
}


//不影响父组件的值 ，因为这个值不需要传回父组件
// const hiddenExplain = ref(props.hiddenExplain);
// const hiddenExplain = toRef(props, 'hiddenExplain');
const hiddenExplain = ref('');
// const hiddenExplain = ;
// 翻译
const translation = () => {
  hiddenExplain.value = wordModel.value.text
  wordModel.value.explainedHidden = !wordModel.value.explainedHidden;
}


// 获取audio元素的引用
const audioPlayer = ref<HTMLAudioElement | null>(null);
const localAudioUrl = ref<string | null>(null);

// 获取本地存储的音频 URL（只返回 Data URL，不返回 http URL）
const getLocalAudioUrl = (wordId: string): string | null => {
  // 首先检查单词对象中的 pronunciation 字段是否包含 Data URL（已缓存的音频）
  if (props.word.pronunciation && props.word.pronunciation.startsWith('data:audio')) {
    // 直接使用 Data URL
    return props.word.pronunciation;
  }

  // 如果 pronunciation 是 http URL，说明未缓存，返回 null 让调用方下载
  // 注意：如果存储的是百度 URL，也会返回 null，使用有道重新下载
  if (props.word.pronunciation && props.word.pronunciation.startsWith('http')) {
    // 检测并清理旧的百度 URL
    if (props.word.pronunciation.includes('fanyi.baidu.com')) {
      console.log('检测到旧的百度发音URL，将使用有道重新下载');
    }
    return null;
  }

  // 回退到 localStorage，转换为 Data URL
  const stored = localStorage.getItem(`audio_${wordId}`);
  if (stored) {
    try {
      const uint8Array = new Uint8Array(JSON.parse(stored));
      // 检测音频类型（根据前几个字节）
      let mimeType = 'audio/mpeg'; // 默认 MP3
      if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) {
        mimeType = 'audio/wav'; // RIFF 头表示 WAV
      }
      // 转换为 Base64
      let binary = '';
      const bytes = new Uint8Array(uint8Array);
      const len = bytes.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      const base64 = btoa(binary);
      return `data:${mimeType};base64,${base64}`;
    } catch (e) {
      console.error('Failed to parse stored audio data:', e);
    }
  }
  return null;
};

// 下载并存储音频文件
/*const downloadAndStoreAudio = async (url: string, wordId: string) => {
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
};*/


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
  const wordId = props.word.text;
  try {
    // 先尝试从本地获取音频 URL
    localAudioUrl.value = getLocalAudioUrl(wordId);
    console.log('本地音频URL:', localAudioUrl.value ? '已缓存' : '未缓存');

    // 播放音频：优先使用本地 Data URL
    let audioSrc = localAudioUrl.value;

    // 如果没有本地缓存，按优先级下载音频
    if (!audioSrc) {
      console.log('没有本地缓存，开始下载音频...');

      // 优先级1: 尝试 Edge TTS (音质最好)
      try {
        console.log('尝试 Edge TTS...');
        const {speakWithEdgeTTS} = await import('@/utils/translation-api.ts');
        const edgeSuccess = await speakWithEdgeTTS(props.word.text);
        if (edgeSuccess) {
          console.log('Edge TTS 播放成功');
          isPlaying = false;
          return;
        }
      } catch (error) {
        console.log('Edge TTS 失败:', error);
      }

      // 优先级2: 有道在线 TTS
      console.log('Edge TTS 不可用，尝试有道 TTS...');
      const youdaoUrl = `https://dict.youdao.com/dictvoice?audio=${encodeURIComponent(props.word.text)}&type=1`;
      const youdaoResult = await downloadAndStoreAudio(youdaoUrl, wordId, false);

      if (youdaoResult) {
        audioSrc = youdaoResult.dataUrl;
        localAudioUrl.value = youdaoResult.dataUrl;
        wordModel.value.pronunciation = youdaoResult.dataUrl;
        wordsStore.addAndUpdateWord(wordModel.value);
        console.log('有道 TTS 下载成功，使用 Data URL 播放');
      } else {
        // 优先级3: Web Speech API (离线备用)
        console.warn('有道 TTS 也失败，尝试 Web Speech API...');
        const {speakWithWebSpeech} = await import('@/utils/translation-api.ts');
        const success = speakWithWebSpeech(props.word.text);
        if (success) {
          console.log('Web Speech API 播放成功');
          isPlaying = false;
          return;
        }
        // 所有方案都失败
        ElMessage.error('发音播放失败，请检查网络连接');
        isPlaying = false;
        return;
      }
    }

    console.log('播放音频源:', audioSrc.substring(0, 50) + '...');

    if (audioPlayer.value && audioSrc) {
      // 重置音频元素
      audioPlayer.value.pause();
      audioPlayer.value.currentTime = 0;
      audioPlayer.value.src = audioSrc;

      // 监听播放完成事件
      const onEnded = () => {
        console.log('音频播放完成');
        isPlaying = false;
        audioPlayer.value!.removeEventListener('ended', onEnded);
      };

      // 监听播放错误事件
      const onError = (e: Event) => {
        console.error('音频播放错误:', e);
        isPlaying = false;
        audioPlayer.value!.removeEventListener('ended', onEnded);
        audioPlayer.value!.removeEventListener('error', onError);
      };

      audioPlayer.value.addEventListener('ended', onEnded);
      audioPlayer.value.addEventListener('error', onError);

      // 等待音频加载完成后再播放（带超时）
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error('音频加载超时'));
        }, 5000);

        audioPlayer.value!.oncanplay = () => {
          clearTimeout(timeout);
          resolve(undefined);
        };

        audioPlayer.value!.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('音频加载失败'));
        };
      });

      await audioPlayer.value.play();
      console.log('开始播放');
    } else {
      console.warn('音频源无效，无法播放');
      isPlaying = false;
    }
  } catch (error) {
    console.error('播放失败:', error);
    // 最后尝试 Web Speech API
    try {
      const {speakWithWebSpeech} = await import('@/utils/translation-api.ts');
      const success = speakWithWebSpeech(props.word.text);
      if (success) {
        console.log('Web Speech API 降级播放成功');
      }
    } catch (e) {
      console.error('Web Speech API 也失败:', e);
    }
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
  if (typeof learnDate === 'string') {
    learnDate = new Date(learnDate);
  } else if (!(learnDate instanceof Date)) {
    learnDate = new Date(); // 如果不是有效的日期，使用当前时间
  }
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


  //更新复习时间  ,todo 如果一直复习,可能一直无法升级,如果只有升级后更新 可能一开始就无法更新,
  wordModel.value.learnDate = new Date();

  // 是否复习，改为false
  wordModel.value.isReview = false;

  wordModel.value.explainedHidden = true;


  // 发送事件通知父组件
  // emit('remember', props.word);

  console.log('缓存单词数据', JSON.stringify(props.word));

  // 判断是否满足条件
  const canLevelUp = now > startLearnDate && now < endLearnDate;
  console.log(`升级检查: 当前时间=${new Date(now).toLocaleString()}, 开始时间=${new Date(startLearnDate).toLocaleString()}, 结束时间=${new Date(endLearnDate).toLocaleString()}, 可升级=${canLevelUp}`);
  
  if (canLevelUp) {
    // 根据记忆牢固度决定升级速度
    const firmness = wordsStore.memoryFirmness;
    let levelIncrement = 1; // 默认正常：+1级
    if (firmness === '较强') {
      levelIncrement = 2; // 较强：+2级
    } else if (firmness === '极强') {
      levelIncrement = 3; // 极强：+3级
    }
    // 升级等级，但不超过12级
    const currentLevel = Number(wordModel.value.level) || 1;
    wordModel.value.level = Math.min(currentLevel + levelIncrement, 12) as Word['level'];
    console.log(`[升级成功] 记忆牢固度: ${firmness}, 提升: +${levelIncrement}级, 当前等级: ${wordModel.value.level}`);
  } else {
    // 否则等级不变，仅更新复习时间
    if (now <= startLearnDate) {
      console.log("[未升级] 复习太早，还没到升级时间");
    } else {
      console.log("[未升级] 复习太晚，已错过升级时间窗口");
    }
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
  console.log("忘记方法", wordModel.value)
  // emit('forget', 'childValue');

  if (wordModel.value?.level >= 12) {
    console.log("12级单词忘记了")
    wordModel.value.level = 1;
    wordModel.value.remember = false;
    wordModel.value.isReview = true;
    wordModel.value.learnDate = new Date();
  } else if (wordModel.value?.level && wordModel.value.level > 1) {
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
  if (isDeleting.value) return;
  isDeleting.value = true;
  emit('delete');
  // 延迟重置锁，防止连续点击
  setTimeout(() => {
    isDeleting.value = false;
  }, 300);
}

</script>

<style scoped lang="scss">

.disabled {
  opacity: 0.5;
  pointer-events: none;
  color: gray;
}

/* 为获得焦点的元素添加视觉反馈 */
.list-item:focus {
  outline: 1px solid #409eff; /* Element Plus 主色调 */
  border-radius: 2px;
}

/* 只有在快捷键启用时才显示聚焦效果 */
.list-item.shortcut-enabled:focus {
  outline: 1px solid #409eff; /* Element Plus 主色调 */
  border-radius: 2px;
}

/* 快捷键关闭时不显示聚焦效果 */
.list-item:not(.shortcut-enabled):focus {
  outline: none;
}

</style>
