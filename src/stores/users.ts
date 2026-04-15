import {ref,reactive} from 'vue'
import {defineStore} from 'pinia'
import http from '@/utils/http';



interface Infos {
    [index:string]: unknown
}
// export interface UsersState {
//     token: string
//     infos: Infos
// }
// const state: UsersState = {
//     token: '',
//     infos: {}
// };
/*const mutations: MutationTree<UsersState> = {
    // 创建状态，更新状态
    updateToken(state, payload) {
        state.token = payload
    },
    updateInfos(state, payload) {
        state.infos = payload
    },
    clearToken(state) {
        state.token = ''
    }
};
const actions: ActionTree<UsersState, State> = {
    // 异步提交状态，动作
    login(context,playload){

        return http.post('/users/login',playload)
    },
    infos() {
      return http.get('/users/infos')
    },
};*/


export const useUsersStore =
    defineStore('users', () => {


        const token = ref('')
        const infos = reactive<Infos>({})


        function updateToken(payload: string) {
            token.value = payload;
        }
        function updateInfos(payload: Infos) {
            // infos = payload;
            Object.assign(infos, payload);
        }
        function clearToken() {
            token.value = ''
        }




        // 异步提交状态，动作
        async function  login(payload: Infos){
            const res = await http.post('/users/login',payload)
            return res.data
        }
        async function  getInfos() {
            const res = await http.get('/users/infos')
            return res.data
        }


        return {token, infos, getInfos,login,clearToken,updateToken,updateInfos}
    })
