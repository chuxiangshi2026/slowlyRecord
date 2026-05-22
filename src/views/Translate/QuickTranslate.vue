<template>
  <div class="quick-translate-container">
    <div class="translate-card">
      <h2 class="title">
        <el-icon><Document /></el-icon>
        快速翻译 /fy
      </h2>
      
      <!-- 输入区域 -->
      <div class="input-section">
        <!-- 语言选择器 -->
        <div class="language-selector">
          <el-select v-model="sourceLang" size="small" class="lang-select">
            <el-option
              v-for="item in languageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-button
            link
            size="small"
            @click="swapLanguages"
            class="swap-btn"
            title="交换语言"
          >
            <el-icon><Switch /></el-icon>
          </el-button>
          <el-select v-model="targetLang" size="small" class="lang-select">
            <el-option
              v-for="item in targetLanguageOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
        </div>

        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入要翻译的文本，按 Enter 快速翻译；支持粘贴图片进行 OCR 翻译"
          class="translate-input"
          @keyup.enter="handleTranslate"
          @paste="handlePaste"
        />
        <div class="input-actions">
          <el-select v-model="selectedPlatform" size="small" class="platform-select">
            <el-option
              v-for="item in platformOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
            />
          </el-select>
          <el-button
            type="primary"
            :loading="loading"
            @click="handleTranslate"
            class="translate-btn"
          >
            <el-icon><Promotion /></el-icon>
            翻译
          </el-button>
          <el-button
            @click="clearInput"
            class="clear-btn"
          >
            <el-icon><Delete /></el-icon>
            清空
          </el-button>
        </div>
      </div>

      <!-- 结果区域 -->
      <div v-if="result" class="result-section">
        <el-divider />
        <div class="result-content">
          <div class="result-header">
            <span class="result-label">翻译结果</span>
            <div class="result-actions">
              <el-button 
                v-if="result.pronunciation" 
                link 
                size="small"
                @click="playPronunciation"
                class="pronunciation-btn"
              >
                <el-icon><VideoPlay /></el-icon>
                发音
              </el-button>
              <el-button link size="small" @click="copyResult">
                <el-icon><CopyDocument /></el-icon>
                复制
              </el-button>
            </div>
          </div>
          
          <div v-if="result.phonetic" class="phonetic">
            音标: {{ result.phonetic }}
          </div>
          
          <div class="translation-text" :class="{ 'error': !result.success }">
            {{ result.explains || result.errorMsg }}
          </div>

          <!-- 记忆提示 -->
          <div v-if="result.memoryTip || result.memoryImage" class="detail-section memory-section">
            <div class="detail-label">
              <el-icon><InfoFilled /></el-icon>
              记忆提示
            </div>
            <div class="memory-content">
              <div v-if="result.memoryTip" class="memory-tip">
                <span class="memory-label">技巧:</span>
                <span>{{ result.memoryTip }}</span>
              </div>
              <!-- 联想图片 - 使用 Emoji 视觉化 -->
              <div v-if="result.memoryImage" class="memory-image-wrapper">
                <div class="memory-image-desc">
                  <span class="memory-label">联想:</span>
                  <span>{{ result.memoryImage }}</span>
                </div>
                <!-- Emoji 视觉展示 -->
                <div class="memory-emoji-container">
                  <div class="memory-emoji">{{ getMemoryEmoji(result.memoryImage) }}</div>
                  <div class="memory-emoji-hint">视觉联想</div>
                </div>
              </div>
            </div>
          </div>

          <!-- 近义词 -->
          <div v-if="result.synonyms && result.synonyms.length > 0" class="detail-section">
            <div class="detail-label">
              <el-icon><Connection /></el-icon>
              近义词
            </div>
            <div class="detail-tags">
              <el-tag 
                v-for="(syn, idx) in result.synonyms" 
                :key="idx"
                size="small"
                type="success"
                class="detail-tag"
              >
                {{ syn }}
              </el-tag>
            </div>
          </div>

          <!-- 反义词 -->
          <div v-if="result.antonyms && result.antonyms.length > 0" class="detail-section">
            <div class="detail-label">
              <el-icon><Switch /></el-icon>
              反义词
            </div>
            <div class="detail-tags">
              <el-tag 
                v-for="(ant, idx) in result.antonyms" 
                :key="idx"
                size="small"
                type="danger"
                class="detail-tag"
              >
                {{ ant }}
              </el-tag>
            </div>
          </div>

          <!-- 例句 -->
          <div v-if="result.examples && result.examples.length > 0" class="examples-section">
            <div class="detail-label">
              <el-icon><Reading /></el-icon>
              例句
            </div>
            <div class="examples-list">
              <div 
                v-for="(ex, idx) in result.examples" 
                :key="idx"
                class="example-item"
              >
                <div class="example-en">{{ ex.english }}</div>
                <div class="example-cn">{{ ex.chinese }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 历史记录 -->
      <div v-if="history.length > 0" class="history-section">
        <el-divider />
        <div class="history-header">
          <span class="history-title">历史记录</span>
          <el-button link size="small" @click="clearHistory">清空历史</el-button>
        </div>
        <div class="history-list">
          <div 
            v-for="(item, index) in history" 
            :key="index"
            class="history-item"
          >
            <div class="history-text" @click="loadFromHistory(item)">
              <span class="history-source">{{ truncateText(item.source, 20) }}</span>
              <el-icon><ArrowRight /></el-icon>
              <span class="history-target">{{ truncateText(item.target, 20) }}</span>
            </div>
            <el-button
              link
              size="small"
              class="history-add-btn"
              :title="isWordInList(item.source) ? '已在单词列表中' : '添加到单词列表'"
              @click.stop="addHistoryWord(item)"
            >
              <el-icon><Plus /></el-icon>
            </el-button>
            <el-button
              link
              size="small"
              class="history-delete-btn"
              title="删除此记录"
              @click.stop="deleteHistoryItem(index)"
            >
              <el-icon><Close /></el-icon>
            </el-button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { ElMessage } from 'element-plus';
import {
  Document,
  Promotion,
  Delete,
  VideoPlay,
  CopyDocument,
  ArrowRight,
  Connection,
  Switch,
  Reading,
  InfoFilled,
  View,
  Refresh,
  Picture,
  Plus,
  Close
} from '@element-plus/icons-vue';
import { translateWithPlatform } from '@/utils/translation-api';
import { addWord } from '@/utils/str-util';
import { useWordsStore } from '@/stores/words';
import type { TranslationPlatform, TranslationResult, ExampleSentence, LanguageOption } from '@/types/words';

const wordsStore = useWordsStore();
const route = useRoute();

// 输入和状态
const inputText = ref('');
const loading = ref(false);
const result = ref<TranslationResult | null>(null);
const selectedPlatform = ref<TranslationPlatform>('glm');
const history = ref<{source: string, target: string, platform: TranslationPlatform, from: string, to: string}[]>([]);
const imageLoading = ref(false);

// 语言选择
const sourceLang = ref('auto');
const targetLang = ref('zh');

// 语言选项
const languageOptions: LanguageOption[] = [
  { label: '自动检测', value: 'auto' },
  { label: '中文', value: 'zh' },
  { label: '英语', value: 'en' },
  { label: '日语', value: 'ja' },
  { label: '韩语', value: 'ko' },
  { label: '法语', value: 'fr' },
  { label: '德语', value: 'de' },
  { label: '西班牙语', value: 'es' },
  { label: '俄语', value: 'ru' },
];

// 目标语言选项（排除自动检测）
const targetLanguageOptions = computed(() =>
  languageOptions.filter(lang => lang.value !== 'auto')
);

// 翻译平台选项
const platformOptions = [
  { label: '智谱 GLM', value: 'glm' },
  { label: 'DeepSeek', value: 'deepseek' },
  { label: '通义千问', value: 'qwen' },
  { label: 'Kimi', value: 'kimi' },
  { label: '腾讯翻译', value: 'tencent' },
  { label: '有道翻译', value: 'youdao' },
  { label: '百度翻译', value: 'baidu' },
  { label: '阿里翻译', value: 'ali' },
  { label: 'uTools AI', value: 'utoolsai' },
  { label: 'Ollama', value: 'ollama' },
  { label: '本地词典', value: 'local' },
];

// 交换语言
function swapLanguages() {
  if (sourceLang.value === 'auto') {
    // 如果源语言是自动检测，默认设为英文
    sourceLang.value = 'en';
  }
  const temp = sourceLang.value;
  sourceLang.value = targetLang.value;
  targetLang.value = temp;
}

// 从 store 获取默认平台
onMounted(() => {
  selectedPlatform.value = wordsStore.currentTranslationPlatform;
  loadHistory();

  // 检查路由参数中是否有文本
  const queryText = route.query.text as string;
  if (queryText) {
    inputText.value = queryText;
    handleTranslate();
  }
});

// 执行翻译
async function handleTranslate() {
  const text = inputText.value.trim();
  if (!text) {
    ElMessage.warning('请输入要翻译的文本');
    return;
  }

  loading.value = true;
  result.value = null;

  try {
    // 检测输入语言，如果是中文则自动调整翻译方向
    const isChinese = /[\u4e00-\u9fa5]/.test(text);
    let from = sourceLang.value;
    let to = targetLang.value;

    // 如果源语言是自动检测，根据内容判断
    if (from === 'auto') {
      from = isChinese ? 'zh' : 'en';
      to = isChinese ? 'en' : 'zh';
    }

    const res = await translateWithPlatform(text, selectedPlatform.value, from, to);
    result.value = res;

    if (res.success) {
      // 添加到历史记录
      addToHistory(text, res.explains || '', selectedPlatform.value, from, to);
    }
  } catch (error) {
    ElMessage.error('翻译失败: ' + (error as Error).message);
  } finally {
    loading.value = false;
  }
}

// 清空输入
function clearInput() {
  inputText.value = '';
  result.value = null;
}

// 播放发音
function playPronunciation() {
  if (result.value?.pronunciation) {
    const audio = new Audio(result.value.pronunciation);
    audio.play().catch(err => {
      console.error('播放失败:', err);
      ElMessage.warning('发音播放失败');
    });
  }
}

// 复制结果
function copyResult() {
  if (result.value?.explains) {
    navigator.clipboard.writeText(result.value.explains).then(() => {
      ElMessage.success('已复制到剪贴板');
    }).catch(() => {
      ElMessage.error('复制失败');
    });
  }
}

// 截断文本
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}

