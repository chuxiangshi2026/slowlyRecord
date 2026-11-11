#!/usr/bin/env node
/**
 * 知识包 JSON → 移动端 ts 数据文件转换器。
 *
 * public/knowledgebanks/*.json 是知识包源数据（桌面端运行时直接加载），
 * 本脚本把它们转换成 mobile/src/subPackages/pages-knowledge/knowledgebanks/*.ts，
 * 供移动端打包进分包（避免运行时发请求）。
 * usableAsPeg 的桩库会额外复制一份到 pages-memory/knowledgebanks/（记忆宫殿桩库数据源，
 * 分包隔离要求 pages-memory 只能引用分包内模块，副本与本目录文件由本脚本同一次生成、内容一致）。
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
// 桩库（usableAsPeg）同时输出到 pages-memory 分包：小程序分包之间禁止互引模块，
// 记忆宫殿的 peg-packs.ts 只能 import 本分包内的数据副本（与上方同一份生成内容）
const OUT_DIR_PEG = path.join(ROOT, 'mobile', 'src', 'subPackages', 'pages-memory', 'utils', 'knowledgebanks');

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
    (pack.usableAsPeg ? ` * 本文件同时输出到 pages-knowledge 与 pages-memory（桩库）两个分包\n` : ``) +
    ` */\n` +
    `import type { KnowledgePack } from '@/stores/useUtils/types'\n` +
    `\n` +
    `const pack: KnowledgePack = ${body}\n` +
    `\n` +
    `export default pack\n`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${id}.ts`), ts);
  if (pack.usableAsPeg) {
    fs.mkdirSync(OUT_DIR_PEG, { recursive: true });
    fs.writeFileSync(path.join(OUT_DIR_PEG, `${id}.ts`), ts);
  }
  console.log('converted', `${id}.ts`, `(${pack.items.length} 条)`, pack.usableAsPeg ? '+peg副本' : '');
}

const ids = process.argv.slice(2);
if (ids.length === 0) {
  for (const f of fs.readdirSync(JSON_DIR)) {
    if (f.endsWith('.json')) ids.push(f.replace(/\.json$/, ''));
  }
}
ids.forEach(convert);
