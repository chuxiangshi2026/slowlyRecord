# 代码审查问题整改与复核方案

> 建立日期：2026-11-26
>
> 状态：待整改；本文件记录本次代码审查确认的问题、修复方案、验证要求和发布门禁。
>
> 关联文档：[质量把控流程](./quality-control-process.md)、[代码审查标准](./code-review-standard.md)、[代码规范](./coding-standard.md)、[2026-11-25 复查清单](./bug-list-2026-11-25.md)。

> **后续安排更新（2026-11-26）**：用户决定密钥工作暂时收口，本轮不轮换、不改配置，也不将密钥专项作为晚间验收的中断条件。小程序实机验收移至晚间，由执行代理按[晚间验收与后续工作计划](./night-validation-plan-2026-11-26.md)执行；局部环境阻塞时继续其他检查，最后集中报告。下文保留原审查发现、关闭条件和历史结论，不表示密钥专项已关闭，也不表示当前版本已获发布结论。

> **商店提审收口更新（2026-11-26）**：域名、匿名统计、权限说明、隐私文案、版本和商店产物的下一阶段实施统一见[《uTools 商店审核与匿名统计收口计划》](./utools-store-review-hardening-plan-2026-11-26.md)。该计划只作为实施与验收依据，不改变本文件对当前工作区“修改后复审”的结论。

## 1. 文档目的与结论口径

本文件用于跟踪本次全量代码质量复核发现的问题，避免把“自动化测试通过”误认为“没有缺陷”，也避免把旧审查记录中的已整改结论直接复用于当前工作区。

本次复核对象是当前工作区，不是单一提交。当前工作区存在大量未提交改动，因此每次修复后必须重新确认最终 diff、重新运行受影响检查，并以最终代码和最终构建产物为准。

当前总评：**修改后复审**。

在以下问题关闭前，不得宣称代码审查通过，也不得作为最终发布依据：

1. 源码中的真实 API 凭证已轮换并移除；
2. 密钥日志已删除或脱敏；
3. 移动端文本记忆分片读取已修复并有回归测试；
4. 单词内容同步不会覆盖本地学习状态；
5. 移动端重复脚本键已清理；
6. 适用平台的最终构建和人工场景已重新确认。

## 2. 本次复核基线

### 2.1 已通过的自动检查

以下结果针对本次复核时的工作区：

```text
npm run test:run                                      通过：224 个测试文件，3498 个用例
npm run type-check                                    通过
npm run type-check:mobile                             通过
npm --prefix mobile run type-check:test               通过
npm run build:web                                     通过
npm run build:electron                                通过
npm run build:mp-weixin                               通过
npm run build:store                                   通过
npx vitest run mobile/src/stores/useTextMemory.test.ts \
  mobile/src/stores/useMobileWords.test.ts \
  src/utils/user-set-db-util-store.test.ts \
  src/app-enter.test.ts                               通过：4 个文件，75 个用例
git diff --check                                     通过
```

### 2.2 商店版构建确认

`npm run build:store` 已重新执行，以下剥离闸门通过：

- 内置密钥从商店产物中置空；
- preload 标记段已剥离；
- Bing 网页版特征已剥离；
- 内置诗词英译和受保护内容已剥离；
- 商店产物未发现内置密钥、Bing 网页版特征和内置诗词英译。

注意：商店构建闸门通过，不等于源码安全。源码中的真实凭证仍可能出现在 Git 工作区、Git 历史、非商店构建或日志中，必须单独处理。

### 2.3 当前结论不能升级为“通过”的原因

- 已确认存在高风险安全问题和主要功能问题；
- 相关回归测试尚未覆盖原始失败场景；
- 未完成 uTools、Electron、微信开发者工具和 Android/真机人工验证；
- 构建仍有 `lang-core.js` module 声明和动态导入拆包警告；
- `mobile/package.json` 存在重复脚本键。

## 3. 问题与整改方案

### R1 [Blocker] 源码存在真实 API 凭证

**位置**

- `src/config.ts:7-18`
- `src/config.ts:49`
- `src/config.ts:58-59`
- `src/config.ts:86`
- 以及同类配置项

**确认依据**

源码中存在真实服务凭证。`npm run build:store` 会在构建阶段将其置空，且商店产物闸门通过，但源码和普通非商店构建仍然存在泄露面。

**影响**

- Git 工作区或历史提交泄露凭证；
- 非商店 Web/Electron/uTools 构建可能携带凭证；
- 第三方 API 被盗用、产生费用或被封禁；
- 删除当前文件不能清除 Git 历史中的凭证。

**修复方案**

