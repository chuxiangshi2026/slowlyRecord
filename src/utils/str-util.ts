import {DB_KEY} from "@/constants";
// import {isEmpty, truncate} from "lodash";
// import CryptoJS from "crypto-js";
import type {Word} from "@/types/words";
import {v4 as uuidv4} from "uuid";
import {ElMessage} from "element-plus";
import {useWordsStore} from "@/stores/words.ts";
import {log} from "@/utils/logger.ts";
import { batchTranslateAndAddWords } from "./word-util.ts";
import { isOverDailyLimit, incrementUsageCounter, hasCustomApiKey, getCurrentUsageCount } from "./usage-counter.ts";
import { USAGE_LIMITS } from "@/constants";

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
        // 检查是否超出了每日使用限制
        const currentPlatform = wordsStore.currentTranslationPlatform || 'youdao';
        if (!hasCustomApiKey(currentPlatform)) {
            if (isOverDailyLimit('translation')) {
                const usedCount = getCurrentUsageCount('translation');
                ElMessage.error(`每日免费翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT} 次)，请设置自定义API密钥以继续使用`);
                return;
            }

            // 增加使用计数
            incrementUsageCounter('translation');
        }

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

    // 检查是否超出了每日使用限制
    const currentPlatform = wordsStore.currentTranslationPlatform || 'youdao';
    if (!hasCustomApiKey(currentPlatform)) {
        if (isOverDailyLimit('translation')) {
            const usedCount = getCurrentUsageCount('translation');
            const remainingCount = USAGE_LIMITS.TRANSLATION_DAILY_LIMIT - usedCount;
            ElMessage.error(`每日免费翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT} 次)，今日还剩 ${Math.max(0, remainingCount)} 次，请设置自定义API密钥以继续使用`);
            return;
        }

        // 增加使用计数
        incrementUsageCounter('translation');
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

/**
 * 批量添加单词
 */
const batchAddWords = async (wordTexts: string[]) => {
  console.log('批量添加单词', wordTexts);


  // 过滤掉空单词
  const filteredWords = wordTexts.filter(word => word.trim().length > 0);

  if (filteredWords.length === 0) {
    ElMessage.warning("没有有效的单词可添加");
    return;
  }

  // 使用批量翻译和添加功能
  await batchTranslateAndAddWords(filteredWords, (processedCount: number, totalCount: number) => {
    // if (totalCount > 0) {
    //   ElMessage.info(`正在处理: ${processedCount}/${totalCount}`);
    // }
  });
};

export {getInitWord, addWord, batchAddWords}
