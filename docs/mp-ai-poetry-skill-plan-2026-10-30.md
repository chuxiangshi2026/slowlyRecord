# 小程序 AI（MCP）诗词查询与收录原型计划

日期：2026-10-30
状态：仅规划，未接入正式包

## 结论

技术可行，内容匹配度高，但当前只能做**体验版原型**：

- 微信小程序 AI 开发模式（小程序 MCP）仍在**内测**，官方明确暂未开放该模式代码提审，
  且要求不要把相关代码合入正式版本提交审核。
- 因此所有改动放在独立分支、独立目录，并通过构建开关 `MP_AI_SKILL=1` 注入；
  默认正式构建不产生 `agent` 字段、不注册独立分包。

官方文档：

- [小程序 AI 开发模式接入指南](https://developers.weixin.qq.com/miniprogram/dev/ai/guide.html)
- [接入方式（SKILL / mcp.json / 原子接口）](https://developers.weixin.qq.com/miniprogram/dev/ai/integration.html)
- [数据分析（场景值与 MCP 指标）](https://developers.weixin.qq.com/miniprogram/dev/ai/data.html)

---

## 目标与非目标

### 目标

1. 用户在小程序 AI 中问“找一句写秋天的诗”“李白有哪些送别诗”“把《静夜思》加入背诵”，
   能命中慢记的诗词 SKILL。
2. 返回 3–5 条带原文的结构化结果，附可点击的小程序页面链接。
3. 点击结果进入收录确认页，由用户确认后写入现有文本记忆，复用现有 SRS、同步和列表。
4. 用 We 分析的场景值 `1379/1380/1467` 观察实际调用与访问。

### 非目标

- 不做 AI 写诗、改写、赏析生成；只做**检索 + 收录**。
- 不在 AI 独立执行环境中直接写本地存储，避免与主小程序数据不一致。
- 不发布第三方英译；诗词用移动端公版数据。
- 不把录音、语音合成、复杂动画放进原子组件。

---

## 可行性依据

- 移动端已有 10 个朝代、**378 首**诗词，字段包含 `id/title/author/dynasty/content/tags`。
- 生成仅含检索必要字段的紧凑索引约 **155KB**，放独立分包没有体积压力。
- 收录可直接复用 `mobile/src/stores/useTextMemory.ts` 的 `addArticle/addArticles`。
- 微信提供了原子接口、原子组件、页面接力、文本混排链接和知识库能力；
  我们不依赖知识库，直接用本地索引检索。

约束：

- SKILL 必须放**独立分包**，并开启 `lazyCodeLoading`。
- 独立分包不能依赖主包或 `pages-memory` 分包，因此检索索引必须自带一份（脚本生成）。
- 一个小程序最多 30 个 SKILL；`SKILL.md` ≤16KB，`mcp.json` ≤24KB。
- 原子组件宽度/高度受限、不可滚动、不支持动画，v1 先不做组件卡片。

---

## 原型架构

```
mobile/
├── ai-skill/
│   └── poetry/                     # 源目录，不参与普通 uni 构建
│       ├── PROMPT.md               # 全局提示词（≤10KB）
│       ├── skill/
│       │   ├── SKILL.md            # 技能说明（≤16KB）
│       │   ├── mcp.json            # 原子接口声明
│       │   ├── index.js            # 注册接口
│       │   ├── apis/
│       │   │   ├── searchPoetry.js
│       │   │   ├── getPoetry.js
│       │   │   └── collectPoetry.js
│       │   └── data/
│       │       └── poetry-index.js # 脚本生成，勿手改
├── scripts/
│   ├── gen-ai-poetry-data.cjs      # 诗词 JSON → 紧凑索引
│   └── inject-ai-skill.cjs         # 构建后复制 + 注入 app.json
└── src/
    └── subPackages/pages-memory/text-memory/
        └── ai-collect.vue          # 接力/收录确认页（加入 pages-memory 分包）
```

构建后结构：

```
dist/build/mp-weixin/
├── app.json                        # 注入 agent / lazyCodeLoading / 独立分包
└── subPackages/ai-poetry/
    ├── PROMPT.md
    └── skill/ (SKILL.md, mcp.json, index.js, apis, data)
```

### app.json 注入

uni-app 不直接支持 `agent` 字段，采用构建后注入：

```json
{
  "lazyCodeLoading": "requiredComponents",
  "subPackages": [
    { "root": "subPackages/ai-poetry", "independent": true, "pages": [] }
  ],
  "agent": {
    "instruction": "subPackages/ai-poetry/PROMPT.md",
    "skills": [
      {
        "name": "poetry",
        "description": "查询、推荐并收录中国古诗词",
        "path": "subPackages/ai-poetry/skill"
      }
    ]
  }
}
```

`mobile/scripts/inject-ai-skill.cjs`：

1. 复制 `mobile/ai-skill/poetry` → `dist/build/mp-weixin/subPackages/ai-poetry`
2. 读取并修改 `app.json`：去重后添加独立分包与 `agent`
3. 未设置 `MP_AI_SKILL=1` 时直接退出，保证正式包零变化
4. 注入后校验：`agent.skills[].path` 对应文件存在、分包文件齐全、JSON 可解析

建议在 `mobile/package.json` 增加：

```json
"build:mp-weixin:ai": "MP_AI_SKILL=1 uni build -p mp-weixin --minify && node scripts/inject-ai-skill.cjs"
```

---

## SKILL 接口设计（v1 三个接口）

### 1. `searchPoetry`

用途：按诗句、标题、作者、朝代、主题查诗。

入参：

```json
{
  "keyword": "明月",
  "author": "李白",
  "dynasty": "唐",
  "theme": "思乡",
  "limit": 5
}
```

规则：

- `keyword` 在 `title/content/author/tags` 中做子串匹配；原文命中优先于标签命中。
- `author`、`dynasty` 精确/包含匹配。
- `theme` 做同义词扩展：秋天→秋、送别→别/送、思乡→乡/故乡、爱情→相思/爱情、
  边塞→边塞/从军、春天→春、月亮→月/明月、田园→田园/农事。
- 返回最多 5 条，避免模型上下文过长。
- 每条返回 `id/title/author/dynasty/excerpt/pagePath`，`pagePath` 标为
  `format: "page-link"`，指向收录确认页。

### 2. `getPoetry`

用途：按 id 返回完整正文、标签、出处、朝代；不返回第三方英译。

### 3. `collectPoetry`

用途：返回收录页链接，**不直接写库**。

```json
{
  "isError": false,
  "content": [{ "type": "text", "text": "点击卡片可把《静夜思》加入背诵" }],
  "structuredContent": {
    "poemId": "tang_001",
    "title": "静夜思",
    "pagePath": "/subPackages/pages-memory/text-memory/ai-collect?poemId=tang_001"
  }
}
```

> v1 用文本混排链接（`page-link`），不依赖原子组件和 handoff；后续再加结果卡片。

---

## 收录页 `ai-collect.vue`

职责：

- 通过 `onLoad(query)` 读取 `poemId`
- 从 `text-memory/library.ts` 取诗词（移动端 378 首）
- 展示标题、作者、朝代、正文、标签
- 用户点「加入文本记忆」后调用 `useTextMemory().addArticle({...})`
- 已收录时提示，不重复添加（按标题+正文或 poemId 判断）
- 收录成功后提供「去文本记忆」按钮，`navigateTo` 现有文本记忆页

数据映射：

```ts
store.addArticle({
  title: poem.title,
  content: poem.content,
  author: poem.author,
  dynasty: poem.dynasty,
  source: poem.source || poem.dynasty,
  location: poem.location,
  year: poem.year,
  tags: poem.tags,
  category: 'poetry',
})
```

不在小程序 AI 的独立执行环境中读写 `slowlyrecord-textmemory-data`；
只把页面路径和 poemId 传过去，由正常小程序页面完成写入。

---

## 数据生成

`mobile/scripts/gen-ai-poetry-data.cjs`：

- 读取 `mobile/src/subPackages/pages-memory/text-memory/data/poetry-*.json`
- 只保留 `id/title/author/dynasty/dynastyCode/content/tags`
- 生成 `mobile/ai-skill/poetry/skill/data/poetry-index.js`（`module.exports = [...]`）
- 输出统计：条数、字节数；超过 200KB 时失败
- 源 JSON 改动后必须重跑；文件头注明生成来源与勿手改

预期：378 条、约 155KB。

---

## 分阶段实施

### 阶段 1：数据与骨架（0.5 天）

- 写 `gen-ai-poetry-data.cjs`，生成索引
- 建 `mobile/ai-skill/poetry` 目录与 `PROMPT.md` / `SKILL.md`
- 写 `inject-ai-skill.cjs`，完成复制与 `app.json` 注入
- 验证：`MP_AI_SKILL=1` 构建后存在独立分包与 `agent`；普通构建无变化

### 阶段 2：三个原子接口（1 天）

- `searchPoetry`：关键词/作者/朝代/主题检索与同义词扩展
- `getPoetry`：按 id 返回完整内容
- `collectPoetry`：返回收录页链接
- 写 `mcp.json`，控制 schema 体积
- 单元测试：纯检索函数放在 `apis/poetry-search.js`，用 Node/Vitest 测中文、同义词、
  空结果、限流、超长关键词

### 阶段 3：收录页（0.5–1 天）

- 新增 `ai-collect.vue` 并注册到 `pages.json` 的 `pages-memory` 分包
- 处理不存在的 poemId、已收录、重复点击、返回
- 复用 `useTextMemory`，不新增存储键

### 阶段 4：体验版联调（0.5–1 天）

- 微信开发者工具 Nightly / 体验版
- 申请「AI 能力 → 开发模式」
- 测试查询召回、页面链接、收录、重复收录
- 查看 We 分析场景值与 MCP 调用指标

总计：**2.5–3 天**（不含审核等待）。

---

## 验收清单

- [ ] `node mobile/scripts/gen-ai-poetry-data.cjs` 生成 378 条、≤200KB
- [ ] 普通 `npm run build:mp-weixin` 的 `app.json` 没有 `agent`，没有 AI 分包
- [ ] `MP_AI_SKILL=1` 构建后 `agent.skills[0].path` 指向真实 SKILL 目录
- [ ] 「静夜思」→ 命中唯一结果
- [ ] 「李白 送别」→ 返回李白相关送别诗
- [ ] 「写秋天的诗」→ 能通过主题同义词命中带“秋”的诗
- [ ] 「含明月的诗句」→ 正文子串命中
- [ ] 无结果时给出可行动提示，不编造诗词
- [ ] 点击结果进入收录页，展示完整正文
- [ ] 确认收录后出现在文本记忆列表；重复收录有提示
- [ ] 收录失败（存储满/权限）有明确提示，不静默成功
- [ ] 从 AI 进入的页面路径、返回路径正常
- [ ] We 分析能看到 AI 场景访问与 MCP 调用

---

## 风险与应对

| 风险 | 应对 |
|---|---|
| 内测未开放提审 | 独立分支 + `MP_AI_SKILL=1` 开关，禁止进正式包 |
| 独立分包不能依赖 pages-memory | 脚本生成紧凑索引，自带检索数据 |
| 索引与源数据漂移 | 生成脚本 + CI 校验文件头/条数 |
| 模型把相似诗句混在一起 | 接口返回 id + 原文；不返回模型生成的赏析 |
| 原子组件能力受限 | v1 只用文本 + page-link，不做卡片 |
| 收录写入不一致 | 不在 AI 环境写库，统一走 `ai-collect.vue` + 现有 store |
| 关键词“秋天”不命中 | 主题同义词扩展；SKILL.md 引导模型传 theme |
| 数据/隐私 | 不采集用户 query 原文；只上报功能事件与场景值 |

---

## 分支与发布策略

- 分支：`feat/mp-poetry-skill`
- 目录：`mobile/ai-skill/` + `ai-collect.vue` + 两个脚本
- 默认构建不包含任何 AI 代码；只有 `MP_AI_SKILL=1` 才注入
- 在体验版验证、等官方开放提审后再评估合并 `master`
- 不与当前已推送的 P0–P3 改动混在一起
