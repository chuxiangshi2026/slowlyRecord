#!/usr/bin/env node
/**
 * 诗词/成语 JSON → 移动端 ts 数据文件转换器。
 *
 * mobile/src/subPackages/pages-memory/text-memory/data/*.json 是移动端诗词数据
 * （为移动端精简后的版本，与桌面端 public/datafile/poetry|idioms 不同源，勿混用）。
 * uni-app 工具链把 .json 动态 import 生成的 chunk 一律放入主包 chunks/，
 * 改成 ts 模块后 chunk 走 js 管线，归属引用方所在的 pages-memory 分包
 * （详见性能摸底：回收主包 ~225KB）。
 *
 * 本脚本把 data/*.json 转换成 mobile/src/subPackages/pages-memory/text-memory/poetry-data/*.ts，
 * 供 library.ts 动态 import。改源 JSON 后重跑本脚本即可重新生成。
 *
 * 用法：
 *   node mobile/scripts/convert-poetry.cjs                     # 全部（10 个朝代诗词 + 成语）
 *   node mobile/scripts/convert-poetry.cjs poetry-tang idioms  # 指定文件（不带 .json 后缀）
 */
const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '..', 'src', 'subPackages', 'pages-memory', 'text-memory', 'data');
const OUT_DIR = path.join(__dirname, '..', 'src', 'subPackages', 'pages-memory', 'text-memory', 'poetry-data');

// 只转换 library.ts 引用的数据文件；index/legacy-backup 不参与运行时加载
const ALL_IDS = [
  'poetry-xianqin', 'poetry-han', 'poetry-weijin', 'poetry-sui', 'poetry-tang',
  'poetry-song', 'poetry-yuan', 'poetry-ming', 'poetry-qing', 'poetry-xiandai',
  'idioms',
];

function convert(id) {
  const src = path.join(DATA_DIR, `${id}.json`);
  const data = JSON.parse(fs.readFileSync(src, 'utf8'));
  const count = Array.isArray(data.poems) ? data.poems.length
    : Array.isArray(data.idioms) ? data.idioms.length : 0;
  const ts =
    `/**\n` +
    ` * 内置诗词数据：${id}（由 text-memory/data/${id}.json 转换生成，请勿手改；改源数据后重跑 mobile/scripts/convert-poetry.cjs）\n` +
    ` */\n` +
    `\n` +
    `const data = ${JSON.stringify(data, null, 2)} as const\n` +
    `\n` +
    `export default data\n`;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, `${id}.ts`), ts);
  console.log('converted', `${id}.ts`, `(${count} 条)`);
}

const ids = process.argv.slice(2);
(ids.length === 0 ? ALL_IDS : ids).forEach(convert);
