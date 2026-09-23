<template>
  <view class="edit-container">
    <view class="form-card">
      <text class="label">宫殿名称</text>
      <input v-model="name" class="input" placeholder="如：我的家" maxlength="20" />
    </view>

    <view class="section-title">记忆桩（按顺序排列）</view>
    <view v-if="loci.length === 0" class="empty-loci">还没有桩，点击下方添加</view>
    <view v-for="(locus, idx) in loci" :key="idx" class="locus-item">
      <view class="locus-order">{{ idx + 1 }}</view>
      <view class="locus-body">
        <input v-model="locus.name" class="input" placeholder="桩名称，如：大门" maxlength="12" />
        <input v-model="locus.description" class="input sub" placeholder="描述（可选）" maxlength="30" />
        <view class="locus-image-row">
          <image v-if="locus.imageUrl" class="locus-thumb" :src="locus.imageUrl" mode="aspectFill" @click="chooseImage(idx)" />
          <view v-else class="locus-thumb-placeholder" @click="chooseImage(idx)">
            <text v-if="locus.emoji" class="thumb-emoji">{{ locus.emoji }}</text>
            <template v-else>
              <text class="thumb-plus">＋</text>
              <text class="thumb-hint">图片</text>
            </template>
          </view>
          <text v-if="locus.imageUrl" class="img-action danger" @click="removeImage(idx)">删除</text>
        </view>
      </view>
      <view class="locus-actions">
        <text v-if="idx > 0" class="action-btn" @click="moveLocus(idx, -1)">↑</text>
        <text v-if="idx < loci.length - 1" class="action-btn" @click="moveLocus(idx, 1)">↓</text>
        <text class="action-btn danger" @click="removeLocus(idx)">×</text>
      </view>
    </view>

    <button class="add-locus-btn" @click="addLocus">＋ 添加桩</button>
    <button class="add-locus-btn import-btn" @click="openImport">📚 导入桩库</button>

    <!-- 导入桩库弹层：先选桩库，再预览勾选导入 -->
    <view v-if="showImport" class="import-mask" @click="closeImport" @touchmove.stop.prevent>
      <view class="import-panel" @click.stop>
        <view class="panel-header">
          <text class="panel-title">{{ previewLoci ? '选择要导入的桩' : '导入桩库' }}</text>
          <text class="panel-close" @click="closeImport">×</text>
        </view>

        <!-- 第一步：桩库列表 -->
        <scroll-view v-if="!previewLoci" scroll-y class="panel-scroll">
          <view v-for="pack in pegPacks" :key="pack.id" class="pack-item" @click="openPreview(pack.id)">
            <view class="pack-item-head">
              <text class="pack-name">{{ pack.name }}</text>
              <text class="pack-count">{{ pack.itemCount }} 桩</text>
            </view>
            <text class="pack-desc">{{ pack.description }}</text>
          </view>
        </scroll-view>

        <!-- 第二步：桩预览 + 勾选 -->
        <template v-else>
          <view class="panel-toolbar">
            <text class="tool-btn" @click="togglePickAll">{{ pickedCount === previewLoci.length ? '全不选' : '全选' }}</text>
            <text class="panel-pack-name">{{ previewPackName }}</text>
            <text class="tool-btn" @click="previewLoci = null">返回</text>
          </view>
          <scroll-view scroll-y class="panel-scroll">
            <view v-for="(locus, idx) in previewLoci" :key="idx" class="preview-item" @click="togglePick(idx)">
              <view class="pick-box" :class="{ checked: pickedSet.has(idx) }">
                <text v-if="pickedSet.has(idx)" class="pick-tick">✓</text>
              </view>
              <view class="preview-order">{{ idx + 1 }}</view>
              <view class="preview-body">
                <text class="preview-name">{{ locus.emoji }}{{ locus.name }}</text>
                <text v-if="locus.description" class="preview-desc">{{ locus.description }}</text>
              </view>
            </view>
          </scroll-view>
          <view class="panel-footer">
            <button class="panel-btn cancel" @click="closeImport">取消</button>
            <button class="panel-btn confirm" :disabled="pickedCount === 0" @click="confirmImport">导入 {{ pickedCount }} 桩</button>
          </view>
        </template>
      </view>
    </view>

    <view class="footer">
      <button class="btn-cancel" @click="goBack">取消</button>
      <button class="btn-save" @click="save">保存</button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useMemoryPalace } from '@/stores/useMemoryPalace'
import type { KnowledgePackInfo } from '@/stores/useUtils/types'
import { pegPackToLoci, type PegLocusDraft } from '@/utils/memory-palace'
import { getPegPack, listPegPacks } from '../utils/peg-packs'

/** 编辑期桩元素（emoji 仅为导入桩库后的编辑期展示，保存时不入库） */
interface LocusDraft {
  name: string
  description?: string
  imageUrl?: string
  origOrder?: number
  emoji?: string
}

const store = useMemoryPalace()
const palaceId = ref('')
const name = ref('')
const loci = ref<LocusDraft[]>([])

