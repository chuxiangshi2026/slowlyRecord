import {createRouter, createWebHashHistory, createWebHistory} from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
import { isElectron, isUtools, isWeb, isMiniProgram, isApp } from '@/adapters/platform'

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
const MemoryTest = () => import('@/views/MemoryTest/MemoryTest.vue');
const Dictation = () => import('@/views/Dictation/Dictation.vue');
const QuickTranslate = () => import('@/views/Translate/QuickTranslate.vue');
const TextMemory = () => import('@/views/TextMemory/TextMemory.vue');
const ShortcutMemory = () => import('@/views/ShortcutMemory/ShortcutMemory.vue');
const ShortcutMemoryTraining = () => import('@/views/ShortcutMemory/ShortcutMemoryTraining.vue');
const LetterMemory = () => import('@/views/LetterMemory/LetterMemory.vue');
const PhoneticMemory = () => import('@/views/PhoneticMemory/PhoneticMemory.vue');
const PhoneticRecognition = () => import('@/views/PhoneticMemory/PhoneticRecognition.vue');
const MinimalPairs = () => import('@/views/PhoneticMemory/MinimalPairs.vue');
const PhonemeBreakdown = () => import('@/views/PhoneticMemory/PhonemeBreakdown.vue');
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
      title: '考勤管理',
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
          title: '听写练习',
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
        path: 'letter-memory',
        name: 'letterMemory',
        component: LetterMemory,
        meta: {
          menu: false,
          title: '字母映射',
          icon: 'Tickets',
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
          title: '最小对立对',
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

export default router
// history: createWebHistory(import.meta.env.BASE_URL),
