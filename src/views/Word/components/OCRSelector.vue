<!-- 创建新的OCR选择器组件文件 -->
<template>
  <Teleport to="body">
    <div v-if="visible" class="ocr-panel-overlay">
      <div class="ocr-panel-content">
        <div class="ocr-panel-header">
          <h3>选择要保存的单词/词组</h3>
          <div class="header-buttons">
            <button @click="copyAllOriginal" class="header-copy-btn" title="复制全部原文">复制全部原文</button>
            <button @click="copyAllTranslation" class="header-copy-btn" title="复制全部译文">复制全部译文</button>
            <button @click="closePanel" class="close-btn">×</button>
          </div>
        </div>
        <div class="ocr-items-container">
          <div v-if="!ocrResults || ocrResults.length === 0" class="ocr-empty">
            <p>未获取到识别结果</p>
          </div>
          <div
            v-for="(region, index) in ocrResults"
            :key="index"
            class="ocr-item"
          >
            <div class="ocr-original">
              <div class="text-row">
                <strong>原文:</strong>
                <span class="text-content">{{ region.context }}</span>
              </div>
              <button class="copy-btn" @click="copyText(region.context, '原文')">复制</button>
            </div>
            <div class="ocr-translation">
              <div class="text-row">
                <strong>翻译:</strong>
                <span class="text-content">{{ region.tranContent }}</span>
              </div>
              <button class="copy-btn" @click="copyText(region.tranContent, '译文')">复制</button>
            </div>
            <div class="ocr-coords" v-if="region.rect || region.coords">
              <small>位置: {{ formatCoords(region.rect || region.coords) }}</small>
            </div>
            <!-- 新增单词选择区域 -->
            <div class="word-selection-area">
              <div class="word-list">
                <span
                  v-for="(word, wordIndex) in getWordsForRegion(region, index)"
                  :key="wordIndex"
                  :class="['word-item', { selected: isSelected(getRegionKey(region, index), word) }]"
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
            已选择 {{ selectedWords.length }} 项:
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
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, Teleport } from 'vue';
import { ElMessage } from 'element-plus';
import { useWordsStore } from '@/stores/words.ts';
import { extractWordAndPhraseCandidates } from '@/utils/text-candidates';
import { loadLocalPhraseSources } from '@/utils/phrase-sources';

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

// 组件挂载时输出调试信息
onMounted(() => {
  console.log('[OCRSelector] 组件已挂载');
});

// 监听 visible 变化
watch(() => props.visible, async (newVal) => {
  console.log('[OCRSelector] visible 变化:', newVal);
  if (newVal) {
    await refreshWordsByRegion();
  }
});

// 监听 ocrResults 变化
watch(() => props.ocrResults, async (newVal) => {
  console.log('[OCRSelector] ocrResults 变化:', newVal?.length || 0, '个结果');
  if (props.visible) {
    await refreshWordsByRegion();
  }
}, { deep: true });

// 存储选中的单词
const selectedWordsMap = ref<{[key: string]: string[]}>({});
const wordsByRegion = ref<{[key: string]: string[]}>({});

const getRegionKey = (region: any, index: number): string => (region.id || index).toString();

const refreshWordsByRegion = async () => {
  const phraseSources = await loadLocalPhraseSources();
  const next: {[key: string]: string[]} = {};
  props.ocrResults.forEach((region, index) => {
    const key = getRegionKey(region, index);
    const candidates = extractWordAndPhraseCandidates(region.context || '', phraseSources);
    next[key] = candidates.map(item => item.text);
  });
  wordsByRegion.value = next;
};

const getWordsForRegion = (region: any, index: number) => {
  return wordsByRegion.value[getRegionKey(region, index)] || [];
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
  const key = getRegionKey(region, regionIndex);

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
    const key = getRegionKey(region, index);
    selectedWordsMap.value[key] = getWordsForRegion(region, index);
  });
};

