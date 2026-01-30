import {DB_KEY, USAGE_LIMITS} from "@/constants";
// import {isEmpty, truncate} from "lodash";
// import CryptoJS from "crypto-js";
import type {Word} from "@/types/words";
import {v4 as uuidv4} from "uuid";
import {ElMessage} from "element-plus";
import {useWordsStore} from "@/stores/words.ts";
import {getCurrentUsageCount, hasCustomApiKey, incrementUsageCounter, isOverDailyLimit} from "./usage-counter.ts";
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
const addWord = async (wordText: string): Promise<{success: boolean, message: string,text:string}> => {

    log.i('新加单词', wordText);

    const wordsStore = useWordsStore(); // 传入 Pinia 实例

    // 设置要定位的单词
    if (wordText.trim().length <= 0) {
        // ElMessage.warning("不能添加空单词")
        return {success: false, message: "不能添加空单词",text:wordText}
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
            // ElMessage.success('单词已存在');
            return {success: false, message: '单词已存在',text:wordText};
        }
        // 检查是否超出了每日使用限制
        const currentPlatform = wordsStore.currentTranslationPlatform || 'youdao';
        if (!hasCustomApiKey(currentPlatform)) {
            if (isOverDailyLimit('translation')) {
                const usedCount = getCurrentUsageCount('translation');
                // ElMessage.error(`每日免费翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT} 次)，请设置自定义API密钥以继续使用`);
                return {success: false,text:wordText, message: `每日免费翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT} 次)，请设置自定义API密钥以继续使用`};
            }

            // 增加使用计数
            incrementUsageCounter('translation');
        }

        //  有这个单词,但是没有 释义
        try {
            const res = await wordsStore.translateWithPlatform(wordText);
            // console.log('返回结果', res)
            if (res.success) {
                findWord.explains = res.explains || wordText
                findWord.isReview = true
                findWord.pronunciation = res.pronunciation
                // todo 音标添加
                findWord.phonetic = res.phonetic
                findWord.remember = false
                findWord.level = 1

                await wordsStore.addAndUpdateWord(findWord)
                console.log('更新单词释义成功', res);
                ElMessage.success('更新成功');
                return {success: true,text:wordText, message: '更新成功'};
            } else {
                // 如果更新失败，清空定位单词
                wordsStore.setLastAddedWordText('');
                return {success: false,text:wordText, message: '更新失败'};
            }
        } catch (error) {
            console.error('翻译失败:', error);
            ElMessage.error('翻译失败');
            // 失败时清空定位单词
            wordsStore.setLastAddedWordText('');
            return {success: false,text:wordText, message: "翻译失败"};
        }
    }

    // 检查是否超出了每日使用限制
    const currentPlatform = wordsStore.currentTranslationPlatform || 'youdao';
    if (!hasCustomApiKey(currentPlatform)) {
        if (isOverDailyLimit('translation')) {
            const usedCount = getCurrentUsageCount('translation');
            const remainingCount = USAGE_LIMITS.TRANSLATION_DAILY_LIMIT - usedCount;
            // ElMessage.error(`每日免费翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT} 次)，今日还剩 ${Math.max(0, remainingCount)} 次，请设置自定义API密钥以继续使用`);
            return {success: false,text:wordText, message: `每日免费翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT} 次)，今日还剩 ${Math.max(0, remainingCount)} 次，请设置自定义API密钥以继续使用`};
        }

        // 增加使用计数
        incrementUsageCounter('translation');
    }

    try {
        const res = await wordsStore.translateWithPlatform(wordText);
        log.i('返回翻译api结果', res)

        if (res.success) {
            let oldWords = wordsStore.words
            let newWords = getInitWord(wordText, res.explains || wordText, res.pronunciation || '', '', res.phonetic || '')
            console.log('翻译后的初始化结果', newWords)

            const data = oldWords ? [newWords, ...oldWords] : [newWords]

            // console.log(data, '更新单词成功');
            await wordsStore.addAndUpdateWords(data)

            return {success: true,text:wordText, message: ''};
            // router.push('/')
        } else {
            // ElMessage.error('失败');
            return {success: false,text:wordText, message: "翻译失败"};
        }
    } catch (error) {
        console.error('翻译失败:', error);
        // ElMessage.error('翻译失败');
        // 失败时清空定位单词
        wordsStore.setLastAddedWordText('');
        return {success: false,text:wordText, message: "翻译失败"};
    }
}

/**
 * 批量翻译和添加单词
 * @param words 要添加的单词列表
 * @param onProgress 进度回调函数
 */
