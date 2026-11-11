import {createRouter, createWebHashHistory, createWebHistory} from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { ElMessageBox } from 'element-plus'
import { isElectron, isUtools, isWeb, isMiniProgram, isApp } from '@/adapters/platform'
import { trackError } from '@/utils/stats'
import { clearLazyRouteRetry, consumeLazyRouteRetry, isLazyRouteLoadError } from '@/router/lazy-error'

// 平台检测（构建时静态替换，运行时动态过滤）
const isDesktopEnv = isElectron() || isUtools() || isWeb()
const isMobileEnv = isMiniProgram() || isApp()

// const Login = () => import('@/views/Login/Login.vue');
const Home = () => import('@/views/Home/Home.vue');
const Sign = () => import('@/views/Sign/Sign.vue');
const Word = () => import('@/views/Word/Word.vue');
const NumberMemory = () => import('@/views/NumberMemory/NumberMemory.vue');
const NumberMemoryTraining = () => import('@/views/NumberMemory/NumberMemoryTraining.vue');
const NumberMemoryEntries = () => import('@/views/NumberMemory/NumberMemoryEntries.vue');
const NumberMemoryMapping = () => import('@/views/NumberMemory/NumberMemoryMapping.vue');
const MemoryTest = () => import('@/views/MemoryTest/MemoryTest.vue');
const Dictation = () => import('@/views/Dictation/Dictation.vue');
const QuickTranslate = () => import('@/views/Translate/QuickTranslate.vue');
const TextMemory = () => import('@/views/TextMemory/TextMemory.vue');
const Sentences = () => import('@/views/Sentences/Sentences.vue');
const ShortcutMemory = () => import('@/views/ShortcutMemory/ShortcutMemory.vue');
const ShortcutMemoryTraining = () => import('@/views/ShortcutMemory/ShortcutMemoryTraining.vue');
const LetterMemory = () => import('@/views/LetterMemory/LetterMemory.vue');
const PhoneticMemory = () => import('@/views/PhoneticMemory/PhoneticMemory.vue');
const PhoneticRecognition = () => import('@/views/PhoneticMemory/PhoneticRecognition.vue');
const MinimalPairs = () => import('@/views/PhoneticMemory/MinimalPairs.vue');
const PhonemeBreakdown = () => import('@/views/PhoneticMemory/PhonemeBreakdown.vue');
const KnowledgeMemory = () => import('@/views/KnowledgeMemory/KnowledgeMemory.vue');
const KnowledgeMemoryPack = () => import('@/views/KnowledgeMemory/KnowledgeMemoryPack.vue');
const MemoryPalace = () => import('@/views/MemoryPalace/MemoryPalace.vue');
const MemoryPalaceEdit = () => import('@/views/MemoryPalace/MemoryPalaceEdit.vue');
const MemoryPalaceDetail = () => import('@/views/MemoryPalace/MemoryPalaceDetail.vue');
const MemoryPalaceReview = () => import('@/views/MemoryPalace/MemoryPalaceReview.vue');
const WordBookBooks = () => import('@/views/WordBook/WordBookBooks.vue');
const WordBookChapters = () => import('@/views/WordBook/WordBookChapters.vue');
const WordBookPages = () => import('@/views/WordBook/WordBookPages.vue');
const WordBookPage = () => import('@/views/WordBook/WordBookPage.vue');
// const Exception = () => import('@/views/Exception/Exception.vue');
// const Apply = () => import('@/views/Apply/Apply.vue');
// const Check = () => import('@/views/Check/Check.vue');





// 路由规则
declare module 'vue-router' {
  interface RouteMeta {
    // ？可选项
    menu?: boolean
    title?: string
    icon?: string
    auth?: boolean
  }
}