onMounted(() => {
  const pages = getCurrentPages()
  const current = pages[pages.length - 1] as any
  palaceId.value = current?.$page?.options?.id || ''
  if (palaceId.value) {
    store.load()
    const palace = store.getPalace(palaceId.value)
    if (palace) {
      name.value = palace.name
      loci.value = palace.loci.map(l => ({ name: l.name, description: l.description, imageUrl: l.imageUrl, origOrder: l.order }))
    }
  }
})

function addLocus() {
  loci.value.push({ name: '' })
}

function removeLocus(idx: number) {
  loci.value.splice(idx, 1)
}

function moveLocus(idx: number, dir: -1 | 1) {
  const target = idx + dir
  if (target < 0 || target >= loci.value.length) return
  const arr = [...loci.value]
  ;[arr[idx], arr[target]] = [arr[target], arr[idx]]
  loci.value = arr
}

function save() {
  const trimmed = name.value.trim()
  if (!trimmed) {
    uni.showToast({ title: '请输入宫殿名称', icon: 'none' })
    return
  }
  const validLoci = loci.value.filter(l => l.name.trim())
  if (validLoci.length === 0) {
    uni.showToast({ title: '至少添加一个桩', icon: 'none' })
    return
  }
  if (palaceId.value) {
    // 编辑：改名称 + 全量替换桩（replaceLoci 按 origOrder 重映射挂载，保留 SRS 进度）
    store.updatePalace(palaceId.value, trimmed)
    store.replaceLoci(palaceId.value, validLoci)
  } else {
    const palace = store.createPalace(trimmed)
    validLoci.forEach(l => store.addLocus(palace._id, l))
  }
  uni.showToast({ title: palaceId.value ? '已保存' : '已创建', icon: 'success' })
  setTimeout(() => uni.navigateBack(), 300)
}

function goBack() {
  uni.navigateBack()
}

function chooseImage(idx: number) {
  uni.chooseImage({
    count: 1,
    sizeType: ['compressed'],
    sourceType: ['album', 'camera'],
    success: (res) => {
      const path = res.tempFilePaths[0]
      // 小程序里无法直接 read file → 用 getFileSystemManager 读 base64
      const fs = uni.getFileSystemManager()
      fs.readFile({
        filePath: path,
        encoding: 'base64',
        success: (read: any) => {
          const dataURL = `data:image/jpeg;base64,${read.data}`
          loci.value[idx].imageUrl = dataURL
        },
        fail: () => {
          // 读取失败时退回直接存路径（H5/App 可用）
          loci.value[idx].imageUrl = path
        },
      })
    },
  })
}

function removeImage(idx: number) {
  loci.value[idx].imageUrl = undefined
}

// ===== 导入桩库 =====

const showImport = ref(false)
const pegPacks = ref<KnowledgePackInfo[]>([])
const previewLoci = ref<PegLocusDraft[] | null>(null)
const previewPackName = ref('')
const pickedSet = ref<Set<number>>(new Set())

const pickedCount = computed(() => pickedSet.value.size)

function openImport() {
  pegPacks.value = listPegPacks()
  previewLoci.value = null
  showImport.value = true
}

function closeImport() {
  showImport.value = false
  previewLoci.value = null
}

/** 选中桩库 → 预览桩列表（默认全选，保持桩库顺序） */
function openPreview(packId: string) {
  const pack = getPegPack(packId)
  previewPackName.value = pack.name
  const drafts = pegPackToLoci(pack)
  previewLoci.value = drafts
  pickedSet.value = new Set(drafts.map((_, i) => i))
}

function togglePick(idx: number) {
  const next = new Set(pickedSet.value)
  if (next.has(idx)) next.delete(idx)
  else next.add(idx)
  pickedSet.value = next
}

function togglePickAll() {
  pickedSet.value = pickedSet.value.size === previewLoci.value!.length
    ? new Set()
    : new Set(previewLoci.value!.map((_, i) => i))
}

/** 勾选的桩追加到编辑列表尾部（复用现有保存链路，不直接写库） */
function confirmImport() {
  const items = previewLoci.value!.filter((_, i) => pickedSet.value.has(i))
  if (items.length === 0) return
  loci.value.push(...items.map(l => ({ name: l.name, description: l.description, imageUrl: l.imageUrl, emoji: l.emoji })))
  showImport.value = false
  previewLoci.value = null
  uni.showToast({ title: `已导入 ${items.length} 个桩`, icon: 'none' })
}
</script>

<style scoped>
.edit-container {
  min-height: 100vh;
  background: #f5f7f5;
  padding: 20rpx;
  padding-bottom: 120rpx;
}

.form-card {
  background: #fff;
  border-radius: 16rpx;
  padding: 30rpx;
  margin-bottom: 20rpx;
}

.label {
  font-size: 26rpx;
  color: #666;
  margin-bottom: 12rpx;
  display: block;
}

.input {
  border: 1rpx solid #e0e6e2;
  border-radius: 12rpx;
  padding: 16rpx 20rpx;
  font-size: 30rpx;
  background: #fafcfa;
}

.input.sub {
  margin-top: 12rpx;
  font-size: 26rpx;
  color: #666;
}

