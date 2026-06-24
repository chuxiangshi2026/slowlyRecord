import axios from 'axios'

import type {AxiosRequestConfig, AxiosResponse} from 'axios'
// import store from "@/store";
// import type {StateAll} from "@/store";
import {ElMessage} from "element-plus";
// import {truncate} from "lodash";

// 定义baseUrl
// const baseURL = import.meta.env.MODE === 'development' ? '/api' : 'https://openapi.youdao.com/api'

const baseURL = 'https://openapi.youdao.com/api';
// 创建实例
const instance = axios.create({
    // 基础url
    baseURL: baseURL,
    // 超时时间（AI 引擎首响应可能 3-8s，普通翻译也偶有抖动，统一放宽到 30s）
    timeout: 30000
});
// 请求拦截器
instance.interceptors.request.use(function (config) {
    if (config.headers) {
        // 使用类型断言解决类型不匹配问题
        config.headers = {...config.headers} as any;
    } else {
        config.headers = {'Access-Control-Allow-Origin': 'https://openapi.youdao.com/api'} as any;
    }

    return config;
}, function (error) {
// 对请求错误做些什么
    return Promise.reject(error);
});
// 响应拦截器
/*instance.interceptors.response.use(function (response) {

    if (response.data.errmsg === 'token error') {
        ElMessage.error('token error')
        store.commit('users/clearToken')

        setTimeout(() => {
            window.location.replace('/login')
        }, 1000)
    }
    // 对响应数据做点什么
    return response;
}, function (error) {
    // 对响应错误做点什么
    return Promise.reject(error);
});*/

// data类型
interface Data {
    [index: string]: unknown
}


// 接口类型
interface Http {
    get: (url: string, data?: Data, config?: AxiosRequestConfig) => Promise<AxiosResponse>
    post: (url: string, data?: Data, config?: AxiosRequestConfig) => Promise<AxiosResponse>
    put: (url: string, data?: Data, config?: AxiosRequestConfig) => Promise<AxiosResponse>
    patch: (url: string, data?: Data, config?: AxiosRequestConfig) => Promise<AxiosResponse>
    delete: (url: string, data?: Data, config?: AxiosRequestConfig) => Promise<AxiosResponse>
}

const http: Http = {
    get(url, data, config) {
        return instance.get(url, {
            params: data,
            ...config
            //     把data数据放到params里面，config合并
        })
    },
    post(url, data, config) {
        return instance.post(url, data, config)
    },
    put(url, data, config) {
        return instance.put(url, data, config)
    },
    // 只更新与响应部分参数
    patch(url, data, config) {
        return instance.patch(url, data, config)
    },
    delete(url, data, config) {
        return instance.delete(url, {
            data,
            ...config
        })
    }
}
export default http;
