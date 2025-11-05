/* 日志级别 */
const enum Level {
    DEBUG = 0,
        INFO  = 1,
        WARN  = 2,
        ERROR = 3,
        SILENT = 4
}

/* 运行时级别，由构建工具注入 */
declare const __LOG_LEVEL__: Level;   // vite 会在 define 里注入

const CUR: Level = (() => {
    try {
        return typeof __LOG_LEVEL__ !== 'undefined' ? __LOG_LEVEL__
            : (import.meta.env.DEV ? Level.DEBUG : Level.WARN);
    } catch { return Level.WARN; }
})();

/* 工具类型：把 console 方法名映射出来 */
type ConsoleMethod = 'debug' | 'info' | 'warn' | 'error';

/* 真正打印函数 */
function print(method: ConsoleMethod, lvl: Level, prefix: string, ...args: unknown[]): void {
    if (lvl < CUR) return;
    console[method](prefix, ...args);
}

/* 统一前缀 */
const now = () => new Date().toISOString().slice(11, 23);

/* 对外 API */
export const log = {
    d: (...args: unknown[]) => print('debug', Level.DEBUG, `[DBG ${now()}]`, ...args),
    i: (...args: unknown[]) => print('info',  Level.INFO,  `[INF ${now()}]`, ...args),
    w: (...args: unknown[]) => print('warn',  Level.WARN,  `[WRN ${now()}]`, ...args),
    e: (...args: unknown[]) => print('error', Level.ERROR, `[ERR ${now()}]`, ...args),
};
