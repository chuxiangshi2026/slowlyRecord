<template>
  <RouterView/>
  <!-- 引入OCR选择器组件 -->
  <OCRSelector
      :visible="showOCRPanel"
      :ocr-results="ocrResults"
      @close="closeOCRPanel"
      @select="handleSelectOCRItem"
      @select-all="handleSelectAllItems"
  />

  <!-- 引入文本选择器组件 -->
  <TextSelector
      :visible="showTextPanel"
      :text-content="textContent"
      @close="closeTextPanel"
      @select="handleSelectTextItems"
  />
</template>


<script setup lang="ts">
import {RouterView, useRouter} from 'vue-router'

import {onMounted, onUnmounted, ref} from 'vue';
import {useWordsStore} from "@/stores/words.ts";
// import {storeToRefs} from "pinia";
import {DEFAULT_INTERVALS} from "@/constants";
import {addWord, batchAddWords} from "@/utils/str-util.ts";
import {ElMessage} from "element-plus";
import {ocrTranslate} from "@/utils/pic-translate.ts";
// import path from "node:path";
import picData from '../picdata.json';
import OCRSelector from '@/views/Word/components/OCRSelector.vue';
import TextSelector from '@/views/Word/components/TextSelector.vue';
import {AppInfo} from "@/config.ts";

const wordsStore = useWordsStore();

// import {fileToBase64, ocrTranslate, translateImage} from '@/utils/pic-translate.ts'

const preview = ref<string>('')

// 添加OCR结果相关的响应式变量
const showOCRPanel = ref<boolean>(false);
const ocrResults = ref<any[]>([]);

// 添加文本选择相关的响应式变量
const showTextPanel = ref<boolean>(false);
const textContent = ref<string>('');

utools.onPluginEnter(async (action) => {
  // { code, type, payload, option, from }

  /*  // app版本
    const currentVerson = window.services.getAppVerson()
    // 数据库版本
    const previousVerson = window.services.wordModel.getAppVersionFromDb()
    // 有返回false   null返回ture
    let b = !previousVerson?.version;
    if (
        //   ?.  链式调用，空返回 undef
        b ||
        currentVerson !== previousVerson?.version
    ) {
      // 没有版本或版本不一致   指定为最新版本
      window.services.wordModel.setAppVerson(currentVerson)
      // 显示更新通知
      // dispatch(updateshowNotification(true))
      console.log('新版，更新version', currentVerson)
    }*/


  // await initUtoolSetting()

  console.log("action对象", JSON.stringify(action))
  /*  if (action.code === 'snap') {
      console.log('进来了')
      window.services.snap()
      console.log('走了--')
    }*/


  if (action.code === 'over') {

    // 把单词翻译了，添加到 列表中
    // console.log('==================', action)

    await handlePluginAddWord(action.payload);

  }


  if (action.code === 'huaci' && action.from === 'hotkey') {
    // action.type =='over'
    // console.log('我是快捷键进来的')
    const selectedText = await navigator.clipboard.readText();
    // 显示文本选择面板
    displayTextSelection(selectedText);
  }

  if (action.code === 'huaci' && action.from == 'main') {
    // const text = await window.services.getSelectedTextFromSystem();
    //       checkShearBoardAddWork(text);

    getSelectedTextFromSystem().then(text => {
          checkShearBoardAddWork(text);
        }
    );
  }

  if (action.code === 'huaduan' && action.from === 'hotkey') {
    // action.type =='over'
    // console.log('我是快捷键进来的')
    const selectedText = await navigator.clipboard.readText();
    // 显示文本选择面板
    displayTextSelection(selectedText);
  }

  if (action.code === 'huaduan' && action.from == 'main') {

    getSelectedTextFromSystem().then(text => {
      // 显示文本选择面板
      displayTextSelection(text);
        }
    );
  }

  if (action.code === 'jietu') {

    console.log('满足截图条件')

    // try {
    const imgPath = await window.services.capture()
    // const imgPath = 'C:\\Users\\skj\\AppData\\Local\\Temp\\utools_snap.png'

    const response = await fetch(imgPath);
    const blob = await response.blob();
    const file = new File([blob], 'utools_snap.png', {type: blob.type});

    console.log('文件对象', file.name, file.type, file.size)
    utools.showMainWindow()
    try {
      // 'en', 'zh-CHS'
      const result = await ocrTranslate(file, AppInfo['youdao'].appkey, AppInfo['youdao'].key, 'en', 'zh-CHS');

      // const result = picData;
      console.log(result)
      if (result.errorCode !== '0') {
        console.log(`errorCode=${result.errorCode} 原始返回：${JSON.stringify(result)}`)
        // console.log(`翻译失败，错误码: ${result.errorCode}`);
      }
      const msg = result.resRegions?.map(r => r.tranContent || r.context) || []
// 处理OCR返回的坐标和翻译结果
      if (result.resRegions && Array.isArray(result.resRegions)) {
        // 显示可选择的单词和翻译结果
        displayOCRResults(result.resRegions);
      } else {
        ElMessage.warning('OCR识别结果为空，请检查图片内容');
      }


      console.log('msg' + msg)
      // ElMessage.success(''+msg)
      if (msg.length <= 0) {
        ElMessage.warning('OCR识别结果为空，请检查图片内容');
      }

      // preview.value = URL.createObjectURL(blob)
    } catch (err: any) {
      alert(err.message || '翻译失败')
    }
  }
  // }


  if (action.code === 'review') {
    handlePluginReview()
    open()
  }


})


