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
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  position: relative;
}
</style>
