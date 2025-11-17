import {APP_KEY, DB_KEY, FROM, KEY, TO} from "@/constants";
import {isEmpty, truncate} from "lodash";
import CryptoJS from "crypto-js";
import type {Word, YdParams} from "@/types/words";
import {v4 as uuidv4} from "uuid";
import {ElMessage} from "element-plus";
import {useWordsStore} from "@/stores/words.ts";


const getParam = (query: string) => {

    const salt = (new Date).getTime();
    const curtime = Math.round(new Date().getTime() / 1000);
    const str1 = APP_KEY + truncate(query) + salt + curtime + KEY;
    const sign = CryptoJS.SHA256(str1).toString(CryptoJS.enc.Hex);

    const params: YdParams = {
        //待翻译文本
        q: query,
        // 应用ID	True	可在应用管理 查看
        appKey: APP_KEY,
        // 随机字符串，可使用UUID进行生产	True
        salt: salt,
        // 源语言
        from: FROM,
        // 目标语言
        to: TO,
        // 签名	True	sha256(应用ID+input+salt+curtime+应用密钥)
        sign: sign,
        // 签名类型
        signType: "v3",
        // 当前UTC时间戳(秒)
        curtime: curtime,
        ext: 'mp3'
        // 用户上传的术语表
        // vocabId: vocabId,
    }
    return params;
}

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


    const wordsStore = useWordsStore(); // 传入 Pinia 实例


    let findWord = wordsStore.findWord(wordText)
    if (findWord) {
        console.log('单词已存在');
        // 如果有这个单词
        if (findWord.explains) {
            console.log('单词已存在');
            ElMessage.success('单词已存在');
            return
        }

        const params: YdParams = getParam(wordText)
        wordsStore.translation(params).then(res => {
            let resData = res.data;
            if (resData.errorCode === '0' && !isEmpty(res)) {
                findWord.explains = res.data.translation[0]
                findWord.isReview = true
                findWord.pronunciation = resData.tSpeakUrl
                // todo 音标添加
                findWord.phonetic = ''
                findWord.remember = false
                findWord.level = 1

                wordsStore.addAndUpdateWord(findWord)
                console.log('添加单个单词成功');
                // ElMessage.success('添加成功');
                return
            }
        })

        ElMessage.error('添加失败');
        return;
    }


    const params: YdParams = getParam(wordText)


    console.log(JSON.stringify(params) + '-------')
    wordsStore.translation(params).then(res => {
        // 先判断有没有这个单词，有的话看下这个单词有没有翻译，有的话不做处理，没有更新这个单词

        let resData = res.data;
        console.log(JSON.stringify(resData), '翻译后的返回结果');
        if (resData.errorCode === '0' && !isEmpty(res)) {
            //解构写法
            // const { words } = storeToRefs(wordsStore)
            // words.value
            let oldWords = wordsStore.words
            let newWords = getInitWord(resData.query, resData.translation[0], resData.speakUrl, '', '')

            const data = oldWords ? [newWords, ...oldWords] : [newWords]

            // console.log(data, '更新单词成功');
            wordsStore.addAndUpdateWords(data)

            // ElMessage.success('成功');
            // router.push('/')
        } else {
            ElMessage.error('失败');
            // ElMessage.error(res.data.errmsg)
        }
    })
}

export {getParam, getInitWord, addWord}
