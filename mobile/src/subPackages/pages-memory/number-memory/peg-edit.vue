<template>
  <view class="page">
    <view class="number-display">
      <text class="number-text">{{ pegNumber }}</text>
      <text class="number-hint">为这个数字编一个易记的桩</text>
    </view>

    <view class="form-card">
      <text class="form-label">文字描述（可加 emoji）</text>
      <textarea
        class="desc-input"
        v-model="description"
        placeholder="如：🧪 药水（与 yào 谐音）"
        auto-height
        :focus="true"
        :maxlength="100"
      />

      <text class="form-label image-label">配图（可选，存储于本机并随同步走）</text>
      <view class="image-block">
        <image
          v-if="imageDataUrl"
          :src="imageDataUrl"
          mode="aspectFill"
          class="peg-image"
          @click="chooseImage"
        />
        <view v-else class="image-add" @click="chooseImage">
          <text class="image-add-icon">📷</text>
          <text class="image-add-text">拍照 / 相册选图</text>
        </view>
        <view v-if="imageDataUrl" class="image-actions">
          <text class="image-action-link" @click="chooseImage">更换</text>
          <text class="image-action-link danger" @click="removeImage">移除</text>
        </view>
      </view>

      <text class="form-tip">💡 例如：00→🧪药水、01→🐦小鸟、12→🌷郁金香、64→🦂蝎子。可再配一张实拍图加深印象。</text>

      <view class="suggest-block" v-if="suggestions.length > 0">
        <text class="suggest-title">这些数字可以联想：</text>
        <view class="suggest-chips">
          <view
            v-for="s in suggestions"
            :key="s"
            class="suggest-chip"
            @click="description = s"
          >
            {{ s }}
          </view>
        </view>
      </view>
    </view>

    <view class="actions">
      <button class="action-btn secondary" @click="onCancel">取消</button>
      <button v-if="hasExisting" class="action-btn danger" @click="onDelete">删除</button>
      <button class="action-btn primary" @click="onSave">保存</button>
    </view>

    <!-- 图片压缩用的离屏画布（仅小程序端） -->
    <!-- #ifdef MP-WEIXIN || MP-TOUTIAO -->
    <canvas
      canvas-id="pegCompress"
      id="pegCompress"
      class="compress-canvas"
      :style="{ width: canvasW + 'px', height: canvasH + 'px' }"
    />
    <!-- #endif -->
  </view>
</template>

<script setup lang="ts">
import { ref, computed, getCurrentInstance, nextTick } from 'vue'
import { onLoad } from '@dcloudio/uni-app'
import { useNumberMemory } from '@/stores/useNumberMemory'
import { getCaptureAdapter } from '@/subPackages/pages-tools/utils/capture'

const store = useNumberMemory()

const pegNumber = ref('')
const description = ref('')
// 桩位配图：与桌面端一致的 dataURL（data:image/...;base64,...）
const imageDataUrl = ref('')
const picking = ref(false)

// 压缩参数：base64 超过阈值时二次压缩到 512px 内的 JPEG
const MAX_BASE64_CHARS = 600 * 1024
const COMPRESS_MAX_EDGE = 512
const canvasW = ref(COMPRESS_MAX_EDGE)
const canvasH = ref(COMPRESS_MAX_EDGE)
const instance = getCurrentInstance()

const existing = computed(() => store.getAssociation(pegNumber.value))
const hasExisting = computed(() => !!existing.value)

// 一些常用谐音/形似桩位提示
const SUGGESTION_MAP: Record<string, string[]> = {
  '0': ['🥚 蛋', '⭕ 圈'],
  '1': ['🌳 树', '🖊️ 笔', '🚶 一个人'],
  '2': ['🦆 鸭子', '👬 双胞胎'],
  '3': ['🌳 山（外形像3）', '👂 耳朵'],
  '4': ['⛵ 帆船', '🎏 红旗'],
  '5': ['🪝 钩子', '✋ 五指'],
  '6': ['🥄 勺子', '🐌 蜗牛'],
  '7': ['🪓 斧头', '🦵 拐杖'],
  '8': ['👓 眼镜', '⛄ 雪人'],
  '9': ['🎈 气球', '🎯 标枪'],
  '00': ['🧪 药水', '🍩 双甜甜圈'],
  '01': ['🐦 小鸟', '🥚 一个蛋'],
  '12': ['🌷 郁金香', '🕛 中午'],
  '64': ['🦂 蝎子', '🎉 庆典'],
  '99': ['🍑 99桃', '👴 长寿'],
}

const suggestions = computed(() => SUGGESTION_MAP[pegNumber.value] || [])

onLoad((opt: any) => {
  store.load()
  if (opt?.number) {
    pegNumber.value = decodeURIComponent(opt.number)
    uni.setNavigationBarTitle({ title: `数字桩 ${pegNumber.value}` })
    const e = store.getAssociation(pegNumber.value)
    if (e) {
      description.value = e.description
      imageDataUrl.value = e.imageUrl || ''
    }
  }
})

/** 裸 base64 → 带 mime 的 dataURL（按魔数区分 png/jpeg） */
function withMime(base64: string): string {
  if (base64.startsWith('iVBORw0KGgo')) return `data:image/png;base64,${base64}`
  return `data:image/jpeg;base64,${base64}`
}

