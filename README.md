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
  - 播放声音 （是否能下载到本地，减少调用接口的次数）ok
- 20250528
  -[x] 打包后无法正确调用接口
  -[x] 打包后图标无法正确显示 
- 20251118
  - bug
    1. 修复统计错误
    2. 列表没有单词时,改为显示没有数据
  - 功能 
    1. 添加永久记住功能
    2. 修改单词默认等级从1级开始
    3. 添加一键显示与隐藏释义功能 
    4. 添加置顶置底功能
    5. 添加定位到新增单词功能
- 2025119
  - 修复数据库保存未成功
#### 下个版本功能
- 待添加功能
  1. [] 修改单词翻译（减少调用接口的次数）加入本地(无网)翻译功能
  3. [] 已记完的单词,查看,导出
  4. [] 多端同步功能
  5. [] 切换词库
  7. [] 更新插件使用说明 ,与截图
  8. [] 永久记住单词,单独查看,导出,与恢复 (给一个状态,如果是记住,其他按钮禁用)
- bug
  - 一级
    - [] 显示音标
        - https://mobile.youdao.com/dict?le=eng&q=red
        - <span class="phonetic">[red]</span>  这里能找到
    - [] 如果查询不到单词,或者网络有问题,最次也要把原内容直接存起来,不要报错
  - 二级
      -[] 如果是之前导入的单词无法听声音
      -[ ] 导入成功后,打开列表面板,不然操作不太统一
      -[ ] 播放音频,没有音频的功能要先查后存
  - 三级
    - [] 单词越来越多时,打开主界面时间过长
- 当前版本更新的内容
  1. [x] 支持txt或csv导入,并补全导入文件的释义与发音.(导入说明,txt与csv一行一个单词,支持直接单词或完整格式)
  2. [x] 添加按钮文字提示
### 项目简单说明
- 目前以本地数据库为准，如果数据不一致，会以本地数据库为准，后期可以看一下是否需要判断数据库是否一直为最新



