import type {Word} from "@/types/words";
import {DB_KEY} from "@/constants";

export const testData: Word[] = [{
    "_id": DB_KEY + '1', // 添加 _id
    // 是否需要复习
    "isReview": true,
    "text": 'abandon',
    // isWord: true,
    "ctime": new Date(),
    "learnDate": new Date(),
    // updateTime: '2023-01-03',
    "explains": '放弃',
    "explainedHidden": false,
    "level": 0,
    "image": 'https://www.baidu.com/img/flexible/logo/pc/result.png',
    "pronunciation": 'https://dict.youdao.com/dictvoice?audio=abandon&type=1',
    "phonetic": '[əˈbændən]',
    "remember": false
}, {
    "_id": DB_KEY + '2', // 添加 _id
    "isReview": true,
    "text": 'book',
    // isWord: true,
    "ctime": new Date(),
    "learnDate": new Date(),
    // updateTime: '2023-01-03',
    "explains": '书',
    "explainedHidden": false,
    "level": 0,
    "image": 'https://www.baidu.com/img/flexible/logo/pc/result.png',
    "pronunciation": 'https://dict.youdao.com/dictvoice?audio=abandon&type=1',
    "phonetic": '[əˈbændən]',
    "remember": false
}]
