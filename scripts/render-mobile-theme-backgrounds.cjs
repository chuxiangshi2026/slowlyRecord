#!/usr/bin/env node
/**
 * 全局小程序古风背景：宣纸纹理 + 水墨山水 / 竹影 / 梅枝祥云。
 * 输出到 mobile/src/static/theme-bg/（亮/暗各 3 张，JPEG，2 倍分辨率，不透明底避免彩边）。
 *
 * 细腻感来源：
 *  - 山脊/竹枝由程序生成（多倍频正弦叠加 + Catmull-Rom 平滑），不是手绘卡通折线
 *  - 墨色边缘经 feTurbulence + feDisplacementMap 做「渗化」，像毛笔落在宣纸上的洇开
 *  - 层间以高斯模糊的雾带分隔，营造空气透视（远山淡、近山浓）
 *  - 整张纸面叠 fractalNoise 细颗粒，模拟宣纸纤维
 *  - 不画印章/落款（曾被误认为水印），画面只保留山水/竹影/梅云本体
 * 重跑：node scripts/render-mobile-theme-backgrounds.cjs
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..')
const OUT_DIR = path.join(ROOT, 'mobile', 'src', 'static', 'theme-bg')
const W = 750
const H = 1334
const SCALE = 2

// ---------- 可复现随机数（山脊形状固定，避免每次重跑构图漂移） ----------
function mulberry32(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

// ---------- 山脊线：三个倍频正弦叠加出自然起伏，Catmull-Rom 平滑 ----------
function ridgePoints(seed, baseY, amp, detail) {
  const rnd = mulberry32(seed)
  const p1 = 0.0042 + rnd() * 0.0022, p2 = 0.0105 + rnd() * 0.007, p3 = 0.024 + rnd() * 0.012
  const a1 = amp * (0.52 + rnd() * 0.22), a2 = amp * (0.26 + rnd() * 0.16), a3 = amp * 0.11
  const o1 = rnd() * Math.PI * 2, o2 = rnd() * Math.PI * 2, o3 = rnd() * Math.PI * 2
  const pts = []
  for (let i = 0; i <= detail; i++) {
    const x = (i / detail) * W
    const y = baseY
      - Math.sin(x * p1 + o1) * a1
      - Math.sin(x * p2 + o2) * a2
      - Math.sin(x * p3 + o3) * a3
    pts.push([x, y])
  }
  return pts
}

function smoothPath(pts) {
  const f = (n) => n.toFixed(1)
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i]
    const p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)]
    const c1x = p1[0] + (p2[0] - p0[0]) / 6, c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6, c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += `C${f(c1x)},${f(c1y)} ${f(c2x)},${f(c2y)} ${f(p2[0])},${f(p2[1])}`
  }
  return d
}

function ridgePath(seed, baseY, amp, detail = 16) {
  return smoothPath(ridgePoints(seed, baseY, amp, detail)) + `L${W},${H} L0,${H} Z`
}

/** 远景山体（竹影/梅云场景的底部墨量来源）：两层低对比远山，暗色整体压淡 */
function farRidges(ink, dark, base = 980) {
  const m = dark ? 0.7 : 1
  const layers = [
    { seed: 71, baseY: base, amp: 44, top: 0.13, bottom: 0.20, scale: 14, blur: 0.9 },
    { seed: 83, baseY: base + 98, amp: 54, top: 0.19, bottom: 0.30, scale: 10, blur: 0.6 },
  ]
  let defs = ''
  layers.forEach((l, i) => {
    defs += `<linearGradient id="fr${i}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${ink}" stop-opacity="${(l.top * m).toFixed(3)}"/>
      <stop offset="100%" stop-color="${ink}" stop-opacity="${(l.bottom * m).toFixed(3)}"/>
    </linearGradient>`
    defs += inkBleedDef(`fib${i}`, l.seed, l.scale, l.blur)
  })
  let body = ''
  layers.forEach((l, i) => {
    body += `<path d="${ridgePath(l.seed, l.baseY, l.amp)}" fill="url(#fr${i})" filter="url(#fib${i})"/>`
  })
  return { defs, body }
}

// ---------- 公共滤镜 / 纹理 ----------

/** 宣纸纤维颗粒：fractalNoise 的高频 alpha 起伏转成墨色斑点，极淡 */
function paperGrain(rgb, dark) {
  return `<filter id="grain" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  0 0 0 ${dark ? 0.055 : 0.038} 0"/>
  </filter><rect width="${W}" height="${H}" filter="url(#grain)"/>`
}

