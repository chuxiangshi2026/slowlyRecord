# 翻译引擎免费密钥申请指南

本项目支持三层免费翻译方案，按优先级：**免 key 引擎开箱即用 → 内置官方免费模型 → 自填各平台免费密钥（BYOK）**。

## 一、免密钥引擎（无需任何申请）

| 引擎 | 说明 | 限制 |
|---|---|---|
| 本地词典 | 离线内置词库 | 仅覆盖已收录单词 |
| Google（免费网页接口） | 无需 key | 仅 uTools/Electron 桌面端（Web 端跨域受限），非官方接口有失效风险 |
| 微软网页版（免费接口） | 无需 key，走 Edge 通道 | 同上，仅桌面端 |
| uTools AI | uTools 平台能力 | 仅 uTools 插件内可用 |

## 二、官方免费模型（推荐自填，也可由作者内置）

这些平台有**官方长期免费的模型**，个人申请 key 即可永久免费调用；作者内置的也是这类模型，且内置 key 时模型名已锁定为免费版本（防止被改为付费模型扣费）。

### 智谱 GLM（当前默认引擎）

- 免费模型：`glm-4.7-flash`（长期免费）
- 申请：注册 <https://open.bigmodel.cn> → 用户中心 → API keys → 新建
- 设置页填到「智谱GLM」的 API Key

### 讯飞星火（新旧两个平台，按 key 格式自动路由）

- **旧平台 spark-api-open（内置默认）**：Lite 官方宣布永久免费，模型名还可选 `generalv3` / `pro-128k` / `generalv3.5` / `max-32k` / `4.0Ultra`（其他版本为付费）。不填 key 时使用内置共享 key + `lite` 开箱即用
  - 申请自己的：产品页 <https://xinghuo.xfyun.cn/sparkapi> 领取 Lite 免费额度 → 控制台 <https://console.xfyun.cn/services/cbm> 对应版本页面获取 **APIPassword**
  - 设置页：AppKey 填 APIPassword，模型名留空默认 `lite`
- **MaaS 星辰平台（新平台）**：免费与否以服务卡片为准（价格见 <https://training.xfyun.cn/account>），OpenAI 兼容端点 `maas-api.cn-huabei-1.xf-yun.com/v2`
  - 申请：<https://console.xfyun.cn> 实名认证 → MaaS 平台领取服务 → 创建 API Key（`ak-` 开头）
  - 设置页：AppKey 填 `ak-` 开头的 APIKey，**模型名必填服务卡片上的 modelId**（形如 `xspark13b6k`，是领取服务时按账号生成的，不是友好名，也不是全局通用值）
- 代码按 AppKey 格式自动路由：`ak-` 开头 → MaaS；其余 → 旧平台

### 讯飞机器翻译（传统 ITS 接口）

- 传统神经网络翻译，响应快、术语一致性好；新用户送限时免费包（注意：免费额度通常有时间限制，非永久）
- 申请：<https://www.xfyun.cn/services/xftrans_new> 开通后获取 APPID / APIKey / APISecret 三个凭证
- 设置页填到「讯飞机器翻译」：AppKey 填 `APPID:APIKey`（冒号分隔），SecretKey 填 `APISecret`

### 腾讯混元 hunyuan-lite（已暂停展示）

- 免费模型：`hunyuan-lite`（官方宣称永久免费不限量）
- ⚠️ 腾讯原混元平台将于 2026-09-30 停服并迁移至 TokenHub，新平台暂无明确免费政策，**设置页已暂不展示该引擎**，待新平台政策明朗后再恢复

### MiniMax

- `MiniMax-M2.7` 有免费额度
- 申请：<https://platform.minimaxi.com/>

### 七牛 AI（OpenAI 兼容大模型网关）

- 新用户有免费 token 额度，默认模型 `deepseek-v3`，可在设置页改其他模型
- 申请：<https://portal.qiniu.com/ai-inference> 创建 API Key

## 三、传统翻译 API（免费额度，按月重置）

| 平台 | 免费额度 | 申请入口 |
|---|---|---|
| 百度翻译 | 标准版 100 万字符/月（QPS=1） | <https://fanyi-api.baidu.com/choose> |
| 腾讯翻译 | 500 万字符/月 | 腾讯云控制台开通机器翻译 |
| 有道翻译 | 新用户体验金 | <https://ai.youdao.com/console> |
| 阿里翻译 | 100 万字符/月 | <https://mt.console.aliyun.com/service> |
| 微软翻译（Azure 正式版） | 200 万字符/月（需绑卡验证，国内双币卡一般可行） | Azure 门户创建 Text Translation 资源，填「订阅 Key + 区域」 |
| DeepL | 50 万字符/月（**需海外发行的信用卡**，国内卡不支持） | <https://www.deepl.com/pro-api> |

## 四、本地大模型（完全免费，隐私最好）

- 安装 [Ollama](https://ollama.com/download)，运行 `ollama run qwen2.5:0.5b`
- 设置页「ollama」填服务地址（默认 `http://localhost:11434`）和模型名

## 安全说明（给开发者）

- 内置共享 key 仅用于**官方免费模型**；`getTranslationApiKey` 已做整体回退：用户未填自己的 appkey 时模型名强制锁定为内置默认值，无法切换为付费模型
- 内置 key 被平台判定额度耗尽（456/429）时，引擎在会话内自动停服并提示用户自填 key
- 每个免 key/内置 key 用户另有每日免费次数限制（`USAGE_LIMITS`），自填 key 后不受限
