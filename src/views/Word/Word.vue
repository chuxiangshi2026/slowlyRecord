<template>

  <!--  <el-button type="primary" @click="clearWord">清空单词</el-button>-->
  <!--  <el-button type="primary" @click="initWord">初始化单词</el-button>-->

  <!--  <el-row>
      <el-col>
        <el-input :span="6" v-model="word" placeholder="请输入单词"></el-input>
                    <el-button :span="2" type="primary" @click="addWord(word)">添加单词</el-button>
        <el-button :span="2" type="primary" @click="scrollToWordByText(word)">滚动到单词</el-button>

      </el-col>
    </el-row>-->

  <div v-if="showWords">暂无数据,请在主界面输入框添加单词</div>
  <div v-else>
    <div class="words-cards-wrapper" ref="scrollContainer">
      <!--      虚拟滚动,只加载真实dom-->
      <RecycleScroller
          class="scroller"
          :items="showFilteredWords"
          :item-size="165"
          key-field="text"

          :min-item-size="165"
          :item-secondary-size="370"
          v-slot="{ item }"
          :dynamic-size="true"
          :max-item-size="175"
          :grid-items="2"
      >
        <!--      <div class="grid-item">-->
        <MyListItem
            :word="item"
            :disable-actions="listMode"
            v-model="wordsStore.words[getIndexInOriginalList(item)]"
            @delete="deleteWord(getIndexInOriginalList(item))"
            :showExplained="showExplained"
        >
          <!--            :hiddenExplain="hiddenExplain"-->
          <!--            ref="visibleExplained"-->
          <!--            ref="invisibleExplained"-->
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
    <DetailDrawer v-model="drawerVisible" :title="title" :detail-id="currentId"/>
  </div>

  <!-- 截图翻译结果预览对话框 -->
  <el-dialog
      v-model="ocrDialogVisible"
      title="截图识别结果"
      width="500px"
      :close-on-click-modal="false"
  >
    <div v-if="ocrLoading" class="ocr-loading">
      <el-icon class="is-loading"><Loading /></el-icon>
      <span>正在识别...</span>
    </div>
    <div v-else-if="ocrError" class="ocr-error">
      <el-icon><Warning /></el-icon>
      <span>{{ ocrError }}</span>
    </div>
    <div v-else class="ocr-content">
      <!-- 识别到的原文 -->
      <div class="ocr-section" v-if="ocrOriginalText">
        <div class="section-title">识别内容：</div>
        <div class="ocr-text">{{ ocrOriginalText }}</div>
      </div>

      <!-- 提取的单词列表 -->
      <div class="ocr-section" v-if="ocrWords.length > 0">
        <div class="section-title">
          提取的单词 ({{ ocrSelectedWords.length }}/{{ ocrWords.length }}):
          <el-checkbox v-model="selectAllWords" @change="handleSelectAll">全选</el-checkbox>
        </div>
        <div class="word-list">
          <el-checkbox-group v-model="ocrSelectedWords">
            <el-checkbox
                v-for="word in ocrWords"
                :key="word"
                :label="word"
                :value="word"
                border
                size="small"
            >
              {{ word }}
            </el-checkbox>
          </el-checkbox-group>
        </div>
      </div>

      <div v-else-if="!ocrError" class="ocr-empty">
        <el-icon><InfoFilled /></el-icon>
        <span>未识别到有效的英文单词</span>
      </div>
    </div>

    <template #footer>
      <div class="dialog-footer">
        <el-button @click="ocrDialogVisible = false">取消</el-button>
        <el-button
            type="primary"
            @click="confirmAddOcrWords"
            :disabled="ocrSelectedWords.length === 0 || ocrLoading"
        >
          添加选中单词 ({{ ocrSelectedWords.length }})
        </el-button>
      </div>
    </template>
  </el-dialog>
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
      <el-tooltip class="box-item" effect="dark" content="设置" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-setting" @click="drawerVisible = true"></i>
      </el-tooltip>
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
      <el-tooltip class="box-item" effect="dark" content="截图识别" placement="top" popper-class="small-tooltip">
        <i class="iconfont icon-translate" @click="startScreenCapture" style="font-weight: bold;"></i>
      </el-tooltip>
      <!--      <i class="iconfont icon-import" @click="importWords"></i>
            <i class="iconfont icon-export" @click="exportWords"></i-->

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
import {
  filterWordsForJsonExport,
  filterWordsForTextExport,
  parseFileContent,
  validateImportedWords
} from "@/utils/word-util.ts";

