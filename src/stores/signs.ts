import http from '@/utils/http';
import { reactive } from 'vue';
import {defineStore} from "pinia";


interface Infos {
    [index:string]: unknown
}
/*export interface SignsState {
    infos: Infos
}
const mutations: MutationTree<SignsState> = {
    updateInfos(state, payload) {
        state.infos = payload
    },
};
const actions: ActionTree<SignsState, State> = {
    getTime(context,payload) {
        return http.get('/signs/time', payload);
    }
};*/


export const useSignsStore =
    defineStore('signs', () => {

        const infos  =reactive<Infos>({})

        function updateInfos(payload:Infos) {
            // infos = payload
            Object.assign(infos, payload)
        }



        async function getTime(payload:Infos) {
            const res = await http.get('/signs/time', payload);
            return res.data
        }

        return {infos,updateInfos,getTime}
    })
