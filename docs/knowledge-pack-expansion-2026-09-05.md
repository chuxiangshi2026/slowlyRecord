# 数字记忆与内置知识库：错误修复与内置库扩充计划

> 创建日期：2026-09-05（2026-09-06 修订：数字记忆部分代码事实复核 + 替换 emoji 冲突修正 + 新增 §2.4 增强范围）
> 范围：桌面端数字记忆模块（`src/views/NumberMemory/`、`src/utils/number-memory-*.ts`、`src/stores/numberMemory.ts`）与内置知识库（`public/knowledgebanks/`、`src/utils/knowledge-pack-*.ts`、`src/stores/knowledgeMemory.ts`）
> 结论概要：数字记忆 16 处预设数据错误、知识包 4 处事实性错误、1 处训练选择题干扰项缺陷；数字记忆 3 项体验增强（到期提醒接线 / 条目导出 / 随机序列历史）；新增/扩展 7 个内置知识包；补 5 个测试文件的用例缺口。

---

## 一、分析结论（问题清单）

### 1.1 数字记忆模块

| # | 问题 | 位置 | 级别 |
|---|---|---|---|
| 1 | 训练选择题干扰项不按 imageUrl 去重：预设 0-99 中 83 个 emoji 被多个数字共用（👨 被 13 个数字用、⛰️/🍶 各 9 个），「数字→图片」模式会出现重复选项，选谁都判对 | `src/stores/numberMemory.ts` generateNumberToImageQuiz（L154-178） | 🔴 Bug |
| 2 | 数字 4 keyword 混入英文 ` sail` | `number-memory-preset.ts:47` | 🔴 数据 |
| 3 | 数字 77「双七」url 为纯文本 `"77"` 非 emoji | `number-memory-preset.ts:716` | 🔴 数据 |
| 4 | 数字 80「裁判」`🧑‍`、数字 82「爸爸」`👨‍` 为 ZWJ 截断坏 emoji（渲染空白） | `number-memory-preset.ts:744/762` | 🔴 数据 |
| 5 | 同数字内重复 url 9 对（38 女人/妈妈👩、52 天鹅/白鹅🦢、57 武器/枪🔫、64 律师/天平⚖️、83 山/金山⛰️、87 开始/火箭🚀、91 衣服/和服👘、96 久留/沙漏⏳、98 发财/钱袋💰） | preset 各处 | 🟡 数据 |
| 6 | keyword 重复项 3 处：17「仪器/一起/仪器」、30「山洞/伞铃/山洞」、61「六一/六一/流衣」 | preset L165/284/566 | 🟡 数据 |
| 7 | `dueEntries` 定义并导出但全仓零消费（已 grep 核实），到期条目未接入任何提醒入口 | `stores/numberMemory.ts:82-85` | 🟡 缺口 → 本次做（§2.4-1） |
| 8 | 条目只支持 JSON 导入、无导出；随机序列训练明确跳过结果保存（`NumberMemoryTraining.vue:560` 注释「随机序列模式不保存训练结果」），无历史沉淀 | Entries.vue L630-670 / Training.vue L560-563 | 🟡 缺口 → 本次做（§2.4-2/3） |
| 8a | （修正原计划表述）「quiz 训练不联动条目 SRS」系错误归类：quiz 作用于 0-99 数字↔图片关联（`NumberImageAssociation` 无 SRS 字段），与条目是两套数据；条目侧填空练习已联动 SRS（`NumberFillBlanksDialog.vue:261-267` 调 markEntryCorrect/Wrong）。真实缺口：quiz 对错不沉淀到任何复习调度（关联无 level/learnDate），属大改，留 backlog | stores/numberMemory.ts / types/number-memory.d.ts:7-12 | 🟡 缺口（遗留） |
| 9 | 长数字（圆周率）无按组分段训练与组间进度；条目列表全量 v-for 无分页 | 各视图 | 🟡 缺口（遗留） |

### 1.2 内置知识库

| # | 问题 | 位置 | 级别 |
|---|---|---|---|
| 1 | 元素周期表只覆盖前 54 号（氢~氙），缺 55-118 | `elements.json` | 🟡 补全 |
| 2 | 锝拼音 `dē` 应为 `dé`、钯 `bà` 应为 `bǎ` | `elements.json:404/431` | 🔴 事实 |
| 3 | 夏朝创立者写「启」（通说为禹） | `dynasties-china.json:15` | 🔴 事实 |
| 4 | 东周止年写「前 221」（通说前 256），年数 549 需同步改 514 | `dynasties-china.json:47/52` | 🔴 事实 |
| 5 | 自建知识条目不可编辑、无导出；tags 只收不用；包内无条目级搜索；无跨包进度总览 | store / Pack.vue | 🟡 缺口（遗留） |
| 6 | 练习答错只显示正确答案不回显用户输入；答后 1.2s 强制下一题不可跳过 | `KnowledgeMemoryPack.vue:640-657` | 🟡 体验（遗留） |
| 7 | 25/29 个包无 mnemonics 口诀 | knowledgebanks | 🟡 内容（渐进） |

