# 词图闯关重构 + 词频能力 实施计划（2026-11-02）

> 状态：已完成；2026-11-03 按最终实现与许可口径修订。
> 后续重设计：见 [词集重设计实施计划](word-collection-redesign-plan-2026-11-03.md)（词集、uTools 优先）。
> 范围：桌面（uTools/Electron/Web）+ 移动端（微信/抖音小程序、App）。

## 1. 目标

1. 把「词图闯关」从「章节 → 页（12 词切片）」重构成**书 → 章 → 页**三级结构，页 = 一个记忆单元（同一词根/词缀/音标的一组词），以思维导图呈现，可逐词标记「记住了」。
2. 页级间隔复习（复用 13 级 `DEFAULT_INTERVALS`），到期在词图首页汇总。
3. 内置示例书 + 使用说明，装完即可练。
4. 词库补充词频数据，列表展示、筛选排序、分页规则都用得上。
5. 埋点覆盖新功能。

## 2. 概念模型

```
书「四级词根」
├─ 章「词根 port」            ← 主题，可改名
│  ├─ 页「port 篇」           ← 记忆单元（中心 port + N 个词）
│  └─ 页「port 篇 ②」         ← 词多时按规则切开
└─ 章「词根 spect」
书「四级发音」
├─ 章「/əʊ/」
└─ 章「/eɪ/」
```

- **书**：一个学习维度（拼写 / 发音 / 日期 / 自定义）。
- **章**：主题，对应一次筛选维度（词根、音标…），章上存分页配置。
- **页**：记忆单元，一次筛选结果的产物；带自己的 SRS 等级。
- **关卡**：章上存 `levelSize`（默认 5 页），关卡 = `ceil(页数 / levelSize)`。达成记录**落库**（章上 `levels: [{index, completedAt}]`），但只记录、不做解锁或奖励逻辑——先攒数据看效果。

## 3. 数据模型

存储前缀（新前缀，与旧 `word_book_` 不兼容、也不需要兼容——功能未上线）：

| 文档 | 前缀 | 字段 |
|---|---|---|
| 书 | `wb_book_` | `_id, type:'wb_book', name, order, desc?, isSample?, ctime, utime` |
| 章 | `wb_chapter_` | `_id, type:'wb_chapter', bookId, name, order, levelSize, levels[], pageSize, splitBy, ctime, utime` |
| 页 | `wb_page_` | `_id, type:'wb_page', bookId, chapterId, name, order, key, words[], source, level, nextReviewAt, lastReviewedAt, bestScore, ctime, utime` |

```ts
// 页
key: { type: 'root' | 'prefix' | 'suffix' | 'phonetic' | 'text', value: string }
words: Array<{ sourceId, text, phonetic?, explains, freq?, rememberedAt? }>
source: { bankId?, bankName?, filter: FilterStateSnapshot }
level: 0-12
```

命名默认值（三级都可改）：

- 书：`{词库简称} · {维度}` → 「四级 · 词根」
- 章：`第 N 章`，带筛选键时 `{维度} {key}` → 「词根 port」
- 页：单页 `{key} 篇`，多页 `{key} 篇 ①/②`

## 4. 词频能力

### 4.1 数据源与授权

内置词库的 `freq` 来自 **hermitdave/FrequencyWords** 的 OpenSubtitles 2018 词频表：

- 使用英语、日语、俄语、西班牙语、法语的对应语言词表，日语使用 `ja_full.txt`，其余使用 `*_50k.txt`
- 原始词表缓存到 `scripts/data/freq/`，不入库，执行脚本时按需下载
- 根 `NOTICE` 保留来源、版权与完整 MIT 许可；`public/NOTICE` 与 `mobile/public/NOTICE` 携带同一声明进入双端构建产物
- COCA / SUBTLEX 不采用

### 4.2 字段与口径

