#!/usr/bin/env node
/**
 * 把桌面端内置诗词的人工英译（public/datafile/poetry/*.json 的 translation/translationSource）
 * 按「正文归一化」匹配拷贝到移动端诗词数据：
 *   mobile/src/subPackages/pages-memory/text-memory/data/poetry-*.json
 *
 * 移动端诗词是精简子集，命中率约 15%（来自 chinese-poems.com 的人工英译，见仓库根 NOTICE）；
 * 未命中的文章在页面里走「译英文」在线翻译。
 * 之后必须重跑 mobile/scripts/convert-poetry.cjs 重新生成 poetry-data/*.ts。
 *
 * 用法：node mobile/scripts/copy-poetry-translations.cjs
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const DESK_DIR = path.join(ROOT, 'public', 'datafile', 'poetry');
const MOBILE_DIR = path.join(ROOT, 'mobile', 'src', 'subPackages', 'pages-memory', 'text-memory', 'data');

const norm = (s) => String(s || '').replace(/\s+/g, '');

// 桌面端：正文 → 译文
const byContent = new Map();
for (const name of fs.readdirSync(DESK_DIR)) {
  if (!name.endsWith('.json')) continue;
  const data = JSON.parse(fs.readFileSync(path.join(DESK_DIR, name), 'utf-8'));
  for (const poem of data.poems || []) {
    if (poem.translation) {
      byContent.set(norm(poem.content), {
        translation: poem.translation,
        translationSource: poem.translationSource || '',
      });
    }
  }
}

let total = 0;
let copied = 0;
for (const name of fs.readdirSync(MOBILE_DIR)) {
  if (!name.startsWith('poetry-') || !name.endsWith('.json')) continue;
  const file = path.join(MOBILE_DIR, name);
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  let changed = false;
  for (const poem of data.poems || []) {
    total++;
    const hit = byContent.get(norm(poem.content));
    if (hit) {
      poem.translation = hit.translation;
      if (hit.translationSource) poem.translationSource = hit.translationSource;
      else delete poem.translationSource;
      copied++;
      changed = true;
    } else if (!poem.translation) {
      // 保持数据干净：没有译文的文章不写空字段
      delete poem.translation;
      delete poem.translationSource;
    }
  }
  if (changed) {
    fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
    console.log(`✓ ${name}`);
  }
}
console.log(`\n完成：${total} 篇中 ${copied} 篇拷入人工英译`);