const routes: Array<RouteRecordRaw> = [
  {
    path: '/',
    name: 'home',
    component: Home,
    redirect: '/word',
    meta: {
      menu: true,
      title: '慢记',
      icon: 'document-copy',
    },
    children: [
      {
        path: 'word',
        name: 'word',
        component: Word,
        meta: {
          menu: true,
          title: '单词',
          icon: 'document-add',
        }
      },
      {
        path: 'sign',
        name: 'sign',
        component: Sign,
        meta: {
          menu: true,
          title: '打卡',
          icon: 'calendar',
        },
      },
      {
        path: 'number-memory',
        name: 'numberMemory',
        component: NumberMemory,
        meta: {
          menu: true,
          title: '数字记忆',
          icon: 'aim',
        },
      },
      {
        path: 'number-memory/training',
        name: 'numberMemoryTraining',
        component: NumberMemoryTraining,
        meta: {
          menu: false,
          title: '记忆训练',
        },
      },
      {
        path: 'number-memory/entries',
        name: 'numberMemoryEntries',
        component: NumberMemoryEntries,
        meta: {
          menu: false,
          title: '数字记忆条目',
        },
      },
      {
        path: 'number-memory/mapping',
        name: 'numberMemoryMapping',
        component: NumberMemoryMapping,
        meta: {
          menu: false,
          title: '数字映射设置',
        },
      },
      {
        path: 'memory',
        name: 'memory',
        component: MemoryTest,
        meta: {
          menu: true,
          title: '记忆力测试',
          icon: 'FirstAidKit',
        },
      },
      {
        path: 'dictation',
        name: 'dictation',
        component: Dictation,
        meta: {
          menu: false,
          title: '拼写练习',
        },
      },
      {
        path: 'translate',
        name: 'translate',
        component: QuickTranslate,
        meta: {
          menu: true,
          title: '快速翻译',
          icon: 'document-copy',
        },
      },
      {
        path: 'text-memory',
        name: 'textMemory',
        component: TextMemory,
        meta: {
          menu: true,
          title: '文本记忆',
          icon: 'collection',
        },
      },
      {
        path: 'sentences',
        name: 'sentences',
        component: Sentences,
        meta: {
          menu: true,
          title: '句子库',
          icon: 'notebook',
        },
      },
      {
        path: 'letter-memory',
        name: 'letterMemory',
        component: LetterMemory,
        meta: {
          menu: false,
          title: '字母映射',
          icon: 'TableIcon',
        },
      },
      {
        path: 'phonetic-memory',
        name: 'phoneticMemory',
        component: PhoneticMemory,
        meta: {
          menu: false,
          title: '音标学习',
          icon: 'Microphone',
        },
      },
      {
        path: 'phonetic-memory/recognition',
        name: 'phoneticRecognition',
        component: PhoneticRecognition,
        meta: {
          menu: false,
          title: '音标识别',
        },
      },
      {
        path: 'phonetic-memory/minimal-pairs',
        name: 'phoneticMinimalPairs',
        component: MinimalPairs,
        meta: {
          menu: false,
          title: '辨音练习',
        },
      },
      {
        path: 'phonetic-memory/breakdown',
        name: 'phoneticBreakdown',
        component: PhonemeBreakdown,
        meta: {
          menu: false,
          title: '音素拆解',
        },
      },
      {
        path: 'knowledge-memory',
        name: 'knowledgeMemory',
        component: KnowledgeMemory,
        meta: {
          menu: true,
          title: '知识库',
          icon: 'Reading',
        },
      },
      {
        path: 'knowledge-memory/:id',
        name: 'knowledgeMemoryPack',
        component: KnowledgeMemoryPack,
        meta: {
          menu: false,
          title: '知识包练习',
        },
      },
      {
        path: 'memory-palace',
        name: 'memoryPalace',
        component: MemoryPalace,
        meta: {
          menu: true,
          title: '记忆宫殿',
          icon: 'OfficeBuilding',
        },
      },
      {
        path: 'memory-palace/edit/:id?',
        name: 'memoryPalaceEdit',
        component: MemoryPalaceEdit,
        meta: {
          menu: false,
          title: '编辑宫殿',
        },
      },
      {
        path: 'memory-palace/:id',
        name: 'memoryPalaceDetail',
        component: MemoryPalaceDetail,
        meta: {
          menu: false,
          title: '宫殿详情',
        },
      },
      {
        path: 'memory-palace/:id/review',
        name: 'memoryPalaceReview',
        component: MemoryPalaceReview,
        meta: {
          menu: false,
          title: '过一遍宫殿',
        },
      },
      {
        path: 'word-book',
        name: 'wordBookBooks',
        component: WordBookBooks,
        meta: {menu: false, title: '词集'},
      },
      {
        path: 'word-book/page/:pageId',
        name: 'wordBookPage',
        component: WordBookPage,
        meta: {menu: false, title: '词集学习页'},
      },
      {
        path: 'word-book/:bookId',
        name: 'wordBookChapters',
        component: WordBookChapters,
        meta: {menu: false, title: '词集章节'},
      },
      {
        path: 'word-book/:bookId/:chapterId',
        name: 'wordBookPages',
        component: WordBookPages,
        meta: {menu: false, title: '词集页面'},
      },
      ...(isDesktopEnv ? [
        {
          path: 'shortcut-memory',
          name: 'shortcutMemory',
          component: ShortcutMemory,
          meta: {
            menu: true,
            title: '快捷键记忆',
            icon: 'Cpu',
          },
        },
        {
          path: 'shortcut-memory/training',
          name: 'shortcutMemoryTraining',
          component: ShortcutMemoryTraining,
          meta: {
            menu: false,
            title: '快捷键训练',
          },
        },
      ] : []),
     /* {
        path: 'exception',
        name: 'exception',
        component: Exception,
        meta: {
          menu: true,
          title: '异常考勤查询',
          icon: 'warning',
        }
      },
      {
        path: 'apply',
        name: 'apply',
        component: Apply,
        meta: {
          menu: true,
          title: '添加考勤审批',
          icon: 'document-add',
        }
      },
      {
        path: 'check',
        name: 'check',
        component: Check,
        meta: {
          menu: true,
          title: '我的考勤审批',
          icon: 'finished',
        }
      }*/
    ]
  },
  // {
  //   path: '/login',
  //   name: 'login',
  //   component: Login
  // }
]