.section-title {
  font-size: 28rpx;
  color: #333;
  font-weight: bold;
  margin: 24rpx 0 12rpx;
}

.empty-loci {
  text-align: center;
  color: #999;
  font-size: 26rpx;
  padding: 40rpx 0;
}

.locus-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 16rpx;
  padding: 20rpx;
  margin-bottom: 16rpx;
}

.locus-order {
  width: 48rpx;
  height: 48rpx;
  border-radius: 50%;
  background: #eaf1ea;
  color: #52796f;
  font-size: 26rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.locus-body {
  flex: 1;
  margin-left: 16rpx;
}

.locus-actions {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  margin-left: 12rpx;
}

.action-btn {
  font-size: 32rpx;
  color: #52796f;
  width: 48rpx;
  height: 48rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}

.action-btn.danger {
  color: #c0564f;
}

.add-locus-btn {
  background: #fff;
  border: 2rpx dashed #52796f;
  color: #52796f;
  border-radius: 16rpx;
  font-size: 28rpx;
  margin-top: 8rpx;
}

.footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  gap: 20rpx;
  padding: 20rpx;
  background: #f5f7f5;
  border-top: 1rpx solid #e8ede9;
}

.btn-cancel {
  flex: 1;
  background: #fff;
  color: #666;
  border-radius: 16rpx;
  font-size: 30rpx;
}

.btn-save {
  flex: 1;
  background: #52796f;
  color: #fff;
  border-radius: 16rpx;
  font-size: 30rpx;
}

.locus-image-row {
  display: flex;
  align-items: center;
  gap: 12rpx;
  margin-top: 12rpx;
}

.locus-thumb {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  border: 1rpx solid #e0e6e2;
}

.locus-thumb-placeholder {
  width: 100rpx;
  height: 100rpx;
  border-radius: 12rpx;
  border: 2rpx dashed #b0c4b8;
  background: #f5f7f5;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 4rpx;
}

.thumb-plus {
  font-size: 36rpx;
  color: #b0c4b8;
  line-height: 1;
}

.thumb-hint {
  font-size: 20rpx;
  color: #999;
}

.img-action {
  font-size: 24rpx;
  color: #c0564f;
}

.thumb-emoji {
  font-size: 44rpx;
  line-height: 1;
}

.import-btn {
  margin-top: 16rpx;
  border-style: solid;
  background: #eaf1ea;
}

/* ===== 导入桩库弹层 ===== */

.import-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.45);
  z-index: 100;
  display: flex;
  align-items: flex-end;
}

.import-panel {
  width: 100%;
  max-height: 75vh;
  background: #fff;
  border-radius: 24rpx 24rpx 0 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.panel-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 28rpx 30rpx 16rpx;
}

.panel-title {
  font-size: 32rpx;
  font-weight: bold;
  color: #333;
}

.panel-close {
  font-size: 44rpx;
  color: #999;
  line-height: 1;
  padding: 0 8rpx;
}

.panel-scroll {
  flex: 1;
  max-height: 52vh;
  padding: 0 30rpx;
  box-sizing: border-box;
}

.pack-item {
  padding: 24rpx 0;
  border-bottom: 1rpx solid #eef2ef;
}

.pack-item-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.pack-name {
  font-size: 30rpx;
  color: #333;
  font-weight: bold;
}

.pack-count {
  font-size: 24rpx;
  color: #52796f;
  background: #eaf1ea;
  border-radius: 20rpx;
  padding: 4rpx 16rpx;
  flex-shrink: 0;
}

.pack-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 8rpx;
}

.panel-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8rpx 30rpx 12rpx;
}

.tool-btn {
  font-size: 26rpx;
  color: #52796f;
  padding: 8rpx 16rpx;
}

.panel-pack-name {
  font-size: 26rpx;
  color: #666;
  max-width: 400rpx;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.preview-item {
  display: flex;
  align-items: center;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #eef2ef;
}

.pick-box {
  width: 40rpx;
  height: 40rpx;
  border: 2rpx solid #b0c4b8;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.pick-box.checked {
  background: #52796f;
  border-color: #52796f;
}

.pick-tick {
  font-size: 26rpx;
  color: #fff;
}

.preview-order {
  width: 44rpx;
  font-size: 24rpx;
  color: #999;
  text-align: center;
  flex-shrink: 0;
}

.preview-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  margin-left: 8rpx;
}

.preview-name {
  font-size: 30rpx;
  color: #333;
}

.preview-desc {
  font-size: 24rpx;
  color: #999;
  margin-top: 4rpx;
}

.panel-footer {
  display: flex;
  gap: 20rpx;
  padding: 20rpx 30rpx calc(20rpx + env(safe-area-inset-bottom));
  border-top: 1rpx solid #e8ede9;
}

.panel-btn {
  flex: 1;
  border-radius: 16rpx;
  font-size: 30rpx;
}

.panel-btn.cancel {
  background: #fff;
  color: #666;
  border: 1rpx solid #e0e6e2;
}

.panel-btn.confirm {
  background: #52796f;
  color: #fff;
}

.panel-btn.confirm[disabled] {
  background: #b0c4b8;
  color: #fff;
}
</style>
