#!/usr/bin/env node
/**
 * 生成首启引导的「推荐词库」起步数据（mobile/src/utils/onboarding-starter-banks.ts）
 *
 * 取 cet4 / cet6 / kaoyan 三个内置词库的头部 20 条（词库按常用度排列），
 * 带上音标、释义与词频，打成主包可用的压缩数据。
 *
 * 用法：node scripts/gen-onboarding-starter-banks.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const OUT = path.join(ROOT, 'mobile/src/utils/onboarding-starter-banks.ts')
const BANKS = ['cet4', 'cet6', 'kaoyan']
const TAKE = 20

const banks = {}
for (const id of BANKS) {
  const data = JSON.parse(fs.readFileSync(path.join(ROOT, 'public/wordbanks', `${id}.json`), 'utf8'))
  banks[id] = data.slice(0, TAKE).map((item) => ({
    word: item.word,
    ...(item.explains ? { explains: item.explains } : {}),
    ...(item.phonetic ? { phonetic: item.phonetic } : {}),
    ...(typeof item.freq === 'number' ? { freq: item.freq } : {}),
  }))
}

const content = `/**
 * 首启引导「推荐词库」起步数据
 * 由内置词库中 cet4/cet6/kaoyan 的头部 ${TAKE} 词生成，供主包引导页一键导入。
 * 仅为示例起步量：完整词库引导页创建库后从远程词库（词库管理页）下载续导，
 * 避免把完整词表打进主包（起步数据压缩后每库约 2KB，三库共约 6KB）。
 * 导入进度与 sourceId 均已按内置词库口径记录，用户之后可在「词库管理」页续导剩余部分。
 * 本文件为生成产物，请勿手改；重新生成：node scripts/gen-onboarding-starter-banks.cjs
 */

export interface StarterBankEntry {
  word: string
  meaning?: string
  explains?: string
  phonetic?: string
  example?: string
  /** 词频排名（1 = 最常用） */
  freq?: number
}

/** 起步词库数据：key 为内置词库 sourceId（WordBankType） */
export const STARTER_BANKS: Record<string, StarterBankEntry[]> = ${JSON.stringify(banks)}
`

fs.writeFileSync(OUT, content)
const counts = Object.fromEntries(Object.entries(banks).map(([k, v]) => [k, v.length]))
const withFreq = Object.fromEntries(Object.entries(banks).map(([k, v]) => [k, v.filter(w => w.freq).length]))
console.log('生成完成', path.relative(ROOT, OUT))
console.log('条目数', counts, '带词频', withFreq)