import {log} from "@/utils/logger.ts";
import {RecycleScroller} from 'vue-virtual-scroller'
import {addWord, batchAddWords, batchTranslateAndAddWords} from "@/utils/str-util.ts";
import {ocrTranslateMultiPlatform} from "@/utils/pic-translate.ts";
import {Loading, Warning, InfoFilled} from '@element-plus/icons-vue';

const word = ref('')

const wordsStore = useWordsStore();

const drawerVisible = ref(false)
const title = ref('设置')
const currentId = ref<string | number | undefined>(undefined)

// 截图翻译相关状态
const ocrDialogVisible = ref(false)
const ocrLoading = ref(false)
const ocrError = ref('')
const ocrOriginalText = ref('')
const ocrWords = ref<string[]>([])
const ocrSelectedWords = ref<string[]>([])
const selectAllWords = ref(false)
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
  // 检查索引是否有效，如果单词列表为空或索引无效，则不执行滚动
  if (index < 0 || !showFilteredWords.value || showFilteredWords.value.length === 0) {
    console.log("索引无效或单词列表为空，不执行滚动:", index);
    return;
  }

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
  // const index = wordsStore.words.findIndex(word => word.text === wordText)
  const index = showFilteredWords.value.findIndex(word => word.text === wordText)
  if (index !== -1) {
    scrollToWord(index)
  } else {
    setTimeout(() => {
      const index = showFilteredWords.value.findIndex(word => word.text === wordText)
      if (index !== -1) {
        scrollToWord(index)
      }
    }, 500)
    log.i('未找到此单词，无法定位')
  }
}


// 监听列表模式和单词数据变化，自动聚焦到第一个元素
watch([() => listMode.value, () => showFilteredWords.value], async () => {
  // 检查快捷键是否启用，只有启用时才聚焦到第一个元素
  if (!wordsStore.shortcutEnabled) {
    return
  }
  console.log('自动聚焦到元素');
  await nextTick(); // 等待DOM更新
  // 等待虚拟滚动器渲染完成
  setTimeout(() => {
    if (showFilteredWords.value.length > 0) {
      // 尝试聚焦到第一个元素
      // 聚焦到指定元素
      console.log('聚焦单词', wordsStore.lastFocusWordText)
      if (wordsStore.lastFocusWordText.length > 0) {
        focusElement('[data-word="' + wordsStore.lastFocusWordText + '"]')
      } else {
        focusElement('.list-item');
      }
    }
  }, 500);
}, {immediate: true});


// 监听抽屉可见性变化，当抽屉关闭且快捷键启用时聚焦到第一个卡片
watch(drawerVisible, (newValue, oldValue) => {
  // 只有当抽屉从开启变为关闭，且快捷键是启用的，才聚焦
  if (!newValue && oldValue && wordsStore.shortcutEnabled) {
    // 使用nextTick确保DOM更新完成
    focusElement('.list-item');
  }
});


