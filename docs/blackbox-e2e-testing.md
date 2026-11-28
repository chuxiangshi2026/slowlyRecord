# 黑盒 E2E 测试与 uTools 实机巡检规范

> 目标：把「页面测试」和「uTools 端真实运行」从人工随意点看，固化为**可重复执行、有断言、有存档**的生产环境黑盒测试流程，与单元测试互补而非替代。
> 建立日期：2026-11-10 ｜ 配套脚本：`scripts/e2e/blackbox.cjs` ｜ 命令：`npm run test:e2e`

---

## 一、测试分层总览

| 层级 | 名称 | 工具 | 测什么 | 命令 |
| --- | --- | --- | --- | --- |
| L1 | 单元/适配器测试 | Vitest（已有 3134 例） | 纯逻辑、数据层、adapter 行为 | `npm run test:run` |
| L1.5 | **fake utools 宿主集成测试** | Vitest + jsdom（`src/app-enter.test.ts`） | `handleUtoolsEnter` 全 action 分派、主窗口隐藏/恢复配对、OCR/划词/收藏入口链路 | `npx vitest run src/app-enter.test.ts` |
| L2 | **黑盒 E2E 冒烟**（本文档主角） | Puppeteer + 真实构建产物 + 真实 Chromium | 逐路由真实加载、渲染崩溃、非空白、截图存档、关键交互断言 | `npm run test:e2e` |
| L2.5 | **平台自动化** | Electron: Playwright `_electron` + xvfb；小程序：微信开发者工具自动化 + miniprogram-automator | Electron 主进程真实启动与导航；小程序主包/分包页面真实渲染与导航（模拟器级，不含真机授权场景） | `npm run test:e2e:electron`；`node scripts/e2e/miniprogram.cjs`（前置见下） |
| L3 | **uTools 实机巡检** | 人工 + KimiCU 自动化辅助 | 真机窗口尺寸、亚克力/自定义背景、双抽屉手势、平台专属 API（focus.html、utools 头、截图/划词宿主行为） | 见第四节清单 |
| L0 | 静态检查（uTools 面） | grep / CI 脚本 | plugin.json 关键字、focus.html、preload 完整性 | 见第五节 |

原则：**L2 跑的是 `npm run build` 的真实产物**（与打进 upx / Electron 的代码同一份），不是源码模拟环境——这是它和单元测试的本质区别。

> 为什么需要 L1.5：uTools 专属链路（截图/划词/超级面板入口、主窗口隐藏恢复）只在 `window.utools`
> 存在的真机触发，L1 全 mock、L2 纯 Chromium 里没有 `window.utools`，整条 `handleUtoolsEnter`
> 是死代码——2026-11 的「截图没反应、划词翻译静默失败」即从此盲区漏出。L1.5 用 fake utools
> 对象驱动 App.vue 入口分派，把窗口恢复配对、空结果提示、整句入词库等行为锁成回归用例。

---

## 二、L2 黑盒 E2E 使用方法

### 运行

```bash
npm run build          # 先构建（E2E 测的是构建产物）
npm run test:e2e       # 默认测 dist/
```

```bash
# 常用变体
node scripts/e2e/blackbox.cjs --dist dist-web            # 测 Web 构建
node scripts/e2e/blackbox.cjs --route word,translate     # 只跑指定路由
node scripts/e2e/blackbox.cjs --chrome /path/to/chrome   # 指定浏览器
PUPPETEER_EXECUTABLE_PATH=/path/to/chrome npm run test:e2e
```

### 环境准备（一次性）

- 仓库已依赖 puppeteer 25（无需新增依赖）。
- 若提示缺少 Chromium：`npx puppeteer browsers install chrome`（网络慢可改用本机浏览器 `--chrome` 指定，WSL 下可用 `/mnt/c/Program Files (x86)/Microsoft/Edge/Application/msedge.exe` 验证通过）。

### 每次运行做什么

