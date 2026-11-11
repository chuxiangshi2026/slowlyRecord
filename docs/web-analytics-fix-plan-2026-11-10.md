# Web 上线后稳定性与统计修补计划（复核版）

> 日期：2026-11-10  
> 范围：11 月 6–7 日 Web 上线后的 Umami 数据、5 条 `bug.error`、首启与核心行为统计。  
> 原则：只处理已确认的问题；既有设计不重复改造，证据不足的事项先诊断，不直接修根因。

## 一、复核结论

后续工作按以下顺序执行：

1. **P1：补 Web 懒加载失败恢复与发布防护。**
2. **P1：补非敏感错误上下文，再判断 uTools 是否需要调整构建目标。**
3. **P1：修正专注模式的“成功打开”口径，并处理 Web 不可用入口。**
4. **P2：用少量真实行为事件补齐首启激活漏斗。**
5. **运维：区分入口与哈希资源缓存、隔离后续测试数据；积累 7–14 天干净数据后再决定产品调整。**

不在本轮扩新功能、改移动端布局、重做新手引导或建设新的统计系统。

## 二、已排除或降级的事项

以下事项不再写成“已确认缺陷”，避免重复处理或过度修补。

### 2.1 `src/config.ts` 配置问题

用户已确认此前检查过且风险可接受，本计划不再提出轮换、迁移或历史清理，也不阻塞本次工作。

### 2.2 PWA 更新策略

`vite.config.web.ts` 与既有增长计划明确要求：新版本尽量在下次启动生效，复习过程中不强制刷新。

- 保留当前等待旧标签页关闭的策略。
- 不新增强制刷新或自动更新提示作为本次前置项。
- `registerType: 'prompt'` 不等于项目已有更新提示 UI，后续文档不得把二者混为一谈。

### 2.3 错误上报中的页面和平台字段

- `trackError()` 已通过事件 `url` 携带当前路由，不重复增加 `page`。
- 上报已通过 `slowlyrecord.web/utools/electron` hostname 区分平台，不重复给所有事件增加 `platform`。
- 当前“不带堆栈，避免携带用户数据”是明确的隐私取舍。本轮只补非敏感上下文，不要求默认上传完整堆栈。

### 2.4 来源归因

`stats.ts` 已支持 `utm_source`/`from`、`page` 和 `source.landing`。外部链接直接使用现有参数即可，本轮不开发新的 UTM 或归因模块。

### 2.5 词集完成事件

`feature.word_book_page_done` 已存在于 `src/stores/wordBook.ts`，由 2026-11-02 的 `5f98b11` 引入，不是本轮需要新建的埋点。

后台暂时没有该事件，只能标记为“待验证”，不能据此直接认定埋点失效，也不能直接认定用户没有完成词集学习。

### 2.6 海外流量和产品入口调整

11 月 6–7 日流量与 Web 上线重合，可能包含发布验证、代理和测试访问。暂不据此投入海外推广，也不立即调整知识记忆、词集、听写等功能入口。

## 三、P1：Web 懒加载失败恢复与发布防护

### 已确认事实

- 页面组件在 `src/router/index.ts` 中使用动态导入。
- 当前没有 `router.onError` 处理。
- 后台出现过一次 `Failed to fetch dynamically imported module: .../Word-dsSzmAjZ.js`。
- 复核时该线上资源返回 200；这不能证明报错当时资源一定存在，也不能单独证明是缓存导致。
- 线上 HTML、`sw.js` 和带哈希的 JS 当前均为 `max-age=0, must-revalidate`。

### 修改步骤

涉及：

- `src/router/index.ts`
- `src/utils/stats.ts`
- 路由错误判定的聚焦测试
- EdgeOne 发布与缓存配置（运维，不改构建产物）

1. 在路由层识别动态导入/Chunk 加载错误。
2. 在错误处理内显式调用 `trackError`，避免增加 `router.onError` 后错误不再进入全局 `unhandledrejection`。
3. 给用户展示明确的“资源加载失败，可重新加载”入口，不能留下无提示空白页。
4. 只允许首次启动场景进行每会话一次自动重试，并用 `sessionStorage` 防止刷新循环。
5. 用户可能正在编辑的页面不自动刷新；重复失败时停止重试并展示错误入口。
6. 保留当前工作区 `src/router/index.ts` 中“路由切换关闭抽屉”的未提交修复，增量添加错误处理，不覆盖现有改动。
7. 发布时保留上一版带哈希资源至少一个发布周期，避免旧页面在新版本发布后加载不到旧 Chunk。
8. 缓存策略分开设置：
   - `index.html`、`sw.js`、`registerSW.js`：继续 `no-cache` 或 `max-age=0, must-revalidate`。
   - 带内容哈希的 `/assets/*.js/css`：评估后改为 `public, max-age=31536000, immutable`。

缓存调整属于发布防护和性能优化，不在未复现前宣称它就是本次错误的根因。

### 验收

