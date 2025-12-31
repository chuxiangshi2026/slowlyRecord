<template>

  <!--  <el-button type="primary" @click="clearWord">清空单词</el-button>-->
  <!--  <el-button type="primary" @click="initWord">初始化单词</el-button>-->

      <el-row>
        <el-col>
          <el-input :span="6" v-model="word" placeholder="请输入单词"></el-input>
          <el-button :span="2" type="primary" @click="addWord(word)">添加单词</el-button>
        </el-col>
      </el-row>

  <div v-if="showWords">暂无数据,请在主界面输入框添加单词</div>
  <div v-else>
    <div class="words-cards-wrapper" ref="scrollContainer">
      <!--      虚拟滚动,只加载真实dom-->
      <RecycleScroller
          class="scroller"
          :items="showFilteredWords"
          :item-secondary-size="370"
          key-field="text"
          v-slot="{ item, index }"
          :dynamic-size="true"
          :min-item-size="165"
          :max-item-size="175"
          :grid-items="2"
          :item-size="165"
      >
        <!--      <div class="grid-item">-->
        <MyListItem
            :word="item"
            :disable-actions="listMode"
            :showExplained="showExplained"
            v-model="wordsStore.words[getIndexInOriginalList(item)]"
            @delete="deleteWord(getIndexInOriginalList(item))"
        >
        </MyListItem>
        <!--      </div>-->
      </RecycleScroller>

      <!--      <MyListItem v-for="(item,index) in wordsStore.words"
                        :key="index"
                        :word="item"
                        :style="(showOnlyRemembered ? item.remember : item.isReview) ? '': 'display:none' "
                        :disable-actions="showOnlyRemembered"
                        v-model="wordsStore.words[index]"
                        @delete="deleteWord(index)"
                        :ref="(el) => setItemRef(el, index)"
            >
            </MyListItem>-->
    </div>
  </div>

  <div>
    <!-- 抽屉组件化   -->
    <DetailDrawer  v-model="drawerVisible"  :title="title" :detail-id="currentId" />
  </div>
  <!--     旧版本的写法 @forget="(childValue)=>forget(item,childValue)"-->

  <div class="home_footer">
    <div>
      <span :class="{ 'remembered-highlight': listMode==0 }" @click="showOnlyForget"> 待复习: {{
          wordsStore.forgetCount
        }} </span>
      <span :class="{ 'remembered-highlight': listMode==1 }" @click="showOnlyReview"> 已复习: {{
          wordsStore.reviewCount
        }} </span>
      <span :class="{ 'remembered-highlight': listMode==2 }"
            @click="showOnlyRemembered"> 已记完: {{ wordsStore.rememberCount }} </span>
      <span :class="{ 'remembered-highlight': listMode==3 }" @click="showAll"> 单词总数: {{ wordsStore.count }} </span>
    </div>
    <div>
            <i class="iconfont icon-setting" @click="drawerVisible = true"></i>
<!--            <i class="iconfont icon-time" @click="scrollToWordByText('disk')"></i>-->
      <el-tooltip class="box-item" effect="dark" content="置顶" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-top" @click="scrollToTop"></i>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="置底" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-down" @click="scrollToBottom"></i>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="显示释义" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-visible" @click="visibleExplained"></i>
      </el-tooltip>
      <el-tooltip class="box-item" effect="dark" content="隐藏释义" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-invisible" @click="invisibleExplained"></i>
      </el-tooltip>
      <!--      <i class="iconfont icon-import" @click="importWords"></i>
            <i class="iconfont icon-export" @click="exportWords"></i>-->

      <!-- 导入下拉菜单 -->
      <el-dropdown @command="handleImportCommand" :disabled="listMode==1||listMode==2">
        <i class="iconfont icon-import"></i>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="importJson">JSON导入</el-dropdown-item>
            <el-dropdown-item command="importText">TXT/CSV导入</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>

      <!-- 导出下拉菜单 -->
      <el-dropdown @command="handleExportCommand">
        <i class="iconfont icon-export"></i>
        <template #dropdown>
          <el-dropdown-menu>
            <el-dropdown-item command="exportJson">导出JSON</el-dropdown-item>
            <el-dropdown-item command="exportText">导出TXT</el-dropdown-item>
          </el-dropdown-menu>
        </template>
      </el-dropdown>
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
import DetailDrawer from "@/views/Word/components/DetailDrawer.vue";
import MyListItem from "@/views/Word/components/MyListItem.vue";
import {computed, nextTick, ref, watch} from "vue";
// import {getParam} from "@/utils/str-util.ts";
import {
  filterWordsForJsonExport,
  filterWordsForTextExport,
  parseFileContent,
  validateImportedWords
} from "@/utils/word-util.ts";