1. 立即在各服务商后台轮换已暴露凭证；
2. 从 `src/config.ts` 移除真实凭证，只保留空值、环境变量读取或本地开发配置；
3. 开发环境使用不入库的 `.env.local`、系统环境变量或本地密钥注入方式；
4. 保持商店构建默认无内置凭证；
5. 检查 Git 历史，必要时使用凭证清理工具清理历史并通知协作者重新拉取；
6. 增加提交前静态门禁，检测常见 appkey、secret、token、AKID、JWT 和服务商密钥格式；
7. 检查构建产物、源码 sourcemap、测试快照和日志，确认没有凭证残留。

**禁止的修复方式**

- 只依赖 `build:store` 的剥离脚本；
- 只删除当前文件而不轮换已暴露凭证；
- 将凭证移到另一个会提交的源码文件；
- 用混淆、Base64 或字符串拼接代替真正的密钥管理。

**修复后验证**

```bash
npm run build:store
npm run build:web
npm run build:electron
grep -RInE 'AKID|appkey|secret|token|sk-|AIza|Bearer ' src public electron dist dist-web dist-electron
```

验证要求：

- 生产构建和商店产物均无真实凭证；
- 源码中只允许配置读取逻辑和测试占位符；
- Git 历史处理结果有记录；
- 轮换后的凭证不再出现在任何日志、测试输出和发布包中。

**关闭条件**：轮换、源码移除、历史风险处理、静态门禁和构建扫描全部有证据后，才可关闭 R1。

---

### R2 [Major] OCR/API 密钥进入日志

**位置**

- `src/stores/words.ts:662`
- `src/stores/words.ts:669`
- `src/stores/words.ts:676`
- `src/stores/words.ts:678`
- `src/stores/words.ts:681`
- `src/stores/words.ts:683`
- `src/views/Word/components/settings/ApiKeySection.vue:210`

**确认依据**

当前日志调用把 `appkey`、`key` 以及包含 `keys`、`ocrKeys` 的完整 `userSet` 作为参数传入日志函数。即使生产构建会删除部分 info 日志，开发环境、测试环境、调试面板和异常收集仍可能看到敏感值。

**修复方案**

删除敏感日志，只保留字段是否配置和服务商名称，例如：

```ts
log.i('OCR 密钥配置已更新', {
  provider,
  hasAppkey: Boolean(appkey),
  hasKey: Boolean(key),
})
```

禁止向日志传入：

```text
appkey、key、secret、token、userSet、keys、ocrKeys
```

同时检查：

- 错误对象是否包含完整配置对象；
- 调试面板是否收集日志参数；
- 统计和异常上报是否可能带出配置；
- 测试失败输出是否打印用户设置。

**修复后验证**

```bash
grep -RInE 'log\.[diwe]\([^\n]*(userSet|keys|ocrKeys|appkey|secret|token)|console\.[a-z]+\([^\n]*(userSet|keys|ocrKeys|appkey|secret|token)' src --include='*.ts' --include='*.vue'
npx vitest run src/utils/user-set-db-util-store.test.ts src/utils/local-backup.test.ts
npm run test:run
```

验证要求：

- 密钥设置、读取、同步、备份和恢复测试通过；
- 日志静态扫描不再命中密钥值或完整配置对象；
- 手动设置一次 OCR/API 密钥，检查控制台、DebugPanel、错误上报和同步请求体均无明文密钥。

**关闭条件**：敏感日志删除/脱敏，静态检查和一次真实设置密钥场景均通过。

---

### R3 [Major] 移动端文本记忆分片写入后重新加载为空

**位置**

- `mobile/src/stores/useTextMemory.ts:60-74`
- `mobile/src/stores/useTextMemory.ts:77-80`
- `mobile/src/stores/useTextMemory.ts:139-158`
- `mobile/src/adapters/index.ts:214-307`

**确认依据**

写入使用 `MiniProgramDbAdapter.put()`。文档超过 `MAX_CHUNK_BYTES = 900 * 1024` 后会被拆分到多个 Storage Key，主键只保存分片元数据。

但 `readDoc()` 直接调用：

```ts
uni.getStorageSync(STORAGE_KEY)
```

没有使用适配器已有的 `get()`、`getAsync()`、`readWithChunksSync()` 或 `readWithChunksAsync()`。重新创建 Store 或重新进入页面后，读取到的只有 `_chunks` 和 `_chunkKeys`，于是 `articles`、`notes`、`prompts` 被回退为空数组。

**修复方案**

统一文本记忆的读写路径：

