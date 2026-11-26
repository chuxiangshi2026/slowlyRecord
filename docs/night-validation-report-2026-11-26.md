# 2026-11-26 晚间验收报告

> 执行方式：定时任务触发的主执行代理 + 1 个只读复核子代理（复核记录：`test-results/night-validation-2026-11-26/20261126-1900/review.md`）。
>
> 计划日期：2026-11-26；实际执行日期：2026-11-26 19:17–21:5x（Asia/Shanghai）。
>
> 运行编号：`20261126-1900`；证据目录：`test-results/night-validation-2026-11-26/20261126-1900/`。
>
> 计划依据：`docs/night-validation-plan-2026-11-26.md` 第 11 节任务书。

## 1. 结论摘要

**本轮为部分完成，不能宣称全平台验收通过，不可作为发布依据。**

- 自动化门禁全部通过：全量测试 225 文件 / 3513 用例、三组类型检查、`git diff --check`。
- 四份构建全部成功：uTools 普通构建、Web、Electron、商店构建；商店剥离闸门全部通过。
- 三端浏览器 E2E 各 47/47 通过（使用 Windows Edge）。
- 小程序生产构建成功并在微信开发者工具模拟器中渲染 onboarding → 首页，但 **MP02–MP12 场景矩阵未执行**（无自动化通道），真机全部未验证。
- 预览码已生成并终端打印，但用户未确认扫码，且已过期（约 30 分钟有效）。21:52 已重新生成一份新码（同样约 30 分钟有效）。
- **验收期间工作区发生变动**：并行会话在 21:32 修改了 7 个文件并新增 2 个文件（见第 14 节）。本轮测试/构建/E2E 对应 19:17–20:39 的基线；已有构建产物按计划 §9.7 视为旧基线，任何发布决定前必须在当前工作区重跑门禁。

## 2. 基线与环境

| 项目 | 值 |
| --- | --- |
| HEAD | `f751c524f1f606bd16e2417e0a9b364639e0d3c7` |
| 工作区 | 108 行 `git status --short`，86 文件改动（+1639/−647），含未提交改动 |
| 基线哈希 | 1064 个受检源码/配置/测试文件 SHA-256（`baseline-hashes.txt`） |
| 环境 | WSL2 / node v22.22.3 / npm 10.9.8 / 8 核 / 可用内存 5.3Gi |
| 微信开发者工具 | 2.02.2609250 Stable，已登录（`islogin: {"login":true}`），安装于 `D:\Program Files (x86)\Tencent\微信web开发者工具` |
| 并行进程 | Codex CLI（pid 1104810）全程 idle，构建前后复查无并发构建；未发生构建产物互写 |
| 密钥专项 | 按用户决定暂停：未轮换、未改配置、未补 `.env.local` |

## 3. A：能力矩阵终值

| 能力 | 结果 | 证据 |
| --- | --- | --- |
| 本地测试 / 构建 | 可用 | B/E 日志 |
| 无头浏览器 | 可用（Edge，`--chrome`） | 三端 E2E 47/47 |
| 微信开发者工具 | 已连接（GUI，已登录） | 打开生产构建副本 `mp-project`，编译成功 |
| 小程序模拟器自动化 | 不可用 | 无自动化通道：uni-automator 需 uni 编译插桩；devtools automation 未接通 |
| 手机真机自动化 | 未执行 | 无设备通道；预览码未扫码 |
| 音频输出取证 | 不可用 | WSL 无声卡；实际听感未验证 |
| 预览上传通道 | 可用 | 20:07 预览上传成功，无 `invalid ip` |

## 4. B：自动门禁

| 检查 | 结果 |
| --- | --- |
| `npm run test:run` | 225 文件 / 3513 用例通过（exit 0，48s） |
| `npm run type-check` | 通过 |
| `npm run type-check:mobile` | 通过 |
| `npm --prefix mobile run type-check:test` | 通过 |
| `git diff --check` | 通过 |

测试告警单独统计（按计划 §6）：`Failed to resolve component` 997 行、`Vue warn` 1040 行；测试通过但告警存在，本轮未为此改业务代码。

## 5. C：微信小程序

### 5.1 构建与包体

`npm run build:mp-weixin` exit 0（19:20:54）。产物 `mobile/dist/build/mp-weixin`：556 文件，4,291,629 B。

| 包 | 字节 | 说明 |
| --- | --- | --- |
| total | 4,049,965 B（3.86 MiB） | 按 app.json 分包统计口径 |
| 主包（近似） | 1,695,351 B（1.62 MiB） | 低于 2 MiB 主包上限 |
| subPackages/pages-memory | 1,235,019 B | 最大分包 |
| subPackages/pages-knowledge | 830,975 B | |
| subPackages/pages-tools | 245,185 B | |
| subPackages/pages-data | 43,435 B | |

> 注：total 与单文件总大小差异来自 `project.config.json`/`theme.json` 等根配置文件计入方式，明细见 `mini-program/package-size.txt`。

### 5.2 模拟器验证（生产构建副本）

在微信开发者工具中打开生产构建的隔离副本（Windows 临时目录，运行后已删除；WSL 内证据副本 `mp-project/`）：

