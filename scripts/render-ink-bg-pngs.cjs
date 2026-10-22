#!/usr/bin/env node
/**
 * 移动端文本记忆（诗词）页的水墨背景图预渲染管线。
 *
 * 微信小程序 wxss 不支持本地 background-image、image 组件不支持 SVG，
 * 所以这里手写「淡墨远山」SVG（大量留白、透明底），用 Puppeteer 截图输出 PNG：
 *   mobile/src/subPackages/pages-memory/static/text-memory/ink-bg-{light,dark}.png
 *
 * 页面里经 InkBackground.vue 以 <image mode="aspectFill"> 平铺，透明底透出页面底色。
 * 改动图形后重跑：node scripts/render-ink-bg-pngs.cjs
 *
 * 依赖：puppeteer（仓库已有）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUT_DIR = path.join(ROOT, 'mobile', 'src', 'subPackages', 'pages-memory', 'static', 'text-memory');

// 设计尺寸：以小程序设计稿宽 750 为基准，竖屏比例
const W = 750;
const H = 1334;

/**
 * 淡墨远山：底部 3 层山影（越远越淡、越高斯模糊），顶部一轮淡日/月，两只飞鸟。
 * ink 为主墨色（已含透明通道由 SVG fill-opacity 控制）。
 */
function inkScene(ink, birdOpacity, sunOpacity) {
  // 三层山的轮廓路径（自左向右的写意山脊线），y 值越大越靠下
  const mountains = [
    // 远山（最淡最虚）
    { d: `M0,${H - 420} C120,${H - 520} 200,${H - 560} 320,${H - 500} C420,${H - 450} 500,${H - 560} 620,${H - 490} C680,${H - 460} 720,${H - 470} ${W},${H - 440} L${W},${H} L0,${H} Z`, blur: 10, op: 0.35 },
    // 中山
    { d: `M0,${H - 300} C100,${H - 380} 180,${H - 300} 280,${H - 340} C380,${H - 380} 460,${H - 260} 560,${H - 300} C640,${H - 330} 700,${H - 280} ${W},${H - 300} L${W},${H} L0,${H} Z`, blur: 6, op: 0.5 },
    // 近山（最浓最实）
    { d: `M0,${H - 200} C90,${H - 260} 170,${H - 180} 260,${H - 210} C360,${H - 250} 430,${H - 140} 540,${H - 180} C620,${H - 210} 690,${H - 160} ${W},${H - 190} L${W},${H} L0,${H} Z`, blur: 3, op: 0.65 },
  ];
  let s = `<defs>`;
  mountains.forEach((m, i) => {
    s += `<filter id="blur${i}" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="${m.blur}"/></filter>`;
  });
  s += `</defs>`;
  mountains.forEach((m, i) => {
    s += `<path d="${m.d}" fill="${ink}" fill-opacity="${m.op}" filter="url(#blur${i})"/>`;
  });
  // 淡日/月（右上）
  s += `<circle cx="${W - 150}" cy="190" r="58" fill="${ink}" fill-opacity="${sunOpacity}" filter="url(#blur0)"/>`;
  // 两只写意飞鸟（人字撇）
  s += `<g stroke="${ink}" stroke-opacity="${birdOpacity}" stroke-width="5" stroke-linecap="round" fill="none">`;
  s += `<path d="M${W - 320},300 q14,-14 28,0 q14,-14 28,0"/>`;
  s += `<path d="M${W - 250},345 q11,-11 22,0 q11,-11 22,0"/>`;
  s += `</g>`;
  return s;
}

const VARIANTS = {
  // 亮色主题：灰绿淡墨
  'ink-bg-light': inkScene('#52796f', 0.4, 0.18),
  // 暗色主题：玉绿淡墨，整体再淡一点避免压过文字
  'ink-bg-dark': inkScene('#83c5a8', 0.3, 0.14),
};

/** 找一个可用的 Chromium：优先 puppeteer 自带，失败回退 playwright 缓存 */
async function launchBrowser(puppeteer) {
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
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const names = Object.keys(VARIANTS);
  const blocks = names
    .map(
      (n, i) =>
        `<div id="g-${i}" class="ink"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${VARIANTS[n]}</svg></div>`,
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
    await page.setViewport({ width: W * names.length, height: H, deviceScaleFactor: 1 });
    await page.setContent(html, { waitUntil: 'load' });
    for (let i = 0; i < names.length; i++) {
      const el = await page.$(`#g-${i}`);
      if (!el) throw new Error(`找不到渲染节点 #g-${i}（${names[i]}）`);
      // omitBackground：保留 SVG 透明底，叠到页面底色上
      await el.screenshot({ path: path.join(OUT_DIR, `${names[i]}.png`), omitBackground: true });
      console.log('rendered', `${names[i]}.png`);
    }
  } finally {
    await browser.close();
  }
  console.log(`完成：共 ${names.length} 张水墨背景 PNG`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
