#!/usr/bin/env node
/**
 * 给内置词库补词频（freq = 语料内排名，越小越常见）
 *
 * 数据源：hermitdave/FrequencyWords（MIT 许可，OpenSubtitles 2018 语料）。
 * 词组/搭配按组成词里最不常见的那个记（取最大排名），查不到的词条不写字段。
 *
 * 用法：
 *   node scripts/add-word-frequency.cjs            # 只补缺失的
 *   node scripts/add-word-frequency.cjs --force    # 全部重算
 *
 * 覆盖：public/wordbanks/*.json（桌面，2 空格缩进）
 *       mobile/wordbank-json/*.json（移动端远程词库，压缩单行）
 */
const fs = require('node:fs')
const path = require('node:path')

const ROOT = path.resolve(__dirname, '..')
const CACHE_DIR = path.join(__dirname, 'data', 'freq')
const SOURCES = {
  en: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt',
  es: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/es/es_50k.txt',
  fr: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/fr/fr_50k.txt',
  ru: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ru/ru_50k.txt',
  ja: 'https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/ja/ja_full.txt',
}

/** 文件名 → 语言 */
function langOf(file) {
  const name = path.basename(file)
  if (/^es-/.test(name)) return 'es'
  if (/^fr-/.test(name)) return 'fr'
  if (/^ru-/.test(name)) return 'ru'
  if (/^(jlpt|ja-)/.test(name)) return 'ja'
  return 'en'
}

async function loadRankMap(lang) {
  const file = path.join(CACHE_DIR, `${lang}.txt`)
  if (!fs.existsSync(file)) {
    const res = await fetch(SOURCES[lang])
    if (!res.ok) throw new Error(`下载词频表失败 ${lang}: ${res.status}`)
    fs.mkdirSync(CACHE_DIR, { recursive: true })
    fs.writeFileSync(file, await res.text())
    console.log(`  下载 ${lang} 词频表`)
  }
  const map = new Map()
  const lines = fs.readFileSync(file, 'utf8').split('\n')
  for (let i = 0; i < lines.length; i++) {
    const word = lines[i].split(' ')[0].trim().toLowerCase()
    if (!word) continue
    if (!map.has(word)) map.set(word, i + 1) // 排名，越小越常见
  }
  return map
}

/** 把词条拆成可查的 token（拉丁/西里尔按非字母切；日文整条查） */
function tokensOf(text, lang) {
  const lower = String(text || '').toLowerCase().trim()
  if (!lower) return []
  if (lang === 'ja') {
    return lower.split(/[\s、。・，,]+/).filter(Boolean)
  }
  return lower.split(/[^a-z\u00c0-\u024f\u0400-\u04ff']+/).filter(Boolean)
}

function rankOf(text, lang, maps) {
  const map = maps[lang]
  if (!map) return 0
  const tokens = tokensOf(text, lang)
  let rank = 0
  for (const token of tokens) {
    const hit = map.get(token)
    if (hit) rank = Math.max(rank, hit) // 词组取最不常见的那个
  }
  return rank
}

function eachBankFile() {
  const dirs = [
    { dir: path.join(ROOT, 'public', 'wordbanks'), pretty: 2 },
    { dir: path.join(ROOT, 'mobile', 'wordbank-json'), pretty: 0 },
  ]
  const list = []
  for (const { dir, pretty } of dirs) {
    if (!fs.existsSync(dir)) continue
    for (const name of fs.readdirSync(dir)) {
      if (name.endsWith('.json')) list.push({ file: path.join(dir, name), pretty })
    }
  }
  return list
}

async function main() {
  const force = process.argv.includes('--force')
  const maps = {}
  for (const lang of Object.keys(SOURCES)) {
    maps[lang] = await loadRankMap(lang)
    console.log(`  ${lang}: ${maps[lang].size} 词`)
  }

  let total = 0
  let filled = 0
  const byLang = {}
  for (const { file, pretty } of eachBankFile()) {
    const lang = langOf(file)
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    if (!Array.isArray(data)) continue
    let changed = 0
    for (const entry of data) {
      total++
      if (!entry || typeof entry.word !== 'string') continue
      if (entry.freq && !force) continue
      const rank = rankOf(entry.word, lang, maps)
      if (!rank) continue
      entry.freq = rank
      changed++
      filled++
    }
    byLang[lang] = (byLang[lang] || 0) + changed
    if (changed > 0) {
      fs.writeFileSync(file, JSON.stringify(data, null, pretty))
      console.log(`  ${path.relative(ROOT, file)}: +${changed}`)
    }
  }
  console.log(`\n共 ${total} 条，补词频 ${filled} 条（${Math.round(filled / total * 100)}%）`)
  console.log('按语言：', byLang)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
