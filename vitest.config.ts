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
      { find: /^@\/adapters$/, replacement: resolve(__dirname, 'mobile/src/adapters/index') },
      { find: /^@\/stores$/, replacement: resolve(__dirname, 'mobile/src/stores') },
      { find: /^@\/utils$/, replacement: resolve(__dirname, 'mobile/src/stores/useUtils') },
      { find: /^@\//, replacement: resolve(__dirname, 'mobile/src/') + '/' },
      { find: /^@shared\//, replacement: resolve(__dirname, 'src/') + '/' },
    ],
  },
})