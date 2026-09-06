/**
 * 导出项目中使用的图标为独立 SVG 文件，用于批量上传到 iconfont.cn 项目库
 *
 * 来源一：public/focus.html、public/input-method-helper.html 中的内联 <svg>
 * 来源二：src/ 中实际 import 的 @element-plus/icons-vue 图标（从 node_modules 提取 SVG）
 *
 * 输出：scripts/iconfont-svg/<来源子目录>/<名称>.svg
 * 上传：iconfont.cn → 我的项目 → 上传图标（可多选批量上传）→ 加入项目 → 下载字体包
 *
 * 用法：node scripts/export-icons-for-iconfont.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(__dirname, 'iconfont-svg');

// iconfont 生成字体要求 SVG 单色的说明：
// 上传后若图标为多色会被转单色，本项目图标均为单色 fill，无需处理

function ensureDir(dir) {
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
}

/** 提取 HTML 中 <span ... id="x" title="y"> <svg ...>...</svg> 结构 */
function extractInlineSvgs(htmlPath, outDir) {
  const html = fs.readFileSync(htmlPath, 'utf8');
  const re = /<(?:span|div|button)[^>]*id="([^"]+)"[^>]*?(?:title="([^"]*)")?[^>]*>[\s\S]*?(<svg[\s\S]*?<\/svg>)/g;
  let m;
  let count = 0;
  while ((m = re.exec(html))) {
    const [, id, title, svg] = m;
    let content = svg;
    if (!/xmlns=/.test(content)) {
      content = content.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    fs.writeFileSync(path.join(outDir, `${id}.svg`), content + '\n');
    count++;
    console.log(`  ${id}.svg${title ? `  （${title}）` : ''}`);
  }
  return count;
}

/** 从 @element-plus/icons-vue 打包产物（dist/index.cjs）中按组件名提取 SVG */
function extractElIcons(usedNames, outDir) {
  const bundle = fs.readFileSync(
    path.join(ROOT, 'node_modules/@element-plus/icons-vue/dist/index.cjs'), 'utf8'
  );
  // 按 "// src/components/xxx.vue" 注释分块，每块含 name: "Xxx" 与若干 path d 属性
  const blocks = bundle.split(/\/\/ src\/components\//).slice(1);
  const byName = new Map();
  for (const block of blocks) {
    const nameMatch = block.match(/name: "([A-Za-z0-9]+)"/);
    if (!nameMatch) continue;
    const viewBox = (block.match(/viewBox: "([^"]+)"/) || [])[1] || '0 0 1024 1024';
    const paths = [...block.matchAll(/d: "([^"]+)"/g)].map(m => m[1]);
    if (paths.length) byName.set(nameMatch[1], { viewBox, paths });
  }
  let count = 0;
  for (const name of usedNames) {
    const icon = byName.get(name);
    if (!icon) {
      console.log(`  ! 未找到 ${name}`);
      continue;
    }
    const file = name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase() + '.svg';
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${icon.viewBox}">\n` +
      icon.paths.map(d => `  <path d="${d}"/>`).join('\n') + '\n</svg>\n';
    fs.writeFileSync(path.join(outDir, file), svg);
    count++;
  }
  return count;
}

/** 扫描 src/ 下实际 import 的 el-icon 名称 */
function scanUsedElIcons() {
  const { execSync } = require('child_process');
  const out = execSync(
    `grep -rhoE "from '@element-plus/icons-vue'" --include=*.vue --include=*.ts src/ | wc -l`,
    { cwd: ROOT }
  );
  void out;
  // 直接解析 import 块
  const files = execSync(
    `grep -rl "@element-plus/icons-vue" --include=*.vue --include=*.ts src/`,
    { cwd: ROOT }
  ).toString().trim().split('\n').filter(Boolean);
  const names = new Set();
  for (const f of files) {
    const content = fs.readFileSync(path.join(ROOT, f), 'utf8');
    const re = /import\s*\{([^}]*)\}\s*from\s*['"]@element-plus\/icons-vue['"]/g;
    let m;
    while ((m = re.exec(content))) {
      m[1].split(',').map(s => s.trim()).filter(Boolean).forEach(n => names.add(n));
    }
  }
  return [...names].sort();
}

ensureDir(OUT);

console.log('== public/focus.html ==');
const d1 = path.join(OUT, 'focus');
fs.mkdirSync(d1, { recursive: true });
const c1 = extractInlineSvgs(path.join(ROOT, 'public/focus.html'), d1);

console.log('== public/input-method-helper.html ==');
const d2 = path.join(OUT, 'input-method-helper');
fs.mkdirSync(d2, { recursive: true });
const c2 = extractInlineSvgs(path.join(ROOT, 'public/input-method-helper.html'), d2);

console.log('== @element-plus/icons-vue（src 实际使用） ==');
const d3 = path.join(OUT, 'element-plus');
fs.mkdirSync(d3, { recursive: true });
const used = scanUsedElIcons();
const c3 = extractElIcons(used, d3);

console.log(`\n完成：focus ${c1} 个，input-method-helper ${c2} 个，element-plus ${c3}/${used.length} 个`);
console.log(`输出目录：${OUT}`);
