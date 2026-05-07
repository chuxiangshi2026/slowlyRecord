<template>
  <el-drawer
      v-model="visible"
      :title="title"
      size="430px"
      destroy-on-close
  >


    <!--    <div style={{ position: 'relative', overflow: 'hidden' }}>-->
    <!--    <Drawer-->
    <!--        onChange={(e)
        => onChange(e as any)}
        open={showSetting}
        onClose={(e) => onTouchEnd(e as any)}
        placement="right"
        handler={false}
        level={null}
        afterVisibleChange={(c: boolean) => {
        console.log('transitionEnd: ', c)
        }}
        width="30vw"
        >-->
    <!--     设置模块 -->
    <h4 class="header">设置</h4>
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
    </div>
    <div>
      <div class="setting-item">
        <div class="content">翻译引擎</div>
        <!--        ;justify-content: space-between;  size="large"-->
        <el-select class="shorcut-desc" :model-value="wordsStore.currentTranslationPlatform"
                   @update:model-value="(val: TranslationPlatform) => wordsStore.setTranslationPlatform(val)"
                   placeholder="选择"
                   style="width:150px">
          <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"
          />
        </el-select>
      </div>
    </div>
    <div>
      <div class="setting-item">
        <div class="content">ocr图片识别引擎</div>
        <!--        ;justify-content: space-between;  size="large"-->
        <el-select class="shorcut-desc" v-model="wordsStore.currentOcrPlatform" @change="wordsStore.setOcrPlatform"
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
        <el-select class="shorcut-desc" v-model="wordsStore.memoryFirmness"
                   @change="wordsStore.setMemoryFirmness"
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


    <div class="titles">
      <div class="setting-item">
        <div class="content">启用快捷键</div>
        <el-switch class="shorcut-desc"
                   v-model="wordsStore.shortcutEnabled"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   @change="openTheShortcut"
        />
      </div>
    </div>


    <el-divider/>

    <!--     功能模块 -->
    <!--    <h4 class="header">功能</h4>
        <div class="content">
          <div class="function-item">
            <div>导出</div>
            <div>导入</div>
          </div>
        </div>
        <el-divider/>-->

    <h4 class="header">设置全局快捷键</h4>
    <div class="titles">
      <div class="setting-item">
        <!--        <div class="content">打开全局快捷键</div>-->
        <el-button type="info" @click="kuaijiejian(1)">划词快捷键</el-button>
        <el-button type="info" @click="kuaijiejian(2)">划段快捷键</el-button>
        <el-button type="info" @click="kuaijiejian(3)">截图快捷键</el-button>
      </div>
    </div>

    <el-divider/>


    <!--     快捷键模块 -->
    <h4 class="header">快捷键</h4>
    <div class="content">
      <h5 style="text-align:center;">列表模式</h5>
      <div class="titles">
        <span class="title">功能说明</span>
        <span class="title">快捷键</span>
      </div>
      <div v-for="(item,index) in listShortcuts"
           :key="index" class="titles">
        <span class="shorcut-desc">{{ item.desc }}</span>
        <span class="shorcut-desc">{{ item.shortcut }}</span>
      </div>

      <h5 style="text-align:center; margin-top: 20px;">听写模式</h5>
      <div class="titles">
        <span class="title">功能说明</span>
        <span class="title">快捷键</span>
      </div>
      <div v-for="(item,index) in dictationShortcuts"
           :key="index" class="titles">
        <span class="shorcut-desc">{{ item.desc }}</span>
        <span class="shorcut-desc">{{ item.shortcut }}</span>
      </div>
    </div>

    <el-divider/>


    <!--     密钥设置模块 -->
    <h4 class="header">密钥</h4>
    <div class="content">
      <h5 style="text-align:center;">翻译密钥</h5>
      <div class="titles">
        <span class="title">AppId</span>
        <span class="title">SecretKey</span>
      </div>
      <!--      apiKeys-->
      <div v-for="(item,index) in wordsStore.userApiKeys"
           :key="index" class="titles" v-show="index !== 'utoolsai' && index !== 'local'">
        <span class="shorcut-desc">
          {{ index }} AppKey
          <!--          type="password"-->
          <el-input v-model="item.appkey"
                    @update:model-value="(val: string) => updateKey(index, 'appkey', val)"
                    style="width: 153px"
                    :placeholder="'ollama'===index?'http://localhost:11434）':['ollama','deepseek', 'qwen', 'kimi', 'glm'].includes(index)?'使用必需填写':'没有请留空'"
          />
        </span>
        <span class="shorcut-desc">
          {{ index }} SecretKey
          <!--          type="password"-->
          <el-input v-model="item.key"
                    :disabled="['deepseek', 'qwen', 'kimi', 'glm'].includes(index)"
                    @update:model-value="(val: string) => updateKey(index, 'key', val)"
                    style="width: 185px"
                    :placeholder="'ollama'===index?'模型名如（qwen2.5:0.5b）':['ollama', 'deepseek', 'qwen', 'kimi', 'glm'].includes(index)?'无需填写':'没有请留空'"/>
        </span>
      </div>


      <h5 style="text-align:center;">ocr图片识别密钥</h5>
      <div class="titles">
        <span class="title">AppId</span>
        <span class="title">SecretKey</span>
      </div>
      <!--      apiKeys-->
      <div v-for="(item,index) in wordsStore.userOcrApiKeys"
           :key="index" class="titles"
           v-show="index !== 'local'"
      >
        <span class="shorcut-desc">
          {{ index }} AppKey
          <!--          type="password"-->
          <el-input v-model="item.appkey"
                    @update:model-value="(val: string) => updateOcrKey(index, 'appkey', val)"
                    style="width: 115px" placeholder="请填入id"/>
        </span>
        <span class="shorcut-desc">
          {{ index }} SecretKey
          <!--          type="password"-->
          <el-input v-model="item.key"
                    @update:model-value="(val: string) => updateOcrKey(index, 'key', val)"
                    style="width: 190px" placeholder="请填入密钥"/>
        </span>
      </div>
    </div>

    <el-divider/>


    <h4 class="header">配置管理</h4>
    <div class="content">
      <div class="config-buttons">
        <el-button type="primary" @click="exportConfig" :icon="Download">导出配置</el-button>
        <el-button type="success" @click="triggerImport" :icon="Upload">导入配置</el-button>
        <input
          type="file"
          ref="fileInput"
          style="display: none"
          accept=".json"
          @change="handleFileImport"
        />
      </div>
      <p class="config-hint">导出配置可保存您的 API 密钥、翻译引擎设置等个人配置</p>
    </div>

    <el-divider/>

    <h4 class="header">其他</h4>
    <div class="content">
      <h5 style="text-align:center;">申请密钥</h5>
      <p class="limit-info">
        由于截图翻译调用成本较高，优先使用本地功能，在没有配置自己密钥时，暂时限制直接使用次数每日10次(方便测试自己密钥)，配置自己的密钥后不再限制，自己额度基本够用，截图主要使用者，希望尽量使用自己的免费额度</p>
      <!--      <div class="view-version-btn">-->

      <div v-for="platform in TRANSLATION_PLATFORM_LINKS"
           :key="platform.key"
           class="titles">
        <div class="setting-item">
          <div class="content">{{ platform.content }}</div>
          <a href="#"
             @click.prevent="openUrl(platform.url)"
             class="external-link">跳转{{ platform.name }}</a>
        </div>
      </div>
    </div>

    <!--      <div class="view-version-btn" @click="updateshowNotification(true)">查看版本说明</div>-->
    <!--    </div>-->

    <!--    </Drawer>-->

    <!-- 内容区按模块拆分 -->
    <!--    <el-scrollbar height="100%">-->
    <!--      <div class="drawer-body">-->
    <!--        &lt;!&ndash; 基础信息 &ndash;&gt;-->
    <!--        <BasicInfoForm :data="detailData" @change="handleBasicChange" />-->

    <!--        &lt;!&ndash; 分割线 &ndash;&gt;-->
    <!--        <el-divider />-->

    <!--        &lt;!&ndash; 高级配置 &ndash;&gt;-->
    <!--        <AdvancedConfig v-model:config="detailData.config" />-->

    <!--        &lt;!&ndash; 操作日志 &ndash;&gt;-->
    <!--        <LogTable :user-id="detailId" />-->
    <!--      </div>-->

    <!--      &lt;!&ndash; 底部操作 &ndash;&gt;-->
    <!--      <div class="drawer-footer">-->
    <!--        <el-button @click="close">取消</el-button>-->
    <!--        <el-button type="primary" @click="save">保存</el-button>-->
    <!--      </div>-->
    <!--    </el-scrollbar>-->
  </el-drawer>