import {RecycleScroller} from 'vue-virtual-scroller'
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css'
import {log} from "@/utils/logger.ts";
import {addWord} from "@/utils/str-util.ts";

const word = ref('')

const wordsStore = useWordsStore();

const drawerVisible = ref(false)
const title = ref('设置')
const currentId = ref(null)
/*const handleView = (id) => {
  currentId.value = id
  drawerVisible.value = true
}*/

/**
 * 显示添加单词
 */
const showWords = computed(() => {
  // 如果 待复习单词为0  且 状态为0 为true
  log.i('列表状态', listMode.value == 0);
  return wordsStore.forgetCount <= 0 && listMode.value == 0
})


// 控制是否只显示已记住的单词 0 待复习(正在显示)  1 已复习(暂时不需要复习的) 2 已记住
const listMode = ref(0);


const showOnlyForget = () => {
  listMode.value = 0;
}

const showOnlyReview = () => {
  listMode.value = listMode.value != 1 ? 1 : 0;
}

// 切换只显示已记住的单词
const showOnlyRemembered = () => {
  listMode.value = listMode.value != 2 ? 2 : 0;
}
const showAll = () => {
  listMode.value = listMode.value != 3 ? 3 : 0;
}


// 计算过滤后的单词列表
const showFilteredWords = computed(() => {
  // console.log('过滤后的词',wordsStore.words)
  if (listMode.value == 2) {
    return wordsStore.words.filter(item => item.remember)
  } else if (listMode.value == 1) {
    return wordsStore.words.filter(item => !item.isReview)
  } else if (listMode.value == 3) {
    return wordsStore.words
  } else {
    return wordsStore.words.filter(item => item.isReview)
  }
})

// 获取在原始列表中的索引
const getIndexInOriginalList = (item: Word) => {
  return wordsStore.words.findIndex(word => word.text === item.text)
}

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
    // 使用虚拟滚动时，直接计算滚动位置
    const scroller = document.querySelector('.scroller')
    if (scroller) {
      // 计算目标项的位置（考虑网格布局）
      const itemsPerRow = 2 // 从模板中的 :grid-items="2" 得知
      const rowIndex = Math.floor(index / itemsPerRow)
      const itemHeight = 165 // 从模板中的 :item-size="165" 得知

      // 滚动到目标行的位置，留出一些顶部空间便于查看
      scroller.scrollTop = Math.max(0, rowIndex * itemHeight - 50)

      // 延迟清空状态，确保滚动执行完成
      setTimeout(() => {
        wordsStore.setLastAddedWordText('')
      }, 100)
    } else if (itemRefs.value[index] && scrollContainer.value) {
      // 回退到原来的方法
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


/*    if (itemRefs.value[index] && scrollContainer.value) {
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
      */
  })
}


// 滚动到顶部
const scrollToTop = () => {
  const scroller = document.querySelector('.scroller');
  if (scroller) {
    scroller.scrollTop = 0;
  } else if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0;
  } else {
    window.scrollTo({top: 0, behavior: 'smooth'});
  }
/*  if (scrollContainer.value) {
    scrollContainer.value.scrollTop = 0
  } else {
    window.scrollTo({top: 0, behavior: 'smooth'})
  }*/
}

// 滚动到底部
const scrollToBottom = () => {
  const scroller = document.querySelector('.scroller');
  if (scroller) {
    scroller.scrollTop = scroller.scrollHeight;
  } else if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight;
  } else {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    });
  }

  /*if (scrollContainer.value) {
    scrollContainer.value.scrollTop = scrollContainer.value.scrollHeight
  } else {
    window.scrollTo({
      top: document.documentElement.scrollHeight,
      behavior: 'smooth'
    })
  }*/
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
}, {immediate: true})


