<template>
  <!-- 按需引入后无 app.use(ElementPlus)，locale 经此提供，保证内置文案（如 MessageBox 按钮）为中文 -->
  <el-config-provider :locale="zhCn">
    <RouterView/>
    <!-- 引入OCR选择器组件 -->
    <OCRSelector
        :visible="showOCRPanel"
        :ocr-results="ocrResults"
        :loading="ocrPanelLoading"
        @close="closeOCRPanel"
        @select="handleSelectOCRItem"
        @select-all="handleSelectAllItems"
    />

    <!-- 引入文本选择器组件 -->
    <TextSelector
        :visible="showTextPanel"
        :text-content="textContent"
        @close="closeTextPanel"
        @select="handleSelectTextItems"
        @add-whole="handleAddWholeText"
        @collect-sentence="handleCollectWholeText"
    />

    <!-- 调试面板 -->
    <DebugPanel
        :visible="showDebugPanel"
        @open="showDebugPanel = true"
        @close="showDebugPanel = false"
        ref="debugPanelRef"
    />
  </el-config-provider>
</template>


<script setup lang="ts">
import {RouterView, useRouter} from 'vue-router'

import zhCn from 'element-plus/es/locale/lang/zh-cn'

import {onMounted, onUnmounted, ref} from 'vue';
import {useWordsStore} from "@/stores/words.ts";
import {useUiStore} from "@/stores/ui.ts";
// import {storeToRefs} from "pinia";
import {DEFAULT_INTERVALS, USAGE_LIMITS} from "@/constants";
import {addWord, batchAddWords} from "@/utils/str-util.ts";
import {useSentencesStore} from "@/stores/sentences";
import {ElMessage} from "element-plus";
import {
  ocrTranslate,
  ocrTranslateAli,
  ocrTranslateBaidu,
  ocrTranslateBilibili,
  ocrTranslateSiliconflow,
  ocrTranslateLocal,
  ocrTranslateMultiPlatform,
  ocrTranslateTencent,
  preloadWorker,
  type OcrResult
} from "@/utils/pic-translate.ts";
import OCRSelector from '@/views/Word/components/OCRSelector.vue';
import TextSelector from '@/views/Word/components/TextSelector.vue';
import DebugPanel from '@/components/DebugPanel.vue';
// import {AppInfo} from "@/config.ts";
import {getSetDb, decryptSyncedSecrets} from "@/utils/user-set-db-util.ts";
import {getOcrApiKey} from "@/utils/get-api-key.ts";
import {toEngineLang} from "@/utils/translation-lang-map.ts";
import {getCurrentUsageCount, incrementUsageCounter, isFreeOcrPlatform, isOverDailyLimit} from "@/utils/usage-counter.ts";
import {getNotificationAdapter} from "@/adapters/notification.ts";
import {applyPersistedStatsPrefs} from "@/utils/stats";
import {RETIRED_MODEL_NAMES} from "@/config.ts";
import {isStoreLocalOnly} from "@/adapters/local-bulk-store";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {isUtools as checkIsUtools} from "@/adapters/platform";
import {hideMainWindow, showMainWindow} from "@/adapters/window";
import { getActiveProfile, getActiveLanguage, isWordText } from '@/utils/language';
import { containsChinese } from '@/utils/zh-entry';
import { resolveZhEnDirection } from '@/utils/text-utils';
import { translateWithPlatform } from '@/utils/translation-api';
import { reconcileSchedules } from '@/utils/schedule-reminder';

const wordsStore = useWordsStore();
const router = useRouter();

// import {fileToBase64, ocrTranslate, translateImage} from '@/utils/pic-translate.ts'

// const preview = ref<string>('')

// 添加OCR结果相关的响应式变量
const showOCRPanel = ref<boolean>(false);
const ocrPanelLoading = ref<boolean>(false); // OCR 结果返回前的「识别中」状态
const ocrResults = ref<any[]>([]);

// 添加文本选择相关的响应式变量
const showTextPanel = ref<boolean>(false);
const textContent = ref<string>('');

// 添加调试面板相关的响应式变量
const showDebugPanel = ref<boolean>(false);
const debugPanelRef = ref<InstanceType<typeof DebugPanel> | null>(null);

// 会话内复习提醒去重：每次插件进程只提醒一次
let reviewReminderNotified = false;

function reportEnterError(e: any) {
  debugLog('onPluginEnter 处理失败:', e);
  ElMessage.warning('操作执行失败，请重试');
}

// 接管 enter 事件：index.html 内联脚本早注册的队列转发到此停止（置 live 后其回调不再入队）
;(window as any).__pluginEnterLive = true
;(window as any).utools?.onPluginEnter?.(async (action: any) => {
  console.log('[onPluginEnter] 回调已触发, code=', action?.code, '时间=', new Date().toISOString());
  handleUtoolsEnter(action).catch(reportEnterError)
})

// Electron 全局快捷键：主进程已读剪贴板文本一并下发，这里复用 uTools 划词/截图/翻译的既有处理流
// （Ctrl+Shift+S 截图翻译 / Ctrl+Shift+T 划词翻译 / Ctrl+Shift+A 划词添加）
if ((window as any).electronAPI?.onGlobalShortcut) {
  (window as any).electronAPI.onGlobalShortcut((action: string, text?: string) => {
    const trimmed = (text || '').trim();
    if (action === 'quick-translate') {
      router.push(trimmed ? { path: '/translate', query: { text: trimmed } } : { path: '/translate' });
    } else if (action === 'word-select') {
      if (trimmed) {
        checkShearBoardAddWork(trimmed);
      } else {
        ElMessage.warning('剪贴板为空，请先复制要收录的文本');
      }
    } else if (action === 'screen-capture') {
      handleUtoolsEnter({ code: 'jietu' }).catch((e: any) => {
        debugLog('截图翻译快捷键处理失败:', e);
      });
    }
  });
}