数据质量核查方法：程序化校验（空字段/重复 question/重复 id/answer 超长/extras 类型）全部通过；乘法两包 181 条程序化验算无误；节气顺序、生肖地支、省会 34 条抽查无误。

### 1.3 已确认无需处理

- 29 个包条目数与 `KNOWLEDGE_PACK_LIST` 元数据全部一致；
- 消费端全动态（`listKnowledgePacks()`），新增包自动出现在数字记忆（math 类）/文本记忆（text 类）导入列表与记忆宫殿桩库，无需改 UI；
- 元素预览测试用合成 mock，不受数据扩展影响。

---

## 二、错误修复方案

### 2.1 number-memory-preset.ts（16 处）

- L47：数字 4 keyword `寺/旗/蛇/ sail` → `寺/旗/蛇/帆`
- L165：数字 17 → `仪器/一起/奇异`；L284：数字 30 → `山洞/伞铃/三零`；L566：数字 61 → `六一/儿童/流衣`
- L716：数字 77「双七」url `"77"` → `🌌`，描述「77七夕星空」
- L744：数字 80「裁判」`🧑‍` → `🧑‍⚖️`；L762：数字 82「爸爸」`👨‍` → `👨‍👦`（不用 👨：它已被 13 个数字占用、为全表最高频，修复不应加剧；👨‍👦 经扫描空闲且语义贴合）
- 9 对重复 url 替换（保证每个数字 4 条建议 url 互不相同）：38 妈妈→🤱、52 白鹅→🪿、57 武器→🛡️、64 律师→📜、83 金山→🗻、87 开始→🌅、91 衣服→👕、96 久留→♾️、98 钱袋→🧧
- ⚠️ 替换值经全文件占用扫描复核，原计划 3 处会引入新冲突：83 不用 🏔️（已被 73 占）改 🗻；98 不用 👛（已被 85 占）改 🧧（红包贴合「发财」语境）。另注意 🪿 为 Emoji 15.0，Win10 旧字体可能渲染为豆腐块，若收到反馈再回退
- 跨数字 emoji 共用为系统性现象（400 条建议受常用 emoji 供给限制），由干扰项去重逻辑兜底，不在数据层追求全局唯一

### 2.2 knowledgebanks 事实修正

- elements.json：L404 锝 `dē`→`dé`；L431 钯 `bà`→`bǎ`
- dynasties-china.json（东周条目 dynasties-china-4）：止年 `前 770 – 前 221 年`→`前 770 – 前 256 年`；年数 `549`→`514`（770−256，与止年同步）

### 2.3 训练选择题干扰项去重（stores/numberMemory.ts）

generateNumberToImageQuiz 干扰项过滤条件从「数字不同」加强为「数字不同且 imageUrl 与正确项不同」，并按 imageUrl 去重后取 3 个。防御：去重后不足 3 个时允许选项少于 4 个（不写死 4 选项假设），UI 按实际 options 渲染。generateImageToNumberQuiz 选项为数字串且按 number 唯一存储，无需改。

### 2.4 数字记忆增强（2026-09-06 修订新增范围）

以下 3 项从原 backlog 提升，均为低成本高价值（store 能力已具备，主要是 UI 接线与小范围类型扩展）：

1. **到期复习提醒接线**（对应 §1.1-7）：`NumberMemory.vue` 首页头部加到期条目角标（`dueEntries.length`，为 0 不显示），点击跳转条目页并自动开启「仅看到期」过滤；`NumberMemoryEntries.vue` 过滤栏新增「仅看到期」开关（复用 `isDue`，与现有 tag 过滤叠加）。纯 UI 接线，不改 store。
2. **条目 JSON 导出**（对应 §1.1-8 前半）：Entries.vue 导入下拉旁加「JSON 导出」，导出当前过滤结果（或全部），字段结构与导入解析（L645 起的 `JSON.parse` 字段）保持往返一致：title/numbers/tags/description/kind/mnemonic，文件名 `数字记忆条目-YYYYMMDD.json`。
3. **随机序列训练历史**（对应 §1.1-8 后半）：`TrainingResult.mode` 联合类型扩 `'randomSequence'`，结束时按轮存 details（每轮一条：`number`= 该轮数字串、`correct`、`responseTime`），`totalQuestions`= 完成轮数、`correctAnswers`= 答对轮数；历史弹窗模式标签加「随机序列」分支展示最高位数。删除 `NumberMemoryTraining.vue:560` 的提前 return。

