<template>

  <el-button type="primary" @click="clearWord">清空单词</el-button>
  <el-button type="primary" @click="initWord">初始化单词</el-button>

  <el-input v-model="word" placeholder="请输入单词"></el-input>
  <el-button type="primary" @click="addWord(word)">添加单词</el-button>


  <div class="words-cards-wrapper">
    <my-List-item v-for="item in words" :key="item.text" :word="item" >
    </my-List-item>
  </div>

  <div class="home_footer">
    <div><span>单词总数: 2228</span><span>待复习: 1109</span><span>已记完: 1119</span></div>
    <div><i class="iconfont icon-setting"></i><i class="iconfont icon-import"></i><i
        class="iconfont icon-export "></i><a href="#/home/list" style="margin-left: 16px;"><i
        class="iconfont icon-list active"></i></a><a href="#/home/typing" style="margin-left: 16px;"><i
        class="iconfont icon-card "></i></a></div>
  </div>
</template>

<script setup lang="ts">


import {AppInfo} from "../../../config";
import { ElMessage} from "element-plus";
import {isEmpty, truncate} from "lodash";
import {testData} from "../../../testData";
import CryptoJS from "crypto-js";
import {useStore} from "@/store";
import {ref} from "vue";
import type {YdParams} from "@/types/words";
// import MyListItem from "@/views/Word/components/MyListItem.vue";

const store = useStore();

const word = ref('');

const words = store.state.words.words





const clearWord = () => {
  store.commit('words/clearWords');
  ElMessage.success('清除成功');
}
const initWord = () => {
  clearWord()
  store.commit('words/updateWords', testData);
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

  store.dispatch('words/translation', params).then(res => {
    let resData = res.data;
    console.log(JSON.stringify(resData));
    if (resData.errorCode === '0' && !isEmpty(res)) {
      let oldWords = store.state.words.words;
      let newWords = {
        "word": resData.query,
        "explainedInChinese": resData.translation[0],
        "pronunciation": resData.tSpeakUrl
      };
      const data = oldWords ? [...oldWords, newWords] : newWords
      store.commit('words/updateWords', data);
      ElMessage.success('成功');
      // router.push('/')
    } else {
      ElMessage.error('失败');
      // ElMessage.error(res.data.errmsg)
    }
  })
}


</script>

<style scoped lang="scss">


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