- 模拟一次 Chunk 404：不会出现无限刷新或静默空白。
- 首次启动允许一次受控恢复；后续导航失败不会擅自丢弃编辑内容。
- 连续失败有可见提示和人工刷新入口。
- 发布后，上一版入口引用的旧哈希资源仍可访问。
- 线上响应头符合入口文件与哈希资源的不同策略。

## 四、P1：先补错误上下文，再决定 uTools 构建兼容性

### 已确认事实与边界

- 4 条 uTools 错误表现为语法解析类消息，另 1 条为 Web 动态模块加载失败。
- 当前错误数据有 `source/message/platform/appVersion`，但缺少 uTools 客户端版本和实际运行时版本。
- 5 条错误的具体发生路由本次未完整取回，不能擅自归到某个页面。
- `vite.config.ts` 未显式配置 `build.target`，但仅凭错误文本不能确定需要降低到哪个目标。

### 修改步骤

涉及：

- `src/utils/stats.ts`
- `src/utils/stats.test.ts`
- `src/main.ts`

1. 复用启动事件读取客户端版本的逻辑，避免两处实现漂移。
2. 给 `bug.error` 增加非敏感字段：
   - `clientVersion`；
   - 浏览器/Chromium 版本；
   - `errorName`。
3. 对动态模块错误保留模块路径；只保留必要的文件名/路径部分，不上传本地绝对路径、查询参数或用户内容。
4. `window.error` 处理保留可用的错误对象和行列信息；如需记录资源位置，先做清理，不直接发送完整本地路径。
5. 不默认上传完整堆栈；若后续证据仍不足，再单独评估脱敏后的有限堆栈。
6. 用新增上下文复现受影响客户端和页面。只有确认旧运行时缺少对应语法支持后，才在 `vite.config.ts` 中调整 **uTools 目标** 的 `build.target`，不同时降低 Web/Electron 目标。

### 验收

- 新错误能区分 uTools 客户端版本、运行时和错误类型。
- 上报内容不包含用户文本、密钥、本地绝对路径或查询参数。
- 在未复现前不提交“降低构建目标即可修复”的结论。
- 若调整目标，使用受影响 uTools 客户端实际打开对应懒加载页面验证。

## 五、P1：专注模式按成功打开统计

### 已确认事实

`src/views/Word/Word.vue` 当前在窗口创建前调用 `FeatureEvents.focusOpen()`：

- 没有待复习词时不算成功，但当前代码已在检查后才上报，此项保持。
- 窗口已存在、达到窗口上限、Web 不支持、创建异常等路径仍可能被计为 `focus_open`。
- Web 分支实际只提示“仅桌面端可用”，因此现有 24 次只能理解为打开意图，不能理解为成功使用。

### 修改步骤

涉及：

- `src/views/Word/Word.vue`
- `src/utils/stats.ts`（仅复用现有 `FeatureEvents.focusOpen`，不新增同义事件）

1. 移除创建前的上报。
2. Electron：在 `createBrowserWindow` IPC 成功返回后记录一次。
3. uTools：在窗口创建回调中记录一次。
4. 窗口已存在、超过上限、Web 不支持、创建失败均不记成功。
5. Web 单词页利用现有 `isWebEnv` 隐藏或明确禁用悬浮窗入口，避免用户反复进入必然失败的流程；不改变 uTools/Electron 入口。
6. 保留当前 `Word.vue` 的未提交改动，不做无关重构。

### 验收

- 无待复习词、重复聚焦、达到上限、Web 点击和创建异常均不增加成功事件。
- uTools 与 Electron 真正创建成功时各只记录一次。
- 埋点发送失败不影响窗口创建主流程。

## 六、P2：最小首启与核心行为埋点

本轮只补能明确定义、能落入真实业务动作的事件，不凭空增加“学习完成”。

### 6.1 首启展示与词库导入

涉及：

- `src/components/OnboardingOverlay.vue`
- 对应聚焦测试

1. 首次引导实际展示时记录 `onboarding.view`。
2. 保留现有 `onboarding.bank_import` 作为导入成功事件。
3. 暂不强制增加 `skip/complete`：关闭按钮与导入成功共用 `close()`，贸然在 `close()` 中记录会产生“导入后又被记为跳过”的脏数据。
4. 首启漏斗先使用“引导展示 → 导入成功”，不改现有三屏 UI。

### 6.2 新单词添加

涉及：

- `src/utils/str-util.ts`
- `src/utils/str-util.test.ts`
- 复用 `UserActionEvents.addWord`

1. 在单新词主流程接入现有 `word.add`，不在每个 UI 入口重复埋点。
2. 仅在 `message !== '更新成功'` 的新增成功分支记录，避免把“补充旧词释义”算成新增。
3. `addAndUpdateWords()` 已返回布尔结果，但 `str-util.ts` 当前忽略了它；先检查该结果，保存失败时返回失败，不记录 `word.add`。
4. 不顺带重构其他 Store 的写入返回值体系。

### 6.3 主列表复习作答

涉及：

- `src/views/Word/components/MyListItem.vue`
- `src/views/Word/components/MyListItem.test.ts`

