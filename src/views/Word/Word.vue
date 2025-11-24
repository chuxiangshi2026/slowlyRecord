<template>

  <!--  <el-button type="primary" @click="clearWord">清空单词</el-button>-->
  <!--  <el-button type="primary" @click="initWord">初始化单词</el-button>-->

  <!--    <el-row>
        <el-col>
          <el-input :span="6" v-model="word" placeholder="请输入单词"></el-input>
          <el-button :span="2" type="primary" @click="addWord(word)">添加单词</el-button>
        </el-col>
      </el-row>-->


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
      <el-dropdown @command="handleImportCommand">
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
import MyListItem from "@/views/Word/components/MyListItem.vue";
import {v4 as uuidv4} from "uuid";
import {DB_KEY} from "@/constants";
import {nextTick, ref, watch} from "vue";
import {addWord, getParam} from "@/utils/str-util.ts";


const word = ref('')

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
}, {immediate: true})


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
                    typeof word.text === 'string'
                    // && typeof word.explains === 'string'
                    // && typeof word.pronunciation === 'string'
                );
              })
              .map((word) => ({
                ...word,
                _id: word._id || DB_KEY + uuidv4(), // 添加_id属性
                image: word.image || '', // 补全image属性
                phonetic: word.phonetic || '', // 补全phonetic属性
                explainedHidden: word.explainedHidden || false, // 补全explainedHidden属性
                isReview: word.isReview || true, // 补全isReview属性
                ctime: word.ctime || new Date(), // 补全ctime属性
                learnDate: word.learnDate || new Date(), // 补全learnDate属性
                level: word.level || 1, // 补全level属性
                remember: word.remember || false, // 补全remember属性
                explains: word.explains || '', // 确保有explains属性
                pronunciation: word.pronunciation || '' // 确保有发音属性
              }));

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
      const params = getParam(word.text);
      const res = await wordsStore.translation(params);

      if (res.data.errorCode === '0' && res.data.translation) {
        translatedWords.push({
          text: word.text,
          explains: res.data.translation[0],
          pronunciation: res.data.speakUrl || '',
          phonetic: res.data.basic?.phonetic || ''
        });
      }

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
 * 解析文件内容为单词列表
 * @param content 文件内容
 * @returns 单词列表
 */
const parseFileContent = (content: string): Word[] => {
  const lines = content.split(/\r?\n/); // 按行分割，兼容Windows和Unix换行符
  return lines
      .map(line => line.trim()) // 去除空格
      .filter(line => line.length > 0) // 过滤空行
      .map(line => {
        // 处理CSV格式，如果包含逗号则分割
        const parts = line.includes(',') ? line.split(',') : [line];
        return {
          text: parts[0].trim(), // 第一列作为单词
          explains: parts[1] ? parts[1].trim() : '', // 第二列作为释义（如果有）
          explainedHidden: false,
          pronunciation: '', // 发音将在翻译时填充
          isReview: true,
          ctime: new Date(),
          learnDate: new Date(),
          level: 1,
          _id: DB_KEY + uuidv4(), // 生成唯一ID
          image: '',
          phonetic: '', // 音标将在翻译时填充
          remember: false
        };
      });
};

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

  const content = wordsStore.words.map(word =>
      `${word.text}, ${word.explains},${word.explainedHidden}, ${word.pronunciation},${word.isReview}, ${word.ctime},${word.learnDate}, ${word.level}`)// 使用逗号分隔单词和释义
      .join('\n');// 每行一个单词


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