/** 绢帛细纹：低频横向纹理，让纸面有「绢」的织感（比纯噪点更细腻） */
function silkWeave(rgb, dark) {
  return `<filter id="weave" x="0" y="0" width="100%" height="100%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.008 0.35" numOctaves="2" stitchTiles="stitch" result="n"/>
    <feColorMatrix in="n" type="matrix" values="0 0 0 0 ${rgb[0]}  0 0 0 0 ${rgb[1]}  0 0 0 0 ${rgb[2]}  0 0 0 ${dark ? 0.03 : 0.022} 0"/>
  </filter><rect width="${W}" height="${H}" filter="url(#weave)"/>`
}

/** 水墨渗化：分形噪声位移让墨边不规则洇开 + 微高斯柔化 */
function inkBleedDef(id, seed, scale, blur) {
  return `<filter id="${id}" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
    <feTurbulence type="fractalNoise" baseFrequency="0.011 0.024" numOctaves="3" seed="${seed}" result="n"/>
    <feDisplacementMap in="SourceGraphic" in2="n" scale="${scale}" xChannelSelector="R" yChannelSelector="G" result="d"/>
    <feGaussianBlur in="d" stdDeviation="${blur}"/>
  </filter>`
}

/** 雾带：横向大高斯模糊条，隔在山层之间（大而淡，避免读出带状边缘） */
function mistDef(id, blur) {
  return `<filter id="${id}" x="-30%" y="-160%" width="160%" height="420%" color-interpolation-filters="sRGB">
    <feGaussianBlur stdDeviation="${blur}"/>
  </filter>`
}

/** 写意飞鸟：两笔细弧成翼，远处更小更淡 */
function birds(cx, cy, ink, dark) {
  const op = dark ? 0.20 : 0.30
  const one = (x, y, s, o) => `<g transform="translate(${x},${y}) scale(${s})" opacity="${o}">
    <path d="M-16,0 Q-7,-9 0,-2 Q7,-9 16,0" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round"/>
  </g>`
  return one(cx, cy, 1, op) + one(cx + 74, cy + 42, 0.72, op * 0.8) + one(cx - 60, cy + 58, 0.5, op * 0.6)
}

