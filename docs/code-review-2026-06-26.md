# 项目代码审查报告

- **审查日期**：2026-06-26
- **审查范围**：当前工作区相对 HEAD 的未提交改动 + 相关上下文
- **审查策略**：8 个独立 finder 角度（line-by-line、删除行为、跨文件、复用、简化、性能、altitude、CLAUDE.md 约定）+ 单轮 verify
- **本次审查**：只读分析，未修改任何代码

## 总览

| 序号 | 优先级 | 文件 | 摘要 |
|---|---|---|---|
| 1 | 🔴 高 | `src/utils/translation-api.ts` | 百度 QPS 限流回归，批量翻译并发触发 54003 |
| 2 | 🟠 中 | `src/utils/translation-api.ts` | 翻译缓存全量持久化，单次写入可达 MB 级 |
| 3 | 🟠 中 | `src/views/Dictation/Dictation.vue` / `Word.vue` | `upReview()` 改 async 后调用点未 await |
| 4 | 🟠 中 | `src/stores/words.ts` | `console.log` 违反日志策略，生产构建未剥离 |
| 5 | 🟠 中 | `mobile/src/App.vue` | mobile 端使用 console.log/error，未走项目日志 |
| 6 | 🟡 低 | `mobile/src/stores/useMobileWords.ts` | 重复实现规范化工具 |
| 7 | 🟡 低 | `mobile/src/subPackages/pages-tools/utils/sync.ts` | 重复实现 AES-GCM 加解密 |
| 8 | 🟡 低 | `src/utils/shortcut-memory-db.ts` | `nextIdTimestamp` 与 number-memory-entries-db 重复 |
| 9 | 🟡 低 | `src/utils/str-util.ts` | 无意义的运行时探测，fallback 是死代码 |
| 10 | 🟡 低 | `mobile/src/stores/useMobileWords.ts` | 空文本被计入 `skippedCount`，掩盖脏数据 |

---

## 🔴 高优先级（功能性回归）

### 1. 百度 QPS 限流回归

**位置**：`src/utils/translation-api.ts:772`（`translateBatchWithPlatform` 内）

**当前代码**：

```ts
for (let i = 0; i < misses.length; i += AI_BATCH_SIZE) {
    const chunk = misses.slice(i, i + AI_BATCH_SIZE);
    if (chunk.length > 1 && AI_BATCH_PLATFORMS.has(platform)) {
        // AI 平台走批量合并请求
    }

    await Promise.all(chunk.map(async item => {
        if (results[item.index]) return;
        results[item.index] = await translateWithPlatform(item.query, platform, from, to);
    }));
}
```

**问题**：

- `AI_BATCH_PLATFORMS` 仅包含 `glm/deepseek/qwen/kimi/ollama`。
- 百度、有道、阿里、腾讯走到下方的 `Promise.all(chunk.map(...))`，对 20 个未命中的词并发调用 `translateWithPlatform`。
- 旧实现里 `batchTranslateAndAddWords` 对百度强制 `1000-1500ms` 串行延迟，新链路完全删掉。

**失败场景**：

- 默认百度免费 key 批量添加 20+ 单词时，单次 chunk 内 20 个并发请求。
- 百度免费版 QPS=1，大部分单词翻译失败（`error_code = 54003`）。

**修复建议**：

- 在 `translateBatchWithPlatform` 内对非 AI 平台保留按平台分级的并发限制（与旧 `CONCURRENCY_LIMITS` 一致），尤其是 `baidu: 1`。
- 在每次 baidu 调用之间保留约 1000ms 间隔，或者复用之前的 worker-chain runner。

---

## 🟠 中优先级（性能 / 数据一致性 / 约定）

### 2. 翻译缓存全量持久化代价高

**位置**：`src/utils/translation-api.ts:60`（`persistTranslationCache`）

**当前代码**：

```ts
function persistTranslationCache(): void {
    try {
        getDbStorage().setItem(
            TRANSLATION_CACHE_STORAGE_KEY,
            Array.from(translationCache.entries())
        );
    } catch (e) {
        log.w?.('保存翻译缓存失败', e);
    }
}
```

