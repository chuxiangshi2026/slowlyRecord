/**
 * 数字谐音/助记示例库
 *
 * 提供少量经典示例，帮助用户快速体验 mnemonic 功能。
 */
import type {NumberMemoryKind} from '@/types/number-memory';

/** π 的经典谐音助记（前 20 位：3.14159 26535 89793 23846） */
export const PI_MNEMONIC_20 = '山巅一寺一壶酒，尔乐苦煞吾，把酒吃，酒杀尔，杀不死，乐而乐';

/** π 前 10 位谐音 */
export const PI_MNEMONIC_10 = '山巅一寺一壶酒，尔乐苦煞吾';

interface MnemonicExample {
    kind: NumberMemoryKind;
    numbers: string;
    title: string;
    mnemonic: string;
}

/** 内置示例列表 */
export const MNEMONIC_EXAMPLES: MnemonicExample[] = [
    {
        kind: 'pi',
        numbers: '3.14159265358979323846',
        title: '圆周率前 20 位',
        mnemonic: PI_MNEMONIC_20,
    },
    {
        kind: 'pi',
        numbers: '3.1415926535',
        title: '圆周率前 10 位',
        mnemonic: PI_MNEMONIC_10,
    },
    {
        kind: 'phone',
        numbers: '13800138000',
        title: '示例手机号',
        mnemonic: '一动吧，铃铃动，一动吧，铃铃动，动一动',
    },
    {
        kind: 'date',
        numbers: '20260902',
        title: '示例日期',
        mnemonic: '二零二六零九零二，秋意渐浓',
    },
    {
        kind: 'qq',
        numbers: '123456789',
        title: '示例 QQ 号',
        mnemonic: '一二三，四五六，七八九，节节高',
    },
];

/**
 * 根据类型和数字串获取推荐助记
 * @param kind 数字类型
 * @param numbers 数字串（用于精确匹配 π 等示例）
 * @returns 助记文本，未找到时返回 undefined
 */
export function getMnemonicExample(kind: NumberMemoryKind, numbers?: string): string | undefined {
    if (kind !== 'pi' || !numbers) {
        // 非 π 类型返回该类型的第一条示例助记（如果有）
        return MNEMONIC_EXAMPLES.find(e => e.kind === kind)?.mnemonic;
    }

    // π 尽量按数字长度匹配
    const normalized = numbers.startsWith('3.') ? numbers : `3.${numbers}`;
    const exact = MNEMONIC_EXAMPLES.find(
        e => e.kind === 'pi' && normalized.startsWith(e.numbers),
    );
    if (exact) return exact.mnemonic;

    // 默认返回前 10 位示例
    return MNEMONIC_EXAMPLES.find(e => e.kind === 'pi' && e.numbers === '3.1415926535')?.mnemonic;
}
