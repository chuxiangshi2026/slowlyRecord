<template>
  <div class="titles">
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
      <div class="setting-item">
        <div class="content">整体明亮度</div>
        <div class="brightness-control shorcut-desc">
          <el-slider style="width: 140px;"
                     :model-value="Math.round(wordsStore.appBg.brightness * 100)"
                     :min="50" :max="150" :step="5" :show-tooltip="false"
                     @update:model-value="(v: number | number[]) => wordsStore.setAppBg({brightness: (Array.isArray(v) ? v[0] : v) / 100})"/>
          <span>{{ Math.round(wordsStore.appBg.brightness * 100) }}%</span>
        </div>
      </div>
    </div>

    <!-- 界面背景：预设/自定义图片 + 遮罩浓度 + 亚克力；图片本体存 app-bg-image 独立文档（不进同步） -->
    <div>
      <div class="setting-item">
        <div class="content">界面背景</div>
        <div class="bg-picker shorcut-desc">
          <div class="bg-thumb bg-thumb-none" :class="{active: !wordsStore.appBg.preset}"
               @click="onPickBgPreset('')">无</div>
          <div v-for="p in bgPresets" :key="p.id" class="bg-thumb"
               :class="{active: wordsStore.appBg.preset === p.id}"
               :style="{backgroundImage: `url(bg/${p.id}.svg)`}"
               :title="p.name"
               @click="onPickBgPreset(p.id)"/>
          <div class="bg-thumb bg-thumb-custom" :class="{active: wordsStore.appBg.preset === 'custom'}"
               :style="customBgThumb ? {backgroundImage: `url(${customBgThumb})`} : {}"
               title="自定义图片"
               @click="bgFileInput?.click()">
            <el-icon v-if="!customBgThumb"><Plus/></el-icon>
          </div>
          <input ref="bgFileInput" type="file" accept="image/*" style="display:none" @change="onBgFileChange"/>
        </div>
      </div>
      <div class="setting-item" v-if="wordsStore.appBg.preset">
        <div class="content">背景浓度（越低越透，越高越接近纯色底）</div>
        <el-slider class="shorcut-desc" style="width: 140px;"
                   :model-value="Math.round(wordsStore.appBg.scrim * 100)"
                   :min="10" :max="90" :step="5" :show-tooltip="false"
                   @update:model-value="(v: number | number[]) => wordsStore.setAppBg({scrim: (Array.isArray(v) ? v[0] : v) / 100})"/>
      </div>
      <div class="setting-item" v-if="wordsStore.appBg.preset">
        <div class="content">亚克力效果（毛玻璃）</div>
        <el-switch class="shorcut-desc"
                   :model-value="wordsStore.appBg.acrylic"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @update:model-value="(v: string | number | boolean | undefined) => wordsStore.setAppBg({acrylic: !!v})"/>
      </div>
      <div class="setting-item" v-if="wordsStore.appBg.preset && wordsStore.appBg.acrylic">
        <div class="content">背景模糊（整张背景图）</div>
        <el-slider class="shorcut-desc" style="width: 140px;"
                   :model-value="wordsStore.appBg.acrylicBlur"
                   :min="0" :max="40" :step="2" :show-tooltip="false"
                   @update:model-value="(v: number | number[]) => wordsStore.setAppBg({acrylicBlur: Array.isArray(v) ? v[0] : v})"/>
      </div>
      <div class="setting-item" v-if="wordsStore.appBg.preset && wordsStore.appBg.acrylic">
        <div class="content">列表模糊（卡片额外加深）</div>
        <el-slider class="shorcut-desc" style="width: 140px;"
                   :model-value="wordsStore.appBg.cardBlur"
                   :min="0" :max="40" :step="2" :show-tooltip="false"
                   @update:model-value="(v: number | number[]) => wordsStore.setAppBg({cardBlur: Array.isArray(v) ? v[0] : v})"/>
      </div>
      <div class="setting-item" v-if="wordsStore.appBg.preset">
        <div class="content">页头应用透明/亚克力</div>
        <el-switch class="shorcut-desc"
                   :model-value="wordsStore.appBg.headerEffect"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @update:model-value="(v: string | number | boolean | undefined) => wordsStore.setAppBg({headerEffect: !!v})"/>
      </div>
      <div class="setting-item" v-if="wordsStore.appBg.preset">
        <div class="content">底栏应用透明/亚克力</div>
        <el-switch class="shorcut-desc"
                   :model-value="wordsStore.appBg.footerEffect"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @update:model-value="(v: string | number | boolean | undefined) => wordsStore.setAppBg({footerEffect: !!v})"/>
      </div>
    </div>

    <!-- 主窗口透明度：窗口级透明，仅 Electron/Web 有效（uTools 主窗口 iframe 背景不受内部 CSS 控制） -->
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
import {computed, ref} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import {isUtools} from "@/adapters/platform";
import {getAppBgImage, saveAppBgImage, removeAppBgImage, fileToCompressedDataUrl} from "@/utils/app-bg-db.ts";
import {ElMessage} from 'element-plus'

const wordsStore = useWordsStore();

// 界面背景：预设/自定义上传。选择即应用（setAppBg 内部写 CSS 变量并持久化轻量标志位到 user-set）
const bgPresets = [
  {id: 'preset-mist', name: '晨雾'},
  {id: 'preset-dawn', name: '晨曦'},
  {id: 'preset-forest', name: '林间'},
]
const bgFileInput = ref<HTMLInputElement>()
const customBgThumb = ref(wordsStore.appBg.preset === 'custom' ? getAppBgImage() : '')
const onPickBgPreset = (id: string) => {
  // 从自定义切走时清掉图片文档，避免留下孤儿数据
  if (wordsStore.appBg.preset === 'custom' && id !== 'custom') {
    removeAppBgImage()
    customBgThumb.value = ''
  }
  void wordsStore.setAppBg({preset: id})
}
const onBgFileChange = async (e: Event) => {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // 允许重选同一文件
  if (!file) return
  try {
    const dataUrl = await fileToCompressedDataUrl(file)
    if (!(await saveAppBgImage(dataUrl))) {
      ElMessage.warning('背景图保存失败，请重试')
      return
    }
    customBgThumb.value = dataUrl
    void wordsStore.setAppBg({preset: 'custom'})
  } catch {
    ElMessage.warning('图片读取失败，请换一张试试')
  }
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

.brightness-control {
  display: flex;
  align-items: center;
  gap: 10px;

  span {
    min-width: 36px;
    text-align: right;
  }
}

.bg-picker {
  display: flex;
  gap: 8px;
  align-items: center;
}

.bg-thumb {
  width: 40px;
  height: 28px;
  border-radius: 6px;
  border: 1px solid var(--utools-border-primary);
  background-size: cover;
  background-position: center;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--utools-text-tertiary);
  font-size: 11px;
  box-sizing: border-box;

  &.active {
    border: 2px solid var(--utools-primary);
  }
}

.bg-thumb-none {
  background: var(--utools-bg-primary);
}

.bg-thumb-custom {
  background: var(--utools-bg-tertiary);
}

.el-switch {
  --el-switch-on-color: var(--utools-primary);
  --el-switch-off-color: var(--utools-text-tertiary);
}
</style>
