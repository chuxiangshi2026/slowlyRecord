<template>
  <div v-if="visible" class="debug-panel">
    <div class="debug-header" @click="toggleExpand">
      <span>调试日志 {{ logs.length }} 条</span>
      <div class="debug-actions">
        <button @click.stop="copyLogs" class="debug-btn">复制</button>
        <button @click.stop="clearLogs" class="debug-btn">清空</button>
        <button @click.stop="$emit('close')" class="debug-btn">关闭</button>
      </div>
    </div>
    <div v-if="expanded" class="debug-content">
      <div v-for="(log, index) in logs" :key="index" class="debug-line">
        <span class="debug-time">{{ log.time }}</span>
        <span class="debug-message">{{ log.message }}</span>
      </div>
    </div>
  </div>
  <button v-else class="debug-toggle" @click="$emit('open')">🐛</button>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

interface LogEntry {
  time: string;
  message: string;
}

const props = defineProps<{
  visible: boolean;
}>();

defineEmits<{
  open: [];
  close: [];
}>();

const expanded = ref(true);
const logs = ref<LogEntry[]>([]);

// 添加日志
function addLog(message: string) {
  const now = new Date();
  const time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}.${now.getMilliseconds().toString().padStart(3, '0')}`;
  logs.value.unshift({ time, message });
  // 限制日志数量
  if (logs.value.length > 100) {
    logs.value = logs.value.slice(0, 100);
  }
}

// 清空日志
function clearLogs() {
  logs.value = [];
}

// 复制日志
function copyLogs() {
  const text = logs.value.map(l => `[${l.time}] ${l.message}`).join('\n');
  navigator.clipboard.writeText(text).then(() => {
    alert('日志已复制到剪贴板');
  });
}

// 切换展开
function toggleExpand() {
  expanded.value = !expanded.value;
}

// 暴露方法给父组件
defineExpose({
  addLog,
  clearLogs
});

// 捕获控制台日志
if (typeof window !== 'undefined') {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;

  console.log = function(...args: any[]) {
    originalLog.apply(console, args);
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    if (message.includes('[本地OCR]')) {
      addLog(message);
    }
  };

  console.error = function(...args: any[]) {
    originalError.apply(console, args);
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    if (message.includes('[本地OCR]')) {
      addLog('[ERROR] ' + message);
    }
  };

  console.warn = function(...args: any[]) {
    originalWarn.apply(console, args);
    const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
    if (message.includes('[本地OCR]')) {
      addLog('[WARN] ' + message);
    }
  };
}
</script>

<style scoped>
.debug-panel {
  position: fixed;
  bottom: 10px;
  right: 10px;
  width: 500px;
  max-height: 400px;
  background: rgba(0, 0, 0, 0.9);
  color: #0f0;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  border-radius: 4px;
  z-index: 9999;
  display: flex;
  flex-direction: column;
}

.debug-header {
  padding: 8px 12px;
  background: rgba(0, 100, 0, 0.8);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  user-select: none;
}

.debug-actions {
  display: flex;
  gap: 8px;
}

.debug-btn {
  background: rgba(255, 255, 255, 0.2);
  border: none;
  color: #fff;
  padding: 2px 8px;
  border-radius: 2px;
  cursor: pointer;
  font-size: 11px;
}

.debug-btn:hover {
  background: rgba(255, 255, 255, 0.3);
}

.debug-content {
  overflow-y: auto;
  padding: 8px;
  max-height: 350px;
}

.debug-line {
  margin-bottom: 4px;
  word-break: break-all;
}

.debug-time {
  color: #888;
  margin-right: 8px;
}

.debug-message {
  color: #0f0;
}

.debug-toggle {
  position: fixed;
  bottom: 10px;
  right: 10px;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(0, 100, 0, 0.8);
  border: none;
  color: white;
  font-size: 20px;
  cursor: pointer;
  z-index: 9999;
}

.debug-toggle:hover {
  background: rgba(0, 150, 0, 0.9);
}
</style>
