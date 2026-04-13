<template>
  <el-menu :default-active="route.fullPath" class="el-menu-vertical-demo" :collapse="isCollapse" router>
      <el-menu-item v-for="itemChild in menus[0].children"
                    :key="menus[0].path+itemChild.path"
                    :index="menus[0].path+itemChild.path">
        <el-icon>
          <component :is="getIconComponent(itemChild.meta?.icon)"/>
        </el-icon>
        <template #title><span>{{ itemChild.meta?.title }}</span></template>
      </el-menu-item>
  </el-menu>
</template>

<script setup lang="ts">
import _ from 'lodash'
import type {RouteRecordName} from "vue-router";
import {useRouter,useRoute} from "vue-router";
// import {useStore} from "@/store";
import {ref} from "vue";
import { DocumentAdd, Calendar, FirstAidKit, Document, Collection } from '@element-plus/icons-vue';

// const  store = useStore()
const route = useRoute()
const router = useRouter()
// const permission = store.state.users.infos.permission;


const isCollapse = ref(true)

const menus = _.cloneDeep(router.options.routes)
    // .filter((v) => {
  // v.children = v.children?.filter((v) => v.meta?.menu && (permission as (RouteRecordName|undefined)[]).includes(v.name));
  // return v.meta?.menu && (permission as (RouteRecordName|undefined)[]).includes(v.name)
// })
// console.log(JSON.stringify(menus)+'_______'+JSON.stringify(permission))
// console.log(JSON.stringify(route.fullPath))

// 图标映射表
const iconMap: Record<string, any> = {
  'document-add': DocumentAdd,
  'calendar': Calendar,
  'FirstAidKit': FirstAidKit,
  'document-copy': Document,
  'collection': Collection
};

function getIconComponent(iconName?: string) {
  if (!iconName) return DocumentAdd;
  return iconMap[iconName] || DocumentAdd;
}
</script>

<style scoped lang="scss">

.el-menu {
  height: calc(100vh - 60px);
  border: none;
  padding-top: 30px;
  background-color: var(--utools-bg-primary);
  
  .el-menu-item {
    color: var(--utools-text-primary);
    height: 56px;
    
    &:hover {
      background-color: var(--utools-bg-hover);
    }
    
    .el-icon {
      color: var(--utools-text-secondary);
      font-size: 22px;
      margin-right: 12px;
    }
  }
}

.el-menu-item.is-active {
  background: var(--utools-primary-light);
  border-right: 3px solid var(--utools-primary);
  color: var(--utools-primary);
  
  .el-icon {
    color: var(--utools-primary);
  }
}
</style>
