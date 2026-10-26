#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const OUTPUTS = [
  path.join(ROOT, 'public', 'memory-palace'),
  path.join(ROOT, 'mobile', 'src', 'subPackages', 'pages-memory', 'static', 'memory-palace'),
];
const W = 640;
const H = 320;
const INK = '#52796f';
const LIGHT = '#eaf1ea';
const MID = '#a8c3b5';
const PAPER = '#f7faf6';
const ACCENT = '#d3b886';

function label(x, y, order, name) {
  return `<g><circle cx="${x}" cy="${y}" r="15" fill="${INK}"/><text x="${x}" y="${y + 5}" class="num">${order}</text><text x="${x}" y="${y + 35}" class="label">${name}</text></g>`;
}

function frame(content) {
  return `<defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${INK}"/></marker></defs>${content}`;
}

const scenes = {
  'home-route': frame(`
    <path d="M45 275 V65 H595 V275 Z" fill="${PAPER}" stroke="${MID}" stroke-width="4"/>
    <path d="M225 65 V275 M420 65 V275 M45 180 H225 M420 180 H595" fill="none" stroke="${MID}" stroke-width="3"/>
    <path d="M78 245 C140 285 185 245 185 210 S260 105 325 130 S410 250 470 235 S545 150 560 110" fill="none" stroke="${INK}" stroke-width="4" stroke-dasharray="8 8" marker-end="url(#arrow)"/>
    <rect x="62" y="192" width="48" height="83" rx="3" fill="${ACCENT}" stroke="${INK}" stroke-width="3"/><circle cx="99" cy="235" r="3" fill="${INK}"/>
    <rect x="151" y="175" width="66" height="42" rx="5" fill="${LIGHT}" stroke="${INK}" stroke-width="3"/><path d="M157 187 H211 M157 199 H211" stroke="${INK}" stroke-width="2"/>
    <rect x="271" y="103" width="104" height="54" rx="13" fill="${LIGHT}" stroke="${INK}" stroke-width="3"/><path d="M284 103 V84 H361 V103 M283 157 V169 M362 157 V169" fill="none" stroke="${INK}" stroke-width="4"/>
    <ellipse cx="481" cy="205" rx="48" ry="19" fill="${ACCENT}" stroke="${INK}" stroke-width="3"/><path d="M450 220 V242 M512 220 V242" stroke="${INK}" stroke-width="4"/>
    <rect x="528" y="78" width="64" height="54" fill="${LIGHT}" stroke="${INK}" stroke-width="3"/><path d="M560 78 V132 M528 105 H592" stroke="${INK}" stroke-width="2"/>
    ${label(82, 139, 1, '大门')}${label(184, 127, 2, '鞋柜')}${label(324, 35, 4, '沙发')}${label(480, 263, 7, '餐桌')}${label(470, 40, 10, '卧室')}${label(560, 175, 12, '衣柜')}
  `),
  'body-pegs': frame(`
    <circle cx="320" cy="75" r="48" fill="${LIGHT}" stroke="${INK}" stroke-width="4"/>
    <path d="M273 127 Q320 105 367 127 L383 239 Q320 270 257 239 Z" fill="${PAPER}" stroke="${INK}" stroke-width="4"/>
    <path d="M267 143 L218 213 M373 143 L422 213 M286 246 L276 290 M354 246 L364 290" fill="none" stroke="${INK}" stroke-width="15" stroke-linecap="round"/>
    <path d="M320 126 V237 M270 184 H370" fill="none" stroke="${MID}" stroke-width="3" stroke-dasharray="6 7"/>
    <path d="M125 45 H264 M125 125 H274 M125 205 H259 M500 45 H376 M500 145 H396 M500 245 H382" fill="none" stroke="${MID}" stroke-width="2"/>
    ${label(103, 45, 1, '头')}${label(103, 125, 2, '眼')}${label(103, 205, 3, '鼻')}${label(522, 45, 4, '嘴')}${label(522, 145, 9, '手')}${label(522, 245, 12, '脚')}
    <circle cx="304" cy="70" r="4" fill="${INK}"/><circle cx="336" cy="70" r="4" fill="${INK}"/><path d="M312 91 Q320 98 328 91" fill="none" stroke="${INK}" stroke-width="3"/>
  `),
  'number-pegs': frame(`
    <path d="M86 198 H128 M96 198 V103 H116 V198 M96 103 Q106 79 116 103" fill="${LIGHT}" stroke="${INK}" stroke-width="4"/><path d="M106 81 Q93 65 106 49 Q119 65 106 81" fill="${ACCENT}" stroke="${INK}" stroke-width="3"/>
    <path d="M202 180 Q198 136 240 139 Q252 102 274 125 Q288 145 266 158 Q276 190 236 194 Q214 195 202 180" fill="${LIGHT}" stroke="${INK}" stroke-width="4"/><circle cx="259" cy="135" r="3" fill="${INK}"/><path d="M275 143 L291 149 L275 155" fill="${ACCENT}" stroke="${INK}" stroke-width="2"/>
    <path d="M374 188 Q336 168 350 116 Q362 73 397 95 Q429 116 398 146 Q380 153 389 173 Q397 190 374 188" fill="${LIGHT}" stroke="${INK}" stroke-width="4"/><path d="M375 156 Q360 125 382 115 Q400 119 385 138" fill="none" stroke="${INK}" stroke-width="4"/>
    <path d="M494 188 H590 L545 211 Z" fill="${ACCENT}" stroke="${INK}" stroke-width="4"/><path d="M543 188 V71 L491 164 H543 M551 91 L586 153 H551" fill="${LIGHT}" stroke="${INK}" stroke-width="4"/>
    ${label(106, 242, 1, '蜡烛')}${label(242, 242, 2, '鸭子')}${label(379, 242, 3, '耳朵')}${label(542, 242, 4, '帆船')}
    <text x="320" y="300" class="hint">数字有固定形象：1 像蜡烛、2 像鸭子、3 像耳朵、4 像帆船</text>
  `),
};