明确不做（留 backlog）：quiz 结果驱动关联级 SRS（需给 `NumberImageAssociation` 加 level/learnDate 并设计调度，属大改）；长数字分段训练与列表分页。

---

## 三、内置知识库扩充（7 项）

均不与现有内置数据重复（词库为英语词汇/成语，文本记忆内置库为诗词文章/时间线，mobile 分包为英语词库）。

| id | 名称 | 类别 | 条数 | ordered | usableAsPeg | 内容设计 |
|---|---|---|---|---|---|---|
| elements（扩展） | 元素周期表（1-118） | math | 54→118 | 否 | 否 | 补 55-118 号元素：question 符号、answer 中文名、extras 拼音/序数/类别 |
| squares-cubes-powers | 平方立方与幂次 | math | 58 | 否 | 否 | 1-25 平方（25）+ 1-10 立方（10）+ 2¹-2¹⁶（16）+ 10¹-10¹²（7） |
| primes-under-100 | 100 以内质数表 | math | 25 | 是 | 否 | question 质数、answer 第 N 个质数；ordered 支持顺序回忆 |
| poker-pegs-52 | 扑克牌桩（52 张） | text | 52 | 是 | 是 | question 牌名（♠A…）、answer 编码形象；imageUrl 用 Unicode 牌面字符（🂡…🃎，52 个唯一） |
| alphabet-pegs-26 | 字母形象桩（A-Z） | text | 26 | 是 | 是 | question 字母、answer 经典形象词；imageUrl 用形象物 emoji |
| thirty-six-stratagems | 三十六计 | text | 36 | 是 | 否 | question 第 N 计（含套名）、answer 计名；extras 套别；mnemonics 总诀「金玉檀公策…」 |
| world-capitals-40 | 世界国家与首都 | text | 40 | 否 | 否 | question 国家、answer 首都；extras 大洲 |

### 3.1 周期表预览升级（elements 118 的前置）

- `preview-layout.ts`：`PERIOD_LENGTHS` `[2,8,8,18,18]`→`[2,8,8,18,18,18,18]`；新增镧系（57-71）/锕系（89-103）独立折叠行：主行第 3 列跳过 f 区，镧锕系各自成行从第 3 列起排 15 格
- `KnowledgeMemoryPack.vue`：周期表网格 CSS 增加镧锕系行样式（缩进 + 「镧系/锕系」分组标签）
- `preview-layout.test.ts`：新增第 6/7 周期、镧锕系折叠、超界回退 null 用例

### 3.2 元数据与版本

- `KNOWLEDGE_PACK_LIST` 新增 6 条（均 version:1）；elements `version: 3→4`（拼音修正 + 扩容）；dynasties-china 补 `version: 2`（史实修正触发旧缓存失效重载）

---

## 四、单元测试补全

| 文件 | 改动 |
|---|---|
| knowledge-pack-service.test.ts | 总数 29→35；math 列表 11→13、text 18→22；elements itemCount 54→118；elements version 断言与缓存 setup/断言 3→4（L247/250/305/310/329/358）；dynasties-china 移出「均为 1」组、显式断言 version 2；新增 6 新包表驱动校验（条数/category/ordered/peg + 结构 + id 连续 + order 递增 + peg 包 imageUrl 非空唯一）+ elements 序数 1-118 连续 |
| preview-layout.test.ts | 第 6/7 周期排布、镧锕系折叠行用例 |
| number-memory-preset.test.ts | 回归断言：url 不以 ZWJ 结尾/非纯 ASCII 文本、每数字 url 互不相同、数字 4 keyword 无英文、替换值（🗻/🧧/👨‍👦 等）全文件空闲 |
| number-memory-format/组件 | 条目导出→导入往返一致（导出字段集 = 导入解析字段集）；「仅看到期」过滤逻辑 |
| numberMemory.test.ts | 共用 imageUrl 时 options 去重且不足 3 个干扰项时不报错；dueEntries/rememberedCount/sortedEntries getter；markEntryCorrect 到期升级/未到期仅刷 learnDate；markEntryWrong 12 级答错回 1 级；saveResult 接受 randomSequence 模式 |
| knowledgeMemory.test.ts | markItem 未到期答对不升级分支；judgeAnswer ordered 模式 |

验证门：`npm run test:run` 与 `npm run type-check` 全绿。

---

## 五、提交拆分

> 原计划的「2026-09-04 19:00 起」时间已过期且与创建日期矛盾，执行时按当天实际时间顺排，以下只保留顺序与拆分粒度。