// 处理粘贴事件（Web 端粘贴图片 OCR）
async function handlePaste(event: ClipboardEvent) {
  const items = event.clipboardData?.items
  if (!items) return

  for (const item of items) {
    if (item.type.startsWith('image/')) {
      event.preventDefault()
      const blob = item.getAsFile()
      if (!blob) continue

      try {
        const base64 = await blobToBase64(blob)
        // 使用 capture 适配器的 OCR 功能
        const { getCaptureAdapter } = await import('@/adapters/capture')
        const adapter = getCaptureAdapter()
        const ocrResults = await adapter.ocr(base64)
        if (ocrResults.length > 0) {
          inputText.value = ocrResults.map(r => r.text).join('\n')
          handleTranslate()
          ElMessage.success('图片识别成功')
        } else {
          ElMessage.warning('未识别到文字')
        }
      } catch (e: any) {
        ElMessage.error('图片识别失败: ' + e.message)
      }
      break
    }
  }
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.split(',')[1])
    }
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}

// 添加到历史记录
function addToHistory(source: string, target: string, platform: TranslationPlatform, from: string, to: string) {
  // 避免重复添加相同的源文本
  const existingIndex = history.value.findIndex(h => h.source === source);
  if (existingIndex !== -1) {
    history.value.splice(existingIndex, 1);
  }

  history.value.unshift({ source, target, platform, from, to });
  // 只保留最近10条
  if (history.value.length > 10) {
    history.value = history.value.slice(0, 10);
  }
  saveHistory();
}

