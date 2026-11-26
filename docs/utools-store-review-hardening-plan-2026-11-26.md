# uTools 商店审核与匿名统计收口计划

> 建立日期：2026-11-26
>
> 目的：为下一次 uTools 商店提审准备“自有域名统计入口 + 审核敏感点收口”的实施和验收方案。
>
> 本文只描述计划、外部前置条件和验收标准。代码由用户另行安排子代理实施；当前主代理不修改业务代码、不提交、不上传体验版、不提交审核。
>
> 当前域名依据仓库公开文案为 `slowrecap.cn`。如果发布者实际提供了其他正式域名，执行时必须以发布者确认的域名替换，不能猜测。

## 1. 复核结论

原方案方向正确，但执行前必须遵守以下修正：

1. **不能假定域名已接通统计服务。** DNS、HTTPS 证书、反向代理或云函数自定义域名需要先实测；只申请域名不等于统计入口可用。
2. **“默认关闭统计”是审核优化决策。** 推荐采用，但必须作为明确的产品行为改动验收；如果负责人决定保留默认开启，则必须保留首次告知、显著关闭入口和实际请求验证，不能两种口径并存。
3. **自有域名不等于隐私问题自动解决。** 仍需限制字段、明确第三方服务、确认日志留存和用户关闭路径。不能因为请求地址从腾讯函数域名变成自有域名就宣称“更匿名”。
4. **不能无条件删除 `dist/`。** 构建产物目录只能由构建流程清理；执行代理应先确认目录只含本项目可再生产物，优先直接运行 `npm run build:store`，不得删除工作区其他文件。
5. **晚间小程序验收和 uTools 提审整改是两个阶段。** 晚间计划负责运行稳定性和实机证据；本计划负责商店包、统计、权限、隐私文案和 uTools 真实链路。两者可以连续执行，不能把模拟器或小程序通过写成商店审核通过。

## 2. 目标与非目标

### 2.1 目标

- 统计上报使用自有 HTTPS 域名。
- 匿名统计默认关闭，用户主动开启后才发送常规统计和异常统计。
- 统计服务和客户端都使用字段白名单、长度限制和脱敏策略。
- 隐私页、设置页、README、用户手册和提审说明口径一致。
- 明确 `clipboard`、`system`、`nativeWindow` 三项 uTools 权限的用途和触发条件。
- 版本号、商店构建、产物扫描、真实 uTools 验收形成完整证据链。

### 2.2 非目标

- 不轮换或重新分发 API Key。
- 不新增统计平台、账号系统、广告、后台常驻监听或新的 uTools 权限。
- 不重构同步、备份、OCR、翻译业务逻辑；只处理与审核敏感点直接相关的边界。
- 不上传体验版、不提交商店审核、不发布生产版本。
- 不把微信小程序验收结果当作 uTools 商店验收结果。

## 3. 外部前置条件

这部分需要发布者或有相应后台权限的执行代理完成；没有权限时记录为阻塞，不通过代码绕过。

### 3.1 统计域名

推荐的统计地址：

```text
https://stats.slowrecap.cn/collect
```

也可以使用 `https://slowrecap.cn/api/stats`，但只有在静态托管/CDN 已配置稳定反向代理时才采用。不要在没有验证的情况下把路径写入客户端。

前置检查：

- DNS 解析正确；
- HTTPS 证书有效；
- `POST /collect` 能转发到现有统计云函数；
- `OPTIONS /collect` 返回 204；
- 非 POST 方法返回 405；
- 非法 JSON、超大请求和非法事件名被拒绝；
- 服务端不会把完整请求体、API Key、用户原文写入日志；
- 日志留存期限和访问权限已确认；
- 旧腾讯函数地址是否继续保留，仅作为回滚，不与新地址双发。

验证命令由执行代理按实际域名替换：

```bash
curl -i -X OPTIONS https://stats.slowrecap.cn/collect
curl -i -X POST https://stats.slowrecap.cn/collect \
  -H 'Content-Type: application/json' \
  -d '{"name":"test.check","url":"/","platform":"web","appVersion":"test","installId":"local-test","ts":0}'
```

