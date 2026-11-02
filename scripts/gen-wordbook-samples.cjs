#!/usr/bin/env node
/**
 * 生成内置示例书（词图闯关「装完即练」的样板内容）
 *
 * 从四级词库按词根 / 前缀 / 音标筛出示例词，生成双端共用的 TS 模块：
 *   src/utils/wordbook-samples.ts
 *   mobile/src/utils/wordbook-samples.ts
 *
 * 用法：node scripts/gen-wordbook-samples.cjs
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const BANK = path.join(ROOT, 'public/wordbanks/cet4.json')
const TAKE = 24

const words = JSON.parse(fs.readFileSync(BANK, 'utf8'))

function pick(predicate) {
  return words
    .filter(item => typeof item.word === 'string' && predicate(item.word.toLowerCase(), item))
    .sort((a, b) => (a.freq || 999999) - (b.freq || 999999))
    .slice(0, TAKE)
    .map(item => ({
      text: item.word,
      explains: item.explains || '',
      ...(item.phonetic ? { phonetic: item.phonetic } : {}),
      ...(typeof item.freq === 'number' ? { freq: item.freq } : {}),
    }))
}

const samples = [
  {
    name: '四级词根',
    desc: '按词根/词缀把四级词归堆，一页记一组',
    chapters: [
      { name: '词根 old', keyType: 'root', keyValue: 'old', words: pick((w) => w.length >= 4 && w.includes('old')) },
      { name: '词根 spect', keyType: 'root', keyValue: 'spect', words: pick((w) => w.includes('spect')) },
      { name: '前缀 pre', keyType: 'prefix', keyValue: 'pre', words: pick((w) => w.startsWith('pre')) },
    ],
  },
  {
    name: '四级发音',
    desc: '按音标归堆，同音词放一页，读音一起记',
    chapters: [
      { name: '音标 /əʊ/', keyType: 'phonetic', keyValue: 'əʊ', words: pick((_, item) => String(item.phonetic || '').includes('əʊ')) },
      { name: '音标 /eɪ/', keyType: 'phonetic', keyValue: 'eɪ', words: pick((_, item) => String(item.phonetic || '').includes('eɪ')) },
    ],
  },
]

// 少于 4 个词的章没有记忆价值，直接丢掉
for (const book of samples) {
  book.chapters = book.chapters.filter(chapter => chapter.words.length >= 4)
}

const header = `/**
 * 内置示例书（生成产物，勿手改；重新生成：node scripts/gen-wordbook-samples.cjs）
 *
 * 两本书：四级词根（old / spect / pre）、四级发音（/əʊ/ /eɪ/）。
 * 首次进入词图闯关时播种，用户删除后不再自动恢复。
 */

export interface WordBookSampleWord {
  text: string
  explains: string
  phonetic?: string
  freq?: number
}

export interface WordBookSampleChapter {
  name: string
  keyType: 'root' | 'prefix' | 'suffix' | 'phonetic'
  keyValue: string
  words: WordBookSampleWord[]
}

export interface WordBookSampleBook {
  name: string
  desc: string
  chapters: WordBookSampleChapter[]
}
`

const body = `\nexport const WORDBOOK_SAMPLES: WordBookSampleBook[] = ${JSON.stringify(samples, null, 2)}\n`

fs.writeFileSync(path.join(ROOT, 'src/utils/wordbook-samples.ts'), header + body)
fs.writeFileSync(path.join(ROOT, 'mobile/src/utils/wordbook-samples.ts'), header + body)

for (const book of samples) {
  console.log(book.name, book.chapters.map(chapter => `${chapter.name}: ${chapter.words.length} 词`).join(' | '))
}
console.log('已写入 src/utils/wordbook-samples.ts 与 mobile/src/utils/wordbook-samples.ts')