- 统一存**语料排名**（正整数，越小越常见）：`freq?: number`，不使用 Zipf 值，也不另存 `freqRank`
- 词组/搭配：取已命中组成词的**最大排名**，即其中最不常见的词；全部未命中时留空
- 屈折形式：按词表原词直接查询，**不做 lemma 归并**，查不到留空（不要写 0）
- 小语种词库使用对应语言表，不能套英语
- 用户自建/翻译新增词：写入时查表补一次，查不到留空

### 4.3 补数据脚本

`scripts/add-word-frequency.cjs`

- 输入：下载的原始词频文本，每行形如 `词 次数`，按行号生成排名
- 输出：桌面 `public/wordbanks/*.json` 与移动端 `mobile/wordbank-json/*.json` 原地补 `freq`；已有值默认跳过，`--force` 全部重算
- 体积评估：约 +0.9 MB（+10%），影响首次下载与 PWA 缓存，需要升词库版本
- 双端词库由同一脚本一次处理，移动端词库清单在 `mobile/src/stores/useUtils/wordbank.ts`

### 4.4 展示与排序

- 单词列表（`src/views/Word/components/MyListItem.vue`）：在单词旁显示 `#排名` 标记，缺 `freq` 不显示
- 筛选排序（`WordFilter.vue` `sortOptions`）：新增「词频」；**同时要改三处**才能一致——`Word.vue` 的排序 switch、`public/focus.html` 的排序 switch（专注模式复用同一批 URL 参数）、移动端 `pages/words/words.vue` 的 `sortOptions` 与排序逻辑
- 缺 `freq` 的词排序时置底，不能当 0（否则全冒到顶部）
- 可选：筛选面板加「常用度 ≥ N」区间过滤（未实现）

### 4.5 用于词图分页

章上 `splitBy: 'order' | 'length' | 'alpha' | 'freq'`，`pageSize` 默认 12（上限 20，受放射图节点数限制）。按 `freq` 分页时排名升序排列，缺 `freq` 的词置底。

## 5. 内置示例

- 源数据：`public/wordbanks/cet4.json`，不运行时 fetch JSON
- 生成脚本：`scripts/gen-wordbook-samples.cjs`；词根/前缀使用人工审核白名单，音标按音素筛选，保留原释义、音标与 `freq`
- 输出：直接生成 `src/utils/wordbook-samples.ts` 与 `mobile/src/utils/wordbook-samples.ts`，双端内容一致，均使用静态 import
- 内容：书「四级词根」→ 章 port / spect / pre；书「四级发音」→ 章 /əʊ/ /eɪ/
- 播种：首启异步播种（不阻塞首屏），书标 `isSample`；记录已播种版本，用户删除后不复活
- 页内提供「怎么用」入口：筛选 → 选书章 → 生成页 → 页面上逐词标记

## 6. 交互流程

1. **入口**：词图首页「＋ 添加内容」→ 跳单词页并**自动打开筛选面板**（桌面 `?filter=1` + `Word.vue` 读 query；移动端 `switchTab` 不能带参，用一次性标记在 `onShow` 消费）。
2. **生成**：筛选面板「生成学习页」→ 弹窗：书（下拉/新建）→ 章（下拉/新建）→ 页名（默认 `{key} 篇`）→ 生成；从某章「＋」进入时书章预选锁定。
3. **重复检测**：同书同章已有同 `key` 页时提示「已存在 port 篇（8 词）：追加 / 新建 / 取消」。
4. **记忆页**：单页完成，不设独立逐词模式。中心节点 = `key`，分支 = 单词（共享部分高亮），每卡一个「✓ 记住了」；顶部两个开关「遮住释义」「打乱顺序」；进度 `已记住 7/12`。
5. **复习**：一轮结束按得分升降级（复用现有规则），`nextReviewAt = now + DEFAULT_INTERVALS[level]`；词图首页展示「今日到期 N 篇」。页级标记**不写回**词库 SRS。
6. **关卡**：章内每 `levelSize` 页一组，展示进度与达成标记，不阻塞进入。

## 7. 实现清单

**桌面**