1. 不再绕过 `MiniProgramDbAdapter` 直接读取主键；
2. `readDoc()` 使用同一适配器的 `get()` 或 `getAsync()`；
3. 若保持同步 Store API，使用 `get()`；若允许异步初始化，使用 `getAsync()` 并在 `load()` 中等待；
4. 保留旧的非分片文档兼容；
5. 分片不完整、JSON 损坏或读取失败时给出可见错误，不静默清空用户数据；
6. 检查文章、笔记和提示三类数据的共同读取路径。

**修复后回归测试**

必须新增或更新测试，验证：

1. 写入小文档后可以读取；
2. 写入超过 900 KB 的文章集合后生成分片；
3. 重新创建 Store 或清空内存状态；
4. 调用 `load()`；
5. 文章、笔记、提示数量和关键字段与写入前一致；
6. 删除或损坏一个分片时不会静默显示为空；
7. 旧版本未分片文档仍可读取；
8. 小程序真实 Storage 环境至少完成一次验证。

**建议测试命令**

```bash
npx vitest run mobile/src/stores/useTextMemory.test.ts
npm run test:run
npm run type-check:mobile
npm run build:mp-weixin
```

**关闭条件**：回归测试能在修复前失败、修复后通过；真实微信开发者工具或小程序环境完成一次分片写入/重载验证。

---

### R4 [Major 候选] 内容同步可能覆盖本地学习状态

**位置**

- `mobile/src/stores/useMobileWords.ts:752-800`

**确认依据**

当前逻辑用同一个 `updatedAt` 同时判断内容更新和学习进度更新：

```ts
const remoteLearnTime = remote.updatedAt || remote.lastReviewTime || 0
const localLearnTime = existing.updatedAt || existing.lastReviewTime || 0
```

当远端只带内容字段但 `updatedAt` 较新时，代码仍可能进入学习字段合并分支，并将远端缺少的学习字段写成 `undefined`。

该风险需要用最小输入和真实 Store 测试最终确认，不能仅凭模型判断关闭。

**最小复现输入**

本地词条：

```ts
{
  id: 'x',
  word: 'apple',
  meaning: '旧',
  level: 8,
  remembered: false,
  needsReview: true,
  lastReviewTime: 100,
  nextReviewTime: 999,
  reviewCount: 5,
  updatedAt: 100
}
```

远端只提供内容更新：

```ts
{
  id: 'x',
  word: 'apple',
  meaning: '新',
  updatedAt: 200
}
```

**修复方案**

优先采用以下规则之一，并在代码中保持明确：

- 只有远端明确包含学习字段时，才合并学习字段；或者
- 将 `contentUpdatedAt` 和 `learningUpdatedAt` 分成独立字段，并对旧数据提供兼容迁移；或者
- 对每个学习字段使用存在性判断，缺失字段不得覆盖本地值。

不建议继续使用单一 `updatedAt` 推断两个不同语义的更新时间。

**修复后回归测试**

至少覆盖：

1. 远端只有内容更新，本地学习状态完整，学习状态必须保留；
2. 远端内容和学习状态都更新，二者均正确合并；
3. 远端整体较旧，本地内容和学习状态均不被覆盖；
4. 旧数据只有 `lastReviewTime` 时仍兼容；
5. 答错降级后的学习状态可以同步到另一端；
6. 缺失字段、`null`、`undefined` 和零值的区别正确。

**关闭条件**：最小复现已确认结果；若确认存在覆盖，修复并补回归测试；若确认不存在，保留测试证明和结论，不得只写“未复现”。

---

### R5 [Minor] 移动端 package.json 存在重复脚本键

**位置**

- `mobile/package.json:6-7`
- `mobile/package.json:19-20`

**确认依据**

`type-check` 和 `type-check:test` 各定义了两次，构建工具已经输出 Duplicate key 警告。当前两组值相同，因此暂未改变执行结果，但配置依赖后者覆盖前者。

**修复方案**

删除后半段重复键，只保留一组脚本定义。不要顺便调整无关脚本或升级依赖。

**修复后验证**

```bash
node -e "const p=require('./mobile/package.json'); console.log(Object.keys(p.scripts))"
npm run type-check:mobile
npm --prefix mobile run type-check:test
npm run build:mp-weixin
```

验证要求：构建日志不再出现 `Duplicate key "type-check"` 和 `Duplicate key "type-check:test"`。

---

### R6 [Nit] 密钥加密注释与实际行为不一致

**位置**

- `src/utils/secret-crypto.ts:1`

**确认依据**

注释写成“仅 uTools 商店版启用”，但当前代码已用于桌面端统一密钥加密。

**修复方案**

