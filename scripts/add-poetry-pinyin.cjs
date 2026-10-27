/**
 * 为内置诗词/文章数据批量补充拼音。
 *
 * 用法：node scripts/add-poetry-pinyin.cjs
 * 输出：直接写回 public/datafile/poetry/*.json，每篇新增 pinyin 字段。
 *
 * pinyin 与 content 逐行对应：每个汉字一个带声调音节，标点紧跟在前一音节后，
 * 空行保留。修改 content 后重跑本脚本即可。
 */
const fs = require('fs');
const path = require('path');
const { pinyin } = require('pinyin-pro');

const DIR = path.join(__dirname, '..', 'public', 'datafile', 'poetry');
const PUNCT = /[，。！？；：、“”‘’《》〈〉（）【】…—·,.!?;:'"()\[\]{}<>-]/;

/** 单行转拼音：汉字转音节，标点原位保留，非中文字符按原样输出 */
function toPinyinLine(line) {
  if (!line.trim()) return '';
  const parts = pinyin(line, { type: 'all', toneType: 'symbol' });
  let out = '';
  for (const part of parts) {
    const origin = part.origin || '';
    if (part.isZh) {
      if (out && !out.endsWith(' ')) out += ' ';
      out += part.pinyin;
    } else if (/\s/.test(origin)) {
      if (out && !out.endsWith(' ')) out += ' ';
    } else if (PUNCT.test(origin)) {
      out = out.replace(/\s+$/, '') + origin;
    } else {
      if (out && !out.endsWith(' ')) out += ' ';
      out += origin;
    }
  }
  return out.replace(/[ \t]+/g, ' ').trim();
}

function toPinyin(content) {
  let text = content.split('\n').map(toPinyinLine).join('\n');
  // 古诗文特殊读音：pinyin-pro 按现代汉语判断，这里修正少数固定读法
  const FIXES = [
    ['jiāng jìn jiǔ', 'qiāng jìn jiǔ'],       // 将进酒（将 = 请）
    ['jiàn niú yáng', 'xiàn niú yáng'],       // 风吹草低见牛羊（见 = 现）
    ['dài zōng fū rú hé', 'dài zōng fú rú hé'], // 岱宗夫如何（夫 = 语气词，读 fú）
    ['fēi zi xiào', 'fēi zǐ xiào'],           // 妃子笑
  ];
  for (const [from, to] of FIXES) text = text.split(from).join(to);
  return text;
}

let files = 0;
let poems = 0;
for (const name of fs.readdirSync(DIR)) {
  if (!name.endsWith('.json') || name === 'index.json') continue;
  const file = path.join(DIR, name);
  const data = JSON.parse(fs.readFileSync(file, 'utf-8'));
  if (!Array.isArray(data.poems)) continue;
  for (const poem of data.poems) {
    if (!poem.content) continue;
    poem.pinyin = toPinyin(poem.content);
    poems++;
  }
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n');
  files++;
  console.log(`✓ ${name}: ${data.poems.length} 篇`);
}
console.log(`\n完成：${files} 个文件、${poems} 篇已补充拼音`);