// ---------- 场景一：山水（远黛近峦 + 江面扁舟） ----------
function landscape(ink, rgb, dark) {
  const m = dark ? 0.72 : 1 // 暗色下整体压淡
  // 由远及近 5 层：越近越浓、位移渗化越弱（近山笔触清晰）
  const layers = [
    { seed: 11, baseY: 800, amp: 50, top: 0.26, bottom: 0.10, scale: 16, blur: 0.9 },
    { seed: 23, baseY: 905, amp: 62, top: 0.36, bottom: 0.15, scale: 13, blur: 0.75 },
    { seed: 37, baseY: 1012, amp: 70, top: 0.46, bottom: 0.20, scale: 10, blur: 0.55 },
    { seed: 51, baseY: 1122, amp: 78, top: 0.56, bottom: 0.26, scale: 7, blur: 0.4 },
    { seed: 68, baseY: 1240, amp: 86, top: 0.68, bottom: 0.42, scale: 4, blur: 0.25 },
  ]
  let defs = ''
  layers.forEach((l, i) => {
    defs += `<linearGradient id="m${i}" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${ink}" stop-opacity="${(l.top * m).toFixed(3)}"/>
      <stop offset="100%" stop-color="${ink}" stop-opacity="${(l.bottom * m).toFixed(3)}"/>
    </linearGradient>`
    defs += inkBleedDef(`ib${i}`, l.seed, l.scale, l.blur)
  })
  // 日/月光晕：暗色为月，亮色为淡日
  defs += `<radialGradient id="sun"><stop offset="0%" stop-color="${ink}" stop-opacity="${dark ? 0.20 : 0.13}"/><stop offset="55%" stop-color="${ink}" stop-opacity="${dark ? 0.08 : 0.05}"/><stop offset="100%" stop-color="${ink}" stop-opacity="0"/></radialGradient>`

  let s = defs
  const defsLen = defs.length
  // 天空极淡的渐层，让上半部不是死白/死黑
  s += `<rect width="${W}" height="620" fill="${ink}" opacity="${dark ? 0.03 : 0.025}"/>`
  s += `<circle cx="592" cy="182" r="96" fill="url(#sun)"/>`
  if (dark) s += `<circle cx="592" cy="182" r="34" fill="${ink}" opacity="0.12"/>`
  layers.forEach((l, i) => {
    s += `<path d="${ridgePath(l.seed, l.baseY, l.amp)}" fill="url(#m${i})" filter="url(#ib${i})"/>`
    // 空气透视：每画完一层远山，罩一层底色渐变薄纱再画近山——远山自然没入雾中。
    // 用 userSpaceOnUse 线性渐变（220px 内 0→目标不透明度），完全无硬边，不会读出「横带」
    if (i < layers.length - 1) {
      const veilOp = (dark ? 0.14 : 0.17) - i * 0.03
      const y0 = l.baseY - 110
      defs += `<linearGradient id="v${i}" gradientUnits="userSpaceOnUse" x1="0" y1="${y0}" x2="0" y2="${y0 + 220}">
        <stop offset="0%" stop-color="${dark ? '#151a18' : '#f5f5f5'}" stop-opacity="0"/>
        <stop offset="100%" stop-color="${dark ? '#151a18' : '#f5f5f5'}" stop-opacity="${veilOp.toFixed(3)}"/>
      </linearGradient>`
      s += `<rect x="0" y="${y0}" width="${W}" height="${H - y0}" fill="url(#v${i})"/>`
    }
  })
  // defs 在 forEach 中被追加（纱罩渐变），必须最后拼到输出里
  s = defs + s.slice(defsLen)
  // 江面：近山脚几道细长水波
  const wop = dark ? 0.13 : 0.17
  const waves = [[150, 1294, 130], [360, 1308, 96], [520, 1288, 150], [240, 1322, 80]]
  for (const [x, y, len] of waves) {
    s += `<path d="M${x},${y} q${len * 0.25},-5 ${len * 0.5},0 t${len * 0.5},0" fill="none" stroke="${ink}" stroke-width="1.6" stroke-linecap="round" opacity="${wop}"/>`
  }
  // 一叶扁舟
  s += `<g transform="translate(196,1248)" opacity="${(dark ? 0.32 : 0.42)}">
    <path d="M-36,2 Q-24,12 0,12 Q24,12 38,0 Q16,5 -14,4 Z" fill="${ink}"/>
    <path d="M-4,2 L-4,-26 Q10,-18 16,-2 Z" fill="${ink}" opacity="0.75"/>
    <path d="M-4,-26 L-4,4" stroke="${ink}" stroke-width="1.4"/>
  </g>`
  s += birds(470, 300, ink, dark)
  return s
}