**问题**：

- 每次成功翻译触发 `schedulePersistTranslationCache()`，1s 节流后将整张 `translationCache`（最多 5000 条）一次性写入 storage。
- AI 引擎返回值含 examples、synonyms、memoryTip 等字段，单条 200–1000 字节。
- 缓存稳态下单次写入 ~1–5 MB。

**失败场景**：

- Web 端 `localStorage.setItem` 大对象同步写主线程，几十毫秒卡顿。
- uTools `utools.dbStorage.setItem` 每次重写整张表，磁盘 I/O 累积。

**修复建议**：

- 用分桶 / 增量写入：例如按 query 哈希分 N 个 key，每次只重写改动桶。
- 或者改为只写最近 K 条变更的 patch 队列，定期合并。
- 或者把缓存改为以 IndexedDB 单文档为单位，避免全量序列化。

### 3. `upReview()` 改 async 后调用点未 await

**位置**：

- `src/views/Dictation/Dictation.vue:1125, 1137, 1168`
- `src/views/Word/Word.vue:1584`

**当前代码**：

```ts
wordsStore.upReview();
```

**问题**：

- 本轮把 `upReview()` 改成 async，会保存当前词库（`saveWordBank`）并 `Promise.allSettled(addAndUpdateDbWord(...))`。
- 上述调用点没有 `await`，调用者立即继续执行（如关闭对话框、切换路由）。
- 在 store 内部 `await upReview()` 已经修好，但 view 层这些调用是真实回归点。

**失败场景**：

- 听写完成立刻退出页面 / 关 uTools，落盘还没完成 → `isReview` 状态丢失，下次打开退回。

**修复建议**：

- 全部调用点加 `await`，或者按需 `void wordsStore.upReview().catch(...)` 并接受异步落盘风险。

### 4. `console.log` 在 store 翻译入口

**位置**：`src/stores/words.ts:945`（`translateWithPlatform` / `translateBatchWithPlatform` 包装内）

**当前代码**：

```ts
console.log('store翻译调用, 当前平台:', currentTranslationPlatform.value, '查询词:', query)
console.log('store批量翻译调用, 当前平台:', currentTranslationPlatform.value, '数量:', queries.length)
```

**问题**：

- CLAUDE.md 明确说明：生产构建用 esbuild `pure: ['log.d', 'log.i']` 剥离调试日志。
- `console.log` 不在剥离名单内，会在生产 uTools/Electron/Web 中持续打印。

**修复建议**：

- 改为 `log.i(...)`，与项目其它处一致。

### 5. mobile App.vue console.log/error

**位置**：`mobile/src/App.vue:12, 16-19`

**当前代码**：

```ts
console.log('App Launch')
console.log('App Show')
console.log('App Hide')
console.error('App Hide 持久化单词失败:', err)
```

**问题**：

- mobile 端真机/小程序生产包同样不会剥离 `console.*`。
- 项目桌面端已有 `log` 工具的范式，mobile 端尚未统一。

**修复建议**：

- mobile 端引入一套与桌面 `log.i/.w/.e` 等价的轻量日志工具（可在 `mobile/src/utils/logger.ts` 中重写一份）。
- 全文替换 `console.*` 为该工具。

---

## 🟡 低优先级（代码质量 / 维护性）

### 6. mobile `normalizeWordText` / `getWordKey` 重复实现

**位置**：`mobile/src/stores/useMobileWords.ts:47`

桌面 `src/utils/text-utils.ts` 已有：

```ts
export function normalizeItemText(text: string): string {
  return text.trim().replace(/\s+/g, ' ');
}
export function getItemKey(text: string): string {
  return normalizeItemText(text).toLowerCase();
}
```

mobile 再写一份命名不同但逻辑相同的版本。

**修复建议**：

- mobile 端在 `mobile/src/utils/text-utils.ts` 维护一份导出，或者两端通过 `@shared/text-utils` 共用（监控两端的 vitest alias 已经允许这种共享）。

