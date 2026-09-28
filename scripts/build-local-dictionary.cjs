/**
 * 本地词典（words/*.json）生成脚本
 *
 * 以 public/wordbanks 内置词库中的英语单词条目为源（word/phonetic/explains），
 * 合并补充进 words/ 字母分片：只新增本地词典缺失的单词，已有词条保持不动。
 *
 * 冲突优先级（先出现者优先，面向学生用户）：中考/专升本/高考/考公 > 四六级/考研/BEC >
 * 托福/雅思/GMAT/SAT/GRE > 等级词库 > 其他。
 *
 * 用法：
 *   node scripts/build-local-dictionary.cjs        # 合并全部词库
 *   node scripts/build-local-dictionary.cjs --dry  # 只统计不写文件
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const WORDS_DIR = path.join(ROOT, 'words');
const BANKS_DIR = path.join(ROOT, 'public', 'wordbanks');

// 冲突时的取用优先级（未列出的词库排在最后，按文件名排序）
const PRIORITY = [
  'zhongkao', 'zsb', 'gaokao', 'kaogong',
  'cet4', 'cet6', 'kaoyan', 'bec',
  'toefl', 'ielts', 'gmat', 'sat', 'gre',
  'level4', 'level8',
];

// 英语单词型词条（排除多词短语、日语/西语/法语/俄语等非英语词库内容）
const SINGLE_WORD = /^[a-z][a-z'-]*$/;

const dryRun = process.argv.includes('--dry');

// 1) 读取现有词典
const dict = {};
for (const l of 'abcdefghijklmnopqrstuvwxyz') {
  const file = path.join(WORDS_DIR, `${l}.json`);
  if (fs.existsSync(file)) Object.assign(dict, JSON.parse(fs.readFileSync(file, 'utf8')));
}
const existingCount = Object.keys(dict).length;

// 2) 按优先级遍历词库收集候选
const bankFiles = fs.readdirSync(BANKS_DIR)
  .filter(f => f.endsWith('.json'))
  .sort((a, b) => {
    const pa = PRIORITY.indexOf(a.replace('.json', ''));
    const pb = PRIORITY.indexOf(b.replace('.json', ''));
    return (pa === -1 ? 999 : pa) - (pb === -1 ? 999 : pb) || a.localeCompare(b);
  });

const candidates = new Map(); // word -> {phonetic, explains}
for (const f of bankFiles) {
  const bank = Object.values(JSON.parse(fs.readFileSync(path.join(BANKS_DIR, f), 'utf8')));
  for (const entry of bank) {
    const word = (entry.word || '').toLowerCase().trim();
    if (!SINGLE_WORD.test(word) || !entry.explains || !candidates.has(word) === false) continue;
    if (candidates.has(word)) continue; // 优先级高的已占位
    candidates.set(word, { phonetic: entry.phonetic || '', explains: [String(entry.explains)] });
  }
}

// 3) 只补充缺失词
const missing = [...candidates.keys()].filter(w => !dict[w]);
console.log(`现有词条: ${existingCount}`);
console.log(`词库候选(单词型, 去重): ${candidates.size}`);
console.log(`新增词条: ${missing.length}`);

if (dryRun) {
  const byLetter = {};
  missing.forEach(w => { const l = w[0]; byLetter[l] = (byLetter[l] || 0) + 1; });
  console.log('新增按首字母分布:', Object.entries(byLetter).sort((a, b) => b[1] - a[1])
    .map(([l, c]) => `${l}:${c}`).join(' '));
  process.exit(0);
}

// 4) 写回字母分片（保持键按字母序，便于 diff）
const perLetter = {};
for (const w of missing) (perLetter[w[0]] = perLetter[w[0]] || []).push(w);
for (const [letter, words] of Object.entries(perLetter)) {
  const file = path.join(WORDS_DIR, `${letter}.json`);
  const shard = fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : {};
  for (const w of words) {
    shard[w] = { word: w, ...candidates.get(w) };
  }
  const sorted = Object.fromEntries(Object.keys(shard).sort().map(k => [k, shard[k]]));
  fs.writeFileSync(file, JSON.stringify(sorted, null, 2) + '\n');
  console.log(`${letter}.json: ${words.length} 新增，共 ${Object.keys(sorted).length}`);
}
console.log('完成');
