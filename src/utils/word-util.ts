import type {Word} from "@/types/words";
import {DB_KEY} from "@/constants";
import {v4 as uuidv4} from "uuid";
import {formatDateTime} from "@/utils/date-util";

/**
 * 解析文件内容为单词列表
 * @param content 文件内容
 * @returns 单词列表
 */
export const parseFileContent = (content: string): Word[] => {
    const lines = content.split(/\r?\n/); // 按行分割，兼容Windows和Unix换行符
    return lines
        .map(line => line.trim()) // 去除空格
        .filter(line => line.length > 0) // 过滤空行
        .map(line => {
            // 处理CSV格式，如果包含逗号则分割
            const parts = line.includes(',') ? line.split(',') : [line];

            // 解析创建时间和学习时间
            let ctime: Date | string = new Date();
            let learnDate: Date | string = new Date();
            // 如果parts数组长度足够，且对应位置有时间字符串，则尝试解析
            if (parts.length >= 5 && parts[4]) {
                // 检查是否为格式化的时间字符串 YYYY-MM-DD HH:mm:ss
                const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                if (timeRegex.test(parts[4].trim())) {
                    ctime = parts[4].trim();
                } else {
                    // 尝试解析为日期对象
                    const parsedDate = new Date(parts[4].trim());
                    if (!isNaN(parsedDate.getTime())) {
                        ctime = parsedDate;
                    }
                }
            }

            if (parts.length >= 6 && parts[5]) {
                // 检查是否为格式化的时间字符串 YYYY-MM-DD HH:mm:ss
                const timeRegex = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
                if (timeRegex.test(parts[5].trim())) {
                    learnDate = parts[5].trim();
                } else {
                    // 尝试解析为日期对象
                    const parsedDate = new Date(parts[5].trim());
                    if (!isNaN(parsedDate.getTime())) {
                        learnDate = parsedDate;
                    }
                }
            }

            // 解析等级，确保它是 0-12 之间的有效值
            const levelStr = parts[6] ? parts[6].trim() : '1';
            let level: 0|1|2|3|4|5|6|7|8|9|10|11|12 = 1;
            const parsedLevel = parseInt(levelStr);
            if (!isNaN(parsedLevel) && parsedLevel >= 0 && parsedLevel <= 12) {
                level = parsedLevel as 0|1|2|3|4|5|6|7|8|9|10|11|12;
            }


            return {
                text: parts[0].trim(), // 第一列作为单词
                explains: parts[1] ? parts[1].trim() : '', // 第二列作为释义（如果有）
                explainedHidden: parts[2] ? parts[2].trim() === 'true' : false,
                isReview: parts[3] ? parts[3].trim() === 'true' : true,
                ctime: new Date(ctime), // 确保是Date对象
                learnDate: new Date(learnDate), // 确保是Date对象
                level: level,
                _id: DB_KEY + uuidv4(), // 生成唯一ID
                image: '',
                phonetic: '', // 音标将在翻译时填充
                remember: false
            };
        });
};


/**
 * 过滤单词属性用于JSON导出
 * @param words 单词列表
 * @returns 过滤后的单词列表
 */
export const filterWordsForJsonExport = (words: Word[]): any[] => {
    return words.map(word => ({
        text: word.text,
        explains: word.explains,
        explainedHidden: word.explainedHidden,
        isReview: word.isReview,
        ctime: formatDateTime(word.ctime),
        learnDate: formatDateTime(word.learnDate),
        level: word.level
    }));
};


/**
 * 过滤单词属性用于文本导出
 * @param words 单词列表
 * @returns 格式化后的字符串
 */
export const filterWordsForTextExport = (words: Word[]): string => {
    return words.map(word =>
        `${word.text}, ${word.explains},${word.explainedHidden},${word.isReview}, ${formatDateTime(word.ctime)},${formatDateTime(word.learnDate)}, ${word.level}`
    ).join('\n');
};


/**
 * 验证导入的单词数据
 * @param words 导入的单词列表
 * @returns 验证后的单词列表
 */
export const validateImportedWords = (words: any[]): any[] => {
    return words
        .filter((word) => {
            // 校验必填字段
            return (
                typeof word.text === 'string'
            );
        })
        .map((word) => ({
            ...word,
            _id: word._id || DB_KEY + uuidv4(), // 添加_id属性
            image: word.image || '', // 补全image属性
            phonetic: word.phonetic || '', // 补全phonetic属性
            explainedHidden: word.explainedHidden || false, // 补全explainedHidden属性
            isReview: word.isReview || true, // 补全isReview属性
            ctime: word.ctime ? new Date(word.ctime) : new Date(), // 确保是Date对象
            learnDate: word.learnDate ? new Date(word.learnDate) : new Date(), // 确保是Date对象
            level: word.level || 1, // 补全level属性
            remember: word.remember || false, // 补全remember属性
            explains: word.explains || '', // 确保有explains属性
            pronunciation: word.pronunciation || '' // 确保有发音属性
        }));
};