// uTools enter 事件统一处理：兼容启动早期缓存的事件
// （index.html 内联脚本已提前注册 onPluginEnter，防止 Vite 冷启动慢时事件丢失）
async function handleUtoolsEnter(action: any) {
  console.log('[handleUtoolsEnter] code=', action?.code, '时间=', new Date().toISOString());
  // 新功能进入时关闭上个功能的悬浮面板（OCR 结果/划段选择），避免盖住本次页面
  showOCRPanel.value = false;
  ocrPanelLoading.value = false;
  showTextPanel.value = false;
  // 先同步 设置（商店版文档中的密钥为密文，这里解密为明文副本后再合并，库内文档仍是密文）
  let setDb = await decryptSyncedSecrets(getSetDb());

  // 同步插件状态和快捷键设置
  if (setDb) {
    // 统计偏好以 user-set 为准回填 localStorage（插件更新可能清空 localStorage）
    applyPersistedStatsPrefs({ excluded: setDb.statsExcluded, attribution: setDb.attributionEnabled });
    wordsStore.pluginStatus = setDb.pluginStatus;
    wordsStore.shortcutEnabled = setDb.shortcutEnabled;
    if (setDb.translationPlatform) wordsStore.currentTranslationPlatform = setDb.translationPlatform;
    if (setDb.ocrPlatform) wordsStore.currentOcrPlatform = setDb.ocrPlatform;
    // 同步记忆牢固度设置
    if (setDb.memoryFirmness) {
      wordsStore.memoryFirmness = setDb.memoryFirmness;
    }
    // 更新可能清除 localStorage，须从用户设置恢复已请求授权的状态
    if (setDb.scheduleReminder) {
      wordsStore.scheduleReminder = {
        ...wordsStore.scheduleReminder,
        ...setDb.scheduleReminder
      };
    }

    // 同步专注模式设置
    if (setDb.focusMode) {
      wordsStore.focusMode = {
        ...wordsStore.focusMode,
        ...setDb.focusMode
      };
    }

    // 同步主窗口透明度
    if (setDb.mainWindowOpacity !== undefined) {
      wordsStore.mainWindowOpacity = setDb.mainWindowOpacity;
      console.log('[onPluginEnter] 同步主窗口透明度:', setDb.mainWindowOpacity, 'isUtools:', checkIsUtools());
      // Web 端：同步后立即应用透明度（onMounted 时数据库可能尚未就绪）
      // uTools 端 iframe 背景不受内部 CSS 控制，跳过 applyRgbaOpacity
      if (!window.electronAPI && !checkIsUtools() && setDb.mainWindowOpacity < 1.0) {
        setTimeout(() => {
          console.log('[onPluginEnter] 延迟应用透明度:', setDb.mainWindowOpacity);
          wordsStore.applyRgbaOpacity(setDb.mainWindowOpacity);
        }, 150);
      }
    }

    // 同步界面背景设置并应用（写 CSS 变量与 body class；图片本体在 app-bg-image 文档）
    if (setDb.appBg) {
      wordsStore.appBg = {...wordsStore.appBg, ...setDb.appBg};
    }
    wordsStore.applyAppBg();

    // 同步自动发音设置
    if (setDb.autoSpeak !== undefined) {
      wordsStore.autoSpeak = setDb.autoSpeak;
    }

    // 安全地同步API密钥，提供默认值以防undefined
    // 商店版：user-set 文档中的密钥为 AES-GCM 密文（上面已解密为明文副本）；
    // 文档密钥逐项补进本机存储（不覆盖本机已有值），库内文档保持密文
    if (setDb.keys) {
      if (isStoreLocalOnly()) {
        const storeKeys = wordsStore.userApiKeys;
        for (const [platform, entry] of Object.entries(setDb.keys)) {
          const docEntry = entry as { appkey?: string; key?: string } | undefined;
          if (!docEntry?.appkey?.trim() && !docEntry?.key?.trim()) continue;
          const current = (storeKeys as Record<string, { appkey: string; key: string }>)[platform];
          if (!current || (!current.appkey?.trim() && !current.key?.trim())) {
            (storeKeys as Record<string, { appkey: string; key: string }>)[platform] = {
              appkey: docEntry.appkey || '', key: docEntry.key || '',
            };
          }
        }
        // 已下线模型名静默升级（本机存储的密钥同样可能残留旧模型名）
        for (const entry of Object.values(wordsStore.userApiKeys)) {
          if (entry && RETIRED_MODEL_NAMES[entry.key]) {
            entry.key = RETIRED_MODEL_NAMES[entry.key];
          }
        }
      } else {
      // 为每个翻译平台提供默认空值
      const defaultKeys = {
        tencent: {appkey: '', key: ''},
        ali: {appkey: '', key: ''},
        youdao: {appkey: '', key: ''},
        baidu: {appkey: '', key: ''},
        utoolsai: {appkey: '', key: ''},
        ollama: {appkey: '', key: ''},
        deepseek: {appkey: '', key: ''},
        qwen: {appkey: '', key: ''},
        kimi: {appkey: '', key: ''},
        minimax: {appkey: '', key: ''},
        hunyuan: {appkey: '', key: ''},
        glm: {appkey: '', key: ''},
        local: {appkey: '', key: ''}
      };

      // 合并用户设置的密钥和默认值
      const mergedKeys = {
        ...defaultKeys,
        ...setDb.keys
      } as Record<TranslationPlatform, { appkey: string; key: string }>;

      // 静默升级已下线的模型名（仅替换与旧默认完全一致的内容，用户自定义模型不受影响）
      for (const entry of Object.values(mergedKeys)) {
        if (entry && RETIRED_MODEL_NAMES[entry.key]) {
          entry.key = RETIRED_MODEL_NAMES[entry.key];
        }
      }

      wordsStore.userApiKeys = mergedKeys;
      }
    }

    if (setDb.ocrKeys) {
      if (isStoreLocalOnly()) {
        const storeOcrKeys = wordsStore.userOcrApiKeys;
        for (const [platform, entry] of Object.entries(setDb.ocrKeys)) {
          const docEntry = entry as { appkey?: string; key?: string } | undefined;
          if (!docEntry?.appkey?.trim() && !docEntry?.key?.trim()) continue;
          const current = (storeOcrKeys as Record<string, { appkey: string; key: string }>)[platform];
          if (!current || (!current.appkey?.trim() && !current.key?.trim())) {
            (storeOcrKeys as Record<string, { appkey: string; key: string }>)[platform] = {
              appkey: docEntry.appkey || '', key: docEntry.key || '',
            };
          }
        }
      } else {
      // 为OCR平台提供默认空值
      const defaultOcrKeys = {
        ali: {appkey: '', key: ''},
        youdao: {appkey: '', key: ''},
        baidu: {appkey: '', key: ''},
        tencent: {appkey: '', key: ''},
        deepseek: {appkey: '', key: ''},
        glm: {appkey: '', key: ''},
        local: {appkey: '', key: ''}
      };

      // 合并用户设置的OCR密钥和默认值
      wordsStore.userOcrApiKeys = {
        ...defaultOcrKeys,
        ...setDb.ocrKeys
      } as Record<OcrPlatform, { appkey: string; key: string }>;
      }
    }
  }
  // 延迟调用，避免初始化时重复计算
  setTimeout(async () => {
    try {
      await updateReview();
      // uTools 8.0+ 定时任务对账：让系统侧任务与设置意向一致（低版本内部静默跳过）
      void reconcileSchedules().catch(e => console.error('[定时任务] 对账失败:', e));
      // 到期复习提醒：仅在「待复习较多且非复习入口」时提醒一次，避免与头部「待复习 N」重复触达；
      // 点击直达复习：Web 走 onClick 回调，uTools 走 featureCode（点击后以 review 功能进入插件）
      const isReviewEntry = action?.code === 'review';
      if (checkIsUtools() && !reviewReminderNotified && !isReviewEntry && wordsStore.forgetCount >= 5) {
        reviewReminderNotified = true;
        getNotificationAdapter().show('慢记复习提醒', `今日还有 ${wordsStore.forgetCount} 个单词/句子待复习`, () => {
          showMainWindow();
          router.push('/word');
        }, 'review');
      }
    } catch (e) {
      console.error('[复习提醒] 更新复习状态或发送通知失败:', e);
    }
  }, 100);

  // { code, type, payload, option, from }

  /*  // app版本
    const currentVerson = window.services.getAppVerson()
    // 数据库版本
    const previousVerson = window.services.wordModel.getAppVersionFromDb()
    // 有返回false   null返回ture
    let b = !previousVerson?.version;
    if (
        //   ?.  链式调用，空返回 undef
        b ||
        currentVerson !== previousVerson?.version
    ) {
      // 没有版本或版本不一致   指定为最新版本
      window.services.wordModel.setAppVerson(currentVerson)
      // 显示更新通知
      // dispatch(updateshowNotification(true))
      console.log('新版，更新version', currentVerson)
    }*/


  // await initUtoolSetting()

  console.log("action对象", JSON.stringify(action), "code=", action?.code, "时间=", new Date().toISOString())
  /*  if (action.code === 'snap') {
      console.log('进来了')
      window.services.snap()
      console.log('走了--')
    }*/


  if (action.code === 'over') {

    // 把单词翻译了，添加到 列表中
    // console.log('==================', action)

    // 先显示主窗口，确保用户能看到添加结果
    showMainWindow()

    const result = await addWord(action.payload);
    if (!result.success) {
      ElMessage.warning(result.message);
    }

    // 添加单词后跳转到单词列表（避免停留在数字记忆或记忆测试页面）
    router.push('/word')

  }

  // 超级面板「收藏句子」：原句进句子库，不翻译、不参与复习
  if (action.code === 'overSentence') {
    showMainWindow()
    const text = typeof action.payload === 'string' ? action.payload.trim() : ''
    if (!text) {
      ElMessage.warning('未获取到选中的文本')
    } else {
      const res = await useSentencesStore().add(text)
      if (res.success) {
        ElMessage.success('已收藏到句子库')
        router.push('/sentences')
      } else {
        ElMessage.warning(res.message || '收藏失败')
      }
    }
  }


  if (action.code === 'huaci' && action.from === 'hotkey') {
    // autocopy 模式下 uTools 会把选中内容作为 payload 传入，优先使用，避免再读一次剪贴板（受权限/时序影响）；
    // 无 payload（手动配置的非 autocopy 快捷键）时回退读剪贴板
    let selectedText = typeof action.payload === 'string' ? action.payload.trim() : '';
    if (!selectedText) {
      try {
        selectedText = await navigator.clipboard.readText();
      } catch (e) {
        debugLog('读取剪贴板失败:', e);
        ElMessage.error('读取剪贴板失败，请重试');
        return;
      }
    }
    checkShearBoardAddWork(selectedText);
  }

  if (action.code === 'huaci' && action.from == 'main') {
    // const text = await window.services.getSelectedTextFromSystem();
    //       checkShearBoardAddWork(text);

    getSelectedTextFromSystem().then(text => {
          checkShearBoardAddWork(text);
        }
    ).catch(e => {
      debugLog('划词获取选中文本失败:', e);
      ElMessage.error('划词失败，请重试');
    });
  }

  // 划词翻译：优先用 uTools 派发的选中文本（autocopy 模式 payload），读不到再模拟复制
  if (action.code === 'huaciTranslate') {
    try {
      // 注意：不能退化为直接读剪贴板——其中可能是任意旧内容而非当前选中文本，
      // 只有模拟复制拿到的才是用户真实选中（2026-11 划词翻译错译旧剪贴板内容的回归）
      debugLog('[划词翻译] 进入分支, from=', action.from, ', type=', action.type, ', payload长度=', typeof action.payload === 'string' ? action.payload.length : 'none');
      let selected = '';
      if (action.from === 'main') {
        // 主输入框触发：payload 是输入框原文（通常就是关键词本身，回归：曾把「划词翻译」四字拿去翻译），
        // 不是系统选中文本。剥掉关键词前缀，剩余部分作为待翻译文本；没有剩余则走模拟复制取当前选中
        selected = (typeof action.payload === 'string' ? action.payload : '').replace(/^划词翻译[，,.\s:：]*/, '').trim();
      } else if (typeof action.payload === 'string') {
        // 热词触发且 uTools autocopy 把选中内容作为 payload 传入
        selected = action.payload.trim();
      }
      if (!selected) selected = (await getSelectedTextFromSystem()).trim();
      debugLog('[划词翻译] 最终文本长度=', selected.length, ', 前20字=', selected.slice(0, 20));
      if (!selected) {
        ElMessage.warning('未获取到选中的文本，请先选中要翻译的内容');
        return;
      }
      if (selected === '使用此功能，请先关闭自动分离') {
        ElMessage.error(selected);
        return;
      }
      prewarmTranslation(selected);
      router.push({ path: '/translate', query: { text: selected } });
      debugLog('[划词翻译] 已调用 router.push /translate');
    } catch (e) {
      debugLog('划词翻译获取选中文本失败:', e);
      ElMessage.error('划词翻译失败，请重试');
    }
  }

  if (action.code === 'jietu') {
    try {
      let result: OcrResult;
      if (action.type === 'img' && action.payload) {
        // 用户复制/截图图片后直接呼出：跳过屏幕截图，直接对已有图片做 OCR
        const base64 = await resolveImgPayloadToBase64(action.payload);
        if (!base64) {
          ElMessage.warning('未能读取图片内容，请重试');
          return;
        }
        // 已有图片直接 OCR：同样先打开识别中面板，不空等网络
        ocrResults.value = [];
        ocrPanelLoading.value = true;
        showOCRPanel.value = true;
        result = await ocrExistingImage(base64);
      } else {
        // 这里只应该返回  文本  具体添加的时候，还会单独翻译，这两个不在一个模块，不相互影响
        // 截图完成立即恢复窗口并切到单词列表（添加流程目的地），
        // 避免 OCR 网络期间停留在上次页面（如旧翻译页），看起来像闪退/卡死
        result = await ocrTranslateMultiPlatform(() => {
          restoreUtoolsMainWindow();
          router.push('/word');
          // 识别面板立即打开（识别中状态），OCR 结果稍后填入，不空等网络
          ocrResults.value = [];
          ocrPanelLoading.value = true;
          showOCRPanel.value = true;
        });
      }


      // 处理错误情况
      if (result.errorCode !== '0') {
        console.error(`[截图添加] 识别失败，errorCode=${result.errorCode}，原始返回：${JSON.stringify(result)}`);

        // 本地OCR错误处理
        if (result.errorCode === 'LOCAL_OCR_NO_TEXT') {
          closeOCRPanel();
          ElMessage.warning('本地OCR未能识别到文字，请尝试使用云端OCR');
          return;
        }
        if (result.errorCode === 'LOCAL_OCR_FAILED') {
          console.error('[截图添加] 本地OCR失败详情:', result.errorMessage);
          closeOCRPanel();
          ElMessage.error('本地 OCR 识别失败，可在设置中切换云端 OCR 引擎');
          return;
        }

        // 其他错误，也尝试显示结果（可能部分成功）
        if (!result.resRegions || result.resRegions.length === 0) {
          closeOCRPanel();
          ElMessage.error(`OCR 识别失败，请稍后重试或切换 OCR 引擎（错误码: ${result.errorCode}）`);
          return;
        }
      }

      // 处理成功或部分成功的情况
      if (result.resRegions && Array.isArray(result.resRegions) && result.resRegions.length > 0) {
        console.log('[截图添加] 显示OCR结果，共', result.resRegions.length, '个区域');
        // 显示可选择的单词和翻译结果
        displayOCRResults(result.resRegions);
      } else {
        console.warn('[截图添加] OCR识别结果为空');
        closeOCRPanel();
        ElMessage.warning('OCR识别结果为空，请检查图片内容');
        return;
      }
    } catch (err: any) {
      console.error('[截图添加] 捕获到错误:', err);
      closeOCRPanel();
      // 发生错误或取消时，显示主窗口让用户可以继续操作
      showMainWindow();
      // 检查是否是使用次数超限的错误
      if (err.message && err.message.includes('每日免费')) {
        ElMessage.error(err.message);
      } else if (err.message && err.message.includes('截图取消')) {
        // 用户取消，静默处理
      } else {
        // 使用 ElMessage 替代 alert，在 uTools 环境中更可靠
        ElMessage.error(err.message || '截图识别失败，请检查网络连接或OCR配置');
      }
    } finally {
      restoreUtoolsMainWindow();
    }
  }
  // }


  // 截图翻译：截图/OCR 后把原文送入翻译页，由当前翻译引擎处理
  if (action.code === 'jietuTranslate') {
    // 是否已打开「识别中」翻译页：失败/空结果时要把它复原，避免页面永远停在识别中
    let pendingPageOpened = false;
    const closePendingPage = () => {
      if (pendingPageOpened) {
        pendingPageOpened = false;
        router.push({ path: '/translate' });
      }
    };
    try {
      let ocrStart = Date.now();
      const result = await ocrTranslateMultiPlatform(() => {
        // 截图一完成立即恢复窗口并打开翻译页（识别中状态），不再让用户盯着空屏等 OCR 网络返回；
        // 计时也从截图完成开始：只统计纯 OCR 网络耗时，不含用户框选时间
        ocrStart = Date.now();
        restoreUtoolsMainWindow();
        pendingPageOpened = true;
        router.push({ path: '/translate', query: { pending: 'ocr' } });
      });
      debugLog('[截图翻译] OCR 耗时=', Date.now() - ocrStart, 'ms');
      if (result.errorCode !== '0' && (!result.resRegions || result.resRegions.length === 0)) {
        closePendingPage();
        if (result.errorCode === 'LOCAL_OCR_NO_TEXT') {
          ElMessage.warning('本地OCR未能识别到文字，请尝试使用云端OCR');
        } else if (result.errorCode === 'LOCAL_OCR_FAILED') {
          ElMessage.error('本地 OCR 识别失败，可在设置中切换云端 OCR 引擎');
        } else if (result.errorCode !== 'SCREEN_CAPTURE_CANCEL') {
          ElMessage.error(`OCR 识别失败，请稍后重试或切换 OCR 引擎（错误码: ${result.errorCode}）`);
        }
        return;
      }
      const text = (result.resRegions || [])
        .map(region => region.context)
        .filter(Boolean)
        .join('\n')
        .trim();
      if (!text) {
        closePendingPage();
        ElMessage.warning('未识别到可翻译的原文');
        return;
      }
      // 截图翻译是「帮我读懂屏幕内容」：固定译向中文，不按中英占比改译成学习语言
      prewarmTranslation(text, 'zh');
      router.push({ path: '/translate', query: { text, to: 'zh' } });
    } catch (e: any) {
      debugLog('截图翻译失败:', e);
      closePendingPage();
      if (e?.message?.includes('截图取消')) return;
      ElMessage.error(e?.message || '截图翻译失败，请重试');
    } finally {
      // 任何出口都恢复主窗口（OCR 前已隐藏），否则报错/空结果的 toast 用户看不见
      restoreUtoolsMainWindow();
    }
  }

  if (action.code === 'review') {
    handlePluginReview()
  }

  if (action.code === 'numMemory') {
    handlePluginNumMemory(action)
  }

  // 快速翻译 - 通过 fy/翻译/fanyi 关键字进入
  if (action.code === 'translate') {
    handlePluginTranslate(action)
  }

  // 快捷键记忆 - 通过 快捷键记忆 关键字进入
  if (action.code === 'shortcutMemory') {
    handlePluginShortcutMemory()
  }

  // 专注模式 - 通过 专注模式/focus 关键字进入
  if (action.code === 'focusMode') {
    handlePluginFocusMode()
  }

  // 记忆宫殿 - 通过 记忆宫殿 关键字进入
  if (action.code === 'palace') {
    handlePluginSimpleRoute('/memory-palace')
  }

  // 知识库 - 通过 知识库 关键字进入
  if (action.code === 'knowledge') {
    handlePluginSimpleRoute('/knowledge-memory')
  }

  // 其他情况（直接点击插件图标）- 尝试恢复上次状态
  // 排除添加单词相关操作，这些操作已在上面处理并跳转到单词列表
  const addWordActions = ['over', 'overSentence', 'huaci', 'jietu', 'paste', 'selection']
  if (!['review', 'numMemory', 'translate', 'shortcutMemory', 'focusMode', 'textMemory', 'palace', 'knowledge', 'huaciTranslate', 'jietuTranslate', ...addWordActions].includes(action.code)) {
    handlePluginDefaultEnter()
  }
  // 文本记忆 - 通过 文本记忆/诗词记忆 关键字进入
  if (action.code === 'textMemory') {
    handlePluginTextMemory()
  }
}

