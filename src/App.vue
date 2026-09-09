<template>
  <RouterView/>
  <!-- 引入OCR选择器组件 -->
  <OCRSelector
      :visible="showOCRPanel"
      :ocr-results="ocrResults"
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
  />

  <!-- 调试面板 -->
  <DebugPanel
      :visible="showDebugPanel"
      @open="showDebugPanel = true"
      @close="showDebugPanel = false"
      ref="debugPanelRef"
  />
</template>


<script setup lang="ts">
import {RouterView, useRouter} from 'vue-router'

import {onMounted, onUnmounted, ref} from 'vue';
import {useWordsStore} from "@/stores/words.ts";
// import {storeToRefs} from "pinia";
import {DEFAULT_INTERVALS, USAGE_LIMITS} from "@/constants";
import {addWord, addTextAuto, batchAddWords} from "@/utils/str-util.ts";
import {ElMessage} from "element-plus";
import {
  ocrTranslate,
  ocrTranslateAli,
  ocrTranslateBaidu,
  ocrTranslateLocal,
  ocrTranslateMultiPlatform,
  ocrTranslateTencent,
  preloadWorker,
  type OcrResult
} from "@/utils/pic-translate.ts";
// import path from "node:path";
import picData from '../testdata/picdata.json';
import baidupicData from '../testdata/baidupicdata.json';
import picaliData from '../testdata/picalidata.json';
import picTencentData from '../testdata/picTencentdata.json';
import OCRSelector from '@/views/Word/components/OCRSelector.vue';
import TextSelector from '@/views/Word/components/TextSelector.vue';
import DebugPanel from '@/components/DebugPanel.vue';
// import {AppInfo} from "@/config.ts";
import {getSetDb} from "@/utils/user-set-db-util.ts";
import {getOcrApiKey} from "@/utils/get-api-key.ts";
import {toEngineLang} from "@/utils/translation-lang-map.ts";
import {getCurrentUsageCount, hasCustomApiKey, incrementUsageCounter, isOverDailyLimit} from "@/utils/usage-counter.ts";
import {getNotificationAdapter} from "@/adapters/notification.ts";
import {RETIRED_MODEL_NAMES} from "@/config.ts";
import type {OcrPlatform, TranslationPlatform} from "@/types/words";
import {isUtools as checkIsUtools} from "@/adapters/platform";
import { getActiveProfile, getActiveLanguage, isWordText } from '@/utils/language';
import { isSentenceLike } from '@/utils/text-utils';

const wordsStore = useWordsStore();
const router = useRouter();

// import {fileToBase64, ocrTranslate, translateImage} from '@/utils/pic-translate.ts'

// const preview = ref<string>('')

// 添加OCR结果相关的响应式变量
const showOCRPanel = ref<boolean>(false);
const ocrResults = ref<any[]>([]);

// 添加文本选择相关的响应式变量
const showTextPanel = ref<boolean>(false);
const textContent = ref<string>('');

// 添加调试面板相关的响应式变量
const showDebugPanel = ref<boolean>(false);
const debugPanelRef = ref<InstanceType<typeof DebugPanel> | null>(null);

// 会话内复习提醒去重：每次插件进程只提醒一次
let reviewReminderNotified = false;