更新注释，准确说明：

- 哪些平台启用；
- 密钥在同步、备份和本地内存中的形态；
- AES-GCM 应用级加密不能替代系统密钥环；
- 旧明文数据如何迁移。

**验证**

```bash
npx vitest run src/utils/user-set-db-util-store.test.ts src/utils/local-backup.test.ts
npm run type-check
```

这项不阻断发布，但必须随密钥安全整改一起完成，避免维护者误解安全边界。

## 4. 构建警告与性能跟踪项

以下不是本次已确认的功能缺陷，但必须在发布前完成评估。

### P1. `lang-core.js` 未声明为 module

构建警告：

```text
<script src="lang-core.js"> in "/index.html" can't be bundled without type="module" attribute
```

处理要求：确认该脚本是普通外部脚本还是应由 Vite 打包；修正标签或明确外部资源策略，并在 Web、Electron 和商店构建中验证实际加载。

### P2. 动态导入同时被静态导入，无法拆包

涉及模块包括：

- `src/utils/translation-api.ts`
- `src/utils/wordbank-manager.ts`
- `src/adapters/platform.ts`
- `src/utils/user-set-db-util.ts`
- `src/utils/sync-manager.ts`
- `src/utils/local-dictionary.ts`

处理要求：

1. 不要为了消除警告盲目重构；
2. 先记录首屏体积和冷启动耗时；
3. 确认首页实际不需要的模块后再调整依赖；
4. 重点验证微信小程序和 Android 首页白屏/慢启动问题；
5. 用构建产物和真实启动数据证明优化有效。

## 5. 修复后的统一验证流程

每个问题修复后不得只运行单文件测试，必须按下面顺序执行。

### 5.1 静态检查

```bash
git diff --check
git status --short
npm run type-check
npm run type-check:mobile
npm --prefix mobile run type-check:test
```

同时执行：

- 密钥和敏感日志扫描；
- 重复 JSON/package 脚本键检查；
- 检查是否产生临时文件、日志、截图或意外构建文件；
- 检查没有覆盖或回滚用户原有未提交改动。

### 5.2 相关回归测试

```bash
npx vitest run \
  mobile/src/stores/useTextMemory.test.ts \
  mobile/src/stores/useMobileWords.test.ts \
  src/utils/user-set-db-util-store.test.ts \
  src/utils/local-backup.test.ts \
  src/app-enter.test.ts
```

### 5.3 全量门禁

```bash
npm run test:run
npm run type-check
npm run type-check:mobile
npm --prefix mobile run type-check:test
npm run build
npm run build:web
npm run build:electron
npm run build:mp-weixin
npm run build:store
```

### 5.4 构建产物检查

```bash
node scripts/e2e/blackbox.cjs --dist dist
node scripts/e2e/blackbox.cjs --dist dist-web
node scripts/e2e/blackbox.cjs --dist dist-electron
```

若 E2E 环境不可用，必须记录具体阻塞原因，不能把未运行写成通过。

商店版必须额外确认：

- 产物无真实密钥；
- 无不允许的 Bing 网页版特征；
- 无被剥离的内置英译或受保护数据；
- preload 仍为可审查的明文文件；
- 包内无 `.map`、测试目录、`.git`、开发机路径或无关构建残留。

### 5.5 人工场景

最终代码和最终构建产物必须验证：

1. 移动端文本记忆大文档写入、退出、重新进入和读取；
2. 移动端单词内容同步不覆盖学习等级和复习时间；
3. 设置、修改、删除 API/OCR 密钥时控制台和错误上报无明文；
4. uTools 截图成功、取消、超时、空 OCR 和异常时主窗口均恢复；
5. Electron 文件选择、保存和取消路径；
6. 微信小程序开发者工具首次启动、热启动、网络慢和大数据加载；
7. Android 冷启动、低性能设备、无网络和升级旧数据场景；
8. 商店构建安装后首页、翻译、OCR、同步和备份关键路径。

## 6. 最终复审记录模板

整改完成后在本节填写，不得提前勾选：

```text
整改版本/提交：工作区（未提交）
整改日期：2026-11-26
实施者：开发者 + AI 代理
复审者：AI 代理（待人工复核）
```

### 6.1 整改状态（2026-11-26）