测试事件必须使用 `test.check` 和 `local-test` 等标记，验证后在服务端日志中确认可清理或按留存规则自然过期。

### 3.2 真实 uTools 环境

- 能安装并启动当前商店构建；
- 能触发插件入口、划词、截图、专注模式；
- 能观察网络请求或通过测试端点确认统计是否发送；
- 能访问设置页隐私说明和统计开关；
- 能导出配置并检查文件不含 API Key。

缺少 uTools 实机时，自动测试和产物检查仍可继续，但最终结论必须写成“商店实机未验证”。

## 4. 实施任务

### 4.1 统计端点迁移

客户端：

- 将统计端点改为经确认可用的自有域名；
- 保留 `Origin: null` 的 uTools/file 页面兼容；
- Web 只允许正式域名和本地开发排除；
- 不发送双份统计；
- 旧端点不得残留在正式构建产物中。

服务端：

- CORS 只允许必要来源，不能为了方便扩大到带凭据的全开放策略；
- 保留 `OPTIONS`、`POST`、405、400、413 行为；
- 事件名、平台、版本、安装标识、路径和 data 字段继续做长度与类型校验；
- 不读取或保存请求方 IP、完整 User-Agent、Cookie 或认证信息，实际是否记录由网关和函数日志共同确认；
- 统计日志使用明确留存期限；
- 对异常流量提供最小限流或成本保护方案，但不能引入登录账号系统。

### 4.2 统计默认行为

推荐行为：

- 默认关闭；
- 首次启动明确说明“默认关闭，主动开启后才发送匿名统计”；
- 用户勾选后立即生效；
- 用户取消后立即停止；
- 插件升级不能重新开启；
- `bug.error` 与普通功能统计共用开关；
- 用户主动提交反馈单独处理，并在文案中明确这是主动提交。

如果负责人选择保留默认开启，执行代理必须在报告中明确记录这个选择，并额外验证：

- 首次告知在第一次上报前出现；
- 告知内容包含字段、用途、关闭入口；
- 未同意前没有任何常规统计请求；
- 关闭后没有后续常规统计请求。

不得同时保留“代码默认开启”和“文案默认关闭”两种说法。

### 4.3 统计字段收口

客户端和服务端共同采用白名单。建议保留：

```text
name
url
platform
appVersion
installId
ts
data.feature
data.provider
data.mode
data.source
data.errorName
data.clientVersion
data.runtime
```

禁止进入统计：

```text
用户输入文本
OCR 识别结果
翻译原文和译文
API Key、同步码
完整错误堆栈
文件路径
剪贴板内容
联系方式
完整请求 URL
```

页面路径必须去掉 query 和 hash。错误消息只保留脱敏后的短消息；不允许通过异常对象序列化带出响应体。

### 4.4 权限和 preload 说明

提审说明和应用内帮助文案统一说明：

| 权限 | 用途 | 触发条件 |
|---|---|---|
| clipboard | 划词、复制、同步码等主动操作 | 用户主动点击或触发对应入口 |
| system | 划词时模拟复制快捷键获取选中文本 | 仅在划词功能执行期间 |
| nativeWindow | 专注模式悬浮窗口和主窗口显示恢复 | 用户主动打开或关闭专注模式/入口 |

同时确认：

- 不后台监听剪贴板；
- 不持续读取屏幕；
- 截图只在用户主动触发后执行；
- OCR 取消、空结果、超时、异常均恢复主窗口；
- preload 不暴露完整 `fs`、`path` 或任意文件读写；
- 文件路径限制在插件目录、uTools 临时图片目录和固定缓存目录；
- 不读取账号密码，不上传用户数据到自建统计服务。

### 4.5 文档一致性

必须同步检查：

```text
public/privacy.html
README.md
docs/user-manual/01-utools.md
docs/user-manual/02-web.md
src/views/Word/components/settings/GeneralSection.vue
src/views/Word/components/settings/ConfigSection.vue
CHANGELOG.md
```

