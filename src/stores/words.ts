import {computed, type Ref, ref} from "vue";
import type {MemoryFirmnessTpye, OcrPlatform, TranslationPlatform, TranslationResult, Word} from "@/types/words";
import {defineStore} from "pinia";
// import {parse, stringify} from 'zipson'
// import { serializer } from '@/utils/jsonSerializeUtil';
import http from "@/utils/http.ts";
import {log} from "@/utils/logger.ts"
import type {AxiosResponse} from 'axios'
import CryptoJS from "crypto-js";
import {addAndUpdateDbWord, cleanDbWord, listDbWords, removeDbWordById, updateDbWordList} from "@/utils/db-util.ts";
import {
  getAllWordBanks,
  getCurrentWordBankId,
  setCurrentWordBankId,
  getWordBank,
  saveWordBank,
  type WordBank
} from "@/utils/wordbank-manager.ts";
import {APP_KEY, DB_KEY, DB_KEY_USER_SET, DEFAULT_INTERVALS, FROM, KEY, TO} from "@/constants";
import {truncate} from "lodash";
import {AppInfo} from "@/config.ts";
// import {downloadAndStoreAudio} from "@/utils/audio-util.ts";
// 导入翻译服务 abandon
import {translateWithPlatform as externalTranslateWithPlatform, translateBatchWithPlatform as externalTranslateBatchWithPlatform} from "@/utils/translation-api";
import {addAndUpdateSetDb, getSetDb} from "@/utils/user-set-db-util.ts";
import {v4 as uuidv4} from "uuid";
import type {UserSetType, FocusModeSettings} from "@/types/user-set";
import {isUtools} from "@/adapters/platform";
import {normalizeItemText, getItemKey} from "@/utils/text-utils";

// 默认专注模式设置
const defaultFocusMode: FocusModeSettings = {
    alwaysOnTop: true,
    opacity: 1.0, // 默认不透明
    edgeStickEnabled: true,
};


// 添加 API 密钥相关的响应式变量
// const userApiKeys = ref({
//     ali: {
//         // || AppInfo.ali.appkey
//         appkey: (localStorage.getItem('api_key_ali_appkey') || '').trim() ,
//         // || AppInfo.ali.key
//         key: (localStorage.getItem('api_key_ali_key') || '').trim()
//     },
//     youdao: {
//         // || AppInfo.youdao.appkey
//         appkey: (localStorage.getItem('api_key_youdao_appkey') || '').trim() ,
//         // || AppInfo.youdao.key
//         key: (localStorage.getItem('api_key_youdao_key') || '').trim()
//     },
//     baidu: {
//         // || AppInfo.baidu.appkey
//         appkey: (localStorage.getItem('api_key_baidu_appkey') || '').trim() ,
//         // || AppInfo.baidu.key
//         key: (localStorage.getItem('api_key_baidu_key') || '').trim()
//     },
//     utoolsai: {
//         appkey: (localStorage.getItem('api_key_utoolsai_appkey') || '').trim(),
//         key: (localStorage.getItem('api_key_utoolsai_key') || '').trim()
//     },
//     ollama: {
//         appkey: (localStorage.getItem('api_key_ollama_appkey') || '').trim(),
//         key: (localStorage.getItem('api_key_ollama_key') || '').trim()
//     },
//     deepseek: {
//         appkey: (localStorage.getItem('api_key_deepseek_appkey') || '').trim(),
//         key: (localStorage.getItem('api_key_deepseek_key') || '').trim()
//     },
//     qwen: {
//         appkey: (localStorage.getItem('api_key_qwen_appkey') || '').trim(),
//         key: (localStorage.getItem('api_key_qwen_key') || '').trim()
//     },
//     kimi: {
//         appkey: (localStorage.getItem('api_key_kimi_appkey') || '').trim(),
//         key: (localStorage.getItem('api_key_kimi_key') || '').trim()
//     }
// })

