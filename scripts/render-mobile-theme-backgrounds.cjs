#!/usr/bin/env node
/**
 * 全局小程序古风背景：宣纸底 + 淡墨山水 / 竹影 / 祥云。
 * 输出到 mobile/src/static/theme-bg/（亮/暗各 3 张，2 倍分辨率，不透明底避免彩边）。
 * 重跑：node scripts/render-mobile-theme-backgrounds.cjs
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'mobile', 'src', 'static', 'theme-bg')
const W = 750
const H = 1334
const SCALE = 2

function grain(ink, dark) {
  const op = dark ? 0.022 : 0.018
  return `<defs><pattern id="grain" width="96" height="96" patternUnits="userSpaceOnUse">
    <circle cx="13" cy="19" r="0.9" fill="${ink}" opacity="${op}"/>
    <circle cx="62" cy="47" r="0.7" fill="${ink}" opacity="${op * 0.8}"/>
    <circle cx="35" cy="78" r="0.8" fill="${ink}" opacity="${op * 0.65}"/>
    <circle cx="86" cy="88" r="0.6" fill="${ink}" opacity="${op * 0.7}"/>
  </pattern></defs><rect width="750" height="1334" fill="url(#grain)"/>`
}

function landscape(ink, dark) {
  const strength = dark ? 0.78 : 1
  const mountains = [
    { d: 'M0,930 C60,900 85,860 140,875 C190,890 230,820 285,842 C340,864 380,770 445,805 C500,835 545,790 600,820 C660,850 710,820 750,835 L750,1334 L0,1334 Z', top: 0.10, bottom: 0.025, blur: 2.8 },
    { d: 'M0,1015 C45,1000 75,955 130,970 C190,990 235,910 295,935 C355,960 395,875 460,905 C520,935 565,870 625,905 C690,940 730,915 750,920 L750,1334 L0,1334 Z', top: 0.15, bottom: 0.05, blur: 1.8 },
    { d: 'M0,1125 C35,1105 65,1070 125,1090 C180,1110 225,1025 290,1055 C350,1085 400,990 460,1025 C525,1060 565,980 635,1020 C695,1055 730,1030 750,1035 L750,1334 L0,1334 Z', top: 0.20, bottom: 0.085, blur: 1.2 },
    { d: 'M0,1235 C40,1215 80,1170 145,1195 C205,1220 250,1130 320,1165 C380,1195 430,1110 500,1150 C565,1188 610,1105 680,1150 C720,1175 735,1165 750,1170 L750,1334 L0,1334 Z', top: 0.26, bottom: 0.15, blur: 0.6 },
  ]
  let defs = '<defs>'
  mountains.forEach((m, i) => {
    defs += `<linearGradient id="m${i}" x1="0%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="${ink}" stop-opacity="${m.top * strength}"/><stop offset="100%" stop-color="${ink}" stop-opacity="${m.bottom * strength}"/></linearGradient>`
    defs += `<filter id="b${i}" x="-12%" y="-12%" width="124%" height="124%" color-interpolation-filters="sRGB"><feGaussianBlur stdDeviation="${m.blur}"/></filter>`
  })
  defs += `<radialGradient id="sun"><stop offset="0%" stop-color="${ink}" stop-opacity="${dark ? 0.12 : 0.16}"/><stop offset="100%" stop-color="${ink}" stop-opacity="0"/></radialGradient></defs>`
  let s = defs
  mountains.forEach((m, i) => { s += `<path d="${m.d}" fill="url(#m${i})" filter="url(#b${i})"/>` })
  s += `<circle cx="596" cy="188" r="76" fill="url(#sun)"/>`
  s += `<g stroke="${ink}" stroke-opacity="${dark ? 0.18 : 0.26}" stroke-width="3.5" stroke-linecap="round" fill="none"><path d="M432,296 q12,-12 24,0 q12,-12 24,0"/><path d="M500,338 q10,-10 20,0 q10,-10 20,0"/><path d="M548,286 q7,-7 14,0 q7,-7 14,0"/></g>`
  return s
}

function bamboo(ink, dark) {
  const op = dark ? 0.62 : 1
  let s = `<g transform="translate(28,40) rotate(7 610 650)" stroke="${ink}" stroke-linecap="round" fill="none" opacity="${op}">`
  const stems = [
    { x: 565, y1: 210, y2: 1220, w: 14, o: 0.08 },
    { x: 635, y1: 130, y2: 1190, w: 18, o: 0.10 },
    { x: 705, y1: 280, y2: 1260, w: 12, o: 0.075 },
  ]
  for (const b of stems) {
    s += `<path d="M${b.x},${b.y1} L${b.x - 32},${b.y2}" stroke-width="${b.w}" stroke-opacity="${b.o}"/>`
    for (let y = b.y1 + 150; y < b.y2; y += 190) {
      const x = b.x - ((y - b.y1) / (b.y2 - b.y1)) * 32
      s += `<path d="M${x - 12},${y} L${x + 12},${y}" stroke-width="3" stroke-opacity="${b.o * 1.6}"/>`
    }
  }
  const leaves = [
    'M600,420 C530,390 500,350 470,300 C535,322 580,350 600,420 Z',
    'M618,470 C675,420 720,390 748,340 C690,362 650,398 618,470 Z',
    'M590,610 C520,570 480,520 455,465 C525,492 565,535 590,610 Z',
    'M635,690 C700,640 730,600 752,548 C695,575 655,620 635,690 Z',
    'M570,830 C500,790 465,742 440,690 C510,715 548,755 570,830 Z',
    'M650,920 C710,875 742,830 760,780 C705,805 670,850 650,920 Z',
  ]
  for (const d of leaves) s += `<path d="${d}" fill="${ink}" fill-opacity="0.075" stroke="none"/>`
  s += '</g>'
  // 左下一枚低饱和朱砂印，增加古风点睛但不干扰阅读
  s += `<g transform="translate(82,1080) rotate(-4)" opacity="${dark ? 0.22 : 0.28}"><rect width="76" height="76" rx="8" fill="none" stroke="#a76a5b" stroke-width="3"/><text x="38" y="51" text-anchor="middle" font-size="42" font-family="serif" fill="#a76a5b">静</text></g>`
  return s
}

function clouds(ink, dark) {
  const op = dark ? 0.65 : 1
  let s = `<g fill="none" stroke="${ink}" stroke-linecap="round" opacity="${op}">`
  const cloudPaths = [
    'M-30,1080 C30,1040 75,1060 105,1025 C140,985 205,1015 190,1060 C250,1030 305,1060 290,1100 C350,1075 410,1105 390,1140',
    'M320,1180 C370,1140 420,1160 450,1125 C485,1085 550,1115 535,1160 C595,1130 650,1160 635,1200 C690,1175 745,1205 730,1240',
    'M-20,1260 C35,1225 85,1245 115,1210 C150,1175 210,1200 200,1240 C255,1215 305,1240 290,1275',
  ]
  for (const d of cloudPaths) s += `<path d="${d}" stroke-width="4" stroke-opacity="0.075"/>`
  s += '</g>'
  // 左上角一枝寒梅：细枝与少量朱砂花点，不铺大面积色块
  s += `<g fill="none" stroke="${ink}" stroke-linecap="round" opacity="${op}"><path d="M-20,330 C80,285 125,225 190,195 C230,176 260,145 292,108" stroke-width="7" stroke-opacity="0.075"/><path d="M105,252 C130,235 145,205 150,172 M180,202 C215,205 245,195 270,172" stroke-width="4" stroke-opacity="0.065"/></g>`
  const blossoms = [[150,172],[190,195],[238,176],[270,172],[112,244],[72,280],[292,108]]
  for (const [x, y] of blossoms) {
    s += `<g transform="translate(${x},${y})" fill="#a76a5b" opacity="${dark ? 0.20 : 0.26}"><circle cx="0" cy="-7" r="5"/><circle cx="7" cy="0" r="5"/><circle cx="0" cy="7" r="5"/><circle cx="-7" cy="0" r="5"/><circle cx="0" cy="0" r="3" fill="${ink}"/></g>`
  }
  return s
}

const SCENES = { landscape, bamboo, clouds: clouds }
const THEMES = [
  { suffix: 'light', bg: '#f5f5f5', ink: '#52796f', dark: false },
  { suffix: 'dark', bg: '#151a18', ink: '#83c5a8', dark: true },
]

async function launchBrowser(puppeteer) {
  const opts = { headless: true, timeout: 180000, args: ['--no-sandbox', '--disable-setuid-sandbox'] }
  try {
    return await puppeteer.launch(opts)
  } catch (error) {
    const candidates = [
      process.env.PUPPETEER_EXECUTABLE_PATH,
      '/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    ].filter(Boolean)
    const cacheDir = path.join(process.env.HOME || '', '.cache', 'ms-playwright')
    if (fs.existsSync(cacheDir)) {
      for (const dir of fs.readdirSync(cacheDir)) {
        candidates.push(path.join(cacheDir, dir, 'chrome-linux64', 'chrome'))
        candidates.push(path.join(cacheDir, dir, 'chrome-linux', 'chrome'))
      }
    }
    for (const exe of candidates) {
      if (fs.existsSync(exe)) return await puppeteer.launch({ ...opts, executablePath: exe })
    }
    throw error
  }
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  const jobs = []
  for (const theme of THEMES) {
    for (const [name, render] of Object.entries(SCENES)) {
      jobs.push({ name: `${name}-${theme.suffix}`, bg: theme.bg, body: grain(theme.ink, theme.dark) + render(theme.ink, theme.dark) })
    }
  }
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>body{margin:0}.scene{display:inline-block}.scene svg{display:block}</style></head><body>${jobs.map((j, i) => `<div id="s${i}" class="scene" style="background:${j.bg}"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" color-interpolation="sRGB">${j.body}</svg></div>`).join('')}</body></html>`
  const puppeteer = require('puppeteer')
  const browser = await launchBrowser(puppeteer)
  try {
    const page = await browser.newPage()
    await page.setViewport({ width: W * jobs.length, height: H, deviceScaleFactor: SCALE })
    await page.setContent(html, { waitUntil: 'load' })
    for (let i = 0; i < jobs.length; i++) {
      const el = await page.$(`#s${i}`)
      if (!el) throw new Error(`找不到背景节点 #s${i}`)
      await el.screenshot({ path: path.join(OUT_DIR, `${jobs[i].name}.png`) })
      console.log('rendered', `${jobs[i].name}.png`)
    }
  } finally {
    await browser.close()
  }
  console.log(`完成：${jobs.length} 张主题背景（${W * SCALE}×${H * SCALE}）`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
