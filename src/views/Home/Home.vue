<template>
  <div>
    <div class="common-layout">

      <el-container>
<!--        <el-header>
          &lt;!&ndash;          Header&ndash;&gt;
          <HomeHeader/>
        </el-header>-->
        <el-container>
<!--          <el-aside width="56px">-->
<!--            &lt;!&ndash;            Aside&ndash;&gt;-->
<!--            <HomeAside/>-->
<!--          </el-aside>-->
          <el-main>
            <!--            Main-->
<!--            <HomeBreadcrumb/>-->
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
  </div>
</template>

<script setup lang="ts">

import HomeHeader from "@/views/Home/components/HomeHeader.vue";
import HomeFood from "@/views/Home/components/HomeFood.vue";
import HomeMain from "@/views/Home/components/HomeMain.vue";
import HomeAside from "@/views/Home/components/HomeAside.vue";
import HomeBreadcrumb from "@/views/Home/components/HomeBreadcrumb.vue";
</script>

<style scoped lang="scss">
.el-header {
  box-shadow: 0 8px 24px -2px rgba(0, 0, 0, .05);
}
.el-aside {
  box-shadow: 2px 0 8px 0 rgba(29, 35, 41, .05);
}

.el-main{
  background: #f0f2f5;
  display: flex
;
  flex-direction: column;
}
</style>
