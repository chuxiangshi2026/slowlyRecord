/** 单位定义：1 单位 = factor 个基准单位（温度除外，走公式特判） */
export interface UnitDef {
  name: string;
  factor: number;
}

export interface UnitCategory {
  key: string;
  label: string;
  /** 基准单位名（如「米」「千克」） */
  base: string;
  units: UnitDef[];
}

/** 常用计量单位分类（温度单独公式换算，不参与 factor 换算） */
export const UNIT_CATEGORIES: UnitCategory[] = [
  {
    key: 'length',
    label: '长度',
    base: '米',
    units: [
      {name: '毫米', factor: 0.001},
      {name: '厘米', factor: 0.01},
      {name: '分米', factor: 0.1},
      {name: '米', factor: 1},
      {name: '千米', factor: 1000},
      {name: '英寸', factor: 0.0254},
      {name: '英尺', factor: 0.3048},
      {name: '英里', factor: 1609.344},
      {name: '里', factor: 500},
      {name: '丈', factor: 10 / 3},
      {name: '尺', factor: 1 / 3},
      {name: '寸', factor: 1 / 30},
    ],
  },
  {
    key: 'area',
    label: '面积',
    base: '平方米',
    units: [
      {name: '平方厘米', factor: 0.0001},
      {name: '平方米', factor: 1},
      {name: '公顷', factor: 10000},
      {name: '平方千米', factor: 1000000},
      {name: '亩', factor: 2000 / 3},
    ],
  },
  {
    key: 'volume',
    label: '体积容积',
    base: '升',
    units: [
      {name: '毫升', factor: 0.001},
      {name: '升', factor: 1},
      {name: '立方米', factor: 1000},
    ],
  },
  {
    key: 'mass',
    label: '质量',
    base: '千克',
    units: [
      {name: '克', factor: 0.001},
      {name: '千克', factor: 1},
      {name: '吨', factor: 1000},
      {name: '斤', factor: 0.5},
      {name: '两', factor: 0.05},
      {name: '磅', factor: 0.45359237},
    ],
  },
  {
    key: 'time',
    label: '时间',
    base: '秒',
    units: [
      {name: '秒', factor: 1},
      {name: '分', factor: 60},
      {name: '时', factor: 3600},
      {name: '天', factor: 86400},
      {name: '周', factor: 604800},
    ],
  },
  {
    key: 'speed',
    label: '速度',
    base: '米每秒',
    units: [
      {name: '米每秒', factor: 1},
      {name: '千米每小时', factor: 1 / 3.6},
    ],
  },
  {
    key: 'temperature',
    label: '温度',
    base: '摄氏度',
    units: [
      {name: '摄氏度', factor: 1},
      {name: '华氏度', factor: 1},
      {name: '开尔文', factor: 1},
    ],
  },
];

/** 温度换算（经摄氏度中转），单位名不在表内返回 null */
function convertTemperature(fromName: string, toName: string, value: number): number | null {
  // 各温标 → 摄氏度
  const toC: Record<string, (v: number) => number> = {
    '摄氏度': v => v,
    '华氏度': v => (v - 32) * 5 / 9,
    '开尔文': v => v - 273.15,
  };
  // 摄氏度 → 各温标
  const fromC: Record<string, (v: number) => number> = {
    '摄氏度': v => v,
    '华氏度': v => v * 9 / 5 + 32,
    '开尔文': v => v + 273.15,
  };
  const toCelsius = toC[fromName];
  const toTarget = fromC[toName];
  if (!toCelsius || !toTarget) return null;
  return toTarget(toCelsius(value));
}

/**
 * 单位换算：value 个 fromName 单位 = 多少个 toName 单位。
 * 查不到类别或单位返回 null。
 */
export function convertUnit(categoryKey: string, fromName: string, toName: string, value: number): number | null {
  const category = UNIT_CATEGORIES.find(c => c.key === categoryKey);
  if (!category) return null;
  if (category.key === 'temperature') {
    return convertTemperature(fromName, toName, value);
  }
  const from = category.units.find(u => u.name === fromName);
  const to = category.units.find(u => u.name === toName);
  if (!from || !to) return null;
  return value * from.factor / to.factor;
}
