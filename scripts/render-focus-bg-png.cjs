#!/usr/bin/env node
/**
 * 小程序专注模式（focus.vue）专属背景图预渲染管线。
 *
 * 背景图刻意做成「永远深色」：专注页本身是沉浸式深绿底（#10241e）+浅色文字，
 * 之前复用跟随主题的 AppBackground，亮色主题下会铺浅色底图叠浅色文字导致看不清。
 * 这里手绘深绿古风场景（远山/月亮/祥云/竹影/回纹边饰/朱砂印章），Puppeteer 截图输出：
 *   mobile/src/subPackages/pages-tools/static/focus/focus-bg.jpg（不透明底，避免彩边；
 *   渐变+模糊的 PNG 会到 1MB+，改为 q82 JPEG 约 80KB）
 *
 * 改动图形后重跑：node scripts/render-focus-bg-png.cjs
 * 依赖：puppeteer（仓库已有）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'mobile', 'src', 'subPackages', 'pages-tools', 'static', 'focus');

const W = 750;
const H = 1334;
const SCALE = 2;

const JADE = '#83c5a8';
const SEAL_RED = '#c04851';

/** 远山：四层玉绿渐隐（比全局暗色背景更清晰，但不干扰正文） */
function mountains() {
  const layers = [
    { d: 'M0,880 C60,850 85,810 140,825 C190,840 230,770 285,792 C340,814 380,720 445,755 C500,785 545,740 600,770 C660,800 710,770 750,785 L750,1334 L0,1334 Z', top: 0.10, bottom: 0.03, blur: 3.2 },
    { d: 'M0,975 C45,960 75,915 130,930 C190,950 235,870 295,895 C355,920 395,835 460,865 C520,895 565,830 625,865 C690,900 730,875 750,880 L750,1334 L0,1334 Z', top: 0.15, bottom: 0.05, blur: 2.0 },
    { d: 'M0,1085 C35,1065 65,1030 125,1050 C180,1070 225,985 290,1015 C350,1045 400,950 460,985 C525,1020 565,940 635,980 C695,1015 730,990 750,995 L750,1334 L0,1334 Z', top: 0.20, bottom: 0.09, blur: 1.3 },
    { d: 'M0,1205 C40,1185 80,1140 145,1165 C205,1190 250,1100 320,1135 C380,1165 430,1080 500,1120 C565,1158 610,1075 680,1120 C720,1145 735,1135 750,1140 L750,1334 L0,1334 Z', top: 0.27, bottom: 0.16, blur: 0.7 },
  ];
  let defs = '<defs>';
  layers.forEach((m, i) => {
    defs += `<linearGradient id="m${i}" x1="0%" y1="0%" x2="0%" y2="100%">`
      + `<stop offset="0%" stop-color="${JADE}" stop-opacity="${m.top}"/>`
      + `<stop offset="100%" stop-color="${JADE}" stop-opacity="${m.bottom}"/>`
      + '</linearGradient>';
    defs += `<filter id="mb${i}" x="-12%" y="-12%" width="124%" height="124%"><feGaussianBlur stdDeviation="${m.blur}"/></filter>`;
  });
  defs += '</defs>';
  let s = defs;
  layers.forEach((m, i) => {
    s += `<path d="${m.d}" fill="url(#m${i})" filter="url(#mb${i})"/>`;
  });
  return s;
}

/** 月亮 + 光晕 + 飞鸟 */
function moon() {
  return `
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#d8ecdc" stop-opacity="0.30"/>
      <stop offset="55%" stop-color="#d8ecdc" stop-opacity="0.10"/>
      <stop offset="100%" stop-color="#d8ecdc" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <circle cx="588" cy="212" r="150" fill="url(#glow)"/>
  <circle cx="588" cy="212" r="70" fill="#d8ecdc" fill-opacity="0.34"/>
  <circle cx="588" cy="212" r="70" fill="none" stroke="#eaf1ea" stroke-opacity="0.22" stroke-width="1.6"/>
  <g stroke="${JADE}" stroke-opacity="0.34" stroke-width="3" stroke-linecap="round" fill="none">
    <path d="M400,300 q11,-11 22,0 q11,-11 22,0"/>
    <path d="M466,338 q9,-9 18,0 q9,-9 18,0"/>
    <path d="M446,262 q7,-7 14,0 q7,-7 14,0"/>
  </g>`;
}

/** 祥云：如意云头（描边+淡填充），多处点缀 */
function cloud(cx, cy, s, op = 1) {
  return `<g transform="translate(${cx},${cy}) scale(${s})" stroke="${JADE}" stroke-opacity="${0.15 * op}" stroke-width="2.4" stroke-linecap="round" fill="${JADE}" fill-opacity="${0.04 * op}">
    <path d="M0,26 q0,-16 16,-16 q3,-12 16,-12 q13,0 16,12 q16,0 16,16 q0,10 -10,12 l-44,0 q-10,-2 -10,-12z"/>
    <path d="M14,14 q7,-7 14,0" fill="none"/>
    <path d="M-14,30 q-10,-2 -12,-12 q-1,-10 8,-14" fill="none"/>
  </g>`;
}