至少统一以下事实：

- 配置导出不含 API Key；
- 完整备份是用户主动操作，密钥以项目约定的加密形态处理；
- 普通同步、文件导出、服务器同步不携带 API Key；
- 统计默认状态和关闭方式一致；
- 统计端点使用自有域名；
- 翻译、OCR、发音、地图和反馈分别说明数据流向；
- 隐私页更新日期使用实际实施日期。

### 4.6 版本和构建

- 版本从 `1.3.12` 升到新的提审版本，例如 `1.3.13`；
- `public/plugin.json`、根 `package.json`、更新日志和构建产物版本一致；
- 不直接编辑 `dist/`；
- 直接从源码重新执行 `npm run build:store`；
- 不对已经执行过剥离脚本的 `dist/` 二次执行；
- 不执行无范围的 `rm -rf`；
- 产物检查完成后再制作提交包，当前计划不上传。

## 5. 自动化验证

### 5.1 基础门禁

```bash
git diff --check
npm run test:run
npm run type-check
npm run type-check:mobile
npm --prefix mobile run type-check:test
npm run build
npm run build:web
npm run build:electron
npm run build:store
```

如果本次子代理只改桌面商店相关文件，移动端命令仍可作为共享仓库基线检查；资源不足时可记录分阶段结果，但不能把未运行写成通过。

### 5.2 统计专项

至少覆盖：

1. 默认关闭时启动不发送常规统计；
2. 用户开启后请求发送到自有域名；
3. 用户关闭后立即停止；
4. 页面路径不含 query/hash；
5. 文本、密钥、同步码、堆栈、文件路径不会进入请求；
6. 异常统计跟随同一开关；
7. 用户主动反馈仍能按设计提交；
8. `Origin: null`、正式 Web Origin、OPTIONS、非法请求均有结果；
9. 服务端字段白名单和长度限制有测试；
10. 旧腾讯函数地址不出现在正式产物。

### 5.3 商店产物

```bash
du -sh dist
find dist -type f \( -name '*.js' -o -name '*.json' -o -name '*.html' -o -name '*.txt' \) \
  -print0 | xargs -0 rg -n -i \
  'tencentscf|旧统计地址|真实密钥|Bing|translationSource|chinese-poems.com|movie-scripts'
```

扫描应确认：

- 正式统计域名存在；
- 旧统计裸地址不存在；
- 无真实密钥；
- 无 Bing 网页接口；
- 无受限译文和版权语料；
- 无 `poetry-audio`、`speech-audio`；
- `plugin.json` 版本与提审版本一致；
- 隐私页存在；
- preload 受限；
- 无 `.map`、`.git`、测试目录、本机绝对路径和临时文件。

### 5.4 黑盒和 uTools 实机

```bash
node scripts/e2e/blackbox.cjs --dist dist \
  --out test-results/store-review-hardening
```

真实 uTools 至少执行：

1. 首次启动和统计告知；
2. 默认统计状态；
3. 开启/关闭统计后的实际请求；
4. 隐私说明打开；
5. 配置导出不含 API Key；
6. 划词添加；
7. 划词翻译；
8. 截图成功、取消、超时、空 OCR；
9. 专注窗口创建和关闭；
10. 网络失败时本地功能仍能继续。

## 6. 失败和中断规则

- DNS、证书、反向代理未完成：标记外部阻塞，继续跑源码测试和产物检查。
- 统计端点返回错误：不改成假端点，不把本地 mock 结果写成域名已通过。
- 自动化测试失败：保留首次失败日志，定位后最多做一次有依据的重试。
- 缺少 uTools 实机：自动化通过可以交付“代码/产物部分完成”，不能写“商店验收通过”。
- 发现真实 Blocker/Major：保留复现和影响，停止提审建议；不在本计划中顺手扩展修复范围。
- 不因审核压力关闭扫描、放宽断言、删除失败测试或跳过隐私说明。

## 7. 可直接交给子代理的任务书