// 从历史记录加载
function loadFromHistory(item: {source: string, target: string, platform: TranslationPlatform, from: string, to: string}) {
  inputText.value = item.source;
  selectedPlatform.value = item.platform;
  sourceLang.value = item.from;
  targetLang.value = item.to;
  result.value = {
    success: true,
    explains: item.target
  };
}

// 清空历史记录
function clearHistory() {
  history.value = [];
  localStorage.removeItem('quick_translate_history');
}

// 删除单条历史记录
function deleteHistoryItem(index: number) {
  history.value.splice(index, 1);
  saveHistory();
}

// 保存历史记录到本地存储
function saveHistory() {
  localStorage.setItem('quick_translate_history', JSON.stringify(history.value));
}

// 加载历史记录
function loadHistory() {
  const saved = localStorage.getItem('quick_translate_history');
  if (saved) {
    try {
      history.value = JSON.parse(saved);
    } catch (e) {
      console.error('加载历史记录失败:', e);
    }
  }
}

// 检查单词是否已在列表中
function isWordInList(text: string): boolean {
  const cleaned = text.replace(/\s+/g, '');
  return !!wordsStore.findWord(cleaned);
}

// 从历史记录添加到单词列表
async function addHistoryWord(item: {source: string, target: string, platform: TranslationPlatform, from: string, to: string}) {
  const wordText = item.source.replace(/\s+/g, '');
  if (!wordText) return;
  try {
    const res = await addWord(wordText);
    if (res.success) {
      ElMessage.success(res.message || '已添加到单词列表');
    } else {
      ElMessage.info(res.message || '该单词已在列表中');
    }
  } catch (e: any) {
    ElMessage.error('添加失败: ' + e.message);
  }
}