/*const translate = async () => {
  if (!selectedImage.value) return;

  isLoading.value = true;
  error.value = '';
  translationResult.value = null;

  try {
    // 1. 将图片转换为Base64
    const base64 = await fileToBase64(selectedImage.value);

    // 2. 调用翻译函数
    // 注意：此处仅为前端演示，appSecret 暴露有风险！
    const appKey = '你的应用ID'; // 替换为你的appKey
    const appSecret = '你的应用密钥'; // 替换为你的appSecret

    const result = await translateImage(base64, fromLang.value, toLang.value, appKey, appSecret);
    translationResult.value = result;

    // 3. 检查错误码（0表示成功）
    if (result.errorCode !== '0') {
      error.value = `翻译失败，错误码: ${result.errorCode}`;
    }
  } catch (err: any) {
    console.error('翻译失败:', err);
    error.value = err.message || '翻译过程出现异常';
  } finally {
    isLoading.value = false;
  }
};*/

/**
 * 显示OCR识别结果供用户选择和保存
 */
function displayOCRResults(resRegions: any[]) {
  // 存储OCR结果
  ocrResults.value = resRegions;

  // 显示选择面板
  showOCRPanel.value = true;
}

/**
 * 在指定坐标创建可点击区域
 */
/*function createClickableRegion(word: string, translation: string, coords: any) {
  // 如果有坐标信息，可以高亮显示这些区域
  // 这里我们简单地记录坐标信息
  console.log(`坐标:`, coords, `单词: ${word}`, `翻译: ${translation}`);

  // 提供选择选项
  if (confirm(`识别到单词: "${word}", 翻译: "${translation}"\n是否保存?`)) {
    addWord(`${word} ${translation}`);
    ElMessage.success(`已保存: ${word} - ${translation}`);
  }
}*/

/**
 * 选择特定的OCR识别项
 */
function handleSelectOCRItem(region: any) {
  let word = region.context || '';
  // let translation = region.tranContent || '';

  // 如果是新OCRSelector组件传递的单词对象
  if (region.originalText && region.translatedText) {
    word = region.originalText;
    // translation = region.translatedText;
  }

  if (word) {
    console.log('待添加的选中单词' + `[${word}]`)
    batchAddWords([`${word}`.trim()]);
    // ElMessage.success(`已保存: ${word} - ${translation}`);
  } else {
    ElMessage.warning('单词或翻译内容为空');
  }
}

/**
 * 选择所有OCR识别项
 */
function handleSelectAllItems(items: any[]) {
  items.forEach(region => {
    const word = region.context || '';
    const translation = region.tranContent || '';

    if (word && translation) {
      addWord(`${word} ${translation}`);
    }
  });

  if (items.length > 0) {
    ElMessage.success(`已保存全部 ${items.length} 个单词`);
  }
}

/**
 * 关闭OCR面板
 */
function closeOCRPanel() {
  showOCRPanel.value = false;
  ocrResults.value = [];
}

/**
 * 校验剪切板中的单词
 * @param text
 */
function checkAddWork(text: string) {
  // 5. 判断逻辑（根据你的场景调整阈值）
  const textError = (
      text.length <= 0 ||
      text.endsWith('\n') ||          // 以换行符结尾（整行复制的典型特征）
      text.length > 25                // 长度超过合理选中范围
  );
  if (textError) {
    ElMessage.error('请先用光标选中单词');
  } else {
    addWord(text)
    // ElMessage.success(text);
  }
}

// ==================== 核心：静默获取选中文本 ====================
async function getSelectedTextFromSystem(): Promise<string> {


  utools.copyText('')

  utools.hideMainWindow();

  await new Promise(r => setTimeout(r, 50)); // 等待焦点恢复

  // 获取当前平台
  const isMac = utools.isMacOS();

// 根据平台选择修饰键
  const modifier = isMac ? "command" : "ctrl";
  utools.simulateKeyboardTap("c", modifier);

  utools.showMainWindow();

  // console.log('ok',ok)
  // 3. 等待系统完成复制（100ms 足够）
  // 2. 使用可靠的延迟方式（推荐 200-300ms）
  await new Promise(resolve => setTimeout(resolve, 50));

  // 4. 读取剪贴板
  const selectedText = await navigator.clipboard.readText();
  // console.log('新内容', selectedText);


  // 5. 恢复原始剪贴板内容
  // if (originalClipboard) {
  //  await  navigator.clipboard.writeText(originalClipboard);
  // }

  return selectedText;
}


