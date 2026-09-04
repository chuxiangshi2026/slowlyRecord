/**
 * 现象动画映射：条目 id → 专属场景配置。
 * 每条反应单独配置容器、液体颜色、粒子效果与现象文案；没有映射的条目不显示「现象动画」按钮。
 * 全部用 Canvas 代码绘制，不引入任何图片/视频资源。
 */

/** 一个专属现象动画的完整配置 */
export interface SceneConfig {
    /** 容器形状：试管 / 烧杯 / 无容器（燃烧类纯火焰场景） */
    vessel: 'testTube' | 'beaker' | 'none';
    /** 液面高度比例（从容底部算起，0-1），默认 0.65 */
    liquidLevel?: number;
    /** 液体颜色（无液体则不画） */
    liquidColor?: string;
    /** 气泡颜色：设置后产生上升气泡（气体逸出） */
    bubbleColor?: string;
    /** 沉淀颗粒颜色：设置后产生下沉颗粒并在底部堆积（沉淀生成） */
    sedimentColor?: string;
    /** 火星颜色组：设置后从火焰处飞溅火星（燃烧类） */
    sparkColors?: string[];
    /** 主火焰颜色：燃烧类画面中央的火焰，或加热类容器底部的小火焰 */
    flameColor?: string;
    /** 容器底部加热火焰（加热制气类） */
    heating?: boolean;
    /** 现象说明文案 */
    caption: string;
}

/** 条目 id → 专属现象动画配置 */
export const SCENE_ANIMATIONS: Record<string, SceneConfig> = {
    // 氢气的燃烧：淡蓝色火焰
    'chemistry-formulas-8': {
        vessel: 'none',
        flameColor: '#7db9e8',
        sparkColors: ['#a8d4f0', '#7db9e8', '#e8f4fc'],
        caption: '现象：安静地燃烧，发出淡蓝色火焰，放出大量的热，烧杯内壁出现水珠',
    },
    // 碳的完全燃烧：发白光
    'chemistry-formulas-9': {
        vessel: 'none',
        flameColor: '#ffb84d',
        sparkColors: ['#ffd591', '#ff9c6e', '#fff2e8'],
        caption: '现象：剧烈燃烧，发出白光，放出热量，生成能使澄清石灰水变浑浊的气体',
    },
    // 硫在氧气中燃烧：蓝紫色火焰
    'chemistry-formulas-10': {
        vessel: 'none',
        flameColor: '#9d8df1',
        sparkColors: ['#b8a9f5', '#9d8df1', '#d6ccf7'],
        caption: '现象：发出明亮的蓝紫色火焰，放出热量，生成有刺激性气味的气体',
    },
    // 铁在氧气中燃烧：火星四射
    'chemistry-formulas-11': {
        vessel: 'none',
        flameColor: '#ff7a45',
        sparkColors: ['#ffd591', '#ff9c6e', '#ff4d4f'],
        caption: '现象：剧烈燃烧，火星四射，放出大量的热，生成黑色固体',
    },
    // 过氧化氢分解制氧气：常温催化，大量气泡
    'chemistry-formulas-12': {
        vessel: 'testTube',
        liquidColor: '#e8f2f8',
        bubbleColor: '#6ba8c9',
        caption: '现象：常温下迅速产生大量气泡（二氧化锰作催化剂，本身不变）',
    },
    // 加热高锰酸钾制氧气：紫色固体 + 加热
    'chemistry-formulas-13': {
        vessel: 'testTube',
        liquidColor: '#e3dcef',
        bubbleColor: '#9d8df1',
        heating: true,
        flameColor: '#ff9c6e',
        caption: '现象：加热后导管口有连续气泡冒出，暗紫色固体逐渐变化',
    },
    // 氯酸钾催化分解制氧气：加热 + 催化
    'chemistry-formulas-14': {
        vessel: 'testTube',
        liquidColor: '#f0ece4',
        bubbleColor: '#c9a86b',
        heating: true,
        flameColor: '#ff9c6e',
        caption: '现象：加热并加入二氧化锰催化后，有气泡连续冒出',
    },
    // 实验室制二氧化碳：烧杯中石灰石与稀盐酸反应
    'chemistry-formulas-15': {
        vessel: 'beaker',
        liquidColor: '#e8f2f8',
        bubbleColor: '#6ba8c9',
        caption: '现象：块状石灰石表面产生大量气泡，固体逐渐溶解变小',
    },
    // 二氧化碳通入澄清石灰水：白色沉淀
    'chemistry-formulas-18': {
        vessel: 'beaker',
        liquidColor: '#dce8ee',
        sedimentColor: '#ffffff',
        caption: '现象：澄清石灰水变浑浊，白色碳酸钙沉淀逐渐沉降到杯底',
    },
};

/**
 * 根据条目 id 查找现象动画配置。
 * @returns 场景配置；条目无动画时返回 null（调用方不显示按钮）
 */
export function getSceneAnimation(itemId: string): SceneConfig | null {
    return SCENE_ANIMATIONS[itemId] ?? null;
}
