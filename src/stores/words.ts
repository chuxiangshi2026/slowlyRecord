import {computed, ref} from "vue";
import type {Word, YdParams} from "@/types/words";
import {defineStore} from "pinia";
// import {parse, stringify} from 'zipson'
// import { serializer } from '@/utils/jsonSerializeUtil';
import http from "@/utils/http.ts";
import {log} from "@/utils/logger.ts"
import type {AxiosResponse} from 'axios'
import {addAndUpdateDbWord, cleanDbWord, listDbWords, removeDbWordById, updateDbWordList} from "@/utils/db-util.ts";
import {DEFAULT_INTERVALS} from "@/constants";


export const useWordsStore =
    defineStore('words',
        () => {
            const words = ref<Word[]>([])

            // 总单词数
            const count = computed(() => {
                return words.value.length;
            });

            /**
             * 计算属性,统计已记住的单词数
             */
            const rememberCount = computed(() => {
                return words.value.filter((word: Word) => word.isReview).length
            })

            /**
             *计算属性,统计忘记的单词数
             */
            const forgetCount = computed(() => {
                return words.value.length - rememberCount.value
            })


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
                // 删除index索引下的数值,删除长度为1
                words.value.splice(index, 1)
                // 按id删除单词
                removeDbWordById(words.value[index]._id)
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

                const index = words.value.findIndex(w => w.text === word.text);
                if (index !== -1) {
                    words.value[index] = word; // 修改指定元素
                } else {
                    pushWords([word])
                }
                addAndUpdateDbWord(word).then(() => {
                    log.i("添加单个词到数据库")
                })
                // 更新 数据库 这里要判断 数据库中是否有这个单词
            }

            /**
             * 调用翻译接口
             */
            async function translation(payload: YdParams): Promise<AxiosResponse> {
                return await http.get('/', {...payload})
            }

            return {
                words,
                count,
                rememberCount,
                forgetCount,
                findWord,
                updateWord: addAndUpdateWord,
                addAndUpdateWords,
                clearWords,
                translation,
                removeWords,
                deleteWord,
                listWords,
                upReview
            }
        }, {
            persist: true,
        }
    )
