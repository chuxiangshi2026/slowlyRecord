<template>
  <Teleport to="body">
    <div v-if="visible" class="text-selector-overlay">
      <div class="text-selector-content">
        <div class="text-selector-header">
          <h3>选择要保存的单词/词组</h3>
          <div class="header-buttons">
            <button @click="copyOriginal" class="header-copy-btn" title="复制原文">复制原文</button>
            <button @click="copyTranslation" class="header-copy-btn" title="复制译文">复制译文</button>
            <button @click="closePanel" class="close-btn">×</button>
          </div>
        </div>
        <div class="text-items-container">
          <div class="text-item">
            <div class="text-original">
              <strong>原文:</strong> {{ textContent || '（未获取到文本）' }}
            </div>
            <div class="text-translation" v-if="translatedText">
              <strong>翻译:</strong> {{ translatedText }}
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
          </div>
        </div>
        <div class="text-selector-footer">
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
            <button @click="removeNonEnglishWords" class="remove-non-english-btn">筛选英文</button>
            <button @click="addSelectedWords" class="add-btn" :disabled="selectedWords.length === 0">添加到单词列表</button>
            <button @click="closePanel" class="cancel-btn">关闭</button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, computed, watch, Teleport } from 'vue';
import { ElMessage } from 'element-plus';
import { useWordsStore } from '@/stores/words.ts';
import { translateWithLocalDictionaryAsync } from '@/utils/local-dictionary';
import type { TranslationPlatform } from '@/types/words';
import { extractWordAndPhraseCandidates } from '@/utils/text-candidates';
import { loadLocalPhraseSources } from '@/utils/phrase-sources';

// 定义props和emits
interface Props {
  visible: boolean;
  textContent: string;
}

interface Emits {
  (e: 'close'): void;
  (e: 'select', items: string[]): void;
  (e: 'select', items: string[], platform: string): void;
}

const props = defineProps<Props>();
const emit = defineEmits<Emits>();

// 存储提取出的单词列表
const wordsList = ref<string[]>([]);

// 存储选中的单词
const selectedWords = ref<string[]>([]);

// 翻译后的文本
const translatedText = ref<string>('');

// 从文本中提取候选项：优先匹配词组/固定搭配，剩余内容按单词处理
const extractWords = async (text: string) => {
  const phraseSources = await loadLocalPhraseSources();
  const candidates = extractWordAndPhraseCandidates(text, phraseSources);
  const items = candidates.map(item => item.text);
  wordsList.value = items;
  return items;
};

// 处理文本内容的函数
const processTextContent = async (newText: string) => {
  console.log('[TextSelector] 处理文本:', newText);
  await extractWords(newText);
  // 清空之前的选中状态
  selectedWords.value = [];
  // 根据当前翻译平台选择翻译方式
  if (newText && newText.trim()) {
    translatedText.value = '翻译中...';
    try {
      const wordsStore = useWordsStore();
      const currentPlatform = wordsStore.currentTranslationPlatform || 'local';
      console.log('[TextSelector] 当前翻译平台:', currentPlatform);

      if (currentPlatform === 'local') {
        // 使用本地词典翻译
        const result = await translateWithLocalDictionaryAsync(newText.trim());
        console.log('[TextSelector] 本地翻译结果:', result);
        if (result.success && result.explains) {
          translatedText.value = result.explains;
        } else {
          translatedText.value = result.errorMsg || '翻译失败';
        }
      } else {
        // 使用指定的翻译平台进行翻译
        const { translateWithPlatform } = await import('@/utils/translation-api');
        const result = await translateWithPlatform(newText.trim(), currentPlatform as TranslationPlatform);
        console.log('[TextSelector] 平台翻译结果:', result);
        if (result.success && result.explains) {
          translatedText.value = result.explains;
        } else {
          translatedText.value = result.errorMsg || '翻译失败';
        }
      }
    } catch (error) {
      console.error('[TextSelector] 翻译失败:', error);
      translatedText.value = '翻译出错，请稍后重试';
    }
  } else {
    translatedText.value = '';
  }
};

// 监听文本内容变化
watch(() => props.textContent, async (newText) => {
  if (props.visible) {
    await processTextContent(newText);
  }
}, { immediate: true });

// 监听 visible 变化，当弹窗显示时处理文本
watch(() => props.visible, async (newVisible) => {
  if (newVisible) {
    console.log('[TextSelector] 弹窗显示，处理文本');
    await processTextContent(props.textContent);
  }
});

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
    // 保留英文单词/词组（支持空格、连字符、撇号和数字）
    return /^[a-zA-Z0-9]+(?:[-'\s][a-zA-Z0-9]+)*$/.test(word);
  });
  ElMessage.info('已筛选出英文单词');
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

  // 发出选择事件，传递选中的单词数组和当前平台
  emit('select', selectedWords.value, currentPlatform);

  ElMessage.success(`已添加 ${selectedWords.value.length} 项到列表`);
  closePanel();
};

// 关闭面板
const closePanel = () => {
  // 重置选中状态
  selectedWords.value = [];
  emit('close');
};

// 复制文本到剪贴板
const copyToClipboard = async (text: string, type: string) => {
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

// 复制原文
const copyOriginal = async () => {
  if (!props.textContent || !props.textContent.trim()) {
    ElMessage.warning('原文内容为空');
    return;
  }
  await copyToClipboard(props.textContent.trim(), '原文');
};

// 复制译文
const copyTranslation = async () => {
  if (!translatedText.value || translatedText.value === '翻译中...' || translatedText.value === '翻译失败' || translatedText.value === '翻译出错，请稍后重试') {
    ElMessage.warning('译文未准备好或翻译失败');
    return;
  }
  await copyToClipboard(translatedText.value, '译文');
};
</script>

<style scoped>
.text-selector-overlay {
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

.text-selector-content {
  background-color: var(--utools-bg-card) !important;
  border-radius: 8px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
  width: 90%;
  max-width: 800px;
  max-height: 80vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  opacity: 1 !important;
  visibility: visible !important;
}

.text-selector-header {
  padding: 16px 20px;
  border-bottom: 1px solid var(--utools-border-divider);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.text-selector-header h3 {
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

.text-items-container {
  padding: 16px;
  overflow-y: auto;
  max-height: 50vh;
  flex: 1;
}

.text-item {
  padding: 12px;
  border: 1px solid var(--utools-border-primary);
  border-radius: 6px;
  margin-bottom: 12px;
  background-color: var(--utools-bg-tertiary);
}

.text-original,
.text-translation {
  margin-bottom: 8px;
  color: var(--utools-text-primary);
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

.select-btn, .invert-btn, .clear-btn, .remove-non-english-btn, .add-btn, .cancel-btn {
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

.remove-non-english-btn {
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
</style>
