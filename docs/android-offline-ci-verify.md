# Android 离线打包 CI 验证

本目录（`.github/workflows/android-ci.yml`）+ `mobile/vite.config.ts` 的组合，用来验证 **UniApp Android 端能在 GitHub Actions 里跑通完整编译链路**。

## 当前状态（阶段 1）

- ✅ 自动 `npm ci`
- ✅ 自动 `uni build -p app --minify` 产出 `mobile/dist/build/app/`
- ✅ 归档 `www/` 资源目录为 artifact（7 天保留）

**尚未做**：APK 打包（需接入 DCloud Android 壳工程 + Gradle + 签名，见下方阶段 2）。

## 触发方式

- 手动：GitHub → Actions → "Android Offline Build (Verify)" → Run workflow
- 自动：推 master 且改动 `mobile/**` 或本 workflow 文件时

## 已知修复（关键）

`mobile/vite.config.ts` 顶部有一个 `fixChunkFileNames` 后置插件，修了两个 uni-app alpha 版 App 编译链路的坑：

1. **`iife` format 与 code-splitting 冲突**：uni-app 默认 `output.format='iife'`，iife 不支持多 chunk。分包触发 code-splitting 时构建失败。修复：`package.json` 里 `build:app-android` 加环境变量 `UNI_APP_CODE_SPLITTING=1`，让 format 变成 `amd`。
2. **`chunkFileNames` 相对路径报错**：uni-app 用 `path.relative(inputDir, facadeModuleId)` 生成 chunk 文件名，chunk 落在 `node_modules/pako/...` 时算出 `../node_modules/...`，Vite 拒绝相对路径。修复：后置插件 override `chunkFileNames`——inputDir 之外的模块（node_modules 等）basename 兜底到 `chunks/<file>.js`；**inputDir 之内的源码模块与页面/组件虚拟模块保留源路径相对命名**（页面 js 落回 pages/ 或 subPackages/ 下的真实位置，与 app.json 路由一致；分包内模块 chunk 计入分包而非主包。若一律 basename 到 `chunks/`，这些 chunk 全部计入主包）。另：该 alpha 版把 mp-weixin 的 `import()` 编译成纯字符串字面量（动态 import 真机不可用），移动端代码一律静态 import。

**别删这两个修复**，删了 CI 立刻挂。

## 版本升级注意

- `mobile/package.json` 里 `@dcloudio/*` 全部锁到 `3.0.0-alpha-5020620260914001`。
- 升级前先确认新版仍然需要 `UNI_APP_CODE_SPLITTING=1`；如果新版改了配置策略，vite.config.ts 里的后置插件可能也需要调整。
- 升级后**必须本地跑一次 `npm run build:app-android`** 通过再提交，避免 CI 才发现。

## 阶段 2：出 APK（TODO）

出真 APK 需要：

1. **DCloud Android 壳工程**：下载 `HBuilder-Integrate-AS-Gradle`（Vue3 版），需要登录 DCloud 账号。
2. **把壳工程提交到仓库**：MIT 协议可公开。
3. **CI 里增加**：把 `dist/build/app/` 拷进壳工程的 `assets/apps/__UNI__SLOWLYRECORD/www/`，然后 `./gradlew assembleRelease`。
4. **签名**：本地生成 `slowlyrecord.jks`，密码上传到 GitHub Secrets，`build.gradle` 引用。
5. **权限**：把 `mobile/manifest.json` 里的权限同步到壳工程的 `AndroidManifest.xml`。

阶段 2 完成后，把当前 workflow 里的 `run` 步骤替换成 Gradle 打包，产物从 `www/` 换成 `APK`。

## 本地验证命令

```bash
cd mobile
npm ci
npm run build:app-android
# 产物在 dist/build/app/
```
