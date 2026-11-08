# 示例词集汇编说明（词根 / 词缀 / 拼写组合 / 场景名词）

> 状态：功能未上线，不承担历史数据迁移负担；本文记录当前最优内容结构与排序规则，后续增删、复现或迁移都以本文为准。
>
> 生成脚本：`scripts/gen-wordbook-samples.cjs`  
> 生成产物：`src/utils/wordbook-samples.ts`、`mobile/src/utils/wordbook-samples.ts`（两文件内容完全一致，勿手改）  
> 播种逻辑：`src/utils/wordbook-seed.ts`（当前 `SAMPLE_VERSION = 7`）

## 1. 四本示例词集

| 词集 | 定位 | 章 | 页面数 | 词条数 |
|---|---|---|---|---|
| 词根册 | 先学高频、简单、派生多的词根 | 核心词根 / 进阶词根 | 21 | 132 |
| 词缀册 | 先学最常用、最容易举一反三的前缀和后缀 | 常用前缀 / 常用后缀 | 26 | 182 |
| 拼写组合册 | 按元音、辅音、特殊拼写建立拼写—读音联想 | 元音组合 / 辅音组合 / 特殊拼写 | 23 | 184 |
| 场景名词 | 用具体场景承载基础名词 | 身体 / 日常物品 / 酒店 | 3 | 24 |

合计 **73 个学习页、522 个词条**。

## 2. 排序规则（“短时间掌握大量单词”）

### 2.1 页面顺序

按“高频 → 简单 → 派生多 → 重要”排序，不按字母顺序。

- **词根册 · 核心词根**：`act, form, port, pos, gen, fer, vis, spect, dict, ject`
- **词根册 · 进阶词根**：`mit, miss, duct, tract, struct, vid, geo, graph, phon, audi, bio`
- **词缀册 · 常用前缀**：`un, re, dis, pre, ex, inter, interact, trans, pro, over, under, mis, out`
  - `interact` 是紧随 `inter` 的派生页，不是独立词缀页。
- **词缀册 · 常用后缀**：`er, ly, tion, able, ible, ness, ment, ity, ful, less, ive, ous, ize`
- **拼写组合册 · 元音**：`ea, ou, ai, ee, ow, oo, ay, oa, igh`
- **拼写组合册 · 辅音**：`ch, th, sh, ng, ck, qu, ph, wh`
- **拼写组合册 · 特殊拼写**：`old, kn, wr, mb, tch, dge`

排序依据：

1. 词根在四级/六级/考研词库中的出现频次与派生词数量；
2. 词根本身是否简单、是否容易用常见词举例；
3. 是否承担“继续派生”的枢纽作用（如 `act → interact → interaction/interactive`）；
4. 同等条件下，先动作/生活类、后学术/希腊拉丁类。

### 2.2 页内单词顺序

- 词根、词缀、字母组合页：按词频从高到低排序，先出现最常用、最简单的词；
- 页中心词本身（如 `form`、`graph`、`old`）置顶，保证先看到词根本身；
- `text` 类型的自定义主题页保留人工顺序（如酒店入住流程 `luggage → reception → key → bed → towel → bill → tip`），不按词频打乱。

### 2.3 跨书学习路径

1. **词根册核心词根**：先建立“词根 = 意义积木”的概念；
2. **词缀册常用前缀/后缀**：快速扩大构词判断力；
3. **inter → interact 派生链**：展示“词缀 + 词根 → 派生词 → 再派生”的两层构词；
4. **词根册进阶词根**：补充拉丁/希腊词根；
5. **拼写组合册**：解决“会认不会读/不会拼”；
6. **场景名词**：用具体场景收口基础名词。

## 3. 页面与词条字段

### 3.1 页面

```ts
{
  keyType: 'letters' | 'root' | 'prefix' | 'suffix' | 'phonetic' | 'text'
  keyValue: string          // 中心文本，如 act / un / -tion / old / interact
  keyDescription?: string   // 中心解释，如“做、驱动、行动”
  note?: string             // 构词与演变说明，详情面板“构词与演变”展示
  words: WordBookSampleWord[]
}
```

页面 `note` 统一写三件事：

1. 词源（拉丁/希腊原词与含义）；
2. 本页扩展词的关系（前缀 + 词根、词根 + 后缀）；
3. 继续派生的方向（如 `interact + -ion → interaction`）。

### 3.2 词条

```ts
{
  entryId: string           // 内容派生 ID，见第 5 节
  text: string
  explains: string
  phonetic?: string
  freq?: number
  note?: string             // 单词级构词说明，如“interact + -ion → 相互作用”
  examples?: { english: string; chinese: string }[]
  memoryTip?: string        // 记忆点/联想，优先给高频、易混、派生词
}
```

当前覆盖：