function clouds() {
  return [
    cloud(70, 400, 1.15, 1),
    cloud(520, 500, 0.9, 0.85),
    cloud(150, 560, 0.72, 0.7),
    cloud(600, 640, 1.0, 0.75),
    cloud(60, 720, 0.8, 0.6),
  ].join('');
}

/** 竹影：左侧三竿竹（竿身/竹节/竹叶），低透明度点缀 */
function bamboo() {
  const stalk = (x, top, bottom, bend) => `
    <path d="M${x},${bottom} C${x + bend},${(bottom + top) / 2} ${x - bend},${top + 200} ${x + bend * 0.6},${top}"
      stroke="${JADE}" stroke-opacity="0.12" stroke-width="5" fill="none" stroke-linecap="round"/>`;
  let nodes = '';
  [180, 330, 480, 630, 780].forEach((y, i) => {
    nodes += `<path d="M${58 - (i % 2) * 4},${y} q10,4 20,0" stroke="${JADE}" stroke-opacity="0.10" stroke-width="2" fill="none"/>`;
    nodes += `<path d="M104 + ${(i % 2) * 5},${y + 12} q10,4 20,0" stroke="${JADE}" stroke-opacity="0.10" stroke-width="2" fill="none"/>`;
  });
  const leaves = `
    <g stroke="${JADE}" stroke-opacity="0.10" stroke-width="2" fill="${JADE}" fill-opacity="0.05">
      <path d="M120,240 q34,-26 70,-20 q-30,22 -70,20z"/>
      <path d="M122,268 q40,-10 78,8 q-36,14 -78,-8z"/>
      <path d="M96,420 q30,-30 66,-28 q-26,26 -66,28z"/>
      <path d="M100,450 q38,-6 70,16 q-34,10 -70,-16z"/>
      <path d="M70,610 q-34,-22 -64,-14 q26,20 64,14z"/>
      <path d="M64,560 q-30,-28 -62,-24 q24,24 62,24z"/>
    </g>`;
  return `<g>
    ${stalk(72, 130, 900, 10)}
    ${stalk(112, 200, 940, -8)}
    ${stalk(146, 260, 980, 6)}
    ${nodes}
    ${leaves}
  </g>`;
}

/** 回纹（回字纹）边饰：顶部与底部各一条，小方格内嵌小方格 */
function fretStrip(y) {
  let s = '<g stroke="' + JADE + '" stroke-opacity="0.16" stroke-width="1.8" fill="none">';
  for (let x = 0; x < W; x += 48) {
    s += `<rect x="${x + 12}" y="${y + 4}" width="24" height="24" rx="2"/>`;
    s += `<rect x="${x + 20}" y="${y + 12}" width="8" height="8"/>`;
  }
  s += `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke-opacity="0.10"/>`;
  s += `<line x1="0" y1="${y + 32}" x2="${W}" y2="${y + 32}" stroke-opacity="0.10"/>`;
  s += '</g>';
  return s;
}

/** 朱砂印章：右下角圆角方章 + 「静」字（低透明度，作为点睛装饰） */
function seal() {
  return `<g transform="translate(598,1120)">
    <rect x="0" y="0" width="96" height="96" rx="10" fill="none" stroke="${SEAL_RED}" stroke-opacity="0.34" stroke-width="3"/>
    <rect x="7" y="7" width="82" height="82" rx="6" fill="none" stroke="${SEAL_RED}" stroke-opacity="0.18" stroke-width="1.2"/>
    <text x="48" y="66" text-anchor="middle" font-family="'Noto Serif CJK SC', serif" font-size="54" fill="${SEAL_RED}" fill-opacity="0.26">静</text>
  </g>`;
}

function scene() {
  return `
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="15%" y2="100%">
      <stop offset="0%" stop-color="#152e26"/>
      <stop offset="48%" stop-color="#10241e"/>
      <stop offset="100%" stop-color="#0b1a15"/>
    </linearGradient>
    <radialGradient id="vignette" cx="50%" cy="38%" r="72%">
      <stop offset="0%" stop-color="#83c5a8" stop-opacity="0.05"/>
      <stop offset="70%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.22"/>
    </radialGradient>
  </defs>
  <rect width="${W}" height="${H}" fill="url(#bg)"/>
  ${moon()}
  ${clouds()}
  ${bamboo()}
  ${mountains()}
  ${fretStrip(40)}
  ${fretStrip(H - 72)}
  ${seal()}
  <rect width="${W}" height="${H}" fill="url(#vignette)"/>`;
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
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; }
    #focus { display: inline-block; }
    #focus svg { display: block; }
  </style></head><body><div id="focus"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" color-interpolation="sRGB">${scene()}</svg></div></body></html>`;

  const puppeteer = require('puppeteer');
  const browser = await launchBrowser(puppeteer);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W, height: H, deviceScaleFactor: SCALE });
    await page.setContent(html, { waitUntil: 'load' });
    const el = await page.$('#focus');
    if (!el) throw new Error('找不到渲染节点 #focus');
    await el.screenshot({ path: path.join(OUT_DIR, 'focus-bg.jpg'), type: 'jpeg', quality: 82 });
    console.log('rendered focus-bg.jpg', `${W * SCALE}×${H * SCALE}`);
  } finally {
    await browser.close();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
