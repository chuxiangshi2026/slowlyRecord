
import { DB_KEY_USER_SET} from "@/constants";
import {log} from "@/utils/logger"
import type { UserSetType } from "@/types/user-set";
import {getDbAdapter} from "@/adapters/db"
import cloneDeep from 'lodash.clonedeep';
/**
 * 获取数据库全部的单词
 * @returns 返回数据库中所有单词的数组
 */
function getSetDb(silent = false): UserSetType | null {
    const db = getDbAdapter();
    let allDocs = db.allDocs(DB_KEY_USER_SET);
    if (!silent) {
        log.i('获取数据库设置', allDocs);
    }
    return (allDocs[0] as UserSetType) || null;
}


/**
 * 将单个单词添加或更新到数据库中
 * @returns 无返回值
 * @param userSet
 */
async function addAndUpdateSetDb(userSet: UserSetType | null):Promise<DbReturn> {
    if (!userSet) {
        return { ok: false, error: true, message: 'UserSet is null' } as DbReturn;
    }
    log.i('添加设置到数据库', userSet);
    // 转成字符串保存数据库,替换JSON.parse(JSON.stringify(word));
    const cleanedWord = cloneDeep(userSet)
    // console.log('查看去重后的序列化数据',word)
    const db = getDbAdapter();
    let result = await db.promises.put(cleanedWord);

    if (result.ok) {
        log.d("添加设置到数据库成功")
        // 保存成功, 更新文档版本
        userSet._rev = result.rev;
    } else if (result.error) {
        // 保存出错，打印错误原因
        console.log('保存设置到数据库报错', result.message);
    }
    return result
}



/**
 * 按id删除数据库中的单词
 * @param id
 */
function removeSetDb(id: string): void {
    const db = getDbAdapter();
    const result = db.remove(id);
    if (result.ok) {
        console.log("删除成功");
    } else if (result.error) {
        // 删除失败，打印错误原因
        log.e(result.message);
    }
}





// 获取用户信息  昵称与头像
// const user = utools.getUser();
// if (user) {
//     console.log(user);
// }
export {getSetDb, addAndUpdateSetDb, removeSetDb};
