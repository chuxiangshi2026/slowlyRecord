import {ref} from "vue";
import type {Word, YdParams} from "@/types/words";
import {defineStore} from "pinia";
import {parse, stringify} from 'zipson'
// import { serializer } from '@/utils/jsonSerializeUtil';
import http from "@/utils/http.ts";
import {addDbWord, updateDbWordList} from "@/utils/DbUtil.ts";


export const useWordsStore =
    defineStore('words',

        {
            state: () => ({
                // words : ref<Word[]>([])
                words: ref<Word[]>([])
            }),
            persist: {
                key: 'words',
                // serializer: {
                //     deserialize: parse,
                //     serialize: stringify
                // }
            },
            actions: {
                // 创建状态，更新状态
                updateWords(payload: Word[]) {

                    this.words = payload
                    // addWord(words)

                    // const cleanedDocs = payload.map(doc => JSON.parse(JSON.stringify(doc)));
                    // console.log(payload, '更新单词');
                    updateDbWordList(payload)

                },

                clearWords() {
                    this.words = []


                },
                updateWord(word: Word) {
                    const index = this.words.findIndex(w => w.text === word.text);
                    if (index !== -1) {
                        this.words[index] = word; // 修改指定元素
                    }
                    addDbWord(word)
                },

                // 异步提交状态，动作
                async translation(payload: YdParams) {
                    return await http.get('/', {...payload})
                }

            }
        }

        // () => {
        //     const words = ref<Word[]>([])
        //
        //     // 创建状态，更新状态
        //     function updateWords(payload: Word[]) {
        //         words.value = payload
        //         // addWord(words)
        //     }
        //
        //     function clearWords() {
        //         words.value = []
        //     }
        //
        //     // 异步提交状态，动作
        //     async function translation(payload: YdParams) {
        //         return await http.get('/', {...payload})
        //     }
        //
        //     return {words, updateWords, clearWords, translation}
        // },
        // {
        //     persist: true,
        // }
    )
