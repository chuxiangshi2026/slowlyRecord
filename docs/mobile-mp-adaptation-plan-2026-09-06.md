# 小程序端功能适配计划（实用优先版）

> 制定日期：2026-09-06
> 范围：`mobile/`（UniApp + Vue 3，目标微信小程序为主，抖音小程序兼容）

## Context

仓库中 `mobile/` 是独立 UniApp + Vue 3 工程（不 import 主 `src/`，采用「复制改造」策略）。经全面盘点，移动端完成度已很高：单词管理、复习、听写、文本记忆（含诗词地图）、数字记忆（文字桩）、记忆测评、翻译（10 引擎）、多词库（5 分包）、AES-GCM 云同步、每日打卡均已实现。

**缺失（对比桌面端）**：记忆宫殿、知识库、音标记忆、快捷键记忆、专注模式。
**遗留缺陷**：首页统计硬编码（`mobile/src/pages/index/index.vue` 81-82 行）、错题本写完未注册路由（孤儿页）、tabBar 图标缺失、数字记忆图片桩字段预留未实现。

本计划**以实用为主**：先分析各功能「必要性 × 实现难度」，只做必要且容易/中等难度的，重的和不适合移动端的不做或缓做。

---

## 功能筛选分析

| 功能 | 实用性 | 实现难度 | 决策 |
|---|---|---|---|
| 首页统计硬编码修复 | 高（现有页面直接受益） | 极易 | ✅ P0 立即做 |
| 错题本注册路由 | 高（237 行成品代码躺着） | 极易（pages.json 加一行 + 入口） | ✅ P0 立即做 |
| tabBar 图标 | 高（上架观感） | 极易 | ✅ P0 立即做 |
| 专注模式（全屏降级版） | 高（睡前/通勤背单词场景） | 易：复用 review/dictation 逻辑 + `uni.setKeepScreenOn` | ✅ P1 |
| 数字记忆图片桩 | 中（字段已预留，补全现有模块） | 易：`uni.chooseImage` + canvas 压缩 | ✅ P1 顺手做 |
| 音标记忆 | 高（背单词天然配套） | 中：`phoneme-data/breakdown/phonetic-util` 全是纯函数直接复制；发音复用 mobile 已有 `MiniProgramTtsAdapter` | ✅ P2 |
| 知识库 | 高（29 个内置题库是差异化卖点） | 中：数据仅 192KB 可整包进分包；4 模式**砍到 2 个**（翻卡 + 四选一）降低工作量 | ✅ P2 精简版 |
| 记忆宫殿 | 中（手机上编辑桩序列体验弱） | 高：4 个页面 + 图片分文档存储 + emoji dataURL 渲染兼容 + 桩排序编辑 | ⚠️ P3 缓做，视 P0–P2 反馈 |
| 快捷键记忆 | 无（手机无物理键盘，桌面端本身也是 desktop-only 路由） | — | ❌ 不做 |

平台默认：微信小程序为主，`uni.*` API 天然兼容抖音，App/H5 不阻塞。

---

## P0：遗留缺陷修复（0.5–1 天，立即见效）

### 0.1 首页统计接通真实数据
- 文件：`mobile/src/pages/index/index.vue`（81-82 行硬编码 `streakDays=7`/`todayLearned=12`）
- 步骤：
  1. 新建 `mobile/src/stores/useSignin.ts`：把打卡记录从 `mobile/src/subPackages/pages-data/signin/signin.vue` 抽成 Pinia store。注意现有存储 key 是 **`signin_records`**（不带 `slowlyrecord_` 前缀），store 直接沿用该 key，无需迁移。
  2. signin.vue 改为读写该 store。
  3. index.vue：`streakDays` ← store 连续打卡天数 computed；`todayLearned` ← `useMobileWords` 的 `MobileWord` 字段统计——注意 mobile 字段名是 **`addTime` / `lastReviewTime`**（非桌面端的 learnDate/lastReviewDate），口径 = 当天 `addTime` 的新增数 + 当天 `lastReviewTime` 的复习数。

### 0.2 注册错题本
- `mobile/src/pages.json`：`pages-data` 分包追加 `pages-data/wrong-words/wrong-words`。
- 入口：单词页筛选面板加「错题」入口（对齐桌面端位置）。

### 0.3 tabBar 图标
- `mobile/src/static/tabbar/` 新增 8 个 PNG（4 tab × 普通/选中，81×81px，选中色 `#52796f`）。
- `pages.json` tabBar 各项补 `iconPath`/`selectedIconPath`。

---

## P1：低成本增强（约 1 天）

