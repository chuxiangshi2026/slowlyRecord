import type {Word} from "@/types/words";
import type {DbResult} from "@/types/db";
import {DB_KEY} from "@/constants";


function listDbWords(): Word[] {

    let allDocs = window.utools.db.allDocs(DB_KEY);
    // console.log(allDocs, '所有单词');
    return allDocs
}


function addDbWord(word: Word): void {
    // console.log(word, '添加单个单词到数据库');
    // 清理或克隆对象
    const cleanedWord = JSON.parse(JSON.stringify(word));
    //
    let result = window.utools.db.put(cleanedWord);
    if (result.ok) {
        // 保存成功, 更新文档版本
        word._rev = result.rev;
    } else if (result.error) {
        // 保存出错，打印错误原因
        console.log(result.message, '保存单个单调报错');
    }

}

// 批量创建与更新文档
async function updateDbWordList(docs: Word[]): Promise<DbResult[]> {
    // 清理或克隆对象
    const cleanedDocs = docs.map(doc => JSON.parse(JSON.stringify(doc)));
    // console.log(docs, '批量添加的单词');
    // 检查cleanedDocs是否为空
    /*  if (cleanedDocs.length === 0) {
          console.log('没有需要更新的文档');
          return [];
      }*/

    const results = window.utools.db.bulkDocs(cleanedDocs);

    /*console.log(results, '批量更新结果');
    const docs1 = window.utools.db.allDocs()
    console.log(docs1, '获取批量结果');
    if (!results) {
        console.error('批量更新失败', results);
        return [];
    }*/
    results.forEach((ret: DbResult) => {
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

function removeDbWordById(id: string): void {
    const result = window.utools.db.remove(id);
    if (result.ok) {
        console.log("删除成功");
    } else if (result.error) {
        // 删除失败，打印错误原因
        console.log(result.message);
    }
}

function cleanDbWord() {
    const words = listDbWords();

    words.forEach((word: Word) => {
        removeDbWordById(word._id);
    })
}

function getDbWordById(id: string): Word {
    const word = window.utools.db.get(id)
    console.log(word, '根据id获取单词');
    return word;
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
export {addDbWord, updateDbWordList, listDbWords, removeDbWordById,cleanDbWord};
