<template>
  <div class="home-main">
    <router-view></router-view>
  </div>
</template>

<script setup lang="ts">

</script>

<style scoped lang="scss">
.home-main {
  margin-top: 2px;
  background: var(--utools-bg-secondary);
  border-radius: 8px;
  flex-grow: 1;
  position: relative;
}
</style>
