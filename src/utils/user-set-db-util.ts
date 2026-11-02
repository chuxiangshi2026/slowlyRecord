
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
                void db.promises.remove(old._id).catch(() => {});
            }
        }
        void db.promises.put(merged).catch((e) => console.error('[user-set] 收敛写回失败:', e));
    } catch (e) {
        console.error('[user-set] 收敛多文档失败:', e);
    }
    return merged;
}


/**
 * 带冲突重试地修改 user-set：每次重试都重新读取最新文档并重新执行 mutator，
 * 避免只替换 _rev 后整文档覆盖并发窗口刚写入的其他字段。
 */
let setUpdateQueue: Promise<void> = Promise.resolve();

function updateSetDbWithRetry(mutator: (doc: UserSetType) => void, maxAttempts = 3): Promise<boolean> {
    // 串行化当前父窗口内的完整读改写；uTools 跨窗口仍由 _rev 冲突重试兜底
    const run = () => runSetDbUpdateWithRetry(mutator, maxAttempts);
    const task = setUpdateQueue.then(run, run);
    setUpdateQueue = task.then(() => undefined, () => undefined);
    return task;
}

async function runSetDbUpdateWithRetry(mutator: (doc: UserSetType) => void, maxAttempts: number): Promise<boolean> {
    const db = getDbAdapter();
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
        try {
            const latest = getSetDb(true);
            if (!latest) return false;
            const next = cloneDeep(latest);
            mutator(next);
            next._id = DB_KEY_USER_SET;
            const result = await db.promises.put(next);
            if (judgePutResult(next, result)) return true;
            if (!String(result?.message || '').includes('conflict')) {
                console.error('[user-set] 写入失败:', result?.message);
                return false;
            }
        } catch (e) {
            console.error('[user-set] 写入异常:', e);
            return false;
        }
    }
    console.error('[user-set] 写入冲突重试耗尽');
    return false;
}

/** 兼容旧调用：把传入文档的字段覆盖到最新版本，写操作仍走真实冲突重试。 */
function putSetDbWithRetry(doc: UserSetType): Promise<boolean> {
    return updateSetDbWithRetry((latest) => {
        for (const [key, value] of Object.entries(doc)) {
            if (key === '_id' || key === '_rev') continue;
            (latest as any)[key] = cloneDeep(value);
        }
    });
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
        return result;
    }
    // _rev 过期（悬浮窗/定时任务/多窗口先写过 user-set）时直接 put 会冲突失败，
    // 设置静默丢失——下次进入插件 App.vue 又用库里的旧值覆盖内存中的选择，
    // 表现就是"改了翻译引擎，再进来又变回去"。冲突时重读最新文档合并且重试。
    if (String(result.message || '').toLowerCase().includes('conflict')) {
        const retried = await putSetDbWithRetry(userSet);
        if (retried) {
            log.d('设置写入冲突，已重试写入成功');
            const latest = getSetDb(true) as UserSetType | null;
            if (latest?._rev) userSet._rev = latest._rev;
            return { id: DB_KEY_USER_SET, ok: true, rev: userSet._rev };
        }
        // 生产构建会抹掉 console.log，这里用 warn 才能在用户环境留痕
        console.warn('[user-set] 设置写入冲突且重试失败，本次修改可能未保存');
        return result;
    }
    console.warn('[user-set] 保存设置到数据库失败:', result.message);
    return result;
}



/**
 * 按id删除数据库中的单词
 * @param id
 */
function removeSetDb(id: string): void {
    const db = getDbAdapter();
    void db.promises.remove(id).then((result) => {
        if (result.ok) console.log("删除成功");
        else if (result.error) log.e(result.message || '删除失败');
    }).catch((e) => log.e('删除设置失败', e));
}





// 获取用户信息  昵称与头像
// const user = utools.getUser();
// if (user) {
//     console.log(user);
// }
export {getSetDb, addAndUpdateSetDb, removeSetDb, putSetDbWithRetry, updateSetDbWithRetry};
