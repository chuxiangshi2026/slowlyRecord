/**
 * 数字记忆条目格式化与校验工具
 */
import type {NumberMemoryEntry, NumberMemoryKind} from '@/types/number-memory';

/** 类型中文映射 */
export const KIND_LABELS: Record<NumberMemoryKind, string> = {
    pi: '圆周率',
    phone: '手机号',
    idcard: '身份证',
    qq: 'QQ',
    email: '邮箱',
    bankcard: '银行卡',
    plate: '车牌',
    date: '日期',
    custom: '自定义',
};

/** 兜底默认类型 */
export const DEFAULT_KIND: NumberMemoryKind = 'custom';

/**
 * 获取条目的有效类型（旧数据无 kind 时返回 custom）
 */
export function getEntryKind(entry: NumberMemoryEntry): NumberMemoryKind {
    return entry.kind || DEFAULT_KIND;
}

/**
 * 按 kind 对数字串进行分段显示
 * @param numbers 原始数字串
 * @param kind 数字类型
 * @returns 分段后的字符串，无 kind 时原样返回
 */
export function segmentNumber(numbers: string, kind?: NumberMemoryKind): string {
    if (!numbers) return '';

    switch (kind) {
        case 'phone':
            return segmentByPattern(numbers, [3, 4, 4]);
        case 'idcard':
            return segmentByPattern(numbers, [6, 8, 4]);
        case 'qq': {
            // 长度 10 时按 3-3-4，其余按 4 位一组
            if (numbers.length === 10) return segmentByPattern(numbers, [3, 3, 4]);
            return segmentByPattern(numbers, [4, 4, 4, 4]);
        }
        case 'bankcard':
            return segmentByPattern(numbers, [4, 4, 4, 4, 4, 4]);
        case 'pi': {
            // 允许以 "3." 开头，小数点后按 5 位一组
            let prefix = '';
            let body = numbers;
            if (body.startsWith('3.')) {
                prefix = '3.';
                body = body.slice(2);
            }
            const groups: string[] = [];
            for (let i = 0; i < body.length; i += 5) {
                groups.push(body.slice(i, i + 5));
            }
            return prefix + groups.join(' ');
        }
        case 'date': {
            const d = numbers.trim();
            if (/^\d{14}$/.test(d)) {
                return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}:${d.slice(12, 14)}`;
            }
            if (/^\d{12}$/.test(d)) {
                return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)} ${d.slice(8, 10)}:${d.slice(10, 12)}`;
            }
            if (/^\d{8}$/.test(d)) {
                return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
            }
            return d;
        }
        case 'email':
        case 'plate':
        case 'custom':
        default:
            return numbers;
    }
}

/**
 * 按固定分组长度分段
 */
function segmentByPattern(numbers: string, pattern: number[]): string {
    const groups: string[] = [];
    let index = 0;
    for (const len of pattern) {
        if (index >= numbers.length) break;
        groups.push(numbers.slice(index, index + len));
        index += len;
    }
    if (index < numbers.length) {
        groups.push(numbers.slice(index));
    }
    return groups.join(' ');
}

/** 条目导出的单条字段（与 NumberMemoryEntries.vue 的 JSON 导入解析字段保持往返一致） */
export interface EntryExportItem {
    title: string;
    numbers: string;
    tags: string[];
    kind: NumberMemoryKind;
    description?: string;
    mnemonic?: string;
}

/**
 * 将条目列表序列化为导入兼容的 JSON 字符串（仅含导入解析所需的业务字段）
 */
export function buildEntriesExportJson(entries: NumberMemoryEntry[]): string {
    const items: EntryExportItem[] = entries.map(entry => ({
        title: entry.title,
        numbers: entry.numbers,
        tags: [...entry.tags],
        kind: getEntryKind(entry),
        ...(entry.description ? {description: entry.description} : {}),
        ...(entry.mnemonic ? {mnemonic: entry.mnemonic} : {}),
    }));
    return JSON.stringify(items, null, 2);
}

export interface ValidateResult {
    valid: boolean;
    message?: string;
}

/**
 * 对数字串做基础格式校验，校验不通过仅用于提示，不阻断保存
 */
export function validateNumber(numbers: string, kind?: NumberMemoryKind): ValidateResult {
    if (!numbers) {
        return {valid: false, message: '数字串为空'};
    }

    switch (kind) {
        case 'phone': {
            if (!/^\d{11}$/.test(numbers)) {
                return {valid: false, message: '手机号应为 11 位数字'};
            }
            return {valid: true};
        }
        case 'idcard': {
            if (!/^\d{17}[\dXx]$/.test(numbers)) {
                return {valid: false, message: '身份证应为 18 位，末位可为数字或 X'};
            }
            return {valid: true};
        }
        case 'qq': {
            if (!/^\d{5,11}$/.test(numbers)) {
                return {valid: false, message: 'QQ 号应为 5-11 位数字'};
            }
            return {valid: true};
        }
        case 'bankcard': {
            if (!/^\d{13,19}$/.test(numbers)) {
                return {valid: false, message: '银行卡号应为 13-19 位数字'};
            }
            return {valid: true};
        }
        case 'pi': {
            const body = numbers.startsWith('3.') ? numbers.slice(2) : numbers;
            if (!/^\d+$/.test(body)) {
                return {valid: false, message: 'π 应为数字，可带 "3." 前缀'};
            }
            return {valid: true};
        }
        case 'date': {
            // 8 位日期，或 8+4 位、8+4+2 位（时分秒）；非捕获分组避免 10 位被误放行
            if (!/^\d{8}(?:\d{4}(?:\d{2})?)?$/.test(numbers)) {
                return {valid: false, message: '日期应为 8/12/14 位数字（YYYYMMDD...）'};
            }
            return {valid: true};
        }
        case 'plate': {
            if (numbers.length < 5 || numbers.length > 10) {
                return {valid: false, message: '车牌号长度异常'};
            }
            return {valid: true};
        }
        case 'email':
        case 'custom':
        default:
            return {valid: true};
    }
}
