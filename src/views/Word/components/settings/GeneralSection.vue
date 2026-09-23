<template>
  <div>
    <div class="titles">
      <div class="setting-item">
        <div class="content">加入单词后退出插件</div>
        <el-switch class="shorcut-desc"
                   v-model="wordsStore.pluginStatus"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @change="onCloseAfterAddSwitchChange"
        />
      </div>
      <div class="setting-item">
        <div class="content">界面字号</div>
        <el-radio-group :model-value="uiStore.uiZoom"
                        @update:model-value="(v: string | number | boolean | undefined) => uiStore.applyUiZoom(Number(v) || 1)">
          <el-radio-button :value="0.9">小</el-radio-button>
          <el-radio-button :value="1">标准</el-radio-button>
          <el-radio-button :value="1.15">大</el-radio-button>
        </el-radio-group>
      </div>
    </div>
    <div>
      <!-- 当前翻译引擎卡片：第一屏只呈现当前引擎与免配置状态，切换走右侧下拉 -->
      <div class="engine-card">
        <div class="engine-card-main">
          <span class="engine-card-name">{{ currentEngineLabel }}</span>
          <span class="engine-card-hint">{{ currentEngineHint }}</span>
        </div>
        <el-select class="shorcut-desc" :model-value="wordsStore.currentTranslationPlatform"
                   @update:model-value="(val: TranslationPlatform) => wordsStore.setTranslationPlatform(val)"
                   placeholder="切换引擎"
                   style="width:150px">
          <el-option
              v-for="item in options"
              :key="item.value"
              :label="translationOptionLabel(item.value, item.label)"
              :value="item.value"
          />
        </el-select>
      </div>
      <p v-if="wordsStore.currentTranslationPlatform === 'tencent'" class="deprecate-notice">
        提示：腾讯机器翻译业务即将下线，本软件预计9月底移除支持，请尽快切换其他翻译引擎。
      </p>
    </div>
    <div>
      <div class="setting-item">
        <div class="content">ocr图片识别引擎</div>
        <el-select class="shorcut-desc" :model-value="wordsStore.currentOcrPlatform"
                   @update:model-value="(val: OcrPlatform) => wordsStore.setOcrPlatform(val)"
                   placeholder="选择"
                   style="width:100px">
          <el-option
              v-for="item in ocrOptions"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          />
        </el-select>
      </div>
    </div>

    <div>
      <div class="setting-item">
        <div class="content">记忆牢固度</div>
        <el-select class="shorcut-desc" :model-value="wordsStore.memoryFirmness"
                   @update:model-value="wordsStore.setMemoryFirmness"
                   placeholder="选择"
                   style="width:100px">
          <el-option
              v-for="item in memoryFirmnessOptions"
              :key="item"
              :label="item"
              :value="item"
          />
        </el-select>
      </div>
    </div>

    <div>
      <div class="setting-item">
        <div class="content">选中单词自动发音</div>
        <el-switch class="shorcut-desc"
                   :model-value="wordsStore.autoSpeak"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @update:model-value="wordsStore.setAutoSpeak"
        />
      </div>
    </div>

    <div>
      <div class="setting-item">
        <div class="content">护眼模式（浅绿背景）</div>
        <el-switch class="shorcut-desc"
                   :model-value="wordsStore.eyeCare"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @update:model-value="wordsStore.setEyeCare"
        />
      </div>
    </div>

    <div v-if="!isUtools()">
      <div class="setting-item" style="flex-direction: column; align-items: flex-start;">
        <div class="content" style="margin-bottom: 8px;">
          主窗口透明度
        </div>
        <div style="display: flex; align-items: center; gap: 12px; width: 100%;">
          <el-slider
            v-model="opacityPercent"
            :min="30"
            :max="100"
            :step="5"
            :show-tooltip="false"
            style="flex: 1;"
            @change="onOpacityChange"
          />
          <span class="shorcut-desc" style="margin-top: 0; min-width: 40px; text-align: right;">{{ opacityPercent }}%</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import {useUiStore} from "@/stores/ui.ts";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {AppInfo} from "@/config.ts";
import {isUtools} from "@/adapters/platform";

const wordsStore = useWordsStore();
const uiStore = useUiStore();

