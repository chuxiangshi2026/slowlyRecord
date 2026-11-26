---
name: utools-plugin-selfcheck
description: uTools 插件开发者提交审核前自查时使用：对单个插件目录做静态检查，按官方审核标准找出会被拒或要求修改的问题，输出「必须整改 /
  建议整改」自查报告。用户说插件自查、提交前检查、为什么审核没过、帮我看看插件能不能上架时使用。只读不执行插件代码，不连接任何审核接口。
---
# uTools 插件自查

在提交 uTools 插件市场审核之前，用和官方审核相同的标准检查**一个**插件，告诉开发者哪些问题会导致拒绝、哪些要改完才能通过、哪些是建议优化。自查结果仅供参考，最终以官方审核为准。与开发者交流用简体中文（开发者用其他语言时跟随）。

## 1. 输入与边界

- **输入**：插件根目录，即包含 `plugin.json`、准备打包提交的那个目录（通常是构建产物目录，如 `dist/`，而不是源码工程根目录）。开发者只给了工程根目录时，先找到 `plugin.json` 所在目录；源码目录和构建目录都存在时，以构建目录为准检查发行内容，读源码辅助理解。
- **只做静态检查**：不安装依赖、不启动插件、不执行包内任何脚本或二进制。
- **默认只读**：不修改开发者的文件。开发者明确要求修复时，再按报告逐条改，改完重新跑对应检查。
- **不涉及审核后台**：不调用任何审核接口，不需要也不索要 token 或密钥。
- **工具调用纪律**：每个响应只发 1 个工具调用；要多个命令的结果就合成一条命令（用 `;` 或 `&&` 串联）。不要把两组参数拼进一个调用（如 `{"command":"a"}{"command":"b"}`），那会让整轮作废。
- **读取纪律**：先 `wc -l` / `wc -c` 判断文件形态；单行或压缩文件（Vite / webpack 产物、`.min.js`）不要 `cat`、整读或 `grep -n`，用 `grep -c` 判有无，需要原文时只截命中处前后 ≤400 字符。

## 2. 审核标准

### 2.1 不允许上架（会被拒绝）

- 对用户的计算机、数据或隐私有害：后门、病毒、盗取隐私、未告知的数据采集与外传、破坏性操作。
- 版权、商标侵权或抄袭：盗版影视、音乐、图片、教材；未经授权使用他人商标或品牌命名（插件名、页面标题、品牌位）；抄袭他人插件或作品。
- 暴力、仇恨、色情内容；政治谣言。
- 宣称的价值或功能与实际不符：商店描述、更新说明、界面文案夸大或虚假。
- **剪贴板监听**：持续监听或轮询剪贴板（剪贴板历史、自动捕获复制内容等）不再收录。用户主动触发某功能时读一次剪贴板没问题。
- **损害第三方平台的接入**：刻意突破平台的风控或访问限制（批量刷量、绕过验证码 / 登录 / 付费墙等）、抓取他人账号或非公开数据、伪造学习 / 考勤 / 交易记录。自动化场景下设置 Referer / UA、调用网页接口本身没问题，只有用于上述目的时才会被拒绝。
- **无法核对安全性的原生二进制**：`.exe` / `.dll` / `.so` / `.dylib` / `.node`（含 `node_modules/*/prebuilds/**`）。来源可核对的本地 WebAssembly 可以；可读脚本（`.js`、`.ps1`、`.sh` 等）不算二进制。
- **preload 及其依赖不可读、无法确认安全性**：`preload.js` 和它 `require` 的本地文件必须保持明文可读，不得编译、打包、压缩或混淆（如单行压缩、`_0x` 式混淆、字符串整体编码、bytenode `.jsc`）；preload 用到的 npm 包必须随包提交，使用了 `node_modules` 的需把整个文件夹一并提交，不能只拷一部分。前端构建产物不受这条限制。

### 2.2 必须整改（改完可以通过）

- **preload 暴露能力过宽**：把 `fs`、`child_process` 等直接挂到 `window`，或提供「读写任意路径 / 执行任意命令 / 请求任意 URL」的通用函数。授权白名单能被页面自己写入（如页面可调 `grantAccess(任意路径)`）也算。
- **运行时加载远程代码**：`eval` / `new Function` 执行远程内容、动态 `import` 外部 URL、页面引用外部 `<script>`、下载可执行文件后运行。
- **写死密钥、token、账号**；接入未经批准的登录或支付；未告知的统计上报，尤其上报内容含剪贴板、输入原文或用户标识。
- **同步数据库存了日志 / 缓存等非用户数据**：`utools.db` / `utools.dbStorage` 随账号同步，用来放用户数据，业务相关的历史记录（翻译 / 搜索历史、收藏、最近使用等）可以写入。日志、缓存、搜索索引、临时数据、二进制、下载文件要放插件本地数据目录或临时目录。密钥、密码等明文写入不会被拒，但建议加密后再存或只存在本地。
- **默认 logo**：uTools 模板、脚手架或 Vite / Vue / React / Electron 等框架默认图标、占位图，需要换成代表本插件的原创图标。其中 uTools 插件默认 logo（深灰圆角方块、中间方框内写「101 / 010」，参照图 `default-logo.png` 在本 skill 目录下）一定要换掉，按哈希判定。
- **发行包残留**：`.git`、`.github`、`.vscode`、`.idea`、`.map`、测试目录、构建残留、开发机路径、与功能无关的文档或参考图。
- **描述与实现不符但可改正**；收集个人信息却没有告知和隐私说明。

### 2.3 不算问题

- `plugin.json` 保留 `development.main`（如 `http://localhost:5173`）调试入口是允许的；发行用的 `main` 要是包内 `.html`。

