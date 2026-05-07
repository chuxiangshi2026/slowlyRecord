import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// Web 版构建配置
// 与默认配置类似，但：
// 1. 不包含 uTools/Electron 专用代码（通过 __PLATFORM__ 条件编译）
// 2. 不输出 plugin.json / preload 等 uTools 专用文件
export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueJsx(),
    vueDevTools(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
    proxy: {
      '/api/youdao': {
        target: 'https://openapi.youdao.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/youdao/, ''),
      },
      '/api/baidu-ocr': {
        target: 'https://aip.baidubce.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/baidu-ocr/, ''),
      },
      '/api/ali': {
        target: 'https://mt.aliyuncs.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/ali/, ''),
      },
    },
  },
  css: {
    preprocessorOptions: {
      scss: {},
    },
  },
  build: {
    assetsDir: 'assets',
    outDir: 'dist-web',
    rollupOptions: {
      input: {
        main: './index.html',
      },
    },
  },
  assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf', '**/*.traineddata'],
  define: {
    __LOG_LEVEL__: 1,
    __PLATFORM__: JSON.stringify('web'),
  },
  esbuild: {
    pure: ['log.d', 'log.i'],
  },
})
