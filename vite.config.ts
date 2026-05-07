import {fileURLToPath, URL} from 'node:url'

import {defineConfig} from 'vite'
import vue from '@vitejs/plugin-vue'
import vueJsx from '@vitejs/plugin-vue-jsx'
import vueDevTools from 'vite-plugin-vue-devtools'

// https://vite.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        vue(),
        vueJsx(),
        vueDevTools(),
    ],
    resolve: {
        alias: {
            '@': fileURLToPath(new URL('./src', import.meta.url))
        },
    },
    // 配置代理
    server: {
        host: '0.0.0.0',
        port: 3000,
        proxy: {
            '/api/youdao': { // 有道API代理
                target: 'https://openapi.youdao.com',  // 后台服务器的源
                changeOrigin: true,   // 修改源
                rewrite: (path) => path.replace(/^\/api\/youdao/, "")   //  /api/youdao 替换为空字符串
            },
            '/api/baidu-ocr': { // 百度OCR API代理
                target: 'https://aip.baidubce.com',  // 后台服务器的源
                changeOrigin: true,   // 修改源
                rewrite: (path) => path.replace(/^\/api\/baidu-ocr/, "")   //  /api/baidu-ocr 替换为空字符串
            },
            '/api/ali': { // 阿里云API代理
                target: 'https://mt.aliyuncs.com',  // 阿里云服务器
                changeOrigin: true,   // 修改源
                rewrite: path => path.replace(/^\/api\/ali/, '') // 去掉前缀
            }
        }
    }, css: {
        preprocessorOptions: {
            scss: {
                // api: 'modern-compiler'
            }
        }
    } ,build: {
        assetsDir: 'assets',
        rollupOptions: {
            input: {
                main: './index.html'
            }
        }
    },
    assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf', '**/*.traineddata'],
    define: {
        __LOG_LEVEL__: 1,              // 2=WARN， 0=DEBUG， 4=SILENT
        __PLATFORM__: JSON.stringify(process.env.VITE_PLATFORM || 'utools'),
    },
    esbuild: {
        pure: ['log.d', 'log.i'],      // 生产环境把 debug/info 整行抹掉
    },
})
