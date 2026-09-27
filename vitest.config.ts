import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    // 开发机高负载下，首个用例的动态 import 可能超过默认 10s 钩子超时（全量并发跑偶发 flake 的根因）
    hookTimeout: 30000,
    environment: 'node',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}', 'mobile/src/**/*.{test,spec}.{js,ts}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/utils/**/*.ts', 'src/stores/**/*.ts', 'src/adapters/**/*.ts', 'mobile/src/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.test.ts', 'src/**/*.spec.ts']
    }
  },
  resolve: {
    alias: [
      { find: /^@\/adapters(\/index)?$/, replacement: resolve(__dirname, 'mobile/src/adapters/index') },
      { find: /^@\/stores$/, replacement: resolve(__dirname, 'mobile/src/stores') },
      { find: /^@\/utils$/, replacement: resolve(__dirname, 'mobile/src/stores/useUtils') },
      // mobile/src/utils 下的模块（远程词库下载等），mobile 代码以 @/utils/xxx 引用，
      // 需优先映射到 mobile 目录，避免落到桌面端 src/utils（不存在该文件）
      { find: /^@\/utils\/remote-wordbank$/, replacement: resolve(__dirname, 'mobile/src/utils/remote-wordbank.ts') },
      // mobile 单词发音统一入口：mobile 代码以 @/utils/word-audio 引用，
      // 需优先映射到 mobile 目录，避免落到桌面端 src/utils（不存在该文件）
      { find: /^@\/utils\/word-audio$/, replacement: resolve(__dirname, 'mobile/src/utils/word-audio.ts') },
      // mobile 中文发音音源：mobile 代码以 @/utils/youdao-tts 引用，同上需优先映射到 mobile 目录
      { find: /^@\/utils\/youdao-tts$/, replacement: resolve(__dirname, 'mobile/src/utils/youdao-tts.ts') },
      // mobile 单词 store：mobile 代码以 @/stores/useMobileWords 引用，
      // 需优先映射到 mobile 目录，避免落到桌面端 src/stores（不存在该文件）
      { find: /^@\/stores\/useMobileWords$/, replacement: resolve(__dirname, 'mobile/src/stores/useMobileWords.ts') },
      // mobile 端的 `import ... from '@/config'`（不带扩展名）指向 mobile/src/config.ts，
      // 桌面端使用 `@/config.ts`（带扩展名），由后面通用规则解析到 src/config.ts
      { find: /^@\/config$/, replacement: resolve(__dirname, 'mobile/src/config.ts') },
      // mobile 的 stores/useUtils 子模块和 subPackages 内部 import `@/stores/useUtils/xxx`，
      // 需要先匹配到 mobile 目录，避免被通用的 `@/` -> src/ 拦截
      { find: /^@\/stores\/useUtils\/(.+)$/, replacement: resolve(__dirname, 'mobile/src/stores/useUtils') + '/$1' },
      { find: /^@\/subPackages\/pages-tools\/(.+)$/, replacement: resolve(__dirname, 'mobile/src/subPackages/pages-tools') + '/$1' },
      // useUtils.ts 中 uni-app 条件编译里的动态 import 路径
      // 测试环境下用 stub 代替，避免 Vite import-analysis 报错
      { find: /^@\/wordbanks\/.*\.ts$/, replacement: resolve(__dirname, 'mobile/src/stores/__wordbank-stub.ts') },
      { find: /@\/subPackages\/wordbank-\w+\/wordbanks\/\w+/, replacement: resolve(__dirname, 'mobile/src/stores/__wordbank-stub.ts') },
      { find: /^@\//, replacement: resolve(__dirname, 'src/') + '/' },
      { find: /^@shared\//, replacement: resolve(__dirname, 'src/') + '/' },
    ],
  },
})