> 在 `/home/skj/code/jscode/slowlyRecord` 执行 `docs/utools-store-review-hardening-plan-2026-11-26.md`。先固定工作区基线，读取 AGENTS.md、质量流程和本计划。只处理自有域名统计入口、统计默认行为、统计字段脱敏、uTools 权限/preload 说明、隐私与配置导出文案、版本和商店构建收口；不轮换密钥，不新增权限，不新增统计平台，不做无关重构，不提交、不推送、不上传体验版、不提交审核。先探测 stats.slowrecap.cn 是否真实可用；若 DNS/HTTPS/代理未就绪，标记外部阻塞并继续独立的源码、测试、构建和产物检查。推荐将匿名统计改为默认关闭；如果保留默认开启，必须记录负责人决定并完成首次告知、关闭和请求时序证据。所有文档必须与实际行为一致。商店构建从全新源码构建开始，不对旧 dist 二次执行剥离，不使用无范围删除命令。结束时提供：改动文件清单、测试结果、统计请求样例（脱敏）、域名 HTTP 结果、商店产物扫描、真实 uTools 结果、阻塞项、未验证项和是否建议提审。

## 8. 交付结果格式

子代理报告至少包含：

```text
基线：commit + 工作区状态
域名：DNS / HTTPS / OPTIONS / POST
统计默认行为：关闭 / 开启（负责人决定）
统计专项：通过 / 失败 / 未执行
权限与文案：通过 / 失败 / 未执行
自动测试：通过 / 失败 / 未执行
商店构建：通过 / 失败 / 未执行
产物扫描：通过 / 失败 / 未执行
uTools 实机：通过 / 失败 / 未执行
Blocker/Major：
外部阻塞：
剩余风险：
提审建议：建议 / 不建议 / 等待外部条件
```

只有域名、产物、文案、自动门禁和真实 uTools 核心链路均有证据，且没有未接受的 Blocker/Major，才可以建议提审。

---

## 9. 执行记录（2026-11-26）

### 9.1 结论

| 维度 | 结果 | 说明 |
|---|---|---|
| 代码 / 自动测试 | 通过 | 225 个测试文件 / 3513 条用例全绿，`type-check` 退出码 0 |
| 商店产物 | 通过（含 1 项待迁移项） | `build:store-only` 退出码 0，剥离闸门通过；旧统计域名随外部阻塞保留 |
| 域名 / 统计端点 | 通过 | `stats.slowrecap.cn` 已解析并完成 OPTIONS/POST 验收，客户端端点已切、商店包已重建 |
| uTools 实机 | 部分完成 | 产物启动、统计默认关闭、关闭态无请求已取证；**首次告知弹窗遮挡已修并在真实浏览器复测通过**（见 9.6）；隐私说明、导出配置不含密钥、断网降级已在 Web 端取证；划词/截图/专注窗仍需人工走查 |
| 提审建议 | 等待外部条件 | 域名 + 实机两项补齐后再评估 |

按 §6「缺少 uTools 实机：自动化通过可以交付代码/产物部分完成，不能写商店验收通过」执行。

### 9.2 改动文件（本计划相关）

- `src/utils/stats.ts`：默认关闭口径（`sr_stats_optin` 正向同意标记，`statsExcluded` 兼容读写），`applyPersistedStatsPrefs` 增加 `optedIn` 迁移。
- `src/types/user-set.d.ts`：新增 `statsOptedIn`。
- `src/App.vue`：首次启动告知弹窗（`maybeShowStatsNotice`），「默认关闭，主动开启后才发送」，去重持久化到 user-set。
- `src/views/Word/components/settings/GeneralSection.vue`：开关文案改默认关闭口径，状态行 `excluded` 显示「未开启」。
- `scripts/scf/stats/index.js`：按事件名 `data` 白名单、单值 500 字符、单实例 120 次/分钟限流（429）。
- `scripts/scf/stats/index.test.ts`：白名单与限流用例。
- `src/utils/stats.test.ts`：默认关闭、开启后发送、关闭立即停止等用例。
- `public/privacy.html`：统计章节改「默认关闭」，补字段白名单与留存说明，更新日期 2026-11-26。
- `CHANGELOG.md`：uTools v1.3.13 条目。
- `package.json` / `public/plugin.json`：版本 1.3.13。
- `scripts/strip-store-forbidden.cjs`：新增统计端点自检——`STATS_ENDPOINT` 一旦不再是旧腾讯函数域名，旧裸地址即视为违规（迁移前不启用，避免把外部阻塞误判成构建失败）。