// 生成联想图片URL（使用多源策略）
function generateMemoryImageUrl(description: string): string {
  // 提取中文关键词
  const keywords = description
    .replace(/^(想象|画面|场景|描述|一个|一只|一张|一条|片|幅)/g, '')
    .replace(/[，。！？、；：""''（）【】]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length >= 2 && !['这个', '那个', '正在', '表示'].includes(word))
    .slice(0, 4)
    .join(' ');

  // 使用 Bing 图片搜索 API（通过 URL 参数）
  // 或者使用 Wikimedia Commons 搜索
  const timestamp = Date.now();
  return `https://commons.wikimedia.org/w/index.php?title=Special:Search&search=${encodeURIComponent(keywords)}&ns6=1&format=json`;
}

// 使用 Emoji 作为视觉记忆辅助
function getMemoryEmoji(description: string): string {
  // 常见物体与 Emoji 的映射
  const emojiMap: Record<string, string> = {
    '大象': '🐘', '老虎': '🐅', '狮子': '🦁', '熊': '🐻', '熊猫': '🐼',
    '狗': '🐕', '猫': '🐈', '兔子': '🐇', '老鼠': '🐀', '牛': '🐄',
    '马': '🐎', '羊': '🐑', '猪': '🐖', '鸡': '🐔', '鸟': '🐦',
    '鱼': '🐟', '鲨鱼': '🦈', '鲸鱼': '🐋', '海豚': '🐬', '乌龟': '🐢',
    '蛇': '🐍', '青蛙': '🐸', '蝴蝶': '🦋', '蜜蜂': '🐝', '蚂蚁': '🐜',
    '苹果': '🍎', '香蕉': '🍌', '橙子': '🍊', '葡萄': '🍇', '西瓜': '🍉',
    '草莓': '🍓', '樱桃': '🍒', '梨': '🍐', '桃子': '🍑', '菠萝': '🍍',
    '西红柿': '🍅', '胡萝卜': '🥕', '玉米': '🌽', '茄子': '🍆', '土豆': '🥔',
    '太阳': '☀️', '月亮': '🌙', '星星': '⭐', '云': '☁️', '雨': '🌧️',
    '雪': '❄️', '闪电': '⚡', '彩虹': '🌈', '山': '⛰️', '海': '🌊',
    '树': '🌳', '花': '🌸', '草': '🌿', '叶子': '🍃', '火': '🔥',
    '水': '💧', '房子': '🏠', '学校': '🏫', '医院': '🏥', '商店': '🏪',
    '汽车': '🚗', '公交车': '🚌', '火车': '🚂', '飞机': '✈️', '船': '🚢',
    '自行车': '🚲', '摩托车': '🏍️', '书': '📚', '笔': '✏️', '纸': '📄',
    '电脑': '💻', '手机': '📱', '电视': '📺', '相机': '📷', '音乐': '🎵',
    '足球': '⚽', '篮球': '🏀', '网球': '🎾', '游泳': '🏊', '跑步': '🏃',
    '吃饭': '🍽️', '睡觉': '😴', '读书': '📖', '写字': '✍️', '唱歌': '🎤',
    '跳舞': '💃', '笑': '😊', '哭': '😢', '生气': '😠', '惊讶': '😲',
    '爱': '❤️', '心': '💖', '礼物': '🎁', '生日': '🎂', '派对': '🎉',
    '钱': '💰', '时间': '⏰', '电话': '📞', '邮件': '✉️', '锁': '🔒',
    '钥匙': '🔑', '灯': '💡', '垃圾桶': '🗑️', '工具': '🔧', '药': '💊'
  };

  // 查找匹配的 Emoji
  for (const [key, emoji] of Object.entries(emojiMap)) {
    if (description.includes(key)) {
      return emoji;
    }
  }

  // 默认返回灯泡表示记忆提示
  return '💡';
}