</template>
<script setup lang="ts">
import {computed, onMounted, reactive, ref, watch} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {AppInfo, TRANSLATION_PLATFORM_LINKS} from "@/config.ts";
import {getSetDb, addAndUpdateSetDb} from "@/utils/user-set-db-util.ts";
import {log} from "@/utils/logger.ts";
import {isUtools} from "@/adapters/platform";
import { Download, Upload } from '@element-plus/icons-vue'
import { ElMessage, ElMessageBox } from 'element-plus'
// import BasicInfoForm from './BasicInfoForm.vue'
// import AdvancedConfig from './AdvancedConfig.vue'
// import LogTable from './LogTable.vue'

const props = defineProps({
  modelValue: Boolean,
  detailId: [String, Number],
  title: {
    type: String,
    default: '设置'
  }
})
// 定义emit事件
const emit = defineEmits(['update:modelValue', 'save'])


// 核心：定义明确的更新方法
const updateKey = (index: TranslationPlatform, field: 'appkey' | 'key', val: string) => {
  // 更新 store 中的 API 密钥
  wordsStore.setApiKey(index, field === 'appkey' ? val : wordsStore.userApiKeys[index].appkey, field === 'key' ? val : wordsStore.userApiKeys[index].key);
}
const updateOcrKey = (index: OcrPlatform, field: 'appkey' | 'key', val: string) => {
  log.i('updateOcrKey', index, field, val)
  // 更新 store 中的 API 密钥
  wordsStore.setOcrApiKey(index, field === 'appkey' ? val : wordsStore.userOcrApiKeys[index].appkey, field === 'key' ? val : wordsStore.userOcrApiKeys[index].key);
}
// 创建响应式API密钥数据，优先使用用户设置的值
// const apiKeys = reactive({
//   youdao: {
//     // || AppInfo.youdao.appkey
//     appkey: localStorage.getItem('api_key_youdao_appkey') || '',
//     // || AppInfo.youdao.key
//     key: localStorage.getItem('api_key_youdao_key') || ''
//   },
//   ali: {
//     // || AppInfo.ali.appkey
//     appkey: localStorage.getItem('api_key_ali_appkey') || '',
//     // || AppInfo.ali.key
//     key: localStorage.getItem('api_key_ali_key') || ''
//   },
//   baidu: {
//     // || AppInfo.baidu.appkey
//     appkey: localStorage.getItem('api_key_baidu_appkey') || '',
//     // || AppInfo.baidu.key
//     key: localStorage.getItem('api_key_baidu_key') || ''
//   },
//   utoolsai: {
//     appkey: localStorage.getItem('api_key_utoolsai_appkey') || '',
//     key: localStorage.getItem('api_key_utoolsai_key') || ''
//   },
//   ollama: {
//     appkey: localStorage.getItem('api_key_ollama_appkey') || '',
//     key: localStorage.getItem('api_key_ollama_key') || ''
//   },
//   deepseek: {
//     appkey: localStorage.getItem('api_key_deepseek_appkey') || '',
//     key: localStorage.getItem('api_key_deepseek_key') || ''
//   },
//   qwen: {
//     appkey: localStorage.getItem('api_key_qwen_appkey') || '',
//     key: localStorage.getItem('api_key_qwen_key') || ''
//   },
//   kimi: {
//     appkey: localStorage.getItem('api_key_kimi_appkey') || '',
//     key: localStorage.getItem('api_key_kimi_key') || ''
//   }
// } as Record<TranslationPlatform, { appkey: string; key: string }>)

