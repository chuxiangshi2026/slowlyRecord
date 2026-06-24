import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  test: {
    environment: 'node',
    globals: true,
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