# 2026-11-27 发布前收尾执行报告

- **实际开始 / 结束**：2026-11-27 10:20:52 / 11:03（Asia/Shanghai）
- **最终 commit**：`d6183152bf7becd4e809cf2174902a015ce4c6c5`（master），root 1.3.13 / mobile 1.1.7
- **执行范围**：`docs/next-closeout-plan-2026-11-27.md` 的 P0 + 证据/文档收口；未改业务代码、未提交、未推送、未提审
- **证据目录**：`test-results/next-closeout-2026-11-27/20261127-1020/`

## 1. 基线和工作区

- HEAD 与计划参考基线一致；`HEAD^{tree}=b5e1abf6…`，`src`、`mobile/src`、`public`、`scripts`、`electron` 的 tree 哈希已记录（`baseline/hashes.txt`）。
- 工作区仅：`docs/night-validation-*.md` 修改、`private-docs` 子模块指针、未跟踪 `.claude/`、`.kimi-code/`、`agent/`、`docs/next-closeout-plan-2026-11-27.md`；**无业务源码 diff**。
- `git diff --check` 通过。
- 产物身份复现 01:05 记录（文件数/字节数/index sha256 全部一致）：
  - `dist` 488 / 28,541,342 B / `3b7cdd5a…`（商店版）
  - `dist-web` 3953 / 122,828,748 B / `46463e83…`
  - `dist-electron` 3917 / 122,602,942 B / `958a3b45…`
  - `mobile/dist/build/mp-weixin` 556 / 4,296,128 B
- 结论：无需重建，构建身份与当前源码一一对应。

## 2. 自动门禁、构建与 E2E

| 项目 | 结果 | 证据 |
| --- | --- | --- |
| `git diff --check` | 通过，exit 0 | `logs/git-diff-check.log` |
| `npm run test:run` | 226 文件 / 3525 用例通过，60.2s | `logs/test-run.log` |
| 桌面端 `type-check` | exit 0 | `logs/type-checks.log` |
| 移动端 `type-check` | exit 0 | 同上 |
| 移动端 `type-check:test` | exit 0 | 同上 |
| 四端构建 | 复用 01:00–01:04 构建（哈希一致） | `baseline/artifact-identity.md` |
| 商店 E2E（`dist`） | 47/47，exit 0 | `store-e2e/report.json` |
| Web E2E（`dist-web`） | 47/47，exit 0 | `web-e2e/report.json` |
| Electron 渲染 E2E | 47/47，exit 0 | `electron-e2e/report.json` |
| 相关单元回归 | 7 文件 / 187 用例通过 | `logs/mp-regression.log` |

说明：

- E2E 第一次尝试失败（puppeteer 要求 Chrome 150，缓存中只有损坏的 zip），失败日志保留在 `logs/e2e-all.log`；随后用 `--chrome` 指向 Windows Edge 重跑，三端均通过。
- 本轮补齐了此前缺失的**商店产物 E2E**（历史 01:02 的 E2E 跑在普通构建上）。
- CI：`gh` 报 “none of the git remotes … known GitHub host”，本轮**未查询到**最终 commit 的 quality/builds，不写成通过。

## 3. 微信小程序模拟器矩阵

平台：微信开发者工具 2.02.2609250 Stable，iPhone 12/13 模拟器；隔离副本 + `miniprogram-automator`（临时安装于 `/tmp/mp-auto`，未改仓库依赖）。

| 编号 | 结果 | 摘要 |
| --- | --- | --- |
| MP01 | **PASS** | 新建 `closeout-20261127` 词库，UI 添加 3 词；3 次“认识”后 `reviewCount=1`、`needsReview=false`；进程关闭重开后词条/等级/复习时间保留，无白屏 |
| MP02 | NOT_RUN | >900 KiB 文章/笔记分片未走业务链；仅 `useTextMemory`/`db-miniprogram` 单测通过 |
| MP03 | NOT_RUN | 破坏性分片移除未执行；仅单测覆盖 |
| MP04 | NOT_RUN | 导入合并链未执行；`useMobileWords` 单测覆盖合并规则 |
| MP05 | NOT_RUN | 翻译失败/重试未在模拟器验证 |
| MP06 | BLOCKED | 相机/相册需真机或可控注入 |
| MP07 | BLOCKED | 无音频采集/听感通道 |
| MP08 | BLOCKED | 同上 |
| MP09 | **PARTIAL** | 深色模式（跟随系统 → 深色）切换成功，首页/“我的”深色渲染，重启保持；错题页、诗词地图 sheet 未走 |
| MP10 | **PARTIAL** | 按钮判定单次触发、无重复写；真实触摸手势未测 |
| MP11 | **PARTIAL** | `useSignin.test.ts` 受控时钟通过；未改系统时间、未自然跨日 |
| MP12 | **PARTIAL** | 冷启动（close + re-auto）正常、数据/主题保留；弱网/离线恢复未测 |

补充：MP01 判定后 `level` 保持 1，符合 `markAsRemembered` 的“提前复习只记录练习，不提前升级”逻辑，不是丢数据。

## 4. uTools 与 Electron

### uTools：BLOCKED

- `Alt+Space` 可唤起 uTools 搜索条，但点击输入区与 `FocusWindow` 后键入均未进入搜索框（窗口随即隐藏），无法打开“uTools 开发者工具”加载隔离副本。
- 现有安装为商店版 **1.3.6**，不是本轮 1.3.13 产物；**未安装/切换/删除任何插件，未修改 uTools 配置**。
- 已准备隔离副本 `utools/plugin-copy`（`dist` 复制，移除 `plugin.json.development`，index 哈希不变），供人工加载。
- 人工步骤见 `utools/scenario-matrix.md`。