- 类型：`src/types/word-book.d.ts` 重写为三级；`src/types/words.d.ts` 加 `freq?`
- 逻辑：`src/utils/word-book.ts`（创建/分页/调度/命名）、`src/utils/word-book-db.ts`（三个前缀 CRUD + 级联删除）
- 状态：`src/stores/wordBook.ts`（books/chapters/pages、due 列表）
- 页面：`src/views/WordBook/` 重写为 Books / Chapters / Entries / Page / CreateDialog
- 路由：`/word-book`、`/word-book/:bookId`、`/word-book/:bookId/:chapterId`、`/word-book/page/:pageId`
- 入口：`MoreDrawer.vue`、`Word.vue`（query 打开筛选）、`WordFilter.vue`（生成入口 + 词频排序）
- 同步：`src/types/sync.ts` 加 `wordBook`，`sync-manager.ts` 收集/写回
- 埋点：`src/utils/stats.ts` 加 `FeatureEvents.wordBook*`

**移动端**（镜像实现，独立一套）

- `mobile/src/types/word-book.d.ts`、`utils/word-book.ts`、`stores/useWordBook.ts`
- `mobile/src/subPackages/pages-memory/word-book/{list,chapter,page,edit}.vue` 重写
- `pages/words/words.vue`：词频排序 + 生成入口 + 一次性打开标记

**脚本**

- `scripts/add-word-frequency.cjs`
- `scripts/gen-wordbook-samples.cjs`

## 8. 影响面分析（对现有功能）

| 改动 | 影响 | 风险等级 | 处理 |
|---|---|---|---|
| `Word` 加 `freq?` | 词库 JSON 体积 +10%（8.6 MB → 约 9.5 MB），首次下载变慢 | 中 | 只存正整数排名；升词库版本 |
| 内置词库缓存 | 老缓存没有 `freq`，用户永远看不到新字段 | 高 | 缓存加版本号，版本变更强制重下 |
| 排序新增 `freq` | **三处排序实现**（Word.vue / focus.html / 移动端）不同步会导致专注模式排序静默失效 | 高 | 三处同批改，加测试 |
| 导入导出 | 导出带 `freq` 会改动模板 | 中 | **JSON 默认带 `freq`；CSV 末尾追加可选 `freq` 列（按表头识别，旧文件仍可导入）；TXT/Anki 保持原格式**（已定） |
| 同步 | `SyncWordBank.words` 整条序列化，旧设备合并可能抹掉 `freq` | 中 | 合并改字段级保留（缺省不覆盖）；词图数据新增独立同步段 |
| 词图新模块 | 新增 DB 前缀、同步段；旧客户端忽略未知段 | 低 | `SyncData` 加可选字段，不改 `version` 语义 |
| 词图 + 词库双 SRS | 「待复习」口径变两个（词 vs 篇），用户易困惑 | 中 | UI 分开展示，不做合并数字 |
| 路由/菜单 | 新增 4 个路由，`MoreDrawer` 已有入口 | 低 | — |
| 首启播种 | 阻塞首屏或重复播种 | 中 | 异步 + 幂等 + 版本标记 |
| 删除语义 | 删书级联删章页 | 中 | 二次确认，明示不影响词库 |
| 专注模式 | 读取 URL 里的 `sortBy`，新增取值要兼容旧值 | 低 | default 分支已有 |
| 打卡/连续天数 | 词图完成页计入打卡/成就 | 低 | **计入**（已定），沿用现有打卡写入路径 |
| 移动端分包 | 示例数据若进主包会增加主包体积，微信禁止动态 import | 低 | 当前约 8 KB 的压缩示例数据静态 import 到主包 `chunks/utils/`；数据增大后再迁入 `pages-memory` |

## 9. 其他需要提前考虑

