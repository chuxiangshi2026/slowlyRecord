<template>

  <!--  <el-button type="primary" @click="clearWord">清空单词</el-button>-->
  <!--  <el-button type="primary" @click="initWord">初始化单词</el-button>-->

  <!--  <el-row>-->
  <!--    <el-col>-->
  <!--      <el-button :span="2" type="primary" @click="addWord(word)">添加单词</el-button>-->
  <!--      <el-input :span="6" v-model="word" placeholder="请输入单词"></el-input>-->
  <!--    </el-col>-->
  <!--  </el-row>-->


  <div v-if="wordsStore.count > 0">
    <div class="words-cards-wrapper" ref="scrollContainer">
      <MyListItem v-for="(item,index) in wordsStore.words"
                  :key="index"
                  :word="item"
                  :style="item.isReview ? '': 'display:none' "
                  v-model="wordsStore.words[index]"
                  @delete="deleteWord(index)"
                  :ref="(el) => setItemRef(el, index)"
      >
      </MyListItem>
    </div>
  </div>
  <div v-else>暂无数据,请在主界面输入框添加单词</div>
  <!--     旧版本的写法 @forget="(childValue)=>forget(item,childValue)"-->

  <div class="home_footer">
    <div>
      <span>单词总数: {{ wordsStore.count }}</span>
      <span>待复习: {{ wordsStore.forgetCount }}</span>
      <span>已复习: {{ wordsStore.reviewCount }}</span>
      <span>已记完: {{ wordsStore.rememberCount }}</span>
    </div>
    <div>
      <!--      <i class="iconfont icon-setting"></i>-->
<!--      <i class="iconfont icon-time" @click="scrollToWordByText('disk')"></i>-->
      <i class="iconfont icon-top" @click="scrollToTop"></i>
      <i class="iconfont icon-down" @click="scrollToBottom"></i>
      <i class="iconfont icon-visible" @click="visibleExplained"></i>
      <i class="iconfont icon-invisible" @click="invisibleExplained"></i>
      <i class="iconfont icon-import" @click="importWords"></i>
      <i class="iconfont icon-export" @click="exportWords"></i>
      <!--      <a href="#/home/list" style="margin-left: 16px;">-->
      <!--        &lt;!&ndash;        <i class="iconfont icon-list active"></i>&ndash;&gt;-->
      <!--      </a>-->
      <!--      <a href="#/home/typing" style="margin-left: 16px;">-->
      <!--        <i class="iconfont icon-card "></i>-->
      <!--      </a>-->
    </div>
  </div>
</template>

<script setup lang="ts">


import {ElMessage} from "element-plus";
import {testData} from "@/testData";
import type {Word} from "@/types/words";

import {useWordsStore} from "@/stores/words.ts";
import MyListItem from "@/views/Word/components/MyListItem.vue";
import {v4 as uuidv4} from "uuid";
import {DB_KEY} from "@/constants";
import {nextTick, ref, watch} from "vue";


const wordsStore = useWordsStore();


/*
  单词滚动模块
 */
const scrollContainer = ref<HTMLElement | null>(null)
const itemRefs = ref<HTMLElement[]>([])

// 设置单项引用
const setItemRef = (el: any, index: number) => {

  // el 是组件实例，我们需要获取它的 $el 属性
  if (el && el.$el) {
    itemRefs.value[index] = el.$el;
  }
 /* if (el) {
    itemRefs.value[index] = el
  }*/
}

// 滚动到指定索引的单词
const scrollToWord = (index: number) => {
  nextTick(() => {
    if (itemRefs.value[index] && scrollContainer.value) {
      const container = scrollContainer.value
      const targetElement = itemRefs.value[index]

      // 计算相对位置
      const containerRect = container.getBoundingClientRect()
      const targetRect = targetElement.getBoundingClientRect()

      // 滚动到目标元素位置
      container.scrollTop = container.scrollTop + targetRect.top - containerRect.top - 100


      // 延迟清空状态，确保滚动执行完成
      setTimeout(() => {
        wordsStore.setLastAddedWordText('')
      }, 100)
    }
  })
}


// 滚动到顶部
const scrollToTop = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  } else {
    window.scrollTo({top: 0, behavior: 'smooth'})
  }
}

// 滚动到底部
const scrollToBottom = () => {
  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  } else {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    })
  }
}

/**
 * 滚动到指定单词处
 */
const scrollToWordByText = (wordText: string) => {
  console.log("---------", wordText, wordsStore.lastAddedWordText)
  const index = wordsStore.words.findIndex(word => word.text === wordText)
  if (index !== -1) {
    scrollToWord(index)
  }
}


// 当新数据更新时 自动滚动到单词处
// 监听 Store 中的 lastAddedWordText 状态
watch(() => wordsStore.lastAddedWordText, (wordText) => {
  console.log("Watch triggered with wordText:", wordText);
  if (wordText) {
    nextTick(() => {  // 等待 DOM 更新
      console.log("Scrolling to word:", wordText);
      scrollToWordByText(wordText)  // 调用组件内的滚动方法
      // 清空状态，避免重复触发
      // 延迟清空状态，确保滚动执行完成
      setTimeout(() => {
        wordsStore.setLastAddedWordText('')
      }, 100)
    })
  }
}, { immediate: true })


/**
 * 清空单词库
 * @since 2025/11/5
 */
const clearWord = () => {
  wordsStore.removeWords()
  ElMessage.success('清除成功');
}
/**
 * 初始化单词库
 * @since 2025/11/5
 */