// 反选（选中变未选中，未选中变选中）
const invertSelection = () => {
  const newSelection: {[key: string]: string[]} = {};

  props.ocrResults.forEach((region, index) => {
    const key = getRegionKey(region, index);
    const allWordsInRegion = getWordsForRegion(region, index);
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
      // 保留英文单词/词组（支持空格、连字符、撇号和数字），筛除中文
      return /^[a-zA-Z0-9]+(?:[-'\s][a-zA-Z0-9]+)*$/.test(word);
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

  // 获取当前选择的翻译平台
  const wordsStore = useWordsStore();
  const currentPlatform = wordsStore.currentTranslationPlatform;

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

  ElMessage.success(`新添加 ${selectedWords.value.length} 项到列表`);
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

// 复制文本到剪贴板
const copyText = async (text: string, type: string) => {
  if (!text) {
    ElMessage.warning(`${type}内容为空`);
    return;
  }

  try {
    if (navigator.clipboard && window.isSecureContext) {
      // 使用现代 Clipboard API
      await navigator.clipboard.writeText(text);
      ElMessage.success(`${type}已复制到剪贴板`);
    } else {
      // 降级方案：使用传统的复制方法
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();

      const successful = document.execCommand('copy');
      document.body.removeChild(textArea);

      if (successful) {
        ElMessage.success(`${type}已复制到剪贴板`);
      } else {
        ElMessage.error('复制失败，请手动复制');
      }
    }
  } catch (err) {
    console.error('复制失败:', err);
    ElMessage.error('复制失败，请手动复制');
  }
};

// 复制全部原文
const copyAllOriginal = async () => {
  if (!props.ocrResults || props.ocrResults.length === 0) {
    ElMessage.warning('没有原文可复制');
    return;
  }

  const allOriginalText = props.ocrResults
    .map(region => region.context)
    .filter(text => text && text.trim())
    .join('\n');

  if (!allOriginalText) {
    ElMessage.warning('原文内容为空');
    return;
  }

  await copyText(allOriginalText, '全部原文');
};

// 复制全部译文
const copyAllTranslation = async () => {
  if (!props.ocrResults || props.ocrResults.length === 0) {
    ElMessage.warning('没有译文可复制');
    return;
  }

  const allTranslationText = props.ocrResults
    .map(region => region.tranContent)
    .filter(text => text && text.trim())
    .join('\n');

  if (!allTranslationText) {
    ElMessage.warning('译文内容为空');
    return;
  }

  await copyText(allTranslationText, '全部译文');
};
</script>

<style scoped>
.ocr-panel-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100vw;
  height: 100vh;
  background-color: rgba(0, 0, 0, 0.6) !important;
  z-index: 99999 !important;
  display: flex;
  justify-content: center;
  align-items: center;
  backdrop-filter: blur(2px);
  -webkit-backdrop-filter: blur(2px);
}

.ocr-panel-content {
  background-color: var(--utools-bg-card) !important;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  position: relative;
  margin: auto;
  opacity: 1 !important;
  visibility: visible !important;
}

.ocr-panel-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--utools-border-divider);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.ocr-panel-header h3 {
  margin: 0;
  font-size: 18px;
  color: var(--utools-text-primary);
}

.header-buttons {
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-copy-btn {
  padding: 6px 12px;
  background-color: var(--utools-success);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  transition: background-color 0.2s ease;
}

.header-copy-btn:hover {
  background-color: var(--utools-success);
  opacity: 0.8;
}

.header-copy-btn:active {
  opacity: 0.6;
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
  color: var(--utools-text-secondary);
}

.close-btn:hover {
  color: var(--utools-text-primary);
}

.ocr-items-container {
  padding: 16px;
  overflow-y: auto;
  max-height: 50vh;
  flex: 1;
}

.ocr-item {
  padding: 12px;
  border: 1px solid var(--utools-border-primary);
  border-radius: 6px;
  margin-bottom: 12px;
  background-color: var(--utools-bg-tertiary);
}

.ocr-original,
.ocr-translation {
  margin-bottom: 8px;
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 8px;
}

.text-row {
  flex: 1;
  display: flex;
  gap: 4px;
  align-items: flex-start;
}

.text-content {
  flex: 1;
  word-break: break-all;
  color: var(--utools-text-primary);
}

.copy-btn {
  padding: 4px 10px;
  background-color: var(--utools-primary);
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 12px;
  white-space: nowrap;
  transition: background-color 0.2s ease;
}

.copy-btn:hover {
  background-color: var(--utools-primary);
  opacity: 0.8;
}

.copy-btn:active {
  opacity: 0.6;
}

.ocr-coords {
  color: var(--utools-text-tertiary);
  font-size: 12px;
  margin-bottom: 8px;
}

.word-selection-area {
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px solid var(--utools-border-divider);
}

.word-list {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

.word-item {
  padding: 4px 8px;
  background-color: var(--utools-bg-secondary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  font-size: 14px;
  color: var(--utools-text-primary);
}

.word-item:hover {
  background-color: var(--utools-bg-hover);
}

.word-item.selected {
  background-color: var(--utools-primary);
  color: white;
}

.selected-words-summary {
  margin-bottom: 10px;
  padding: 10px;
  background-color: var(--utools-bg-tertiary);
  border-radius: 4px;
  font-size: 14px;
  color: var(--utools-text-primary);
}

.selected-words-display {
  font-weight: bold;
  color: var(--utools-primary);
}

.selected-word-item {
  padding: 2px 6px;
  background-color: var(--utools-bg-secondary);
  border-radius: 4px;
  cursor: pointer;
  transition: all 0.2s ease;
  user-select: none;
  font-size: 14px;
  display: inline-block;
  margin: 0 2px;
  color: var(--utools-text-primary);
}

.selected-word-item:hover {
  background-color: var(--utools-bg-hover);
  transform: scale(1.05);
}

.selected-word-item.selected {
  background-color: var(--utools-primary);
  color: white;
}

.footer-buttons {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 12px;
  padding: 15px 20px 20px;
}

.select-btn, .invert-btn, .clear-btn, .remove-chinese-btn, .add-btn, .cancel-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.select-btn {
  background-color: var(--utools-success);
  color: white;
}

.invert-btn {
  background-color: var(--utools-primary);
  color: white;
}

.clear-btn {
  background-color: var(--utools-warning);
  color: white;
}

.remove-chinese-btn {
  background-color: var(--utools-danger);
  color: white;
}

.add-btn {
  background-color: var(--utools-info);
  color: white;
}

.add-btn:disabled {
  background-color: var(--utools-text-disabled);
  cursor: not-allowed;
}

.cancel-btn {
  background-color: var(--utools-text-tertiary);
  color: white;
}

.ocr-empty {
  padding: 40px;
  text-align: center;
  color: var(--utools-text-tertiary);
  font-size: 14px;
}
</style>