// 监听列表模式和单词数据变化，自动聚焦到第一个元素
watch([() => listMode.value, () => showFilteredWords.value], async () => {
  await nextTick(); // 等待DOM更新
  // 等待虚拟滚动器渲染完成
  setTimeout(() => {
    if (showFilteredWords.value.length > 0) {
      // 尝试聚焦到第一个元素
      focusFirstItem();
    }
  }, 100);
}, {immediate: true});


// 聚焦到第一个元素
const focusFirstItem = async () => {
  await nextTick(); // 确保DOM已更新
  // 延迟一段时间以确保虚拟滚动器已渲染元素
  setTimeout(() => {
    const firstElement = document.querySelector('.list-item');
    if (firstElement) {
      (firstElement as HTMLElement).focus();
      console.log('已聚焦到第一个单词项');
    }
  }, 200);
};


/**
 * 处理导入命令
 */
const handleImportCommand = (command: string) => {
  switch (command) {
    case 'importJson':
      importWords();
      break;
    case 'importText':
      importTextWords();
      break;
  }
};

/**
 * 处理导出命令
 */
const handleExportCommand = (command: string) => {
  switch (command) {
    case 'exportJson':
      exportWords();
      break;
    case 'exportText':
      exportTextWords();
      break;
  }
};


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
  // wordsStore.words
  // 过滤为指定属性
  const filteredWords = filterWordsForJsonExport(showFilteredWords.value);


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
          const validatedWords = validateImportedWords(importedWords);


          // 去重：基于word.text属性
          const uniqueWords = validatedWords.filter((importedWord) => {
            return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
          });

          if (uniqueWords.length > 0) {
            // 检查是否有需要翻译的单词（没有释义的）
            const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains);

            if (wordsNeedingTranslation.length > 0) {
              ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);

              // 逐个翻译需要翻译的单词
              translateWordsSequentially(wordsNeedingTranslation).then(translatedWords => {
                // 合并翻译后的单词和已有释义的单词
                const wordsWithTranslations = uniqueWords.map(word => {
                  const translated = translatedWords.find(tw => tw.text === word.text);
                  return translated ? {...word, ...translated} : word;
                });

                // 将单词列表添加到存储
                wordsStore.addAndUpdateWords(wordsWithTranslations).then(() => {
                  scrollToBottom()
                  ElMessage.success(`成功导入${uniqueWords.length}个单词`);
                });
              });
            } else {
              // 所有单词都有释义，直接导入
              wordsStore.addAndUpdateWords(uniqueWords).then(() => {
                scrollToBottom()
                ElMessage.success(`成功导入${uniqueWords.length}个单词`);
              });
            }
          } else {
            ElMessage.warning('没有新单词可导入或文件内容为空');
          }
        } catch (error) {
          console.error(error);
          ElMessage.error('文件解析失败，请检查文件格式');
        }
      };
      reader.readAsText(file); // 读取文件内容
    }
  };
  fileInput.click(); // 触发文件选择
};

/**
 * 逐个翻译单词（避免API频率限制）
 */
const translateWordsSequentially = async (words: any[]): Promise<any[]> => {
  const translatedWords: any[] = [];

  for (const word of words) {
    try {

      wordsStore.translateWithPlatform(word.text).then(res=>{
        if (res.success) {
          translatedWords.push({
            text: word.text,
            explains: res.explains || word.text,
            pronunciation: res.pronunciation || '',
            phonetic: res.phonetic || ''
          });
        }
      })

      // 添加延迟避免API频率限制
      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      console.error(`翻译单词 "${word.text}" 失败:`, error);
      // 即使某个单词翻译失败，也继续翻译下一个
    }
  }

  return translatedWords;
};

/**
 * 通过txt批量导入单词
 */
