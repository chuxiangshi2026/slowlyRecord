import {DB_KEY} from "@/constants";
// import {isEmpty, truncate} from "lodash";
// import CryptoJS from "crypto-js";
import type {Word, TranslationResult} from "@/types/words";
import {v4 as uuidv4} from "uuid";
import {ElMessage} from "element-plus";
import {useWordsStore} from "@/stores/words.ts";
import {log} from "@/utils/logger.ts";
import {queryLocalDictionaryAsync} from "@/utils/local-dictionary";
import {normalizeItemText, inferItemType} from "@/utils/text-utils";
import {UserActionEvents} from "@/utils/stats";
import {containsChinese, resolveZhEntry} from "@/utils/zh-entry";

/**
 * 初始化单词状态
 */
const getInitWord = (text: string, explains: string, pronunciation: string, image: string = '', phonetic: string = '') => {
    // 规范化文本：保留词组中的空格，只折叠多余空白
    const cleanedText = normalizeItemText(text);
    const itemType = inferItemType(cleanedText);
    let newWords: Word = {
        "text": cleanedText,
        "itemType": itemType,
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
 * 中文词条入库：按全局「中文加词方向」反查英文（默认英文主词/中文释义），
 * 复用与英文加词一致的查重、释义补全与定位语义。
 */
const addChineseEntry = async (originalText: string): Promise<{success: boolean, message: string,text:string}> => {
    const wordsStore = useWordsStore()
    let entry: Awaited<ReturnType<typeof resolveZhEntry>>
    try {
        entry = await resolveZhEntry(originalText)
    } catch (e) {
        console.warn('中文反查英文失败:', e)
        entry = null
    }
    if (!entry) {
        return {success: false, message: '中文译英失败，请检查翻译引擎设置', text: originalText}
    }
    const wordText = entry.word
    log.i('中文加词', originalText, '->', wordText)
    wordsStore.lastFocusWordText = wordText

    // 英文主词的音标尽量从本地词典补齐（中文主词没有音标）
    let phonetic = ''
    try {
        const localEntry = await queryLocalDictionaryAsync(wordText)
        phonetic = localEntry?.phonetic || ''
    } catch { /* 缺音标不影响入库 */ }

    const findWord = wordsStore.findWord(wordText)
    if (findWord) {
        if (findWord.explains && findWord.explains.trim()) {
            findWord.isReview = true
            findWord.remember = false
            findWord.explainedHidden = false
            try {
                await wordsStore.addAndUpdateWord(findWord)
            } catch {
                return {success: false, message: '保存失败，请重试', text: wordText}
            }
            wordsStore.setLastAddedWordText(wordText)
            return {success: false, message: '单词已存在', text: wordText}
        }
        // 已存在但无释义：补上反查得到的释义
        findWord.explains = entry.explains
        findWord.isReview = true
        findWord.remember = false
        findWord.level = 1
        if (!findWord.phonetic && phonetic) findWord.phonetic = phonetic
        try {
            await wordsStore.addAndUpdateWord(findWord)
        } catch {
            wordsStore.setLastAddedWordText('')
            return {success: false, message: '保存失败，请重试', text: wordText}
        }
        wordsStore.setLastAddedWordText(wordText)
        ElMessage.success('更新成功')
        return {success: true, message: '更新成功', text: wordText}
    }

    const newWords = getInitWord(wordText, entry.explains, '', '', phonetic)
    const saved = await wordsStore.addAndUpdateWords([newWords])
    if (!saved) {
        wordsStore.setLastAddedWordText('')
        return {success: false, message: '保存失败，请重试', text: wordText}
    }
    UserActionEvents.addWord()
    wordsStore.setLastAddedWordText(wordText)
    return {success: true, message: '', text: wordText}
}

/**
 * 添加单词
 */
const addWord = async (wordText: string): Promise<{success: boolean, message: string,text:string}> => {

    // 规范化文本：保留词组空格，只折叠多余空白
    wordText = normalizeItemText(wordText);

    log.i('新加单词', wordText);

    const wordsStore = useWordsStore(); // 传入 Pinia 实例

    // 设置要定位的单词
    if (wordText.length <= 0) {
        // ElMessage.warning("不能添加空单词")
        return {success: false, message: "不能添加空单词",text:wordText}
    }
    // 中文加词（仅英语词库）：按全局方向反查英文（默认英文作主词，中文作释义）；
    // 其他语言词库保持原流程，交给翻译引擎按目标语言处理
    if (containsChinese(wordText) && wordsStore.currentLanguage === 'en') {
        return await addChineseEntry(wordText)
    }
    wordsStore.lastFocusWordText=wordText
    let findWord = wordsStore.findWord(wordText)
    if (findWord) {
        console.log('待添加单词已存在');
        // 如果有这个单词  并有 释义
        if (findWord.explains) {
            console.log('待添加单词释义都已存在');

            findWord.isReview=true
            findWord.remember=false
            findWord.explainedHidden=false
            try {
                await wordsStore.addAndUpdateWord(findWord)
            } catch (e) {
                return {success: false, message: '保存失败，请重试', text: wordText};
            }
            // 数据更新完成后设置定位，确保watcher触发时数据已就绪
            wordsStore.setLastAddedWordText(wordText);
            // ElMessage.success('单词已存在');
            return {success: false, message: '单词已存在',text:wordText};
        }
        //  有这个单词,但是没有 释义
        try {
            const res = await wordsStore.translateWithPlatform(wordText);
            // console.log('返回结果', res)
            if (res.success) {
                findWord.explains = res.explains || wordText
                findWord.isReview = true
                findWord.pronunciation = res.pronunciation
                // 如果翻译API没有返回音标，尝试从本地词典获取
                let phonetic = res.phonetic || '';
                // 防止音标字段包含URL
                if (phonetic.match(/^https?:\/\//i)) {
                    phonetic = '';
                }
                if (!phonetic || phonetic.trim() === '') {
                    const localEntry = await queryLocalDictionaryAsync(wordText);
                    if (localEntry?.phonetic) {
                        phonetic = localEntry.phonetic;
                        console.log('[本地词库] 更新音标:', wordText, phonetic);
                    }
                }
                findWord.phonetic = phonetic;
                findWord.remember = false
                findWord.level = 1

                await wordsStore.addAndUpdateWord(findWord)
                console.log('更新单词释义成功', res);
                // 数据更新完成后设置定位，确保watcher触发时数据已就绪
                wordsStore.setLastAddedWordText(wordText);
                ElMessage.success('更新成功');
                return {success: true,text:wordText, message: '更新成功'};
            } else {
                // 如果更新失败，清空定位单词
                wordsStore.setLastAddedWordText('');
                return {success: false,text:wordText, message: '更新失败'};
            }
        } catch (error) {
            console.error('翻译失败:', error);
            // ElMessage.error('翻译失败');
            // 失败时清空定位单词
            wordsStore.setLastAddedWordText('');
            return {success: false,text:wordText, message: "翻译失败:"+error};
        }
    }
    console.log('准备翻译')

    try {
        const res = await wordsStore.translateWithPlatform(wordText);
        log.i('返回翻译api结果', res)

        if (res.success) {
            // 如果翻译API没有返回音标，尝试从本地词典获取
            let phonetic = res.phonetic || '';
            // 防止音标字段包含URL
            if (phonetic.match(/^https?:\/\//i)) {
                phonetic = '';
            }
            if (!phonetic || phonetic.trim() === '') {
                const localEntry = await queryLocalDictionaryAsync(wordText);
                if (localEntry?.phonetic) {
                    phonetic = localEntry.phonetic;
                    console.log('[本地词库] 新单词音标:', wordText, phonetic);
                }
            }
            let newWords = getInitWord(wordText, res.explains || wordText, res.pronunciation || '', '', phonetic)
            console.log('翻译后的初始化结果', newWords)

            // 单新词添加：只保存新词本身，不把整个内存词表传给合并逻辑，
            // 避免内存残留但已从词库删除的词被 push 回词库（复活已删词）
            const data = [newWords]

            // console.log(data, '更新单词成功');
            const saved = await wordsStore.addAndUpdateWords(data)
            if (!saved) {
                wordsStore.setLastAddedWordText('');
                return {success: false,text:wordText, message: '保存失败，请重试'};
            }
            UserActionEvents.addWord()

            // 数据更新完成后设置定位，确保watcher触发时数据已就绪
            wordsStore.setLastAddedWordText(wordText);
            return {success: true,text:wordText, message: ''};
            // router.push('/')
        } else {
            // 使用翻译返回的错误信息，本地词典会有友好提示如"词库暂未收录..."
            const errorMsg = (res as any).errorMsg || '翻译失败';
            return {success: false,text:wordText, message: errorMsg};
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

    // 过滤重复单词，保持唯一性（规范化文本，保留词组空格）
    const uniqueWords = [...new Set(words.map(w => normalizeItemText(w)))].filter(w => w.length > 0);

    if (uniqueWords.length === 0) {
        ElMessage.warning("没有可添加单词");
        return;
    }
    // 中文条目逐条按方向反查入库（addWord 内部处理译英与查重），失败统一上报
    const zhWords = uniqueWords.filter(w => containsChinese(w));
    const latinWords = uniqueWords.filter(w => !containsChinese(w));
    const zhFailed: string[] = [];
    for (const zhText of zhWords) {
        const res = await addWord(zhText);
        if (!res.success && res.message !== '单词已存在') zhFailed.push(zhText);
    }
    if (zhFailed.length > 0) {
        const preview = zhFailed.slice(0, 5).join('、');
        ElMessage.warning(`以下 ${zhFailed.length} 条中文译英失败：${preview}${zhFailed.length > 5 ? ' 等' : ''}`);
    }
    if (latinWords.length === 0) return;
    wordsStore.lastFocusWordText = <string>latinWords.at(-1)

    // 过滤掉已存在且有翻译的单词
    const wordsToProcess = latinWords.filter(wordText => {
        const existingWord = wordsStore.findWord(wordText);
        // 如果单词不存在，或者存在但没有翻译，则需要处理
        return !existingWord || !existingWord.explains || existingWord.explains.trim().length === 0;
    });

    if (wordsToProcess.length === 0) {
        ElMessage.info("单词都已存在，无需处理");
        return;
    }

    const totalCount = latinWords.length;
    let processedCount = 0;

    const errWords: string[] = [];

    interface BatchTranslateResult {
        wordText: string;
        success: boolean;
        result?: TranslationResult;
        message?: string;
    }

    const translatedResults: BatchTranslateResult[] = [];

    const batchResults: TranslationResult[] = await wordsStore.translateBatchWithPlatform(wordsToProcess);
    batchResults.forEach((res: TranslationResult, index: number) => {
        const wordText = wordsToProcess[index];
        if (!res.success) {
            errWords.push(wordText);
        }
        translatedResults.push({
            wordText,
            success: !!res.success,
            result: res.success ? res : undefined,
            message: (res as any).errorMsg,
        });
        processedCount++;
        if (onProgress) {
            onProgress(processedCount, totalCount);
        }
    });

    const wordsToSave: Word[] = [];
    for (const item of translatedResults) {
        if (!item.success || !item.result) continue;
        const existingWord = wordsStore.findWord(item.wordText);
        let phonetic = item.result.phonetic || '';
        if (phonetic.match(/^https?:\/\//i)) {
            phonetic = '';
        }
        if (!phonetic || phonetic.trim() === '') {
            const localEntry = await queryLocalDictionaryAsync(item.wordText);
            if (localEntry?.phonetic) {
                phonetic = localEntry.phonetic;
            }
        }

        if (existingWord) {
            // 已有词只补数据（释义/发音/音标），完全不动 level/remember/isReview 等 SRS 进度
            wordsToSave.push({
                ...existingWord,
                explains: item.result.explains || item.wordText,
                pronunciation: item.result.pronunciation,
                phonetic,
            });
        } else {
            wordsToSave.push(getInitWord(
                item.wordText,
                item.result.explains || item.wordText,
                item.result.pronunciation || '',
                '',
                phonetic,
            ));
        }
    }

    if (wordsToSave.length > 0) {
        await wordsStore.addAndUpdateWords(wordsToSave);
        wordsStore.setLastAddedWordText(wordsToSave[0].text);
    }

    // 上报翻译失败的单词，避免静默丢失
    if (errWords.length > 0) {
        const preview = errWords.slice(0, 5).join('、');
        ElMessage.warning(`以下 ${errWords.length} 个单词翻译失败：${preview}${errWords.length > 5 ? ' 等' : ''}`);
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

export {getInitWord, addWord, batchAddWords, batchTranslateAndAddWords}
