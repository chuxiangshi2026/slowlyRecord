<template>
  <div class="quick-translate-container">
    <div class="translate-card">
      <h2 class="title">
        <el-icon><Document /></el-icon>
        快速翻译 /fy
      </h2>
      
      <!-- 输入区域 -->
      <div class="input-section">
        <el-input
          v-model="inputText"
          type="textarea"
          :rows="3"
          placeholder="输入要翻译的文本，按 Enter 快速翻译"
          class="translate-input"
          @keyup.enter="handleTranslate"
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
            @click="loadFromHistory(item)"
          >
            <span class="history-source">{{ truncateText(item.source, 20) }}</span>
            <el-icon><ArrowRight /></el-icon>
            <span class="history-target">{{ truncateText(item.target, 20) }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
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
  Reading
} from '@element-plus/icons-vue';
import { translateWithPlatform } from '@/utils/translation-api';
import { useWordsStore } from '@/stores/words';
import type { TranslationPlatform, TranslationResult, ExampleSentence } from '@/types/words';

const wordsStore = useWordsStore();
const route = useRoute();

// 输入和状态
const inputText = ref('');
const loading = ref(false);
const result = ref<TranslationResult | null>(null);
const selectedPlatform = ref<TranslationPlatform>('glm');
const history = ref<{source: string, target: string, platform: TranslationPlatform}[]>([]);

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
    const res = await translateWithPlatform(text, selectedPlatform.value);
    result.value = res;

    if (res.success) {
      // 添加到历史记录
      addToHistory(text, res.explains || '', selectedPlatform.value);
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

// 添加到历史记录
function addToHistory(source: string, target: string, platform: TranslationPlatform) {
  // 避免重复添加相同的源文本
  const existingIndex = history.value.findIndex(h => h.source === source);
  if (existingIndex !== -1) {
    history.value.splice(existingIndex, 1);
  }
  
  history.value.unshift({ source, target, platform });
  // 只保留最近10条
  if (history.value.length > 10) {
    history.value = history.value.slice(0, 10);
  }
  saveHistory();
}

// 从历史记录加载
function loadFromHistory(item: {source: string, target: string, platform: TranslationPlatform}) {
  inputText.value = item.source;
  selectedPlatform.value = item.platform;
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
</script>

<style scoped lang="scss">
.quick-translate-container {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  min-height: calc(100vh - 120px);
  padding: 20px;
  background-color: #f5f7fa;
}

.translate-card {
  width: 100%;
  max-width: 600px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.08);
  padding: 30px;
}

.title {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 0 24px 0;
  font-size: 20px;
  color: #303133;
  
  .el-icon {
    color: #409eff;
    font-size: 24px;
  }
}

.input-section {
  .translate-input {
    :deep(.el-textarea__inner) {
      border-radius: 8px;
      font-size: 16px;
      padding: 12px;
      resize: none;
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
    background: #f8f9fa;
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
      color: #606266;
      font-size: 14px;
    }
    
    .result-actions {
      display: flex;
      gap: 8px;
    }
  }
  
  .phonetic {
    color: #909399;
    font-size: 13px;
    margin-bottom: 8px;
    font-style: italic;
  }
  
  .translation-text {
    font-size: 18px;
    color: #303133;
    line-height: 1.6;
    word-break: break-all;
    margin-bottom: 16px;
    
    &.error {
      color: #f56c6c;
      font-size: 14px;
    }
  }
}

.detail-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e4e7ed;
  
  .detail-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #606266;
    margin-bottom: 8px;
    font-weight: 500;
    
    .el-icon {
      color: #409eff;
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

.examples-section {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px dashed #e4e7ed;
  
  .detail-label {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 13px;
    color: #606266;
    margin-bottom: 10px;
    font-weight: 500;
    
    .el-icon {
      color: #409eff;
    }
  }
  
  .examples-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  
  .example-item {
    background: #fff;
    border-radius: 6px;
    padding: 10px 12px;
    border-left: 3px solid #409eff;
    
    .example-en {
      color: #303133;
      font-size: 14px;
      line-height: 1.5;
      margin-bottom: 4px;
    }
    
    .example-cn {
      color: #606266;
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
      color: #606266;
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
    background: #f8f9fa;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.2s;
    font-size: 14px;
    
    &:hover {
      background: #e6f7ff;
    }
    
    .el-icon {
      color: #909399;
      font-size: 12px;
    }
    
    .history-source {
      color: #606266;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    
    .history-target {
      color: #409eff;
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
  }
}

.pronunciation-btn {
  color: #67c23a;
  
  &:hover {
    color: #85ce61;
  }
}
</style>