// 消费 index.html 内联脚本提前缓存的 enter 事件（App 挂载后调用）
function consumeQueuedPluginEnter() {
  const w = window as any;
  if (w.__pluginEnterQueue && w.__pluginEnterQueue.length > 0) {
    const queued = w.__pluginEnterQueue.splice(0);
    console.log('[App] 消费启动前缓存的 enter 事件:', queued.map((a: any) => a?.code).join(','));
    queued.forEach((action: any) => {
      void handleUtoolsEnter(action).catch(reportEnterError);
    });
  }
}
consumeQueuedPluginEnter();

/**
 * 显示调试信息（控制台 + 日志文件 + DebugPanel）
 */
function debugLog(...args: any[]) {
  const message = args.map(a => typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ');
  console.log(...args);
  logToFile(message);
  // 同时输出到 DebugPanel
  if (debugPanelRef.value) {
    debugPanelRef.value.addLog(message);
  }
}

/**
 * 写入日志到文件（用于打包后调试；经 preload 固定文件 + 大小轮转，页面不直接引用 fs/path）
 */
function logToFile(message: string) {
  try {
    if (isUTools()) {
      (window as any).services?.appendLog?.(message);
    }
  } catch (e) {
    // 忽略日志写入错误
  }
}

/**
 * 检测是否在 uTools 环境中
 */
function isUTools(): boolean {
  return checkIsUtools();
}

/**
 * 把 uTools img 指令的 payload（data URL / 纯 base64 / 临时文件路径）统一解析为纯 base64
 */
async function resolveImgPayloadToBase64(payload: any): Promise<string> {
  if (typeof payload !== 'string') return '';
  const trimmed = payload.trim();
  if (!trimmed) return '';

  // data URL：去掉前缀
  if (trimmed.startsWith('data:')) {
    return trimmed.includes(',') ? trimmed.split(',').pop() || '' : trimmed;
  }

  // 纯 base64：无路径分隔特征且长度足够
  if (trimmed.length > 100 && /^[A-Za-z0-9+/=\r\n]+$/.test(trimmed) && !/[/\\]/.test(trimmed)) {
    return trimmed;
  }

  // 临时文件路径：通过 preload 的受限接口读取（仅限系统/uTools 临时目录）后转 base64
  try {
    const services = (window as any).services;
    if (services?.readTempImageAsBase64) {
      const base64 = services.readTempImageAsBase64(trimmed);
      if (base64) return base64;
    }
  } catch (e) {
    console.error('[截图添加] 读取图片文件失败:', e);
  }
  return '';
}

/**
 * 对已有图片直接走现有 OCR 引擎（与 ocrTranslateMultiPlatform 的平台分发一致，但不触发屏幕截图）
 * @param base64 图片 base64（不含 data: 前缀）
 */
async function ocrExistingImage(base64: string): Promise<OcrResult> {
  const wordsStore = useWordsStore();
  const ocrPlatform = wordsStore.currentOcrPlatform || 'local';

  // 与 ocrTranslateMultiPlatform 保持一致的每日免费次数限制（本地 OCR 不计次；翻译或 OCR 任一密钥槽已配置即视为自有额度）
  if (isFreeOcrPlatform(ocrPlatform)) {
    const counterKey = ocrPlatform === 'tencent' ? 'tencent_ocr' : 'ocr';
    const dailyLimit = ocrPlatform === 'tencent' ? USAGE_LIMITS.TENCENT_OCR_DAILY_LIMIT : USAGE_LIMITS.OCR_DAILY_LIMIT;
    if (isOverDailyLimit(counterKey)) {
      const usedCount = getCurrentUsageCount(counterKey);
      throw new Error(`每日免费${ocrPlatform === 'tencent' ? '腾讯' : ''}截图翻译次数已达上限 (${usedCount}/${dailyLimit} 次)，请设置自定义API密钥以继续使用`);
    }
    incrementUsageCounter(counterKey);
  }

  const {appkey, key} = getOcrApiKey(ocrPlatform);
  if (ocrPlatform === 'youdao') {
    const from = toEngineLang('youdao', getActiveLanguage(), 'ocr');
    if (!from) throw new Error('有道OCR不支持当前语言');
    return await ocrTranslate(base64, appkey, key, from, 'zh-CHS');
  }
  if (ocrPlatform === 'baidu') {
    return await ocrTranslateBaidu(base64, appkey, key);
  }
  if (ocrPlatform === 'ali') {
    return await ocrTranslateAli(base64, appkey, key);
  }
  if (ocrPlatform === 'bilibili') {
    return await ocrTranslateBilibili(base64, key);
  }
  if (ocrPlatform === 'siliconflow') {
    return await ocrTranslateSiliconflow(base64, appkey, key, wordsStore.currentTranslationPlatform || 'local');
  }
  if (ocrPlatform === 'local') {
    return await ocrTranslateLocal(base64, wordsStore.currentTranslationPlatform || 'local');
  }
  if (ocrPlatform === 'deepseek' || ocrPlatform === 'glm') {
    // 视觉大模型 OCR 的封装在 ocrTranslateMultiPlatform 内部（会触发截图），已有图片入口暂不支持
    throw new Error('当前 OCR 引擎为视觉大模型，暂不支持直接识别已有图片，请先在设置中切换为云端 OCR 引擎');
  }
  return await ocrTranslateTencent(base64, appkey, key);
}



/** 截图/OCR 完成后兜底恢复主窗口：窗口隐藏状态下的 toast 与路由切换用户都看不见 */
function restoreUtoolsMainWindow() {
  try { showMainWindow(); } catch { /* 静默 */ }
}

/**
 * 翻译预热：用与翻译页相同的参数提前发起请求；
 * 翻译页挂载后经 translation-api 在途去重共享同一 Promise，省一次网络往返。
 * 截图翻译传入目标语言时以入口指定为准（与翻译页 query.to 一致）。
 */
function prewarmTranslation(text: string, to?: 'zh' | 'en') {
  try {
    // 与翻译页同一套方向判定（中英混杂按占比），保证在途去重命中同一缓存键
    const direction = to ? { from: 'auto' as const, to } : resolveZhEnDirection(text);
    void translateWithPlatform(text, wordsStore.currentTranslationPlatform, direction.from, direction.to).catch(() => { /* 预热失败由页面自身重试 */ });
  } catch { /* 预热失败不影响正常流程 */ }
}

/**
 * 显示OCR识别结果供用户选择和保存
 */
async function displayOCRResults(resRegions: any[]) {
  console.log('[截图添加] displayOCRResults 被调用，结果数:', resRegions?.length || 0);

  // 识别成功，显示主窗口让用户查看结果
  showMainWindow();
  console.log('[截图添加] 主窗口已显示');

  // 存储OCR结果
  ocrResults.value = resRegions;
  ocrPanelLoading.value = false;
  // console.log('[截图添加] ocrResults 已设置:', JSON.stringify(ocrResults.value));

  // 显示选择面板
  showOCRPanel.value = true;
  console.log('[截图添加] showOCRPanel 已设置为 true:', showOCRPanel.value);
}



async function runBatchAddWords(wordTexts: string[]): Promise<boolean> {
  try {
    await batchAddWords(wordTexts);
    return true;
  } catch (e) {
    debugLog('批量添加单词失败:', e);
    ElMessage.error('保存失败，请重试');
    return false;
  }
}

/**
 * 选择特定的OCR识别项
 */
async function handleSelectOCRItem(region: any) {
  let word = region.context || '';
  // let translation = region.tranContent || '';

  // 如果是新OCRSelector组件传递的单词对象
  if (region.originalText && region.translatedText) {
    word = region.originalText;
    // translation = region.translatedText;
  }

  if (word) {
    console.log('待添加的选中文本' + `[${word}]`)
    const text = `${word}`.trim();
    // 入口即单词列表：句子作为词条条目进入复习队列（收藏走句子库独立入口）
    if (await runBatchAddWords([text])) router.push('/word')
  } else {
    ElMessage.warning('单词或翻译内容为空');
  }
}

/**
 * 选择所有OCR识别项
 */
async function handleSelectAllItems(items: any[]) {
  const wordTexts: string[] = [];
  items.forEach(region => {
    const word = region.context || '';
    if (word) {
      wordTexts.push(`${word}`.trim());
    }
  });

  if (wordTexts.length > 0 && await runBatchAddWords(wordTexts)) {
    ElMessage.success(`已保存全部 ${wordTexts.length} 项到单词列表`);
    // 添加后跳转到单词列表
    router.push('/word')
  }
}

/**
 * 关闭OCR面板
 */
function closeOCRPanel() {
  showOCRPanel.value = false;
  ocrResults.value = [];
  ocrPanelLoading.value = false;
}

// ==================== 核心：静默获取选中文本 ====================
async function getSelectedTextFromSystem(): Promise<string> {
  const utoolsApi = (window as any).utools;
  if (!utoolsApi) return '';

  // 先备份当前剪贴板文本，模拟复制失败或读不到新选中文本时可恢复，避免误清空用户剪贴板
  let backupText = '';
  try {
    backupText = await navigator.clipboard.readText();
  } catch (e) {
    debugLog('备份剪贴板内容失败:', e);
  }

  // 清空剪贴板，避免读到旧内容
  utoolsApi.copyText?.('')

  const b = hideMainWindow();
  if (!b) {
    if (utoolsApi.getWindowType?.() === "detach") {
      return '使用此功能，请先关闭自动分离';
    }
  }
  debugLog('开始静默获取选中文本...')
  // 焦点恢复到原窗口的等待（原 300ms，过长会拖慢划词链路体感）
  await new Promise(r => setTimeout(r, 150));

  // 获取当前平台
  const isMac = utoolsApi.isMacOS?.();

  // 根据平台选择修饰键
  const modifier = isMac ? "command" : "ctrl";
  utoolsApi.simulateKeyboardTap?.("c", modifier);
  debugLog('发送快捷键...')

  showMainWindow();
  debugLog('显示主界面...')

  // 轮询剪贴板：复制完成立即返回，不再死等固定 500ms；超时兜底（慢速应用最大等待 700ms）
  let selectedText = '';
  const pollStart = Date.now();
  while (Date.now() - pollStart < 700) {
    await new Promise(r => setTimeout(r, 60));
    try {
      selectedText = await navigator.clipboard.readText();
    } catch (e) {
      debugLog('读取剪贴板失败:', e);
      break;
    }
    // 读到与备份不同的新内容即为复制成功
    if (selectedText && selectedText !== backupText) break;
  }

  debugLog('[划段添加] 获取到的文本:', selectedText);

  // 只在完全读不到内容时才算失败：恢复原剪贴板并提示。
  // 读到与备份一致的非空内容视为成功——进入前已清空剪贴板，之后还能读到备份原文，
  // 说明 ctrl+c 确实重新写入了相同文本（用户重复选中同一段落），不是复制失败
  if (!selectedText) {
    if (backupText) {
      try {
        utoolsApi.copyText?.(backupText);
        debugLog('已恢复原剪贴板内容');
      } catch (e) {
        debugLog('恢复剪贴板内容失败:', e);
      }
    }
    ElMessage.warning('未获取到选中的文本，请先选中内容再试');
  }

  return selectedText;
}


/**
 * 校验剪切板中的单词并添加
 * @param text
 */
function checkShearBoardAddWork(text: string) {
  if (text === '使用此功能，请先关闭自动分离') {
    ElMessage.error('使用此功能，请先关闭自动分离');
    return;
  }
  // 去除首尾空格并替换多个连续空格为单个空格
  let processedText = text.trim().replace(/\s{2,}/g, ' ');

  // 检查是否为空字符串或仅包含空格
  if (!processedText) {
    ElMessage.error('请选中有效文本');
    return;
  }

  // 长段落/句子/多词按「划段」模式展示选择面板：可挑词入词库，也可整句入词库或收藏句子
  const profile = getActiveProfile();
  const isLongText = processedText.length > 25 || processedText.includes('\n') || processedText.split(/\s+/).filter(Boolean).length > 3;
  if (isLongText) {
    displayTextSelection(processedText);
    return;
  }

  // 字符集按当前词库语言判定（支持日/俄/西/法）；中文直接放行，由 addWord 按「中文加词方向」反查处理
  if (!containsChinese(processedText) && !isWordText(processedText, profile)) {
    ElMessage.error('请选中单个有效单词或短语');
    return;
  }
  // 验证处理后的文本是否符合要求
  void addWord(processedText).then(result => {
    if (!result.success) ElMessage.warning(result.message || '添加失败');
  }).catch(e => {
    debugLog('添加单词失败:', e);
    ElMessage.error('保存失败，请重试');
  });

  // 添加单词后跳转到单词列表
  router.push('/word')
}

/**
 * 显示文本选择面板供用户选择和保存单词
 */
async function displayTextSelection(text: string) {
  console.log('[划段添加] 准备显示面板，文本内容:', text);
  // 存储文本内容
  textContent.value = text;

  // 显示选择面板
  showTextPanel.value = true;
  console.log('[划段添加] 面板已显示');
}

/**
 * 选择特定的文本项
 */
async function handleSelectTextItems(words: string[], platform?: string) {
  if (words && words.length > 0) {
    console.log('待添加的选中单词', words);
    if (await runBatchAddWords(words)) {
      // 添加单词后跳转到单词列表
      router.push('/word')
    }
  } else {
    ElMessage.warning('单词内容为空');
  }
}

/** 划段面板：整段原文加入单词列表（句子作为词条参与复习） */
async function handleAddWholeText(text: string) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  closeTextPanel();
  const res = await addWord(trimmed);
  if (res.success) {
    ElMessage.success(res.message || '已加入单词列表');
  } else if (res.message && res.message.includes('已存在')) {
    ElMessage.info('单词已存在');
  } else {
    ElMessage.error(res.message || '加入失败');
  }
  router.push('/word');
}

