<template>
  <div>
    <!-- 主窗口快捷键总开关：只作用于主窗口单词列表与听写练习；专注窗口内快捷键独立生效，不受此开关控制 -->
    <div class="setting-item" style="margin-bottom: 4px;">
      <div class="content">主窗口列表/听写快捷键</div>
      <el-switch class="shorcut-desc"
                 v-model="wordsStore.shortcutEnabled"
                 inline-prompt
                 size="large"
                 active-text="开"
                 inactive-text="关"
                 @change="persistShortcut"
      />
    </div>
    <p class="scope-note">
      关闭后仅停用主窗口与听写的快捷键；专注窗口内的快捷键（Shift+R/F/P/T、空格、方向键等）始终生效，见下方「专注模式」一览。
    </p>

    <!-- 设置全局快捷键 -->
    <div class="titles">
      <div class="setting-item">
        <el-button type="info" @click="kuaijiejian(1)">划词快捷键</el-button>
        <el-button type="info" @click="kuaijiejian(2)">划段快捷键</el-button>
        <el-button type="info" @click="kuaijiejian(3)">截图快捷键</el-button>
      </div>
    </div>
    <p class="scope-note">为 uTools 全局功能「划词添加 / 划段添加 / 截图添加」设置唤起快捷键（需在 uTools 中使用）。</p>

    <!-- 快捷键一览 -->
    <el-collapse class="shortcut-collapse">
      <el-collapse-item title="快捷键一览" name="shortcutList">
        <div class="content">
          <h5 style="text-align:center;">列表模式</h5>
          <div class="titles">
            <span class="title">功能说明</span>
            <span class="title">快捷键</span>
          </div>
          <div v-for="(item,index) in listShortcuts"
               :key="index" class="titles">
            <span class="shorcut-desc">{{ item.desc }}</span>
            <span class="shorcut-desc">{{ item.shortcut }}</span>
          </div>

          <h5 style="text-align:center; margin-top: 20px;">拼写模式</h5>
          <div class="titles">
            <span class="title">功能说明</span>
            <span class="title">快捷键</span>
          </div>
          <div v-for="(item,index) in dictationShortcuts"
               :key="index" class="titles">
            <span class="shorcut-desc">{{ item.desc }}</span>
            <span class="shorcut-desc">{{ item.shortcut }}</span>
          </div>

          <h5 style="text-align:center; margin-top: 20px;">专注模式</h5>
          <div class="titles">
            <span class="title">功能说明</span>
            <span class="title">快捷键</span>
          </div>
          <div v-for="(item,index) in focusShortcuts"
               :key="index" class="titles">
            <span class="shorcut-desc">{{ item.desc }}</span>
            <span class="shorcut-desc">{{ item.shortcut }}</span>
          </div>
        </div>
      </el-collapse-item>
    </el-collapse>
  </div>
</template>

<script setup lang="ts">
import {isUtools} from "@/adapters/platform";
import {useWordsStore} from "@/stores/words.ts";

const wordsStore = useWordsStore();

const persistShortcut = () => {
  wordsStore.setShortcutEnabled(wordsStore.shortcutEnabled)
}

const kuaijiejian = (type: number) => {
  const utoolsApi = (window as any).utools;
  if (!isUtools() || !utoolsApi?.redirectHotKeySetting) return;
  if (type == 1) {
    utoolsApi.redirectHotKeySetting("划词添加", true);
  }
  if (type == 2) {
    utoolsApi.redirectHotKeySetting("划段添加", true)
  }
  if (type == 3) {
    utoolsApi.redirectHotKeySetting("截图添加", true)
  }
}

const listShortcuts = [
  {desc: '记得选中单词', shortcut: 'Shift + R'},
  {desc: '忘记选中单词', shortcut: 'Shift + F'},
  {desc: '选中单词发音', shortcut: 'Shift + P'},
  {desc: '翻译选中单词', shortcut: 'Shift + T'},
  {desc: '保存释义', shortcut: 'Ctrl + Enter'}
]

const cardShortcuts = [
  {desc: '下一个', shortcut: 'Shift + >'},
  {desc: '上一个', shortcut: 'Shift + <'},
  {desc: '单词发音', shortcut: 'Shift + P'},
  {desc: '模式切换', shortcut: 'Shift + M'},
  {desc: '开启/关闭翻译', shortcut: 'Shift + T'},
]

const dictationShortcuts = [
  {desc: '显示提示', shortcut: 'Shift + H'},
  {desc: '上一个单词', shortcut: 'Shift + ←'},
  {desc: '跳过/下一个单词', shortcut: 'Shift + →'},
  {desc: '播放发音', shortcut: 'Space'},
  {desc: '跳过单词', shortcut: 'Enter'},
]

const focusShortcuts = [
  {desc: '认识（升级）', shortcut: 'Shift + R'},
  {desc: '忘记（降级）', shortcut: 'Shift + F'},
  {desc: '播放发音', shortcut: 'Shift + P'},
  {desc: '显示/隐藏释义', shortcut: 'Shift + T'},
  {desc: '永久记住', shortcut: '↓'},
  {desc: '上一个单词', shortcut: '←'},
  {desc: '下一个单词', shortcut: '→'},
  {desc: '暂停/继续自动播放（开启自动下一个时）', shortcut: 'Space'},
  {desc: '锁定/解锁', shortcut: 'Ctrl + L'},
  {desc: '关闭专注窗口', shortcut: 'Esc'},
]
</script>

<style scoped lang="scss">
.scope-note {
  margin: 0 20px 10px;
  font-size: 12px;
  line-height: 1.5;
  color: var(--utools-text-tertiary);
}

.titles {
  .setting-item {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 10px;
    padding: 0 20px;
    box-sizing: border-box;
  }
}

.content {
  padding: 0 20px;
  color: var(--utools-text-secondary);
  font-size: 12px;

  .titles {
    display: flex;
    justify-content: space-between;
    font-weight: bold;
    color: var(--utools-text-primary);
  }

  .shorcut-desc {
    margin-top: 10px;
    font-size: 12px;
    font-weight: 400;
    color: var(--utools-text-secondary);
  }
}

.shortcut-collapse {
  border-top: none;

  :deep(.el-collapse-item__header) {
    padding: 0 10px;
    color: var(--utools-text-primary);
  }

  :deep(.el-collapse-item__content) {
    padding-bottom: 12px;
  }
}
</style>
