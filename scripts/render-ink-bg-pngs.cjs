#!/usr/bin/env node
/**
 * 移动端文本记忆（诗词）页的水墨背景图预渲染管线。
 *
 * 微信小程序 wxss 不支持本地 background-image、image 组件不支持 SVG，
 * 所以这里手写「淡墨远山」SVG（大量留白），用 Puppeteer 截图输出 PNG：
 *   mobile/src/subPackages/pages-memory/static/text-memory/ink-bg-{light,dark}.png
 *
 * 输出与 --sr-bg 同色的不透明底图，避免高分屏透明通道产生彩边；
 * 亮/暗主题底色分别为 #f5f5f5 / #151a18（与 mobile/src/App.vue 对齐）。
 * 页面里经 InkBackground.vue 以 <image mode="aspectFill"> 平铺。
 *
 * 改动图形后重跑：node scripts/render-ink-bg-pngs.cjs
 * 依赖：puppeteer（仓库已有）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'mobile', 'src', 'subPackages', 'pages-memory', 'static', 'text-memory');

// 设计尺寸：以小程序设计稿宽 750 为基准；实际输出为 2 倍分辨率，避免高分屏发虚
const W = 750;
const H = 1334;
const SCALE = 2;

/**
 * 淡墨远山：四层渐变山影 + 山间轻雾 + 淡日/月 + 飞鸟。
 * 保持大量留白；山形用较长的连续曲线，弱化大块实色与重高斯模糊，
 * 让亮/暗主题下都更像宣纸上的淡墨，而不是几片绿色多边形。
 */
function inkScene(ink, birdOpacity, sunOpacity, strength = 1) {
  const mountains = [
    {
      d: 'M0,930 C60,900 85,860 140,875 C190,890 230,820 285,842 C340,864 380,770 445,805 C500,835 545,790 600,820 C660,850 710,820 750,835 L750,1334 L0,1334 Z',
      top: 0.11, bottom: 0.025, blur: 2.8,
    },
    {
      d: 'M0,1015 C45,1000 75,955 130,970 C190,990 235,910 295,935 C355,960 395,875 460,905 C520,935 565,870 625,905 C690,940 730,915 750,920 L750,1334 L0,1334 Z',
      top: 0.16, bottom: 0.05, blur: 1.8,
    },
    {
      d: 'M0,1125 C35,1105 65,1070 125,1090 C180,1110 225,1025 290,1055 C350,1085 400,990 460,1025 C525,1060 565,980 635,1020 C695,1055 730,1030 750,1035 L750,1334 L0,1334 Z',
      top: 0.21, bottom: 0.085, blur: 1.2,
    },
    {
      d: 'M0,1235 C40,1215 80,1170 145,1195 C205,1220 250,1130 320,1165 C380,1195 430,1110 500,1150 C565,1188 610,1105 680,1150 C720,1175 735,1165 750,1170 L750,1334 L0,1334 Z',
      top: 0.27, bottom: 0.15, blur: 0.6,
    },
  ];

  let defs = '<defs>';
  mountains.forEach((m, i) => {
    defs += `<linearGradient id="mountain${i}" x1="0%" y1="0%" x2="0%" y2="100%">`
      + `<stop offset="0%" stop-color="${ink}" stop-opacity="${m.top * strength}"/>`
      + `<stop offset="100%" stop-color="${ink}" stop-opacity="${m.bottom * strength}"/>`
      + '</linearGradient>';
    defs += `<filter id="soft${i}" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB">`
      + `<feGaussianBlur stdDeviation="${m.blur}"/></filter>`;
  });
  defs += `<radialGradient id="sun" cx="50%" cy="50%" r="50%">`
    + `<stop offset="0%" stop-color="${ink}" stop-opacity="${sunOpacity}"/>`
    + `<stop offset="72%" stop-color="${ink}" stop-opacity="${sunOpacity * 0.55}"/>`
    + `<stop offset="100%" stop-color="${ink}" stop-opacity="0"/>`
    + '</radialGradient>';
  defs += `<linearGradient id="mist" x1="0%" y1="0%" x2="0%" y2="100%">`
    + `<stop offset="0%" stop-color="${ink}" stop-opacity="0"/>`
    + `<stop offset="52%" stop-color="${ink}" stop-opacity="${0.045 * strength}"/>`
    + `<stop offset="100%" stop-color="${ink}" stop-opacity="0"/>`
    + '</linearGradient>';
  defs += '<filter id="mistBlur" x="-10%" y="-40%" width="120%" height="180%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="10"/></filter>';
  defs += '</defs>';

  let s = defs;
  mountains.forEach((m, i) => {
    s += `<path d="${m.d}" fill="url(#mountain${i})" filter="url(#soft${i})"/>`;
    // 远山之间叠一层极淡的雾带，柔化交界，不让山脊显得像剪纸
    if (i === 0) {
      s += '<rect x="0" y="820" width="750" height="250" fill="url(#mist)" filter="url(#mistBlur)"/>';
    }
  });
  s += `<circle cx="${W - 154}" cy="188" r="72" fill="url(#sun)"/>`;
  s += `<g stroke="${ink}" stroke-opacity="${birdOpacity}" stroke-width="3.5" stroke-linecap="round" fill="none">`;
  s += `<path d="M${W - 318},296 q12,-12 24,0 q12,-12 24,0"/>`;
  s += `<path d="M${W - 250},338 q10,-10 20,0 q10,-10 20,0"/>`;
  s += `<path d="M${W - 202},286 q7,-7 14,0 q7,-7 14,0"/>`;
  s += '</g>';
  return s;
}

const VARIANTS = {
  // 亮色主题：灰绿淡墨，浓度克制，避免下半屏形成明显色块
  'ink-bg-light': {
    bg: '#f5f5f5',
    scene: inkScene('#52796f', 0.28, 0.18, 1),
  },
  // 暗色主题：玉绿淡墨，再淡一些，保证正文与卡片的可读性
  'ink-bg-dark': {
    bg: '#151a18',
    scene: inkScene('#83c5a8', 0.20, 0.13, 0.78),
  },
};

/** 找一个可用的 Chromium：优先 puppeteer 自带，失败回退环境变量 / Edge / playwright 缓存 */
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
  const blocks = names
    .map(
      (n, i) =>
        `<div id="g-${i}" class="ink" style="background:${VARIANTS[n].bg}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" color-interpolation="sRGB">${VARIANTS[n].scene}</svg></div>`,
    )
    .join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; }
    .ink { display: inline-block; }
    .ink svg { display: block; }
  </style></head><body>${blocks}</body></html>`;

  const puppeteer = require('puppeteer');
  const browser = await launchBrowser(puppeteer);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: W * names.length, height: H, deviceScaleFactor: SCALE });
    await page.setContent(html, { waitUntil: 'load' });
    for (let i = 0; i < names.length; i++) {
      const el = await page.$(`#g-${i}`);
      if (!el) throw new Error(`找不到渲染节点 #g-${i}（${names[i]}）`);
      // 不透明主题底：保留与页面一致的底色，规避透明通道彩边
      await el.screenshot({ path: path.join(OUT_DIR, `${names[i]}.png`) });
      console.log('rendered', `${names[i]}.png`);
    }
  } finally {
    await browser.close();
  }
  console.log(`完成：共 ${names.length} 张水墨背景 PNG（${W * SCALE}×${H * SCALE}）`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