/** 划段面板：整段原文收藏到句子库（保留原句、不翻译） */
async function handleCollectWholeText(text: string) {
  const trimmed = (text || '').trim();
  if (!trimmed) return;
  closeTextPanel();
  const res = await useSentencesStore().add(trimmed);
  if (res.success) {
    ElMessage.success('已收藏到句子库');
  } else {
    ElMessage.warning(res.message || '收藏失败');
  }
}

/**
 * 关闭文本选择面板
 */
function closeTextPanel() {
  showTextPanel.value = false;
  textContent.value = '';
}

onMounted(async () => {

  // 恢复界面字号档位（缩放比例已持久化在 localStorage）
  useUiStore().applyUiZoom(useUiStore().uiZoom);

  // 首页刷新时触发   自动更新需要复习的单词
  // 延迟调用，避免初始化时重复计算
  setTimeout(() => {
    void Promise.resolve(updateReview()).catch(e => console.error('[启动] 更新复习状态失败:', e));
  }, 100);

  // 预加载本地 OCR Worker（如果用户选择了本地 OCR）
  const wordsStore = useWordsStore();
  const router = useRouter();
  if (wordsStore.currentOcrPlatform === 'local') {
    setTimeout(() => {
      void preloadWorker(); // 内部已记录失败日志，fire-and-forget
    }, 1000); // 延迟1秒，让页面先完成渲染
  }

  // 非 uTools 环境：从数据库加载设置
  if (!checkIsUtools()) {
    try {
      const setDb = getSetDb();
      if (setDb) {
        applyPersistedStatsPrefs({ excluded: setDb.statsExcluded, attribution: setDb.attributionEnabled });
        wordsStore.pluginStatus = setDb.pluginStatus;
        wordsStore.shortcutEnabled = setDb.shortcutEnabled;
        if (setDb.translationPlatform) wordsStore.currentTranslationPlatform = setDb.translationPlatform;
        if (setDb.ocrPlatform) wordsStore.currentOcrPlatform = setDb.ocrPlatform;
        if (setDb.memoryFirmness) wordsStore.memoryFirmness = setDb.memoryFirmness;
        if (setDb.mainWindowOpacity !== undefined) wordsStore.mainWindowOpacity = setDb.mainWindowOpacity;
        if (setDb.autoSpeak !== undefined) wordsStore.autoSpeak = setDb.autoSpeak;
        if (setDb.eyeCare !== undefined) wordsStore.eyeCare = setDb.eyeCare;
      }
    } catch (e) {
      console.error('加载用户设置失败:', e);
    }
  }

  // 启动时应用护眼模式（亮色主题基底是否为浅绿）
  wordsStore.applyEyeCareTheme(wordsStore.eyeCare);

  // 启动时应用保存的窗口透明度
  if (wordsStore.mainWindowOpacity < 1.0) {
    if (window.electronAPI) {
      // Electron：原生窗口 API
      setTimeout(() => {
        window.electronAPI!.setWindowOpacity(wordsStore.mainWindowOpacity).catch((e: Error) => {
          console.error('应用窗口透明度失败:', e);
        });
      }, 200);
    } else if (!checkIsUtools()) {
      // Web：rgba 背景方案
      setTimeout(() => {
        wordsStore.applyRgbaOpacity(wordsStore.mainWindowOpacity);
      }, 100);
    }
    // uTools 端：主窗口 iframe 背景不受内部 CSS 控制，跳过 applyRgbaOpacity
  }

});