// ---------- 场景二：竹影（竹竿带节微弯，叶簇生于枝节） ----------
function bamboo(ink, rgb, dark) {
  const m = dark ? 0.66 : 1
  const far = farRidges(ink, dark, 940)
  let defs = mistDef('mist', 20) + inkBleedDef('bleed', 31, 5, 0.35) + far.defs
  // 注意：stem() 运行时才向 defs 追加渐变，defs 必须在 return 时最后拼接，不能用 s = defs 提前固化
  let s = ''

  // 竹叶：细长披针形，叶尖微垂
  const leaf = (len, wid) =>
    `M0,0 C${(len * 0.30).toFixed(1)},${(-wid * 0.62).toFixed(1)} ${(len * 0.72).toFixed(1)},${(-wid * 0.45).toFixed(1)} ${len},${(wid * 0.12).toFixed(1)} C${(len * 0.74).toFixed(1)},${(wid * 0.42).toFixed(1)} ${(len * 0.30).toFixed(1)},${(wid * 0.52).toFixed(1)} 0,0 Z`

  // 叶簇：一个节位向四周舒展 5~7 叶，长短/深浅不一
  const leafCluster = (x, y, baseAngle, spread, seed) => {
    const rnd = mulberry32(seed)
    const n = 5 + Math.floor(rnd() * 3)
    let g = ''
    for (let i = 0; i < n; i++) {
      const ang = baseAngle + (i / (n - 1) - 0.5) * spread + (rnd() - 0.5) * 16
      const len = 66 + rnd() * 58
      const wid = len * 0.26
      const op = (0.14 + rnd() * 0.12) * m
      g += `<path d="${leaf(len, wid)}" transform="translate(${x},${y}) rotate(${ang.toFixed(1)})" fill="${ink}" opacity="${op.toFixed(3)}"/>`
    }
    return g
  }

  // 竹竿：两段贝塞尔微弯，节处收细并画节环；由底向上逐节变细
  const stem = (x0, lean, seed) => {
    const rnd = mulberry32(seed)
    const y0 = H + 30, y1 = 60 + rnd() * 160
    const w0 = 19 + rnd() * 5, w1 = w0 * 0.45
    const bend = lean // 顶端相对底端的水平偏移量（非绝对坐标）
    // 左右两条边：自下而上的缓弯
    const side = (dx0, dx1) =>
      `M${x0 + dx0},${y0} C${x0 + dx0 * 0.9 + bend * 0.25},${y0 - (y0 - y1) * 0.35} ${x0 + dx1 * 1.1 + bend * 0.7},${y0 - (y0 - y1) * 0.72} ${x0 + dx1 + bend},${y1}`
    const gradId = `sg${seed}`
    defs += `<linearGradient id="${gradId}" x1="0%" y1="100%" x2="0%" y2="0%">
      <stop offset="0%" stop-color="${ink}" stop-opacity="${(0.42 * m).toFixed(3)}"/>
      <stop offset="100%" stop-color="${ink}" stop-opacity="${(0.21 * m).toFixed(3)}"/>
    </linearGradient>`
    let st = `<path d="${side(-w0 / 2, -w1 / 2)} L${x0 + w1 / 2 + bend},${y1} C${x0 + w1 * 1.1 / 2 + bend * 0.7},${y0 - (y0 - y1) * 0.72} ${x0 + w0 * 0.9 / 2 + bend * 0.25},${y0 - (y0 - y1) * 0.35} ${x0 + w0 / 2},${y0} Z" fill="url(#${gradId})"/>`
    // 节环 + 节位出叶
    const nodes = []
    const nodeGap = 168 + rnd() * 26
    for (let y = y0 - 60; y > y1 + 90; y -= nodeGap) {
      const t = (y0 - y) / (y0 - y1)
      const cx = x0 + bend * t * t * (1.6 - 0.6 * t)
      const cw = w0 + (w1 - w0) * t
      st += `<path d="M${cx - cw * 0.62},${y} Q${cx},${y - 5} ${cx + cw * 0.62},${y}" stroke="${ink}" stroke-width="2.4" fill="none" opacity="${(0.23 * m).toFixed(3)}"/>`
      nodes.push([cx, y, t])
    }
    return { markup: st, nodes }
  }

  // 四竿竹：右前一竿粗壮，其后三竿渐细渐淡，整体微向左倾
  const stems = [
    stem(622, -36, 7),
    stem(688, -16, 13),
    stem(566, -56, 29),
    stem(724, -8, 41),
  ]
  let leaves = ''
  for (const stObj of stems) {
    for (const [cx, cy, t] of stObj.nodes) {
      // 只在中上部的节生叶；越往上叶越盛
      if (t < 0.3) continue
      const rndA = ((cx * 7 + cy * 13) % 100) / 100
      leaves += leafCluster(cx, cy - 8, -70 - rndA * 60, 150, Math.floor(cx * 31 + cy * 17))
      if (rndA > 0.35) leaves += leafCluster(cx, cy - 4, 20 + rndA * 50, 130, Math.floor(cx * 13 + cy * 41))
    }
    s += stObj.markup
  }
  // 竹后远山 + 一层淡雾，拉开与底色的纵深
  s += far.body
  s += `<rect x="-40" y="1010" width="${W + 80}" height="150" fill="${dark ? '#151a18' : '#f5f5f5'}" opacity="${dark ? 0.12 : 0.24}" filter="url(#mist)"/>`
  s += `<g filter="url(#bleed)">${leaves}</g>`
  return defs + s
}

