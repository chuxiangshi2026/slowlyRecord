# 记忆模块扩展计划（数字记忆增强 / 知识包 / 记忆宫殿 / 函数绘图）

> 分支：`feat/memory-expansion`
> 创建日期：2026-09-02
> 前置结论：新需求 90% 可归并为两个原语 —— **问答对记忆（QA + SRS）** 与 **桩/宫殿（有序锚点 + 挂载内容）**，不为每个知识点单独建模块。

## 全局约束（所有阶段通用）

- **不改数据兼容**：已有 DB 文档结构只加可选字段，不改名、不删字段；旧数据读到新字段为空时要有默认值兜底。
- **跨平台能力走 `src/adapters/`**，业务代码不得直接调 `utools.*` / `wx.*` / IndexedDB。
- **零新增依赖**：打印用 `window.print()` + `@media print`；存图用 Canvas 2D 手绘表格；函数绘图用 Canvas 手写（平移/缩放/悬停坐标三手势，不引 function-plot）。
- **UI 统一三件套**：新列表页一律复用/仿制 `WordFilter` 筛选条 + `.list-item` 卡片（`src/assets/styles/list-item.scss`）+ `.home_footer` 底部图标栏；颜色只用 `theme.scss` 的 `--utools-*` 变量。
- **SRS 统一标准**：level 0-12，答对且过复习间隔才升级（牢固度 +1~3），`level >= 12` 才 `remember = true`。抄 `src/stores/phoneticMemory.ts` 模式。
- 中文注释；新逻辑配最小测试（`*.test.ts` 同目录）；每阶段完成必须 `npm run type-check` 和 `npm run test:run` 全绿。
- 提交按 AGENTS.md 规范回填时间：批次内第 N 个提交 = 前一天 19:00 + (N-1)×15 分钟，东八区。
- 不改动 `dist/`、`dist-electron/`、`release/` 等构建产物。

## 子代理分工约定

| 任务类型 | 模型 |
|---|---|
| 知识包 JSON 数据文件生成、单文件样式微调、简单工具函数 | `deepseek/deepseek-v4-flash` |
| 模块开发（store/db/视图，多文件） | 默认 `kimi-for-coding` |
| 跨模块联动设计、复杂 bug 分析 | `k3-256k` |

每个子代理 prompt 必须写明：目标、涉及的精确文件路径、约束（上方全局约束中的相关条目）、验收命令（type-check / 测试）。

---

## Phase 1：UI 统一（数字条目 + 文本记忆列表 → 单词列表风格）

**目标**：操作逻辑与视觉风格对齐单词列表，作为后续所有新模块的页面模板。

### 步骤
1. `NumberMemoryEntries.vue`：
   - 去掉 `el-card` 外壳和 20px padding，全宽布局。
   - 筛选区：搜索 + 标签 + 排序（时间/标题/复习次数），样式仿 `WordFilter`（WordFilter 本身是单词专用的，词根词缀等筛选项不可复用，只抄交互模式）。
   - 列表卡片改用 `.list-item` 全局样式：标题、大号数字、标签、复习次数。
   - 高频操作（图片联想、填空、笔记、编辑、删除）从 `el-dropdown` 改为 inline 图标 + tooltip；低频留 dropdown。
   - 全局操作（添加、导入、训练入口）移到底部 `.home_footer` 图标栏。
2. `TextMemory.vue` 列表视图：
   - 去掉 `max-width: 780px` 居中容器，全宽。
   - `.article-card` 换 `.list-item` 风格；摘要限两行。
   - 筛选加排序（时间/标题/复习次数）。
   - 高频操作（跟打、填空、笔记、编辑、删除）inline 图标化。
   - 地图/时间线视图**保持原样不动**。
3. `NumberMemory.vue`（训练配置页）：底部 `el-table` 换 `.list-item` 小卡片列表；其余保留。

### 约束
- 纯样式/布局层改动，**不动任何数据读写逻辑**。
- 两页并行开发时不得同时改 `list-item.scss` 等共享样式文件；确需扩展时由主代理统一处理。

---

## Phase 2：数字记忆增强

**目标**：π/手机号/身份证等长串数字可分类、有谐音助记、接入 SRS，支持随机序列竞技训练。

### 步骤
1. `NumberMemoryEntry` 加可选字段：`kind?: 'pi'|'phone'|'idcard'|'qq'|'email'|'bankcard'|'plate'|'date'|'custom'`、`mnemonic?: string`（顺口溜/谐音）、`level/learnDate`（SRS）。
2. 按 kind 做展示分段（手机号 3-4-4、身份证 6-8-4）与格式校验。
3. 内置谐音示例库（π="山巅一寺一壶酒…"等），练习页可显示 mnemonic 提示，支持双向练习（看数字想谐音 / 看谐音写数字）。
4. 随机序列模式：指定位数生成随机数串 → 限时记忆 → 回忆输入 → 逐级加长；成绩存会话历史，不进 SRS。
5. SRS 接入：抄 `phoneticMemory.ts`，level 0-12 + `DEFAULT_INTERVALS`，到期条目进入复习队列。

### 约束
- 旧条目无 `kind` 时按 `custom` 处理；无 level 时按 1 处理。
- 随机序列是纯会话训练，不写 DB。

---

## Phase 3：通用知识包模块（KnowledgeMemory）

