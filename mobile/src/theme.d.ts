/**
 * 全局 mixin 注入的属性类型声明（实现见 main.ts 的 app.mixin）
 * 让 vue-tsc 模板检查认识 themeClass
 */
declare module 'vue' {
  interface ComponentCustomProperties {
    /** 主题类名：暗色模式时为 'theme-dark'，亮色为空串；页面根节点统一绑 :class="themeClass" */
    themeClass: string
  }
}

export {}