// ---------- 场景三：梅枝祥云（左上寒梅 + 底部如意云） ----------
function clouds(ink, rgb, dark) {
  const m = dark ? 0.68 : 1
  const far = farRidges(ink, dark, 1040)
  let defs = mistDef('mist', 18) + inkBleedDef('bleed', 47, 4, 0.3) + far.defs
  let s = defs

  // 梅花：五瓣椭圆 + 细蕊点
  const blossom = (x, y, r, rot, seed) => {
    const rnd = mulberry32(seed)
    const op = ((dark ? 0.30 : 0.40) + rnd() * 0.06).toFixed(3)
    let b = `<g transform="translate(${x},${y}) rotate(${rot})" opacity="${op}">`
    for (let a = 0; a < 5; a++) {
      b += `<ellipse cx="0" cy="${(-r * 0.60).toFixed(1)}" rx="${(r * 0.40).toFixed(1)}" ry="${(r * 0.60).toFixed(1)}" fill="#a76a5b" transform="rotate(${a * 72})"/>`
    }
    b += `<circle r="${(r * 0.17).toFixed(1)}" fill="#8c4f43"/>`
    for (let a = 0; a < 6; a++) {
      const ang = (a / 6) * Math.PI * 2
      b += `<circle cx="${(Math.cos(ang) * r * 0.42).toFixed(1)}" cy="${(Math.sin(ang) * r * 0.42).toFixed(1)}" r="${(r * 0.05).toFixed(1)}" fill="#8c4f43"/>`
    }
    b += '</g>'
    return b
  }
  // 花苞
  const bud = (x, y, r, op) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#a76a5b" opacity="${op}"/>`

  // 梅枝：顿挫折线主干（老枝）+ 细分枝，笔意靠折角与粗细变化
  const branchOp = (0.38 * m).toFixed(3)
  s += `<g filter="url(#bleed)" stroke="${ink}" fill="none" stroke-linecap="round">
    <path d="M-16,392 C52,348 84,336 128,288 C158,256 172,214 216,186 C246,166 264,132 300,96" stroke-width="7" opacity="${branchOp}"/>
    <path d="M128,288 C150,300 178,298 204,286" stroke-width="4" opacity="${branchOp}"/>
    <path d="M216,186 C232,196 256,196 282,180" stroke-width="3.4" opacity="${branchOp}"/>
    <path d="M84,336 C100,352 124,360 148,350" stroke-width="3" opacity="${branchOp}"/>
    <path d="M300,96 C314,84 322,66 330,44" stroke-width="2.6" opacity="${branchOp}"/>
  </g>`
  // 沿枝布花：主枝节点大花，末梢花苞
  s += blossom(128, 288, 16, -12, 3) + blossom(204, 198, 14, 24, 5) + blossom(282, 180, 13, -30, 9)
  s += blossom(148, 350, 13, 40, 11) + blossom(92, 342, 11, -50, 13) + blossom(330, 44, 12, 8, 17)
  s += blossom(216, 186, 11, 60, 19) + blossom(52, 368, 10, -20, 23)
  s += bud(236, 168, 5, dark ? 0.24 : 0.32) + bud(160, 276, 4.5, dark ? 0.22 : 0.3) + bud(310, 74, 4, dark ? 0.22 : 0.3) + bud(52, 356, 4.5, dark ? 0.2 : 0.27) + bud(258, 148, 4, dark ? 0.2 : 0.27)

  // 底部远山（承接画面重心）
  s += far.body
  // 如意云：螺旋云头 + 拖尾云脚，三组错落
  const cloudOp = dark ? 0.30 : 0.40
  const ruyi = (x, y, sc, flip) => `
    <g transform="translate(${x},${y}) scale(${flip ? -sc : sc},${sc})" stroke="${ink}" fill="none" stroke-linecap="round" opacity="${cloudOp}">
      <path d="M0,0 a30,26 0 1,1 30,-26" stroke-width="3.2"/>
      <path d="M8,-6 a15,13 0 1,1 15,-13" stroke-width="2.6"/>
      <path d="M14,-12 a7,6 0 1,1 7,-7" stroke-width="2.2"/>
      <path d="M30,-2 C58,10 84,8 112,-2 C138,-11 164,-6 182,8" stroke-width="3"/>
      <path d="M52,14 C76,22 102,20 128,10" stroke-width="2.4" opacity="0.7"/>
    </g>`
  s += `<g filter="url(#bleed)">`
  s += ruyi(96, 1146, 1, false)
  s += ruyi(468, 1240, 0.82, true)
  s += ruyi(268, 1082, 0.6, false)
  s += `</g>`
  // 云下淡雾收底
  s += `<rect x="-40" y="1206" width="${W + 80}" height="128" fill="${dark ? '#151a18' : '#f5f5f5'}" opacity="${dark ? 0.10 : 0.20}" filter="url(#mist)"/>`
  return s
}