/** 选图（相册/拍照），过大时走 canvas 二次压缩 */
async function chooseImage() {
  if (picking.value) return
  picking.value = true
  uni.showLoading({ title: '处理图片中' })
  try {
    const result = await getCaptureAdapter().capture()
    let dataUrl = withMime(result.base64)
    // #ifdef MP-WEIXIN || MP-TOUTIAO
    if (dataUrl.length > MAX_BASE64_CHARS && result.path) {
      try {
        dataUrl = await compressByCanvas(result.path)
      } catch (e) {
        console.error('图片压缩失败，使用原图:', e)
      }
    }
    // #endif
    imageDataUrl.value = dataUrl
    if (dataUrl.length > MAX_BASE64_CHARS) {
      uni.showToast({ title: '图片偏大，存储占用会较高', icon: 'none' })
    }
  } catch {
    // 用户取消选图，静默
  } finally {
    uni.hideLoading()
    picking.value = false
  }
}

function removeImage() {
  imageDataUrl.value = ''
}

/** canvas 缩放到 512px 内并转 JPEG，返回 dataURL（仅小程序端调用） */
function compressByCanvas(tempPath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    uni.getImageInfo({
      src: tempPath,
      success: (info: any) => {
        const scale = Math.min(1, COMPRESS_MAX_EDGE / Math.max(info.width, info.height))
        const w = Math.max(1, Math.round(info.width * scale))
        const h = Math.max(1, Math.round(info.height * scale))
        canvasW.value = w
        canvasH.value = h
        nextTick(() => {
          const ctx = uni.createCanvasContext('pegCompress', instance?.proxy as any)
          ctx.drawImage(tempPath, 0, 0, w, h)
          ctx.draw(false, () => {
            uni.canvasToTempFilePath({
              canvasId: 'pegCompress',
              width: w,
              height: h,
              destWidth: w,
              destHeight: h,
              fileType: 'jpg',
              quality: 0.75,
              success: (res: any) => {
                try {
                  const fs = uni.getFileSystemManager()
                  const b64 = fs.readFileSync(res.tempFilePath, 'base64')
                  resolve(`data:image/jpeg;base64,${b64}`)
                } catch (e) {
                  reject(e)
                }
              },
              fail: (err: any) => reject(err),
            } as any, instance?.proxy as any)
          })
        })
      },
      fail: (err: any) => reject(err),
    })
  })
}

function onSave() {
  const desc = description.value.trim()
  if (!desc) {
    uni.showToast({ title: '请填写描述', icon: 'none' })
    return
  }
  store.setAssociation({
    number: pegNumber.value,
    description: desc,
    source: 'user',
    // 传 '' 表示清除配图
    imageUrl: imageDataUrl.value,
    imageSource: imageDataUrl.value ? 'base64' : undefined,
  })
  uni.showToast({ title: '已保存', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 300)
}

function onDelete() {
  uni.showModal({
    title: '删除桩位',
    content: `确定删除数字 ${pegNumber.value} 的文字桩？`,
    confirmText: '删除',
    confirmColor: '#e64340',
    success: (res) => {
      if (res.confirm) {
        store.deleteAssociation(pegNumber.value)
        uni.showToast({ title: '已删除', icon: 'success' })
        setTimeout(() => uni.navigateBack(), 300)
      }
    },
  })
}

function onCancel() {
  uni.navigateBack()
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background: #f5f6fa;
  padding: 40rpx 24rpx 200rpx;
}

.number-display {
  text-align: center;
  padding: 60rpx 0;
}
.number-text {
  font-size: 160rpx;
  font-weight: bold;
  color: #52796f;
  letter-spacing: 8rpx;
  font-family: 'Courier New', monospace;
  display: block;
}
.number-hint {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
  display: block;
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 28rpx;
}
.form-label {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 12rpx;
  display: block;
}
.desc-input {
  background: #f7f8fa;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  font-size: 30rpx;
  color: #303030;
  width: 100%;
  min-height: 140rpx;
  line-height: 1.6;
  box-sizing: border-box;
}
.form-tip {
  font-size: 22rpx;
  color: #999;
  line-height: 1.6;
  display: block;
  margin-top: 20rpx;
}

/* 配图 */
.image-label {
  margin-top: 24rpx;
}
.image-block {
  display: flex;
  align-items: center;
  gap: 20rpx;
}
.peg-image {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: #f0f0f0;
}
.image-add {
  width: 200rpx;
  height: 200rpx;
  border-radius: 12rpx;
  background: #f7f8fa;
  border: 2rpx dashed #c8d6cc;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}
.image-add-icon {
  font-size: 48rpx;
}
.image-add-text {
  font-size: 20rpx;
  color: #999;
  margin-top: 8rpx;
}
.image-actions {
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.image-action-link {
  font-size: 24rpx;
  color: #52796f;
  padding: 8rpx 20rpx;
  background: #eef4f0;
  border-radius: 20rpx;
}
.image-action-link.danger {
  color: #e64340;
  background: #fee;
}
.compress-canvas {
  position: fixed;
  left: -9999px;
  top: -9999px;
}

.suggest-block {
  margin-top: 24rpx;
  padding-top: 20rpx;
  border-top: 1rpx solid #f0f0f0;
}
.suggest-title {
  font-size: 24rpx;
  color: #888;
  margin-bottom: 12rpx;
  display: block;
}
.suggest-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.suggest-chip {
  padding: 12rpx 20rpx;
  background: #eef4f0;
  color: #52796f;
  border-radius: 24rpx;
  font-size: 24rpx;
}

.actions {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 16rpx;
  padding: 24rpx;
  background: #fff;
  box-shadow: 0 -2rpx 8rpx rgba(0, 0, 0, 0.05);
}

.action-btn {
  flex: 1;
  height: 88rpx;
  line-height: 88rpx;
  border-radius: 44rpx;
  font-size: 30rpx;
  border: none;
  margin: 0;
}
.action-btn.primary {
  background: #52796f;
  color: #fff;
}
.action-btn.secondary {
  background: #f5f5f5;
  color: #666;
}
.action-btn.danger {
  background: #fee;
  color: #e64340;
  flex: 0.6;
}
</style>