// 监听API密钥变化并保存
// watch(() => apiKeys.ali, () => {
//   saveApiKeys('ali')
// }, {deep: true})
//
// watch(() => apiKeys.youdao, () => {
//   saveApiKeys('youdao')
// }, {deep: true})
//
// watch(() => apiKeys.baidu, () => {
//   saveApiKeys('baidu')
// }, {deep: true})
//
// watch(() => apiKeys.utoolsai, () => {
//   saveApiKeys('utoolsai')
// }, {deep: true})
//
// watch(() => apiKeys.ollama, () => {
//   saveApiKeys('ollama')
// }, {deep: true})
//
// watch(() => apiKeys.deepseek, () => {
//   saveApiKeys('deepseek')
// }, {deep: true})
//
// watch(() => apiKeys.qwen, () => {
//   saveApiKeys('qwen')
// }, {deep: true})
//
// watch(() => apiKeys.kimi, () => {
//   saveApiKeys('kimi')
// }, {deep: true})
//
// const saveApiKeys = (provider: TranslationPlatform) => {
//   // 保存API密钥到本地存储
//   wordsStore.setApiKey(provider, apiKeys[provider].appkey, apiKeys[provider].key)
//   console.log(`${provider} API密钥已保存`, apiKeys[provider])
// }

// 退出插件
// const exitThePlugin = ref(false)


