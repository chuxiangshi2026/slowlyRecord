<template>
  <el-breadcrumb separator="/">
    <el-breadcrumb-item :to="item.path"
                        v-for="item in breadcrumbs"
                        :key="item.path">{{ item.name }}

<!--        <a href=""></a>-->
    </el-breadcrumb-item>
    <!--    </el-breadcrumb-item>-->
  </el-breadcrumb>
</template>

<script setup lang="ts">
import {computed} from 'vue';
import {useRoute} from 'vue-router'

const route = useRoute()
const breadcrumbs = computed(() => route.matched)
</script>

<style scoped lang="scss">

.el-breadcrumb {
  background: #fff;
  height: 40px;
  display: flex;
  align-items: center;
  padding-left: 30px;
}

</style>
