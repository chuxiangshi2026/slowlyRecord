#!/usr/bin/env node
/**
 * 知识包 JSON → 移动端 ts 数据文件转换器。
 *
 * public/knowledgebanks/*.json 是知识包源数据（桌面端运行时直接加载），
 * 本脚本把它们转换成 mobile/src/subPackages/pages-knowledge/knowledgebanks/*.ts，
 * 供移动端打包进分包（避免运行时发请求）。
 *
 * 用法：
 *   node mobile/scripts/convert-knowledgebanks.cjs           # 全部包
 *   node mobile/scripts/convert-knowledgebanks.cjs math-calculus math-linalg  # 指定包
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const JSON_DIR = path.join(ROOT, 'public', 'knowledgebanks');
const OUT_DIR = path.join(ROOT, 'mobile', 'src', 'subPackages', 'pages-knowledge', 'knowledgebanks');

function convert(id) {
  const src = path.join(JSON_DIR, `${id}.json`);
  const pack = JSON.parse(fs.readFileSync(src, 'utf8'));
  if (!pack.id || !Array.isArray(pack.items)) {
    throw new Error(`${id}.json 不是合法的知识包`);
  }
  const body = JSON.stringify(pack, null, 2);
  const ts =
    `/**\n` +
    ` * 内置知识包：${pack.name}（由 public/knowledgebanks/${id}.json 转换生成，请勿手改）\n` +
    ` */\n` +
    `import type { KnowledgePack } from '@/stores/useUtils/types'\n` +
    `\n` +
    `const pack: KnowledgePack = ${body}\n` +
    `\n` +
    `export default pack\n`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${id}.ts`), ts);
  console.log('converted', `${id}.ts`, `(${pack.items.length} 条)`);
}

const ids = process.argv.slice(2);
if (ids.length === 0) {
  for (const f of fs.readdirSync(JSON_DIR)) {
    if (f.endsWith('.json')) ids.push(f.replace(/\.json$/, ''));
  }
}
ids.forEach(convert);
