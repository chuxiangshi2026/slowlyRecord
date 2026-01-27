<!-- 创建新的OCR选择器组件文件 -->
<template>
  <div v-if="visible" class="ocr-panel-overlay">
    <div class="ocr-panel-content">
      <div class="ocr-panel-header">
        <h3>选择要保存的单词</h3>
        <button @click="closePanel" class="close-btn">×</button>
      </div>
      <div class="ocr-items-container">
        <div
          v-for="(region, index) in ocrResults"
          :key="index"
          class="ocr-item"
        >
          <div class="ocr-original">
            <strong>原文:</strong> {{ region.context }}
          </div>
          <div class="ocr-translation">
            <strong>翻译:</strong> {{ region.tranContent }}
          </div>
          <div class="ocr-coords" v-if="region.rect || region.coords">
            <small>位置: {{ formatCoords(region.rect || region.coords) }}</small>
          </div>
          <!-- 新增单词选择区域 -->
          <div class="word-selection-area">
            <div class="word-list">
              <span
                v-for="(word, wordIndex) in getWordsFromText(region.context)"
                :key="wordIndex"
                :class="['word-item', { selected: isSelected(region.id || index, word) }]"
                @click="toggleWordSelection(region, word, index)"
              >
                {{ word }}
              </span>
            </div>
          </div>
        </div>
      </div>
      <div class="ocr-panel-footer">
        <div class="selected-words-summary">
          已选择 {{ selectedWords.length }} 个单词:
          <span class="selected-words-display">
            <span
              v-for="(word, index) in selectedWords"
              :key="index"
              :class="['selected-word-item', { selected: true }]"
              @click="removeSelectedWord(word)"
            >
              {{ word }}
            </span>
          </span>
        </div>
        <div class="footer-buttons">
          <button @click="selectAllWords" class="select-btn">全选</button>
          <button @click="invertSelection" class="invert-btn">反选</button>
          <button @click="clearSelection" class="clear-btn">清空</button>
          <button @click="removeChineseWords" class="remove-chinese-btn">筛除中文</button>
          <button @click="addSelectedWords" class="add-btn" :disabled="selectedWords.length === 0">添加到单词列表</button>
          <button @click="closePanel" class="cancel-btn">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, computed } from 'vue';
import { ElMessage } from 'element-plus';

// 定义props和emits
interface Props {
  visible: boolean;
  ocrResults: any[];
}

