import {DB_KEY} from "@/constants";
// import {isEmpty, truncate} from "lodash";
// import CryptoJS from "crypto-js";
import type {Word} from "@/types/words";
import {v4 as uuidv4} from "uuid";
import {ElMessage} from "element-plus";
import {useWordsStore} from "@/stores/words.ts";
import {log} from "@/utils/logger.ts";


/**
 * 初始化单词状态
 */
const getInitWord = (text: string, explains: string, pronunciation: string, image: string = '', phonetic: string = '') => {
    let newWords: Word = {
        "text": text,
        "explains": explains,
        "explainedHidden": false,
        "pronunciation": pronunciation,
        "isReview": true,
        "ctime": new Date(),
        "learnDate": new Date(),
        "level": 1,
        "_id": DB_KEY + uuidv4(), // 假设_id为必填项
        "image": image, // 假设image为必填项
        "phonetic": phonetic, // 假设phonetic为必填项
        "remember": false  // 默认未记住

        // "image": resData.image
        // phonetic: resData.phonetic,
        // updateTime: new Date()
    };
    return newWords;
}

/**
 * 添加单词
 */
const addWord = async (wordText: string) => {

    console.log('新加单词', wordText);

    const wordsStore = useWordsStore(); // 传入 Pinia 实例

    // 设置要定位的单词
    if (wordText.trim().length <= 0) {
        ElMessage.warning("不能添加空单词")
        return
    }
    wordsStore.lastFocusWordText=wordText
    wordsStore.setLastAddedWordText(wordText);
    let findWord = wordsStore.findWord(wordText)
    if (findWord) {
        console.log('待添加单词已存在');
        // 如果有这个单词  并有 释义
        if (findWord.explains) {
            console.log('待添加单词释义都已存在');

            findWord.isReview=true
            findWord.explainedHidden=false
            wordsStore.addAndUpdateWord(findWord)
            ElMessage.success('单词已存在');
            return
        }
        // console.log('当前翻译引擎', wordsStore.currentTranslationPlatform)
        //  有这个单词,但是没有 释义
        wordsStore.translateWithPlatform(wordText).then(res => {
            // console.log('返回结果', res)
            if (res.success) {
                findWord.explains = res.explains || wordText
                findWord.isReview = true
                findWord.pronunciation = res.pronunciation
                // todo 音标添加
                findWord.phonetic = res.phonetic
                findWord.remember = false
                findWord.level = 1

                wordsStore.addAndUpdateWord(findWord)
                console.log('更新单词释义成功', res);
                ElMessage.success('更新成功');
            }else {
                // 如果更新失败，清空定位单词
                wordsStore.setLastAddedWordText('');
            }
        }).catch(error => {
            console.error('翻译失败:', error);
            ElMessage.error('翻译失败');
            // 失败时清空定位单词
            wordsStore.setLastAddedWordText('');
        });

        ElMessage.error('添加失败');
        return;
    }


    wordsStore.translateWithPlatform(wordText).then(res => {
        console.log('返回翻译api结果', res)

        if (res.success) {
            let oldWords = wordsStore.words
            let newWords = getInitWord(wordText, res.explains || wordText, res.pronunciation || '', '', res.phonetic || '')
            console.log('翻译后的初始化结果', newWords)

            const data = oldWords ? [newWords, ...oldWords] : [newWords]

            // console.log(data, '更新单词成功');
            wordsStore.addAndUpdateWords(data)

            // router.push('/')
        } else {
            ElMessage.error('失败');
        }
    }).catch(error => {
        console.error('翻译失败:', error);
        ElMessage.error('翻译失败');
        // 失败时清空定位单词
        wordsStore.setLastAddedWordText('');
    })
}
export {getInitWord, addWord}
