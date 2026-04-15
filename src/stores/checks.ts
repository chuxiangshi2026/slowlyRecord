import {defineStore} from 'pinia'

import http from '@/utils/http';


export const useChecksStore =
    defineStore('checks', () => {

        async function login() {
            const res = await http.post('/users/login')
            return res.data
        }

        return {login}
    })

