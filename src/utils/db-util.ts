import type {Word} from "@/types/words";

import {DB_KEY} from "@/constants";
import {log} from "@/utils/logger"
import {getDbAdapter} from "@/adapters/db"
import cloneDeep from 'lodash.clonedeep';
import {normalizeItemText} from "@/utils/text-utils";
/**
 * 获取数据库全部的单词
 * @returns 返回数据库中所有单词的数组
 */
function listDbWords(): Word[] {
    const db = getDbAdapter();
    let allDocs = db.allDocs(DB_KEY);
    log.i('数据库中所有单词', allDocs);
    // 清理单词文本中的空白字符，修复历史脏数据
    return (allDocs as Word[]).map(w => ({ ...w, text: normalizeItemText(w.text) }))
}

/**
 * 将单个单词添加或更新到数据库中
 * @param word - 要添加的单词对象
 * @returns 无返回值
 */
async function addAndUpdateDbWord(word: Word):Promise<DbReturn> {
    log.i('添加单个单词到数据库', word);
    // 转成字符串保存数据库,替换JSON.parse(JSON.stringify(word));
    const cleanedWord = cloneDeep(word)
    // 清理单词文本中的空白字符，防止脏数据入库
    cleanedWord.text = normalizeItemText(cleanedWord.text)
    // console.log('查看去重后的序列化数据',word)
    const db = getDbAdapter();

    // 如果文档已存在，必须先获取最新的 _rev，否则会出现 Document update conflict
    const existing = db.get(cleanedWord._id);
    if (existing?._rev) {
        cleanedWord._rev = existing._rev;
    }

    let result = await db.promises.put(cleanedWord);

    if (result.ok) {
        log.d("添加单个单词到数据库成功")
        // 保存成功, 更新文档版本
        word._rev = result.rev;
    } else if (result.error) {
        // 保存出错，打印错误原因
        console.log('保存单个单词到数据库报错', result.message);
    }
    return result
}

/**
 * 批量创建与更新文档
 * @since 2025/11/5
 */
async function updateDbWordList(docs: Word[]): Promise<DbReturn[]> {
    log.i('批量添加的单词列表', docs);
    // 清理或克隆对象
    const cleanedDocs = docs.map(doc => {
        const cloned = cloneDeep(doc);
        // 清理单词文本中的空白字符，防止脏数据入库
        cloned.text = normalizeItemText(cloned.text);
        return cloned;
    });
    // 检查cleanedDocs是否为空
    if (cleanedDocs.length === 0) {
        console.log('没有需要更新的文档');
        return [];
    }
    // 批量更新数据库
    const db = getDbAdapter();

    // 为每个文档获取最新的 _rev，避免更新冲突
    cleanedDocs.forEach(doc => {
        const existing = db.get(doc._id);
        if (existing?._rev) {
            doc._rev = existing._rev;
        }
    });

    const results = db.bulkDocs(cleanedDocs);


    results.forEach((ret: DbReturn) => {
        // console.log(ret, '更新结果');
        // 更新文档版本
        if (ret.ok) {
            // docs.find(x => x._id === ret.id)?._rev = ret.rev;
            const doc = cleanedDocs.find(x => x._id === ret.id);
            if (doc) {
                doc._rev = ret.rev;
            }
        }
    });
    return results
}

/**
 * 按id删除数据库中的单词
 * @param id
 */
function removeDbWordById(id: string): void {
    const db = getDbAdapter();
    const result = db.remove(id);
    if (result.ok) {
        console.log("删除成功");
    } else if (result.error) {
        // 删除失败，打印错误原因
        log.e(result.message);
    }
}

/**
 * 清空数据库
 * @since 2025/11/5
 */
function cleanDbWord() {
    const db = getDbAdapter();
    const result = db.remove(DB_KEY);
    if (result.ok) {
        console.log("删除成功");
    } else if (result.error) {
        // 删除失败，打印错误原因
        console.log(result.message);
    }
}

/**
 * 按id获取单个单词详情
 * @since 2025/11/5
 */
function getDbWordById(id: string): Word {
    const db = getDbAdapter();
    const word = db.get(id)
    console.log(word, '根据id获取单词');
    return word as Word;
}

// 多端同步时触发
// utools.onDbPull((docs) => {
//     console.log(docs);
// });


// 获取用户信息  昵称与头像
// const user = utools.getUser();
// if (user) {
//     console.log(user);
// }
export {addAndUpdateDbWord, updateDbWordList, listDbWords, removeDbWordById, cleanDbWord};
