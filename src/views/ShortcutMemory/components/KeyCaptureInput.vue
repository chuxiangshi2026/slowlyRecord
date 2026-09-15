<template>
  <div class="key-capture-input">
    <div
      class="capture-area"
      :class="{ capturing: isCapturing, filled: modelValue }"
      tabindex="0"
      @focus="startCapture"
      @blur="stopCapture"
      @keydown.prevent="onKeyDown"
      @keyup.prevent="onKeyUp"
    >
      <span v-if="displayValue" class="keys-text">{{ displayValue }}</span>
      <span v-else class="placeholder">点击此处，直接按键盘输入快捷键</span>
      <el-icon class="keyboard-icon" v-if="!isCapturing"><Key /></el-icon>
      <el-icon class="recording-icon" v-else><VideoPlay /></el-icon>
    </div>
    <div class="capture-actions">
      <el-button
        :type="isCapturing ? 'danger' : 'primary'"
        size="small"
        text
        @click="toggleCapture"
      >
        {{ isCapturing ? '停止捕获' : '捕获按键' }}
      </el-button>
      <el-button type="info" size="small" text @click="clearKeys" v-if="modelValue">
        清空
      </el-button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { Key, VideoPlay } from '@element-plus/icons-vue';

const props = defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  (e: 'update:modelValue', value: string): void;
}>();

const isCapturing = ref(false);
const pressedKeys = ref<Set<string>>(new Set());

const displayValue = computed(() => {
  if (props.modelValue) return props.modelValue;
  if (pressedKeys.value.size > 0) {
    return Array.from(pressedKeys.value).join(' + ');
  }
  return '';
});

function toggleCapture() {
  if (isCapturing.value) {
    stopCapture();
  } else {
    startCapture();
  }
}

function startCapture() {
  isCapturing.value = true;
  pressedKeys.value = new Set();
}

function stopCapture() {
  isCapturing.value = false;
  if (pressedKeys.value.size > 0) {
    const keysText = Array.from(pressedKeys.value).join(' + ');
    emit('update:modelValue', keysText);
  }
  pressedKeys.value = new Set();
}

function clearKeys() {
  emit('update:modelValue', '');
  pressedKeys.value = new Set();
}

const KEY_DISPLAY_MAP: Record<string, string> = {
  'control': 'Ctrl',
  'ctrl': 'Ctrl',
  'alt': 'Alt',
  'shift': 'Shift',
  'meta': 'Win',
  'win': 'Win',
  'command': 'Win',
  'cmd': 'Win',
  'escape': 'Esc',
  'esc': 'Esc',
  'delete': 'Delete',
  'del': 'Delete',
  'insert': 'Insert',
  'ins': 'Insert',
  'pageup': 'PageUp',
  'pagedown': 'PageDown',
  'home': 'Home',
  'end': 'End',
  'arrowup': 'Up',
  'arrowdown': 'Down',
  'arrowleft': 'Left',
  'arrowright': 'Right',
  'up': 'Up',
  'down': 'Down',
  'left': 'Left',
  'right': 'Right',
  'backspace': 'Backspace',
  'tab': 'Tab',
  'enter': 'Enter',
  'return': 'Enter',
  'space': 'Space',
  ' ': 'Space',
  'spacebar': 'Space',
  'capslock': 'CapsLock',
  'numlock': 'NumLock',
  'numpaddivide': 'Num /',
  'numpadmultiply': 'Num *',
  'numpadsubtract': 'Num -',
  'numpadadd': 'Num +',
  'numpadenter': 'Num Enter',
  'numpaddecimal': 'Num .',
  'numpad0': 'Num 0',
  'numpad1': 'Num 1',
  'numpad2': 'Num 2',
  'numpad3': 'Num 3',
  'numpad4': 'Num 4',
  'numpad5': 'Num 5',
  'numpad6': 'Num 6',
  'numpad7': 'Num 7',
  'numpad8': 'Num 8',
  'numpad9': 'Num 9',
};

function formatKey(key: string): string {
  const lower = key.toLowerCase();
  if (KEY_DISPLAY_MAP[lower]) return KEY_DISPLAY_MAP[lower];
  if (KEY_DISPLAY_MAP[key]) return KEY_DISPLAY_MAP[key];
  // 单字母大写显示
  if (key.length === 1) return key.toUpperCase();
  return key;
}

function onKeyDown(event: KeyboardEvent) {
  if (!isCapturing.value) return;

  const key = event.key;
  const code = event.code;

  // 忽略单独的功能键作为触发
  if (key === 'Tab') return;

  const keys: string[] = [];

  if (event.ctrlKey) keys.push('Ctrl');
  if (event.altKey) keys.push('Alt');
  if (event.shiftKey) keys.push('Shift');
  if (event.metaKey) keys.push('Win');

  // 处理主键
  let mainKey = key;
  if (code.startsWith('Numpad')) {
    const num = code.replace('Numpad', '');
    if (num === 'Divide') mainKey = 'Num /';
    else if (num === 'Multiply') mainKey = 'Num *';
    else if (num === 'Subtract') mainKey = 'Num -';
    else if (num === 'Add') mainKey = 'Num +';
    else if (num === 'Enter') mainKey = 'Num Enter';
    else if (num === 'Decimal') mainKey = 'Num .';
    else mainKey = `Num ${num}`;
  } else if (code.startsWith('Digit')) {
    mainKey = code.replace('Digit', '');
  } else if (code.startsWith('Key')) {
    mainKey = code.replace('Key', '');
  } else {
    mainKey = formatKey(key);
  }

  // 避免将修饰键本身重复添加
  const modifierNames = ['Ctrl', 'Alt', 'Shift', 'Win'];
  if (!modifierNames.includes(mainKey)) {
    keys.push(mainKey);
  }

  if (keys.length > 0) {
    pressedKeys.value = new Set(keys);
  }
}

function onKeyUp(event: KeyboardEvent) {
  if (!isCapturing.value) return;

  // 当所有修饰键都释放时，确认输入
  const keys = Array.from(pressedKeys.value);
  if (keys.length > 0) {
    emit('update:modelValue', keys.join(' + '));
    isCapturing.value = false;
    pressedKeys.value = new Set();
  }
}
</script>

<style scoped lang="scss">
.key-capture-input {
  width: 100%;

  .capture-area {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 8px 12px;
    border: 2px solid var(--utools-border-primary);
    border-radius: 8px;
    background: var(--utools-bg-card);
    cursor: pointer;
    transition: all 0.2s;
    min-height: 40px;
    outline: none;

    &:hover {
      border-color: var(--utools-primary);
    }

    &:focus,
    &.capturing {
      border-color: var(--utools-primary);
      box-shadow: 0 0 0 2px color-mix(in srgb, var(--utools-primary) 20%, transparent);
      background: color-mix(in srgb, var(--utools-primary) 5%, transparent);
    }

    .keys-text {
      font-family: monospace;
      font-size: 14px;
      font-weight: bold;
      color: var(--utools-text-primary);
    }

    .placeholder {
      font-size: 13px;
      color: var(--utools-text-tertiary);
    }

    .keyboard-icon,
    .recording-icon {
      font-size: 16px;
      color: var(--utools-text-tertiary);
    }

    .recording-icon {
      color: var(--utools-danger);
      animation: pulse 1s infinite;
    }
  }

  .capture-actions {
    display: flex;
    gap: 8px;
    margin-top: 6px;
  }
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.5;
  }
}
</style>
