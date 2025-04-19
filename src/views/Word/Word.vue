<template>

<!--  <el-button type="primary" @click="clearWord">清空单词</el-button>-->
<!--  <el-button type="primary" @click="initWord">初始化单词</el-button>-->

  <el-row>
    <el-col>
      <el-button :span="2" type="primary" @click="addWord(word)">添加单词</el-button>
      <el-input :span="6" v-model="word" placeholder="请输入单词" ></el-input>
    </el-col>
  </el-row>


  <div class="words-cards-wrapper">
    <my-list-item v-if="words.length>0" v-for="(item,index) in words"
                  :key="index"
                  :word="item"
                  :style="item.isReview ? '': 'display:none' "
                  v-model="words[index]"
                  @delete="deleteWord(index)"
    >
    </my-list-item>
  </div>
<!--     旧版本的写法 @forget="(childValue)=>forget(item,childValue)"-->

  <div class="home_footer">
    <div><span>单词总数: {{words.length}}</span><span>待复习: {{ rememberCount }}</span><span>已记完: {{forgetCount}}</span></div>
    <div><i class="iconfont icon-setting"></i><i class="iconfont icon-import"></i><i
        class="iconfont icon-export "></i><a href="#/home/list" style="margin-left: 16px;"><i
        class="iconfont icon-list active"></i></a><a href="#/home/typing" style="margin-left: 16px;"><i
        class="iconfont icon-card "></i></a></div>
  </div>
</template>

<script setup lang="ts">


import {AppInfo} from "@/config";
import { ElMessage} from "element-plus";
import {isEmpty, truncate} from "lodash";
import {testData} from "@/testData";
import CryptoJS from "crypto-js";
import {computed, onMounted, ref} from "vue";
import type {Word, YdParams} from "@/types/words";

import {useWordsStore} from "@/stores/words.ts";
import {storeToRefs} from "pinia";
import MyListItem from "@/views/Word/components/MyListItem.vue";
import { v4 as uuidv4 } from 'uuid';
const word = ref('');

// onMounted(()=>{
//   initWord()
// })


const wordsStore = useWordsStore();
const {words} = storeToRefs(wordsStore)

// 一个计算属性 ref
const rememberCount = computed(() => {
  return words.value.filter((word: Word) => word.isReview).length
})

const forgetCount = computed(() => {
  return words.value.length-rememberCount.value
})






/*const forget = (word: Word,childValue:string) => {
  // 重置复习间隔
  // word.level = word.level == 0 ? 0 : word.level--;
  console.log(JSON.stringify(word) + '222222222222222'+childValue)
}*/




const clearWord = () => {
  wordsStore.clearWords()
  ElMessage.success('清除成功');
}
const initWord = () => {
  clearWord()
  wordsStore.updateWords(testData)
  ElMessage.success('初始化成功');
}


const addWord = (word: string) => {

  // 应用ID
  const appKey = AppInfo.appkey;
// 应用密钥
  const key = AppInfo.key;//注意：暴露appSecret，有被盗用造成损失的风险
  const salt = (new Date).getTime();
  const curtime = Math.round(new Date().getTime() / 1000);
  const query = word;
// 多个query可以用\n连接  如 query='apple\norange\nbanana\npear'
  const from = 'en';
  const to = 'zh-CHS';
// const vocabId =  '您的用户词表ID';
// sign=sha256(应用ID+input+salt+curtime+应用密钥)；
  const str1 = appKey + truncate(query) + salt + curtime + key;
  const sign = CryptoJS.SHA256(str1).toString(CryptoJS.enc.Hex);

  const params: YdParams = {
    //待翻译文本
    q: query,
    // 应用ID	True	可在应用管理 查看
    appKey: appKey,
    // 随机字符串，可使用UUID进行生产	True
    salt: salt,
    // 源语言
    from: from,
    // 目标语言
    to: to,
    // 签名	True	sha256(应用ID+input+salt+curtime+应用密钥)
    sign: sign,
    // 签名类型
    signType: "v3",
    // 当前UTC时间戳(秒)
    curtime: curtime,
    // 用户上传的术语表
    // vocabId: vocabId,
  }

  console.log(JSON.stringify(params) + '-------')
  wordsStore.translation(params).then(res => {
  // store.dispatch('words/translation', params).then(res => {
    let resData = res.data;
    console.log(JSON.stringify(resData));
    if (resData.errorCode === '0' && !isEmpty(res)) {

      // let oldWords = store.state.words.words;
      let oldWords = words.value
      let newWords:Word = {
        "text": resData.query,
        "explainedInChinese": resData.translation[0],
        "pronunciation": resData.tSpeakUrl,
        "isReview": true,
        "creatTime": new Date(),
        "reviewTime": new Date(),
        "level": 0,
        "_id": uuidv4(), // 假设_id为必填项
        "_rev": '', // 假设_rev为必填项
        "image": '', // 假设image为必填项
        "phonetic": '', // 假设phonetic为必填项

        // "image": resData.image
        // phonetic: resData.phonetic,
        // updateTime: new Date()
      };
      const data = oldWords ? [...oldWords, newWords] : [newWords]

      wordsStore.updateWords(data)
      ElMessage.success('成功');
      // router.push('/')
    } else {
      ElMessage.error('失败');
      // ElMessage.error(res.data.errmsg)
    }
  })
}


const deleteWord = (index: number) => {
  words.value.splice(index, 1)
}


</script>

<style scoped lang="scss">


.input-above-button {
  position: absolute;
  top: 0px; /* 调整输入框与按钮的垂直距离 */
  right: 84%;   /* 将输入框放置在按钮的右侧 */
  width: 200px; /* 根据需要调整输入框的宽度 */
}


.home_footer {
  position: fixed;
  bottom: 0;
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  background-color: white;
  height: 30px;
  border-top: 1px solid #eee;
  padding: 0 16px;
  box-sizing: border-box;
}


.el-card {
  width: 100vw;
  height: 80vh;
}


.words-cards-wrapper {
  display: flex;
  justify-content: space-around;
  flex-wrap: wrap;
  padding: 16px;
  background-color: #f8f8f8;
}


</style>
