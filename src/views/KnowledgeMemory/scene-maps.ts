/**
 * 现象动画映射：条目 id → 通用粒子场景类型。
 * 用于化学方程式等有宏观现象但不适合函数图像的条目；没有映射的条目不显示「现象动画」按钮。
 */

/** 通用粒子场景：气体逸出（气泡上升）/ 沉淀生成（颗粒下沉堆积）/ 燃烧（火星飞溅） */
export type SceneType = 'gas' | 'precipitate' | 'burn';

/** 条目 id → 现象动画类型 */
export const SCENE_ANIMATIONS: Record<string, SceneType> = {
    // 燃烧类：火星四射、发光放热
    'chemistry-formulas-8': 'burn', // 氢气的燃烧
    'chemistry-formulas-9': 'burn', // 碳的完全燃烧
    'chemistry-formulas-10': 'burn', // 硫在氧气中燃烧
    'chemistry-formulas-11': 'burn', // 铁在氧气中燃烧
    // 气体逸出类：有气泡产生（↑）
    'chemistry-formulas-12': 'gas', // 过氧化氢分解制氧气
    'chemistry-formulas-13': 'gas', // 加热高锰酸钾制氧气
    'chemistry-formulas-14': 'gas', // 氯酸钾催化分解制氧气
    'chemistry-formulas-15': 'gas', // 实验室制二氧化碳
    // 沉淀类：澄清石灰水变浑浊（↓）
    'chemistry-formulas-18': 'precipitate', // 二氧化碳通入澄清石灰水
};

/**
 * 根据条目 id 查找现象动画。
 * @returns 动画类型；条目无动画时返回 null（调用方不显示按钮）
 */
export function getSceneAnimation(itemId: string): SceneType | null {
    return SCENE_ANIMATIONS[itemId] ?? null;
}