/**
 * 处理复习单词的插件入口
 */
function handlePluginReview() {
  // 显示主窗口
  showMainWindow()

  // 清空最后访问的页面，强制进入单词列表
  wordsStore.setLastVisitedPage('')

  // 跳转到单词列表主界面
  router.push('/word')
}

/**
 * 处理数字记忆的插件入口
 */
function handlePluginNumMemory(action?: any) {
  // 显示主窗口
  showMainWindow()
  // 超级面板选中文本进入：若文本含数字则直达条目页并预填添加对话框，否则只打开主页
  const raw = typeof action?.payload === 'string' ? action.payload : ''
  const numbers = raw.replace(/[^\d.]/g, '')
  if (/\d/.test(numbers)) {
    router.push({ path: '/number-memory/entries', query: { numbers } })
  } else {
    router.push('/number-memory')
  }
}

/**
 * 简单路由类关键词入口（记忆宫殿 / 知识库）：显示主窗口 + 跳页
 */
function handlePluginSimpleRoute(path: string) {
  showMainWindow()
  wordsStore.setLastVisitedPage('')
  router.push(path)
}

/**
 * 处理默认进入插件的情况（恢复上次状态或进入单词列表）
 */
function handlePluginDefaultEnter() {
  // 显示主窗口
  showMainWindow()

  // 检查是否有保存的最后访问页面
  const lastPage = wordsStore.lastVisitedPage

  // 如果是需要保持状态的特殊页面，则恢复
  if (lastPage && ['/dictation', '/number-memory', '/number-memory/training', '/memory', '/letter-memory'].includes(lastPage)) {
    console.log('[App] 恢复到上次页面:', lastPage)
    router.push(lastPage)
  } else {
    // 默认进入单词列表
    router.push('/word')
  }
}