async function launchBrowser(puppeteer) {
  const options = {headless: true, timeout: 180000, args: ['--no-sandbox', '--disable-setuid-sandbox']};
  try {
    return await puppeteer.launch(options);
  } catch (error) {
    const cacheDir = path.join(process.env.HOME || '', '.cache', 'ms-playwright');
    if (fs.existsSync(cacheDir)) {
      for (const dir of fs.readdirSync(cacheDir)) {
        for (const relative of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
          const executablePath = path.join(cacheDir, dir, relative);
          if (fs.existsSync(executablePath)) return puppeteer.launch({...options, executablePath});
        }
      }
    }
    throw error;
  }
}

async function main() {
  const names = Object.keys(scenes);
  const blocks = names.map((name, index) => `<div id="scene-${index}" class="scene"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}"><style>.num{font: bold 14px sans-serif;fill:white;text-anchor:middle}.label{font: 16px sans-serif;fill:${INK};text-anchor:middle}.hint{font: 14px sans-serif;fill:${INK};text-anchor:middle;opacity:.75}</style>${scenes[name]}</svg></div>`).join('\n');
  const browser = await launchBrowser(require('puppeteer'));
  try {
    const page = await browser.newPage();
    await page.setViewport({width: W, height: H, deviceScaleFactor: 1});
    await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}.scene,.scene svg{display:block}</style></head><body>${blocks}</body></html>`, {waitUntil: 'load'});
    for (let index = 0; index < names.length; index++) {
      const element = await page.$(`#scene-${index}`);
      if (!element) throw new Error(`找不到案例图节点 ${names[index]}`);
      for (const output of OUTPUTS) {
        fs.mkdirSync(output, {recursive: true});
        await element.screenshot({path: path.join(output, `${names[index]}.png`), omitBackground: true});
      }
      console.log(`rendered ${names[index]}.png`);
    }
  } finally {
    await browser.close();
  }
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
