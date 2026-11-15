/**
 * 生成小程序 AI 诗词 SKILL 的检索索引。
 *
 * 源数据：mobile/src/subPackages/pages-memory/text-memory/data/poetry-*.json
 * 产物：mobile/ai-skill/poetry/skill/data/poetry-index.js（生成文件，勿手改）
 *
 * 索引只保留检索/详情需要的字段，避免把拼音、翻译等无关内容带进独立分包。
 * 用法：node mobile/scripts/gen-ai-poetry-data.cjs
 */
const fs = require('fs')
const path = require('path')

const ROOT = path.join(__dirname, '..', '..')
const DATA_DIR = path.join(ROOT, 'mobile/src/subPackages/pages-memory/text-memory/data')
const OUT_DIR = path.join(ROOT, 'mobile/ai-skill/poetry/skill/data')
const OUT_FILE = path.join(OUT_DIR, 'poetry-index.js')
const MAX_BYTES = 200 * 1024

const FIELDS = ['id', 'title', 'author', 'dynasty', 'dynastyCode', 'content', 'tags']

function main() {
  const files = fs.readdirSync(DATA_DIR)
    .filter(name => /^poetry-.*\.json$/.test(name))
    .sort()

  if (files.length === 0) {
    console.error('未找到 poetry-*.json 数据')
    process.exit(1)
  }

  const seen = new Set()
  const poems = []
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'))
    const list = Array.isArray(raw?.poems) ? raw.poems : []
    for (const poem of list) {
      if (!poem?.id || !poem?.title || !poem?.content) continue
      if (seen.has(poem.id)) {
        console.warn(`重复 id 已跳过: ${poem.id} (${file})`)
        continue
      }
      seen.add(poem.id)
      const entry = {}
      for (const field of FIELDS) {
        entry[field] = field === 'tags'
          ? (Array.isArray(poem.tags) ? poem.tags : [])
          : (poem[field] ?? '')
      }
      poems.push(entry)
    }
  }

  const payload = `// 由 mobile/scripts/gen-ai-poetry-data.cjs 生成，请勿手改。
// 源：mobile/src/subPackages/pages-memory/text-memory/data/poetry-*.json
module.exports = ${JSON.stringify(poems)}
`
  const bytes = Buffer.byteLength(payload)
  if (bytes > MAX_BYTES) {
    console.error(`索引过大：${bytes} 字节，超过 ${MAX_BYTES} 字节上限`)
    process.exit(1)
  }

  fs.mkdirSync(OUT_DIR, { recursive: true })
  fs.writeFileSync(OUT_FILE, payload)
  console.log(`诗词索引生成完成：${poems.length} 首，${(bytes / 1024).toFixed(1)}KB`)
  console.log(`输出：${path.relative(ROOT, OUT_FILE)}`)
}

main()
