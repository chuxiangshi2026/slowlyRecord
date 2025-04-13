<template>
  <div class="login">
    <div class="header">
          <span class="header-logo">
            <i class="iconfont icon-vue"></i>
            <i class="iconfont icon-icon-test"></i>
            <i class="iconfont icon-typescript"></i>
          </span>
      <span class="header-title">在线考勤系统</span>
    </div>
    <div class="desc">
      零基础从入门到进阶，系统掌握前端三大热门技术(Vue、React、TypeScript)
    </div>
    <el-form
        ref="ruleFormRef"
        :model="ruleForm"
        :rules="rules"
        label-width="120px"
        class="main"
    >
      <el-form-item label="邮箱" prop="email">
        <el-input
            type="text"
            placeholder="请输入邮箱"
            v-model="ruleForm.email"
        />
      </el-form-item>
      <el-form-item label="密码" prop="pass">
        <el-input
            type="password"
            placeholder="请输入密码"
            v-model="ruleForm.pass"
        />
      </el-form-item>
      <el-form-item>
        <el-button type="primary" @click="submitForm(ruleFormRef)" auto-insert-space>登录</el-button>
      </el-form-item>
    </el-form>
    <div class="users">
      <el-row :gutter="20">
        <el-col :span="12" v-for="item in testUsers" :key="item.email">
          <h3>
            测试账号，
            <el-button @click="autoLogin(item)">一键登录</el-button>
          </h3>
          <p>邮箱：{{ item.email }}</p>
          <p>密码：{{ item.pass }} </p>
        </el-col>
      </el-row>
    </div>


    <!--        <el-form
                ref="ruleFormRef"
                :model="ruleForm"
                :rules="rules"
                label-width="120px"
                class="main"
            >
              <el-form-item
                  label="邮箱"
                  prop="email"
              >
                <el-input v-model="ruleForm.email" type="text" autocomplete="请输入邮箱"/>
              </el-form-item>
              <el-form-item
                  label="密码"
                  prop="pass"
              >
                <el-input v-model="ruleForm.pass" type="password" autocomplete="请输入密码"/>
              </el-form-item>
              <el-form-item>
                <el-button type="primary" @click="submitForm(ruleFormRef)" auto-insert-space>Submit</el-button>
              </el-form-item>
            </el-form>-->
  </div>
</template>

<script setup lang="ts">


import {reactive, ref} from 'vue'
import type {FormInstance, FormRules} from 'element-plus'
import {useStore} from "@/store";
import {ElMessage} from "element-plus";
import {useRouter} from "vue-router";

const store = useStore();
const router = useRouter()

const rules = reactive<FormRules>({
  email: [{
    required: true,
    message: '请输入邮箱地址',
    trigger: 'blur',
  },
    {
      type: 'email',
      message: '邮箱地址不正确',
      trigger: ['blur', 'change'],
    }],
  pass: [{
    required: true,
    message: '密码不能为空',
    trigger: 'blur',
  }]
})

// import {useStore} from '@/store';


interface User {
  email: string;
  pass: string;
}


const testUsers: User[] = [{
  email: 'huangrong@imooc.com',
  pass: 'huangrong'
}, {
  email: 'hongqigong@imooc.com',
  pass: 'hongqigong'
}]


const autoLogin = (user: User) => {
  ruleForm.email = user.email;
  ruleForm.pass = user.pass;
  submitForm(ruleFormRef.value)
}

// 表单实例
const ruleForm = reactive<User>({email: '', pass: ''});

// 创建实例
const ruleFormRef = ref<FormInstance>()


const submitForm = (formEl: FormInstance | undefined) => {
  if (!formEl) return
  formEl.validate((valid) => {
    if (valid) {
      // console.log(ruleFormRef.value)
      // console.log(ruleForm)
      console.log('submit!')
      store.dispatch('users/login', ruleForm).then((res) => {

            if (res.data.errcode === 0) {
              store.commit('users/updateToken', res.data.token)
              ElMessage.success('登录成功')
              router.push('/')
            } else {
              ElMessage.error('登录失败')
              // ElMessage.error(res.data.errmsg)
            }
          }
      )
      // console.log(ruleForm)
    } else {
      // console.log("000")
      console.log('error submit!')
    }
  })
}

// const store = useStore();
//
// store.dispatch('users/login',
//     {username: 'admin', password: '123456'})
//     .then(res => {
//       console.log(res.data);
//     });

</script>

<style scoped lang="scss">
.login {
  width: 100vw;
  height: 100vh;
  background: url('@/assets/images/login-bg.svg') no-repeat center 110px;
  background-size: 100%;

  .header {
    height: 44px;
    line-height: 44px;
    display: flex;
    justify-content: center;
    align-items: center;
    font-size: 34px;
    padding-top: 100px;

    .header-logo {
      .icon-vue,
      .icon-icon-test,
      .icon-typescript {
        margin-right: 5px;
        font-size: inherit;
      }

      .icon-vue {
        color: green;
      }

      .icon-icon-test {
        color: #deb887;
      }

      .icon-typescript {
        color: blue;
      }
    }

    .header-title {
      margin-left: 30px;
      font-weight: 700;
      font-size: 30px;
    }
  }

  .desc {
    text-align: center;
    padding-top: 30px;
    color: rgba(0, 0, 0, 0.45);
    font-size: 16px;
  }

  .main {
    width: 500px;
    margin: 0 auto;
    padding-top: 50px;
  }

  .users {
    width: 500px;
    margin: 60px auto;
    color: rgba(0, 0, 0, .65);

    h3 {
      font-size: 16px;
    }

    p {
      margin: 20px;
    }
  }
}
</style>
