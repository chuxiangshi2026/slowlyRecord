<template>
  <div class="keyboard-visual" :class="{ 'numpad-only': props.mode === 'numpad', compact: props.compact }">
    <!-- 主键位区（键位练习 / 默认模式） -->
    <template v-if="props.mode !== 'numpad'">
      <div class="keyboard-layout">
        <!-- 功能键区 -->
        <div v-if="!props.compact" class="keyboard-row function-row">
          <div
            v-for="key in functionKeys"
            :key="key"
            class="key function-key"
            :class="{ active: isKeyActive(key), target: isTargetKey(key) }"
          >
            {{ key }}
          </div>
        </div>

        <!-- 数字键区 -->
        <div v-if="!props.compact" class="keyboard-row number-row">
          <div
            v-for="key in numberRow"
            :key="key"
            class="key"
            :class="{ active: isKeyActive(key), target: isTargetKey(key) }"
          >
            {{ key }}
          </div>
        </div>

        <!-- QWERTY 第一行 -->
        <div class="keyboard-row">
          <div v-if="!props.compact" class="key special-key">Tab</div>
          <div
            v-for="key in props.compact ? compactRow1 : qwertyRow1"
            :key="key"
            class="key"
            :class="{ active: isKeyActive(key), target: isTargetKey(key), 'has-sub': !!keyLabels?.[key] }"
          >
            <span class="key-main">{{ key }}</span>
            <span v-if="keyLabels?.[key]" class="key-sub">{{ keyLabels[key] }}</span>
          </div>
        </div>

        <!-- QWERTY 第二行 -->
        <div class="keyboard-row">
          <div v-if="!props.compact" class="key special-key wide-key" :class="{ active: isKeyActive('capslock') }">Caps</div>
          <div
            v-for="key in props.compact ? compactRow2 : qwertyRow2"
            :key="key"
            class="key"
            :class="{ active: isKeyActive(key), target: isTargetKey(key), 'has-sub': !!keyLabels?.[key] }"
          >
            <span class="key-main">{{ key }}</span>
            <span v-if="keyLabels?.[key]" class="key-sub">{{ keyLabels[key] }}</span>
          </div>
          <div v-if="!props.compact" class="key special-key wide-key" :class="{ active: isKeyActive('enter') }">Enter</div>
        </div>

        <!-- QWERTY 第三行 -->
        <div class="keyboard-row">
          <div
            v-if="!props.compact"
            class="key special-key extra-wide-key"
            :class="{ active: isKeyActive('shift'), target: isTargetKey('shift') }"
          >
            Shift
          </div>
          <div
            v-for="key in props.compact ? compactRow3 : qwertyRow3"
            :key="key"
            class="key"
            :class="{ active: isKeyActive(key), target: isTargetKey(key), 'has-sub': !!keyLabels?.[key] }"
          >
            <span class="key-main">{{ key }}</span>
            <span v-if="keyLabels?.[key]" class="key-sub">{{ keyLabels[key] }}</span>
          </div>
          <div
            v-if="!props.compact"
            class="key special-key extra-wide-key"
            :class="{ active: isKeyActive('shift') }"
          >
            Shift
          </div>
        </div>

        <!-- 底行：紧凑模式不显示空格和修饰键，进一步节省高度 -->
        <div v-if="!props.compact" class="keyboard-row">
          <div
            class="key special-key"
            :class="{ active: isKeyActive('ctrl'), target: isTargetKey('ctrl') }"
          >
            Ctrl
          </div>
          <div
            class="key special-key"
            :class="{ active: isKeyActive('win'), target: isTargetKey('win') }"
          >
            Win
          </div>
          <div
            class="key special-key"
            :class="{ active: isKeyActive('alt'), target: isTargetKey('alt') }"
          >
            Alt
          </div>
          <div
            class="key space-key"
            :class="{ active: isKeyActive('space'), target: isTargetKey('space') }"
          >
            Space
          </div>
          <div
            class="key special-key"
            :class="{ active: isKeyActive('alt') }"
          >
            Alt
          </div>
          <div
            class="key special-key"
            :class="{ active: isKeyActive('fn') }"
          >
            Fn
          </div>
          <div
            class="key special-key"
            :class="{ active: isKeyActive('ctrl') }"
          >
            Ctrl
          </div>
        </div>
      </div>

      <!-- 右侧区域：编辑键 + 方向键（输入法键位练习可隐藏） -->
      <div v-if="props.showRightSection !== false" class="right-section">
        <div class="edit-keys">
          <div class="edit-row">
            <div
              class="key edit-key"
              :class="{ active: isKeyActive('ins'), target: isTargetKey('ins') }"
            >
              Ins
            </div>
            <div
              class="key edit-key"
              :class="{ active: isKeyActive('home'), target: isTargetKey('home') }"
            >
              Home
            </div>
            <div
              class="key edit-key"
              :class="{ active: isKeyActive('pageup'), target: isTargetKey('pageup') }"
            >
              PgUp
            </div>
          </div>
          <div class="edit-row">
            <div
              class="key edit-key"
              :class="{ active: isKeyActive('del'), target: isTargetKey('del') }"
            >
              Del
            </div>
            <div
              class="key edit-key"
              :class="{ active: isKeyActive('end'), target: isTargetKey('end') }"
            >
              End
            </div>
            <div
              class="key edit-key"
              :class="{ active: isKeyActive('pagedown'), target: isTargetKey('pagedown') }"
            >
              PgDn
            </div>
          </div>
        </div>
        <div class="arrow-keys">
          <div class="arrow-row">
            <div
              class="key arrow-key"
              :class="{ active: isKeyActive('up'), target: isTargetKey('up') }"
            >
              ↑
            </div>
          </div>
          <div class="arrow-row">
            <div
              class="key arrow-key"
              :class="{ active: isKeyActive('left'), target: isTargetKey('left') }"
            >
              ←
            </div>
            <div
              class="key arrow-key"
              :class="{ active: isKeyActive('down'), target: isTargetKey('down') }"
            >
              ↓
            </div>
            <div
              class="key arrow-key"
              :class="{ active: isKeyActive('right'), target: isTargetKey('right') }"
            >
              →
            </div>
          </div>
        </div>
      </div>
    </template>

    <!-- 数字小键盘区（数字小键盘练习模式） -->
    <template v-if="props.mode === 'numpad'">
      <div class="numpad-section">
        <div class="numpad-wrapper">
          <div class="key numpad-key" style="grid-column: 1; grid-row: 1;" :class="{ active: isKeyActive('numlock'), target: isTargetKey('numlock') }">Num</div>
          <div class="key numpad-key" style="grid-column: 2; grid-row: 1;" :class="{ active: isKeyActive('numpaddivide'), target: isTargetKey('numpaddivide') }">/</div>
          <div class="key numpad-key" style="grid-column: 3; grid-row: 1;" :class="{ active: isKeyActive('numpadmultiply'), target: isTargetKey('numpadmultiply') }">*</div>
          <div class="key numpad-key" style="grid-column: 4; grid-row: 1;" :class="{ active: isKeyActive('numpadsubtract'), target: isTargetKey('numpadsubtract') }">-</div>
          <div class="key numpad-key" style="grid-column: 1; grid-row: 2;" :class="{ active: isKeyActive('numpad7'), target: isTargetKey('numpad7') }">7</div>
          <div class="key numpad-key" style="grid-column: 2; grid-row: 2;" :class="{ active: isKeyActive('numpad8'), target: isTargetKey('numpad8') }">8</div>
          <div class="key numpad-key" style="grid-column: 3; grid-row: 2;" :class="{ active: isKeyActive('numpad9'), target: isTargetKey('numpad9') }">9</div>
          <div class="key numpad-key" style="grid-column: 4; grid-row: 2 / span 2;" :class="{ active: isKeyActive('numpadadd'), target: isTargetKey('numpadadd') }">+</div>
          <div class="key numpad-key" style="grid-column: 1; grid-row: 3;" :class="{ active: isKeyActive('numpad4'), target: isTargetKey('numpad4') }">4</div>
          <div class="key numpad-key" style="grid-column: 2; grid-row: 3;" :class="{ active: isKeyActive('numpad5'), target: isTargetKey('numpad5') }">5</div>
          <div class="key numpad-key" style="grid-column: 3; grid-row: 3;" :class="{ active: isKeyActive('numpad6'), target: isTargetKey('numpad6') }">6</div>
          <div class="key numpad-key" style="grid-column: 1; grid-row: 4;" :class="{ active: isKeyActive('numpad1'), target: isTargetKey('numpad1') }">1</div>
          <div class="key numpad-key" style="grid-column: 2; grid-row: 4;" :class="{ active: isKeyActive('numpad2'), target: isTargetKey('numpad2') }">2</div>
          <div class="key numpad-key" style="grid-column: 3; grid-row: 4;" :class="{ active: isKeyActive('numpad3'), target: isTargetKey('numpad3') }">3</div>
          <div class="key numpad-key" style="grid-column: 4; grid-row: 4 / span 2;" :class="{ active: isKeyActive('numpadenter'), target: isTargetKey('numpadenter') }">Ent</div>
          <div class="key numpad-key" style="grid-column: 1 / span 2; grid-row: 5;" :class="{ active: isKeyActive('numpad0'), target: isTargetKey('numpad0') }">0</div>
          <div class="key numpad-key" style="grid-column: 3; grid-row: 5;" :class="{ active: isKeyActive('numpaddecimal'), target: isTargetKey('numpaddecimal') }">.</div>
        </div>
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { normalizeKey } from '@/utils/shortcut-memory-data';