const openUrl = (url: string) => {
  if (isUtools()) {
    (window as any).utools?.shellOpenExternal?.(url);
  } else {
    window.open(url, '_blank');
  }
}


// const shortcutEnabled = ref(false) // 快捷键开关状态
// const autoFocusFirstItem = ref(true) // 自动聚焦第一个单词状态

// 实现快捷键开关功能
const openTheShortcut = () => {
  // 可以在这里添加持久化保存快捷键状态的逻辑
  wordsStore.setShortcutEnabled(wordsStore.shortcutEnabled)
}
// 在组件挂载时读取快捷键状态
// onMounted(() => {
//   // const savedStatus = localStorage.getItem('shortcutEnabled')
//   shortcutEnabled.value = wordsStore.shortcutEnabled
//
//   // const savedStatus = localStorage.getItem('shortcutEnabled')
//   exitThePlugin.value = wordsStore.pluginStatus
//
//   // const savedStatus = localStorage.getItem('shortcutEnabled')
//   tranApi.value = wordsStore.currentTranslationPlatform
// })

const onCloseAfterAddSwitchChange = () => {
  wordsStore.setClosePlugin(wordsStore.pluginStatus)
}



const kuaijiejian = (type: number) => {
  const utoolsApi = (window as any).utools;
  if (!isUtools() || !utoolsApi?.redirectHotKeySetting) return;
  if (type == 1) {
    utoolsApi.redirectHotKeySetting("划词添加", true);
  }
  if (type == 2) {
    utoolsApi.redirectHotKeySetting("划段添加", true)
  }
  if (type == 3) {
    utoolsApi.redirectHotKeySetting("截图添加", true)
  }
}


let wordsStore = useWordsStore();

// 记忆牢固度选项
const memoryFirmnessOptions = ['正常' , '较强' , '极强'];

const ocrOptions = [
  {
    value: 'local',
    label: '本地词典(离线)',
  },
  {
    value: 'tencent',
    label: '腾讯',
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
  }]
const options = [
  {
    value: 'utoolsai',
    label: 'utoolsAI',
  },
  ...ocrOptions, {
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
  }
]
/*{
  value: 'google',
      label: '谷歌',
},
{
  value: 'Option5',
      label: 'Option5',
},*/
const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const detailData = ref({})

// 监听id变化加载数据
/*watch(() => props.detailId, async (id) => {
  if (id && visible.value) {
    detailData.value = await fetchDetail(id)
  }
}, { immediate: true })*/

