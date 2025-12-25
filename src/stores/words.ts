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


export const useWordsStore =
    defineStore('words',
        () => {
            const words = ref<Word[]>([])

            const lastAddedWordText = ref('')    //记录最新添加的单词

            const currentTranslationPlatform = ref<TranslationPlatform>('youdao'); // 默认使用有道翻译


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


            /**
             * 设置当前翻译平台
             */
            function setTranslationPlatform(platform: TranslationPlatform) {
                currentTranslationPlatform.value = platform;
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
             * 生成有道翻译签名参数
             */
            function generateYoudaoParams(query: string): YdParams {
                const salt = (new Date).getTime();
                const curtime = Math.round(new Date().getTime() / 1000);
                const str1 = AppInfo.youdao.appkey + truncate(query) + salt + curtime + AppInfo.youdao.key;
                const sign = CryptoJS.SHA256(str1).toString(CryptoJS.enc.Hex);

                return {
                    q: query,
                    appKey: AppInfo.youdao.appkey,
                    salt: salt,
                    from: FROM,
                    to: TO,
                    sign: sign,
                    signType: "v3",
                    curtime: curtime,
                    ext: 'mp3'
                };
            }

            /**
             * 生成百度翻译签名参数
             */
            function generateBaiduParams(query: string): any {
                const appId = AppInfo.baidu.appkey; // 需要在配置中添加百度翻译的appId和密钥
                const secretKey = AppInfo.baidu.key;
                const salt = ''+(new Date).getTime();
                const signStr = appId + query + salt + secretKey;
                const sign = CryptoJS.MD5(signStr).toString();
                // console.log("计算出的sign:", sign);
                // console.log("salt:", salt);
                // console.log("appId:", appId);
                // console.log("secretKey:", secretKey);
                return {
                    q: query,
                    from: FROM,
                    to: "zh",
                    appid: appId,
                    salt: salt,
                    sign: sign
                };
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
             * 调用不同平台的翻译接口
             */
            async function translateWithPlatform(query: string): Promise<TranslationResult> {
                try {
                    switch (currentTranslationPlatform.value) {
                        case 'youdao':
                            console.log('调用有道')
                            const youdaoParams = generateYoudaoParams(query);
                            console.log('参数')
                            const youdaoResponse = await http.get('/', {...youdaoParams});
                            console.log('请求结果')
                            return handleYoudaoResponse(youdaoResponse.data);

                        case 'baidu':
                            const baiduParams = generateBaiduParams(query);
                            // 必须对q进行URL编码
                            baiduParams.q = encodeURIComponent(baiduParams.q);
                            const baiduResponse = await http.get('https://fanyi-api.baidu.com/api/trans/vip/translate', {...baiduParams});
                            return handleBaiduResponse(baiduResponse.data);

                        case 'google':
                            // Google翻译API通常需要服务端实现，这里提供基本结构
                            const googleParams = {
                                q: query,
                                source: FROM,
                                target: TO,
                                format: 'text'
                            };
                            // 注意：Google翻译API需要服务端实现，因为浏览器端直接调用会有CORS问题
                            const googleResponse = await http.get('https://translation.googleapis.com/language/translate/v2', {...googleParams});
                            return handleGoogleResponse(googleResponse.data);


                        default:
                            return {
                                success: false,
                                errorMsg: 'Unsupported translation platform'
                            };
                    }
                } catch (error) {
                    console.error('Translation error:', error);
                    return {
                        success: false,
                        errorMsg: 'Translation failed: ' + (error as Error).message
                    };
                }
            }

            /**
             * 处理有道翻译返回结果
             */
            function handleYoudaoResponse(data: any): TranslationResult {
                if (data.errorCode === '0') {
                    const explains = data.translation?.[0] || '';

                    // 音频，应该在这处理掉，直接存成文件

                    // await downloadAndStoreAudio(url, wordId);

                    const phonetic = data.basic?.phonetic || '';
                    const pronunciation = data.speakUrl || '';

                    return {
                        success: true,
                        explains,
                        phonetic,
                        pronunciation
                    };
                } else {
                    return {
                        success: false,
                        errorMsg: `Youdao API error: ${data.errorCode}`
                    };
                }
            }

            /**
             * 处理百度翻译返回结果
             */
            function handleBaiduResponse(data: any): TranslationResult {
                if (data.error_code === undefined || data.error_code === '52000') {
                    const explains = data.trans_result?.[0]?.dst || '';
                    return {
                        success: true,
                        explains
                    };
                } else {
                    return {
                        success: false,
                        errorMsg: `Baidu API error: ${data.error_code}`
                    };
                }
            }

            /**
             * 处理谷歌翻译返回结果
             */
            function handleGoogleResponse(data: any): TranslationResult {
                if (data.data) {
                    const explains = data.data.translations?.[0]?.translatedText || '';
                    return {
                        success: true,
                        explains
                    };
                } else {
                    return {
                        success: false,
                        errorMsg: 'Google API error'
                    };
                }
            }

            /**
             * 调用翻译接口
             */
            async function translation(payload: YdParams): Promise<AxiosResponse> {
                return await http.get('/', {...payload})
            }

            return {
                words,
                lastAddedWordText,
                currentTranslationPlatform,
                count,
                rememberCount,
                reviewCount,
                forgetCount,
                setLastAddedWordText,
                setTranslationPlatform,
                findWord,
                addAndUpdateWord,
                addAndUpdateWords,
                translateWithPlatform,
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