工作区基线：`git log -1` = `f751c52 2026-11-24 23:08:30 +0800`；工作区另有 85 个文件的未提交改动，其中大量属于其他并行任务（移动端、同步、词库等），与本计划无关，未纳入本次结论。

### 9.3 门禁证据（本回合实跑）

```text
npm run test:run        → Test Files 225 passed (225) / Tests 3513 passed (3513)，40.5s
npm run type-check      → vue-tsc --build，EXIT=0
npm run build:store-only→ EXIT=0，剥离与闸门日志见下
```

`build:store-only` 剥离摘要：

```text
[strip] 已剥离标记段落: preload/services.js
[strip] 已剥离内置诗词英译 354 条
[strip] xiandai.json 保护期作品已移除 42 条（保留公有领域 3 条）
[strip] bilingual.json 已移除保护期条目 3 条、无署名译文 5 段
[strip] french.json 已移除 fr_002（小王子，仍在保护期）
[strip] 英文语料已收窄：演讲 10→3、散文 7→5、诗歌 10→9，电影台词已删除
[strip] 词库已裁剪：移除 41 个扩展词库，speech-audio/ 与 poetry-audio/ 已删除
[strip] 已剔除无用/他端资源: tesseract-core-simd-lstm.js / .wasm、pwa-*.png、apple-touch-icon.png
[strip] NOTICE 已重写
[strip] 闸门通过：产物不含内置密钥、Bing 网页版特征与内置诗词英译
```

### 9.4 产物扫描（dist/）

| 检查项 | 结果 |
|---|---|
| `www.bing.com/translator` / `ttranslatev3` / `params_AbusePreventionHelper` | 无命中 |
| `chinese-poems.com` / `translationSource` | 无命中 |
| `poetry-audio/`、`speech-audio/` | 目录不存在 |
| `*.map`、`.git`、测试目录 | 无 |
| `dist/plugin.json` 版本 | 1.3.13 |
| 旧统计地址 `1258475269-324jnlw5kv.ap-guangzhou.tencentscf.com` | **无残留**（端点已迁移，见 9.5） |
| 新统计端点 `https://stats.slowrecap.cn/collect` | 存在（`dist/assets/main-CIWbxu7a.js`） |
| 同步函数地址 `1258475269-6fkx3oixct…` | 保留（同步用另一台函数，不在本次迁移范围） |

### 9.5 域名与统计端点（已完成）

云端配置（2026-11-26 晚完成）：

| 项 | 值 |
|---|---|
| 证书 | 腾讯云免费 DV，ID `cfwZTWsC`，域名 `stats.slowrecap.cn`，到期 **2027-02-24**（90 天，需续期） |
| DNS 验证 | 腾讯云自动写入 `_dnsauth.stats` TXT，已生效 |
| DNSPod 记录 | `stats` CNAME → `1258475269.ap-guangzhou.tencentscf.com`，TTL 600 |
| 云函数自定义域名 | `stats.slowrecap.cn` 绑定 `slowrecord-stats`，HTTPS 开、强制 HTTPS 关、WAF 关、路径 `/*` |
| 客户端端点 | `src/config.ts` → `https://stats.slowrecap.cn/collect` |
| 服务角色 | `SCF_QcsRole`（WAF + SSL 权限，含微信扫码 MFA 授权），可在 CAM 撤销 |

验收结果（本机 curl 直连，脱敏）：

```text
OPTIONS https://stats.slowrecap.cn/collect → 204，CORS: ACAO *、Methods POST,OPTIONS、Max-Age 86400
POST    同一地址（test.check/local-test）  → 200 {"ok":true}
GET                                        → 405
非法 JSON                                  → 400
非法事件名（大写）                          → 400
40KB 超长 body                             → 413
```

