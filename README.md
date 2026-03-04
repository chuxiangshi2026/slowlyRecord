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



  - 由于截图翻译成本较高，暂时限制直接使用次数每日10次(后期看情况调整)，
  配置自己的密钥后不再限制，自己额度基本够用，截图主要使用者，希望尽量使用自己的免费额度
### 项目简单逻辑说明
- 目前以本地数据库为准，如果数据不一致，会以本地数据库为准，后期可以看一下是否需要判断数据库是否一直为最新
### 项目介绍
一个根据遗忘曲线辅助记忆单词的工具
使用方法: 主输入框输入任一正确单词后,选择"加入单词簿"，自动翻译后加入学习列表显示,主界面输入review关键字，可进入单词列表复习，
每次有效复习后会更新单词等级，延长下次复习时间，直到完成长期记忆。翻译内容支持修改，单词列表支持导入，导出。
导入支持json,txt,csv三种文件类型,每种类型有两种模板格式
1. 直接单词换行![img.png](images/img.png)
2. 完整结构,方便保留上次状态
    - json![img_1.png](images/img_1.png)
    - txt![img_2.png](images/img_2.png)



  
## 授权管理
- 阿里云配置
  - 开通翻译api调用服务https://mt.console.aliyun.com/service
  - 创建专用账户，勾选使用永久 AccessKey 访问。![img_4.png](images/img_4.png)
  - 复制AccessKey ID和AccessKey Secret,页面关闭后无法再次查看![img_5.png](images/img_5.png)
  - 点击添加授权https://ram.console.aliyun.com/users一定要同时打开管理机器翻译权限，否则无法调用 ![img_3.png](images/img_3.png)
- 百度去appkey设置
  - 注册登陆，申请成为开发者
  - https://api.fanyi.baidu.com/manage/developer
  - 开通通用文本翻译
  - https://fanyi-api.baidu.com/choose![img_6.png](img_6.png)
  - 在开发者信息中找到appid与密钥![img_7.png](images/img_7.png)
- 有道key
  - https://ai.youdao.com/console/#/service-singleton/text-translation
  - 创建应用选择文本翻译
- 千问模型
  - https://bailian.console.aliyun.com/cn-beijing/?tab=model#/efm/model_experience_center/text
- kimi
  - https://platform.moonshot.cn/console/account
- ollama
  - https://ollama.com/download
  - # 在终端1：启动服务（保持运行）`ollama serve` # 在终端2：测试模型 `ollama run qwen2.5:0.5b "你好"`
- deeskeep
  - https://platform.deepseek.com/usage

- 输入
  - mj: 单词
    - 弹出 翻译列表
      - 选择后，进入主界面
  - mj / revier
    - 直接进入主界面
  - mj: ss  /ss  
    - 截图
      - 弹出截图后 ，识别的列表
  - over
    - 直接进入主界面
  - mg:hc / hc
    - 划词添加
  
## 使用方法
- 截图翻译
  - 使用快捷键触发截图
  - 选择翻译平台（有道、百度、阿里云）
  - 系统自动识别图片中的文字并翻译
  - 结果展示在界面上
anbdand
### 功能列表
#### 版本记录
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
    4. [] 多端同步功能
- 20251124
  1. [x] 支持txt或csv导入,并补全导入文件的释义与发音.(导入说明,txt与csv一行一个单词,支持直接单词或完整格式)
  2. [x] 添加按钮文字提示
  3. [x] 修改音频缓存
    -[x] 如果是之前导入的单词无法听声音    播放音频,没有音频的功能要先查后存
- 20251129
  1. [x] 永久记住单词,单独查看,导出,与恢复 (给一个状态,如果是记住,其他按钮禁用)
  2. [x] 已记完的单词,查看,导出
  3. [x] 只导出未记住的单词
  4. [x] 添加列表单词筛选只查看对应状态下的单词
  5. [x] 优化样式
  6. [x] 添加单词释义编辑功能
  - 三级
    - [x] 单词越来越多时,打开主界面时间过长
- 20251207
  - bug
    - [x] 置项与置底功能不能用了
  1. [x] 显示释义与隐藏 （不要修改之前的状态，只是释义不再进行判断）（与记住，忘记的状态无关）
  2. [x] 划词翻译 保存功能 （是否 直接添加），
- 20260101
  1. [x] 添加设置页面
  2. [x] 添加翻译切换功能
  3. [x] 添加快捷键对首个卡片操作
  4. [x] 支持添加后直接退出插件
- 20260108
  - [x] 划词添加加入全局快捷键
  - [x] 添加个人密钥配置，保证api正常访问
  - [x] 优化代码
  - [x] 更新定位与聚焦问题
  - [x] 添加单词后，未能正常定位到新加的词上
  - [x] 新加的单词第一次应该显示释义
- 20260129
  - [x] 新增截图添加
  - [x] 新增划段添加
  - [x] 添加密钥申请地址
- 20260214
  -[x] 导入成功后,打开列表面板,不然操作不太统一
  - [x] 个人配置本地保存
  - [x] 增加翻译引擎（腾讯,utoolAI,deepseek,kimi,qwen,本地大模型ollama）
  - [x] 支持离线使用
  - [x] 可单独设置ocr与翻译引擎，包括密钥设置
  - [x] 增加多引擎密钥申请地址
  - [x] 优化截屏
  - [x] 改为默认显示释义，减少复习阻力，以量取胜
  - [x] 此次更新后占用空间变大，主要是离线词典，不使用离线翻译，不会加载词典
    祝大家春节快乐，财源广进  2026年2月26日95
- 20260303
  - [x]  添加不同翻译引擎的发音
  - [x] 优化本地(无网)翻译功能
  - [x] 复习频率可调
  - [x] 密钥中本地选项去除
  - [x] 修复音标显示
  - [x] 优化发音，支持离线
    祝大家元宵节快乐，万事如意  2026年3月4日98
