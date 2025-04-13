import {createRouter, createWebHistory} from 'vue-router'
import type { RouteRecordRaw } from 'vue-router'
const Login = () => import('@/views/Login/Login.vue');
const Home = () => import('@/views/Home/Home.vue');
const Sign = () => import('@/views/Sign/Sign.vue');
const Word = () => import('@/views/Word/Word.vue');
const Exception = () => import('@/views/Exception/Exception.vue');
const Apply = () => import('@/views/Apply/Apply.vue');
const Check = () => import('@/views/Check/Check.vue');





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
          title: '在线打卡签到',
          icon: 'calendar',
        },
      },
      {
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
      }
    ]
  },
  {
    path: '/login',
    name: 'login',
    component: Login
  }
]








const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes
})

export default router