const onCloseAfterAddSwitchChange = () => {
  wordsStore.setClosePlugin(wordsStore.pluginStatus)
}

// 主窗口透明度百分比（显示用）
const opacityPercent = computed({
  get: () => Math.round(wordsStore.mainWindowOpacity * 100),
  set: (val: number) => {
    wordsStore.setMainWindowOpacity(val / 100)
  }
})

const onOpacityChange = (val: number) => {
  wordsStore.setMainWindowOpacity(val / 100)
}

// 记忆牢固度选项
const memoryFirmnessOptions = ['正常' , '较强' , '极强'];

const ocrOptions = [
  {
    value: 'local',
    label: '本地词典(离线)',
  },
  {
    value: 'tencent',
    label: '腾讯(即将下线)',
  }, {
    value: 'baidu',
    label: '百度',
  },
  {
    value: 'youdao',
    label: '有道',
  }, {
    value: 'ali',
    label: '阿里',
  }, {
    value: 'deepseek',
    label: '深度求索(视觉)',
  }, {
    value: 'glm',
    label: '智谱GLM(视觉)',
  }]
const options = [
  {
    value: 'utoolsai',
    label: 'utoolsAI',
  },
  {
    value: 'local',
    label: '本地词典(离线)',
  },
  {
    value: 'tencent',
    label: '腾讯(即将下线)',
  }, {
    value: 'baidu',
    label: '百度',
  },
  {
    value: 'youdao',
    label: '有道',
  }, {
    value: 'ali',
    label: '阿里',
  }, {
    value: 'ollama',
    label: 'ollama',
  }, {
    value: 'deepseek',
    label: 'deepseek',
  }, {
    value: 'qwen',
    label: '千问',
  }, {
    value: 'kimi',
    label: 'kimi',
  }, {
    value: 'glm',
    label: '智谱GLM',
  }, {
    value: 'minimax',
    label: 'MiniMax',
  }, {
    value: 'deepl',
    label: 'DeepL',
  }, {
    value: 'azure',
    label: '微软翻译',
  }, {
    value: 'qiniu',
    label: '七牛AI',
  }, {
    value: 'google',
    label: 'Google',
  }, {
    value: 'spark',
    label: '讯飞星火',
  }, {
    value: 'xftrans',
    label: '讯飞机器翻译',
  }, {
    value: 'bing',
    label: '微软网页版',
  }
]

// 免配置标签：内置 key 非空的引擎零配置可用；google/bing 走免费网页接口免 key
const translationOptionLabel = (value: string, label: string) => {
  let suffix = ''
  if (value === 'google' || value === 'bing') {
    suffix = '（免费免key）'
  } else if ((AppInfo as Record<string, { appkey?: string }>)[value]?.appkey) {
    suffix = '（免配置）'
  }
  // 默认引擎 spark 额外标注推荐
  return value === 'spark' ? `${label}${suffix}·推荐` : `${label}${suffix}`
}

const engineLabel = (list: { value: string; label: string }[], value: string) =>
  list.find(o => o.value === value)?.label || value

// 当前引擎卡片文案：免配置引擎标出免费额度，其余提示需配置
const currentEngineLabel = computed(() => engineLabel(options, wordsStore.currentTranslationPlatform))
const currentEngineHint = computed(() => {
  const p = wordsStore.currentTranslationPlatform
  if (p === 'google' || p === 'bing') return '免配置'
  if ((AppInfo as Record<string, { appkey?: string }>)[p]?.appkey) return '免配置 · 每日 500 次'
  return '需配置 API Key'
})
</script>

<style scoped lang="scss">
.setting-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  box-sizing: border-box;
}

.titles {
  .setting-item + .setting-item {
    margin-top: 10px;
  }
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

.engine-card {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  margin: 6px 20px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);

  .engine-card-main {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }

  .engine-card-name {
    font-size: 13px;
    font-weight: 600;
    color: var(--utools-text-primary);
  }

  .engine-card-hint {
    font-size: 12px;
    color: var(--utools-text-tertiary);
  }
}

.deprecate-notice {
  margin: 6px 20px 0;
  font-size: 12px;
  line-height: 1.5;
  color: var(--el-color-warning);
}

.el-switch {
  --el-switch-on-color: var(--utools-primary);
  --el-switch-off-color: var(--utools-text-tertiary);
}
</style>
