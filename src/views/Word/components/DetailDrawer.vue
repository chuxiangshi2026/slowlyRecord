<template>
  <el-drawer
      v-model="visible"
      :title="title"
      size="300px"
      destroy-on-close
  >


    <!--    <div style={{ position: 'relative', overflow: 'hidden' }}>-->
    <!--    <Drawer-->
    <!--        onChange={(e)
        => onChange(e as any)}
        open={showSetting}
        onClose={(e) => onTouchEnd(e as any)}
        placement="right"
        handler={false}
        level={null}
        afterVisibleChange={(c: boolean) => {
        console.log('transitionEnd: ', c)
        }}
        width="30vw"
        >-->
    <!--     设置模块 -->
    <h4 class="header">设置</h4>
    <div class="titles">
      <div class="setting-item">
        <div class="content">加入单词后退出插件</div>
        <el-switch class="shorcut-desc"
                   v-model="value1"
                   inline-prompt
                   size="large"
                   active-text="开"
                   inactive-text="关"
                   style="--el-switch-on-color: #c1bbbb; --el-switch-off-color: rgba(113,109,109,0.29)"
                   @change="onCloseAfterAddSwitchChange"
        />
      </div>
    </div>
    <div>
      <div class="setting-item">
        <div class="content">翻译引擎</div>
        <!--        ;justify-content: space-between;  size="large"-->
        <el-select class="shorcut-desc" v-model="tranApi" @change="updateTranApi" placeholder="选择"
                   style="width:100px">
          <el-option
              v-for="item in options"
              :key="item.value"
              :label="item.label"
              :value="item.value"

          />
        </el-select>
      </div>
    </div>


    <el-divider/>
    <!--     设置模块 -->


    <!--     功能模块 -->
    <!--    <h4 class="header">功能</h4>
        <div class="content">
          <div class="function-item">
            <div>导出</div>
            <div>导入</div>
          </div>
        </div>
        <el-divider/>-->


    <!--     快捷键模块 -->
    <h4 class="header">快捷键</h4>
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

      <!--      <h5 style="text-align:center;">卡片模式</h5>
            <div class="titles">
              <span class="title">功能说明</span>
              <span class="title">快捷键</span>
            </div>
            <div v-for="(item,index) in cardShortcuts"
                 :key="index" class="titles">
              <span class="shorcut-desc">{{ item.desc }}</span>
              <span class="shorcut-desc">{{ item.shortcut }}</span>
            </div>-->
    </div>

    <el-divider/>
    <h4 class="header">其他</h4>
    <div class="content">
      <!--      <div class="view-version-btn" @click="updateshowNotification(true)">查看版本说明</div>-->
    </div>

    <!--    </Drawer>-->

    <!-- 内容区按模块拆分 -->
    <!--    <el-scrollbar height="100%">-->
    <!--      <div class="drawer-body">-->
    <!--        &lt;!&ndash; 基础信息 &ndash;&gt;-->
    <!--        <BasicInfoForm :data="detailData" @change="handleBasicChange" />-->

    <!--        &lt;!&ndash; 分割线 &ndash;&gt;-->
    <!--        <el-divider />-->

    <!--        &lt;!&ndash; 高级配置 &ndash;&gt;-->
    <!--        <AdvancedConfig v-model:config="detailData.config" />-->

    <!--        &lt;!&ndash; 操作日志 &ndash;&gt;-->
    <!--        <LogTable :user-id="detailId" />-->
    <!--      </div>-->

    <!--      &lt;!&ndash; 底部操作 &ndash;&gt;-->
    <!--      <div class="drawer-footer">-->
    <!--        <el-button @click="close">取消</el-button>-->
    <!--        <el-button type="primary" @click="save">保存</el-button>-->
    <!--      </div>-->
    <!--    </el-scrollbar>-->
  </el-drawer>
</template>
<script setup lang="ts">
import {ref, watch, computed} from 'vue'
import {useWordsStore} from "@/stores/words.ts";
import type {TranslationPlatform} from "@/types/words";
// import BasicInfoForm from './BasicInfoForm.vue'
// import AdvancedConfig from './AdvancedConfig.vue'
// import LogTable from './LogTable.vue'

const props = defineProps({
  modelValue: Boolean,
  detailId: [String, Number],
  title: {
    type: String,
    default: '设置'
  }
})

const value1 = ref(true)


const onCloseAfterAddSwitchChange = () => {

}

const listShortcuts = [
  {desc: '记得首个单词', shortcut: 'Shift + R'},
  {desc: '忘记首个单词', shortcut: 'Shift + F'},
  {desc: '首个单词发音', shortcut: 'Shift + P'},
  {desc: '翻译首个单词', shortcut: 'Shift + T'},
  {desc: '确定编辑释义', shortcut: 'Ctrl + Enter'}
]

const cardShortcuts = [
  {desc: '下一个', shortcut: 'Shift + >'},
  {desc: '上一个', shortcut: 'Shift + <'},
  {desc: '单词发音', shortcut: 'Shift + P'},
  {desc: '模式切换', shortcut: 'Shift + M'},
  {desc: '开启/关闭翻译', shortcut: 'Shift + T'},
]

let wordsStore = useWordsStore();

const tranApi = ref<TranslationPlatform>('youdao')
const options = [
  {
    value: 'youdao',
    label: '有道',
  }, {
    value: 'ali',
    label: '阿里',
  },
  {
    value: 'baidu',
    label: '百度',
  },
]
/*{
  value: 'google',
      label: '谷歌',
},
{
  value: 'Option5',
      label: 'Option5',
},*/
const updateTranApi = () => {
  wordsStore.setTranslationPlatform(tranApi.value)
}


const emit = defineEmits(['update:modelValue', 'save'])

const visible = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const detailData = ref({})

// 监听id变化加载数据
/*watch(() => props.detailId, async (id) => {
  if (id && visible.value) {
    detailData.value = await fetchDetail(id)
  }
}, { immediate: true })*/

const close = () => {
  visible.value = false
  detailData.value = {}
}

const save = () => {
  emit('save', detailData.value)
  close()
}
</script>
<style scoped lang="scss">
.el-drawer {
  .rc-switch-checked {
    border: 1px solid #5994fc;
    background-color: #5994fc;
  }

  //&-content
  &__body {
    background-color: #f8f8f8;
    padding-bottom: 20px;
    box-sizing: border-box;

    .view-version-btn {
      background-color: #84acf1;; /* Green */
      border: none;
      color: white;
      padding: 4px 8px;
      box-sizing: border-box;
      text-align: center;
      text-decoration: none;
      display: inline-block;
      font-size: 12px;
      margin: 4px 2px;
      cursor: pointer;
      -webkit-transition-duration: 0.4s; /* Safari */
      transition-duration: 0.4s;
      border-radius: 4px;

      &:hover {
        box-shadow: 0 12px 16px 0 rgba(0, 0, 0, 0.24), 0 17px 50px 0 rgba(0, 0, 0, 0.19);
      }
    }

    .header {
      padding: 0 10px;
    }

    .setting-item {
      display: flex;
      align-items: center;
    }

    .content {
      padding: 0 20px;
      color: #999;
      font-size: 12px;

      .titles {
        display: flex;
        justify-content: space-between;
        font-weight: bold;
        color: #666;
      }

      .shorcut-desc {
        margin-top: 10px;
        font-size: 12px;
        font-weight: 400;
      }
    }
  }
}

</style>