### 1.1 专注模式全屏版
- 新建 `mobile/src/subPackages/pages-tools/focus.vue`，pages.json 注册，首页快速入口加入口。
- 功能：全屏深色底逐词轮播当前词库待复习词；标准/拼写/听写三模式（逻辑直接从 review.vue、dictation.vue 提炼复用，不重写 SRS）；`uni.setKeepScreenOn({keepScreenOn:true})` 防熄屏；自动翻页间隔设置存 `slowlyrecord-focus-settings`。
- 明确不做：悬浮窗、置顶、透明度——小程序无此能力。

### 1.2 数字记忆图片桩
- 文件：`mobile/src/subPackages/pages-memory/number-memory/peg-edit.vue` + `mobile/src/stores/useNumberMemory.ts`（`type='image'` 字段已预留，`useNumberMemory.ts:14` 注释明确 imageUrl/imageSource 待升级）。
- **直接复用 `mobile/src/subPackages/pages-tools/utils/capture.ts` 的 `UniAppCaptureAdapter.capture()`**——它已封装 `uni.chooseImage`（相册+拍照）+ base64 读取 + MP/H5/APP 条件编译，不要新写 chooseMedia 逻辑。注意其 `sizeType:['compressed']` 只做系统级压缩，若图片仍过大再补 `uni.canvasToTempFilePath` 二次压缩。
- base64 存 DB，走 adapter 自动分块（900KB chunk）。

---

## P2：音标记忆 + 知识库精简版（各约 2 天，可并行）

### 2.1 音标记忆（PhoneticMemory）

桌面端参考：`src/stores/phoneticMemory.ts`、`src/views/PhoneticMemory/`、`src/utils/phoneme-data.ts`、`phoneme-breakdown.ts`、`phonetic-util.ts`、`phonetic-memory-db.ts`。

**复制即可用（纯函数零平台依赖）**：
- `src/utils/phoneme-data.ts`（48 音标 + 示例词数据）、`phoneme-breakdown.ts`、`phonetic-util.ts` → 原样复制到 `mobile/src/utils/`。
- 类型从 `src/types/phonetic-memory.d.ts` 并入 `mobile/src/stores/useUtils/types.ts`（mobile 惯例，避免小程序 .d.ts 问题）。

**需改造**：
- `phonetic-memory-db.ts` → 走 mobile `getDbAdapter()`（`mobile/src/adapters/index.ts`），doc id 与桌面端保持一致（保证同步互通）。
- 发音：音标无现成音频 URL 时用其示例单词发音，统一走 mobile 已有 `MiniProgramTtsAdapter.playAudio`（`uni.createInnerAudioContext` + 有道 dictvoice URL）。

**新建**：
- `mobile/src/stores/usePhoneticMemory.ts`（参照桌面端 store，无 DOM 依赖，换 adapter 即可）。
- 页面放 `mobile/src/subPackages/pages-memory/`：`phonetic-memory.vue`（48 音标总览网格 + 掌握度着色 + 模式入口）、`phonetic-recognition.vue`（听音选标/看标选词）、`phonetic-minimal-pairs.vue`（最小对立对）、`phonetic-breakdown.vue`（音素拆解）。pages.json 注册 + 首页/我的入口。

### 2.2 知识库精简版（KnowledgeMemory，只做翻卡 + 四选一）

桌面端参考：`src/stores/knowledgeMemory.ts`、`src/utils/knowledge-pack-service.ts`（KNOWLEDGE_PACK_LIST 注册表）、`knowledge-memory-srs.ts`、`knowledge-memory-db.ts`、`public/knowledgebanks/*.json`（29 个包共 192KB）。

**复制即可用**：
- `src/utils/knowledge-memory-srs.ts`（纯 SRS）。
- SRS 常量**不要**新建 `mobile/src/constants.ts`——`DEFAULT_INTERVALS` 已定义在 `mobile/src/stores/useMobileWords.ts:9` 且经核对与桌面端逐值一致。把它抽取到 `mobile/src/stores/useUtils/constants.ts`（或直接 export 复用），useMobileWords 与新模块共用同一份，避免双定义漂移。
- 类型并入 `useUtils/types.ts`。

**需改造**：
- `knowledge-memory-db.ts` → mobile adapter，doc id 不动。
- 内置包加载：桌面端用 `fetch` + localStorage 缓存（小程序无 fetch）。沿用 mobile 词库已验证的模式——29 个 JSON 转 TS 模块（`export default {...}`）放 `mobile/src/subPackages/pages-knowledge/knowledgebanks/`，写 `knowledge-pack-loader.ts` 懒加载 `import()`；192KB 全量进此分包，不占主包 2MB 限额。7 天缓存的 `isCacheUsable` 逻辑原样移植，localStorage 换 `uni.*StorageSync`。