const initWord = () => {
  clearWord()
  wordsStore.addAndUpdateWords(testData)
  ElMessage.success('初始化成功');
}

/**
 * 删除单词
 */
const deleteWord = (index: number) => {
  wordsStore.deleteWord(index)
}

/**
 * 导出单词到json文件
 */
const exportWords = () => {
  if (wordsStore.count === 0) {
    ElMessage.warning('没有单词可导出');
    return;
  }

  // 将单词列表转换为字符串
  /*  const content = words.value
        .map(word => `${word.text},${word.explains},${word.pronunciation}`) // 按需调整字段
        .join('\n'); // 每行一个单词

    // 创建Blob对象
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });*/

  // 过滤为指定属性

  const filteredWords = wordsStore.words.map(word => ({
    text: word.text,
    explains: word.explains,
    explainedHidden: word.explainedHidden,
    pronunciation: word.pronunciation,
    isReview: word.isReview,
    ctime: word.ctime,
    learnDate: word.learnDate,
    level: word.level
  }));

  // 将单词列表转换为JSON字符串
  const content = JSON.stringify(filteredWords, null, 2); // 格式化JSON

  // 创建Blob对象
  const blob = new Blob([content], {type: 'application/json;charset=utf-8'});


  // 创建下载链接
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  // link.download = 'words_export.txt'; // 文件名
  link.download = 'words_export.json'; // 文件名
  link.style.display = 'none';

  // 触发下载
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  ElMessage.success('导出成功');
}


/**
 * 批量导入单词（JSON格式，校验格式并补全属性）
 */
const importWords = () => {
  // 创建文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.json'; // 限制文件类型为JSON
  fileInput.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        try {
          // 解析JSON文件内容
          const importedWords: any[] = JSON.parse(content);

          // 校验数据格式并补全属性
          const validatedWords = importedWords
              .filter((word) => {
                // 校验必填字段
                return (
                    typeof word.text === 'string' &&
                    typeof word.explains === 'string'
                    // && typeof word.pronunciation === 'string'
                );
              })
              .map((word) => ({
                ...word,
                _id: DB_KEY + uuidv4(), // 添加_id属性
                image: word.image || '', // 补全image属性
                phonetic: word.phonetic || '', // 补全phonetic属性
                explainedHidden: word.explainedHidden || false, // 补全explainedHidden属性
                isReview: word.isReview || true, // 补全isReview属性
                ctime: word.ctime || new Date(), // 补全ctime属性
                learnDate: word.learnDate || new Date(), // 补全learnDate属性
                level: word.level || 1, // 补全level属性
                remember: word.remember || false, // 补全remember属性
              }));

          // 去重：基于word.text属性
          const uniqueWords = validatedWords.filter((importedWord) => {
            return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
          });

          if (uniqueWords.length > 0) {
            // 将去重后的单词列表添加到存储
            wordsStore.addAndUpdateWords(uniqueWords).then(() => {
              scrollToBottom()
              ElMessage.success('导入成功');
            }, error => {
              ElMessage.success('导入失败');
            });

          } else {
            ElMessage.warning('没有新单词可导入或文件内容为空');
          }
        } catch (error) {
          ElMessage.error('文件解析失败，请检查文件格式');
        }
      };
      reader.readAsText(file); // 读取文件内容
    }
  };
  fileInput.click(); // 触发文件选择
};


/**
 * 通过txt批量导入单词
 */
const imporTextWords = () => {
// 创建文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.csv,.json'; // 限制文件类型
  fileInput.onchange = (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        const wordList = parseFileContent(content); // 解析文件内容
        if (wordList.length > 0) {
          wordsStore.addAndUpdateWords(wordList); // 添加到存储
          ElMessage.success('导入成功');
        } else {
          ElMessage.warning('文件内容为空或格式不正确');
        }
      };
      reader.readAsText(file); // 读取文件内容
    }
  };
  fileInput.click(); // 触发文件选择

}

/**
 * 解析文件内容为单词列表
 * @param content 文件内容
 * @returns 单词列表
 */
const parseFileContent = (content: string): Word[] => {
  const lines = content.split('\n'); // 按行分割
  return lines
      .map(line => line.trim()) // 去除空格
      .filter(line => line.length > 0) // 过滤空行
      .map(line => ({
        text: line,
        explains: '',
        explainedHidden: false,
        pronunciation: '',
        isReview: true,
        ctime: new Date(),
        learnDate: new Date(),
        level: 0,
        _id: `imported-${Date.now()}-${Math.random()}`, // 生成唯一ID
        _rev: undefined,
        image: '',
        phonetic: '',
        remember: false
      }));
};

/**
 * 显示全部解释
 */
const visibleExplained = () => {
  wordsStore.words.forEach(x => x.explainedHidden = false)
}
/**
 * 隐藏全部解释
 */
const invisibleExplained = () => {
  wordsStore.words.forEach(x => x.explainedHidden = true)
}
</script>

<style scoped lang="scss">


.input-above-button {
  position: absolute;
  top: 0; /* 调整输入框与按钮的垂直距离 */
  right: 84%; /* 将输入框放置在按钮的右侧 */
  width: 200px; /* 根据需要调整输入框的宽度 */
}


.home_footer {
  position: fixed;
  bottom: 0;
  width: 98%;
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

  max-height: calc(100vh - 100px); // 减去顶部和其他元素的高度
  overflow-y: auto; // 启用纵向滚动
}


</style>
