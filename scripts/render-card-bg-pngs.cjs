#!/usr/bin/env node
/**
 * 小程序复习卡片模式（review.vue）专属背景图预渲染管线。
 *
 * 与专注模式（scripts/render-focus-bg-png.cjs，深绿单版）同一手法、不同构图：
 * 双版跟随主题 —— 浅色为米绿宣纸底（暖墨远山+祥云+回纹），
 * 深色为墨绿夜色（月+山影+云纹），输出到主包 static/theme-bg/：
 *   mobile/src/static/theme-bg/card-bg-light.jpg / card-bg-dark.jpg
 * （渐变+模糊的 PNG 体积大，统一输出 q82 JPEG，单张约 60–90KB）
 *
 * 改动图形后重跑：node scripts/render-card-bg-pngs.cjs
 * 依赖：puppeteer（仓库已有）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'mobile', 'src', 'static', 'theme-bg');

const W = 750;
const H = 1334;
const SCALE = 2;

/** 远山层（右偏构图，与专注模式的左竹+居中构图区分） */
function mountains(ink, strength) {
  const layers = [
    { d: 'M0,905 C70,875 120,835 190,850 C250,862 300,790 370,812 C430,832 480,745 555,775 C620,800 690,762 750,780 L750,1334 L0,1334 Z', top: 0.10, bottom: 0.03, blur: 3.0 },
    { d: 'M0,1005 C60,990 110,945 180,958 C250,975 305,890 380,915 C450,940 505,850 580,882 C645,910 705,885 750,892 L750,1334 L0,1334 Z', top: 0.15, bottom: 0.05, blur: 1.9 },
    { d: 'M0,1110 C55,1092 100,1050 170,1068 C240,1086 300,995 375,1025 C445,1052 500,962 575,998 C640,1030 705,1002 750,1010 L750,1334 L0,1334 Z', top: 0.20, bottom: 0.09, blur: 1.2 },
    { d: 'M0,1220 C50,1202 95,1158 165,1180 C235,1200 295,1112 370,1145 C440,1175 495,1090 570,1128 C635,1160 705,1132 750,1140 L750,1334 L0,1334 Z', top: 0.26, bottom: 0.15, blur: 0.6 },
  ];
  let defs = '<defs>';
  layers.forEach((m, i) => {
    defs += `<linearGradient id="cm${i}" x1="0%" y1="0%" x2="0%" y2="100%">`
      + `<stop offset="0%" stop-color="${ink}" stop-opacity="${m.top * strength}"/>`
      + `<stop offset="100%" stop-color="${ink}" stop-opacity="${m.bottom * strength}"/>`
      + '</linearGradient>';
    defs += `<filter id="cb${i}" x="-12%" y="-12%" width="124%" height="124%"><feGaussianBlur stdDeviation="${m.blur}"/></filter>`;
  });
  defs += '</defs>';
  let s = defs;
  layers.forEach((m, i) => {
    s += `<path d="${m.d}" fill="url(#cm${i})" filter="url(#cb${i})"/>`;
  });
  return s;
}

/** 祥云（右半区布置，避开卡片正文区） */
function clouds(ink, op) {
  const cloud = (cx, cy, sc) => `<g transform="translate(${cx},${cy}) scale(${sc})" stroke="${ink}" stroke-opacity="${0.14 * op}" stroke-width="2.2" stroke-linecap="round" fill="${ink}" fill-opacity="${0.035 * op}">
    <path d="M0,26 q0,-16 16,-16 q3,-12 16,-12 q13,0 16,12 q16,0 16,16 q0,10 -10,12 l-44,0 q-10,-2 -10,-12z"/>
    <path d="M14,14 q7,-7 14,0" fill="none"/>
    <path d="M-14,30 q-10,-2 -12,-12 q-1,-10 8,-14" fill="none"/>
  </g>`;
  return [
    cloud(560, 430, 1.0),
    cloud(660, 330, 0.7),
    cloud(520, 560, 0.65),
  ].join('');
}