- **522 / 522 个词条都有例句**；
- **187 个词条带记忆点**（核心词根、派生链、易混词优先）；
- 所有词根/词缀页都有页面级构词说明。

## 4. 内容选择与校验规则

### 4.1 选词

- 词源数据取自 `public/wordbanks/` 的 `cet4 → cet6 → kaoyan → level4 → level8`，按顺序取第一个命中项；
- 每个示例词必须真实包含页中心：
  - `prefix`：`word.startsWith(key)`
  - `suffix`：`word.endsWith(key)`
  - `letters` / `root`：`word.includes(key)`
  - `text`：不校验包含关系
- 每页至少 4 个词；
- 同一页不重复词条；
- 生成时校验 `entryId` 全局唯一，重复直接报错，不产出半成品。

### 4.2 页面容量

- 软上限 12 词（图表布局上限）；
- 超出时优先拆页，不缩小字体或增加节点密度；
- 当前核心页最大为 12 词，其余多为 5～9 词。

### 4.3 例句与记忆点

- 例句优先覆盖“需要语境才能理解用法”的词：动词、抽象名词、形容词、派生词；
- 具体名词和拼写示例词也配一句短句，保证详情不空；
- 记忆点只给“有明确构词/联想抓手”的词，不强行编故事；
- 例句与记忆点都写在生成脚本的 `WORD_DETAILS` 中，不手改生成产物。

## 5. ID、版本与数据更新

### 5.1 entryId

格式：

```text
sample_{bookId}_{chapterId}_{pageKey}_{word}
```

示例：

- `sample_roots_core_roots_act_action`
- `sample_affixes_prefix_interact_interaction`
- `sample_spelling_vowels_ea_sea`

规则：

- 由内容派生，不依赖页序号/词序号；
- 插入新页、调整顺序、增加词条不会重排旧 ID；
- `bookId` / `chapterId` 为稳定英文标识，见脚本中的 `BOOK_IDS` / `CHAPTER_IDS`；
- 页面中心为中文时（仅场景名词）使用 `text_1` 这类稳定兜底。

### 5.2 示例版本

- 当前 `SAMPLE_VERSION = 7`，`localStorage` 标记为 `sr_wordbook_samples_v7`；
- 旧示例书带 `sampleVersion`，升级时只替换 `isSample && version < 7` 的书；
- 用户已编辑认领（`isSample: false`）的书不替换；
- 用户已删除示例时不会自动补建；
- 同名旧示例先让位再创建，避免“新书被当成旧书删掉”；
- 功能未上线，现阶段可自由调整内容并提升版本号，无需兼容历史示例。

## 6. 如何修改 / 复现

1. 修改 `scripts/gen-wordbook-samples.cjs`：
   - 页面：`rootPages`、`prefixPages`、`suffixPages`、`letterPages`、`specialLetterPages`、`nounPages`；
   - 顺序：`ROOT_ORDER`、`PREFIX_ORDER`、`SUFFIX_ORDER`、`VOWEL_ORDER`、`CONSONANT_ORDER`、`SPECIAL_ORDER`；
   - 词条说明：`WORD_NOTES`；
   - 例句/记忆点：`WORD_DETAILS`。
2. 运行：

   ```bash
   node scripts/gen-wordbook-samples.cjs
   ```

   脚本会同时写桌面端与移动端两份生成文件。
3. 需要让已存在的示例书更新时，提升 `src/utils/wordbook-seed.ts` 的 `SAMPLE_VERSION`，并同步提升移动端 `sampleVersion`。
4. 运行检查：

   ```bash
   npx vitest run src/utils/wordbook-samples.test.ts src/utils/wordbook-seed.test.ts
   npm run type-check
   npm run type-check:mobile
   ```

## 7. 当前已知取舍

- `graph` 页的 `photograph / geography / biography` 中 `graph` 位于词中，词根解析只会高亮一个词根（优先 `photo/geo/bio`），因此这三词不会精确高亮 `graph`；页面语义与页面说明仍然正确。
- `spec/spect`、`duc/duct`、`stru/struct` 等变体通过词书页的“同族匹配”高亮（中心词缀与解析成分互相包含即可），不强行合并词根数据。
- 示例词集是教学样板，不追求出版级词源考据；有争议的词源以“常见教学口径”为准，页面 note 可继续修订。

## 8. 后续可优化方向

- 为每个词根补充“同根词频次”统计，用数据自动生成页面顺序，而不是维护 `ROOT_ORDER`；
- 增加“从派生词继续拆”的第三层页面（如 `interaction → interactive → interactivity`）；
- 为记忆点增加 emoji/图片案例，和字母映射表打通；
- 把页面 note 的“词源—派生链”渲染成可折叠的时间线/树状图，而不是纯文本；
- 根据用户实际停留与复习数据，调整核心/进阶分界和页内词序。
