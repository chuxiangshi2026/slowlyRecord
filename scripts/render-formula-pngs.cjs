#!/usr/bin/env node
/**
 * 复杂公式预渲染管线：把 public/knowledgebanks/*.json 中带 latex 字段的条目
 * 用 MathJax v3 渲染成 SVG，再用 Puppeteer 截图输出 PNG。
 *
 * 背景：微信小程序 image 组件不支持 SVG，复杂公式（分式/积分/矩阵）需预渲染 PNG。
 * 输出位置（两处内容相同，条目 JSON 里 image 字段统一记 "knowledgebanks/images/x.png"）：
 *   - public/knowledgebanks/images/              桌面端（vite public 目录，随构建分发）
 *   - mobile/src/static/knowledgebanks/images/   移动端（uni-app 的 static 目录，编译后为 /static/...）
 *
 * 渲染后需重跑 mobile/scripts/convert-knowledgebanks.cjs 把 JSON 同步进小程序分包：
 *   node scripts/render-formula-pngs.cjs
 *   node mobile/scripts/convert-knowledgebanks.cjs math-calculus math-linalg math-probability
 *
 * 依赖：mathjax-full（纯 JS，devDependency）+ puppeteer（仓库已有）。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_DIR = path.join(ROOT, 'public', 'knowledgebanks');
const OUT_DIRS = [
  path.join(ROOT, 'public', 'knowledgebanks', 'images'),
  path.join(ROOT, 'mobile', 'src', 'static', 'knowledgebanks', 'images'),
];

// ---- MathJax v3：TeX → SVG（无 DOM 环境，lite adaptor）----
const { mathjax } = require('mathjax-full/js/mathjax');
const { TeX } = require('mathjax-full/js/input/tex');
const { SVG } = require('mathjax-full/js/output/svg');
const { liteAdaptor } = require('mathjax-full/js/adaptors/liteAdaptor');
const { RegisterHTMLHandler } = require('mathjax-full/js/handlers/html');
const { AllPackages } = require('mathjax-full/js/input/tex/AllPackages');

const adaptor = liteAdaptor();
RegisterHTMLHandler(adaptor);

const texDoc = mathjax.document('', {
  InputJax: new TeX({ packages: AllPackages }),
  OutputJax: new SVG({ fontCache: 'none' }),
});

/** TeX 源码 → SVG 标记字符串（MathJax v3 lite adaptor） */
function texToSvg(latex) {
  const node = texDoc.convert(latex, { display: true });
  let svg = adaptor.innerHTML(node);
  // MathJax 对无法解析的 TeX 不抛异常，而是输出红色 mtext（fill="red"）——这里主动报错，
  // 避免把「红字报错图」打进包里还看不出来。
  if (svg.includes('fill="red"')) {
    throw new Error(`TeX 无法解析：${latex}`);
  }
  // lite adaptor 输出缺 xmlns，补上看图工具/浏览器兼容属性
  if (!svg.includes('xmlns=')) {
    svg = svg.replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
  }
  return svg;
}

/** 收集所有知识包中带 latex 的条目 */
function collectItems() {
  const files = fs.readdirSync(JSON_DIR).filter(f => f.endsWith('.json'));
  const items = [];
  for (const file of files) {
    const pack = JSON.parse(fs.readFileSync(path.join(JSON_DIR, file), 'utf8'));
    for (const item of pack.items ?? []) {
      if (item.latex && item.image) items.push(item);
    }
  }
  return items;
}

/** 找一个可用的 Chromium：优先 puppeteer 自带，失败回退 playwright 缓存 */
async function launchBrowser(puppeteer) {
  try {
    return await puppeteer.launch({ headless: true });
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
        return await puppeteer.launch({ headless: true, executablePath: exe });
      }
    }
    throw e;
  }
}

async function main() {
  const items = collectItems();
  if (items.length === 0) {
    console.log('没有带 latex 的条目，退出');
    return;
  }
  for (const dir of OUT_DIRS) fs.mkdirSync(dir, { recursive: true });

  // 组装单页 HTML：每个公式一个带 id 的容器，白底、深灰字、22px 公式字号
  const blocks = items.map((item, i) => {
    let svg;
    try {
      svg = texToSvg(item.latex);
    } catch (e) {
      throw new Error(`MathJax 渲染失败 ${item.id}: ${e.message}`);
    }
    return `<div id="f-${i}" class="formula">${svg}</div>`;
  }).join('\n');
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
    body { margin: 0; background: #fff; }
    .formula { display: inline-block; padding: 12px 16px; background: #fff; color: #303030; font-size: 22px; }
    .formula svg { display: block; }
  </style></head><body>${blocks}</body></html>`;

  const puppeteer = require('puppeteer');
  const browser = await launchBrowser(puppeteer);
  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    await page.setContent(html, { waitUntil: 'load' });
    for (let i = 0; i < items.length; i++) {
      const el = await page.$(`#f-${i}`);
      if (!el) throw new Error(`找不到渲染节点 #f-${i}（${items[i].id}）`);
      const name = path.basename(items[i].image); // image 字段为相对路径，取文件名
      for (const dir of OUT_DIRS) {
        await el.screenshot({ path: path.join(dir, name) });
      }
      console.log('rendered', name);
    }
  } finally {
    await browser.close();
  }
  console.log(`完成：共 ${items.length} 张公式 PNG`);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