/**
 * 处理快速翻译的插件入口
 */
function handlePluginTranslate(action: any) {
  // 显示主窗口
  showMainWindow()
  // over 匹配（超级面板选中内容）时 payload 才是选中文本；主输入框键入触发时
  // payload 是输入框原文（含关键词本身，如「翻译」），剥掉关键词前缀取剩余部分
  let text = ''
  if (action.type === 'over') {
    text = typeof action.payload === 'string' ? action.payload.trim() : ''
  } else if (typeof action.payload === 'string') {
    text = action.payload.replace(/^翻译[，,.\s:：]*/, '').trim()
  }
  if (text) {
    router.push({
      path: '/translate',
      query: { text }
    })
  } else {
    router.push('/translate')
  }
}

/**
 * 处理文本记忆的插件入口
 */
function handlePluginTextMemory() {
  // 显示主窗口
  showMainWindow()
  // 跳转到文本记忆页面（带 entry 标记：公共头返回时回到文本记忆首页而非单词页）
  router.push({ path: '/text-memory', query: { entry: 'textMemory' } })
}

/**
 * 处理快捷键记忆的插件入口
 */
function handlePluginShortcutMemory() {
  // 显示主窗口
  showMainWindow()

  // 清空最后访问的页面，强制进入快捷键记忆页
  wordsStore.setLastVisitedPage('')

  // 跳转到快捷键记忆页面
  router.push('/shortcut-memory')
}