### 2.4 建议整改（最佳实践）

结合插件本身的功能给具体建议，例如：非必要不要把业务逻辑写进 preload，preload 只保留必要的原生能力封装；preload 函数做参数校验、限定路径和命令；减少不必要的外部域名请求；大文件、依赖按需打包。只写需要改的地方。

## 3. 流程

1. **定位与概览**（一条命令）：在插件根目录读 `plugin.json`，并列出文件清单、大小和可疑文件：

   ```bash
   cd "<插件目录>" && cat plugin.json; echo '== files =='; find . -type f -not -path './node_modules/*' | head -200; echo '== count =='; find . -type f | wc -l; echo '== big =='; find . -type f -size +1M -exec ls -lh {} \; ; echo '== binaries / hygiene =='; find . \( -name '*.exe' -o -name '*.dll' -o -name '*.so' -o -name '*.dylib' -o -name '*.node' -o -name '*.map' -o -name '.git' -o -name '.github' -o -name '.vscode' -o -name '.idea' -o -name 'test' -o -name 'tests' -o -name '__tests__' \) -print
   ```

2. **preload 与 require 链**：找到 `plugin.json` 的 `preload`，列出它 `require` 的本地文件和 npm 包，逐个看向 `window` 暴露了什么、参数从哪来、是否限定路径 / 命令 / 域名：

   ```bash
   cd "<插件目录>" && wc -lc preload.js; grep -o "require(['\"][^'\"]*['\"])" preload.js | sort -u; grep -n 'window\.[A-Za-z_$]*\s*=' preload.js | head -40; grep -c 'child_process\|exec(\|spawn(\|execFile(' preload.js; grep -c 'clipboard' preload.js
   ```

   再确认 preload 及其本地依赖是明文、npm 依赖齐全（每行最长字符数过大通常说明被压缩或打包）：

   ```bash
   cd "<插件目录>" && for f in preload.js $(grep -oE "require\(['\"]\./[^'\"]+['\"]\)" preload.js | sed -E "s/require\(['\"]//; s/['\"]\)//"); do [ -f "$f" ] || f="$f.js"; echo "$f lines=$(wc -l < "$f" 2>/dev/null) maxline=$(awk '{ if (length>m) m=length } END {print m+0}' "$f" 2>/dev/null)"; done; echo '== obfuscation =='; grep -c '_0x[0-9a-f]\{4\}' preload.js; find . -name '*.jsc' -not -path './node_modules/*/test/*'; echo '== npm deps =='; for m in $(grep -oE "require\(['\"][^./'\"][^'\"]*['\"]\)" preload.js | sed -E "s/require\(['\"]//; s/['\"]\)//; s#^(@[^/]+/[^/]+|[^/]+).*#\1#" | sort -u); do case "$m" in fs|path|os|child_process|crypto|http|https|url|util|events|stream|zlib|buffer|electron|node:*) ;; *) [ -d "node_modules/$m" ] && echo "ok $m" || echo "MISSING $m";; esac; done
   ```

   重点读原文：`window.X =` 的定义体、路径校验与白名单写入点、`exec` / `spawn` 的参数、网络请求的目标和请求体、`setInterval` 里是否读剪贴板。

3. **前端（轻量）**：外部脚本、外部域名、上报、`eval`：

   ```bash
   cd "<插件目录>" && grep -rhoE 'https?://[a-zA-Z0-9._-]+' --include='*.js' --include='*.html' . | sed 's#.*//##' | sort | uniq -c | sort -rn | head -15; echo '== external script =='; grep -rlE '<script[^>]+src="https?://' --include='*.html' . ; echo '== eval =='; grep -rc 'eval(\|new Function(' --include='*.js' . | grep -v ':0$'
   ```

4. **同步数据库**：查 `utools.db` / `utools.dbStorage` 写入了什么：

   ```bash
   cd "<插件目录>" && grep -rhoE 'utools\.(db|dbStorage)\.[a-zA-Z]+' --include='*.js' . | sort | uniq -c
   ```

   有写入时截命中处看 key 名和写入内容是不是日志、缓存、搜索索引、base64 图片等（业务历史记录可以保留），以及是否明文存了密钥、密码。

5. **logo**：打开 `plugin.json` 里 `logo` 指向的图片看一眼（单独一次读图），判断是不是默认 / 框架图标或他人商标。先比对哈希，等于 `c4a8ac6e06310f40e2512d44f5eace46376351f769ac689519a8ff486c18fe62` 就是 uTools 默认 logo：

   ```bash
   cd "<插件目录>" && shasum -a 256 "$(node -p "require('./plugin.json').logo")"
   ```

6. **描述与实现**：请开发者提供商店描述和更新说明（没有就用 `plugin.json` 的 `description`、`features` 和 README），对照实际实现。

7. 输出报告（第 4 节）。

## 4. 报告格式

```text
「插件名」版本号 自查结果：<会被拒绝 / 需要修改后再提交 / 可以提交>

必须整改
1. <位置：文件:行号或函数名> <问题> <怎么改>
2. ...

建议整改
1. <位置> <建议>
2. ...

说明：自查结果仅供参考，最终以官方审核为准。<需要开发者确认或补充的信息，如商标授权、二进制来源>
```

- 结论：有 2.1 的问题写「会被拒绝」；只有 2.2 的问题写「需要修改后再提交」；都没有写「可以提交」。
- 每条必须整改写清**位置 + 问题 + 怎么改**，能给出改法示例更好。
- 某一块没有内容就整块省略，不写「无」；不写肯定或「建议保持」类的话。
- 拿不准的（如是否构成商标侵权、二进制能否核对来源）放进「说明」，提示开发者在提交时附上授权或来源证明。