// 生成联想图片
async function generateMemoryImage() {
  if (!result.value?.memoryImage) return;

  imageLoading.value = true;

  // 如果已经有图片URL，先清空重新生成
  if (result.value.memoryImageUrl) {
    result.value.memoryImageUrl = '';
  }

  const imageUrl = generateMemoryImageUrl(result.value.memoryImage);
  console.log('生成图片URL:', imageUrl);

  // 预加载图片检查是否可用
  const img = new Image();

  // 设置加载超时
  const timeoutId = setTimeout(() => {
    console.error('图片加载超时');
    imageLoading.value = false;
    ElMessage.warning('图片加载超时，请重试');
  }, 15000); // 15秒超时

  img.onload = () => {
    clearTimeout(timeoutId);
    console.log('图片预加载成功');
    imageLoading.value = false;
    if (result.value) {
      result.value.memoryImageUrl = imageUrl;
    }
  };

  img.onerror = () => {
    clearTimeout(timeoutId);
    console.error('图片预加载失败');
    imageLoading.value = false;
    ElMessage.error('图片加载失败，请重试');
  };

  img.src = imageUrl;
}

// 处理图片加载失败
function handleImageError() {
  imageLoading.value = false;
  ElMessage.warning('图片加载失败，请重试');
  if (result.value) {
    result.value.memoryImageUrl = '';
  }
}
</script>

<style scoped lang="scss">
.quick-translate-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: calc(100vh - 120px);
  padding: 20px;
  background-color: var(--utools-bg-secondary);
}

.translate-card {
  width: 100%;
  max-width: 600px;
  background: var(--utools-bg-card);
  border-radius: 12px;
  box-shadow: var(--utools-shadow-md);
  padding: 30px;
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 24px 0;
  font-size: 20px;
  color: var(--utools-text-primary);
  
  .el-icon {
    color: var(--utools-primary);
    font-size: 24px;
  }
}

.input-section {
  .language-selector {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
    padding: 8px 12px;
    background: var(--utools-bg-tertiary);
    border-radius: 8px;

    .lang-select {
      width: 120px;
    }

    .swap-btn {
      padding: 6px;
      color: var(--utools-primary);

      &:hover {
        color: var(--utools-primary);
        background: var(--utools-primary-light);
      }

      .el-icon {
        transition: transform 0.3s;
      }

      &:hover .el-icon {
        transform: rotate(180deg);
      }
    }
  }

  .translate-input {
    :deep(.el-textarea__inner) {
      border-radius: 8px;
      font-size: 16px;
      padding: 12px;
      resize: none;
      background-color: var(--utools-bg-input);
      color: var(--utools-text-primary);
      border-color: var(--utools-border-primary);

      &::placeholder {
        color: var(--utools-text-placeholder);
      }

      &:focus {
        border-color: var(--utools-primary);
      }
    }
  }

  .input-actions {
    display: flex;
    gap: 12px;
    margin-top: 16px;
    align-items: center;
    flex-wrap: wrap;

    .platform-select {
      width: 140px;
    }

    .translate-btn {
      flex: 1;
      min-width: 100px;
    }

    .clear-btn {
      width: 80px;
    }
  }
}

.result-section {
  margin-top: 20px;
  
  .result-content {
    background: var(--utools-bg-tertiary);
    border-radius: 8px;
    padding: 16px;
  }
  
  .result-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    .result-label {
      font-weight: 600;
      color: var(--utools-text-secondary);
      font-size: 14px;
    }
    
    .result-actions {
      display: flex;
      gap: 8px;
    }
  }
  
  .phonetic {
    color: var(--utools-text-tertiary);
    font-size: 13px;
    margin-bottom: 8px;
    font-style: italic;
  }
  
  .translation-text {
    font-size: 18px;
    color: var(--utools-text-primary);
    line-height: 1.6;
    word-break: break-all;
    margin-bottom: 16px;
    
    &.error {
      color: var(--utools-danger);
      font-size: 14px;
    }
  }
}