/**
 * 处理专注模式的插件入口
 */
function handlePluginFocusMode() {
  // 先进入单词页，Word.vue 会根据 query 自动打开专注窗口
  showMainWindow()
  wordsStore.setLastVisitedPage('')
  router.push({
    path: '/word',
    query: { openFocus: '1' }
  })
}

/**
 * 更新需要复习的单词
 */
function updateReview() {
  // 调用 listWords 会自动触发 upReview 计算待复习单词
  return wordsStore.listWords();
}

</script>


<style lang="scss">
//scoped
@use '@/assets/styles/reset.scss';
//@use '@/assets/styles/common.scss';

// 主题样式 - 必须最先引入以定义 CSS 变量
@use '@/assets/styles/theme.scss';

@use '@/assets/styles/card-item.scss';
@use '@/assets/styles/index.scss';
@use '@/assets/styles/letter.scss';
@use '@/assets/styles/list-item.scss';
@use '@/assets/icons/iconfont.css';
@use '@/assets/styles/iconfont1.scss';

/* ===== Electron 无边框窗口 =====
   系统标题栏已隐藏（titleBarStyle: hidden），顶部头部兼作拖拽区域；
   右侧留 150px 给原生最小化/最大化/关闭按钮（titleBarOverlay） */
html.electron-shell .app-header {
  -webkit-app-region: drag;
  padding-right: 150px;
  min-height: 36px;
  box-sizing: border-box;
}

html.electron-shell .app-header .header-action,
html.electron-shell .app-header .streak,
html.electron-shell .app-header .back,
html.electron-shell .app-header .sync-dot {
  -webkit-app-region: no-drag;
}

</style>