### 7. mobile sync 重复实现 AES-GCM / base64url

**位置**：`mobile/src/subPackages/pages-tools/utils/sync.ts:197`

桌面 `src/utils/sync-server.ts` 已经有：

- `generateAesKey()`
- `encrypt(payload, key, iv)` / `decrypt(payload, key)`
- `toBase64Url()` / `fromBase64Url()`
- `importKey()` / `exportKey()`

移动端这次新增的实现与其等价。

**修复建议**：

- 抽到 `src/shared/crypto-sync.ts` 或新建 `src/utils/sync-crypto.ts`，两端共用；或者至少保证字段命名、IV 长度、key 长度一致，防止跨端拉取的 fallback 路径错位。

### 8. `nextIdTimestamp` 重复

**位置**：

- `src/utils/number-memory-entries-db.ts:12`
- `src/utils/shortcut-memory-db.ts:21`

两份实现完全一致：

```ts
let _lastIdTimestamp = 0;
function nextIdTimestamp(): number {
  const now = Date.now();
  _lastIdTimestamp = now > _lastIdTimestamp ? now : _lastIdTimestamp + 1;
  return _lastIdTimestamp;
}
```

**修复建议**：

- 抽到 `src/utils/id-util.ts`，对外暴露 `nextIdTimestamp()`。
- 注意：这是模块级递增计数器，跨多个模块共用时要再确认是否真的需要全局单调，还是每类资源独立。当前两边都只用于本地 _id 防撞，全局共用一份单调器更安全。

### 9. `str-util.ts` 运行时探测属死代码

**位置**：`src/utils/str-util.ts:219`

```ts
const batchResults: TranslationResult[] = typeof (wordsStore as any).translateBatchWithPlatform === 'function'
    ? await (wordsStore as any).translateBatchWithPlatform(wordsToProcess)
    : await Promise.all(wordsToProcess.map(wordText => wordsStore.translateWithPlatform(wordText)));
```

**问题**：

- store 现在永远暴露 `translateBatchWithPlatform`，三元式右半永远不会执行。
- fallback 路径 `Promise.all(map(translateWithPlatform))` 对非 AI 平台无任何节流，反而比当前主路径更危险。

**修复建议**：

- 删除 fallback，直接调用 `wordsStore.translateBatchWithPlatform()`。
- 同时把 store 的方法类型显式化，去掉 `as any`。

### 10. `importWords` 把空文本算作重复

**位置**：`mobile/src/stores/useMobileWords.ts:197`

```ts
const normalizedWord = normalizeWordText(word.word)
if (!normalizedWord) {
  duplicateInImportCount++
  continue
}
```

**问题**：

- 上层 `wordbank-a/b/c/d/level8` 等导入页面用 `skippedCount` 提示用户“N 条已存在”。
- 空文本/纯空格条目被归入“已存在”，与“真重复”混在一起，掩盖了源数据有脏数据的事实。

**修复建议**：

- 拆出 `invalidCount`，让 UI 区分“跳过的重复”与“跳过的非法数据”。
- 或者直接静默丢弃但记录 `log.w('importWords 忽略空文本条目')`。

---

## 验证情况

- 上一轮所有修改：`npm run test:run` 通过（1222/1222），`npm run type-check` 通过。
- 本次审查只读，未修改任何文件。
- 当前工作区改动仍待提交。

## 建议下一步

按收益/风险排序，建议：

1. 修 #1：恢复非 AI 平台分级并发限制（30 分钟）。
2. 修 #3：补 await（10 分钟）。
3. 修 #4 / #5：把 `console.*` 换成 `log.*`（20 分钟，可放一个 commit）。
4. 修 #2：缓存分桶或者写改 patch 队列（1–2 小时，更稳的方案）。
5. 修 #9 / #10：纯清理（10 分钟）。
6. 修 #6 / #7 / #8：抽公共模块（1 小时，跨端共享，要小心测试）。

文档生成完成，未做任何代码修改。