**新建**：
- `mobile/src/stores/useKnowledgeMemory.ts`（参照桌面端，换 adapter）。
- 页面（`mobile/src/subPackages/pages-knowledge/`）：
  - `knowledge-list.vue`：双 tab「我的知识库 / 内置知识库（按 category 分组）」，导入/移除；布局语言照搬 text-memory import.vue（888 行，已是同类交互的移动端样板）。
  - `knowledge-practice.vue`：只做**翻转卡片**（复用 review.vue 翻卡交互）+ **四选一**（干扰项同包随机取 3）。顺序回忆、输入模式不做。
  - `knowledge-detail.vue`：预览表（question/answer/extras）+ 口诀展示。
- pages.json 注册分包 + 首页/我的入口。

### 2.3 同步扩展（双端改动，P2 末尾一次做完）

**复审修正**：经核实，桌面端 `src/utils/sync-manager.ts` 的 payload 目前只有 `words + textMemory + numberMemory` 三个 scope，**没有知识库/音标进度的同步逻辑**；mobile `sync.ts` 镜像同一 schema。因此这不是小程序侧单方面工作，而是**双端同步扩展**：

1. **桌面端** `src/utils/sync-manager.ts`：payload 增加 `knowledgeMemory`（导入列表 + 每包进度）、`phoneticMemory`（音标进度）两个 scope，含 collect/restore 双向逻辑与 sync UI 勾选文案。
2. **小程序端** `mobile/src/subPackages/pages-tools/utils/sync.ts`：镜像同一 payload 字段；`sync.vue` 更新「同步范围」说明。
3. **向后兼容**：payload 只增不改——旧版客户端收到含新字段的数据应忽略未知字段（两端 restore 均按字段存在性判断，`if (data.knowledgeMemory) ...`，现有 textMemory/numberMemory 已是此模式）。
4. doc id 对齐：知识库导入列表/每包进度、音标进度的 doc id 先查 `src/utils/knowledge-memory-db.ts`、`src/utils/phonetic-memory-db.ts`，mobile 侧逐一保持一致。
5. （可选）打卡记录 `signin_records` 目前两端都不同步，如需多设备打卡连续性，可顺势纳入 payload。

---

## P3：记忆宫殿（缓做，等 P0–P2 落地后评估）

重的原因：4 个页面（列表/详情/编辑/巡视复习）+ PalaceImagesDoc 图片分文档存储 + `emojiToSvgDataUrl` 的 dataURL 在抖音端兼容性待验证（需封装 `LocusImage.vue` 做 SVG/纯 emoji 降级分支）+ 桩拖拽排序在触屏上要重做交互。
若做：纯逻辑 `src/utils/memory-palace-util.ts`/`memory-palace-srs.ts` 可直接复制，桩库导入复用 P2 的知识包 loader（`usableAsPeg=true` 的包），页面放 `pages-memory` 分包。

**明确不做**：快捷键记忆（无键盘场景）。

---

## 通用改造规范（所有阶段适用）

1. 不 import 主 src/，代码复制进 mobile 后改造（现有约定）。
2. 替换表：`localStorage`→`uni.*StorageSync`；`fetch/axios`→`uni.request`；`ElMessage`→`uni.showToast`；DOM 剪贴板→`uni.setClipboardData`；`crypto.subtle`→crypto-js；DOM canvas→`uni.canvasToTempFilePath`。
3. 所有 doc id / storage key / SRS 参数（`DEFAULT_INTERVALS`）与桌面端一致——这是 sync 互通的前提。
4. 包体积红线：主包 < 2MB；新页面/数据一律进分包；内置 JSON 一律转 TS 模块放对应分包；`bigPackageSizeSupport`、`lazyCodeLoading` 保持开启。
5. 不新增 request 域名（知识包打包进分包而非远程拉取）。

## 验证方式

每个阶段完成后：
1. `cd mobile && npm run dev:mp-weixin`，微信开发者工具打开 `dist/dev/mp-weixin`，逐页走查新功能（导入→练习/复习→进度落盘→杀掉进程重启确认持久化）。
2. 包体积：开发者工具「详情→基本信息」确认主包 < 2MB。
3. 存储：`wx.getStorageInfoSync()` 确认 key 前缀/分块正常；大词库（16k 词）不丢数据。
4. 同步互通（P2 后）：桌面端推送 → 小程序拉取，反向再验一轮。
5. 抖音兼容：`npm run build:mp-toutiao` 跑核心路径（重点：base64 编解码降级、canvas 压缩、音频播放）。
6. 回归：原 4 tab + 听写/翻译/文本/数字记忆不受影响；`App.vue onHide → flushDirtyBanks()` 仍生效。**注意 P2.3 会改动桌面端 `src/utils/sync-manager.ts`**，该阶段完成后必须跑 `npm run test:run` 并在桌面端（uTools/Web）实测一轮完整推送/拉取。