**目标**：一套模块吃掉乘法表、元素周期表、数学/化学公式、12生肖、24节气、12星座、56民族、8大菜系、省份↔省会等全部列表型知识。

### 步骤
1. 数据类型 `KnowledgeItem { id, question, answer, extras?: Record<string,string>, order?: number }` + `KnowledgePack { id, name, description, ordered, usableAsPeg, items[] }`。
2. 分发复用内置词库模式：新建 `public/knowledgebanks/*.json` + `src/utils/knowledge-pack-service.ts`（加载 + localStorage 缓存，照抄 `wordbank-service.ts` 结构）。
3. 内置数据包（JSON 生成任务给 deepseek-flash）：小 99、大 99（19×19）、元素周期表（符号/名称/序数/拼音）、24节气（有序）、12生肖（有序）、12星座、56民族、8大菜系、省份↔省会、常用数学/化学公式。
4. 练习页：Q→A 翻卡、A→Q 反向、四选一、顺序回忆（ordered 包）、听写输入；每 item 独立 SRS（同 Phase 2 模式）。
5. 打印/存图（小学场景）：
   - 打印按钮 → 打印样式页（`@media print` 隐藏导航），出**完整表**和**填空自测表**两种形态。
   - 保存图片 → Canvas 2D 手绘表格 → `toDataURL` → 下载 PNG。
6. 路由注册 `/knowledge-memory`，菜单图标入 `HomeAside.vue` iconMap。

### 约束
- 知识包服务**不改动** `wordbank-service.ts`，平级新建。
- `usableAsPeg: true` 的包要能被 Phase 4 的宫殿桩选择器读取，接口设计时预留。

---

## Phase 4：记忆宫殿（MemoryPalace）

**目标**：用户建宫殿（图片地点桩），把文本记忆的文章切块挂桩，按路线巡视复习。

### 步骤
1. 数据结构：
   ```ts
   Palace { _id, name, loci: [{ order, name, imageUrl?, description? }] }
   PegItem { _id, palaceId, locusOrder, contentRef?: { type: 'text-article', articleId, chunkIndex } , freeText?: string, mnemonic? }
   ```
2. 桩图片上传复用数字记忆的图片关联 + `image-compress` 工具。
3. 内置桩库 = Phase 3 中 `usableAsPeg` 的知识包（108将、24节气、生肖等），桩选择器可直接导入为宫殿。
4. 文本切块挂载：TextMemory 文章按句/段切块，挂到 locus；`contentRef` 存引用不复制内容。
5. 巡视模式：全屏依次展示桩图片/名称 → 回忆挂载内容 → 下滑核对（复用填空/跟打对话框做校验）。
6. 路由 `/memory-palace`。

### 约束
- `contentRef` 是引用：源文章删除时 PegItem 要兜底显示"内容已删除"，不得级联删文章。
- 本阶段依赖 Phase 3 的 `usableAsPeg` 接口，顺序不可颠倒。

---

## Phase 5：函数交互绘图

**目标**：数学公式包详情页支持"公式 ↔ 图像"双向联想。

### 步骤
1. Canvas 函数绘图组件：支持一次/二次/三角/指数/对数，标关键点（零点、极值、渐近线）。
2. 三手势交互：拖拽平移、滚轮缩放、悬停显示坐标。
3. 挂到 Phase 3 数学公式包的详情/练习页。

### 约束
- 手写 Canvas，不引绘图库；组件 200 行左右为限。
- 覆盖不到的场景（隐函数、参数方程）不做，等真实需求。

---

## 阶段依赖与顺序

```
Phase 1（UI 模板） → Phase 2（数字增强）
                  → Phase 3（知识包） → Phase 4（宫殿） 
                                    → Phase 5（绘图，挂知识包详情页）
```

Phase 5 可在 Phase 3 完成后与 Phase 4 并行。

---

## 结构调整记录（2026-09）

独立的知识记忆模块与记忆宫殿模块已拆入宿主模块，不再保留独立列表入口：

- **知识包分类**：`knowledge-pack-service.ts` 的包元数据新增 `category: 'math' | 'text'`。
  - math（融入「数字记忆」主页"知识表"卡片区）：multiplication-9x9、multiplication-19x19、elements、math-formulas、chemistry-formulas
  - text（融入「文本记忆」知识库视图）：solar-terms-24、zodiac-12、constellations-12、ethnic-groups-56、cuisines-8、provinces-capitals
- **文本记忆**：视图切换从 3 个扩到 5 个（列表/地图/时间线/宫殿/知识库），支持 `/text-memory?view=palace`、`?view=knowledge` 定位。宫殿列表组件（`MemoryPalace.vue`）嵌入宫殿视图，固定底栏改为内联工具行；知识库视图为文本类知识包卡片（`TextMemory/components/KnowledgePackPanel.vue`）。
- **数字记忆**：主页新增"知识表"卡片区，复用 `KnowledgePackPanel`（category='math'）。
- **路由**：删除 `/knowledge-memory`（列表）与 `/memory-palace`（列表）路由；保留 `/knowledge-memory/:id`、`/memory-palace/edit/:id?`、`/memory-palace/:id`、`/memory-palace/:id/review`。
- **返回路径映射**：知识包练习页按 category 回宿主（math → `/number-memory`，text → `/text-memory?view=knowledge`）；宫殿详情/编辑的返回 → `/text-memory?view=palace`。
- 未新增 uTools 插件关键字入口（该方案已撤销）。
