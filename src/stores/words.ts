import {computed, ref} from "vue";
import type {TranslationPlatform, TranslationResult, Word, YdParams} from "@/types/words";
import {defineStore} from "pinia";
// import {parse, stringify} from 'zipson'
// import { serializer } from '@/utils/jsonSerializeUtil';
import http from "@/utils/http.ts";
import {log} from "@/utils/logger.ts"
import type {AxiosResponse} from 'axios'
import CryptoJS from "crypto-js";
import {addAndUpdateDbWord, cleanDbWord, listDbWords, removeDbWordById, updateDbWordList} from "@/utils/db-util.ts";
import {APP_KEY, DEFAULT_INTERVALS, FROM, KEY, TO} from "@/constants";
import {truncate} from "lodash";
import {AppInfo} from "@/config.ts";
// import {downloadAndStoreAudio} from "@/utils/audio-util.ts";
// 导入翻译服务
import { translateWithPlatform as externalTranslateWithPlatform } from "@/utils/translation-api";

// 添加 API 密钥相关的响应式变量
const userApiKeys = ref({
    ali: {
        // || AppInfo.ali.appkey
        appkey: (localStorage.getItem('api_key_ali_appkey') || '').trim() ,
        // || AppInfo.ali.key
        key: (localStorage.getItem('api_key_ali_key') || '').trim()
    },
    youdao: {
        // || AppInfo.youdao.appkey
        appkey: (localStorage.getItem('api_key_youdao_appkey') || '').trim() ,
        // || AppInfo.youdao.key
        key: (localStorage.getItem('api_key_youdao_key') || '').trim()
    },
    baidu: {
        // || AppInfo.baidu.appkey
        appkey: (localStorage.getItem('api_key_baidu_appkey') || '').trim() ,
        // || AppInfo.baidu.key
        key: (localStorage.getItem('api_key_baidu_key') || '').trim()
    },
    utoolsai: {
        appkey: (localStorage.getItem('api_key_utoolsai_appkey') || '').trim(),
        key: (localStorage.getItem('api_key_utoolsai_key') || '').trim()
    },
    ollama: {
        appkey: (localStorage.getItem('api_key_ollama_appkey') || '').trim(),
        key: (localStorage.getItem('api_key_ollama_key') || '').trim()
    },
    deepseek: {
        appkey: (localStorage.getItem('api_key_deepseek_appkey') || '').trim(),
        key: (localStorage.getItem('api_key_deepseek_key') || '').trim()
    },
    qwen: {
        appkey: (localStorage.getItem('api_key_qwen_appkey') || '').trim(),
        key: (localStorage.getItem('api_key_qwen_key') || '').trim()
    },
    kimi: {
        appkey: (localStorage.getItem('api_key_kimi_appkey') || '').trim(),
        key: (localStorage.getItem('api_key_kimi_key') || '').trim()
    }
})

