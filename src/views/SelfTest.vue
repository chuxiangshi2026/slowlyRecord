<template>
  <pre class="selftest">{{ report }}</pre>
</template>

<script setup lang="ts">
// #/selftest 诊断页：输出平台/存储/TTS 等适配器自检结果（JSON），供 E2E 与巡检断言，无鉴权无导航
import { onMounted, ref } from 'vue'
import { getPlatform } from '@/adapters/platform'
import { getDbAdapterAsync } from '@/adapters/db'
import { APP_VERSION } from '@/config'

const report = ref('loading...')

onMounted(async () => {
  const info: Record<string, unknown> = {
    ok: true,
    version: APP_VERSION,
    platform: getPlatform(),
    buildPlatform: __PLATFORM__,
    storeBuild: __STORE_BUILD__,
    userAgent: navigator.userAgent,
    tts: typeof speechSynthesis !== 'undefined',
  }
  try {
    const db = await getDbAdapterAsync()
    info.db = (db as any)?.constructor?.name || 'unknown'
  } catch (e) {
    info.ok = false
    info.dbError = String(e)
  }
  report.value = JSON.stringify(info, null, 2)
})
</script>

<style scoped>
.selftest {
  margin: 0;
  padding: 16px;
  font: 12px/1.6 monospace;
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