| 编号 | 问题 | 状态 | 实施内容 |
| --- | --- | --- | --- |
| R1 | 源码真实凭证 | 源码已整改；后续专项暂停 | `src/config.ts` 与 `mobile/src/config.ts` 的源码密钥已移除，改为 `VITE_*` 环境变量构建期注入；新增 `env.example` 与忽略规则。2026-11-26 用户决定密钥可控、工作暂时收口；本轮不轮换、不补填本地配置，不作为晚间验收中断条件 |
| R2 | 敏感日志 | 已整改 | `src/stores/words.ts` `setOcrApiKey` 全部敏感日志改为布尔摘要；`ApiKeySection.vue` `updateOcrKey` 不再打印密钥值 |
| R3 | 文本记忆分片读取 | 已整改 | `readDoc()` 改走 `MiniProgramDbAdapter.get()` 统一读分片；`load()` 对"主键存在但适配器读不出正文"给出可见 toast，不静默当空数据 |
| R4 | 学习状态同步覆盖 | 已整改 | `importWords` 合并前增加 `remoteCarriesLearning` 守卫：远端不带学习字段时不触发学习合并，且逐字段存在性拷贝，缺失字段不再写成 `undefined` |
| R5 | 重复脚本键 | 已整改 | `mobile/package.json` 删除后半段重复的 `type-check`/`type-check:test`，构建不再出现 Duplicate key 警告 |
| R6 | 过时注释 | 已整改 | `secret-crypto.ts` 头注释更新为桌面端统一加密的实际口径 |

### 6.2 回归测试新增

- `mobile/src/stores/useTextMemory.test.ts`：新增「分片写入后重新创建 store 加载，文章内容不丢失」「分片损坏时 load 不静默当作空数据」两个回归用例（修复前后者失败/前者在旧实现下会显示为空）。
- `mobile/src/stores/useMobileWords.test.ts`：新增「远端只有内容字段且 updatedAt 较新时，不覆盖本地学习状态」回归用例，修复前已验证失败（`level` 被写成 `undefined`），修复后通过。
- 依赖内置密钥的 7 个既有用例（`useUtils.test.ts`、`word-audio.test.ts`、`listen-play.test.ts`）改为 mock `@/config` 注入假密钥，不再依赖源码真实凭证，回退逻辑覆盖不变。

### 6.3 自动化命令与结果（最终代码）

```text
npm run test:run                    3501 通过（0 失败，224 文件）
npm run type-check                  通过
npm run type-check:mobile           通过
npm --prefix mobile run type-check:test  通过
npm run build:web                   通过
npm run build:electron              通过
npm run build:mp-weixin             通过（无 Duplicate key 警告）
npm run build:store                 通过（剥离闸门全部通过）
git diff --check                    通过
密钥扫描（源码 src/mobile/electron/public/scripts）   无命中
密钥扫描（dist/dist-web/dist-electron/mobile dist）   无命中
敏感日志扫描（log/console + userSet|keys|ocrKeys|appkey|secret|token）  仅剩 get-api-key.ts「已设置/未设置」布尔输出（非敏感）
```

### 6.4 人工场景与剩余风险

已验证：上述全部自动化门禁针对整改后最终代码执行。

仍未覆盖（发布前需人工/实机确认）：

1. **密钥专项（本轮暂停）**：旧密钥已在源码删除；历史记录中的轮换与历史处理事项按用户决定暂不继续，不要求晚间执行代理轮换或补填配置；
2. uTools 真机入口与截图/划词链路（`src/app-enter.test.ts` 已通过，但 fake 宿主不替代实机）；
3. 微信开发者工具中真实 Storage 的分片写入/重载（单测以 mock storage 验证）；
4. Android 真机首页冷启动与小程序启动速度（构建警告中的动态导入拆包问题未动）；
5. Electron 真实文件选择/保存。

剩余风险与接受人：动态导入拆包警告维持现状（性能跟踪项，见第 4 节），发布者确认。

原审查结论：修改后复审。2026-11-26 后续范围调整：密钥专项按用户决定暂停；晚间执行验收与证据收口，不以此暂停整批任务，也不提前升级为发布通过。

只有满足以下条件，最终结论才可写“通过”：

- R1、R2、R3 关闭；
- R4 已确认并关闭，或由负责人明确接受并记录风险；
- R5 已清理；
- 必跑测试、类型检查、受影响构建和适用 E2E 全部针对最终代码通过；
- 关键人工场景有实际证据；
- 未验证项、剩余风险和发布范围明确；
- 最终 diff 不含真实密钥、调试输出、临时文件和无关改动。

## 7. 与旧问题清单的关系

`docs/bug-list-2026-11-25.md` 是上一轮审查记录，其中的“已整改”描述不能替代本次复核。若旧清单与本文件结论冲突，以本文件基于当前代码和当前命令结果重新确认的结论为准；旧清单应在本轮整改完成后重新更新状态，而不是直接保留“全部通过”的表述。