const router = createRouter({
  history: createWebHashHistory(),
  routes
})

let initialNavigationCompleted = false
let routeErrorPromptVisible = false

function consumeRouteRetry(path: string): boolean {
  try {
    return consumeLazyRouteRetry(path, window.sessionStorage)
  } catch {
    return false
  }
}

function clearRouteRetry(path: string): void {
  try {
    clearLazyRouteRetry(path, window.sessionStorage)
  } catch { /* sessionStorage 不可用时忽略 */ }
}

router.afterEach((to) => {
  initialNavigationCompleted = true
  clearRouteRetry(to.fullPath)
})

router.onError((error, to) => {
  trackError('promise', error, to.fullPath).catch(() => {})
  if (!isLazyRouteLoadError(error)) return

  // 首次启动只自动恢复一次，避免发布切换期间停留在空白页；后续导航由用户确认，避免刷新丢编辑内容
  if (!initialNavigationCompleted && consumeRouteRetry(to.fullPath)) {
    window.location.reload()
    return
  }
  if (routeErrorPromptVisible) return
  routeErrorPromptVisible = true
  ElMessageBox.confirm(
    '页面资源加载失败，可以重新加载。当前页面的未保存内容可能丢失。',
    '加载失败',
    {confirmButtonText: '重新加载', cancelButtonText: '取消', type: 'warning'}
  ).then(() => {
    window.location.reload()
  }).catch(() => {}).finally(() => {
    routeErrorPromptVisible = false
  })
})

export default router
// history: createWebHistory(import.meta.env.BASE_URL),