export const useWordsStore =
    defineStore('words',
        () => {
            const words = ref<Word[]>([])

            const lastAddedWordText = ref('')    //记录最新添加的单词
            const lastFocusWordText = ref('')    //记录最新添加的单词

            const currentTranslationPlatform = ref<TranslationPlatform>('youdao'); // 默认使用有道翻译

            // 添加单词后自动退出插件
            const pluginStatus = ref(false);
            // 默认关闭快捷键
            const shortcutEnabled = ref(false);

            const hiddenExplain = ref('');
            // 当前操作释义的单词
            // const hiddenExplain = ref('');

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
                return words.value.filter((word: Word) => !word.isReview).length - rememberCount.value
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


            function setClosePlugin(status: boolean) {
                console.log('更新定位单词', status)
                pluginStatus.value = status
            }


            /**
             * 设置当前翻译平台
             */
            function setTranslationPlatform(platform: TranslationPlatform) {
                currentTranslationPlatform.value = platform;
            }



            function setShortcutEnabled(enabled: boolean) {
                shortcutEnabled.value = enabled;
            }

            /**
             * 设置API密钥
             */
            function setApiKey(provider: TranslationPlatform, appkey: string, key: string) {
                userApiKeys.value[provider].appkey = appkey;
                userApiKeys.value[provider].key = key;
                // 保存到本地存储
                localStorage.setItem(`api_key_${provider}_appkey`, appkey);
                localStorage.setItem(`api_key_${provider}_key`, key);
            }

            /**
             * 获取API密钥
             */
            function getApiKey(provider: TranslationPlatform) {
                return userApiKeys.value[provider];
            }

            /**
             * 更新状态
             */
            function setWords(payload: Word[]) {
                words.value = payload
                log.i(payload, '更新单词');
            }

            /**
             *获取全部单词
             */
            function listWords(): Word[] {
                let dbWords = listDbWords();
                // console.log('读取的数据库', dbWords)
                if (!words || words.value.length != dbWords.length) {
                    console.log('数据库与缓存数据不一致')
                }

                pushWords(dbWords)
                return words.value
            }

            /**
             * 批量添加单词
             */
            function pushWords(payload: Word[]) {
                log.i("批量去重添加单词", payload)
                const uniquePayload = payload.filter(newWord =>
                    !words.value.some(existingWord => existingWord.text === newWord.text)
                );
                words.value.push(...uniquePayload);
                log.i(payload, '批量添加去重后的单词', uniquePayload);
            }

            /**
             * 重新计算需要复习的单词
             */
            function upReview() {
                // 进行计算，哪些是需要  记的改成true

                // 把所有的单词时间计算一下，修改一下是否显示
                words.value.forEach((item) => {
                    // 如果  当前时间>  上次复习时间+数组[等级]
                    if (Date.now() > item.learnDate.getTime() + DEFAULT_INTERVALS[item.level] * 60 * 1000) {
                        item.isReview = true
                    }
                })
            }


            /**
             *查找单词
             */
            function findWord(wordText: string): Word | undefined {
                const word = words.value.find(item => item.text === wordText);
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

            function deleteWord(index: number): void {
                // 先保存要删除的单词ID
                const wordId = words.value[index]._id;
                // 删除index索引下的数值,删除长度为1
                words.value.splice(index, 1)
                // 按id删除单词
                removeDbWordById(wordId)
            }

            /**
             * 同步更新数据库
             * @param payload
             */
            async function addAndUpdateWords(payload: Word[]): Promise<boolean> {

                try {
                    await updateDbWordList(payload);
                    pushWords(payload);
                    log.i('批量更新成功');
                    return true;
                } catch (error) {
                    log.e("更新本地数据库异常", error);
                    return false;
                }
            }




            /**
             * 更新 单个单词
             * @param word
             */
            function addAndUpdateWord(word: Word): void {
                console.log("更新数据库单个词", word)
                const index = words.value.findIndex(w => w.text === word.text);
                if (index !== -1) {
                    Object.assign(words.value[index], word); // 修改指定元素
                } else {
                    pushWords([word])
                }
                addAndUpdateDbWord(word).then(() => {
                    console.log("添加单个词到数据库", word)
                })

                let data = listDbWords();
                // console.log('添加数据库后查看数据库', data)
                // 更新 数据库 这里要判断 数据库中是否有这个单词
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
                lastFocusWordText,
                hiddenExplain,
                count,
                pluginStatus,
                rememberCount,
                reviewCount,
                forgetCount,
                shortcutEnabled,
                userApiKeys, // 导出用户API密钥
                setLastAddedWordText,
                setClosePlugin,
                setTranslationPlatform,
                setShortcutEnabled,
                setApiKey, // 导出设置API密钥方法
                getApiKey, // 导出获取API密钥方法
                findWord,
                addAndUpdateWord,
                addAndUpdateWords,
                translateWithPlatform: async (query: string) => {
                    return await externalTranslateWithPlatform(query, currentTranslationPlatform.value);
                },
                removeWords,
                deleteWord,
                listWords,
                upReview
            }
        }, {
            persist: {
                key: 'words-store',
                storage: localStorage,
            },
        }
    )
