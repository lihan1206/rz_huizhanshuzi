import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
    const token = ref<string | null>(localStorage.getItem('expo_token'))
    const user = ref<User | null>(JSON.parse(localStorage.getItem('expo_user') || 'null'))

    const isLoggedIn = computed(() => !!token.value)
    const isAdmin = computed(() => user.value?.role === 'admin')
    const isAdminOrOperator = computed(() => ['admin', 'operator'].includes(user.value?.role || ''))

    async function login(username: string, password: string) {
        const res = await api.post('/auth/login', { username, password })
        const data = res.data.data
        token.value = data.token
        user.value = data.user
        localStorage.setItem('expo_token', data.token)
        localStorage.setItem('expo_user', JSON.stringify(data.user))
        api.defaults.headers.common['Authorization'] = `Bearer ${data.token}`
        return data
    }

    function logout() {
        token.value = null
        user.value = null
        localStorage.removeItem('expo_token')
        localStorage.removeItem('expo_user')
        delete api.defaults.headers.common['Authorization']
    }

    // 初始化时恢复 token
    if (token.value) {
        api.defaults.headers.common['Authorization'] = `Bearer ${token.value}`
    }

    return { token, user, isLoggedIn, isAdmin, isAdminOrOperator, login, logout }
})
