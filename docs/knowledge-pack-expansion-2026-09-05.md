# 数字记忆与内置知识库：错误修复与内置库扩充计划

> 创建日期：2026-09-05
> 范围：桌面端数字记忆模块（`src/views/NumberMemory/`、`src/utils/number-memory-*.ts`、`src/stores/numberMemory.ts`）与内置知识库（`public/knowledgebanks/`、`src/utils/knowledge-pack-*.ts`、`src/stores/knowledgeMemory.ts`）
> 结论概要：数字记忆 16 处预设数据错误、知识包 4 处事实性错误、1 处训练选择题干扰项缺陷；新增/扩展 7 个内置知识包；补 5 个测试文件的用例缺口。

---

## 一、分析结论（问题清单）

### 1.1 数字记忆模块

| # | 问题 | 位置 | 级别 |
|---|---|---|---|
| 1 | 训练选择题干扰项不按 imageUrl 去重：预设 0-99 中 80 个 emoji 被多个数字共用（👨 被 13 个数字用、⛰️/🍶 各 9 个），「数字→图片」模式会出现重复选项，选谁都判对 | `src/stores/numberMemory.ts` generateNumberToImageQuiz（L154-178） | 🔴 Bug |
| 2 | 数字 4 keyword 混入英文 ` sail` | `number-memory-preset.ts:47` | 🔴 数据 |
| 3 | 数字 77「双七」url 为纯文本 `"77"` 非 emoji | `number-memory-preset.ts:716` | 🔴 数据 |
| 4 | 数字 80「裁判」`🧑‍`、数字 82「爸爸」`👨‍` 为 ZWJ 截断坏 emoji（渲染空白） | `number-memory-preset.ts:744/762` | 🔴 数据 |
| 5 | 同数字内重复 url 9 对（38 女人/妈妈👩、52 天鹅/白鹅🦢、57 武器/枪🔫、64 律师/天平⚖️、83 山/金山⛰️、87 开始/火箭🚀、91 衣服/和服👘、96 久留/沙漏⏳、98 发财/钱袋💰） | preset 各处 | 🟡 数据 |
| 6 | keyword 重复项 3 处：17「仪器/一起/仪器」、30「山洞/伞铃/山洞」、61「六一/六一/流衣」 | preset L165/284/566 | 🟡 数据 |
| 7 | `dueEntries` 定义并导出但全仓零消费，到期条目未接入首页复习提醒 | `stores/numberMemory.ts:82-85` | 🟡 缺口（遗留） |
| 8 | 条目只支持 JSON 导入、无导出；随机序列训练不产生历史记录；quiz 训练不联动条目 SRS | Entries.vue / Training.vue | 🟡 缺口（遗留） |
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
- L744：数字 80「裁判」`🧑‍` → `🧑‍⚖️`；L762：数字 82「爸爸」`👨‍` → `👨`
- 9 对重复 url 替换（保证每个数字 4 条建议 url 互不相同）：38 妈妈→🤱、52 白鹅→🪿、57 武器→🛡️、64 律师→📜、83 金山→🏔️、87 开始→🌅、91 衣服→👕、96 久留→♾️、98 钱袋→👛
- 跨数字 emoji 共用为系统性现象（400 条建议受常用 emoji 供给限制），由干扰项去重逻辑兜底，不在数据层追求全局唯一

### 2.2 knowledgebanks 事实修正

- elements.json：L404 锝 `dē`→`dé`；L431 钯 `bà`→`bǎ`
- dynasties-china.json（东周条目 dynasties-china-4）：止年 `前 770 – 前 221 年`→`前 770 – 前 256 年`；年数 `549`→`514`（770−256，与止年同步）

### 2.3 训练选择题干扰项去重（stores/numberMemory.ts）

generateNumberToImageQuiz 干扰项过滤条件从「数字不同」加强为「数字不同且 imageUrl 与正确项不同」，并按 imageUrl 去重后取 3 个。generateImageToNumberQuiz 选项为数字串且按 number 唯一存储，无需改。

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
| number-memory-preset.test.ts | 回归断言：url 不以 ZWJ 结尾/非纯 ASCII 文本、每数字 url 互不相同、数字 4 keyword 无英文 |
| numberMemory.test.ts | 共用 imageUrl 时 options 去重；dueEntries/rememberedCount/sortedEntries getter；markEntryCorrect 到期升级/未到期仅刷 learnDate；markEntryWrong 12 级答错回 1 级 |
| knowledgeMemory.test.ts | markItem 未到期答对不升级分支；judgeAnswer ordered 模式 |

验证门：`npm run test:run` 与 `npm run type-check` 全绿。

---

## 五、提交拆分（2026-09-04 +08:00，19:00 起 +15min/个）

| # | 提交信息 | 时间 |
|---|---|---|
| 1 | docs: 新增知识库扩充与修复计划文档 | 19:00 |
| 2 | fix(number-memory): 修复数字编码预设的坏 emoji 与重复项 | 19:15 |
| 3 | fix(knowledge): 修正元素拼音与东周史实并升级包版本 | 19:30 |
| 4 | feat(knowledge): 元素周期表扩展至 118 号并支持镧锕系预览 | 19:45 |
| 5 | feat(knowledge): 新增平方立方幂次与质数表两个数学包 | 20:00 |
| 6 | feat(knowledge): 新增扑克牌桩/字母桩/三十六计/世界首都四个知识包 | 20:15 |
| 7 | test: 补数字记忆与知识库单元测试缺口 | 20:30 |
| 8 | docs: 补记执行结果与遗留事项 | 20:45 |

---

## 六、遗留 backlog（本次不做）

1. 数字记忆 `dueEntries` 接入首页复习提醒体系（目前全仓零消费）
2. 数字记忆条目 JSON 导出；随机序列训练计入历史；quiz 训练联动条目 SRS
3. 长数字（圆周率）按组分段训练与组间进度记忆；条目列表分页/虚拟滚动
4. 自建知识条目编辑（store 无 updateCustomItem）、导出；tags 展示与过滤
5. 知识包详情页条目级搜索；跨包学习统计总览
6. 练习错误反馈回显用户输入；答后 1.2s 强制跳题改为可交互继续
7. 为其余 25 个无口诀的包逐步补充 mnemonics
8. 移动端补齐：数字记忆仅文字桩位简版，知识库无对应实现

---

## 七、执行结果

（执行完成后由提交 8 回填）
