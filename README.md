# slowlyRecord

This template should help get you started developing with Vue 3 in Vite.

## Recommended IDE Setup

[VSCode](https://code.visualstudio.com/) + [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) (and disable Vetur).

## Type Support for `.vue` Imports in TS

TypeScript cannot handle type information for `.vue` imports by default, so we replace the `tsc` CLI with `vue-tsc` for type checking. In editors, we need [Volar](https://marketplace.visualstudio.com/items?itemName=Vue.volar) to make the TypeScript language service aware of `.vue` types.

## Customize configuration

See [Vite Configuration Reference](https://vite.dev/config/).

## Project Setup

```sh
npm install
```

### Compile and Hot-Reload for Development

```sh
npm run dev
```

### Type-Check, Compile and Minify for Production

```sh
npm run build
```


### 功能列表
#### 当前版本功能
-[x] 数据库持久化  ok
-[x] 导入，导出  2025年4月23日 ok
-[x] 播放声音 2025年4月21日ok
  - https://dict.youdao.com/dictvoice?audio=look&type=1 这个地址可能不需要用key
- 20250528
-[x] 打包后无法正确调用接口
#### 下个版本功能
- 播放声音 （是否能下载到本地，减少调用接口的次数）ok
- 显示音标
  - https://mobile.youdao.com/dict?le=eng&q=red
  - <span class="phonetic">[red]</span>  这里能找到
- 修改单词翻译（减少调用接口的次数）
- 加入本地翻译功能
-[x] 打包后图标无法正确显示 
-[ ] 导入成功后,打开列表面板,不然操作不太统一
-[ ] 播放音频,没有音频的功能要先查后存
- [] 新增单词要放在第一列,并定位到第一列
- [] 已记完,显示不对(应该统计最高等级的词数,或单加一个字段不再复习),再添加一个,当前已复习数

- bug
  - 如果是之前导入的单词无法听声音
  - 添加过的单词,再次添加,不会放到前面
- 功能
  - 翻译统一隐藏
### 项目简单说明
- 目前以本地数据库为准，如果数据不一致，会以本地数据库为准，后期可以看一下是否需要判断数据库是否一直为最新

words
