#!/usr/bin/env node
/**
 * 面积/体积公式推导图预渲染管线：为 math-formulas 包中几何条目生成推导示意 PNG。
 *
 * 与 render-formula-pngs.cjs（MathJax 公式）互补：本脚本手绘 SVG 几何图形（网格/割补/
 * 拼接/展开），再用 Puppeteer 截图输出 PNG，双端共用同一产物：
 *   - public/knowledgebanks/images/                            桌面端
 *   - mobile/src/subPackages/pages-knowledge/static/knowledgebanks/images/  移动端分包
 *
 * 条目 JSON 里 image 字段记 "knowledgebanks/images/geo-<名>.png"。
 * 改动图形后重跑：node scripts/render-geometry-pngs.cjs
 *
 * 依赖：puppeteer（仓库已有）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIRS = [
  path.join(ROOT, 'public', 'knowledgebanks', 'images'),
  path.join(ROOT, 'mobile', 'src', 'subPackages', 'pages-knowledge', 'static', 'knowledgebanks', 'images'),
];

// ---- 配色（跟随应用护眼绿主色） ----
const C = {
  stroke: '#52796f',
  fill: '#d8e8df',      // 主图形
  fillAlt: '#b7d3c5',   // 相间/对照部分
  accent: '#f0d9a8',    // 被移动/高亮部分
  accentStroke: '#c08a2d',
  water: '#bcd8e8',
  helper: '#999999',    // 虚线辅助线
  text: '#303030',
};

// ---- SVG 基础件 ----
const line = (x1, y1, x2, y2, stroke = C.stroke, width = 1.5, dash = '') =>
  `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const poly = (pts, fill, stroke = C.stroke, width = 1.5, dash = '') =>
  `<polygon points="${pts.map(p => p.join(',')).join(' ')}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const text = (x, y, s, size = 16, fill = C.text, anchor = 'middle', weight = 'normal') =>
  `<text x="${x}" y="${y}" font-size="${size}" fill="${fill}" text-anchor="${anchor}" font-weight="${weight}" font-family="sans-serif">${s}</text>`;
const ellipse = (cx, cy, rx, ry, fill = 'none', stroke = C.stroke, width = 1.5, dash = '') =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`;
const circle = (cx, cy, r, fill = 'none', stroke = C.stroke, width = 1.5) =>
  `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
// 右箭头（指示变换方向）
const arrow = (x1, y1, x2, y2) =>
  `<defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="${C.helper}"/></marker></defs>` +
  line(x1, y1, x2, y2, C.helper, 2) .replace('/>', ` marker-end="url(#ah)"/>`);

const svgWrap = inner =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 480 320">${inner}</svg>`;

// ---- 各推导图 ----
const SHAPES = {
  /** 长方形面积：单位方格铺满，每行 a 个共 b 行 */
  'geo-rect-area': () => {
    const [ox, oy, cell, a, b] = [110, 60, 44, 5, 3];
    let s = '';
    for (let i = 0; i <= a; i++) s += line(ox + i * cell, oy, ox + i * cell, oy + b * cell);
    for (let j = 0; j <= b; j++) s += line(ox, oy + j * cell, ox + a * cell, oy + j * cell);
    s += `<rect x="${ox}" y="${oy}" width="${a * cell}" height="${b * cell}" fill="none" stroke="${C.stroke}" stroke-width="3"/>`;
    s += text(ox + cell / 2, oy + cell / 2 + 6, '1', 15, C.helper);
    s += text(ox + a * cell / 2, oy + b * cell + 26, '长 a', 16, C.text, 'middle', 'bold');
    s += text(ox - 22, oy + b * cell / 2 + 5, '宽 b', 16, C.text, 'middle', 'bold');
    s += text(240, 272, 'S = a × b', 22, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },

  /** 正方形面积：长方形特例 */
  'geo-square-area': () => {
    const [ox, oy, cell, a] = [150, 46, 44, 4];
    let s = '';
    for (let i = 0; i <= a; i++) s += line(ox + i * cell, oy, ox + i * cell, oy + a * cell);
    for (let j = 0; j <= a; j++) s += line(ox, oy + j * cell, ox + a * cell, oy + j * cell);
    s += `<rect x="${ox}" y="${oy}" width="${a * cell}" height="${a * cell}" fill="none" stroke="${C.stroke}" stroke-width="3"/>`;
    s += text(ox + cell / 2, oy + cell / 2 + 6, '1', 15, C.helper);
    s += text(ox + a * cell / 2, oy + a * cell + 26, '边长 a', 16, C.text, 'middle', 'bold');
    s += text(ox - 38, oy + a * cell / 2 + 5, '边长 a', 16, C.text, 'middle', 'bold');
    s += text(240, 288, 'S = a × a = a²', 22, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },

  /** 三角形面积：两个全等三角形拼成平行四边形 */
  'geo-triangle-area': () => {
    const A = [110, 230], B = [330, 230], P = [380, 100], D = [160, 100];
    let s = poly([A, B, D], C.fillAlt);
    s += poly([D, B, P], C.fill);
    s += line(D[0], D[1], D[0], A[1], C.helper, 1.5, '6 4');          // 高
    s += text(D[0] - 14, (D[1] + A[1]) / 2, 'h', 16, C.text, 'middle', 'bold');
    s += text((A[0] + B[0]) / 2, A[1] + 24, '底 a', 16, C.text, 'middle', 'bold');
    s += text(240, 288, 'S△ = a × h ÷ 2', 22, C.stroke, 'middle', 'bold');
    s += text((D[0] + B[0]) / 2 - 30, (D[1] + B[1]) / 2 + 24, '①', 15, C.helper);
    s += text((D[0] + P[0]) / 2 + 30, (D[1] + P[1]) / 2 - 10, '②', 15, C.helper);
    return svgWrap(s);
  },

  /** 平行四边形面积：沿高割补成长方形 */
  'geo-parallelogram-area': () => {
    const A = [80, 220], B = [240, 220], P = [300, 100], D = [140, 100]; // 底 160，偏移 60
    const R = {x: 330, w: 160, t: 100, b: 220};                          // 拼成的长方形
    let s = poly([A, B, P, D], C.fill);
    // 左侧被剪下的三角形（虚线示意）
    s += poly([A, D, [D[0], A[1]]], C.accent, C.accentStroke, 1.5, '5 4');
    s += line(D[0], D[1], D[0], A[1], C.helper, 1.5, '6 4');            // 高（剪切线）
    s += text(D[0] + 14, (D[1] + A[1]) / 2, 'h', 15);
    s += text((A[0] + B[0]) / 2, A[1] + 22, 'a', 15);
    s += arrow(308, 160, 322, 160).replace('x1="308"', 'x1="306"');
    // 右侧长方形 + 移入的三角形
    s += `<rect x="${R.x}" y="${R.t}" width="${R.w}" height="${R.b - R.t}" fill="${C.fill}" stroke="${C.stroke}" stroke-width="1.5"/>`;
    s += poly([[R.x + R.w - 60, R.b], [R.x + R.w, R.t], [R.x + R.w, R.b]], C.accent, C.accentStroke, 1.5, '5 4');
    s += text(R.x + R.w + 16, (R.t + R.b) / 2, 'h', 15);
    s += text(R.x + R.w / 2, R.b + 22, 'a', 15);
    s += text(240, 288, 'S = a × h', 22, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },

  /** 梯形面积：旋转 180° 拼成平行四边形（底 = a+b） */
  'geo-trapezoid-area': () => {
    const A = [70, 230], B = [250, 230], P = [210, 120], D = [120, 120]; // a=90(上) b=180(下) h=110
    const M = [(B[0] + P[0]) / 2, (B[1] + P[1]) / 2];                    // 旋转中心：腰 BP 中点
    const rot = p => [2 * M[0] - p[0], 2 * M[1] - p[1]];
    const A2 = rot(A), D2 = rot(D);                                      // B→P、P→B 与原梯形共边
    let s = poly([A, B, P, D], C.fill);
    s += poly([[B[0], B[1]], [D2[0], D2[1]], [A2[0], A2[1]], [P[0], P[1]]], C.fillAlt);
    s += line(B[0], B[1], P[0], P[1]);                                   // 拼接缝
    s += text((D[0] + P[0]) / 2, D[1] - 10, 'a', 15);
    s += text((A[0] + B[0]) / 2, A[1] + 22, 'b', 15);
    s += line(A[0] - 16, D[1], A[0] - 16, A[1], C.helper, 1.5, '6 4');   // 高
    s += text(A[0] - 30, (D[1] + A[1]) / 2, 'h', 15);
    s += text(240, 288, 'S = (a + b) × h ÷ 2', 22, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },

  /** 圆面积：切成偶数份扇形，交错拼成近似长方形（长≈πr，宽≈r） */
  'geo-circle-area': () => {
    const [cx, cy, r] = [95, 150, 62];
    let s = '';
    const n = 16;
    for (let i = 0; i < n; i++) {
      const a1 = (i / n) * Math.PI * 2, a2 = ((i + 1) / n) * Math.PI * 2;
      const p1 = [cx + r * Math.cos(a1), cy + r * Math.sin(a1)];
      const p2 = [cx + r * Math.cos(a2), cy + r * Math.sin(a2)];
      s += `<path d="M${cx},${cy} L${p1[0].toFixed(1)},${p1[1].toFixed(1)} A${r},${r} 0 0 1 ${p2[0].toFixed(1)},${p2[1].toFixed(1)} Z" fill="${i % 2 ? C.fill : C.fillAlt}" stroke="${C.stroke}" stroke-width="1"/>`;
    }
    s += circle(cx, cy, r);
    s += arrow(170, 150, 196, 150);
    // 右侧：16 个三角形交错拼成的带状近似长方形
    const wr = 52;                                  // 扇形半径 → 长方形宽 r
    const bw = 2 * wr * Math.tan(Math.PI / 16);     // 每个扇形的底边宽
    const x0 = 205, yTop = 124, yBot = yTop + wr;
    for (let i = 0; i < n; i++) {
      const x = x0 + i * bw;
      const pts = i % 2 === 0
        ? [[x, yTop], [x + bw, yTop], [x + bw / 2, yBot]]          // 尖朝下
        : [[x, yBot], [x + bw, yBot], [x + bw / 2, yTop]];         // 尖朝上
      s += poly(pts, i % 2 ? C.fill : C.fillAlt, C.stroke, 1);
    }
    const wTot = n * bw;
    s += `<rect x="${x0}" y="${yTop}" width="${wTot}" height="${wr}" fill="none" stroke="${C.helper}" stroke-width="1" stroke-dasharray="5 4"/>`;
    s += text(x0 - 14, yTop + wr / 2 + 5, 'r', 15);
    s += text(x0 + wTot / 2, yBot + 24, '长 ≈ πr（圆周的一半）', 15);
    s += text(240, 288, 'S = πr × r = πr²', 22, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },

  /** 长方体体积：每层 a×b 个单位正方体，共 c 层 */
  'geo-cuboid-volume': () => {
    const [ox, oy, cell] = [140, 230, 40];           // 前下角原点（前表面左下）
    const [a, b, c] = [4, 3, 2];                     // 长 4、深 3、高 2
    const dz = [24, -22];                            // 深度方向单位向量
    let s = '';
    // 前表面网格（a×c）
    for (let i = 0; i <= a; i++) s += line(ox + i * cell, oy, ox + i * cell, oy - c * cell);
    for (let j = 0; j <= c; j++) s += line(ox, oy - j * cell, ox + a * cell, oy - j * cell);
    // 顶面网格
    for (let i = 0; i <= a; i++) s += line(ox + i * cell, oy - c * cell, ox + i * cell + b * dz[0], oy - c * cell + b * dz[1]);
    for (let k = 0; k <= b; k++) s += line(ox + k * dz[0], oy - c * cell + k * dz[1], ox + a * cell + k * dz[0], oy - c * cell + k * dz[1]);
    // 右侧面网格
    for (let k = 0; k <= b; k++) s += line(ox + a * cell + k * dz[0], oy + k * dz[1], ox + a * cell + k * dz[0], oy - c * cell + k * dz[1]);
    for (let j = 0; j <= c; j++) s += line(ox + a * cell, oy - j * cell, ox + a * cell + b * dz[0], oy - j * cell + b * dz[1]);
    // 外轮廓加粗
    const bx = ox + a * cell, by = oy - c * cell, dx = b * dz[0], dy = b * dz[1];
    s += poly([[ox, oy], [bx, oy], [bx, by], [ox, by]], 'none', C.stroke, 3);
    s += poly([[ox, by], [bx, by], [bx + dx, by + dy], [ox + dx, by + dy]], 'none', C.stroke, 3);
    s += poly([[bx, oy], [bx + dx, oy + dy], [bx + dx, by + dy], [bx, by]], 'none', C.stroke, 3);
    // 高亮一个单位正方体（前表左上角）
    s += `<rect x="${ox}" y="${by}" width="${cell}" height="${cell}" fill="${C.accent}" stroke="${C.accentStroke}" stroke-width="1.5"/>`;
    s += text(ox + a * cell / 2, oy + 24, '长 a', 16, C.text, 'middle', 'bold');
    s += text(bx + dx / 2 + 26, oy + dy / 2 + 4, '宽 b', 16, C.text, 'middle', 'bold');
    s += text(ox - 22, oy - c * cell / 2 + 5, '高 c', 16, C.text, 'middle', 'bold');
    s += text(240, 292, 'V = a × b × c', 22, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },

  /** 正方体体积：长方体特例 */
  'geo-cube-volume': () => {
    const [ox, oy, cell] = [150, 230, 40];
    const a = 3;
    const dz = [24, -22];
    let s = '';
    for (let i = 0; i <= a; i++) s += line(ox + i * cell, oy, ox + i * cell, oy - a * cell);
    for (let j = 0; j <= a; j++) s += line(ox, oy - j * cell, ox + a * cell, oy - j * cell);
    for (let i = 0; i <= a; i++) s += line(ox + i * cell, oy - a * cell, ox + i * cell + a * dz[0], oy - a * cell + a * dz[1]);
    for (let k = 0; k <= a; k++) s += line(ox + k * dz[0], oy - a * cell + k * dz[1], ox + a * cell + k * dz[0], oy - a * cell + k * dz[1]);
    for (let k = 0; k <= a; k++) s += line(ox + a * cell + k * dz[0], oy + k * dz[1], ox + a * cell + k * dz[0], oy - a * cell + k * dz[1]);
    for (let j = 0; j <= a; j++) s += line(ox + a * cell, oy - j * cell, ox + a * cell + a * dz[0], oy - j * cell + a * dz[1]);
    const bx = ox + a * cell, by = oy - a * cell, dx = a * dz[0], dy = a * dz[1];
    s += poly([[ox, oy], [bx, oy], [bx, by], [ox, by]], 'none', C.stroke, 3);
    s += poly([[ox, by], [bx, by], [bx + dx, by + dy], [ox + dx, by + dy]], 'none', C.stroke, 3);
    s += poly([[bx, oy], [bx + dx, oy + dy], [bx + dx, by + dy], [bx, by]], 'none', C.stroke, 3);
    s += `<rect x="${ox}" y="${by}" width="${cell}" height="${cell}" fill="${C.accent}" stroke="${C.accentStroke}" stroke-width="1.5"/>`;
    s += text(ox + a * cell / 2, oy + 24, '棱长 a', 16, C.text, 'middle', 'bold');
    s += text(bx + dx / 2 + 26, oy + dy / 2 + 4, '棱长 a', 16, C.text, 'middle', 'bold');
    s += text(ox - 24, oy - a * cell / 2 + 5, '棱长 a', 16, C.text, 'middle', 'bold');
    s += text(240, 292, 'V = a × a × a = a³', 22, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },

  /** 圆柱体积：沿高切成薄圆片叠放，V = 底面积 × 高 */
  'geo-cylinder-volume': () => {
    const [cx, top, bot, rx, ry] = [210, 70, 215, 85, 24];
    let s = '';
    // 内部两条虚线椭圆（薄圆片切层示意）
    for (const y of [(top + bot) / 2 - 22, (top + bot) / 2 + 26]) {
      s += `<path d="M${cx - rx},${y} A${rx},${ry} 0 0 0 ${cx + rx},${y}" fill="none" stroke="${C.helper}" stroke-width="1.2" stroke-dasharray="5 4"/>`;
    }
    // 侧壁与底面
    s += line(cx - rx, top, cx - rx, bot);
    s += line(cx + rx, top, cx + rx, bot);
    s += `<path d="M${cx - rx},${bot} A${rx},${ry} 0 0 0 ${cx + rx},${bot}" fill="${C.fillAlt}" stroke="${C.stroke}" stroke-width="1.5"/>`;
    s += `<path d="M${cx - rx},${bot} A${rx},${ry} 0 0 1 ${cx + rx},${bot}" fill="${C.fillAlt}" stroke="${C.stroke}" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += ellipse(cx, top, rx, ry, C.fill, C.stroke, 2);
    // 半径 r / 高 h
    s += line(cx, top, cx + rx, top, C.helper, 1.2);
    s += text(cx + rx / 2, top - 8, 'r', 15);
    s += text(cx + rx + 18, (top + bot) / 2, 'h', 16, C.text, 'middle', 'bold');
    s += text(cx, bot + ry + 20, '底面积 πr²', 15);
    s += text(240, 300, 'V = πr² × h', 22, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },

  /** 圆锥体积：等底等高，圆锥倒水 3 次恰倒满圆柱 → ⅓ */
  'geo-cone-volume': () => {
    // 左：圆锥；右：等底等高圆柱（水位 1/3 示意）
    const [kcx, kTop, kBot, rx, ry] = [120, 55, 225, 62, 19];
    let s = '';
    s += poly([[kcx, kTop], [kcx - rx, kBot], [kcx + rx, kBot]], C.fill);
    s += `<path d="M${kcx - rx},${kBot} A${rx},${ry} 0 0 0 ${kcx + rx},${kBot}" fill="${C.fillAlt}" stroke="${C.stroke}" stroke-width="1.5"/>`;
    s += `<path d="M${kcx - rx},${kBot} A${rx},${ry} 0 0 1 ${kcx + rx},${kBot}" fill="none" stroke="${C.stroke}" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += text(kcx, kBot + ry + 18, 'r', 15);
    s += text(kcx, kTop - 10, 'h', 15);
    s += arrow(196, 135, 224, 135);
    const [ccx, cTop, cBot] = [310, 55, 225];
    const crx = rx, cry = ry;
    // 水位 1/3
    const wTop = cBot - (cBot - cTop) / 3;
    s += `<rect x="${ccx - crx + 1}" y="${wTop}" width="${2 * crx - 2}" height="${cBot - wTop}" fill="${C.water}"/>`;
    s += `<path d="M${ccx - crx},${wTop} A${crx},${cry} 0 0 0 ${ccx + crx},${wTop}" fill="${C.water}" stroke="none"/>`;
    for (const y of [cBot - (cBot - cTop) / 3, cBot - (2 * (cBot - cTop)) / 3]) {
      s += line(ccx - crx, y, ccx + crx, y, C.helper, 1, '4 3');
    }
    s += line(ccx - crx, cTop, ccx - crx, cBot);
    s += line(ccx + crx, cTop, ccx + crx, cBot);
    s += `<path d="M${ccx - crx},${cBot} A${crx},${cry} 0 0 0 ${ccx + crx},${cBot}" fill="none" stroke="${C.stroke}" stroke-width="1.5"/>`;
    s += `<path d="M${ccx - crx},${cBot} A${crx},${cry} 0 0 1 ${ccx + crx},${cBot}" fill="none" stroke="${C.stroke}" stroke-width="1" stroke-dasharray="4 3"/>`;
    s += ellipse(ccx, cTop, crx, cry, 'none', C.stroke, 1.5);
    s += text(ccx, cBot + cry + 20, 'r', 15);
    s += text(ccx + crx + 16, (cTop + cBot) / 2, 'h', 15);
    s += text(240, 292, '倒 3 次恰倒满 → V锥 = ⅓πr²h', 20, C.stroke, 'middle', 'bold');
    return svgWrap(s);
  },
};

/** 找一个可用的 Chromium：优先 puppeteer 自带，失败回退 playwright 缓存 */
async function launchBrowser(puppeteer) {
  // 首启要建字体缓存，可能超过默认 30s 启动超时；沙箱在部分环境不可用，直接关掉
  const opts = { headless: true, timeout: 180000, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  try {
    return await puppeteer.launch(opts);
  } catch (e) {
    const cacheDir = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
    const candidates = [];
    if (fs.existsSync(cacheDir)) {
      for (const dir of fs.readdirSync(cacheDir)) {
        candidates.push(path.join(cacheDir, dir, 'chrome-linux64', 'chrome'));
        candidates.push(path.join(cacheDir, dir, 'chrome-linux', 'chrome'));
      }
    }
    for (const exe of candidates) {
      if (fs.existsSync(exe)) {
        console.log('fallback chromium:', exe);
        return await puppeteer.launch({ ...opts, executablePath: exe });
      }
    }
    throw e;
  }
}

async function main() {
  const names = Object.keys(SHAPES);
  for (const dir of OUT_DIRS) fs.mkdirSync(dir, { recursive: true });

  const blocks = names.map((n, i) => `<div id="g-${i}" class="geo">${SHAPES[n]()}</div>`).join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #fff; }
    .geo { display: inline-block; padding: 10px 14px; background: #fff; }
    .geo svg { display: block; width: 420px; height: 280px; }
  </style></head><body>${blocks}</body></html>`;

  const puppeteer = require('puppeteer');
  const browser = await launchBrowser(puppeteer);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    for (let i = 0; i < names.length; i++) {
      const el = await page.$(`#g-${i}`);
      if (!el) throw new Error(`找不到渲染节点 #g-${i}（${names[i]}）`);
      for (const dir of OUT_DIRS) {
        await el.screenshot({ path: path.join(dir, `${names[i]}.png`) });
      }
      console.log('rendered', `${names[i]}.png`);
    }
  } finally {
    await browser.close();
  }
  console.log(`完成：共 ${names.length} 张推导图 PNG`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
