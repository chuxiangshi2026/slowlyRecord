# 黑盒 E2E 测试与 uTools 实机巡检规范

> 目标：把「页面测试」和「uTools 端真实运行」从人工随意点看，固化为**可重复执行、有断言、有存档**的生产环境黑盒测试流程，与单元测试互补而非替代。
> 建立日期：2026-11-10 ｜ 配套脚本：`scripts/e2e/blackbox.cjs` ｜ 命令：`npm run test:e2e`

---

## 一、测试分层总览

| 层级 | 名称 | 工具 | 测什么 | 命令 |
| --- | --- | --- | --- | --- |
| L1 | 单元/适配器测试 | Vitest（已有 3134 例） | 纯逻辑、数据层、adapter 行为 | `npm run test:run` |
| L2 | **黑盒 E2E 冒烟**（本文档主角） | Puppeteer + 真实构建产物 + 真实 Chromium | 逐路由真实加载、渲染崩溃、非空白、截图存档、关键交互断言 | `npm run test:e2e` |
| L3 | **uTools 实机巡检** | 人工 + KimiCU 自动化辅助 | 真机窗口尺寸、亚克力/自定义背景、双抽屉手势、平台专属 API（focus.html、utools 头） | 见第四节清单 |
| L0 | 静态检查（uTools 面） | grep / CI 脚本 | plugin.json 关键字、focus.html、preload 完整性 | 见第五节 |

原则：**L2 跑的是 `npm run build` 的真实产物**（与打进 upx / Electron 的代码同一份），不是源码模拟环境——这是它和单元测试的本质区别。

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

1. 静态伺服 `dist/`，逐路由访问 `#/word`、`#/text-memory`、`#/translate` 等 13 个主路由；
2. 每路由断言：**页面非空白**、**页头存在**、**无渲染崩溃**（pageerror 零容忍）；
3. 每路由全页截图存档 `test-results/e2e/<route>.png`；
4. 交互断言（回归已修缺陷、守卫未修缺陷）：
   - **F1 双抽屉互斥**：打开设置抽屉后再开「更多」抽屉，同时可见抽屉数 ≤ 1；
   - **F2 抽屉随路由关闭**：开着抽屉切路由，抽屉必须关闭；
   - **B2 守卫**：抽屉打开 → Escape → 页头仍在且页面不空白（文本记忆页整页空白的回归守卫）；
5. 输出 `test-results/e2e/report.json`，**退出码 = 失败数，可直接进 CI**。

### 已知无害告警

- `word` 路由可能出现 `favicon.ico 404`（构建产物未含该文件），属无害告警，不判失败。如需消除，后续在构建中补 favicon。

### 新增页面时

1. 在 `ROUTE_MATRIX` 登记路由与一句话预期；
2. 若有交互缺陷修复，在「交互断言」区加对应回归用例（模仿 F1/F2 写法）；
3. 跑一次 `npm run test:e2e` 把新路由基线截图提交存档。

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
| 9 | 划词添加 | 浏览器外划词弹层正常 |
| 10 | Escape 链 | 抽屉开 → Escape → 页面不空白（B2 守卫，重点盯文本记忆页） |

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
4. **CI 接入**：`npm run test:e2e` 退出码已可直接作为流水线门禁。

---

## 七、历史记录

- 2026-11-10：建立本流程；首轮运行 43/43 通过；F1/F2 修复经 E2E 回归验证；发现并记录待修项 B2/B3/B4/B5/B6/B7（见 `docs/bug-list-2026-11-10.md`）。
