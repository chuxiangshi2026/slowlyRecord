<template>
  <el-drawer
      v-model="visible"
      :title="title"
      size="430px"
      destroy-on-close
  >
    <div class="settings-root">
      <!-- 一级：分组入口列表（高频组靠前，低频组沉底） -->
      <transition name="panel-fade" mode="out-in">
        <div v-if="!activeGroup" key="list" class="group-list">
          <div
              v-for="group in settingGroups"
              :key="group.key"
              class="group-entry"
              @click="activeGroup = group.key"
          >
            <div class="group-entry-main">
              <span class="group-entry-name">{{ group.name }}</span>
              <span class="group-entry-desc">{{ group.desc }}</span>
            </div>
            <el-icon class="group-entry-arrow"><ArrowRight/></el-icon>
          </div>
        </div>

        <!-- 二级：分组详情面板，全宽覆盖一级列表 -->
        <div v-else key="panel" class="group-panel">
          <div class="group-panel-header">
            <el-button class="group-panel-back" link :icon="ArrowLeft" @click="activeGroup = ''">返回</el-button>
            <span class="group-panel-title">{{ activeGroupName }}</span>
          </div>
          <el-scrollbar class="group-panel-body">
            <component :is="activeGroupComponent"/>
          </el-scrollbar>
        </div>
      </transition>
    </div>
  </el-drawer>
</template>
<script setup lang="ts">
import {computed, markRaw, ref} from 'vue'
import {ArrowLeft, ArrowRight} from '@element-plus/icons-vue'
import GeneralSection from './settings/GeneralSection.vue'
import FocusSection from './settings/FocusSection.vue'
import ShortcutSection from './settings/ShortcutSection.vue'
import ApiKeySection from './settings/ApiKeySection.vue'
import ConfigSection from './settings/ConfigSection.vue'
import OtherSection from './settings/OtherSection.vue'

type GroupKey = 'general' | 'focus' | 'shortcut' | 'apikey' | 'config' | 'other'

const props = defineProps({
  modelValue: Boolean,
  detailId: [String, Number],
  title: {
    type: String,
    default: '设置'
  }
})
// 定义emit事件
const emit = defineEmits(['update:modelValue', 'save'])

// 设置分组：高频组（常规/专注模式）靠前，低频组（密钥/配置管理/快捷键/其他）沉底
const settingGroups: { key: GroupKey; name: string; desc: string; component: any }[] = [
  {key: 'general', name: '常规设置', desc: '翻译/OCR 引擎、发音、护眼模式、界面字号', component: markRaw(GeneralSection)},
  {key: 'focus', name: '专注模式', desc: '专注窗口样式、背景与快捷键开关', component: markRaw(FocusSection)},
  {key: 'shortcut', name: '快捷键', desc: '全局快捷键设置与快捷键一览', component: markRaw(ShortcutSection)},
  {key: 'apikey', name: 'API 密钥', desc: '翻译/OCR 引擎自定义密钥（默认免配置）', component: markRaw(ApiKeySection)},
  {key: 'config', name: '配置管理', desc: '导出/导入个人配置（含 API 密钥）', component: markRaw(ConfigSection)},
  {key: 'other', name: '其他', desc: '申请密钥入口与使用说明', component: markRaw(OtherSection)},
]

// 当前进入的二级分组（空串表示停留在一级列表）
const activeGroup = ref<GroupKey | ''>('')

const activeGroupName = computed(() =>
  settingGroups.find(g => g.key === activeGroup.value)?.name || ''
)
const activeGroupComponent = computed(() =>
  settingGroups.find(g => g.key === activeGroup.value)?.component
)

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})
</script>
<style scoped lang="scss">
.settings-root {
  height: 100%;
}

// 一级：分组入口列表
.group-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 4px 0;
}

.group-entry {
  display: flex;
  align-items: center;
  gap: 10px;
  margin: 0 6px;
  padding: 12px;
  border-radius: 10px;
  background: var(--utools-bg-card);
  border: 1px solid var(--utools-border-divider);
  cursor: pointer;
  transition: background-color 0.2s ease;

  &:hover {
    background: var(--utools-bg-hover);

    .group-entry-arrow {
      color: var(--utools-primary);
    }
  }

  .group-entry-main {
    display: flex;
    flex-direction: column;
    gap: 3px;
    min-width: 0;
    flex: 1;
  }

  .group-entry-name {
    font-size: 14px;
    font-weight: 600;
    color: var(--utools-text-primary);
  }

  .group-entry-desc {
    font-size: 12px;
    color: var(--utools-text-tertiary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .group-entry-arrow {
    flex-shrink: 0;
    color: var(--utools-text-tertiary);
    transition: color 0.2s ease;
  }
}

// 二级：分组详情面板
.group-panel {
  display: flex;
  flex-direction: column;
  height: 100%;

  .group-panel-header {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 0 4px 10px;
    border-bottom: 1px solid var(--utools-border-divider);
    margin-bottom: 12px;

    .group-panel-back {
      color: var(--utools-text-secondary);

      &:hover {
        color: var(--utools-primary);
      }
    }

    .group-panel-title {
      font-size: 14px;
      font-weight: 600;
      color: var(--utools-text-primary);
    }
  }

  .group-panel-body {
    flex: 1;
  }
}

// 两级切换的简单过渡动画
.panel-fade-enter-active,
.panel-fade-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}

.panel-fade-enter-from,
.panel-fade-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
