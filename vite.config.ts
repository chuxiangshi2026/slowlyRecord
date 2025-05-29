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
            '/api': { // 获取请求中带 /api 的请求
                target: 'https://openapi.youdao.com/api',  // 后台服务器的源
                changeOrigin: true,   // 修改源
                rewrite: (path) => path.replace(/^\/api/, "")   //  /api 替换为空字符串
            }
        }
    }, css: {
        preprocessorOptions: {
            scss: {
                api: 'modern-compiler'
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
    assetsInclude: ['**/*.woff2', '**/*.woff', '**/*.ttf']
})