const close = () => {
  visible.value = false
  detailData.value = {}
}

const save = () => {
  emit('save', detailData.value)
  close()
}


const listShortcuts = [
  {desc: '记得选中单词', shortcut: 'Shift + R'},
  {desc: '忘记选中单词', shortcut: 'Shift + F'},
  {desc: '选中单词发音', shortcut: 'Shift + P'},
  {desc: '翻译选中单词', shortcut: 'Shift + T'},
  {desc: '保存释义', shortcut: 'Ctrl + Enter'}
]

const cardShortcuts = [
  {desc: '下一个', shortcut: 'Shift + >'},
  {desc: '上一个', shortcut: 'Shift + <'},
  {desc: '单词发音', shortcut: 'Shift + P'},
  {desc: '模式切换', shortcut: 'Shift + M'},
  {desc: '开启/关闭翻译', shortcut: 'Shift + T'},
]

const dictationShortcuts = [
  {desc: '显示提示', shortcut: 'Shift + H'},
  {desc: '上一个单词', shortcut: 'Shift + ←'},
  {desc: '跳过/下一个单词', shortcut: 'Shift + →'},
  {desc: '播放发音', shortcut: 'Space'},
  {desc: '跳过单词', shortcut: 'Enter'},
]

// 配置文件导入导出
const fileInput = ref<HTMLInputElement | null>(null)