1. 词频授权与署名：根 `NOTICE` 与双端公开资源目录均已保留 FrequencyWords 的来源、版权和完整 MIT 许可。
2. 词频表版本与更新：换语料后内置词库可重下，**用户自建词库无法回填**，只能对新增词补。
3. 词频表体积：原始词表不进入小程序包，运行时词库只带派生的 `freq` 排名字段。
4. 页大小上限与放射图：>20 节点需要分圈或缩放，默认 12 上限 20。
5. 空页/重复页：同一 `key` 重复生成要提示；生成 0 词禁用按钮（已有）。
6. 关卡落库（已定）：章上记录 `levels: [{index, completedAt}]`，先只记录不做奖励。
7. 埋点事件命名与既有 `FeatureEvents` 保持一致（`feature.word_book_create` 等）。
8. 词条快照刷新：词库释义改了，页里仍是旧值；建议后续加「从词库刷新本页释义」。
9. 导出/同步（已定）：词图进 `collectSyncData` 与「导出备份」；词库 JSON/CSV 导出带 `freq`，TXT/Anki 不带，同步保留。
10. 键盘/无障碍：词图节点较多，至少保证 Tab 可达与 aria-label。

## 10. 验收点

- 排序：三端 `A-Z / 长度 / 时间 / 等级 / 词频` 结果一致，缺 `freq` 置底
- 词图：从词图首页进入 → 筛选自动打开 → 生成到指定书章 → 页内标记 → 全部记住 → 页完成并写入 `nextReviewAt`
- 到期：改系统时间后词图首页出现「今日到期」
- 删除：删书后章页一并消失，词库单词不受影响
- 同步：A 端建书页 → 同步 → B 端可见（含 freq）
- 示例：首启播种两本书，删除后重启不复活
- 移动端：`switchTab` 回来能自动打开筛选面板
- 打卡：完成一页后连续打卡天数正常累加
- 关卡：章内满 `levelSize` 页完成时写入 `levels`，重复进入不重复写
- 导出/同步：JSON 导出含 `freq`、CSV 含 `freq` 列；旧 CSV 仍可导入；跨端同步后 `freq` 与词图数据都在

## 11. 决策记录（2026-11-02）

| 议题 | 决定 |
|---|---|
| 词频数据源 | hermitdave/FrequencyWords（MIT），存语料排名，双端发布产物携带完整 NOTICE |
| 词组词频 | 取已命中组成词的最大排名，全部未命中则留空 |
| 屈折形式 | 按原词直接查询，不做 lemma 归并 |
| 关卡 | 落库记录达成时间，先不做奖励 |
| 词图导出/同步 | 进同步与导出备份 |
| 打卡 | 页完成计入 |
| 导出带不带词频 | 带：JSON 默认带，CSV 追加可选列；TXT/Anki 不带 |

## 12. 上线策略（先隐藏旧词图，再分批发版）

旧词图尚未上线，但代码里入口是可见的。建议**先隐藏、发一版，再按批次开放**，避免用户在半成品上产生数据（本功能不做数据迁移）。

### 隐藏点（4 处）

| 端 | 位置 | 处理 |
|---|---|---|
| 桌面 | `src/components/MoreDrawer.vue:207` | 菜单项隐藏 |
| 桌面 | `src/views/Word/components/WordFilter.vue:153` | 「生成学习页」tag 隐藏 |
| 移动端 | `src/pages/features/features.vue:84` | 功能卡片隐藏 |
| 移动端 | `src/pages/words/words.vue:70` | 「词图」筛选行隐藏 |

路由与页面文件保留（不可达），用一个开关常量（如 `WORD_BOOK_ENABLED`）统一控制，重构完成后再打开，避免删了又加。

### 分批与工作量（按 1 个工作日 ≈ 1 个开发会话估）

| 批次 | 内容 | 规模 | 预估 |
|---|---|---|---|
| 0 | 隐藏旧词图入口 + 打包发版 | 4 处入口 + 1 个开关 | 0.5 天 |
| 1 | 词频链路（词频表脚本、57 个词库回填、缓存版本、列表展示、三端排序、导入导出） | 脚本 2 + 词库数据 + 8~10 个源文件 | 1 天 |
| 2 | 词图三级结构（类型/DB/Store/路由/页面/生成流程/页级 SRS/关卡记录/删除级联） | 桌面 14 + 移动端 8 | 2~3 天 |
| 3 | 示例书 + 同步 + 导出备份 + 打卡 + 埋点 | 脚本 1 + 同步/类型/统计 | 1 天 |

