<template>

  <!--  <el-button type="primary" @click="clearWord">清空单词</el-button>-->
  <!--  <el-button type="primary" @click="initWord">初始化单词</el-button>-->

  <el-row>
    <el-col>
      <el-button :span="2" type="primary" @click="addWord(word)">添加单词</el-button>
      <el-input :span="6" v-model="word" placeholder="请输入单词"></el-input>
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
    <div><span>单词总数: {{ words.length }}</span><span>待复习: {{
        rememberCount
      }}</span><span>已记完: {{ forgetCount }}</span></div>
    <div><i class="iconfont icon-setting"></i><i class="iconfont icon-import"></i><i
        class="iconfont icon-export "></i><a href="#/home/list" style="margin-left: 16px;"><i
        class="iconfont icon-list active"></i></a><a href="#/home/typing" style="margin-left: 16px;"><i
        class="iconfont icon-card "></i></a></div>
  </div>
</template>

<script setup lang="ts">


import {ElMessage} from "element-plus";
import {isEmpty, truncate} from "lodash";
import {testData} from "@/testData";
import {computed, onMounted, ref} from "vue";
import type {Word, YdParams} from "@/types/words";

import {useWordsStore} from "@/stores/words.ts";
import {storeToRefs} from "pinia";
import MyListItem from "@/views/Word/components/MyListItem.vue";

const word = ref('');



const wordsStore = useWordsStore();
const {words} = storeToRefs(wordsStore)

// 一个计算属性 ref
const rememberCount = computed(() => {
  return words.value.filter((word: Word) => word.isReview).length
})

const forgetCount = computed(() => {
  return words.value.length - rememberCount.value
})


const clearWord = () => {
  wordsStore.clearWords()
  ElMessage.success('清除成功');
}
const initWord = () => {
  clearWord()
  wordsStore.updateWords(testData)
  ElMessage.success('初始化成功');
}

import {getInitWord, getParam} from "@/utils/StrUtil.ts";

const addWord = (wordText: string) => {


  let findWord = words.value.find((item: Word) => {
    if (item.text === wordText) {
      return item
    }
  });

  if (findWord) {
      console.log('单词已存在');
    // 如果有这个单词
    if (findWord.explainedInChinese) {
      console.log('翻译已存在');
      ElMessage.success('单词已存在');
      return
    }

    const params: YdParams = getParam(wordText)
    wordsStore.translation(params).then(res => {
      let resData = res.data;
      if (resData.errorCode === '0' && !isEmpty(res)) {
        findWord.explainedInChinese = res.data.translation[0]
        findWord.isReview = true
        findWord.pronunciation = resData.tSpeakUrl
        findWord.phonetic = ''
        wordsStore.updateWord(findWord)
        ElMessage.success('添加成功');
        return
      }
    })

    ElMessage.error('添加失败');
    return;
  }


  const params: YdParams = getParam(wordText)


  console.log(JSON.stringify(params) + '-------')
  wordsStore.translation(params).then(res => {
    // 先判断有没有这个单词，有的话看下这个单词有没有翻译，有的话不做处理，没有更新这个单词

    let resData = res.data;
    console.log(JSON.stringify(resData));
    if (resData.errorCode === '0' && !isEmpty(res)) {

      // let oldWords = store.state.words.words;
      let oldWords = words.value
      let newWords = getInitWord(resData.query, resData.translation[0], resData.tSpeakUrl, '', '')

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
  right: 84%; /* 将输入框放置在按钮的右侧 */
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