// 聚焦到指定元素
// focusElement('.list-item') - 聚焦到第一个列表项（等同于原来的focusFirstItem）
// focusElement('.list-item:nth-child(5)') - 聚焦到第五个列表项
// focusElement('#specific-id') - 聚焦到具有特定ID的元素
// focusElement('[data-word="hello"]') - 聚焦到具有特定数据属性的元素
const focusElement = async (selector: string) => {
  // 检查快捷键是否启用，只有启用时才聚焦
  console.log('快捷键状态', wordsStore.shortcutEnabled)
  if (!wordsStore.shortcutEnabled) {
    return; // 如果快捷键被禁用，则不执行聚焦
  }
  await nextTick(); // 确保DOM已更新

  // 延迟一段时间以确保虚拟滚动器已渲染元素
  setTimeout(() => {
    const element = document.querySelector(selector);
    if (element) {
      console.log(`已聚焦到指定元素: ${selector}`);
      (element as HTMLElement).focus();
      wordsStore.lastFocusWordText = ''
    }
  }, 500);
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
    utools.showMainWindow();
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

              // 使用公共的批量翻译和添加方法
              const wordsToTranslate = wordsNeedingTranslation.map(word => word.text);
              batchTranslateAndAddWords(wordsToTranslate, (processedCount, totalCount) => {
                if (totalCount > 0) {
                  ElMessage.info(`正在翻译: ${processedCount}/${totalCount}`);
                }
              });
            } else {
              // 所有单词都有释义，直接导入
              wordsStore.addAndUpdateWords(uniqueWords).then(() => {
                scrollToBottom()
                ElMessage.success(`成功导入${uniqueWords.length}个单词`);
              });
            }
          } else {
            ElMessage.warning('没有新单词需要导入');
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
        utools.showMainWindow();
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
              ElMessage.warning('没有新单词需要导入');
              return;
            }

            // 检查是否有需要翻译的单词（没有释义或发音的）
            const wordsNeedingTranslation = uniqueWords.filter(word => !word.explains || !word.pronunciation);

            if (wordsNeedingTranslation.length > 0) {
              ElMessage.info(`检测到${wordsNeedingTranslation.length}个单词需要翻译，正在翻译中...`);

              // 使用公共的批量翻译和添加方法
              const wordsToTranslate = wordsNeedingTranslation.map(word => word.text);
              batchTranslateAndAddWords(wordsToTranslate, (processedCount, totalCount) => {
                if (totalCount > 0) {
                  ElMessage.info(`正在翻译: ${processedCount}/${totalCount}`);
                }
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
// 单独控制当前的卡片释义
// const hiddenExplain = ref('')
/**
 * 显示全部解释
 */
const visibleExplained = () => {
  showExplained.value = showExplained.value != 1 ? 1 : -1
  // wordsStore.words.forEach(x => x.explainedHidden = false)
  // wordsStore.hiddenExplain=''
  // hiddenExplain.value=''
}
/**
 * 隐藏全部解释
 */
const invisibleExplained = () => {
  // wordsStore.hiddenExplain = ''
  showExplained.value = showExplained.value != 0 ? 0 : -1
  // wordsStore.hiddenExplain=''
  // hiddenExplain.value=''
  // wordsStore.words.forEach(x => x.explainedHidden = true)
}

/**
 * 截图翻译 - 快速识别图片中的文字并添加
 */
const startScreenCapture = async () => {
  console.log('[截图添加] 开始截图识别流程');
  try {
    // 重置状态
    ocrLoading.value = true
    ocrError.value = ''
    ocrOriginalText.value = ''
    ocrWords.value = []
    ocrSelectedWords.value = []
    selectAllWords.value = false
    ocrDialogVisible.value = true

    // 调用截图翻译
    const result = await ocrTranslateMultiPlatform();

    console.log('[截图添加] OCR识别结果:', result);

    ocrLoading.value = false

    if (result.errorCode !== '0') {
      ocrError.value = '识别失败，请检查OCR配置或重试'
      return;
    }

    if (!result.resRegions || result.resRegions.length === 0) {
      ocrError.value = '未能识别到文字，请重试'
      return;
    }

    // 提取所有识别到的文本
    const allTexts: string[] = [];
    const allWords: string[] = [];

    result.resRegions.forEach((region: any) => {
      const text = region.context || '';
      if (text.trim()) {
        allTexts.push(text.trim());
      }
      // 使用正则提取英文单词（支持带连字符的单词和数字）
      const words = text.match(/[a-zA-Z]+(?:[-'][a-zA-Z]+)*|[a-zA-Z0-9]+/g) || [];
      words.forEach((word: string) => {
        // 过滤合理长度的单词，且必须包含至少一个字母
        if (word.length >= 2 && word.length <= 25 && /[a-zA-Z]/.test(word)) {
          allWords.push(word.toLowerCase());
        }
      });
    });

    // 去重并保持顺序
    const uniqueWords = [...new Set(allWords)];

    ocrOriginalText.value = allTexts.join('\n');
    ocrWords.value = uniqueWords;

    // 默认全选
    if (uniqueWords.length > 0) {
      ocrSelectedWords.value = [...uniqueWords];
      selectAllWords.value = true;
    }

  } catch (error: any) {
    console.error('截图翻译失败:', error);
    ocrLoading.value = false;
    if (error.message && error.message.includes('每日免费')) {
      ocrError.value = error.message;
    } else {
      ocrError.value = '截图翻译失败: ' + (error.message || '未知错误');
    }
  }
}

/**
 * 处理全选/取消全选
 */
const handleSelectAll = (val: boolean) => {
  if (val) {
    ocrSelectedWords.value = [...ocrWords.value];
  } else {
    ocrSelectedWords.value = [];
  }
}

/**
 * 确认添加选中的单词
 */
const confirmAddOcrWords = async () => {
  if (ocrSelectedWords.value.length === 0) {
    ElMessage.warning('请至少选择一个单词');
    return;
  }

  ocrDialogVisible.value = false;

  // 批量添加单词
  let addedCount = 0;
  let existCount = 0;
  let failCount = 0;

  for (const word of ocrSelectedWords.value) {
    const result = await addWord(word);
    if (result.success) {
      addedCount++;
    } else if (result.message && result.message.includes('已存在')) {
      existCount++;
    } else {
      failCount++;
    }
  }

  // 显示添加结果
  if (addedCount > 0) {
    ElMessage.success(`成功添加 ${addedCount} 个单词`);
  }
  if (existCount > 0) {
    ElMessage.info(`${existCount} 个单词已存在`);
  }
  if (failCount > 0) {
    ElMessage.warning(`${failCount} 个单词添加失败`);
  }
}

// 当新数据更新时 自动滚动到单词处  放到最后
// 监听 Store 中的 lastAddedWordText 状态
watch(() => wordsStore.lastAddedWordText, (wordText) => {
  if (wordText) {
    log.i("数据更新，滚动到此单词处:", wordText);
    nextTick(() => {  // 等待 DOM 更新
      // 添加延时确保虚拟滚动器已渲染完成
      setTimeout(() => {
        scrollToWordByText(wordText)  // 调用组件内的滚动方法
        // 清空状态，避免重复触发
        // 延迟清空状态，确保滚动执行完成
        setTimeout(() => {
          wordsStore.setLastAddedWordText('')
        }, 100)
      }, 50) // 添加50ms延时，确保虚拟滚动器渲染完成
    })
  }
  log.i("清空滚动更新单词", wordText);
}, {immediate: true})
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

// 截图翻译对话框样式
.ocr-loading,
.ocr-error,
.ocr-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 40px 20px;
  color: #666;
  font-size: 14px;

  .el-icon {
    font-size: 20px;
  }
}

.ocr-error {
  color: #f56c6c;
}

.ocr-empty {
  color: #909399;
}

.ocr-content {
  max-height: 400px;
  overflow-y: auto;
}

.ocr-section {
  margin-bottom: 16px;

  .section-title {
    font-weight: bold;
    margin-bottom: 8px;
    color: #333;
    display: flex;
    align-items: center;
    justify-content: space-between;

    .el-checkbox {
      font-weight: normal;
    }
  }

  .ocr-text {
    background-color: #f5f7fa;
    padding: 12px;
    border-radius: 4px;
    font-size: 14px;
    line-height: 1.6;
    color: #606266;
    max-height: 120px;
    overflow-y: auto;
    white-space: pre-wrap;
    word-break: break-word;
  }

  .word-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;

    .el-checkbox-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }

    .el-checkbox {
      margin: 0;
    }
  }
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}

</style>
