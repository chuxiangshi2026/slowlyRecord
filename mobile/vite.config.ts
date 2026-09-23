import { defineConfig, Plugin } from 'vite'
import uni from '@dcloudio/vite-plugin-uni'
import { resolve } from 'path'

// App 端分包编译链路两个坑（uni-app alpha 版已知问题）：
// 1. 默认 output.format='iife'（uni-app-vite/dist/vue/plugin/index.js:38），
//    iife 不支持多 chunk。subPackages 触发 code-splitting 时构建直接失败。
//    → 设 UNI_APP_CODE_SPLITTING=1 让 format 变成 'amd'。
// 2. chunkFileNames 用 path.relative(inputDir, facadeModuleId) 生成文件名，
//    当 chunk 落在 node_modules（如 pako）里时算出 "../node_modules/..."，
//    Vite 拒绝相对路径 pattern。
//    → 后置插件 override chunkFileNames，在 uni 默认「源路径相对」语义的基础上：
//      - 页面/组件虚拟模块（uniPage:/uniComponent:，末段为源路径的 base64）解码回
//        真实路径，页面 js 落在 pages/ 或 subPackages/ 下的真实位置（与 app.json
//        路由一致，分包页面 js 计入分包）；
//      - inputDir 内源码模块：源路径相对命名（分包内模块落进分包目录，不计入主包）；
//      - inputDir 之外（node_modules 等）：basename 兜底到 chunks/<file>.js（修坑 2）。
//    非动态入口（manualChunks 按模块生成的 chunk）：name 以 subPackages/ 开头的
//    落回真实分包目录（[name].js），其余维持 chunks/[name].js（主包 vendor 等）。
//    注意：主包 chunk 不能 require 分包文件（微信限制），本仓库主包源码无 subPackages/
//    引用，方向安全；分包 → 主包引用是允许的。
//
// 后置插件通过 config hook 的 order:'post' 在 uni plugin 之后运行，覆盖 output。
function fixChunkFileNames(): Plugin {
  return {
    name: 'slowly-record:fix-chunk-filenames',
    enforce: 'post',
    config(_config, env) {
      if (env.command !== 'build') return
      return {
        build: {
          rollupOptions: {
            output: {
              chunkFileNames(chunk) {
                const inputDir = (process.env.UNI_INPUT_DIR || '').replace(/\\/g, '/')
                if (chunk && chunk.isDynamicEntry && chunk.facadeModuleId) {
                  const rawId = chunk.facadeModuleId.replace(/\\/g, '/')
                  const id = rawId.split('?')[0]
                  // 页面/组件虚拟模块：末段是源相对路径（或绝对路径）的 base64
                  if (rawId.includes('uniPage:/') || rawId.includes('uniComponent:/')) {
                    const last = id.split('/').pop() || ''
                    let decoded = ''
                    try {
                      decoded = Buffer.from(last, 'base64').toString('utf8')
                    } catch {
                      decoded = ''
                    }
                    if (/^(\/?[A-Za-z0-9_./-]+)\.vue$/.test(decoded) && !decoded.includes('..')) {
                      let rel = decoded.replace(/\.vue$/, '.js')
                      if (rel.startsWith('/') && inputDir) {
                        if (!rel.startsWith(inputDir + '/')) {
                          // 绝对路径但不在 inputDir 内：basename 兜底
                          rel = ''
                        } else {
                          rel = rel.slice(inputDir.length + 1)
                        }
                      }
                      if (rel) return rel
                    }
                  }
                  if (inputDir && id.startsWith(inputDir + '/')) {
                    // 源码模块：沿用 uni 默认的源路径相对命名
                    const rel = id.slice(inputDir.length + 1).replace(/\.[^./]+$/, '')
                    return `${rel}.js`
                  }
                  // inputDir 之外（node_modules 等）：basename 兜底，避免 ../ 相对路径报错
                  const file = id.split('/').pop() || 'chunk'
                  return `chunks/${file.replace(/\.[^.]+$/, '.js')}`
                }
                // manualChunks 生成的分包内模块 chunk：落回真实分包目录
                if (chunk && chunk.name && chunk.name.startsWith('subPackages/')) {
                  return '[name].js'
                }
                return 'chunks/[name].js'
              },
            },
          },
        },
      }
    },
  }
}

export default defineConfig({
  plugins: [
    uni(),
    fixChunkFileNames(),
  ],
  publicDir: resolve(__dirname, 'public'),
})
