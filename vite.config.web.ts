import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'
import { VitePWA } from 'vite-plugin-pwa'

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
    Components({resolvers: [ElementPlusResolver({importStyle: 'css'})]}),
    // PWA 只给 Web 目标启用。uTools/Electron 有自己的窗口与更新机制，不能套 Service Worker。
    VitePWA({
      // 新 SW 等旧标签页全部关闭后下次启动生效，避免复习途中切 SW 导致旧懒加载 chunk 失效
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['logo.png', 'lang-core.js', 'privacy.html'],
      includeManifestIcons: false,
      manifest: {
        id: './',
        name: '慢记 - 记忆训练工具',
        short_name: '慢记',
        description: '基于艾宾浩斯遗忘曲线的背单词与多场景记忆训练工具',
        lang: 'zh-CN',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#eaf1ea',
        theme_color: '#52796f',
        icons: [
          {src: 'pwa-192.png', sizes: '192x192', type: 'image/png'},
          {src: 'pwa-512.png', sizes: '512x512', type: 'image/png'},
          {src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable'},
        ],
      },
      workbox: {
        // 只预缓存应用壳和带 hash 的代码块；词库/诗词/OCR 等大资源走运行时按需缓存
        globPatterns: [
          'index.html',
          'assets/**/*.{js,css,woff2,woff,ttf}',
          'pwa-*.png',
          'apple-touch-icon.png',
        ],
        globIgnores: ['**/plugin.json', '**/preload/**'],
        maximumFileSizeToCacheInBytes: 2.5 * 1024 * 1024,
        // hash 路由下所有页面共用 index.html；静态内容页/隐私页走真实文件，不能被回退吞掉
        navigateFallback: 'index.html',
        navigateFallbackDenylist: [/^\/wordbank\//, /^\/poem\//, /^\/poet\//, /^\/dynasty\//, /\.html$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // 词库/诗词/知识包这类会修订的内容：先用缓存保证离线，再后台拉新版本
            urlPattern: ({url, sameOrigin}) =>
              sameOrigin &&
              ['/wordbanks/', '/datafile/', '/knowledgebanks/', '/shortcuts/']
                .some(prefix => url.pathname.includes(prefix)),
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'sr-data-v1',
              expiration: {maxEntries: 200, maxAgeSeconds: 30 * 24 * 60 * 60},
              cacheableResponse: {statuses: [0, 200]},
            },
          },
          {
            // 背景图、OCR 语言包等大文件：首次在线加载后长期缓存，避免重复下载
            urlPattern: ({url, sameOrigin}) =>
              sameOrigin &&
              ['/tessdata/', '/static/', '/bg/', '/memory-palace/']
                .some(prefix => url.pathname.includes(prefix)),
            handler: 'CacheFirst',
            options: {
              cacheName: 'sr-assets-v1',
              expiration: {maxEntries: 200, maxAgeSeconds: 90 * 24 * 60 * 60},
              cacheableResponse: {statuses: [0, 200]},
            },
          },
        ],
      },
    }),
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
    __PLATFORM__: JSON.stringify('web'),
  },
  esbuild: {
    pure: ['log.d', 'log.i', 'console.log'],
  },
})