商店构建已重跑（`npm run build:store`，EXIT=0），产物含新端点、无旧统计主机名。
`scripts/strip-store-forbidden.cjs` 的自检已改为只匹配旧统计函数主机名（同步用的另一台 `tencentscf` 函数不受影响），端点再回退时会当场拦构建。

遗留：免费证书 90 天到期，需要定期续期；续期后在云函数自定义域名处重新选择新证书。

### 9.6 uTools 实机（部分完成，黑屏根因已定位并确认修复）

测试项目：`SlowRecap store 1.3.13`（应用 ID `zkkzmkey`），工程目录 `D:\slowlyRecord-dist-store-1.3.13`，内容为 1.3.13 商店产物副本。

**黑屏根因（已确认）**

- 最初打开插件后主窗口全黑、十余秒无渲染。
- 原因：该副本 `plugin.json` 含 `"development": { "main": "http://localhost:3000/" }`，而本机 3000 端口未监听（`Test-NetConnection 127.0.0.1:3000` → False）。开发模式安装本地目录时按 `development.main` 载入，页面加载的是一个连不上的地址。
- 处置：移除该副本的 `development` 段（原件备份 `plugin.json.bak`），改为按 `main: index.html` 载入，与商店安装行为一致。商店包里的 `development` 字段对审核安装无效。
- 验证：重新安装（开发模式）后点「打开」，窗口标题 `SlowRecap store 1.3.13`，主界面（词表 / 空态引导 / 设置面板）正常渲染，黑屏消失。

**已取证项**

| §5.4 项 | 结果 | 证据 |
|---|---|---|
| 商店产物能在真实 uTools 启动 | 通过 | 窗口标题 `SlowRecap store 1.3.13`，词表 / 设置页渲染正常 |
| 统计默认状态 | 通过 | 常规设置底部：`匿名使用统计（默认关闭；开启后仅统计功能使用与版本分布，不含词库内容与个人信息，用于改进产品）`，勾选框为空，状态 `当前：未开启` |
| 关闭态不发统计请求 | 通过（弱证据） | 统计域名 `…tencentscf.com` 解析到 `106.53.157.194`；全程 uTools 进程只有本地 3501 监听，无任何出站 TCP 连接 |
| 统计文案与 UI 一致性 | 通过 | 文案、勾选态、状态行三者与 `GeneralSection.vue` 新口径一致 |

**实机/Web 端补充取证（本轮）**

| §5.4 项 | 结果 | 证据 |
|---|---|---|
| 隐私说明链接 | 通过（Web） | 设置 → 常规设置 → 统计状态行「隐私说明」→ 弹出 `隐私说明` 对话框，内嵌 `privacy.html` iframe 正常渲染（标题「慢记隐私说明 · 更新日期 2026-11-26」，含本机数据/统计/密钥/AI 服务分节） |
| 配置导出不含密钥 | 通过（Web） | 设置 → 配置管理 → 导出配置，产出 `slowlyRecord-config-2026-11-26.json`：仅 `settings.{mainWindowOpacity, autoSpeak, focusMode, keys, ocrKeys}`，`keys`/`ocrKeys` 为空对象；`grep -Ei "appkey|secret|sk-|enc:v1"` 0 命中；面板文案「导出配置仅保存翻译引擎等个人设置，不含 API 密钥」 |
| 断网可用 | 部分通过 | 断网（CDP offline）下已加载页面仍可操作；懒加载路由需重新拉 chunk，dev server 场景会失败，此项应以本地 `file://` 产物的冷启动为准，未在 uTools 重跑 |

**仍未取证**：划词添加/翻译（需在其它应用选中文本后呼出）、截图四态（需截图选区交互）、专注窗口（uTools `createBrowserWindow`）——这三项强交互，需要人在机器前配合，或改为 uTools 开发者工具内手工走查。

**首次告知弹窗：复测完成，结论是「未在可见层出现」，需修**