const SCENES = { landscape, bamboo, clouds }
const THEMES = [
  { suffix: 'light', bg: '#f5f5f5', ink: '#52796f', rgb: [0.322, 0.475, 0.435], dark: false },
  { suffix: 'dark', bg: '#151a18', ink: '#83c5a8', rgb: [0.514, 0.773, 0.658], dark: true },
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
      jobs.push({
        name: `${name}-${theme.suffix}`,
        bg: theme.bg,
        body: render(theme.ink, theme.rgb, theme.dark) + paperGrain(theme.rgb, theme.dark) + silkWeave(theme.rgb, theme.dark),
      })
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
      // JPEG 输出：纸纹噪声让 PNG 体积爆炸（3MB+/张），JPEG 同画质约 1/30，主包体积必须克制
      await el.screenshot({ path: path.join(OUT_DIR, `${jobs[i].name}.jpg`), type: 'jpeg', quality: 86 })
      console.log('rendered', `${jobs[i].name}.jpg`)
    }

    // ---- 磨砂卡片底图：山水场景重度模糊 + 奶白/墨绿罩层，**半透明**（烘焙 alpha）----
    // 为什么半透明：卡片必须透出页面水墨背景（用户要的是"玻璃"，不是"不透明板"）；
    // 为什么不直接 rgba：安卓微信不支持 backdrop-filter，靠预渲染的模糊墨影给出磨砂质感。
    // 为什么要 base64：小程序 WXSS background-image 不接受包内本地图片（仅网络/base64）。
    const GLASS_VEIL = { light: 'rgba(255,255,255,0.34)', dark: 'rgba(21,26,24,0.32)' }
    const glassJobs = THEMES.map((t) => ({
      suffix: t.suffix,
      veil: GLASS_VEIL[t.suffix],
      body: landscape(t.ink, t.rgb, t.dark) + paperGrain(t.rgb, t.dark) + silkWeave(t.rgb, t.dark),
    }))
    // 页面背景透明 + omitBackground：截出带 alpha 的磨砂纹理（墨影不透死，玻璃才透光）
    const glassHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>html,body{margin:0;background:transparent}.g{position:relative;display:inline-block;width:${W}px;height:${H}px;overflow:hidden}.g .blur{position:absolute;left:-8%;top:-8%;width:116%;height:116%;filter:blur(18px);opacity:.9}.g .veil{position:absolute;left:0;top:0;width:100%;height:100%}.g svg{display:block;width:100%;height:100%}</style></head><body>${glassJobs.map((j, i) => `<div id="g${i}" class="g"><div class="blur"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" color-interpolation="sRGB">${j.body}</svg></div><div class="veil" style="background:${j.veil}"></div></div>`).join('')}</body></html>`
    const glassPage = await browser.newPage()
    // 半分辨率输出：磨砂图无需细节，750×1334 → 375×667，体积减半
    await glassPage.setViewport({ width: W * glassJobs.length, height: H, deviceScaleFactor: 0.5 })
    await glassPage.setContent(glassHtml, { waitUntil: 'load' })
    const dataUris = []
    for (let i = 0; i < glassJobs.length; i++) {
      const el = await glassPage.$(`#g${i}`)
      if (!el) throw new Error(`找不到磨砂节点 #g${i}`)
      // WebP：带 alpha 且体积只有 PNG 的零头（微信 WebView 两端均支持）
      let buf
      try {
        buf = await el.screenshot({ type: 'webp', quality: 70, omitBackground: true })
      } catch {
        buf = await el.screenshot({ type: 'png', omitBackground: true })
      }
      const mime = buf[8] === 0x50 && buf[9] === 0x4e ? 'png' : 'webp'
      dataUris.push(`data:image/${mime};base64,${buf.toString('base64')}`)
      console.log(`rendered glass-${glassJobs[i].suffix}（${mime}, ${(buf.length / 1024).toFixed(1)} KB）`)
    }
    const cssOut = path.join(ROOT, 'mobile', 'src', 'assets', 'theme-glass.css')
    const css = `/* 生成文件，勿手改：node scripts/render-mobile-theme-backgrounds.cjs
   磨砂卡片底：预渲染「半透明模糊水墨 + 奶白/墨绿罩层」（带 alpha 的 webp，base64 内联）。
   卡片半透明透出页面水墨背景；安卓不支持 backdrop-filter，磨砂感由这里的墨影提供。
   末层 rgba 为图片未就绪时的兜底。卡样式统一 var(--sr-card-glass)。 */
page {
  --sr-card-glass: url("${dataUris[0]}") center / cover no-repeat, rgba(255, 255, 255, 0.28);
}
.theme-dark {
  --sr-card-glass: url("${dataUris[1]}") center / cover no-repeat, rgba(34, 40, 37, 0.28);
}
`
    fs.mkdirSync(path.dirname(cssOut), { recursive: true })
    fs.writeFileSync(cssOut, css)
    console.log(`written ${path.relative(ROOT, cssOut)}（${(css.length / 1024).toFixed(1)} KB）`)
  } finally {
    await browser.close()
  }
  console.log(`完成：${jobs.length} 张主题背景（${W * SCALE}×${H * SCALE}）+ 磨砂卡片底 CSS`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})