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
          <div class="ocr-actions">
            <button
              @click="selectItem(region)"
              class="save-btn"
            >
              保存此单词
            </button>
            <button
              @click="previewItem(region)"
              class="preview-btn"
            >
              预览
            </button>
          </div>
        </div>
      </div>
      <div class="ocr-panel-footer">
        <button @click="selectAll" class="select-all-btn">全部保存</button>
        <button @click="closePanel" class="cancel-btn">关闭</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, defineProps, defineEmits } from 'vue';
import { ElMessage } from 'element-plus';
// import { addWord } from '@/utils/str-util.ts';

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

// 格式化坐标信息
const formatCoords = (coords: any) => {
  if (!coords) return '';
  if (Array.isArray(coords)) {
    const coordsString = coords.map((c: any) => `${c.x},${c.y}`).join('; ');
    // return [(${coordsString})](file://D:\code\jscode\slowlyRecord\slowlyRecord\src\router\index.ts#L3-L3);
    return `(${coordsString})`;
  } else if (typeof coords === 'object') {
    return `(${coords.left || 0}, ${coords.top || 0}, ${coords.width || 0}, ${coords.height || 0})`;
  }
  return String(coords);
};

// 选择特定项目
const selectItem = (region: any) => {
  const word = region.context || '';
  const translation = region.tranContent || '';

  if (word && translation) {
    emit('select', region);
    ElMessage.success(`已选择: ${word} - ${translation}`);
  } else {
    ElMessage.warning('单词或翻译内容为空');
  }
};

// 预览项目（可选功能）
const previewItem = (region: any) => {
  const word = region.context || '';
  const translation = region.tranContent || '';
  if (word && translation) {
    ElMessage.info(`预览: ${word} - ${translation}`);
  }
};

// 选择所有项目
const selectAll = () => {
  if (props.ocrResults && props.ocrResults.length > 0) {
    emit('select-all', props.ocrResults);
    ElMessage.success(`已选择全部 ${props.ocrResults.length} 个单词`);
  }
};

// 关闭面板
const closePanel = () => {
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
  max-width: 600px;
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

.ocr-actions {
  display: flex;
  gap: 8px;
}

.save-btn, .preview-btn {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.save-btn {
  background-color: #409eff;
  color: white;
}

.preview-btn {
  background-color: #ecf5ff;
  color: #409eff;
}

.ocr-panel-footer {
  padding: 16px 20px;
  border-top: 1px solid #eee;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.select-all-btn, .cancel-btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.select-all-btn {
  background-color: #67c23a;
  color: white;
}

.cancel-btn {
  background-color: #909399;
  color: white;
}
</style>
