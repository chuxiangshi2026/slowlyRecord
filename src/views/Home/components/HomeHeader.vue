<template>
  <div class="home-header">
          <span class="home-header-logo">
            <i class="iconfont icon-vue"></i>
            <i class="iconfont icon-icon-test"></i>
            <i class="iconfont icon-typescript"></i>
          </span>
    <span class="home-header-title">慢记</span>

    <el-dropdown>
      <span class="bell-trigger" @click="handleBellClick">
        <el-badge :value="forgetCount" :max="99" :hidden="forgetCount <= 0">
          <el-icon :size="20">
            <Bell/>
          </el-icon>
        </el-badge>
      </span>
      <template #dropdown>
        <el-dropdown-menu>
          <el-dropdown-item v-if="forgetCount > 0" @click="handleToWord">
            今日待复习 {{ forgetCount }} 个，点击去复习
          </el-dropdown-item>
          <el-dropdown-item v-else disabled>暂无消息</el-dropdown-item>
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
import {useRouter} from "vue-router";
import {useWordsStore} from "@/stores/words.ts";
import {storeToRefs} from "pinia";

const router = useRouter();
const wordsStore = useWordsStore();
const {forgetCount} = storeToRefs(wordsStore)

// 点击待复习消息跳转到单词页
const handleToWord = () => {
  router.push('/word')
}

// 有待复习单词时，点击铃铛直接跳转到单词页
const handleBellClick = () => {
  if (forgetCount.value > 0) {
    handleToWord()
  }
}
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
      color: #595959;
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

  .bell-trigger {
    display: inline-flex;
    align-items: center;
    cursor: pointer;
  }
}
</style>
