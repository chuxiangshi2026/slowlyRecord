/**
 * 诗词坐标覆盖审计：datafile/poetry 下所有条目的 location 必须能被 parseLocation 解析。
 * 新增诗词数据或坐标库变更后运行，防止坐标缺失/误定位回归。
 */
import {describe, expect, it} from 'vitest';
import {readFileSync, readdirSync} from 'fs';
import {fileURLToPath} from 'url';
import {parseLocation} from './poetry-location';

interface PoetryItem {
  id: string;
  title: string;
  location?: string;
}

const poetryDir = fileURLToPath(new URL('../../public/datafile/poetry', import.meta.url));

// 有意不落的非地理标注：银河/神话是神话意象，海上/南渡途中是行旅途注记，
// 均无固定坐标，标注本身有信息价值，地图端本来就按无坐标处理
const INTENTIONAL_NON_GEO = new Set(['银河/神话', '海上/南渡途中']);

function loadAllPoetry(): PoetryItem[] {
  const items: PoetryItem[] = [];
  for (const f of readdirSync(poetryDir)) {
    if (!f.endsWith('.json') || f === 'index.json') continue;
    const data = JSON.parse(readFileSync(`${poetryDir}/${f}`, 'utf8')) as { poems: PoetryItem[] };
    for (const p of data.poems || []) items.push({id: p.id, title: p.title, location: p.location});
  }
  return items;
}

describe('诗词坐标覆盖审计', () => {
  it('所有诗词的 location 均能解析到坐标', () => {
    const all = loadAllPoetry();
    const withLoc = all.filter(p => p.location && p.location.trim());
    const toCheck = withLoc.filter(p => !INTENTIONAL_NON_GEO.has(p.location!.trim()));
    const unresolved = toCheck.filter(p => !parseLocation(p.location));
    const byLoc = new Map<string, number>();
    for (const p of unresolved) {
      byLoc.set(p.location!, (byLoc.get(p.location!) || 0) + 1);
    }
    console.log(`诗词总数 ${all.length}，带 location ${withLoc.length}（其中有意非地理 ${withLoc.length - toCheck.length}），缺坐标 ${unresolved.length}`);
    if (unresolved.length) {
      console.log('未解析 location 分布：');
      [...byLoc.entries()].sort((a, b) => b[1] - a[1]).forEach(([loc, n]) => console.log(`  ${n}× ${loc}`));
    }
    expect(unresolved).toHaveLength(0);
  });
});