### Electron：BLOCKED（原生文件）

- 未对打包产物做原生文件对话框验收；渲染层 E2E 47/47 不能替代。
- 人工步骤见 `electron/scenario-matrix.md`。

## 5. 统计域名

- DNS：CNAME → `1258475269.ap-guangzhou.tencentscf.com`，A 106.55.90.143 / 106.53.157.194 / 106.53.154.20。
- TLS：CN=stats.slowrecap.cn，TrustAsia DV，**有效期至 2027-02-24**，握手正常。
- HTTP：OPTIONS 204（null 与 Web Origin 均放行）、合法 POST 200、GET 405、非法 JSON 400、非法事件名 400、40 KiB 413。
- 响应头 `Access-Control-Allow-Origin: *`；`:80` 返回 405，**未强制 HTTPS**（观察项，本轮不改云配置）。
- 结论：当前网络环境可达，凌晨失败不能复现，属环境差异，不认定为线上故障。详见 `domain/summary.md`。

## 6. 商店产物与包体

- 新端点命中 `dist/assets/main-J1Ea8iTq.js`；旧统计函数、Bing 网页接口、`chinese-poems.com`、`movie-scripts`、`.map`、`.git`、本机绝对路径均无命中。
- `translationSource` 字段名在业务代码中出现（对象属性名，非译文/来源链接）；`build:store` 闸门按带引号 JSON 键匹配，符合预期。
- 版本一致：`dist/plugin.json` 1.3.13、根 `package.json` 1.3.13、`CHANGELOG.md` 首条 1.3.13。
- 小程序包体：主包 1.62 MiB（1,699,057 B，131 文件），总包 3.87 MiB（4,053,790 B）；`pages-memory` 1.18 MiB、`pages-knowledge` 0.79 MiB。统计口径见 `mini-program/package-size.txt`。

## 7. 确认缺陷

| 级别 | 位置 | 问题 |
| --- | --- | --- |
| Minor | 三个 `dist*/index.html` | 引用的 `/favicon.ico` 不存在，三端 E2E 各出现 1 次 404 console 警告；仅控制台噪声 |

无 Blocker / Major。其余为 Nit、环境阻塞与待验证假设，见 `reports/issues.md`。

## 8. 外部阻塞

1. 微信真机/相机/音频采集：无设备通道。
2. uTools 宿主：搜索条无法稳定获得输入焦点。
3. Electron 原生文件对话框：未建立可靠 GUI 控制。
4. CI：`gh` 无法识别远端。
5. 云端函数版本/网关日志/日志留存权限：无后台读权限。

## 9. 未验证项

- MP02/03/04/05/06/07/08/10/11/12 中未执行的部分（见第 3 节）。
- MP09 的错题页、诗词地图 sheet、长列表滚动与横向溢出。
- uTools P0-3 全部宿主项；Electron 原生文件全部项。
- 微信真机弱网/离线冷启动、音频听感、系统手势。
- CI 最终状态。

## 10. 提审建议

| 目标 | 结论 |
| --- | --- |
| 微信小程序 | **代码与模拟器核心链路通过，真机/数据/弱网场景待补**；不建议把模拟器结果当全平台通过 |
| Web | **自动门禁、三端 E2E、内容页构建身份通过**；离线冷启动与旧缓存更新未验证 |
| Electron | **渲染层通过，原生能力未验收** |
| uTools 商店 | **代码/产物/自动门禁/E2E 通过，宿主实机未验收，暂不建议提审** |

全批结论：**执行完成，部分验收受阻**；不是“全平台验收通过”。

## 11. 后续计划（仅排期，不实施）

1. **P1-1**：补 favicon（或移除默认请求）；分类 Vue `Failed to resolve component` 警告；修复预览二维码工具解码一致性；补全能力矩阵终值。
2. **P1-2**：记录 Web/Electron/uTools 冷启动、首屏 JS 体积与最大 chunk、语言核心/翻译/词库加载耗时，再决定拆包。
3. **P1-3**：证书到期提醒（2027-01-25 检查、2027-02-10 续期）、DNS/网关变更记录、端点健康检查；评估是否收紧 `:80` 与 CORS。
4. **P1-5**：Web 正式入口用 `SITE_ORIGIN=https://slowrecap.cn` 构建并核对 canonical/sitemap。
5. **P2**：小程序自然拼读/字母映射进度同步、首次学习闭环优化、按端使用数据复盘、性能定点优化。
6. 真机与宿主人工项按 `mini-program/`、`utools/`、`electron/` 的矩阵补验后，再评估提审。

## 12. 证据目录

```text
test-results/next-closeout-2026-11-27/20261127-1020/
├── baseline/        head、status、diff-stat、hashes、artifact-identity、capability-matrix
├── logs/            test-run、type-checks、e2e-all（首次失败）、e2e-all-2、mp-regression、mp-open/reopen
├── domain/          dns、tls、matrix、各 HTTP 响应、summary.md
├── mini-program/    scenario-matrix、package-size、copy-manifest、截图
├── utools/          scenario-matrix、plugin-copy、plugin-copy-diff
├── electron/        scenario-matrix
├── reports/         store-scan、issues
└── checkpoint.json
```
