import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  base: './',
  plugins: [
    vue(),
    vueJsx(),
    electron([
      {
        // 主进程入口
        entry: 'electron/main.js',
      },
      {
        // preload 脚本
        entry: 'electron/preload.js',
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
    },
  },
  assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf', '**/*.traineddata'],
  define: {
    __LOG_LEVEL__: 1,
    __PLATFORM__: JSON.stringify('electron'),
  },
  esbuild: {
    pure: ['log.d', 'log.i'],
  },
})