| # | 提交信息 |
|---|---|
| 1 | docs: 新增知识库扩充与修复计划文档 |
| 2 | fix(number-memory): 修复数字编码预设的坏 emoji 与重复项 |
| 3 | fix(number-memory): 训练选择题干扰项按图片去重 |
| 4 | feat(number-memory): 首页到期复习角标与条目仅看到期过滤 |
| 5 | feat(number-memory): 条目 JSON 导出与随机序列训练历史 |
| 6 | fix(knowledge): 修正元素拼音与东周史实并升级包版本 |
| 7 | feat(knowledge): 元素周期表扩展至 118 号并支持镧锕系预览 |
| 8 | feat(knowledge): 新增平方立方幂次与质数表两个数学包 |
| 9 | feat(knowledge): 新增扑克牌桩/字母桩/三十六计/世界首都四个知识包 |
| 10 | test: 补数字记忆与知识库单元测试缺口 |
| 11 | docs: 补记执行结果与遗留事项 |

---

## 六、遗留 backlog（本次不做）

1. quiz（数字↔图片）结果驱动关联级 SRS：需给 `NumberImageAssociation` 增加 level/learnDate 字段并设计调度策略，属大改
2. 长数字（圆周率）按组分段训练与组间进度记忆；条目列表分页/虚拟滚动
3. 自建知识条目编辑（store 无 updateCustomItem）、导出；tags 展示与过滤
4. 知识包详情页条目级搜索；跨包学习统计总览
5. 练习错误反馈回显用户输入；答后 1.2s 强制跳题改为可交互继续
6. 为其余 25 个无口诀的包逐步补充 mnemonics
7. 移动端补齐：数字记忆仅文字桩位简版，知识库无对应实现

---

## 七、执行结果（提交 11 回填）

已于 2026-09-06 全部执行完毕，共 11 个提交，验证门全绿：`npm run test:run` 89 个测试文件 1830 个用例通过，`npm run type-check` 通过。

| # | 提交 | 内容摘要 |
|---|---|---|
| 1 | `7d83346` docs: 新增知识库扩充与修复计划文档 | 本文档初版（随后按 2026-09-06 修订执行） |
| 2 | `363763b` fix(number-memory): 修复数字编码预设的坏 emoji 与重复项 | 16 处：keyword 4 处、坏 emoji/纯文本 3 处、同数字重复 url 9 对 |
| 3 | `5e857d3` fix(number-memory): 训练选择题干扰项按图片去重 | imageUrl 去重 + 不足 3 个干扰项兼容 |
| 4 | `7dcff71` feat(number-memory): 首页到期复习角标与条目仅看到期过滤 | `?due=1` 跳转联动，角标为 0 不显示 |
| 5 | `338beae` feat(number-memory): 条目 JSON 导出与随机序列训练历史 | `randomSequence` 模式按轮落库，历史弹窗展示最高位数 |
| 6 | `9af02a5` fix(knowledge): 修正元素拼音与东周史实并升级包版本 | elements→v4、dynasties-china→v2 |
| 7 | `924e22b` feat(knowledge): 元素周期表扩展至 118 号并支持镧锕系预览 | buildPeriodicTable 重写（9 行网格 + f 区折叠行） |
| 8 | `95e87a0` feat(knowledge): 新增平方立方幂次与质数表两个数学包 | 58 + 25 条 |
| 9 | `3464187` feat(knowledge): 新增扑克牌桩/字母桩/三十六计/世界首都四个知识包 | 52 + 26 + 36 + 40 条 |
| 10 | `269a787` test: 补数字记忆与知识库单元测试缺口 | 7 个测试文件，含新组件测试 NumberMemoryEntries.test.ts |
| 11 | 本提交 docs: 补记执行结果与遗留事项 | 本节 |

### 执行中的偏差与说明

1. **提交 5 随行为变更同步更新了 2 个旧断言**：`NumberMemoryTraining.test.ts` 原断言「随机序列不落库」的两处用例改为断言按轮落库（`objectContaining` 避免计时脆弱），与修订后行为一致。
2. **夏朝创立者「启→禹」** 在 §2.2 修复方案中漏列（§1.2 问题清单仍为 🔴），已随提交 6 一并修复。
3. **squares-cubes-powers 条数矛盾**：原文「10¹-10¹²（7）」区间与条数冲突，按总数 58 反推取 **10⁶-10¹²**（对应中文数位百万~万亿），包描述如实标注；`2²`/`2³` 作为平方/立方与 2 的幂的跨类别重复表达式保留（答案一致，校验只约束 id 唯一）。
4. **扑克牌 imageUrl** 为 Unicode 牌面字符（U+1F0A1…，跳过 KNIGHT xC），52 个互不重复；与 🪿 同理，旧系统字体可能渲染为方块，item 文本（如「♠A」）仍可读。
5. **组件测试**：新增 `NumberMemoryEntries.test.ts`（jsdom + v-loading 指令 stub + el-* 组件按未知元素渲染），覆盖「仅看到期」开关与 `?due=1` 路由联动两条路径。
6. **提交时间**：按修订要求使用当天实际时间顺排，未回填。