const props = defineProps<{
  pressedKeys: Set<string>;
  targetKeys?: string[];
  mode?: 'default' | 'numpad';
  showRightSection?: boolean;
  keyLabels?: Record<string, string>;
  compact?: boolean;
}>();

const functionKeys = ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
const numberRow = ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'];
const qwertyRow1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'];
const qwertyRow2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"];
const qwertyRow3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'];
const compactRow1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'];
const compactRow2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'];
const compactRow3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M'];

const normalizedPressed = computed(() => {
  return new Set(Array.from(props.pressedKeys).map(k => normalizeKey(k)));
});

const normalizedTarget = computed(() => {
  if (!props.targetKeys) return new Set<string>();
  return new Set(props.targetKeys.map(k => normalizeKey(k)));
});

function isKeyActive(key: string): boolean {
  return normalizedPressed.value.has(normalizeKey(key));
}

function isTargetKey(key: string): boolean {
  return normalizedTarget.value.has(normalizeKey(key));
}
</script>

<style scoped lang="scss">
.keyboard-visual {
  display: flex;
  gap: 12px;
  justify-content: center;
  align-items: flex-start;
  padding: 12px;
  background: var(--utools-bg-secondary);
  border-radius: 12px;
}

.keyboard-layout {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.keyboard-row {
  display: flex;
  gap: 3px;
  justify-content: center;
}

.key {
  width: 36px;
  height: 36px;
  border: 2px solid var(--utools-border-primary);
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  font-size: 11px;
  font-weight: 600;
  color: var(--utools-text-primary);
  background: var(--utools-bg-card);
  transition: all 0.15s ease;
  user-select: none;
  cursor: default;

  &:hover {
    border-color: var(--utools-primary);
  }

  &.active {
    background: var(--utools-primary);
    color: #fff;
    border-color: var(--utools-primary);
    box-shadow: 0 0 8px rgba(64, 158, 255, 0.5);
    transform: translateY(2px);
  }

  &.target {
    border-color: var(--utools-success);
    background: rgba(103, 194, 58, 0.1);

    &.active {
      background: var(--utools-success);
      border-color: var(--utools-success);
      box-shadow: 0 0 8px rgba(103, 194, 58, 0.5);
    }
  }

  &.has-sub {
    line-height: 1.1;
  }

  .key-main {
    font-size: 11px;
  }

  .key-sub {
    font-size: 8px;
    color: var(--utools-text-secondary);
    max-width: 100%;
    padding: 0 2px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  &.active .key-sub,
  &.target .key-sub {
    color: inherit;
  }
}

// 紧凑模式：隐藏最上面两排，放大键位，韵母更突出
.keyboard-visual.compact {
  .keyboard-layout {
    gap: 8px;
  }

  .keyboard-row {
    gap: 6px;
  }

  .key {
    width: 56px;
    height: 56px;
    border-radius: 10px;
  }

  .function-key {
    width: 54px;
    height: 44px;
  }

  .special-key {
    width: 64px;
    font-size: 11px;
  }

  .wide-key {
    width: 84px;
  }

  .extra-wide-key {
    width: 116px;
  }

  .space-key {
    width: 160px;
  }

  .key-main {
    position: absolute;
    top: 3px;
    left: 5px;
    font-size: 12px;
    font-weight: 700;
    color: var(--utools-text-primary);
  }

  .key-sub {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 16px;
    padding: 0 4px;
    text-align: center;
    line-height: 1.15;
    white-space: pre-line;
    word-break: break-all;
    overflow: hidden;
  }
}

.function-key {
  width: 34px;
  height: 28px;
  font-size: 9px;
}

.special-key {
  font-size: 9px;
  width: 42px;
}

.wide-key {
  width: 56px;
}

.extra-wide-key {
  width: 78px;
}

.space-key {
  width: 190px;
}

.right-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
  justify-content: flex-start;
}

.edit-keys {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.edit-row {
  display: flex;
  gap: 3px;
  justify-content: center;
}

.edit-key {
  font-size: 9px;
}

.arrow-keys {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.arrow-row {
  display: flex;
  gap: 3px;
  justify-content: center;
}

.arrow-key {
  width: 36px;
  height: 36px;
}

.numpad-section {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 20px;
}

.numpad-wrapper {
  display: grid;
  grid-template-columns: repeat(4, 56px);
  grid-template-rows: repeat(5, 56px);
  gap: 6px;
}

.numpad-key {
  width: 56px;
  height: 56px;
  font-size: 16px;
}

.numpad-only {
  .numpad-section {
    padding: 40px;
  }

  .numpad-wrapper {
    grid-template-columns: repeat(4, 72px);
    grid-template-rows: repeat(5, 72px);
    gap: 8px;
  }

  .numpad-key {
    width: 72px;
    height: 72px;
    font-size: 20px;
    border-radius: 10px;
  }
}

@media (max-width: 768px) {
  .keyboard-visual {
    flex-direction: column;
    align-items: center;
  }

  .key {
    width: 30px;
    height: 30px;
    font-size: 10px;
  }

  .function-key {
    width: 28px;
    height: 26px;
    font-size: 8px;
  }

  .special-key {
    width: 38px;
    font-size: 8px;
  }

  .wide-key {
    width: 48px;
  }

  .extra-wide-key {
    width: 66px;
  }

  .space-key {
    width: 150px;
  }

  .edit-key {
    width: 28px;
    height: 26px;
    font-size: 7px;
  }

  .arrow-key {
    width: 30px;
    height: 30px;
  }

  .numpad-wrapper {
    grid-template-columns: repeat(4, 48px);
    grid-template-rows: repeat(5, 48px);
    gap: 4px;
  }

  .numpad-key {
    width: 48px;
    height: 48px;
    font-size: 14px;
  }

  .numpad-only {
    .numpad-wrapper {
      grid-template-columns: repeat(4, 56px);
      grid-template-rows: repeat(5, 56px);
    }

    .numpad-key {
      width: 56px;
      height: 56px;
      font-size: 16px;
    }
  }
}
</style>