const batchTranslateAndAddWords = async (
    words: string[],
    onProgress?: (processedCount: number, totalCount: number) => void
) => {

    /*
    * 1. 优化数组添加，直接过滤已存在且有翻译的，不再进入循环
    * 2. 已存在，但是没有翻译的，更新翻译
    * 2. 提示成功多少，失败多少，已存在多少
    *
    * */

    const wordsStore = useWordsStore();

    // 过滤重复单词，保持唯一性
    const uniqueWords = [...new Set(words.map(w => w.trim()))].filter(w => w.length > 0);

    if (uniqueWords.length === 0) {
        ElMessage.warning("没有可添加单词");
        return;
    }
    wordsStore.setLastAddedWordText(<string>uniqueWords.at(-1))
    wordsStore.lastFocusWordText = <string>uniqueWords.at(-1)

    // 过滤掉已存在且有翻译的单词
    const wordsToProcess = uniqueWords.filter(wordText => {
        const existingWord = wordsStore.findWord(wordText);
        // 如果单词不存在，或者存在但没有翻译，则需要处理
        return !existingWord || !existingWord.explains || existingWord.explains.trim().length === 0;
    });

    if (wordsToProcess.length === 0) {
        ElMessage.info("单词都已存在，无需处理");
        return;
    }

    const totalCount = uniqueWords.length;
    let processedCount = 0;

    const errWords: string[] = [];
    // 逐个处理单词，避免API调用过于频繁
    for (const wordText of wordsToProcess) {
        try {
            let {success,text, message} = await addWord(wordText);
            if (!success) {
                errWords.push(text)
            }
           /* // 检查是否超出了每日使用限制
            const currentPlatform = wordsStore.currentTranslationPlatform || 'youdao';
            if (!hasCustomApiKey(currentPlatform)) {
                // 如果没有自定义API密钥，检查是否超过每日限制
                // 普通翻译和批量翻译一起计数
                if (isOverDailyLimit('translation')) {
                    const usedCount = getCurrentUsageCount('translation');
                    ElMessage.error(`每日免费翻译次数已达上限 (${usedCount}/${USAGE_LIMITS.TRANSLATION_DAILY_LIMIT} 次)，请设置自定义API密钥以继续使用`);
                    break; // 停止处理更多单词
                }

                // 增加使用计数
                incrementUsageCounter('translation');
            }

            // 检查单词是否已存在
            const existingWord = wordsStore.findWord(wordText);

            if (existingWord) {
                // 如果单词已存在，更新其状态
                existingWord.isReview = true;
                existingWord.explainedHidden = false;
                await wordsStore.addAndUpdateWord(existingWord);
            } else {
                // 如果单词不存在，调用翻译API
                const res = await wordsStore.translateWithPlatform(wordText);

                console.log('百度返回结果', res);
                if (res.success) {
                    // 创建新单词对象
                    const newWord: Word = {
                        text: wordText,
                        explains: res.explains || wordText,
                        explainedHidden: false,
                        pronunciation: res.pronunciation || '',
                        isReview: true,
                        ctime: new Date(),
                        learnDate: new Date(),
                        level: 1,
                        _id: DB_KEY + uuidv4(),
                        image: '',
                        phonetic: res.phonetic || '',
                        remember: false
                    };

                    // 添加到存储
                    await wordsStore.addAndUpdateWords([newWord]);
                } else {
                    console.error(`翻译失败: ${wordText}`);
                    ElMessage.error(`翻译失败: ${wordText}`);
                }
            }*/
        } catch (error) {
            console.error(`处理单词失败 ${wordText}:`, error);
            ElMessage.error(`处理单词失败 ${wordText}`);
        } finally {
            processedCount++;

            // 调用进度回调
            if (onProgress) {
                onProgress(processedCount, totalCount);
            }

            // 添加延迟，避免API调用过于频繁
            // 使用更长的随机延迟以减少API限流风险，特别是针对百度API
            let delay;
            // 根据当前翻译平台调整延迟时间
            if (wordsStore.currentTranslationPlatform === 'baidu') {
                delay = 600 + Math.floor(Math.random() * 1000); // 百度API需要更长延迟：2000-3000ms
            } else {
                delay = 450 + Math.floor(Math.random() * 200); // 其他API：450-650ms
            }
            await new Promise(resolve => setTimeout(resolve, delay));
        }

    }
    // 总 数 重复数 已存在数 失败数

};
/**
 * 批量添加单词
 */
const batchAddWords = async (wordTexts: string[]) => {
  console.log('批量添加单词', wordTexts);


  // 使用批量翻译和添加功能
  await batchTranslateAndAddWords(wordTexts, (processedCount: number, totalCount: number) => {
    // if (totalCount > 0) {
    //   ElMessage.info(`正在处理: ${processedCount}/${totalCount}`);
    // }
  });
};

export {getInitWord, addWord, batchAddWords,batchTranslateAndAddWords}
