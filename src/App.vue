<template>
  <RouterView/>
</template>


<script setup lang="ts">
import {RouterView, useRouter} from 'vue-router'

import {onMounted, onUnmounted, ref} from 'vue';
import {useWordsStore} from "@/stores/words.ts";
// import {storeToRefs} from "pinia";
import {DEFAULT_INTERVALS} from "@/constants";
import {addWord} from "@/utils/str-util.ts";
import {ElMessage} from "element-plus";
const wordsStore = useWordsStore();




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
  if (action.code === 'over') {
    // 把单词翻译了，添加到 列表中
    // console.log('==================', action)

    await handlePluginAddWord(action.payload)
  }


  if (action.code === 'huaci' && action.from ==='hotkey'){
    // action.type =='over'
    console.log('我是快捷键进来的')

    const selectedText = await navigator.clipboard.readText();

    checkAddWork(selectedText)

  }

  if (action.code === 'huaci' && action.from == 'main') {


    getSelectedTextFromSystem().then(text => {
          checkAddWork(text);
        }
    );

  }

  if (action.code === 'review') {
    handlePluginReview()
  }


})


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
  //   })


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
  await addWord(payload)

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