const importTextWords = () => {
// 创建文件输入元素
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = '.txt,.csv'; // 限制文件类型
  fileInput.onchange = async (event) => {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          const wordList = parseFileContent(content); // 解析文件内容

          if (wordList.length > 0) {
            // 校验导入的单词数据
            const validatedWords = wordList.filter(word => {
              // 校验必填字段
              return typeof word.text === 'string' && word.text.trim() !== '';
            });

            if (validatedWords.length === 0) {
              ElMessage.warning('文件中没有有效的单词');
              return;
            }

            // 去重：基于word.text属性
            const uniqueWords = validatedWords.filter((importedWord) => {
              return !wordsStore.words.some((existingWord) => existingWord.text === importedWord.text);
            });

            if (uniqueWords.length === 0) {
              ElMessage.warning('没有新单词可导入（可能已存在）');
              return;
            }

            // 检查是否有需要翻译的单词（没有释义或发音的）
            const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains || !word.pronunciation);

            if (wordsNeedingTranslation.length > 0) {
              ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);

              // 逐个翻译需要翻译的单词
              const translatedWords = await translateWordsSequentially(wordsNeedingTranslation);

              // 合并翻译后的单词和已有释义的单词
              const wordsWithTranslations = uniqueWords.map(word => {
                const translated = translatedWords.find(tw => tw.text === word.text);
                return translated ? {...word, ...translated} : word;
              });

              // 将单词列表添加到存储
              wordsStore.addAndUpdateWords(wordsWithTranslations).then(() => {
                scrollToBottom();
                ElMessage.success(`成功导入${uniqueWords.length}个单词`);
              });
            } else {
              // 所有单词都有释义和发音，直接导入
              wordsStore.addAndUpdateWords(uniqueWords).then(() => {
                scrollToBottom();
                ElMessage.success(`成功导入${uniqueWords.length}个单词`);
              });
            }
          } else {
            ElMessage.warning('文件内容为空或格式不正确');
          }
        } catch (error) {
          console.error(error);
          ElMessage.error('导入失败，请检查文件格式');
        }
      };
      reader.readAsText(file); // 读取文件内容
    }
  };
  fileInput.click(); // 触发文件选择
}


/**
 * 导出单词到txt文件
 */
const exportTextWords = () => {
  if (wordsStore.count === 0) {
    ElMessage.warning('没有单词可导出');
    return;
  }


  // 过滤为指定属性
  // 将单词列表转换为字符串 (单词,释义 格式)
  // , ${word.pronunciation} 发音地址,先不对外导出了,key泄露了
  const content = filterWordsForTextExport(showFilteredWords.value);


  // 创建Blob对象
  const blob = new Blob([content], {type: 'text/plain;charset=utf-8'});

  // 创建下载链接
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'words_export.txt'; // 文件名
  link.style.display = 'none';

  // 触发下载
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  ElMessage.success('导出成功');
}



// 是否直接显示或隐藏全部释义（-1 原状态，1显示全部，0 隐藏全部）
const showExplained = ref(-1)
/**
 * 显示全部解释
 */
const visibleExplained = () => {
  showExplained.value = showExplained.value != 1 ? 1 : -1
  // wordsStore.words.forEach(x => x.explainedHidden = false)
}
/**
 * 隐藏全部解释
 */
const invisibleExplained = () => {
  showExplained.value = showExplained.value != 0 ? 0 : -1
  // wordsStore.words.forEach(x => x.explainedHidden = true)
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
  border-radius: 4px;
  height: 45px;
  border-top: 1px solid #eee;
  padding: 0 16px;
  box-sizing: border-box;


  .remembered-highlight {
    color: red;
    cursor: pointer;
  }

  .disabled {
    opacity: 0.5;
    pointer-events: none;

    i {
      color: gray;
    }
  }
}


/*.el-card {
  width: 100vw;
  height: 80vh;
}*/


.words-cards-wrapper {
  width: 96%; /* 父容器占满 */
  height: calc(100vh - 80px);
  //display: flex;
  //justify-content: space-around;
  //flex-wrap: wrap;

  //padding: 16px;
  padding: 16px;
  background-color: #f8f8f8;
  border-radius: 8px;
  //overflow-y: auto;
  overflow: hidden;

  .scroller {
    width: 100% !important;
    height: 100% !important;
    grid-template-columns: repeat(2, 1fr); /* 两列布局 */
    //gap: 16px; /* 卡片间距 */
    //align-content: start; /* 顶部对齐 */
    padding: 0;
    margin: 0;
  }

  //.grid-item {
  //  break-inside: avoid;
  //  padding: 0 8px 16px 8px;
  //}
  //max-height: calc(100vh - 100px); // 减去顶部和其他元素的高度
  //overflow-y: auto; // 启用纵向滚动
}

/*.card-wrapper {
  margin: 0 8px;
  //width: 100%;
  //height: 150px; !* 与 item-size 保持一致 *!
}*/


</style>