interface Emits {
  (e: 'close'): void;
  (e: 'select', item: any): void;
  (e: 'select-all', items: any[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 存储选中的单词
const selectedWordsMap = ref<{[key: string]: string[]}>({});

// 获取文本中的单词列表（只保留英文）
const getWordsFromText = (text: string) => {
  // 使用正则表达式匹配单词，只保留英文单词，完全排除中文和其他非字母字符
  const words = text.match(/[a-zA-Z]+/g) || [];
  return words.filter(word => word.trim() !== '');
};

// 检查单词是否已被选中
const isSelected = (regionId: string | number, word: string) => {
  const key = regionId.toString();
  if (!selectedWordsMap.value[key]) {
    return false;
  }
  return selectedWordsMap.value[key].includes(word);
};

// 切换单词选中状态
const toggleWordSelection = (region: any, word: string, regionIndex: number) => {
  const regionId = region.id || regionIndex;
  const key = regionId.toString();

  if (!selectedWordsMap.value[key]) {
    selectedWordsMap.value[key] = [];
  }

  const index = selectedWordsMap.value[key].indexOf(word);
  if (index > -1) {
    // 取消选中
    selectedWordsMap.value[key].splice(index, 1);
    // 清理空数组
    if (selectedWordsMap.value[key].length === 0) {
      delete selectedWordsMap.value[key];
    }
  } else {
    // 选中
    selectedWordsMap.value[key].push(word);
  }
};

// 从已选择的单词中移除指定单词
const removeSelectedWord = (wordToRemove: string) => {
  // 遍历所有区域的选中单词，找到并移除指定单词
  for (const [regionKey, words] of Object.entries(selectedWordsMap.value)) {
    const index = words.indexOf(wordToRemove);
    if (index > -1) {
      words.splice(index, 1);
      // 如果该区域没有选中任何单词了，删除该区域的条目
      if (words.length === 0) {
        delete selectedWordsMap.value[regionKey];
      }
      break; // 找到并移除后就退出循环
    }
  }
};

// 计算所有选中的单词
const selectedWords = computed(() => {
  const allSelected: string[] = [];
  Object.values(selectedWordsMap.value).forEach(words => {
    words.forEach(word => {
      if (!allSelected.includes(word)) {
        allSelected.push(word);
      }
    });
  });
  return allSelected;
});

// 全选所有单词
const selectAllWords = () => {
  selectedWordsMap.value = {};
  props.ocrResults.forEach((region, index) => {
    const regionId = region.id || index;
    const key = regionId.toString();
    selectedWordsMap.value[key] = getWordsFromText(region.context);
  });
};

// 反选（选中变未选中，未选中变选中）
const invertSelection = () => {
  const newSelection: {[key: string]: string[]} = {};

  props.ocrResults.forEach((region, index) => {
    const regionId = region.id || index;
    const key = regionId.toString();
    const allWordsInRegion = getWordsFromText(region.context);
    const currentlySelected = selectedWordsMap.value[key] || [];

    // 对于每个单词，如果之前选中则取消选中，如果之前未选中则选中
    const invertedSelection = allWordsInRegion.filter(word =>
      !currentlySelected.includes(word)
    );

    if (invertedSelection.length > 0) {
      newSelection[key] = invertedSelection;
    }
  });

  selectedWordsMap.value = newSelection;
};

// 清空选择
const clearSelection = () => {
  selectedWordsMap.value = {};
};

// 去除全部中文词（取消选中所有中文词，但在这个实现中主要是过滤显示）
const removeChineseWords = () => {
  // 由于getWordsFromText已经过滤掉了中文词，这里只需确保只保留英文词的选中状态
  const newSelection: {[key: string]: string[]} = {};

  for (const [regionKey, words] of Object.entries(selectedWordsMap.value)) {
    // 过滤掉中文词，只保留英文词
    const englishOnlyWords = words.filter(word => {
      // 检查单词是否只包含英文字母
      return /^[a-zA-Z]+$/.test(word);
    });

    if (englishOnlyWords.length > 0) {
      newSelection[regionKey] = englishOnlyWords;
    }
  }

  selectedWordsMap.value = newSelection;
  ElMessage.info('中文词已去除');
};

// 添加选中的单词到单词列表
const addSelectedWords = () => {
  if (selectedWords.value.length === 0) {
    ElMessage.warning('请先选择要添加的单词');
    return;
  }

  // 为每个选中的单词创建一个项目并发出选择事件
  selectedWords.value.forEach(word => {
    // 查找对应的翻译内容
    let translation = '';
    for (const region of props.ocrResults) {
      if (region.context.includes(word)) {
        translation = region.tranContent || '';
        break;
      }
    }

    const wordItem = {
      context: word,
      tranContent: translation,
      originalText: word,
      translatedText: translation
    };

    emit('select', wordItem);
  });

  ElMessage.success(`新添加 ${selectedWords.value.length} 个单词到列表`);
  closePanel();
};

// 格式化坐标信息
const formatCoords = (coords: any) => {
  if (!coords) return '';
  if (Array.isArray(coords)) {
    const coordsString = coords.map((c: any) => `${c.x},${c.y}`).join('; ');
    return `(${coordsString})`;
  } else if (typeof coords === 'object') {
    return `(${coords.left || 0}, ${coords.top || 0}, ${coords.width || 0}, ${coords.height || 0})`;
  }
  return String(coords);
};

// 关闭面板
const closePanel = () => {
  // 重置选中状态
  selectedWordsMap.value = {};
  emit('close');
};
</script>

<style scoped>
.ocr-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.6);
  z-index: 9999;
  display: flex;
  justify-content: center;
  align-items: center;
}

.ocr-panel-content {
  background: white;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.ocr-panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ocr-panel-header h3 {
  margin: 0;
  font-size: 18px;
}

.close-btn {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ocr-items-container {
  padding: 16px;
  overflow-y: auto;
  max-height: 50vh;
  flex: 1;
}

.ocr-item {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  margin-bottom: 12px;
  background-color: #fafafa;
}

.ocr-original,
.ocr-translation {
  margin-bottom: 8px;
}

.ocr-coords {
  color: #666;
  font-size: 12px;
  margin-bottom: 8px;
}

.word-selection-area {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid #eee;
}

.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.word-item {
  padding: 4px 8px;
  background-color: #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  font-size: 14px;
}

.word-item:hover {
  background-color: #d0d0d0;
}

.word-item.selected {
  background-color: #409eff;
  color: white;
}

.selected-words-summary {
  margin-bottom: 10px;
  padding: 10px;
  background-color: #f5f5f5;
  border-radius: 4px;
  font-size: 14px;
}

.selected-words-display {
  font-weight: bold;
  color: #409eff;
}

.selected-word-item {
  padding: 2px 6px;
  background-color: #e0e0e0;
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  font-size: 14px;
  display: inline-block;
  margin: 0 2px;
}

.selected-word-item:hover {
  background-color: #d0d0d0;
  transform: scale(1.05);
}

.selected-word-item.selected {
  background-color: #409eff;
  color: white;
}

.footer-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  padding: 15px 20px 20px; /* 添加底部内边距，增加与下边框的距离 */
}

.select-btn, .invert-btn, .clear-btn, .remove-chinese-btn, .add-btn, .cancel-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.select-btn {
  background-color: #67c23a;
  color: white;
}

.invert-btn {
  background-color: #409eff;
  color: white;
}

.clear-btn {
  background-color: #e6a23c;
  color: white;
}

.remove-chinese-btn {
  background-color: #f56c6c;
  color: white;
}

.add-btn {
  background-color: #909399;
  color: white;
}

.add-btn:disabled {
  background-color: #c0c4cc;
  cursor: not-allowed;
}

.cancel-btn {
  background-color: #909399;
  color: white;
}
</style>