- 首次启动渲染 onboarding 页（非白屏），点击「跳过」进入首页；
- 首页渲染词库空态、统计卡片、底部 tab；
- 控制台显示 `preloadSubpackage: subPackages/pages-tools`、`subPackages/pages-data` 预加载成功；
- 截图：`mini-program/simulator-onboarding.jpg`、`mini-program/simulator-home.jpg`（全屏截图，含桌面）。

### 5.3 场景矩阵

| 编号 | 状态 | 说明 |
| --- | --- | --- |
| MP01 | 部分通过 | 仅验证首次启动渲染 + 进入首页；导入→3 次判定→重进保留未执行 |
| MP02 | 未执行 | 无自动化通道；分片读取逻辑仅由 `useTextMemory.test.ts` 单测覆盖，不等于真实 storage 验收 |
| MP03 | 未执行 | 破坏性隔离场景需自动化通道，未执行 |
| MP04 | 未执行 | 学习进度合并仅由 `useMobileWords.test.ts` 单测覆盖 |
| MP05 | 未执行 | 翻译/兜底链路未在模拟器操作 |
| MP06 | 未执行 | OCR/相册/拍照入口未操作 |
| MP07 | 未执行 | 长音频播放与退出行为未测 |
| MP08 | 未执行 | 多语种发音未测 |
| MP09 | 未执行 | 主题切换/底部 sheet 未操作 |
| MP10 | 未执行 | 手势行为未测（GUI 点击未映射真机触控） |
| MP11 | 未执行 | 跨天打卡未测（不改系统时间） |
| MP12 | 部分通过 | 模拟器冷启动首屏可交互、无白屏/无限 loading；弱网、后台唤醒未测 |

阻止原因：本机无可用的小程序自动化通道（uni-automator 需要 uni 编译插桩流程；devtools 自动化端口未接通），GUI 只能做少量冒烟点击。

## 6. D：预览码

- 20:07 预览上传成功，生成 `mini-program/preview-1795694834283.png`（470×470，实际为 JPEG 字节）。
- 标准解码库（qrcode-reader + jimp）反解失败：`Error.checkAndNudgePoints`（白边、灰度、二值化、放大均失败）。
- 回退：对预览图做像素网格采样（41 模块，modulePx=10，score=1.000），渲染纯文本二维码到 `mini-program/preview-qr-ascii.txt`（脚本 `mini-program/render-qr-ascii.cjs`，日志 `logs/render-qr-ascii.log`）。
- 限制：终端二维码由原图采样重建，未经机器解码校验，可扫性需用户扫码确认；用户未确认扫码，二维码已过期（30 分钟有效）。详细说明见 `logs/preview-failure-note.txt`。

## 7. E：桌面 / Web / uTools / 商店

| 项目 | 结果 |
| --- | --- |
| `npm run build`（uTools） | exit 0 |
| `npm run build:web` | exit 0 |
| `npm run build:electron` | exit 0 |
| E2E `dist`（uTools 渲染产物） | 47/47 通过 |
| E2E `dist-web` | 47/47 通过 |
| E2E `dist-electron` | 47/47 通过 |
| `npm run build:store`（最终收尾） | exit 0，剥离闸门通过 |

- E2E 浏览器：Windows Edge（`--chrome`）；Puppeteer 自带 Chrome 缺失，下载超时，详见重试记录。
- 商店闸门：产物不含内置密钥、Bing 网页版特征与内置诗词英译；preload 标记段已剥离。
- 产物哈希（store 构建后的当前 dist）：`environment/build-artifacts.sha256`。
- 构建警告按计划保留：`lang-core.js` 非 module 警告、动态/静态导入并存导致拆包失效（多模块），未为消除警告重构。
- 三端 E2E 截图逐字节一致（同一应用同一路由），产物身份依据 `report.json` 的 `dist` 字段与构建日志，而非截图。

## 8. 缺陷与异常清单

| 级别 | 项 | 状态 | 证据 |
| --- | --- | --- | --- |
| 待验证/低 | E2E `word` 页出现 1 条 `console.error: ... 404 (Not Found)`，无资源名（疑似 favicon） | 三端一致复现，未定位 | `*/report.json`、`logs/e2e-*.log` |
| 已知/低 | `lang-core.js` 非 module 打包警告 | 三端构建均有，未改 | `logs/build-*.log` |
| 已知/低 | 动态导入同时被静态导入，拆包失效（shortcut-memory-db、wordbank-manager、local-dictionary、platform、translation-api 等） | 既有性能跟踪项，未改 | `logs/build-*.log` |
| 工具链/低 | qrcode-reader 无法解码预览二维码 | 已回退像素采样；可扫性待用户确认 | `logs/preview-failure-note.txt` |
| 观察 | 三端 E2E 截图逐字节一致 | 正常现象，仅说明不能靠截图区分产物 | report.json dist 字段 |

本轮未发现可确认的业务功能缺陷（场景矩阵未执行的部分不能据此判定通过）。

## 9. 未执行 / 受阻项

