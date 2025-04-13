<script setup lang="ts">
import {RouterLink, RouterView} from 'vue-router'
</script>

<template>
  <header>

    <div >
123435
<!--      <nav>
        <RouterLink to="/">Home</RouterLink>
        <RouterLink to="/about">About</RouterLink>
      </nav>-->
    </div>
  </header>

  <RouterView/>
</template>

<style scoped lang="scss">
@use '@/assets/styles/reset.scss';
@use '@/assets/styles/common.scss';

@use '@/assets/styles/card-item.scss';
@use '@/assets/styles/index.scss';
@use '@/assets/styles/letter.scss';
@use '@/assets/styles/list-item.scss';
@import '@/assets/icons/iconfont.css';
@import '@/assets/styles/iconfont1.scss';

</style>