## 实施顺序

```
P0（0.5–1天）→ P1（1天）→ P2 音标 + 知识库精简版（各2天，可并行）→ [可选 P3 记忆宫殿]
```

P2 的两个模块无相互依赖；同步扩展放 P2 末尾一次做完。

---

## 复审修订记录（2026-09-06）

对计划逐项核实代码后修正以下 4 处：

1. **0.1 字段名**：mobile `MobileWord` 用 `addTime`/`lastReviewTime`（非桌面端 learnDate/lastReviewDate）；打卡存储 key 实为 `signin_records`（无前缀），已更正并注明沿用。
2. **SRS 常量重复**：`DEFAULT_INTERVALS` 已存在于 `useMobileWords.ts:9` 且与桌面端逐值一致，原计划「新建 constants.ts」改为「抽取共享，避免双定义」。
3. **P2.3 范围低估（最重要）**：桌面端 `sync-manager.ts` 的 payload 只有 words/textMemory/numberMemory 三个 scope，**知识库/音标同步需双端同时扩展**，并需保证 payload 只增不改的向后兼容；验证环节相应补充桌面端回归。
4. **1.2 图片桩**：`capture.ts` 已封装 chooseImage+base64+多端条件编译，改为直接复用 `capture()`，不新写 chooseMedia 逻辑。

已核实无误的关键假设：错题本确在 `pages-data/wrong-words/` 未注册；tabBar 确无 iconPath；数字记忆 imageUrl/imageSource 字段确已预留；mobile 词库 TS 模块分包模式（wordbank-a/loaderA.ts）可直接套用到知识包加载。

---

## 执行记录（2026-09-06，分支 feature/mobile-mp-adaptation）

P0–P2 全部完成，P3 未做（按计划缓做）。

| 阶段 | 状态 | 说明 |
|---|---|---|
| P0.1 首页统计 | ✅ | 新建 `useSignin` store（沿用 `signin_records` key）；首页连续打卡/今日学习接真实数据 |
| P0.2 错题本 | ✅ | pages.json 注册 + 单词页筛选面板入口（含错题数） |
| P0.3 tabBar 图标 | ✅ | PIL 生成 8 个 PNG（81×81，普通 #999999 / 选中 #52796f） |
| P1.1 专注模式 | ✅ | `pages-tools/focus/focus.vue` 全屏深色版，标准/拼写/听写三模式 + 防熄屏 + `slowlyrecord-focus-settings` 持久化 |
| P1.2 数字图片桩 | ✅ | `setAssociation` 解锁 image；持久化迁移到 DB 适配器（旧裸 key 自动迁移）；peg-edit 复用 `capture()` + canvas 压缩到 512px |
| P2.1 音标记忆 | ✅ | 4 页面 + `usePhoneticMemory`；`DEFAULT_INTERVALS` 抽到 `useUtils/constants.ts` 共享 |
| P2.2 知识库 | ✅ | 35 包转 TS 模块进 pages-knowledge 分包（主包 452KB）；翻卡+四选一；store 放分包内（主包不能引分包代码），SRS/DB 工具放主包 utils |
| P2.3 同步扩展 | ✅ | 双端 payload 增 `knowledgeMemory`/`phoneticMemory` scope，learnDate 较新者合并；SyncDialog 勾选项/摘要同步更新 |
| P3 记忆宫殿 | ⏸ | 按计划缓做 |
| 快捷键记忆 | ❌ | 按计划不做 |
| 打卡同步（可选） | ⏸ | 未纳入 payload（桌面端签到数据模型待对齐），后续需要时再补 |

**验证结果**：`npm run test:run` 1830 个测试全过；`npm run type-check` 通过；`build:mp-weixin` / `build:mp-toutiao` 通过；主包 452KB（红线 2MB）。

**遗留事项**：
- 图片桩 `sizeType:['compressed']` 之后如仍超 600KB 走 canvas 压缩，抖音端 canvas 兼容性需真机走查（验证方式见上文「验证方式」第 1/5 条）。
- 同步互通需双端实测：桌面端推送 → 小程序拉取，反向再验一轮（上文第 4 条）。
- 移动端知识库未做自建条目（桌面端特有），如需同步自建条目再扩展 `knowledge_custom_items` doc。