1. **真机全部场景**：无设备通道，预览码未扫码；需设备接入或用户扫码后另行验收。
2. **MP02–MP11 场景矩阵**：无小程序自动化通道；需要接入 uni-automator 插桩流程或 GUI 人工走查。
3. **音频输出取证**：WSL 无声卡，实际听感未验证。
4. **uTools 宿主实机链路**（截图/划词/超级面板）：本轮仅浏览器 E2E，未在 uTools 运行环境验证。
5. **Electron 原生文件选择/保存/取消**：未验证。
6. **Android/iOS/抖音**：按计划仅维持构建支持，未安排巡检。

## 10. 重试记录

- E2E 首轮（20:09）三组 exit=2：Puppeteer Chrome 缺失（ver.150.0.7871.24 缓存残缺）。
- 安装 Chrome 两次失败（目录残缺报错、900s 下载超时）。
- 改用 Windows Edge（`--chrome`）后 20:29 三组全部 47/47 通过。原始失败日志已被成功重跑覆盖，补记于 `logs/e2e-first-attempt-failure.txt`。

## 11. 证据索引

```
baseline-head.txt / baseline-status.txt / baseline-diff-stat.txt / baseline-hashes.txt
environment/env.txt / capability.md / build-artifacts.sha256
logs/test-run.{log,status} / type-check*.log / type-checks.status / git-diff-check*
logs/build-{utools,utools-rebuild,web,electron,store,store-final}.log / e-phase.status
logs/e2e-{utools,web,electron}.log / e2e-edge.status / e2e-first-attempt-failure.txt
logs/preview.log / render-qr-ascii.log / preview-failure-note.txt
mini-program/package-size.txt / simulator-onboarding.jpg / simulator-home.jpg
mini-program/preview-1795694834283.png / preview-qr-ascii.txt / preview-terminal.cjs / render-qr-ascii.cjs
utools-renderer/ web/ electron-renderer/（各 report.json + 18 张截图）
review.md（只读复核子代理）
```

## 12. 下一步与后续排期

1. **预览确认**：如需真机预览，重新生成预览码并扫码；过期即重生成。
2. **真机/模拟器场景矩阵**：另行安排设备通道或接入 uni-automator 插桩流程，按 MP01–MP12 补验。
3. **商店收口计划**：晚间验收完成后如需准备 uTools 商店重新提审，另行执行 `docs/utools-store-review-hardening-plan-2026-11-26.md`；本轮不自动开始。
4. **提交拆分建议**（不实际 add/commit/push，且不含密钥专项）：
   - 小程序数据与体验：`mobile/src/stores/*`（useMobileWords/useSignin/useTextMemory/useUtils）、`mobile/src/pages/*`、`mobile/src/subPackages/*`；
   - 桌面存储/同步/备份：`src/utils/{local-backup,sync-file,sync-manager,sync-server,user-set-db-util}.ts`、`src/adapters/*`；
   - 入口/翻译/OCR：`src/App.vue`、`src/utils/{pic-translate,stats,wordbank-manager}.ts`、`src/views/{Word,Translate}/*`；
   - 项目规范与文档：`AGENTS.md`、`CLAUDE.md`、`.gitignore`、`package.json`、`mobile/package.json`、`docs/*`。

## 13. 复核意见采纳情况

只读复核子代理提出：预览码解码失败未说明、MP 矩阵缺失、checkpoint 过期、首次失败被覆盖、产物身份未固定、告警未统计、交付文档缺失。
本轮已处理：补 `preview-failure-note.txt` 与 `render-qr-ascii.cjs` 留痕；补首次失败记录；补告警统计与产物哈希；重写 checkpoint；MP 矩阵如实标注未执行；本报告与计划执行记录已落地。
仍未消除：二维码未经机器解码校验、真机与场景矩阵未执行——如实保留为缺口。

## 14. 验收后工作区变动（重要，2026-11-26 21:32）

验收证据复核完成（20:39，1064 个文件哈希全部匹配）后，并行的另一会话在 21:32 修改了工作区：

- 修改：`src/App.vue`、`src/views/Word/Word.vue`、`src/config.ts`、`src/utils/stats.ts`、`scripts/strip-store-forbidden.cjs`、`mobile/src/utils/remote-wordbank.ts`、`mobile/src/utils/remote-wordbank.test.ts`
- 新增（未跟踪）：`src/utils/stats-notice.ts`、`src/utils/stats-notice.test.ts`

影响与处理：

1. 本轮全部测试、类型检查、构建与 E2E 结果对应的是 19:17–20:39 的基线，不是当前工作区。
2. 按计划 §9.7，已有构建产物标记为旧基线；发布前必须在当前工作区重跑受影响检查与构建。
3. 本轮结论（部分完成）不变，但不能引用本轮 E2E/构建结果证明当前工作区可用。
4. 后续如需在本轮证据基础上继续，应先重新固定基线并记录新的哈希清单。

## 15. 预览码补生成（21:52）

D 阶段第一枚预览码已过期，21:52 重新上传生成 `mini-program/preview-1795701158583.png` 并重渲染终端二维码（41 模块，score 1.000），有效期约 30 分钟；扫码状态以用户实际操作为准。
