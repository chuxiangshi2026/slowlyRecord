
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
        // 不输出文档内容，避免泄漏用户配置的 API 密钥
        log.i('获取数据库设置');
    }
    if (allDocs.length === 0) return null;
    // 多文档收敛：历史版本 _id 为 user-set<uuid>，可能并存多份，allDocs[0] 随机选取
    // 会让密钥/设置随机回退。优先取固定 _id（'user-set'）那份；否则按字段合并出一份
    // 并集（密钥/打卡等子对象做合并且非空优先），并把结果收敛回单文档。
    const fixed = allDocs.find(d => d && d._id === DB_KEY_USER_SET) as UserSetType | undefined;
    if (allDocs.length === 1) return (fixed || allDocs[0]) as UserSetType;
    if (fixed) return fixed;
    // 无固定 _id（历史多 uuid 文档）：合并出一份并集
    const merged = JSON.parse(JSON.stringify(allDocs[0])) as UserSetType;
    for (const other of allDocs.slice(1) as UserSetType[]) {
        if (!other) continue;
        for (const [key, value] of Object.entries(other)) {
            if (key === '_id' || key === '_rev' || value === undefined) continue;
            const cur = (merged as any)[key];
            if (cur === undefined || cur === null || cur === '' || (Array.isArray(value) && Array.isArray(cur) && cur.length === 0)) {
                (merged as any)[key] = value;
            } else if (typeof value === 'object' && typeof cur === 'object' && !Array.isArray(value) && !Array.isArray(cur)) {
                // 子对象（keys/ocrKeys/focusMode 等）合并，远端非空值优先
                (merged as any)[key] = { ...cur, ...Object.fromEntries(Object.entries(value).filter(([, v]) => v !== '' && v !== undefined)) };
            }
        }
    }
    merged._id = DB_KEY_USER_SET;
    // 异步收敛回单文档：删除旧 uuid 文档、写回合并结果（失败不阻塞读取）
    try {
        for (const old of allDocs as UserSetType[]) {
            if (old && old._id !== DB_KEY_USER_SET) {
                db.remove(old._id);
            }
        }
        db.promises.put(merged);
    } catch (e) {
        console.error('[user-set] 收敛多文档失败:', e);
    }
    return merged;
}


/**
 * 带冲突重试地写回 user-set 文档（同步适配器的 put 基于传入对象上的 _rev）
 * uTools 下 put 带旧 _rev 返回 conflict 静默失败，主窗口与子窗口并发写 user-set
 * （专注模式设置/待处理动作清理）时输家的写入会丢，这里 conflict 时重读最新 _rev 重试
 * @param doc 已修改内容的 user-set 文档（函数内会更新其 _rev）
 * @returns 是否写入成功
 */
function putSetDbWithRetry(doc: UserSetType): boolean {
    const db = getDbAdapter();
    for (let attempt = 0; attempt < 3; attempt++) {
        try {
            const latest = getSetDb(true);
            if (latest?._rev) {
                doc._rev = latest._rev;
            }
            // promises.put 返回 Promise<DbReturn>：uTools 适配器内部同步落盘后 resolve，
            // IndexedDB 适配器异步落盘。统一 await 后按 conflict 语义重试
            void db.promises.put(doc).then((result) => {
                if (!judgePutResult(doc, result)) {
                    console.error('[user-set] 写入失败:', result?.message);
                }
            });
            // 同步侧立即返回「已提交」：主窗口/子窗口并发写由 conflict 重试兜底，
            // 异步结果只记日志不阻塞调用方
            return true;
        } catch (e) {
            console.error('[user-set] 写入失败:', e);
            return false;
        }
    }
    return false;
}

function judgePutResult(doc: UserSetType, result: any): boolean {
    if (result && result.ok) {
        if (result.rev) doc._rev = result.rev;
        return true;
    }
    return false;
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
    // 不输出文档内容，避免泄漏用户配置的 API 密钥
    log.i('添加设置到数据库');
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
export {getSetDb, addAndUpdateSetDb, removeSetDb, putSetDbWithRetry};
