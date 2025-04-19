<template>
  <div class="home-header">
          <span class="home-header-logo">
            <i class="iconfont icon-vue"></i>
            <i class="iconfont icon-icon-test"></i>
            <i class="iconfont icon-typescript"></i>
          </span>
    <span class="home-header-title">慢记</span>

    <el-dropdown>
      <el-badge :value="12">
        <el-icon :size="20">
          <Bell/>
        </el-icon>
      </el-badge>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item>暂无消息</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>

    <el-dropdown>
    <span class="home-header-space">
          <el-avatar src="https://cube.elemecdn.com/0/88/03b0d39583f48206768a7534e55bcpng.png"/>黄荣
    </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item>个人中心</el-dropdown-item>
          <el-dropdown-item>退出</el-dropdown-item>
        </el-dropdown-menu>
      </template>
    </el-dropdown>
  </div>
</template>

<script setup lang="ts">
import {Bell} from '@element-plus/icons-vue'
import {useWordsStore} from "@/stores/words.ts";
import {storeToRefs} from "pinia";

const wordsStore = useWordsStore();
const {words} = storeToRefs(wordsStore)

</script>

<style scoped lang="scss">

.home-header {
  font-size: 34px;
  display: flex;
  align-items: center;
  height: 100%;

  .home-header-logo {
    .icon-vue,
    .icon-icon-test,
    .icon-typescript {
      margin-right: 5px;
      font-size: inherit;
    }

    .icon-vue {
      color: green;
    }

    .icon-icon-test {
      color: #deb887;
    }

    .icon-typescript {
      color: blue;
    }
  }

  .home-header-title {
    margin-left: 30px;
    font-weight: 700;
    font-size: 18px;
    margin-right: auto;
  }

  .home-header-space {
    margin-left: 20px;
  }
}
</style>