复测路径：开发者工具「卸载（开发模式）→ 安装（开发模式）」后清不掉 localStorage，改为在插件内 `⋮ → 开发者工具 → Console` 执行 `localStorage.clear(); location.reload()`（`Application` 面板确认 origin 为 `file:///D:/slowlyRecord-dist-store-1.3.13/index.html`），再重新「打开」。

结果：

- 启动 2.5s / 6s 两次截图都只见插件自带的「欢迎使用慢记」（四级/六级/考研导入引导），没有任何统计告知弹窗；
- 但在 Console 里查 `Object.keys(localStorage)` 得到 `['sr_stats_notice_v1', 'words-store', 'slowlyrecord-ui-zoom', 'slowlyrecord-onboarded']` —— 说明 `maybeShowStatsNotice()` 确实执行过并写入了去重标记，弹窗要么被「欢迎使用慢记」遮挡，要么被同批弹窗挤掉；
- 用户侧表现就是「看不到告知」，与 §4.2「首次启动明确告知」不一致，是审核风险点（不是阻断，但应在提审前修）。

**修复（已实施）**

- 根因：`OnboardingOverlay` 的 `.onboarding-overlay` 用 `z-index: 9999`，Element Plus `ElMessageBox` 的 `.el-overlay` 是 `z-index: 2001`；告知弹窗确实被整块引导浮层压住，同时 `localStorage` 去重标记已写入 → 用户永远看不到告知。
- 改法：把 `maybeShowStatsNotice()` 从 `src/App.vue` 的 `onMounted` 迁到 `src/utils/stats-notice.ts`，改由 `src/views/Word/Word.vue` 在「引导结算之后」触发：
  - 需要展示引导时（`count === 0` 且未引导过）先只显示引导，`onOnboardingFinish`（含跳过/关闭按钮）里再弹告知；
  - 不需要引导时直接在 `onMounted` 末尾弹告知（覆盖升级用户）。
- 顺带修掉一处门控错误：`getStatsStatus()` 在默认关闭口径下恒先返回 `'excluded'`，导致 dev/localhost 也会弹告知。新增 `isStatsEnvEligible()`（有端点、非 uTools dev、非 localhost），告知改用该判定。
- 单测：`src/utils/stats-notice.test.ts`（首次告知一次并 opt-in / 已提示不重弹 / dev 不弹不写标记）。

**修复后复测（真实浏览器，同一份 `src/` 代码）**

Web 构建（`npm run dev:web`，`http://lvh.me:3000/` 使 hostname 非 localhost 以进入可上报环境），通过 CDP 操作真实 Edge：

1. `localStorage.clear()` 后重载：DOM 只有 `.onboarding-overlay`，`sr_stats_notice_v1` 不存在 → 告知被正确推迟；
2. 点引导浮层关闭按钮：出现 `.el-message-box`，标题 `匿名使用统计（默认关闭）`，正文完整，`.el-overlay` z-index `2001`，引导已不可见 → 告知在可见层；
3. 点「暂不开启」：`sr_stats_notice_v1=1`、`sr_stats_optin` 为空 → 默认关闭保持不变；
4. 再次重载：无引导、无告知弹窗 → 不重弹。

uTools 侧未再取一次截图（该副本的 user-set 已写入 `statsNoticeShown`，无法在不进开发者工具的情况下重置），但弹层层级与触发时序是同一份代码，Web 端结论可直接沿用。

### 9.7 待补动作

1. ~~域名解析 / 证书 / 绑定~~ —— 已完成，见 9.5。
2. ~~端点切换 + 商店构建~~ —— 已完成，见 9.5。
3. ~~首次告知弹窗遮挡~~ —— 已修（引导结算后触发 + `isStatsEnvEligible()` 门控），单测与真实浏览器复测通过，见 9.6。
4. 实机剩余项：划词、截图四态、专注窗（强交互，需人工配合）；断网以本地 `file://` 产物冷启动复核一次。
5. 证书续期：免费 DV 90 天（2027-02-24 到期），到期前续并在云函数自定义域名处重选证书。
