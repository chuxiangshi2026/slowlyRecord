<template>
  <div>
    <div class="common-layout">

      <el-container>
        <!-- 统一头部：页面名 + 列表模式切换 + 打卡 streak（uTools 原生已有插件头，这里只保留一行全局状态） -->
        <el-header height="34px">
          <AppHeader/>
        </el-header>
        <el-container>
          <el-main>
            <HomeMain/>
          </el-main>
        </el-container>
<!--        <el-footer>Footer-->
<!--&lt;!&ndash;          <HomeFooter/>&ndash;&gt;-->
<!--        </el-footer>-->
      </el-container>
    </div>
    <!--    <router-view>-->

    <!--    </router-view>-->
    <!--    <el-button type="primary">ok</el-button>-->

    <!-- 同步与备份：挂到 Home 层，头部状态点与「更多」抽屉共用同一实例 -->
    <SyncDialog v-model="uiStore.syncDialogVisible"/>
    <!-- 设置抽屉：Home 层全局单例，任意页面可直接打开 -->
    <DetailDrawer v-model="uiStore.settingsDrawerVisible" title="设置"/>
    <!-- 「更多」抽屉：Home 层全局单例，头部 ☰ 入口；导入导出指令经 uiStore 转发给单词页执行 -->
    <MoreDrawer
        v-model="uiStore.moreDrawerVisible"
        @import-command="(cmd: string) => uiStore.pendingImportCommand = { cmd, at: Date.now() }"
        @export-command="(cmd: string) => uiStore.pendingExportCommand = { cmd, at: Date.now() }"
        @sync="uiStore.openSyncDialog()"
        @settings="uiStore.settingsDrawerVisible = true"
    />
  </div>
</template>

<script setup lang="ts">

import AppHeader from "@/components/AppHeader.vue";
import HomeMain from "@/views/Home/components/HomeMain.vue";
import SyncDialog from "@/components/SyncDialog.vue";
import DetailDrawer from "@/views/Word/components/DetailDrawer.vue";
import MoreDrawer from "@/components/MoreDrawer.vue";
import {useUiStore} from "@/stores/ui";

const uiStore = useUiStore();
</script>

<style scoped lang="scss">
.el-header {
  box-shadow: 0 8px 24px -2px rgba(0, 0, 0, .05);
  background-color: var(--utools-bg-primary);
  padding: 0;
}
.el-aside {
  box-shadow: 2px 0 8px 0 rgba(29, 35, 41, .05);
  background-color: var(--utools-bg-primary);
}

.el-main{
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  padding: 8px 8px 0 8px;
}
</style>
