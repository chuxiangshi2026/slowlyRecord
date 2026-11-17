import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueJsx(),
    Components({resolvers: [ElementPlusResolver({importStyle: 'css'})]}),
    electron([
      {
        // 主进程入口
        entry: 'electron/main.cjs',
      },
      {
        // preload 脚本
        entry: 'electron/preload.cjs',
        onstart(args) {
          args.reload()
        },
      },
      {
        // 子窗口 preload（专注模式 / 输入法键盘悬浮窗，注入 utools shim）
        entry: 'electron/preload-child.cjs',
        onstart(args) {
          args.reload()
        },
      },
    ]),
    renderer(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 3000,
  },
  css: {
    preprocessorOptions: {
      scss: {},
    },
  },
  build: {
    assetsDir: 'assets',
    outDir: 'dist-electron',
    rollupOptions: {
      input: {
        main: './index.html',
      },
      output: {
        manualChunks: {
          echarts: ['echarts/core', 'echarts/charts', 'echarts/components', 'echarts/renderers'],
          'vue-vendor': ['vue', 'vue-router', 'pinia', 'pinia-plugin-persistedstate', 'vue-virtual-scroller'],
        },
      },
    },
  },
  assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf', '**/*.traineddata'],
  define: {
    __LOG_LEVEL__: 1,
    __PLATFORM__: JSON.stringify('electron'),
    // 默认保留内置密钥（自有渠道分发）；发布到公开渠道（GitHub Release）时用
    // VITE_STORE_BUILD=true 构建，去掉内置密钥并隔离必应网页版翻译
    __STORE_BUILD__: JSON.stringify(process.env.VITE_STORE_BUILD === 'true'),
  },
  esbuild: {
    pure: ['log.d', 'log.i', 'console.log'],
  },
})
