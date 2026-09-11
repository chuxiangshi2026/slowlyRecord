/**
 * 把 mobile/src/subPackages/wordbank-* 的 TS 词库转成独立 JSON 文件，
 * 输出到 mobile/wordbank-json/，供上传到 Gitee 仓库做远程下载。
 *
 * 用法：node scripts/export-wordbank-json.cjs
 * 输出：mobile/wordbank-json/<sourceId>.json + index.json（词库清单）
 */
const fs = require('fs')
const path = require('path')
const { execSync } = require('child_process')

const OUT_DIR = path.join(__dirname, '..', 'mobile', 'wordbank-json')

// 词库清单：sourceId -> 分包内 TS 文件路径
const BANKS = [
  { id: 'kaoyan', name: '考研词汇', file: 'wordbank-a/wordbanks/kaoyan.ts' },
  { id: 'gmat', name: 'GMAT词汇', file: 'wordbank-a/wordbanks/gmat.ts' },
  { id: 'bec', name: 'BEC商务英语', file: 'wordbank-b/wordbanks/bec.ts' },
  { id: 'cet4', name: '四级词汇', file: 'wordbank-b/wordbanks/cet4.ts' },
  { id: 'cet6', name: '六级词汇', file: 'wordbank-b/wordbanks/cet6.ts' },
  { id: 'collocations', name: '常用搭配', file: 'wordbank-b/wordbanks/collocations.ts' },
  { id: 'common-phrases', name: '常用短语', file: 'wordbank-b/wordbanks/common_phrases.ts' },
  { id: 'idioms', name: '成语习语', file: 'wordbank-b/wordbanks/idioms.ts' },
  { id: 'ielts', name: '雅思词汇', file: 'wordbank-b/wordbanks/ielts.ts' },
  { id: 'kaogong', name: '考公词汇', file: 'wordbank-b/wordbanks/kaogong.ts' },
  { id: 'newConcept', name: '新概念英语', file: 'wordbank-b/wordbanks/newConcept.ts' },
  { id: 'oral-advanced', name: '口语高阶', file: 'wordbank-b/wordbanks/oral_advanced.ts' },
  { id: 'oral-basic', name: '口语入门', file: 'wordbank-b/wordbanks/oral_basic.ts' },
  { id: 'oral-intermediate', name: '口语进阶', file: 'wordbank-b/wordbanks/oral_intermediate.ts' },
  { id: 'phrasal-verbs', name: '动词短语', file: 'wordbank-b/wordbanks/phrasal_verbs.ts' },
  { id: 'zsb', name: '专升本词汇', file: 'wordbank-b/wordbanks/zsb.ts' },
  { id: 'gre', name: 'GRE词汇', file: 'wordbank-c/wordbanks/gre.ts' },
  { id: 'level4', name: 'Level 4', file: 'wordbank-c/wordbanks/level4.ts' },
  { id: 'sat', name: 'SAT词汇', file: 'wordbank-c/wordbanks/sat.ts' },
  { id: 'roots', name: '词根词缀', file: 'wordbank-d/wordbanks/roots.ts' },
  { id: 'toefl', name: '托福词汇', file: 'wordbank-d/wordbanks/toefl.ts' },
  { id: 'level8', name: 'Level 8', file: 'wordbank-level8/wordbanks/level8.ts' },
]

function tsToJson(tsPath) {
  // 用 esbuild 把 TS 转成 JS 再 eval 取 default export
  const js = execSync(`npx esbuild ${tsPath} --format=cjs --platform=node`, { encoding: 'utf-8', cwd: path.join(__dirname, '..', 'mobile') })
  const mod = { exports: {} }
  new Function('module', 'exports', 'require', js)(mod, mod.exports, require)
  return mod.exports.default || mod.exports
}

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true })

const index = []
for (const bank of BANKS) {
  const tsPath = path.join(__dirname, '..', 'mobile', 'src', 'subPackages', bank.file)
  if (!fs.existsSync(tsPath)) {
    console.warn(`跳过（文件不存在）: ${bank.id}`)
    continue
  }
  try {
    const data = tsToJson(tsPath)
    const words = Array.isArray(data) ? data : []
    const jsonPath = path.join(OUT_DIR, `${bank.id}.json`)
    fs.writeFileSync(jsonPath, JSON.stringify(words))
    const sizeKB = Math.round(fs.statSync(jsonPath).size / 1024)
    index.push({ id: bank.id, name: bank.name, wordCount: words.length, sizeKB })
    console.log(`✓ ${bank.id}: ${words.length} 词, ${sizeKB}KB`)
  } catch (e) {
    console.error(`✗ ${bank.id}: ${e.message}`)
  }
}

fs.writeFileSync(path.join(OUT_DIR, 'index.json'), JSON.stringify(index, null, 2))
console.log(`\n完成：${index.length} 个词库已导出到 ${OUT_DIR}`)
console.log('上传到 Gitee 后，raw 地址格式：https://gitee.com/dreamerjie/wordbank-data/raw/master/<id>.json')