export const useWordsStore =
    defineStore('words',
        () => {
            const words = ref<Word[]>([])

            // 当前词库ID
            const currentWordBankId = ref<string>('')
            // 当前词库信息
            const currentWordBank = ref<WordBank | null>(null)

            // 初始化词库信息
            async function initWordBankInfo() {
                currentWordBankId.value = await getCurrentWordBankId()
                currentWordBank.value = await getWordBank(currentWordBankId.value)
            }

            const lastAddedWordText = ref('')    //记录最新添加的单词
            const lastFocusWordText = ref('')    //需光标定位单词
            const lastFocusWordIndex = ref(-1)   //需光标定位单词在过滤列表中的索引

            const currentTranslationPlatform = ref<TranslationPlatform>('glm'); // 默认使用glm翻译
            const currentOcrPlatform = ref<OcrPlatform>('local'); // 默认使用离线识图
            const memoryFirmness = ref<MemoryFirmnessTpye>('正常');
            // 用户翻译api密钥
            const userApiKeys: Ref<Record<TranslationPlatform, { appkey: string, key: string }>> = ref({
                glm: {appkey: '', key: ''},
                tencent: {appkey: '', key: ''},
                ali: {appkey: '', key: ''},
                youdao: {appkey: '', key: ''},
                baidu: {appkey: '', key: ''},
                utoolsai: {appkey: '', key: ''},
                ollama: {appkey: '', key: ''},
                deepseek: {appkey: '', key: ''},
                qwen: {appkey: '', key: ''},
                kimi: {appkey: '', key: ''},
                local: {appkey: '', key: ''},
            })
            const userOcrApiKeys: Ref<Record<OcrPlatform, { appkey: string, key: string }>> = ref({
                tencent: {appkey: '', key: ''},
                ali: {appkey: '', key: ''},
                youdao: {appkey: '', key: ''},
                baidu: {appkey: '', key: ''},
                local: {appkey: '', key: ''},
            })
            // 添加单词后自动退出插件
            const pluginStatus = ref(false);
            // 默认关闭快捷键
            const shortcutEnabled = ref(false);
            // 主窗口透明度 (0.3 - 1.0)，仅 Electron 有效
            const mainWindowOpacity = ref(1.0);
            // 选中单词时自动发音
            const autoSpeak = ref(false);
            // 专注模式设置
            const focusMode = ref<FocusModeSettings>({...defaultFocusMode});

            // 当前操作释义的单词
            const hiddenExplain = ref('');
            // const hiddenExplain = ref('');

            // 最后访问的页面路径（用于插件重新打开时恢复状态）
            const lastVisitedPage = ref<string>('');

            // 总单词数
            const count = computed(() => {
                return words.value.length;
            });

            /**
             * 计算属性,
             * 待复习的单词数  (显示的数)
             */
            const forgetCount = computed(() => {
                return words.value.filter((word: Word) => word.isReview).length
            })

            /**
             *计算属性,统计已复习的单词数 (不需要复习的 - 已记住数)
             */
            const reviewCount = computed(() => {
                return words.value.filter((word: Word) => !word.isReview && !word.remember).length
            })
            /**
             * 永久记住的单词数
             */
            const rememberCount = computed(() => {
                return words.value.filter((word: Word) => word.remember).length
            })

            // actions 用普通函数
            function setLastAddedWordText(text: string) {
                console.log('更新定位单词', text)
                lastAddedWordText.value = text
            }

            // 设置添加单词后插件状态
            function setClosePlugin(status: boolean) {
                console.log('更新插件状态', status)
                pluginStatus.value = status

                let userSet = getSetDb()
                if (userSet) {
                    userSet.pluginStatus = status
                } else {
                    userSet = initUserSet();
                    userSet.pluginStatus = status;
                }
                addAndUpdateSetDb(userSet);
            }


            /**
             * 设置当前翻译平台
             */
            function setTranslationPlatform(platform: TranslationPlatform) {
                currentTranslationPlatform.value = platform;

                let userSet = getSetDb()
                if (userSet) {
                    userSet.translationPlatform = platform
                } else {
                    userSet = initUserSet();
                    userSet.translationPlatform = platform;
                }
                addAndUpdateSetDb(userSet);
            }

            /**
             * 获取当前orc识别平台
             */
            function setOcrPlatform(platform: OcrPlatform) {
                log.i('更新当前orc识别平台', platform)
                currentOcrPlatform.value = platform;

                let userSet = getSetDb()
                if (userSet) {
                    userSet.ocrPlatform = platform
                } else {
                    userSet = initUserSet();
                    userSet.ocrPlatform = platform;
                }
                addAndUpdateSetDb(userSet);
            }

            /**
             * 设置记忆牢固度
             */
            function setMemoryFirmness(firmness: MemoryFirmnessTpye) {
                log.i('更新记忆牢固度', firmness)
                memoryFirmness.value = firmness;

                let userSet = getSetDb()
                if (userSet) {
                    userSet.memoryFirmness = firmness
                } else {
                    userSet = initUserSet();
                    userSet.memoryFirmness = firmness;
                }
                addAndUpdateSetDb(userSet);
            }

            function setUserApiKeys(userKeys: Record<TranslationPlatform, { appkey: string, key: string }>) {
                userApiKeys.value = userKeys;
            }


            /*
            * 初始化设置
            * */
            function initUserSet() {
                let userSet: UserSetType = {
                    "_id": DB_KEY_USER_SET + uuidv4(), // 假设_id为必填项
                    "pluginStatus": false,
                    "shortcutEnabled": false,
                    "translationPlatform": 'tencent',
                    "ocrPlatform": 'tencent',
                    "memoryFirmness": '正常',
                    "keys": {},
                    "ocrKeys": {},
                    "focusMode": {...defaultFocusMode},
                    "mainWindowOpacity": 1.0,
                    "autoSpeak": false,
                };
                return userSet;
            }

            /**
             * 设置专注模式
             */
            function setFocusMode(settings: Partial<FocusModeSettings>) {
                log.i('更新专注模式设置', settings);
                focusMode.value = { ...focusMode.value, ...settings };

                let userSet = getSetDb();
                if (userSet) {
                    userSet.focusMode = focusMode.value;
                } else {
                    userSet = initUserSet();
                    userSet.focusMode = focusMode.value;
                }
                addAndUpdateSetDb(userSet);
            }

            /**
             * 设置最后访问的页面路径
             */
            function setLastVisitedPage(path: string) {
                lastVisitedPage.value = path;
            }

            // 设置快捷键开关
            function setShortcutEnabled(enabled: boolean) {
                shortcutEnabled.value = enabled;

                let userSet = getSetDb()
                if (userSet) {
                    userSet.shortcutEnabled = enabled
                } else {
                    userSet = initUserSet();
                    userSet.shortcutEnabled = enabled;
                }
                addAndUpdateSetDb(userSet);
            }

            /**
             * 设置主窗口透明度
             * - Electron：原生窗口 API（窗口级透明）
             * - Web：rgba 背景透明（body/#app 透明，内容可读）
             * - uTools：iframe 背景无法通过 CSS 修改，仅保存值
             * @param opacity 透明度值 (0.3 - 1.0)
             */
            async function setMainWindowOpacity(opacity: number) {
                const validOpacity = Math.max(0.3, Math.min(1.0, opacity));
                mainWindowOpacity.value = validOpacity;

                // Electron 环境：调用主进程设置原生窗口透明度
                if (typeof window !== 'undefined' && window.electronAPI) {
                    console.log('[透明度] 调用 electronAPI.setWindowOpacity:', validOpacity);
                    try {
                        const result = await window.electronAPI.setWindowOpacity(validOpacity);
                        console.log('[透明度] Electron 窗口透明度已设置为:', result);
                    } catch (e: any) {
                        console.error('[透明度] 设置窗口透明度失败:', e);
                    }
                } else if (typeof document !== 'undefined' && !isUtools()) {
                    // Web 环境：rgba 背景方案
                    applyRgbaOpacity(validOpacity);
                }
                // uTools 端：主窗口 iframe 背景不受内部 CSS 控制，跳过 applyRgbaOpacity

                // 持久化保存
                try {
                    let userSet = getSetDb();
                    if (userSet) {
                        userSet.mainWindowOpacity = validOpacity;
                    } else {
                        userSet = initUserSet();
                        userSet.mainWindowOpacity = validOpacity;
                    }
                    const result = await addAndUpdateSetDb(userSet);
                    if (result.ok) {
                        console.log('[透明度] 保存设置成功:', validOpacity);
                    } else {
                        console.error('[透明度] 保存设置失败:', result.message);
                    }
                } catch (e) {
                    console.error('[透明度] 保存设置到数据库失败:', e);
                }
            }

            /**
             * 通过 rgba 背景实现透明效果（uTools/Web 端）
             * html/body 设为 transparent，#app 用 rgba 保留内容可读性
             */
            function applyRgbaOpacity(opacity: number) {
                try {
                    const validOpacity = Math.max(0.3, Math.min(1.0, parseFloat(String(opacity))));

                    // html/body 背景透明，让 uTools 容器背景透上来
                    // 使用 !important 确保覆盖 reset.scss 等外部样式
                    document.documentElement.style.setProperty('background', 'transparent', 'important');
                    document.body.style.setProperty('background', 'transparent', 'important');
                    document.body.style.setProperty('background-color', 'transparent', 'important');

                    // 检测暗色主题（uTools 可能加到 body 或 html 上）
                    const isDark = document.body.classList.contains('utools-dark') ||
                        document.documentElement.classList.contains('utools-dark') ||
                        document.documentElement.classList.contains('dark');

                    // #app 使用 rgba 背景，内容保持清晰
                    const appEl = document.getElementById('app');
                    if (appEl) {
                        if (validOpacity >= 1.0) {
                            // 完全不透明时恢复默认背景
                            appEl.style.removeProperty('background');
                            appEl.style.removeProperty('background-color');
                        } else {
                            const r = isDark ? 30 : 255;
                            const g = isDark ? 30 : 255;
                            const b = isDark ? 30 : 255;
                            const bg = `rgba(${r}, ${g}, ${b}, ${validOpacity})`;
                            appEl.style.setProperty('background', bg, 'important');
                            appEl.style.setProperty('background-color', bg, 'important');
                        }
                    }
                    console.log('[透明度] rgba 背景方案已应用:', validOpacity, '暗色:', isDark, 'app存在:', !!appEl);
                } catch (e) {
                    console.error('[透明度] rgba 背景应用失败:', e);
                }
            }

            /**
             * 设置自动发音开关
             */
            function setAutoSpeak(enabled: boolean) {
                autoSpeak.value = enabled;

                let userSet = getSetDb()
                if (userSet) {
                    userSet.autoSpeak = enabled;
                } else {
                    userSet = initUserSet();
                    userSet.autoSpeak = enabled;
                }
                addAndUpdateSetDb(userSet);
            }

            /**
             * 设置API密钥
             */
            function setApiKey(provider: TranslationPlatform, appkey: string, key: string) {
                userApiKeys.value[provider].appkey = appkey;
                userApiKeys.value[provider].key = key;

                let userSet = getSetDb()
                if (userSet) {
                    if (!userSet.keys) {
                        userSet.keys = {};
                    }
                    userSet.keys[provider] ??= {appkey: '', key: ''};
                    userSet.keys[provider].appkey = userApiKeys.value[provider].appkey;
                    userSet.keys[provider].key = userApiKeys.value[provider].key;
                } else {
                    userSet = initUserSet();
                    userSet.keys = userApiKeys.value;
                }
                addAndUpdateSetDb(userSet);
                // 保存到本地存储
            }

            function setOcrApiKey(provider: OcrPlatform, appkey: string, key: string) {
                log.i('设置OCR密钥', provider, appkey, key)
                userOcrApiKeys.value[provider].appkey = appkey;
                userOcrApiKeys.value[provider].key = key;

                let userSet = getSetDb()
                if (userSet) {
                    log.i('数据库不为空', userSet)
                    if (!userSet.ocrKeys) {
                        userSet.ocrKeys = {};
                    }
                    userSet.ocrKeys[provider] ??= {appkey: '', key: ''};
                    userSet.ocrKeys[provider].appkey = userOcrApiKeys.value[provider].appkey;
                    userSet.ocrKeys[provider].key = userOcrApiKeys.value[provider].key;
                    log.i('赋值后', userSet)
                } else {
                    log.i('数据库为空', userSet)
                    userSet = initUserSet();
                    userSet.ocrKeys = userOcrApiKeys.value;
                    log.i('初次赋值后', userSet)
                }
                log.i('保存用户设置', userSet)
                addAndUpdateSetDb(userSet);
                // 保存到本地存储
            }

            /**
             * 获取API密钥
             */
            function getApiKey(provider: TranslationPlatform) {
                return userApiKeys.value[provider];
            }

            function getOcrApiKey(provider: OcrPlatform) {
                return userOcrApiKeys.value[provider];
            }


            /**
             * 更新状态
             */
            function setWords(payload: Word[]) {
                words.value = payload
                log.i(payload, '更新单词');
            }

            /**
             * 切换当前词库
             */
            async function switchWordBank(bankId: string): Promise<boolean> {
                const bank = await getWordBank(bankId)
                if (!bank) return false

                currentWordBankId.value = bankId
                currentWordBank.value = bank
                setCurrentWordBankId(bankId)

                // 重新加载新词库的单词
                words.value = []
                pushWords(bank.words)
                await upReview()

                return true
            }

            /**
             *获取全部单词
             */
            async function listWords(): Promise<Word[]> {
                // 确保词库信息已初始化
                if (!currentWordBankId.value) {
                    await initWordBankInfo()
                }

                // 从当前词库获取单词
                const bank = await getWordBank(currentWordBankId.value)
                currentWordBank.value = bank

                if (bank) {
                    // 如果是默认词库且为空，尝试从旧数据库迁移数据
                    if (bank.isDefault && bank.words.length === 0) {
                        const dbWords = listDbWords();
                        if (dbWords.length > 0) {
                            console.log('检测到默认词库为空，从旧数据库迁移数据:', dbWords.length);
                            bank.words = [...dbWords]
                            await saveWordBank(bank)
                            words.value = []
                            pushWords(dbWords)
                        } else {
                            words.value = []
                            pushWords(bank.words)
                        }
                    } else {
                        words.value = []
                        pushWords(bank.words)
                    }
                }

                // 加载单词后重新计算待复习状态
                await upReview()
                return words.value
            }


            /**
             * 批量添加单词
             */
            function pushWords(payload: Word[]) {
                log.i("批量去重添加单词", payload)
                // 规范化文本：保留词组空格，只折叠多余空白
                const cleanedPayload = payload.map(w => ({ ...w, text: normalizeItemText(w.text) }))
                // 先对 payload 自身按规范化小写 key 去重，防止同一批数据大小写/空白差异重复
                const payloadMap = new Map<string, Word>();
                for (const w of cleanedPayload) {
                    payloadMap.set(getItemKey(w.text), w);
                }
                const dedupedPayload = Array.from(payloadMap.values());
                const existingKeys = new Set(words.value.map(existingWord => getItemKey(existingWord.text)));
                const uniquePayload = dedupedPayload.filter(newWord =>
                    !existingKeys.has(getItemKey(newWord.text))
                );
                words.value.push(...uniquePayload);
                log.i(payload, '批量添加去重后的单词', uniquePayload);
            }

            /**
             * 重新计算需要复习的单词
             * 只有到了复习时间的单词才显示在待复习列表中
             */
            async function upReview() {
                log.i('upReview 开始计算，单词总数:', words.value.length)

                const changedWords: Word[] = [];

                words.value.forEach((item) => {
                    // 确保 learnDate 和 ctime 是 Date 对象
                    let learnDate = item.learnDate;
                    let ctime = item.ctime;
                    if (typeof learnDate === 'string') {
                        learnDate = new Date(learnDate);
                    }
                    if (typeof ctime === 'string') {
                        ctime = new Date(ctime);
                    }

                    // 确保 level 有效
                    const level = Number(item.level) || 1;
                    const interval = DEFAULT_INTERVALS[level] || DEFAULT_INTERVALS[1];

                    const reviewTime = learnDate.getTime() + interval * 60 * 1000;
                    const now = Date.now();
                    const shouldReview = now > reviewTime;

                    // 判断单词是否是新添加的（从未被复习过）
                    // 如果 learnDate 和 ctime 相同或非常接近（5秒内），说明是新建单词，从未被复习过
                    const isNewWord = Math.abs(learnDate.getTime() - ctime.getTime()) < 5000;

                    // 到了复习时间，设为待复习
                    if (shouldReview && !item.isReview) {
                        item.isReview = true;
                        changedWords.push(item);
                        log.i('单词设为待复习:', item.text);
                    }
                    // 还没到复习时间且不是新添加的，取消待复习
                    // 新添加的单词（isNewWord=true）不应该被自动取消待复习状态
                    else if (!shouldReview && item.isReview && !isNewWord && (now - learnDate.getTime() > 60000)) {
                        item.isReview = false;
                        changedWords.push(item);
                        log.i('单词取消待复习（时间未到）:', item.text, '下次复习:', new Date(reviewTime).toLocaleString());
                    }
                });

                if (changedWords.length === 0) {
                    return;
                }

                const changedMap = new Map(changedWords.map(w => [w._id, w]));

                try {
                    let bank = currentWordBank.value && currentWordBank.value.id === currentWordBankId.value
                        ? currentWordBank.value
                        : await getWordBank(currentWordBankId.value);

                    if (bank) {
                        bank.words = bank.words.map(w => {
                            const changed = changedMap.get(w._id);
                            return changed ? {...w, ...changed} : w;
                        });
                        await saveWordBank(bank);
                        currentWordBank.value = bank;
                    }
                } catch (error) {
                    log.e('保存复习状态到当前词库失败', error);
                }

                await Promise.allSettled(changedWords.map(word => addAndUpdateDbWord(word)));
            }


            /**
             *查找单词
             */
            function findWord(wordText: string): Word | undefined {
                const cleanedText = normalizeItemText(wordText);
                const word = words.value.find(item => item.text === cleanedText);
                if (word) {
                    log.i('找到了单词');
                }
                return word;
            }


            /**
             * 清空状态
             */
            function clearWords(): void {
                setWords([])
            }

            function removeWords(): void {
                clearWords()
                cleanDbWord()
            }

            async function deleteWord(index: number): Promise<void> {
                // 防御性检查
                if (index < 0 || index >= words.value.length) {
                    log.e('删除单词失败：索引越界', index, words.value.length);
                    return;
                }
                const word = words.value[index];
                if (!word) {
                    log.e('删除单词失败：单词不存在', word);
                    return;
                }

                // 从当前词库删除 - 直接使用 currentWordBank.value 避免重新加载导致数据不一致
                if (currentWordBank.value && currentWordBank.value.id === currentWordBankId.value) {
                // 同时清理词库中的历史脏数据，规范化文本
                    currentWordBank.value.words.forEach(w => { w.text = normalizeItemText(w.text) })
                    const bankIndex = currentWordBank.value.words.findIndex(w => w._id === word._id)
                    if (bankIndex !== -1) {
                        currentWordBank.value.words.splice(bankIndex, 1)
                        await saveWordBank(currentWordBank.value)
                    }
                } else {
                    // 如果 currentWordBank.value 不匹配，重新加载
                    const bank = await getWordBank(currentWordBankId.value)
                    if (bank) {
                        // 同时清理词库中的历史脏数据
                        bank.words.forEach(w => { w.text = w.text.replace(/\s+/g, '') })
                        const bankIndex = bank.words.findIndex(w => w._id === word._id)
                        if (bankIndex !== -1) {
                            bank.words.splice(bankIndex, 1)
                            await saveWordBank(bank)
                        }
                        currentWordBank.value = bank
                    }
                }

                // 先保存要删除的单词ID（兼容旧数据库）
                const wordId = word._id;
                // 删除index索引下的数值,删除长度为1
                words.value.splice(index, 1)
                // 按id删除单词
                if (wordId) {
                    removeDbWordById(wordId)
                }
            }

            /**
             * 同步更新当前词库
             * @param payload
             */
            async function addAndUpdateWords(payload: Word[]): Promise<boolean> {
                try {
                    // 规范化文本：保留词组空格，只折叠多余空白
                    const cleanedPayload = payload.map(w => ({ ...w, text: normalizeItemText(w.text) }))
                    // 保存到当前词库
                    const bank = await getWordBank(currentWordBankId.value)
                    if (bank) {
                        // 规范化词库中的文本，防止去重不匹配
                        bank.words.forEach(w => { w.text = normalizeItemText(w.text) })
                        const indexById = new Map(bank.words.map((w, idx) => [w._id, idx]))
                        const existingKeys = new Set(bank.words.map(w => getItemKey(w.text)))

                        for (const word of cleanedPayload) {
                            const existingIndex = indexById.get(word._id)
                            if (existingIndex !== undefined) {
                                bank.words.splice(existingIndex, 1, word)
                            } else if (!existingKeys.has(getItemKey(word.text))) {
                                bank.words.push(word)
                                existingKeys.add(getItemKey(word.text))
                            }
                        }
                        await saveWordBank(bank)
                        currentWordBank.value = bank
                    }

                    // 更新内存列表：已有 _id 直接替换，新词再追加
                    const memoryNewWords: Word[] = []
                    cleanedPayload.forEach(word => {
                        const index = words.value.findIndex(w => w._id === word._id)
                        if (index !== -1) {
                            words.value.splice(index, 1, word)
                        } else {
                            memoryNewWords.push(word)
                        }
                    })
                    if (memoryNewWords.length > 0) {
                        pushWords(memoryNewWords)
                    }

                    // 同时兼容旧数据库
                    await updateDbWordList(cleanedPayload);
                    log.i('批量更新成功');
                    return true;
                } catch (error) {
                    log.e("更新词库异常", error);
                    return false;
                }
            }


            /**
             * 更新 单个单词
             * @param word
             */
            async function addAndUpdateWord(word: Word): Promise<void> {
                console.log("更新词库单个词", word)
                // 规范化文本：保留词组空格，只折叠多余空白
                const cleanedWord = { ...word, text: normalizeItemText(word.text) }
                // 使用 _id 查找索引，避免脏数据中的换行符导致 text 不匹配
                const index = words.value.findIndex(w => w._id === cleanedWord._id);
                if (index !== -1) {
                    // 使用 splice 替换而非 Object.assign，确保 Vue 响应式系统和 RecycleScroller 正确追踪数组变更
                    // Object.assign 只修改对象属性，不触发数组变更检测，导致 RecycleScroller 在列表项减少时出现空白占位
                    words.value.splice(index, 1, cleanedWord);
                } else {
                    pushWords([cleanedWord])
                }

                // 保存到当前词库 - 直接使用 currentWordBank.value 避免重新加载导致数据不一致
                if (currentWordBank.value && currentWordBank.value.id === currentWordBankId.value) {
                    // 同时清理词库中的历史脏数据，规范化文本
                    currentWordBank.value.words.forEach(w => { w.text = normalizeItemText(w.text) })
                    const wordIndex = currentWordBank.value.words.findIndex(w => w._id === cleanedWord._id)
                    if (wordIndex !== -1) {
                        Object.assign(currentWordBank.value.words[wordIndex], cleanedWord)
                    } else {
                        currentWordBank.value.words.push(cleanedWord)
                    }
                    await saveWordBank(currentWordBank.value)
                } else {
                    // 如果 currentWordBank.value 不匹配，重新加载
                    const bank = await getWordBank(currentWordBankId.value)
                    if (bank) {
                        // 同时清理词库中的历史脏数据，规范化文本
                        bank.words.forEach(w => { w.text = normalizeItemText(w.text) })
                        const wordIndex = bank.words.findIndex(w => w._id === cleanedWord._id)
                        if (wordIndex !== -1) {
                            Object.assign(bank.words[wordIndex], cleanedWord)
                        } else {
                            bank.words.push(cleanedWord)
                        }
                        await saveWordBank(bank)
                        currentWordBank.value = bank
                    }
                }

                // 同时兼容旧数据库
                addAndUpdateDbWord(cleanedWord).then(() => {
                    console.log("添加单个词到数据库", cleanedWord)
                })
            }


            /**
             * 调用翻译接口
             */
            // async function translation(payload: YdParams): Promise<AxiosResponse> {
            //     return await http.get('/', {...payload})
            // }

            return {
                words,
                lastAddedWordText,
                currentTranslationPlatform,
                currentOcrPlatform,
                memoryFirmness,
                lastFocusWordText,
                lastFocusWordIndex,
                hiddenExplain,
                lastVisitedPage,
                count,
                pluginStatus,
                rememberCount,
                reviewCount,
                forgetCount,
                shortcutEnabled,
                mainWindowOpacity,
                autoSpeak,
                focusMode,
                currentWordBankId,
                currentWordBank,
                userApiKeys, // 导出用户API密钥
                userOcrApiKeys,
                setLastAddedWordText,
                setClosePlugin,
                setTranslationPlatform,
                setOcrPlatform,
                setMemoryFirmness,
                setUserApiKeys,
                setShortcutEnabled,
                setMainWindowOpacity,
                applyRgbaOpacity,
                setAutoSpeak,
                setApiKey, // 导出设置API密钥方法
                setOcrApiKey,
                getApiKey, // 导出获取API密钥方法
                getOcrApiKey, // 导出获取API密钥方法
                setFocusMode,
                setLastVisitedPage,
                findWord,
                addAndUpdateWord,
                addAndUpdateWords,
                initWordBankInfo,
                translateWithPlatform: async (query: string) => {
                    console.log('store翻译调用, 当前平台:', currentTranslationPlatform.value, '查询词:', query)
                    return await externalTranslateWithPlatform(query, currentTranslationPlatform.value);
                },
                translateBatchWithPlatform: async (queries: string[]) => {
                    console.log('store批量翻译调用, 当前平台:', currentTranslationPlatform.value, '数量:', queries.length)
                    return await externalTranslateBatchWithPlatform(queries, currentTranslationPlatform.value);
                },
                removeWords,
                deleteWord,
                listWords,
                upReview,
                switchWordBank
            }
        }, {
            persist: {
                key: 'words-store',
                storage: localStorage,
                pick: [
                    'currentWordBankId',
                    // 'lastAddedWordText', // 不持久化：避免重新进入页面时触发旧滚动定位
                    'currentTranslationPlatform',
                    'currentOcrPlatform',
                    'memoryFirmness',
                    'pluginStatus',
                    'shortcutEnabled',
                    'mainWindowOpacity',
                    'autoSpeak',
                    'focusMode',
                    'userApiKeys',
                    'userOcrApiKeys',
                    'lastVisitedPage',
                    'hiddenExplain'
                ] // 不持久化 words 数组，因为单词数据存储在词库中
            },
        }
    )
