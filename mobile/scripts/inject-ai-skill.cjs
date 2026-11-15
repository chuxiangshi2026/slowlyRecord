/**
 * 构建后注入小程序 AI 诗词 SKILL。
 *
 * 只在 MP_AI_SKILL=1 时生效；默认正式构建完全不受影响。
 * 用法：
 *   npm run gen:ai-poetry
 *   MP_AI_SKILL=1 uni build -p mp-weixin --minify && node scripts/inject-ai-skill.cjs
 */
const fs = require('fs')
const path = require('path')

const MOBILE_ROOT = path.join(__dirname, '..')
const DIST_ROOT = path.join(MOBILE_ROOT, 'dist/build/mp-weixin')
const SOURCE_ROOT = path.join(MOBILE_ROOT, 'ai-skill/poetry')
const TARGET_ROOT = path.join(DIST_ROOT, 'subPackages/ai-poetry')
const APP_JSON = path.join(DIST_ROOT, 'app.json')

const SKILL_NAME = 'poetry'
const SKILL_DESCRIPTION = '查询、推荐并收录中国古诗词'
const SKILL_PATH = 'subPackages/ai-poetry/skill'
const INSTRUCTION_PATH = 'subPackages/ai-poetry/PROMPT.md'

function fail(message) {
  console.error(`[ai-skill] ${message}`)
  process.exit(1)
}

function readIndex() {
  const text = fs.readFileSync(path.join(SOURCE_ROOT, 'skill/data/poetry-index.js'), 'utf8')
  const marker = 'module.exports ='
  const at = text.indexOf(marker)
  if (at < 0) fail('poetry-index.js 缺少 module.exports')
  return JSON.parse(text.slice(at + marker.length).trim().replace(/;\s*$/, ''))
}

function main() {
  if (process.env.MP_AI_SKILL !== '1') {
    console.log('[ai-skill] 未设置 MP_AI_SKILL=1，跳过注入（正式构建不受影响）')
    return
  }
  if (!fs.existsSync(DIST_ROOT)) fail(`未找到构建产物：${DIST_ROOT}`)
  if (!fs.existsSync(APP_JSON)) fail(`未找到 app.json：${APP_JSON}`)

  // 校验源文件，避免把不完整的 SKILL 注入体验版
  const required = [
    'PROMPT.md',
    'skill/SKILL.md',
    'skill/mcp.json',
    'skill/index.js',
    'skill/data/poetry-index.js',
  ]
  for (const rel of required) {
    if (!fs.existsSync(path.join(SOURCE_ROOT, rel))) {
      fail(`缺少 ${rel}；如缺索引请先执行 node scripts/gen-ai-poetry-data.cjs`)
    }
  }

  JSON.parse(fs.readFileSync(path.join(SOURCE_ROOT, 'skill/mcp.json'), 'utf8'))
  readIndex()

  fs.rmSync(TARGET_ROOT, { recursive: true, force: true })
  fs.mkdirSync(path.dirname(TARGET_ROOT), { recursive: true })
  fs.cpSync(SOURCE_ROOT, TARGET_ROOT, { recursive: true })

  const app = JSON.parse(fs.readFileSync(APP_JSON, 'utf8'))
  app.lazyCodeLoading = 'requiredComponents'
  app.subPackages = Array.isArray(app.subPackages) ? app.subPackages : []

  const existing = app.subPackages.find(p => p.root === 'subPackages/ai-poetry')
  if (existing) {
    existing.independent = true
    existing.pages = existing.pages || []
  } else {
    app.subPackages.push({
      root: 'subPackages/ai-poetry',
      independent: true,
      pages: [],
    })
  }

  app.agent = app.agent || {}
  app.agent.instruction = INSTRUCTION_PATH
  app.agent.skills = Array.isArray(app.agent.skills) ? app.agent.skills : []
  const skill = app.agent.skills.find(s => s.name === SKILL_NAME)
  const declaration = {
    name: SKILL_NAME,
    description: SKILL_DESCRIPTION,
    path: SKILL_PATH,
  }
  if (skill) Object.assign(skill, declaration)
  else app.agent.skills.push(declaration)

  fs.writeFileSync(APP_JSON, JSON.stringify(app, null, 2) + '\n')

  // 注入后自检：路径真实存在，防止 devtools 打开时报错
  for (const rel of [INSTRUCTION_PATH, `${SKILL_PATH}/SKILL.md`, `${SKILL_PATH}/mcp.json`]) {
    if (!fs.existsSync(path.join(DIST_ROOT, rel))) fail(`注入后缺失：${rel}`)
  }

  const count = readIndex().length
  console.log(`[ai-skill] 已注入 ${SKILL_NAME} SKILL：${count} 首诗词`)
  console.log(`[ai-skill] 目录：${path.relative(MOBILE_ROOT, TARGET_ROOT)}`)
  console.log('[ai-skill] app.json 已写入 agent / lazyCodeLoading / 独立分包')
}

main()