1. 静态伺服 `dist/`，逐路由访问 23 个路由（14 个主路由 + 数字记忆/音标/快捷键训练子页 + 宫殿编辑器 + `/selftest` 诊断页）；
2. 每路由断言：**页面非空白**、**页头存在**、**无渲染崩溃**（pageerror 零容忍；`/selftest` 独立于 Home 外壳无页头，改断言自检 JSON 可解析且含 `platform`）；
3. 每路由全页截图存档 `test-results/e2e/<route>.png`；
4. 交互断言（回归已修缺陷、守卫未修缺陷）：
   - **F1 双抽屉互斥**：打开设置抽屉后再开「更多」抽屉，同时可见抽屉数 ≤ 1；
   - **F2 抽屉随路由关闭**：开着抽屉切路由，抽屉必须关闭；
   - **B2 守卫**：抽屉打开 → Escape → 页头仍在且页面不空白（文本记忆页整页空白的回归守卫）；
   - **I1 设置抽屉六分组全遍历**：常规设置/外观/专注模式/快捷键/API 密钥/配置管理逐一进入，二级面板标题正确且非空；
   - **I2 添加/导入对话框**：文本记忆页打开统一「添加/导入」对话框，默认停留在「内置库」tab；
5. 输出 `test-results/e2e/report.json`，**退出码 = 失败数，可直接进 CI**。

### 已知无害告警

- `word` 路由可能出现 `favicon.ico 404`（构建产物未含该文件），属无害告警，不判失败。如需消除，后续在构建中补 favicon。

### 新增页面时

1. 在 `ROUTE_MATRIX` 登记路由与一句话预期；
2. 若有交互缺陷修复，在「交互断言」区加对应回归用例（模仿 F1/F2 写法）；
3. 跑一次 `npm run test:e2e` 把新路由基线截图提交存档。

### L2.5 平台自动化（Electron / 小程序模拟器）

**Electron**（`scripts/e2e/electron.cjs`，依赖 `playwright-core` + 项目内 `electron` 二进制）：

```bash
npm run test:e2e:electron   # xvfb 虚拟屏下启动 dist-electron/main.js（生产 loadFile 模式）
```

断言：主窗口出现、页面非空白、word/dictation 导航、`/selftest` 诊断页 JSON `platform=electron`、无渲染崩溃；截图存档 `test-results/e2e-electron/`。

**微信小程序模拟器**（`scripts/e2e/miniprogram.cjs`，依赖 `miniprogram-automator`）：

前置（Windows 侧一次性）：
1. 微信开发者工具已安装并登录，设置 → 安全 → 服务端口开启；
2. 构建产物复制到 Windows 本地目录（9P/UNC 路径 DevTools 打开很慢），并把 `project.config.json` 的 `appid` 从 `touristappid` 换成真实 AppID（CLI 不支持游客 appid）；
3. 以自动化模式启动：
   ```bash
   powershell.exe -NoProfile -Command '& "D:\Program Files (x86)\Tencent\微信web开发者工具\cli.bat" auto --project "C:\Users\skj\AppData\Local\Temp\slowlyrecord-mp-e2e" --auto-port 9420 --trust-project'
   ```

```bash
node scripts/e2e/miniprogram.cjs   # 连接 ws://127.0.0.1:9420，主包 4 页 + 4 个分包代表页导航冒烟
```

覆盖范围说明：模拟器级页面渲染/导航/分包加载（对应巡检清单 MP01、MP02 部分、MP09–12 的可模拟器部分）；**相机/相册/录音授权（MP06–08）与真机特有行为仍需真机**，不在自动化范围。

---

## 三、什么时候跑

| 时机 | 必跑项 |
| --- | --- |
| 每次改 UI/路由/抽屉/弹窗 | L1 + L2 |
| 打包 upx / Electron 前 | L1 + L2 + L3 巡检 |
| 发版前 | 全部 + L0 |

---

## 四、L3 uTools 实机巡检清单（每次发版前）

> uTools 端有平台专属面（原生窗口头、亚克力、focus.html 专注窗、自定义背景图），L2 无法覆盖，必须真机巡检。
> 辅助手段：KimiCU 自动化（呼出、点击、截图），全流程约 10 分钟。已知坑：主窗口失焦即隐藏；Alt+Space 在其窗口可见时是「隐藏」；Kimi 客户端窗口会盖住 uTools。

