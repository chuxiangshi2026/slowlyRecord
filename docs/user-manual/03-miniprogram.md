# 慢记用户手册 · 小程序端

> 本册只讲小程序端（微信）。产品理念与数据模块见 [公共核心](00-common.md)。
>
> ⚠️ 本文档为初版大纲，**真机截图待补充**（需要运行微信小程序后逐页截取，届时替换占位说明）。

---

## 一、进入方式

微信中搜索/扫码打开「慢记」小程序。首次打开有引导页（onboarding）。

## 二、底部导航（tabBar）

| 页面 | 内容 |
| --- | --- |
| 首页 | 功能入口总览 |
| 单词 | 单词书/词库与背单词 |
| 复习 | 今日复习任务 |
| 我的 | 设置、打卡、数据管理 |

## 三、功能分包页面

### 工具（pages-tools）

- **听写练习 dictation**
- **快速翻译 translate**
- **添加单词 add-word**
- **同步 sync**：与桌面端数据同步
- **专注 focus**
- **功能导图 function-graph**：全功能结构图

### 记忆训练（pages-memory）

- **数字记忆 number-memory**：含映射编辑（peg-edit）、条目编辑（entry-edit）、练习（practice）
- **文本记忆 text-memory**：含编辑（edit），支持诗词地图等视图

### 数据（pages-data）

- **打卡 signin**：每日签到 streak
- **词库 wordbank**：内置词库浏览
- **错词本 wrong-words**：复习中出错的词

### 知识库（pages-knowledge）

- **knowledge-list / knowledge-detail**：知识包浏览
- **knowledge-practice**：知识练习
- **knowledge-table**：表格视图

## 四、与桌面端的差异

- 导航为底部 tabBar + 分包页面，无 ☰ 抽屉；
- 通过「同步」页与 uTools/Web 端交换数据；
- 功能以复习与碎片练习为主，管理类操作（批量导入导出）建议在桌面端完成。

---

[← 公共核心](00-common.md) ｜ [uTools 端](01-utools.md) ｜ [Web 端](02-web.md)