;(window as any).utools?.onPluginEnter?.(async (action: any) => {
  // 先同步 设置
  let setDb = getSetDb();

  // 同步插件状态和快捷键设置
  if (setDb) {
    wordsStore.pluginStatus = setDb.pluginStatus;
    wordsStore.shortcutEnabled = setDb.shortcutEnabled;
    wordsStore.currentTranslationPlatform = setDb.translationPlatform;
    wordsStore.currentOcrPlatform = setDb.ocrPlatform;
    // 同步记忆牢固度设置
    if (setDb.memoryFirmness) {
      wordsStore.memoryFirmness = setDb.memoryFirmness;
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

    // 同步自动发音设置
    if (setDb.autoSpeak !== undefined) {
      wordsStore.autoSpeak = setDb.autoSpeak;
    }

    // 安全地同步API密钥，提供默认值以防undefined
    if (setDb.keys) {
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

    if (setDb.ocrKeys) {
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
  // 延迟调用，避免初始化时重复计算
  setTimeout(async () => {
    await updateReview();
    // 到期复习提醒：仅 uTools 平台，有待复习内容时发系统通知；每次插件进程只提醒一次
    try {
      if (checkIsUtools() && !reviewReminderNotified && wordsStore.forgetCount > 0) {
        reviewReminderNotified = true;
        getNotificationAdapter().show('慢记复习提醒', `今日还有 ${wordsStore.forgetCount} 个单词/句子待复习`);
      }
    } catch (e) {
      console.error('[复习提醒] 发送通知失败:', e);
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

  console.log("action对象", JSON.stringify(action))
  /*  if (action.code === 'snap') {
      console.log('进来了')
      window.services.snap()
      console.log('走了--')
    }*/


  if (action.code === 'over') {

    // 把单词翻译了，添加到 列表中
    // console.log('==================', action)

    // 先显示主窗口，确保用户能看到添加结果
    if (isUTools()) (window as any).utools?.showMainWindow?.()

    const result = await addWord(action.payload);
    if (!result.success) {
      ElMessage.warning(result.message);
    }

    // 添加单词后跳转到单词列表（避免停留在数字记忆或记忆测试页面）
    router.push('/word')

  }


  if (action.code === 'huaci' && action.from === 'hotkey') {
    // action.type =='over'
    // console.log('我是快捷键进来的')
    const selectedText = await navigator.clipboard.readText();
    // 显示文本选择面板
    await displayTextSelection(selectedText);
  }

  if (action.code === 'huaci' && action.from == 'main') {
    // const text = await window.services.getSelectedTextFromSystem();
    //       checkShearBoardAddWork(text);

    getSelectedTextFromSystem().then(text => {
          checkShearBoardAddWork(text);
        }
    );
  }

  if (action.code === 'huaduan' && action.from === 'hotkey') {
    console.log('[划段添加] 通过快捷键触发');
    // 给系统一点时间来完成复制操作
    await new Promise(r => setTimeout(r, 200));
    const selectedText = await navigator.clipboard.readText();
    console.log('[划段添加] 快捷键方式获取文本:', selectedText);
    // 显示文本选择面板
    await displayTextSelection(selectedText);
  }

  if (action.code === 'huaduan' && action.from == 'main') {
    console.log('[划段添加] 通过主界面触发');
    getSelectedTextFromSystem().then(async (text) => {
      console.log('[划段添加] 获取到文本:', text);
      if (text === '使用此功能，请先关闭自动分离') {
        ElMessage.error('使用此功能，请先关闭自动分离');
        return;
      }
      // 显示文本选择面板
      await displayTextSelection(text);
    }).catch(error => {
      console.error('[划段添加] 获取文本失败:', error);
      ElMessage.error('获取选中文本失败，请重试');
    });
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
        result = await ocrExistingImage(base64);
      } else {
        // 这里只应该返回  文本  具体添加的时候，还会单独翻译，这两个不在一个模块，不相互影响
        result = await ocrTranslateMultiPlatform();
      }


      // 处理错误情况
      if (result.errorCode !== '0') {
        console.error(`[截图添加] 识别失败，errorCode=${result.errorCode}，原始返回：${JSON.stringify(result)}`);

        // 本地OCR错误处理
        if (result.errorCode === 'LOCAL_OCR_NO_TEXT') {
          ElMessage.warning('本地OCR未能识别到文字，请尝试使用云端OCR');
          return;
        }
        if (result.errorCode === 'LOCAL_OCR_FAILED') {
          console.error('[截图添加] 本地OCR失败详情:', result.errorMessage);
          ElMessage.error('本地 OCR 识别失败，可在设置中切换云端 OCR 引擎');
          return;
        }

        // 其他错误，也尝试显示结果（可能部分成功）
        if (!result.resRegions || result.resRegions.length === 0) {
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
        ElMessage.warning('OCR识别结果为空，请检查图片内容');
        return;
      }
    } catch (err: any) {
      console.error('[截图添加] 捕获到错误:', err);
      // 发生错误或取消时，显示主窗口让用户可以继续操作
      if (isUTools()) (window as any).utools?.showMainWindow?.();
      // 检查是否是使用次数超限的错误
      if (err.message && err.message.includes('每日免费')) {
        ElMessage.error(err.message);
      } else if (err.message && err.message.includes('截图取消')) {
        // 用户取消，静默处理
      } else {
        // 使用 ElMessage 替代 alert，在 uTools 环境中更可靠
        ElMessage.error(err.message || '截图识别失败，请检查网络连接或OCR配置');
      }
    }
  }
  // }


  if (action.code === 'review') {
    handlePluginReview()
  }

  if (action.code === 'jycs') {
    handlePluginMemoryTest()
  }

  if (action.code === 'numMemory') {
    handlePluginNumMemory()
  }

  // 快速翻译 - 通过 fy/翻译/fanyi 关键字进入
  if (action.code === 'translate') {
    handlePluginTranslate(action)
  }

  // 快捷键记忆 - 通过 快捷键记忆/kjj 关键字进入
  if (action.code === 'shortcutMemory') {
    handlePluginShortcutMemory()
  }

  // 专注模式 - 通过 专注模式/focus 关键字进入
  if (action.code === 'focusMode') {
    handlePluginFocusMode()
  }

  // 其他情况（直接点击插件图标）- 尝试恢复上次状态
  // 排除添加单词相关操作，这些操作已在上面处理并跳转到单词列表
  const addWordActions = ['over', 'huaci', 'huaduan', 'jietu', 'paste', 'selection']
  if (!['review', 'jycs', 'numMemory', 'translate', 'shortcutMemory', 'focusMode', 'textMemory', ...addWordActions].includes(action.code)) {
    handlePluginDefaultEnter()
  }
  // 文本记忆 - 通过 文本记忆/诗词记忆 关键字进入
  if (action.code === 'textMemory') {
    handlePluginTextMemory()
  }


})

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
 * 写入日志到文件（用于打包后调试）
 */
function logToFile(message: string) {
  try {
    if (isUTools()) {
      const utoolsApi = (window as any).utools;
      const fs = (window as any).require?.('fs');
      const path = (window as any).require?.('path');
      if (fs && path && utoolsApi?.getPath) {
        const logPath = path.join(utoolsApi.getPath('temp'), 'slowlyrecord-ocr.log');
        const timestamp = new Date().toISOString();
        fs.appendFileSync(logPath, `[${timestamp}] ${message}\n`);
      }
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

  // 临时文件路径：通过 preload 暴露的 Node fs 读取后转 base64
  try {
    const services = (window as any).services;
    if (services?.fs && services.fs.existsSync?.(trimmed)) {
      const data = services.fs.readFileSync(trimmed);
      const bytes: Uint8Array = data instanceof Uint8Array
        ? data
        : new Uint8Array(data?.buffer || data);
      let binary = '';
      for (let i = 0; i < bytes.length; i++) {
        binary += String.fromCharCode(bytes[i]);
      }
      return btoa(binary);
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
  const ocrPlatform = wordsStore.currentOcrPlatform || 'tencent';

  // 与 ocrTranslateMultiPlatform 保持一致的每日免费次数限制（本地 OCR 不记次数）
  if (ocrPlatform !== 'local' && !hasCustomApiKey(ocrPlatform)) {
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
  if (ocrPlatform === 'local') {
    return await ocrTranslateLocal(base64, wordsStore.currentTranslationPlatform || 'local');
  }
  if (ocrPlatform === 'deepseek' || ocrPlatform === 'glm') {
    // 视觉大模型 OCR 的封装在 ocrTranslateMultiPlatform 内部（会触发截图），已有图片入口暂不支持
    throw new Error('当前 OCR 引擎为视觉大模型，暂不支持直接识别已有图片，请先在设置中切换为云端 OCR 引擎');
  }
  return await ocrTranslateTencent(base64, appkey, key);
}



/**
 * 显示OCR识别结果供用户选择和保存
 */
async function displayOCRResults(resRegions: any[]) {
  console.log('[截图添加] displayOCRResults 被调用，结果数:', resRegions?.length || 0);

  // 识别成功，显示主窗口让用户查看结果
  if (isUTools()) (window as any).utools?.showMainWindow?.();
  console.log('[截图添加] 主窗口已显示');

  // 存储OCR结果
  ocrResults.value = resRegions;
  // console.log('[截图添加] ocrResults 已设置:', JSON.stringify(ocrResults.value));

  // 显示选择面板
  showOCRPanel.value = true;
  console.log('[截图添加] showOCRPanel 已设置为 true:', showOCRPanel.value);
}



/**
 * 选择特定的OCR识别项
 */
function handleSelectOCRItem(region: any) {
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
    if (isSentenceLike(text)) {
      // 句子分流进句子库
      addTextAuto(text).then(res => {
        if (res.success) {
          ElMessage.success(res.message);
          router.push('/sentences');
        } else if (res.message) {
          ElMessage.warning(res.message);
        }
      });
    } else {
      batchAddWords([text]);
      // 添加单词后跳转到单词列表
      router.push('/word')
    }
    // ElMessage.success(`已保存: ${word} - ${translation}`);
  } else {
    ElMessage.warning('单词或翻译内容为空');
  }
}

/**
 * 选择所有OCR识别项
 */
function handleSelectAllItems(items: any[]) {
  let sentenceCount = 0;
  const wordTexts: string[] = [];
  items.forEach(region => {
    const word = region.context || '';
    // const translation = region.tranContent || '';

    if (word) {
      const text = `${word}`.trim();
      if (isSentenceLike(text)) {
        // 句子分流进句子库
        sentenceCount++;
        addTextAuto(text);
      } else {
        wordTexts.push(text);
      }
    }
  });

  if (wordTexts.length > 0) {
    batchAddWords(wordTexts);
  }

  if (items.length > 0) {
    ElMessage.success(sentenceCount > 0
      ? `已保存 ${wordTexts.length} 个单词、${sentenceCount} 条句子`
      : `已保存全部 ${items.length} 个单词`);
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
}

/**
 * 校验剪切板中的单词
 * @param text
 */
function checkAddWork(text: string) {
  // 长文本若是句子，分流进句子库
  const trimmed = text.trim();
  if (trimmed && isSentenceLike(trimmed)) {
    addTextAuto(trimmed).then(res => {
      if (res.success) {
        ElMessage.success(res.message);
        router.push('/sentences');
      } else if (res.message) {
        ElMessage.warning(res.message);
      }
    });
    return;
  }
  // 5. 判断逻辑（根据你的场景调整阈值）
  const textError = (
      text.length <= 0 ||
      text.endsWith('\n') ||          // 以换行符结尾（整行复制的典型特征）
      text.length > 25                // 长度超过合理选中范围
  );
  if (textError) {
    ElMessage.error('请先用光标选中单词');
  } else {
    addWord(text).then(err => {
      ElMessage.warning(err.message)
    });
  }
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

  let b = utoolsApi.hideMainWindow?.();
  if (!b) {
    if (utoolsApi.getWindowType?.() === "detach") {
      return '使用此功能，请先关闭自动分离';
    }
  }
  debugLog('开始静默获取选中文本...')
  // 增加延迟，确保焦点恢复到原窗口
  await new Promise(r => setTimeout(r, 300));

  // 获取当前平台
  const isMac = utoolsApi.isMacOS?.();

  // 根据平台选择修饰键
  const modifier = isMac ? "command" : "ctrl";
  utoolsApi.simulateKeyboardTap?.("c", modifier);
  debugLog('发送快捷键...')

  // 增加延迟，等待系统完成复制操作
  await new Promise(resolve => setTimeout(resolve, 300));

  utoolsApi.showMainWindow?.();

  debugLog('显示主界面...')
  // 再次延迟，确保剪贴板数据已更新
  await new Promise(resolve => setTimeout(resolve, 200));

  // 读取剪贴板
  const selectedText = await navigator.clipboard.readText();

  debugLog('[划段添加] 获取到的文本:', selectedText);

  // 模拟复制失败（读不到新内容或与备份一致）时恢复原剪贴板并提示用户
  if (!selectedText || selectedText === backupText) {
    if (backupText) {
      try {
        utoolsApi.copyText?.(backupText);
        debugLog('已恢复原剪贴板内容');
      } catch (e) {
        debugLog('恢复剪贴板内容失败:', e);
      }
    }
    ElMessage.warning('未获取到新的选中文本，已恢复原有剪贴板内容');
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

  // 长文本若是句子，分流进句子库
  if (processedText && isSentenceLike(processedText)) {
    addTextAuto(processedText).then(res => {
      if (res.success) {
        ElMessage.success(res.message);
        router.push('/sentences');
      } else if (res.message) {
        ElMessage.warning(res.message);
      }
    });
    return;
  }

  // 检查是否为空字符串或仅包含空格；字符集按当前词库语言判定（支持日/俄/西/法）
  const profile = getActiveProfile();
  if (!processedText || processedText.length > 50 || !isWordText(processedText, profile)) {
    ElMessage.error('请选中单个有效单词或短语');
    return;
  }
  // 验证处理后的文本是否符合要求（非空且不超过限制）
  addWord(processedText).then(err => {
    ElMessage.warning(err.message)
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
function handleSelectTextItems(words: string[], platform?: string) {
  if (words && words.length > 0) {
    console.log('待添加的选中单词', words);
    batchAddWords(words);
    // 添加单词后跳转到单词列表
    router.push('/word')
  } else {
    ElMessage.warning('单词内容为空');
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

  // 首页刷新时触发   自动更新需要复习的单词
  // 延迟调用，避免初始化时重复计算
  setTimeout(() => {
    updateReview();
  }, 100);

  // 预加载本地 OCR Worker（如果用户选择了本地 OCR）
  const wordsStore = useWordsStore();
  const router = useRouter();
  if (wordsStore.currentOcrPlatform === 'local') {
    setTimeout(() => {
      preloadWorker();
    }, 1000); // 延迟1秒，让页面先完成渲染
  }

  // 非 uTools 环境：从数据库加载设置
  if (!checkIsUtools()) {
    try {
      const setDb = getSetDb();
      if (setDb) {
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

  // 添加调试面板快捷键 Ctrl+Shift+D
/*  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.shiftKey && e.key === 'D') {
      showDebugPanel.value = !showDebugPanel.value;
      e.preventDefault();
    }
  };
  window.addEventListener('keydown', handleKeyDown);*/

  // 清理函数
  // onUnmounted(() => {
  //   window.removeEventListener('keydown', handleKeyDown);
  // });

  // window.addEventListener('selected-text', handleSelectedText as EventListener);


  // 进入插件


  /*  const initUtoolSetting = () => {
      return new Promise((resolve) => {
        let setting = window.services.wordModel.getUtoolsSetting()
        if (!setting) {
          setting = initialUtoolState
          window.services.wordModel.setUtoolsSetting(setting)
        }
        // dispatch(setUtoolSetting(setting)) // 同步到redux
        console.log('UtoolSetting', setting)
        utoolsSettingRef.current = setting
        resolve(setting)
      })
    }*/
  /*utools.onPluginEnter((action) => {
  //用户进入插件应用
    console.log(JSON.stringify(action))
    route.value = action.code
    enterAction.value = action
    // { code, type, payload, option, from }


    // app版本
    // const currentVerson = window.services.getAppVerson()
    // 数据库版本
    // const previousVerson = window.services.wordModel.getAppVersionFromDb()

    // 添加单词
    if (action.code === 'add vocabulary') {
      // addWord(action.payload)

    }
    // 复习单词

    // if (action.code === 'review') {
    //   getWordList()
    // }
  })*/


  // 退出插件时触发
  //   window.utools.onPluginOut((isKill) => {
  //     route.value = ''
  //   }


});


/**
 * 处理复习单词的插件入口
 */
function handlePluginReview() {
  // 显示主窗口
  if (isUTools()) (window as any).utools?.showMainWindow?.()

  // 清空最后访问的页面，强制进入单词列表
  wordsStore.setLastVisitedPage('')

  // 跳转到单词列表主界面
  router.push('/word')
}

/**
 * 处理记忆力测试的插件入口
 */
function handlePluginMemoryTest() {
  // 显示主窗口
  if (isUTools()) (window as any).utools?.showMainWindow?.()

  // 跳转到记忆力测试页面
  router.push('/memory')
}

/**
 * 处理数字记忆的插件入口
 */
function handlePluginNumMemory() {
  // 显示主窗口
  if (isUTools()) (window as any).utools?.showMainWindow?.()
  // 跳转到数字记忆页面
  router.push('/number-memory')
}

/**
 * 处理默认进入插件的情况（恢复上次状态或进入单词列表）
 */
function handlePluginDefaultEnter() {
  // 显示主窗口
  if (isUTools()) (window as any).utools?.showMainWindow?.()

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
  if (isUTools()) (window as any).utools?.showMainWindow?.()
  // 跳转到快速翻译页面，如果有payload则传递文本参数
  if (action.payload) {
    router.push({
      path: '/translate',
      query: { text: action.payload }
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
  if (isUTools()) (window as any).utools?.showMainWindow?.()
  // 跳转到文本记忆页面
  router.push('/text-memory')
}

/**
 * 处理快捷键记忆的插件入口
 */
function handlePluginShortcutMemory() {
  // 显示主窗口
  if (isUTools()) (window as any).utools?.showMainWindow?.()
  // 跳转到快捷键记忆页面
  router.push('/shortcut-memory')
}

/**
 * 处理专注模式的插件入口
 */
function handlePluginFocusMode() {
  // 先进入单词页，Word.vue 会根据 query 自动打开专注窗口
  if (isUTools()) (window as any).utools?.showMainWindow?.()
  wordsStore.setLastVisitedPage('')
  router.push({
    path: '/word',
    query: { openFocus: '1' }
  })
}

/**
 * 隐藏主界面,并添加单词
 */
async function handlePluginAddWord(payload: string) {
  // const needclose = !!utoolsSettingRef.current?.closeAfterAddWord
  // 隐藏主窗口
  // if (needclose) window.utools.hideMainWindow()

  // console.log('addWord====================', action.payload)
  // 传入 scrollToWordByText 作为回调函数
  // 句子自动分流进句子库，单词/词组走批量添加
  if (isSentenceLike(payload)) {
    await addTextAuto(payload);
  } else {
    await batchAddWords([payload])
  }

//   退出插件

  // 检查快捷键是否启用
  if (wordsStore.pluginStatus) {
    if (isUTools()) (window as any).utools?.hideMainWindow?.();
  }
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

</style>
