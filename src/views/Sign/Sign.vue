<template>
  sign
  <el-descriptions border direction="vertical" column="9">
    <el-descriptions-item label="月份">{{ month }}月</el-descriptions-item>
    <el-descriptions-item v-for="(value, key) in DetailKey" :key="key" :label="value">
      {{ detailValue[key] }}
    </el-descriptions-item>
    <el-descriptions-item label="操作">
      <!--      <el-tag size="small">School</el-tag>-->
      <el-button type="primary" plain size="small" @click="handleToException">查看详情</el-button>
    </el-descriptions-item>
    <el-descriptions-item label="操作">
      <el-tag :type="detailState.type" size="small">{{detailState.text}}</el-tag>
    </el-descriptions-item>
  </el-descriptions>
  <el-calendar v-model="date">
    <template #header>
      <!--      @click="handlePutTime"-->
      <el-button type="primary">在线签到</el-button>
      <el-space>
        <el-button plain>{{ year }}年</el-button>
        <el-select v-model="month" @change="handleChange">
          <el-option v-for="item in 12" :key="item" :value="item" :label="item + '月'"/>
        </el-select>
      </el-space>
    </template>
  </el-calendar>
</template>

<script setup lang="ts">
import {reactive, ref} from 'vue'
import {useRouter} from "vue-router";

const date = ref(new Date())

const year = date.value.getFullYear();
const month = ref(date.value.getMonth() + 1);
const handleChange = (value: number) => {
  date.value = new Date(year, value - 1)
  console.log(date.value);
}

enum DetailKey {
  normal = '正常出勤',
  absent = '旷工',
  miss = '漏打卡',
  late = '迟到',
  early = '早退',
  lateAndEarly = '迟到并早退'
}

const detailValue = reactive({
  normal: 0,
  absent: 0,
  miss: 0,
  late: 5,
  early: 0,
  lateAndEarly: 0
});

const router = useRouter();

const handleToException = () => {
  router.push('/exception')
  console.log('handleToException');
}

const detailState = reactive({
  type: 'success' as 'success' | 'danger',
  text: '正常' as '正常' | '异常',
});
</script>

<style scoped lang="scss">
.el-descriptions {
  margin: 10px;
}

.el-select {
  width: 80px;
}
</style>