.detail-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--utools-border-divider);
  
  .detail-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--utools-text-secondary);
    margin-bottom: 8px;
    font-weight: 500;
    
    .el-icon {
      color: var(--utools-primary);
    }
  }
  
  .detail-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    
    .detail-tag {
      cursor: pointer;
      transition: all 0.2s;
      
      &:hover {
        transform: translateY(-1px);
      }
    }
  }
}

// 记忆提示特殊样式
.memory-section {
  background: linear-gradient(135deg, rgba(103, 194, 58, 0.1) 0%, var(--utools-bg-card) 100%);
  border-radius: 8px;
  padding: 12px;
  border: 1px solid rgba(103, 194, 58, 0.3);
  
  .detail-label {
    color: #67c23a;
    font-weight: 600;
    
    .el-icon {
      color: #67c23a;
    }
  }
  
  .memory-content {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .memory-tip {
    font-size: 14px;
    color: var(--utools-text-primary);
    line-height: 1.6;
    padding: 8px 12px;
    background: var(--utools-bg-card);
    border-radius: 6px;
    border-left: 3px solid #67c23a;
    display: flex;
    gap: 6px;
    align-items: flex-start;
    
    .memory-label {
      color: #67c23a;
      font-weight: 600;
      flex-shrink: 0;
    }
  }
  
  .memory-image-desc {
    display: flex;
    align-items: flex-start;
    gap: 6px;
    font-size: 13px;
    color: var(--utools-text-secondary);
    padding: 8px 12px;
    background: var(--utools-bg-tertiary);
    border-radius: 6px;
    line-height: 1.5;

    .memory-label {
      color: var(--utools-primary);
      font-weight: 600;
      flex-shrink: 0;
    }

    span {
      flex: 1;
    }
  }

  // 联想图片样式
  .memory-image-wrapper {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  // Emoji 视觉展示
  .memory-emoji-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 20px;
    background: linear-gradient(135deg, rgba(103, 194, 58, 0.1) 0%, rgba(103, 194, 58, 0.05) 100%);
    border-radius: 12px;
    border: 2px solid rgba(103, 194, 58, 0.3);

    .memory-emoji {
      font-size: 64px;
      line-height: 1;
      margin-bottom: 8px;
      filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1));
    }

    .memory-emoji-hint {
      font-size: 12px;
      color: var(--utools-text-secondary);
      font-weight: 500;
    }
  }
}

.examples-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed var(--utools-border-divider);
  
  .detail-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: var(--utools-text-secondary);
    margin-bottom: 10px;
    font-weight: 500;
    
    .el-icon {
      color: var(--utools-primary);
    }
  }
  
  .examples-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .example-item {
    background: var(--utools-bg-card);
    border-radius: 6px;
    padding: 10px 12px;
    border-left: 3px solid var(--utools-primary);
    
    .example-en {
      color: var(--utools-text-primary);
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 4px;
    }
    
    .example-cn {
      color: var(--utools-text-secondary);
      font-size: 13px;
      line-height: 1.5;
    }
  }
}

.history-section {
  margin-top: 20px;
  
  .history-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 12px;
    
    .history-title {
      font-weight: 600;
      color: var(--utools-text-secondary);
      font-size: 14px;
    }
  }
  
  .history-list {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  
  .history-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 10px 12px;
    background: var(--utools-bg-tertiary);
    border-radius: 6px;
    transition: all 0.2s;
    font-size: 14px;
    
    &:hover {
      background: var(--utools-primary-light);
    }

    .history-text {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
      min-width: 0;
      cursor: pointer;
    }
    
    .el-icon {
      color: var(--utools-text-tertiary);
      font-size: 12px;
    }
    
    .history-source {
      color: var(--utools-text-secondary);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .history-target {
      color: var(--utools-primary);
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .history-add-btn {
      flex-shrink: 0;
      color: var(--utools-text-tertiary);
      padding: 4px;

      &:hover {
        color: var(--utools-primary);
      }
    }

    .history-delete-btn {
      flex-shrink: 0;
      color: var(--utools-text-tertiary);
      padding: 4px;

      &:hover {
        color: var(--utools-danger);
      }
    }
  }
}

.pronunciation-btn {
  color: var(--utools-success);
  
  &:hover {
    color: var(--utools-success);
    opacity: 0.8;
  }
}
</style>