// 导出配置
const exportConfig = () => {
  const userSet = getSetDb()
  if (!userSet) {
    ElMessage.warning('暂无配置可导出')
    return
  }

  const configData = {
    version: '1.0',
    exportTime: new Date().toISOString(),
    settings: {
      pluginStatus: userSet.pluginStatus,
      shortcutEnabled: userSet.shortcutEnabled,
      translationPlatform: userSet.translationPlatform,
      ocrPlatform: userSet.ocrPlatform,
      memoryFirmness: userSet.memoryFirmness,
      keys: userSet.keys || {},
      ocrKeys: userSet.ocrKeys || {}
    }
  }

  const blob = new Blob([JSON.stringify(configData, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `slowlyRecord-config-${new Date().toISOString().split('T')[0]}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)

  ElMessage.success('配置已导出')
}

// 触发文件选择
const triggerImport = () => {
  fileInput.value?.click()
}

// 处理文件导入
const handleFileImport = (event: Event) => {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]

  if (!file) {
    return
  }

  const reader = new FileReader()
  reader.onload = (e) => {
    try {
      const content = e.target?.result as string
      const configData = JSON.parse(content)

      // 验证配置文件格式
      if (!configData.settings) {
        throw new Error('配置文件格式错误')
      }

      ElMessageBox.confirm(
        '导入配置将覆盖当前的 API 密钥和设置，是否继续？',
        '确认导入',
        {
          confirmButtonText: '确认导入',
          cancelButtonText: '取消',
          type: 'warning'
        }
      ).then(() => {
        // 应用配置
        const settings = configData.settings

        // 更新 store
        if (settings.pluginStatus !== undefined) {
          wordsStore.setClosePlugin(settings.pluginStatus)
        }
        if (settings.shortcutEnabled !== undefined) {
          wordsStore.setShortcutEnabled(settings.shortcutEnabled)
        }
        if (settings.translationPlatform) {
          wordsStore.setTranslationPlatform(settings.translationPlatform)
        }
        if (settings.ocrPlatform) {
          wordsStore.setOcrPlatform(settings.ocrPlatform)
        }
        if (settings.memoryFirmness) {
          wordsStore.setMemoryFirmness(settings.memoryFirmness)
        }

        // 更新 API Keys
        if (settings.keys) {
          Object.entries(settings.keys).forEach(([platform, keys]: [string, any]) => {
            if (keys.appkey !== undefined && keys.key !== undefined) {
              wordsStore.setApiKey(platform as TranslationPlatform, keys.appkey, keys.key)
            }
          })
        }

        // 更新 OCR Keys
        if (settings.ocrKeys) {
          Object.entries(settings.ocrKeys).forEach(([platform, keys]: [string, any]) => {
            if (keys.appkey !== undefined && keys.key !== undefined) {
              wordsStore.setOcrApiKey(platform as OcrPlatform, keys.appkey, keys.key)
            }
          })
        }

        ElMessage.success('配置导入成功')
      }).catch(() => {
        // 用户取消
      })
    } catch (error) {
      ElMessage.error('配置文件解析失败，请检查文件格式')
      console.error('导入配置错误:', error)
    }

    // 清空 input 值，允许重复导入同一文件
    target.value = ''
  }

  reader.readAsText(file)
}
</script>
<style scoped lang="scss">
.el-drawer {
  .rc-switch-checked {
    border: 1px solid var(--utools-primary);
    background-color: var(--utools-primary);
  }

  //&-content
  &__body {
    background-color: var(--utools-bg-secondary);
    padding-bottom: 20px;
    box-sizing: border-box;

    .view-version-btn {
      background-color: var(--utools-text-tertiary);
      border: none;
      color: var(--utools-text-inverse);
      padding: 4px 8px;
      box-sizing: border-box;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 12px;
      margin: 4px 2px;
      cursor: pointer;
      -webkit-transition-duration: 0.4s;
      transition-duration: 0.4s;
      border-radius: 4px;

      &:hover {
        box-shadow: var(--utools-shadow-md);
      }
    }

    .header {
      padding: 0 10px;
      color: var(--utools-text-primary);
    }

    .setting-item {
      display: flex;
      align-items: center;
    }

    .content {
      padding: 0 20px;
      color: var(--utools-text-secondary);
      font-size: 12px;

      .titles {
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        color: var(--utools-text-primary);
      }

      .shorcut-desc {
        margin-top: 10px;
        font-size: 12px;
        font-weight: 400;
        color: var(--utools-text-secondary);
      }
    }
  }
}

.el-switch {
  --el-switch-on-color: var(--utools-primary);
  --el-switch-off-color: var(--utools-text-tertiary);
}

.external-link {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 4px;
  text-decoration: none;
  color: var(--utools-text-secondary);
  background-color: var(--utools-bg-tertiary);
  transition: background-color 0.3s ease;

  &:hover {
    background-color: var(--utools-bg-hover);
    color: var(--utools-primary);
  }
}

.config-buttons {
  display: flex;
  justify-content: center;
  gap: 16px;
  padding: 16px 0;

  :deep(.el-button--primary) {
    background-color: var(--utools-primary);
    border-color: var(--utools-primary);
    color: #fff;

    &:hover {
      background-color: var(--utools-primary-hover, var(--utools-primary));
      border-color: var(--utools-primary-hover, var(--utools-primary));
    }
  }

  :deep(.el-button--success) {
    background-color: var(--utools-success, #67c23a);
    border-color: var(--utools-success, #67c23a);
    color: #fff;

    &:hover {
      background-color: var(--utools-success-hover, #85ce61);
      border-color: var(--utools-success-hover, #85ce61);
    }
  }

  :deep(.el-button .el-icon) {
    color: inherit;
  }
}

.config-hint {
  text-align: center;
  color: var(--utools-text-tertiary);
  font-size: 12px;
  margin: 8px 0 0 0;
}

.limit-info {
  color: var(--utools-text-secondary);
  font-size: 12px;
  padding: 0 20px;
  line-height: 1.5;
}



/* 禁用输入框样式 */
:deep(.el-input.is-disabled .el-input__wrapper) {
  background-color: var(--utools-bg-tertiary);
  border-color: var(--utools-border-primary);
  color: var(--utools-text-disabled);
  cursor: not-allowed;
}

:deep(.el-input.is-disabled .el-input__inner) {
  color: var(--utools-text-disabled);
  cursor: not-allowed;
}

:deep(.el-input__wrapper) {
  background-color: var(--utools-bg-input);
}

:deep(.el-input__inner) {
  color: var(--utools-text-primary);
}
</style>
