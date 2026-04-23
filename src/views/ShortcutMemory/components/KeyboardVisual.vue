<template>
  <div class="keyboard-visual">
    <div class="keyboard-layout">
      <!-- 功能键区 -->
      <div class="keyboard-row function-row">
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
      <div class="keyboard-row">
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
        <div class="key special-key">Tab</div>
        <div
          v-for="key in qwertyRow1"
          :key="key"
          class="key"
          :class="{ active: isKeyActive(key), target: isTargetKey(key) }"
        >
          {{ key }}
        </div>
      </div>

      <!-- QWERTY 第二行 -->
      <div class="keyboard-row">
        <div class="key special-key wide-key" :class="{ active: isKeyActive('capslock') }">Caps</div>
        <div
          v-for="key in qwertyRow2"
          :key="key"
          class="key"
          :class="{ active: isKeyActive(key), target: isTargetKey(key) }"
        >
          {{ key }}
        </div>
        <div class="key special-key wide-key" :class="{ active: isKeyActive('enter') }">Enter</div>
      </div>

      <!-- QWERTY 第三行 -->
      <div class="keyboard-row">
        <div
          class="key special-key extra-wide-key"
          :class="{ active: isKeyActive('shift'), target: isTargetKey('shift') }"
        >
          Shift
        </div>
        <div
          v-for="key in qwertyRow3"
          :key="key"
          class="key"
          :class="{ active: isKeyActive(key), target: isTargetKey(key) }"
        >
          {{ key }}
        </div>
        <div
          class="key special-key extra-wide-key"
          :class="{ active: isKeyActive('shift'), target: isTargetKey('shift') }"
        >
          Shift
        </div>
      </div>

      <!-- 底行 -->
      <div class="keyboard-row">
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
          :class="{ active: isKeyActive('alt'), target: isTargetKey('alt') }"
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
          :class="{ active: isKeyActive('ctrl'), target: isTargetKey('ctrl') }"
        >
          Ctrl
        </div>
      </div>
    </div>

    <!-- 右侧区域：编辑键 + 方向键 -->
    <div class="right-section">
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
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { normalizeKey } from '@/utils/shortcut-memory-data';

const props = defineProps<{
  pressedKeys: Set<string>;
  targetKeys?: string[];
}>();

const functionKeys = ['Esc', 'F1', 'F2', 'F3', 'F4', 'F5', 'F6', 'F7', 'F8', 'F9', 'F10', 'F11', 'F12'];
const numberRow = ['`', '1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '-', '=', 'Backspace'];
const qwertyRow1 = ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P', '[', ']', '\\'];
const qwertyRow2 = ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L', ';', "'"];
const qwertyRow3 = ['Z', 'X', 'C', 'V', 'B', 'N', 'M', ',', '.', '/'];

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
  align-items: center;
  justify-content: center;
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
}
</style>