| # | 检查项 | 通过标准 |
| --- | --- | --- |
| 1 | 启动器关键字 | 「慢记」进首页；「翻译」进翻译页；输入普通文本回车加入复习列表 |
| 2 | 单词复习页 | 卡片/工具栏/底部统计正常，背景图下可读 |
| 3 | 逐页抽屉导航 | ☰ 抽屉可滚到底，各页（文本记忆/知识库/数字记忆/记忆宫殿/翻译/测试/音标/字母/快捷键）渲染正常 |
| 4 | 双抽屉 | 打开设置抽屉后点 ☰，不应双抽屉叠加（F1 修复回归） |
| 5 | 路由切换 | 开着抽屉导航，抽屉应关闭（F2 修复回归） |
| 6 | 页头对比度 | 自定义背景图开启时页头文字可读、无色带错乱（待修 B3，修复后移除该项） |
| 7 | 数字记忆快速开始 | 对话框底部「下一步」不被窗口边缘裁切（待修 B6） |
| 8 | 专注模式 | focus.html 小窗正常（约 400×125），可关闭 |
| 9 | 划词添加 | 浏览器外划词弹层正常；长句弹划段面板（可挑词/整句入词库/收藏句子），不自动分流 |
| 10 | Escape 链 | 抽屉开 → Escape → 页面不空白（B2 守卫，重点盯文本记忆页） |
| 11 | 划词翻译 | 选中文本触发划词翻译 → 主窗口显示并跳翻译页、原文进输入框；无选中文本时有「未获取到选中的文本」提示，不静默 |
| 12 | 截图添加 | 截图后出 OCR 面板，勾选/全选整句进单词列表（不拆词）；取消截图静默恢复主窗口 |
| 13 | 截图翻译 | 截图后跳翻译页并带原文；OCR 失败/空结果时主窗口必须恢复且有可见提示（回归：曾悬挂无反应） |
| 14 | 超级面板双入口 | 选文本呼出超级面板：「加入复习列表」进词库、「收藏句子」原句进句子库（不翻译），两入口并存不互扰 |
| 15 | 中文加词 | 英语词库添加中文词/句 → 默认英文主词+中文释义（设置里可切「保留中文主词」）；非英语词库中文输入仍走原翻译流程 |

巡检结果记录到 `docs/bug-list-*.md` 同款清单。

---

## 五、L0 静态检查（uTools 专属面，可脚本化）

```bash
# plugin.json 关键字与入口完整性
grep -o '"keywords"[^]]*]' plugin.json   # 路径按实际 upx 结构调整
ls focus.html preload.js index.html     # 关键文件在位
```

建议后续固化为 `scripts/e2e/check-upx-surface.cjs`，并入 `test:e2e`。

---

## 六、后续演进（建议）

1. **隐藏自测路由 `#/selftest`**：输出 adapter 诊断（平台/数据库后端/TTS/剪贴板能力），E2E 断言运行环境是否正确，替代人工猜平台差异。
2. **截图比对**：对 `test-results/e2e/` 基线做像素级 diff（容忍度可调），把「样式回归」也自动化。
3. **KimiCU 巡检脚本化**：把第四节清单写成 KimiCU cell 脚本，发版前一键执行并自动截图存档。
4. ~~**CI 接入**~~（已完成 2026-11-25）：`test:e2e` 已接入 CI builds job，对 dist / dist-web / dist-electron 三份产物全量跑，退出码作为门禁。

---

## 七、历史记录

- 2026-11-10：建立本流程；首轮运行 43/43 通过；F1/F2 修复经 E2E 回归验证；发现并记录待修项 B2/B3/B4/B5/B6/B7（见 `docs/bug-list-2026-11-10.md`）。
- 2026-11-25：
  - 新增 L1.5 fake utools 宿主集成测试（`src/app-enter.test.ts`，12 例），锁定截图/划词/收藏入口的窗口恢复配对与分派行为——补齐 2026-11 系列 uTools 入口 bug（截图无反应、划词翻译静默失败、OCR 空结果窗口不恢复）的测试盲区。
  - L3 巡检清单从 10 项扩到 15 项（补划词翻译/截图添加/截图翻译/超级面板双入口/中文加词）。
  - `test:e2e` 正式接入 CI（三端产物全量），本地三个变体验证 47/47 通过。
  - 配套单元回归：`src/utils/zh-entry.test.ts`（9 例）、`src/utils/str-util.test.ts` 中文加词门控（+5 例）。
