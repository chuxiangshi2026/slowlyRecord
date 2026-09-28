<template>
  <div>
    <div class="focus-setting-section">
      <div class="setting-item" style="flex-direction: column; align-items: flex-start;">
        <div class="content" style="margin-bottom: 8px;">
          显示样式
        </div>
        <div class="focus-style-grid">
          <div class="focus-style-row">
            <span class="focus-style-label">字体颜色</span>
            <div class="focus-style-control">
              <el-color-picker
                  :model-value="wordsStore.focusMode.fontColor || ''"
                  show-alpha
                  @change="onFocusFontColorChange"
              />
              <el-button size="small" link @click="resetFocusFontColor">跟随主题</el-button>
            </div>
          </div>
          <div class="focus-style-row">
            <span class="focus-style-label">单词字号</span>
            <div class="focus-style-control">
              <el-slider
                  v-model="focusFontSize"
                  :min="14"
                  :max="40"
                  :step="1"
                  :show-tooltip="false"
                  style="flex: 1;"
                  @change="onFocusFontSizeChange"
              />
              <span class="focus-style-value">{{ focusFontSize }}px</span>
            </div>
          </div>
          <div class="focus-style-row">
            <span class="focus-style-label">释义字号</span>
            <div class="focus-style-control">
              <el-slider
                  v-model="focusExplainFontSize"
                  :min="9"
                  :max="24"
                  :step="1"
                  :show-tooltip="false"
                  style="flex: 1;"
                  @change="onFocusExplainFontSizeChange"
              />
              <span class="focus-style-value">{{ focusExplainFontSize }}px</span>
            </div>
          </div>
          <div class="focus-style-row">
            <span class="focus-style-label">背景图片</span>
            <div class="focus-style-control">
              <el-button size="small" @click="triggerFocusBackgroundImport">选择图片</el-button>
              <el-button size="small" link :disabled="!wordsStore.focusMode.backgroundImage" @click="clearFocusBackground">清除</el-button>
              <input
                  type="file"
                  ref="focusBgInput"
                  style="display: none"
                  accept="image/*"
                  @change="handleFocusBackgroundImport"
              />
            </div>
          </div>
          <div class="focus-style-row">
            <span class="focus-style-label">背景透明</span>
            <div class="focus-style-control">
              <el-slider
                  v-model="focusBackgroundOpacityPercent"
                  :min="0"
                  :max="100"
                  :step="5"
                  :show-tooltip="false"
                  style="flex: 1;"
                  @change="onFocusBackgroundOpacityChange"
              />
              <span class="focus-style-value">{{ focusBackgroundOpacityPercent }}%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, ref} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import {ElMessage} from 'element-plus'

const FOCUS_BACKGROUND_MAX_SIZE = 2 * 1024 * 1024

const clampNumber = (value: number, min: number, max: number, fallback: number) => {
  const num = Number(value)
  if (!Number.isFinite(num)) return fallback
  return Math.max(min, Math.min(max, num))
}

const wordsStore = useWordsStore();

const focusBgInput = ref<HTMLInputElement | null>(null)

const focusFontSize = computed({
  get: () => clampNumber(wordsStore.focusMode.fontSize, 14, 40, 20),
  set: (val: number) => {
    wordsStore.setFocusMode({ fontSize: clampNumber(val, 14, 40, 20) })
  }
})

const focusExplainFontSize = computed({
  get: () => clampNumber(wordsStore.focusMode.explainFontSize, 9, 24, 11),
  set: (val: number) => {
    wordsStore.setFocusMode({ explainFontSize: clampNumber(val, 9, 24, 11) })
  }
})

const focusBackgroundOpacityPercent = computed({
  get: () => Math.round(clampNumber(wordsStore.focusMode.backgroundImageOpacity, 0, 1, 0.35) * 100),
  set: (val: number) => {
    wordsStore.setFocusMode({ backgroundImageOpacity: clampNumber(val / 100, 0, 1, 0.35) })
  }
})

const onFocusFontColorChange = (color: string | null) => {
  wordsStore.setFocusMode({ fontColor: color || '' })
}

const resetFocusFontColor = () => {
  wordsStore.setFocusMode({ fontColor: '' })
}

const onFocusFontSizeChange = (val: number) => {
  wordsStore.setFocusMode({ fontSize: clampNumber(val, 14, 40, 20) })
}

const onFocusExplainFontSizeChange = (val: number) => {
  wordsStore.setFocusMode({ explainFontSize: clampNumber(val, 9, 24, 11) })
}

const onFocusBackgroundOpacityChange = (val: number) => {
  wordsStore.setFocusMode({ backgroundImageOpacity: clampNumber(val / 100, 0, 1, 0.35) })
}

const triggerFocusBackgroundImport = () => {
  focusBgInput.value?.click()
}

const clearFocusBackground = () => {
  wordsStore.setFocusMode({ backgroundImage: '' })
}

const handleFocusBackgroundImport = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return

  if (file.size > FOCUS_BACKGROUND_MAX_SIZE) {
    ElMessage.warning('背景图片不能超过 2MB')
    target.value = ''
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    const dataUrl = e.target?.result as string
    if (dataUrl) {
      wordsStore.setFocusMode({ backgroundImage: dataUrl })
      ElMessage.success('专注模式背景已更新')
    }
    target.value = ''
  }
  reader.onerror = () => {
    ElMessage.error('读取背景图片失败')
    target.value = ''
  }
  reader.readAsDataURL(file)
}
</script>

<style scoped lang="scss">
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-sizing: border-box;
}

.content {
  color: var(--utools-text-secondary);
  font-size: 12px;
}

.shorcut-desc {
  margin-top: 10px;
  font-size: 12px;
  font-weight: 400;
  color: var(--utools-text-secondary);
}

.el-switch {
  --el-switch-on-color: var(--utools-primary);
  --el-switch-off-color: var(--utools-text-tertiary);
}

.focus-setting-section {
  margin-bottom: 8px;
}

.focus-style-grid {
  width: 100%;
  padding: 0;
  box-sizing: border-box;
}

.focus-style-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 10px;
}

.focus-style-label {
  width: 64px;
  flex-shrink: 0;
  color: var(--utools-text-secondary);
  font-size: 12px;
}

.focus-style-control {
  flex: 1;
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.focus-style-value {
  width: 44px;
  flex-shrink: 0;
  text-align: right;
  color: var(--utools-text-secondary);
  font-size: 12px;
}
</style>
