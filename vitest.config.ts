import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { resolve } from 'path'

export default defineConfig({
  plugins: [vue()],
  define: {
    // 测试环境恒为非商店构建（保留内置密钥与 Bing 网页版翻译的完整代码路径）
    __STORE_BUILD__: 'false',
    // 测试按桌面 uTools 端路径运行（与既有测试的默认平台一致）
    __PLATFORM__: JSON.stringify('utools'),
  },
  test: {
    // 开发机高负载下，首个用例的动态 import 可能超过默认 10s 钩子超时（全量并发跑偶发 flake 的根因）
    hookTimeout: 30000,
    environment: 'node',
    globals: true,
    setupFiles: ['src/test-setup.ts'],
    include: ['src/**/*.{test,spec}.{js,ts}', 'mobile/src/**/*.{test,spec}.{js,ts}', 'scripts/scf/**/*.test.{js,ts}'],
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
      // mobile 精简 MD5：mobile 代码以 @/utils/md5 引用，同上需优先映射到 mobile 目录
      { find: /^@\/utils\/md5$/, replacement: resolve(__dirname, 'mobile/src/utils/md5.ts') },
      // mobile 预合成口语音频定位：mobile 代码以 @/utils/speech-audio 引用，
      // 需优先映射到 mobile 目录，避免落到桌面端 src/utils/speech-audio（依赖 crypto-js）
      { find: /^@\/utils\/speech-audio$/, replacement: resolve(__dirname, 'mobile/src/utils/speech-audio.ts') },
      // mobile 预合成诗词朗读音频定位：mobile 代码以 @/utils/poetry-audio 引用，同上
      { find: /^@\/utils\/poetry-audio$/, replacement: resolve(__dirname, 'mobile/src/utils/poetry-audio.ts') },
      // mobile 默写对比 LCS：mobile 代码以 @/utils/text-compare 引用，同上
      { find: /^@\/utils\/text-compare$/, replacement: resolve(__dirname, 'mobile/src/utils/text-compare.ts') },
      // mobile jsDelivr 镜像变体：mobile 代码以 @/utils/cdn-mirror 引用，同上
      { find: /^@\/utils\/cdn-mirror$/, replacement: resolve(__dirname, 'mobile/src/utils/cdn-mirror.ts') },
      // mobile 轻量在线翻译：mobile 代码以 @/utils/quick-translate 引用，同上
      { find: /^@\/utils\/quick-translate$/, replacement: resolve(__dirname, 'mobile/src/utils/quick-translate.ts') },
      // mobile 「点选拼答案」碎片工具：桌面端无此模块，测试解析时必须指向 mobile 目录
      { find: /^@\/utils\/answer-tokens$/, replacement: resolve(__dirname, 'mobile/src/utils/answer-tokens.ts') },
      // mobile 首页快速入口注册表：mobile 代码以 @/utils/home-quick-entries 引用，同上
      { find: /^@\/utils\/home-quick-entries$/, replacement: resolve(__dirname, 'mobile/src/utils/home-quick-entries.ts') },
      // mobile 功能开关：home-quick-entries 等以 @/utils/feature-flags 引用，同上
      { find: /^@\/utils\/feature-flags$/, replacement: resolve(__dirname, 'mobile/src/utils/feature-flags.ts') },
      // mobile 音标数据：mobile 代码以 @/utils/phoneme-data 引用，
      // 需优先映射到 mobile 目录，避免落到桌面端 src/utils/phoneme-data（无 PHONEME_CHANT）
      { find: /^@\/utils\/phoneme-data$/, replacement: resolve(__dirname, 'mobile/src/utils/phoneme-data.ts') },
      // mobile 字母映射预设：mobile 代码以 @/utils/letter-preset 引用，同上需优先映射到 mobile 目录
      { find: /^@\/utils\/letter-preset$/, replacement: resolve(__dirname, 'mobile/src/utils/letter-preset.ts') },
      // mobile 轻量复习调度：subPackages 内代码以 @/utils/practice-srs 引用，同上
      { find: /^@\/utils\/practice-srs$/, replacement: resolve(__dirname, 'mobile/src/utils/practice-srs.ts') },
      // mobile 单词 store：mobile 代码以 @/stores/useMobileWords 引用，
      // 需优先映射到 mobile 目录，避免落到桌面端 src/stores（不存在该文件）
      { find: /^@\/stores\/useMobileWords$/, replacement: resolve(__dirname, 'mobile/src/stores/useMobileWords.ts') },
      // 移动端词集 store：播种与同步测试需要优先解析到 mobile 目录
      { find: /^@\/stores\/useWordBook$/, replacement: resolve(__dirname, 'mobile/src/stores/useWordBook.ts') },
      // 移动端文本记忆页面同样通过 @/stores 引用，测试时需优先于桌面端通用别名
      { find: /^@\/stores\/useTextMemory$/, replacement: resolve(__dirname, 'mobile/src/stores/useTextMemory.ts') },
      // 移动端音标记忆 store：mobile 单词页以 @/stores/usePhoneticMemory 引用，同上需优先映射到 mobile 目录
      { find: /^@\/stores\/usePhoneticMemory$/, replacement: resolve(__dirname, 'mobile/src/stores/usePhoneticMemory.ts') },
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