/**
 * 校验剪切板中的单词
 * @param text
 */
function checkShearBoardAddWork(text: string) {
  // 去除首尾空格并替换多个连续空格为单个空格
  let processedText = text.trim().replace(/\s{2,}/g, ' ');

  // 检查是否为空字符串或仅包含空格
  if (!processedText || processedText.length > 50 || !/^[a-zA-Z\-'\s]+$/.test(processedText)) {
    ElMessage.error('请选中单个有效单词或短语');
    return;
  }
  // 验证处理后的文本是否符合要求（非空且不超过限制）
  addWord(processedText);
}

/**
 * 显示文本选择面板供用户选择和保存单词
 */
function displayTextSelection(text: string) {
  // 存储文本内容
  textContent.value = text;

  // 显示选择面板
  showTextPanel.value = true;
}

/**
 * 选择特定的文本项
 */
function handleSelectTextItems(words: string[]) {
  if (words && words.length > 0) {
    console.log('待添加的选中单词', words);
    batchAddWords(words);
  } else {
    ElMessage.warning('单词内容为空');
  }
}

/**
 * 关闭文本选择面板
 */
function closeTextPanel() {
  showTextPanel.value = false;
  textContent.value = '';
}

onMounted(() => {

  // 首页刷新时触发   自动更新需要复习的单词
  updateReview();


  // window.addEventListener('selected-text', handleSelectedText as EventListener);


  // 进入插件


  /*  const initUtoolSetting = () => {
      return new Promise((resolve) => {
        let setting = window.services.wordModel.getUtoolsSetting()
        if (!setting) {
          setting = initialUtoolState
          window.services.wordModel.setUtoolsSetting(setting)
        }
        // dispatch(setUtoolSetting(setting)) // 同步到redux
        console.log('UtoolSetting', setting)
        utoolsSettingRef.current = setting
        resolve(setting)
      })
    }*/
  /*utools.onPluginEnter((action) => {
  //用户进入插件应用
    console.log(JSON.stringify(action))
    route.value = action.code
    enterAction.value = action
    // { code, type, payload, option, from }


    // app版本
    // const currentVerson = window.services.getAppVerson()
    // 数据库版本
    // const previousVerson = window.services.wordModel.getAppVersionFromDb()

    // 添加单词
    if (action.code === 'add vocabulary') {
      // addWord(action.payload)

    }
    // 复习单词

    // if (action.code === 'review') {
    //   getWordList()
    // }
  })*/


  // 退出插件时触发
  //   window.utools.onPluginOut((isKill) => {
  //     route.value = ''
  //   }


});


/**
 * 处理复习单词的插件入口
 */
function handlePluginReview() {
  // 显示主窗口
  window.utools.showMainWindow()

  // 可以添加其他复习相关的逻辑
  // 例如：切换到复习页面、加载复习数据等
}

/**
 * 隐藏主界面,并添加单词
 */
async function handlePluginAddWord(payload: string) {
  // const needclose = !!utoolsSettingRef.current?.closeAfterAddWord
  // 隐藏主窗口
  // if (needclose) window.utools.hideMainWindow()

  // console.log('addWord====================', action.payload)
  // 传入 scrollToWordByText 作为回调函数
  await batchAddWords([payload])

//   退出插件

  // 检查快捷键是否启用
  if (wordsStore.pluginStatus) {
    utools.hideMainWindow();
  }
}

/**
 * 更新需要复习的单词
 */
function updateReview() {

  // 获取本地的数据，如果是空或和数据库的大小不一致，比较数据，留最新的
  let dbWords = wordsStore.listWords();
  console.log(dbWords, 'dbWords')
  // 过滤掉word为空字符串的单词
  dbWords = dbWords.filter((item: any) => item.word && item.word.trim() !== '');


  // console.log(words.value, typeof words.value[0].learnDate, '9999999')
  for (const item of dbWords) {

    // item.isReview = true
    // console.log(item)
    item.learnDate = new Date(item.learnDate);
    item.ctime = new Date(item.ctime);
    let learnDate = item.learnDate.getTime() + DEFAULT_INTERVALS[item.level] * 60 * 1000;
    let now = Date.now();
    // console.log(now, learnDate, '00000111111', item.isReview)
    // 当前时间大于复习时间 ,
    if (!item.isReview && now > learnDate) {
      item.isReview = true
      wordsStore.addAndUpdateWord(item)
    }
  }
}

</script>


<style lang="scss">
//scoped
@use '@/assets/styles/reset.scss';
//@use '@/assets/styles/common.scss';

@use '@/assets/styles/card-item.scss';
@use '@/assets/styles/index.scss';
@use '@/assets/styles/letter.scss';
@use '@/assets/styles/list-item.scss';
@use '@/assets/icons/iconfont.css';
@use '@/assets/styles/iconfont1.scss';

</style>
