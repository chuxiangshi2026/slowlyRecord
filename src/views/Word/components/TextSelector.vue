<template>
  <div v-if="visible" class="text-selector-overlay">
    <div class="text-selector-content">
      <div class="text-selector-header">
        <h3>选择要保存的单词</h3>
        <button @click="closePanel" class="close-btn">×</button>
      </div>
      <div class="text-content-area">
        <div class="text-original">
          <strong>原文:</strong>
        </div>
        <div class="text-content">{{ textContent }}</div>
      </div>
      <div class="word-selection-area">
        <div class="word-list">
          <span
            v-for="(word, wordIndex) in wordsList"
            :key="wordIndex"
            :class="['word-item', { selected: selectedWords.includes(word.toLowerCase()) }]"
            @click="toggleWordSelection(word)"
          >
            {{ word }}
          </span>
        </div>
      </div>
      <div class="text-selector-footer">
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
          <button @click="removeNonEnglishWords" class="remove-non-english-btn">筛选英文</button>
          <button @click="addSelectedWords" class="add-btn" :disabled="selectedWords.length === 0">添加到单词列表</button>
          <button @click="closePanel" class="cancel-btn">关闭</button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits, computed, watch } from 'vue';
import { ElMessage } from 'element-plus';

// 定义props和emits
interface Props {
  visible: boolean;
  textContent: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'select', items: string[]): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 存储提取出的单词列表
const wordsList = ref<string[]>([]);

// 存储选中的单词
const selectedWords = ref<string[]>([]);

// 从文本中提取单词（只保留英文单词）
const extractWords = (text: string) => {
  // 使用正则表达式匹配单词，只保留英文单词
  const matches = text.match(/[a-zA-Z]+/g) || [];
  // 转换为小写以避免重复，同时保持原形式
  const uniqueWords: string[] = [];
  const seen = new Set<string>();
  
  matches.forEach(word => {
    const lowerWord = word.toLowerCase();
    if (!seen.has(lowerWord)) {
      seen.add(lowerWord);
      uniqueWords.push(word); // 保存原始大小写的单词
    }
  });
  
  wordsList.value = uniqueWords;
  return uniqueWords;
};

// 监听文本内容变化，提取单词
watch(() => props.textContent, (newText) => {
  extractWords(newText);
  // 清空之前的选中状态
  selectedWords.value = [];
}, { immediate: true });

// 切换单词选中状态
const toggleWordSelection = (word: string) => {
  const lowerWord = word.toLowerCase();
  const index = selectedWords.value.findIndex(w => w.toLowerCase() === lowerWord);
  
  if (index > -1) {
    // 取消选中
    selectedWords.value.splice(index, 1);
  } else {
    // 选中
    selectedWords.value.push(word);
  }
};

// 移除选中的单词
const removeSelectedWord = (wordToRemove: string) => {
  const index = selectedWords.value.findIndex(w => w.toLowerCase() === wordToRemove.toLowerCase());
  if (index > -1) {
    selectedWords.value.splice(index, 1);
  }
};

// 全选所有单词
const selectAllWords = () => {
  selectedWords.value = [...wordsList.value];
};

// 反选（选中变未选中，未选中变选中）
const invertSelection = () => {
  const newSelection = wordsList.value.filter(word => 
    !selectedWords.value.some(selected => selected.toLowerCase() === word.toLowerCase())
  );
  selectedWords.value = newSelection;
};

// 清空选择
const clearSelection = () => {
  selectedWords.value = [];
};

// 移除非英文单词（保留选中的英文单词）
const removeNonEnglishWords = () => {
  selectedWords.value = selectedWords.value.filter(word => {
    // 检查单词是否只包含英文字母
    return /^[a-zA-Z]+$/.test(word);
  });
  ElMessage.info('已筛选出英文单词');
};

// 添加选中的单词到单词列表
const addSelectedWords = () => {
  if (selectedWords.value.length === 0) {
    ElMessage.warning('请先选择要添加的单词');
    return;
  }

  // 发出选择事件，传递选中的单词数组
  emit('select', selectedWords.value);

  ElMessage.success(`已添加 ${selectedWords.value.length} 个单词到列表`);
  closePanel();
};

// 关闭面板
const closePanel = () => {
  // 重置选中状态
  selectedWords.value = [];
  emit('close');
};
</script>

<style scoped>
.text-selector-overlay {
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

.text-selector-content {
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

.text-selector-header {
  padding: 16px 20px;
  border-bottom: 1px solid #eee;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-selector-header h3 {
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

.text-content-area {
  padding: 16px;
  border-bottom: 1px solid #eee;
}

.text-original {
  margin-bottom: 8px;
  font-weight: bold;
}

.text-content {
  padding: 10px;
  background-color: #fafafa;
  border-radius: 4px;
  min-height: 60px;
  max-height: 150px;
  overflow-y: auto;
  line-height: 1.5;
}

.word-selection-area {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
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

.select-btn, .invert-btn, .clear-btn, .remove-non-english-btn, .add-btn, .cancel-btn {
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

.remove-non-english-btn {
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