/** 右侧竹影（与专注模式左侧竹区分） */
function bamboo(ink) {
  const stalk = (x, top, bottom, bend) => `
    <path d="M${x},${bottom} C${x + bend},${(bottom + top) / 2} ${x - bend},${top + 240} ${x + bend * 0.6},${top}"
      stroke="${ink}" stroke-opacity="0.11" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  let nodes = '';
  [210, 380, 550, 720].forEach((y, i) => {
    nodes += `<path d="M${648 + (i % 2) * 4},${y} q10,4 20,0" stroke="${ink}" stroke-opacity="0.09" stroke-width="2" fill="none"/>`;
    nodes += `<path d="M${700 - (i % 2) * 5},${y + 14} q10,4 20,0" stroke="${ink}" stroke-opacity="0.09" stroke-width="2" fill="none"/>`;
  });
  const leaves = `
    <g stroke="${ink}" stroke-opacity="0.09" stroke-width="2" fill="${ink}" fill-opacity="0.04">
      <path d="M640,280 q-34,-26 -70,-20 q30,22 70,20z"/>
      <path d="M638,308 q-40,-10 -78,8 q36,14 78,-8z"/>
      <path d="M664,470 q-30,-30 -66,-28 q26,26 66,28z"/>
      <path d="M668,500 q-38,-6 -70,16 q34,10 70,-16z"/>
      <path d="M700,650 q34,-22 64,-14 q-26,20 -64,14z"/>
    </g>`;
  return `<g>
    ${stalk(636, 150, 900, -9)}
    ${stalk(684, 220, 950, 7)}
    ${stalk(722, 300, 990, -5)}
    ${nodes}
    ${leaves}
  </g>`;
}

/** 回字纹边饰 */
function fretStrip(y, ink) {
  let s = `<g stroke="${ink}" stroke-opacity="0.14" stroke-width="1.8" fill="none">`;
  for (let x = 0; x < W; x += 48) {
    s += `<rect x="${x + 12}" y="${y + 4}" width="24" height="24" rx="2"/>`;
    s += `<rect x="${x + 20}" y="${y + 12}" width="8" height="8"/>`;
  }
  s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke-opacity="0.09"/>`;
  s += `<line x1="0" y1="${y + 32}" x2="${W}" y2="${y + 32}" stroke-opacity="0.09"/>`;
  s += '</g>';
  return s;
}

function mists(ink, op) {
  return `<rect x="0" y="820" width="${W}" height="260" fill="${ink}" fill-opacity="${0.035 * op}" filter="url(#mistBlur)"/>
  <defs><filter id="mistBlur" x="-10%" y="-40%" width="120%" height="180%"><feGaussianBlur stdDeviation="14"/></filter></defs>`;
}

const VARIANTS = {
  // 浅色：米绿宣纸底，暖墨远山
  'card-bg-light': {
    bg: ['#eef3ec', '#e6eee7', '#dfe9e1'],
    ink: '#52796f',
    strength: 1,
    op: 1,
    moon: null,
  },
  // 深色：墨绿夜色，玉绿远山 + 小月
  'card-bg-dark': {
    bg: ['#15281f', '#10241e', '#0b1a15'],
    ink: '#83c5a8',
    strength: 0.9,
    op: 0.85,
    moon: { cx: 150, cy: 200, r: 58, op: 0.32 },
  },
};

function scene(v) {
  const m = v.moon
    ? `<defs><radialGradient id="mg" cx="50%" cy="50%" r="50%">
         <stop offset="0%" stop-color="#d8ecdc" stop-opacity="0.26"/>
         <stop offset="60%" stop-color="#d8ecdc" stop-opacity="0.08"/>
         <stop offset="100%" stop-color="#d8ecdc" stop-opacity="0"/></radialGradient></defs>
       <circle cx="${v.moon.cx}" cy="${v.moon.cy}" r="130" fill="url(#mg)"/>
       <circle cx="${v.moon.cx}" cy="${v.moon.cy}" r="${v.moon.r}" fill="#d8ecdc" fill-opacity="${v.moon.op}"/>`
    : '';
  return `
  <defs>
    <linearGradient id="cbg" x1="0%" y1="0%" x2="12%" y2="100%">
      <stop offset="0%" stop-color="${v.bg[0]}"/>
      <stop offset="50%" stop-color="${v.bg[1]}"/>
      <stop offset="100%" stop-color="${v.bg[2]}"/>
    </linearGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#cbg)"/>
  ${m}
  ${clouds(v.ink, v.op)}
  ${bamboo(v.ink)}
  ${mountains(v.ink, v.strength)}
  ${mists(v.ink, v.op)}
  ${fretStrip(40, v.ink)}
  ${fretStrip(H - 72, v.ink)}`;
}

async function launchBrowser(puppeteer) {
  const opts = { headless: true, timeout: 180000, args: ['--no-sandbox', '--disable-setuid-sandbox'] };
  try {
    return await puppeteer.launch(opts);
  } catch (e) {
    const cacheDir = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
    const candidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].filter(Boolean);
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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const names = Object.keys(VARIANTS);

  const puppeteer = require('puppeteer');
  const browser = await launchBrowser(puppeteer);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
    // 每张变体单独 setContent 再截图：多节点同页拼接时 inline-block 空白符会让
    // 第二张换行溢出视口，元素截图抓到错误画面（dark 曾渲染成 light 的场景）
    for (const name of names) {
      const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0}svg{display:block}</style></head><body><svg id="g" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" color-interpolation="sRGB">${scene(VARIANTS[name])}</svg></body></html>`;
      await page.setContent(html, { waitUntil: 'load' });
      const el = await page.$('#g');
      if (!el) throw new Error(`找不到渲染节点 #g（${name}）`);
      await el.screenshot({ path: path.join(OUT_DIR, `${name}.jpg`), type: 'jpeg', quality: 82 });
      console.log('rendered', `${name}.jpg`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