1. 在“认识/忘记”动作中记录 `review.answer`，label 使用 `remember/forget`。
2. 事件含义限定为“用户完成一次复习作答”，不宣称为“整天复习完成”或“数据库写入成功”。
3. 不将事件放到通用 `addAndUpdateWord()`：该函数还服务发音、释义和专注窗口同步，直接埋点会混入非复习更新。
4. 暂不新增 `learning.complete/review.complete`，等产品先明确“一次学习/复习完成”的边界。

### 6.4 听写作答

涉及：

- `src/views/Dictation/Dictation.vue`
- 对应聚焦验证

1. 复用已有 `FeatureEvents.dictation`。
2. 在 `checkAnswer()` 中按实际结果记录 `correct/wrong`，而不是只统计页面访问。
3. 保留当前未提交的听写改动，不调整 SRS 等级和页面流程。

### 6.5 词集完成

不新增事件、不改现有逻辑。后续版本产生数据后，再核对 `feature.word_book_page_done` 是否与真实页级完成一致。

## 七、运维与观察

1. 后续诊断/探测事件使用测试 Website ID；当前 `sr_stats_force` 自测结束后及时清除，避免继续写入正式站点。
2. 不为隔离测试数据专门开发一套新配置系统；先通过 Umami 测试站点和现有自测开关解决。
3. 外部推广继续使用现有 `utm_source`/`from` 与 `page` 参数。
4. 修补发布后积累 7–14 天干净数据，再评估：
   - 引导展示 → 导入 → 首次复习作答；
   - Web/uTools 分平台转化；
   - 知识记忆、词集等功能是否需要调整入口；
   - 移动端是否需要针对性优化。
5. 不用上线首周的启动量、美国流量或页面浏览量作为增长基线。

## 八、实施批次

### 批次 1：加载恢复与错误上下文

- 路由懒加载失败处理及测试。
- `bug.error` 非敏感上下文及测试。
- EdgeOne 缓存与旧资源保留策略。
- 不直接修改 uTools `build.target`，等待新证据。

### 批次 2：统计口径

- 专注成功事件与 Web 不可用入口。
- 首启 `onboarding.view`。
- 新词 `word.add` 与保存结果检查。
- 主列表 `review.answer`、听写 `FeatureEvents.dictation`。

### 批次 3：观察后再决策

- 核对新漏斗和错误分布。
- 决定是否需要 uTools 构建目标调整、产品入口优化或引导流程精简。
- 没有数据支持时不进入第三批产品改造。

## 九、验证清单

按实际改动运行聚焦测试，然后执行：

```bash
npm run test:run
npm run type-check
npm run build
npm run build:web
```

实际场景验收：

- Web：首次打开、路由切换、Chunk 加载失败、失败后恢复、复习作答、听写作答。
- uTools：受影响的懒加载页面、专注窗口成功/失败路径、错误事件上下文。
- Electron：专注窗口创建成功只记一次。
- 数据：Umami 中不再把失败点击计为专注成功，测试事件不进入正式站点。
- 回归：当前工作区未提交的抽屉、Word、听写等改动不被覆盖或回滚。

## 十、明确不做

- 不重复处理 `src/config.ts` 已确认事项。
- 不强制刷新 PWA，不改变既有更新策略。
- 不重复添加上报 `page/platform`，不默认上传完整堆栈。
- 不新建词集完成事件、不新建归因系统、不新建统计平台。
- 不凭错误文本直接降低所有平台构建目标。
- 不在本轮重构 Store、SRS、词库或新手引导 UI。
- 不根据上线首周数据直接做海外推广、移动端大改或功能裁撤。

---

## 实施记录（2026-11-10）

已完成批次 1、2 的代码部分：

- 路由懒加载错误识别、首次启动单次自动恢复、后续导航人工确认恢复。
- `bug.error` 增加发生路由、客户端版本、Chromium 版本和错误类型，不上传完整堆栈。
- `focus_open` 改为窗口成功创建后上报；Web 单词页隐藏专注模式入口。
- 新增 `onboarding.view`、`word.add`、`review.answer`、`feature.dictation` 核心行为埋点。
- 单新词保存失败时不再返回假成功，也不记录 `word.add`。
- 计划文档已同步到本分支。

已验证：

- 聚焦测试：5 个文件、59 条通过。
- 全量测试：182 个文件、3112 条通过。
- `npm run type-check`：通过。
- `npm run build`（uTools）：通过。
- `npm run build:web`：通过。
- `npm run build:electron`：通过。
- Playwright 验证 Web 开发服务与 `dist-web` 预览：单词、翻译、拼写、知识库路由正常；Web 专注入口隐藏；模拟 `TextMemory` Chunk 加载失败时展示恢复提示，点击重新加载后可进入文本记忆页；正常路由无 `console.error` / `pageerror`。

尚未完成：

- EdgeOne 入口与哈希资源缓存规则、旧版本资源保留一个发布周期（运维配置）。
- uTools 真实客户端复现与必要时的 `build.target` 调整。
- 发布后 7–14 天干净数据观察，再决定第三批产品优化。
