# uTools 词库写路径重构设计（读写放大 + 双窗口互踩）

日期：2026-09-17
状态：**设计稿，主代理已确认，子代理执行中**

## 问题（审查确认）

1. **读放大**：任何「读一个词库/改一个单词」都全量加载**所有词库**的全部分片。
   启动至少 2 次全量读（`getCurrentWordBankId` 内部调了两次 `getAllWordBanks`）；
   每点一次「认识」= 全库读 + 整库重写（5000 词 ≈ 17 分片 ~1MB 序列化，uTools 同步 IO 全在主线程）。
2. **双窗口互踩**（uTools 下真实存在）：focus.html 读 chunk→改一词→整片 put；
   父窗口 upReview 也是整库重写。uTools 的 utools.db 有 _rev 校验，但冲突重试策略是
   「取新 _rev 后仍用陈旧快照整片覆盖」→ 对方刚写的同分片其他单词进度被回退。
3. `getCurrentWordBankId` 在 462/471 行各调一次 `getAllWordBanks()`（全量×2）。

## 方案（最小侵入，不改变存储格式）

### A. 元数据与单词加载分离（读放大根治）

- 新增 `getAllWordBankMetas(): Promise<Omit<WordBank, 'words'>[]>`：只读 meta 文档，不加载任何分片。
- `getAllWordBanks()` 保留（sync 等调用方需要全部 words），内部改用 metas + 按需分片。
- `getCurrentWordBankId()` 改为只调 `getAllWordBankMetas()`（原两次全量 → 两次 meta 读）。
- `saveWordBank(bank)`：仅更新 meta 中该词库的元数据 + 写该词库分片，**不再先 getAllWordBanks 全量读**。
  实现：直接 `getWordBankMetaDoc()` 改 banks 数组中对应项，避免全库读取。
- `createWordBank`：追加 meta，不读全库 words。

### B. 复习进度按分片 merge 写（互踩根治）

- 新增 `updateWordInBankChunk(bankId, word: Word): Promise<boolean>`：
  1. 定位单词所在分片（读 `getWordBankChunkDocs` 找含该 `_id` 或同 text 的分片）；
  2. **put 前重新 `db.get(docId)` 取最新分片**（拿到对方窗口刚写入的其他单词进度）；
  3. 在最新分片的 words 里替换/追加该单词（按 `_id` 优先、text 兜底）；
  4. 带 fresh `_rev` put 该分片；conflict 时重读重试（最多 3 次）。
- `words.ts` 的 `addAndUpdateWord` 热路径（复习点一次写一词）改走此函数，不再整库重写。
- focus.html 的 `updateWordInBank` 改调同一逻辑（通过 postWordChanged 让父窗口写，或子窗口同函数内联）。

### C. 不做的事

- 不改存储格式（分片结构、_id 命名不变）——零迁移。
- 不动 sync-collect 路径（它本来就需要全量 words）。
- 不做 IndexedDB 端优化（备用端，无运行测试）。

## 验收

- `getCurrentWordBankId` 不触发任何分片读取。
- `addAndUpdateWord`（复习一词）只写 1 个分片文档 + 1 个 meta 文档。
- 双窗口并发写同一词库：后写的一方不覆盖对方刚写的其他单词进度。
- 现有测试（wordbank-manager 相关）全绿 + 新增 merge 写回归测试。

## 执行分工

主代理出方案（本文档）；子代理执行 A+B+测试；主代理 review + 全量验证。
