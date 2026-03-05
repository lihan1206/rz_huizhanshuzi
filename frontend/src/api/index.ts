import axios from 'axios'
import { message } from 'ant-design-vue'

const api = axios.create({
    baseURL: '/api',
    timeout: 15000,
    headers: { 'Content-Type': 'application/json' },
})

// 请求拦截器
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('expo_token')
        if (token) config.headers.Authorization = `Bearer ${token}`
        return config
    },
    (error) => Promise.reject(error)
)

// 响应拦截器
api.interceptors.response.use(
    (response) => response,
    (error) => {
        const msg = error.response?.data?.message || '网络错误，请检查服务连接'
        if (error.response?.status === 401) {
            localStorage.removeItem('expo_token')
            localStorage.removeItem('expo_user')
            if (window.location.pathname !== '/login') {
                window.location.href = '/login'
            }
            message.error('登录已过期，请重新登录')
        } else if (error.response?.status === 403) {
            message.error('权限不足，无法执行此操作')
        } else {
            message.error(msg)
        }
        return Promise.reject(error)
    }
)

export default api
