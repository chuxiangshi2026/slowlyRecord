import {APP_KEY,  FROM, KEY, TO} from "@/constants";
import {truncate} from "lodash";
import CryptoJS from "crypto-js";
import type {Word, YdParams} from "@/types/words";
import {v4 as uuidv4} from "uuid";

const getParam = (query:string) => {

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
        // 用户上传的术语表
        // vocabId: vocabId,
    }
    return params;
}


const getInitWord = (text:string,explainedInChinese:string,pronunciation:string,image:string='',phonetic:string='') => {
    let newWords: Word = {
        "text": text,
        "explainedInChinese": explainedInChinese,
        "pronunciation": pronunciation,
        "isReview": true,
        "creatTime": new Date(),
        "reviewTime": new Date(),
        "level": 0,
        "_id": uuidv4(), // 假设_id为必填项
        "_rev": '', // 假设_rev为必填项
        "image": image, // 假设image为必填项
        "phonetic": phonetic, // 假设phonetic为必填项

        // "image": resData.image
        // phonetic: resData.phonetic,
        // updateTime: new Date()
    };
    return newWords;
}

export {getParam,getInitWord}