依赖关系：批次 1 是批次 2 分页规则与示例书的前置；批次 2 完成后才能打开入口；批次 3 可与批次 2 并行收尾。

## 13. 执行进度

### 批次 1（词频）—— 已完成

- 数据：`scripts/add-word-frequency.cjs` 用 hermitdave/FrequencyWords（MIT）给桌面 57 个 + 移动端 25 个词库补 `freq`（排名），共 136,167 条补齐 116,140（85%）
- 脚本：新增 `scripts/gen-onboarding-starter-banks.cjs`（原来缺生成脚本），起步数据带上 freq
- 代码：`Word.freq`、词库标准化保留、缓存前缀 v2→v3、列表 `#排名` 标记、三处排序新增「词频」、JSON 导出带 freq
- 验证：全量测试通过；浏览器实测升/降序正确

### 批次 2（三级结构）—— 已完成

- 桌面：`types/word-book.d.ts`、`utils/word-book.ts`、`utils/word-book-db.ts`、`stores/wordBook.ts` 重写；新页面 `WordBookBooks / WordBookChapters / WordBookPages / WordBookPage / WordBookCreateDialog`；路由改为 `word-book` → `:bookId` → `:bookId/:chapterId` → `page/:pageId`
- 移动端：同口径镜像（`types`、`utils`、`stores/useWordBook`、`word-book/{list,chapter,pages,edit,page}.vue`），`pages.json` 新增 `word-book/pages`
- 交互：词图页「添加页」跳单词页并自动打开筛选（桌面 `?filter=1`，移动端 storage 标记 + `onShow`）；生成弹窗选书/章/页名、分页大小与排序、同中心页重复提示
- 记忆页：中心节点 + 节点互点展开/遮住释义、逐词「记住了 / 还没记住」、全部标记后保存并排下次复习
- 页级 SRS：全对升 1 级、有错降 4 级（下限 0），间隔复用 13 级 `DEFAULT_INTERVALS`；关卡达成写入章 `levels`
- 入口开关：桌面/移动端 `WORD_BOOK_ENABLED` 均已打开
- 验证：桌面端浏览器走通「建书 → 建章 → 从筛选生成 25 页 → 记忆页 12 节点 → 全部标记 → 100 分 + 下次复习」；全量测试 173 文件 / 3042 用例通过；桌面与小程序构建均通过

### 批次 3（示例 / 同步 / 打卡 / 埋点）—— 已完成

- 示例书：`scripts/gen-wordbook-samples.cjs` 从四级词库生成双端共用的 `wordbook-samples.ts`；词根/前缀使用人工审核白名单，音标按音素筛选（2 本书 / 5 章 / 7 页）；进入词图页时懒播种，`sr_wordbook_samples_v1` 标记保证删除后不复活
- 许可：FrequencyWords 的来源、版权与完整 MIT 许可已写入根 `NOTICE`，并同步到 `public/NOTICE`、`mobile/public/NOTICE` 随双端产物分发
- 同步：`SyncWordBook`（书/章/页）加入 `SyncData`，收集与还原按 `_id` 合并、`utime` 较新覆盖；导出备份因此自动包含词图
- 打卡：完成一页即调用打卡 store 的 `signToday()`（双端）
- 埋点：`feature.word_book_generate`（生成页数）、`feature.word_book_page_done`（页级完成）
- 顺手修：`trackEvent`/`currentUrl` 在非浏览器上下文会因 `window` 未定义抛错，已加兜底
- 验证：示例播种测试覆盖 2 书 / 5 章 / 7 页、port 8 词、pre 12 词、错误字符串匹配词条回归与刷新不重复；全量 174 文件 / 3048 用例通过；桌面与小程序构建通过，NOTICE 均已进入构建产物
