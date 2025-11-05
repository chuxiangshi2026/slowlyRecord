import type {Word} from "@/types/words";

import {DB_KEY} from "@/constants";
import {log} from "@/utils/logger"
/**
 * 获取数据库全部的单词
 * @returns 返回数据库中所有单词的数组
 */
function listDbWords(): Word[] {
    let allDocs = window.utools.db.allDocs(DB_KEY);
    log.i('数据库中所有单词', allDocs);
    return allDocs as Word[]
}

/**
 * 将单个单词添加或更新到数据库中
 * @param word - 要添加的单词对象
 * @returns 无返回值
 */
async function addAndUpdateDbWord(word: Word):Promise<DbReturn> {
    log.i('添加单个单词到数据库', word);
    // 转成字符串保存数据库,替换JSON.parse(JSON.stringify(word));
    const cleanedWord = structuredClone(word)
    //
    return await window.utools.db.promises.put(cleanedWord);
    // let result =
    // if (result.ok) {
    //
    //     log.d("添加单个单词到数据库成功")
    //     // 保存成功, 更新文档版本
    //     word._rev = result.rev;
    // } else if (result.error) {
    //     // 保存出错，打印错误原因
    //     console.log('保存单个单词到数据库报错', result.message);
    // }

}

/**
 * 批量创建与更新文档
 * @since 2025/11/5
 */
async function updateDbWordList(docs: Word[]): Promise<DbReturn[]> {
    log.i('批量添加的单词列表', docs);
    // 清理或克隆对象
    const cleanedDocs = docs.map(doc => JSON.parse(JSON.stringify(doc)));
    // 检查cleanedDocs是否为空
    if (cleanedDocs.length === 0) {
        console.log('没有需要更新的文档');
        return [];
    }
    // 批量更新数据库
    const results = window.utools.db.bulkDocs(cleanedDocs);

    /*console.log(results, '批量更新结果');
    const docs1 = window.utools.db.allDocs()
    console.log(docs1, '获取批量结果');
    if (!results) {
        console.error('批量更新失败', results);
        return [];
    }*/
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
    const result = window.utools.db.remove(id);
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
    const words = listDbWords();

    words.forEach((word: Word) => {
        removeDbWordById(word._id);
    })
}

/**
 * 按id获取单个单词详情
 * @since 2025/11/5
 */
function getDbWordById(id: string): Word {
    const word = window.utools.db.get(id)
    console.log(word, '根据id获取单词');
    return word as Word;
}

/*function showNotification(text: string): void {
    window.utools.showNotification(text);
}*/

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
