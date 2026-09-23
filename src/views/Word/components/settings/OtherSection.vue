<template>
  <div class="content">
    <h5 style="text-align:center;">申请密钥</h5>
    <p class="limit-info">
      由于截图翻译调用成本较高，优先使用本地功能，在没有配置自己密钥时，暂时限制直接使用次数每日{{ USAGE_LIMITS.OCR_DAILY_LIMIT }}次（腾讯引擎{{ USAGE_LIMITS.TENCENT_OCR_DAILY_LIMIT }}次）(方便测试自己密钥)，配置自己的密钥后不再限制，自己额度基本够用，截图主要使用者，希望尽量使用自己的免费额度</p>

    <div v-for="platform in TRANSLATION_PLATFORM_LINKS"
         :key="platform.key"
         class="titles">
      <div class="setting-item">
        <div class="content">{{ platform.content }}</div>
        <a href="#"
           @click.prevent="openUrl(platform.url)"
           class="external-link">跳转{{ platform.name }}</a>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {TRANSLATION_PLATFORM_LINKS} from "@/config.ts";
import {USAGE_LIMITS} from "@/constants";
import {isUtools} from "@/adapters/platform";

const openUrl = (url: string) => {
  if (isUtools()) {
    (window as any).utools?.shellOpenExternal?.(url);
  } else {
    window.open(url, '_blank');
  }
}
</script>

<style scoped lang="scss">
.content {
  padding: 0 20px;
  color: var(--utools-text-secondary);
  font-size: 12px;
}

.titles {
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
  }

  & + .titles {
    margin-top: 10px;
  }
}

.setting-item {
  .content {
    padding: 0;
  }
}

.limit-info {
  font-size: 12px;
  line-height: 1.6;
  color: var(--utools-text-tertiary);
}

.external-link {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 4px;
  text-decoration: none;
  color: var(--utools-text-secondary);
  background-color: var(--utools-bg-tertiary);
  transition: background-color 0.3s ease;

  &:hover {
    background-color: var(--utools-bg-hover);
    color: var(--utools-primary);
  }
}
</style>
