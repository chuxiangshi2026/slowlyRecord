#!/usr/bin/env node
/**
 * 为大九九乘法表（multiplication-19x19.json）机械生成 mnemonics 口诀字段。
 *
 * 生成规则（与 multiplication-9x9.json 的小九九口诀格式一致）：
 * - 行 n 从 10 到 19，共 10 行；每行段数 k=1..n（三角阶梯式）
 * - 每段 = 中文数字(k) + 中文数字(n) + 中文数字(k×n)，行内多段用全角空格（U+3000）分隔
 * - 结果 <10 时带「得」（大九九最小结果 10×10=100，实际上不会出现）
 *
 * 可重复运行：直接重写 JSON 的 mnemonics 字段与 description，其余字段保留，2 空格缩进。
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const JSON_PATH = path.join(ROOT, 'public', 'knowledgebanks', 'multiplication-19x19.json');

const DIGITS = '一二三四五六七八九';

/** 中文数字转换（范围 1..361） */
function cn(n) {
  if (n < 10) return DIGITS[n - 1];
  if (n < 20) return '十' + (n % 10 ? DIGITS[n % 10 - 1] : '');
  if (n < 100) return DIGITS[Math.floor(n / 10) - 1] + '十' + (n % 10 ? DIGITS[n % 10 - 1] : '');
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  let s = DIGITS[hundreds - 1] + '百';
  if (rest === 0) return s;
  if (rest < 10) return s + '零' + DIGITS[rest - 1];
  return s + cn(rest);
}

const SEP = '　'; // 全角空格 U+3000，与小九九口诀一致

/** 行 n 的口诀：k=1..n 共 n 段 */
function rowMnemonic(n) {
  return Array.from({length: n}, (_, i) => {
    const k = i + 1;
    const product = k * n;
    return cn(k) + cn(n) + (product < 10 ? '得' + cn(product) : cn(product));
  }).join(SEP);
}

const pack = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8'));
pack.description = '10×10 到 19×19 的乘法，共 100 条，附 10-19 段口诀';
pack.mnemonics = Array.from({length: 10}, (_, i) => rowMnemonic(i + 10));
fs.writeFileSync(JSON_PATH, JSON.stringify(pack, null, 2) + '\n');
console.log(`已生成 ${pack.mnemonics.length} 行口诀，首行：${pack.mnemonics[0]}`);
console.log(`末行：${pack.mnemonics[pack.mnemonics.length - 1]}`);
