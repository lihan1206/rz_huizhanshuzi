import { createRouter, createWebHistory } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = createRouter({
    history: createWebHistory(),
    routes: [
        {
            path: '/login',
            name: 'Login',
            component: () => import('@/views/Login.vue'),
            meta: { requiresAuth: false },
        },
        {
            path: '/',
            component: () => import('@/components/layout/MainLayout.vue'),
            meta: { requiresAuth: true },
            children: [
                { path: '', redirect: '/dashboard' },
                { path: 'dashboard', name: 'Dashboard', component: () => import('@/views/Dashboard.vue'), meta: { title: '数据看板' } },
                { path: 'expos', name: 'Expos', component: () => import('@/views/expos/ExpoList.vue'), meta: { title: '会展项目管理' } },
                { path: 'exhibitors', name: 'Exhibitors', component: () => import('@/views/exhibitors/ExhibitorList.vue'), meta: { title: '参展商管理' } },
                { path: 'visitors', name: 'Visitors', component: () => import('@/views/visitors/VisitorList.vue'), meta: { title: '观众管理' } },
                { path: 'booths', name: 'Booths', component: () => import('@/views/booths/BoothList.vue'), meta: { title: '展位管理' } },
                { path: 'checkin', name: 'Checkin', component: () => import('@/views/checkin/CheckinManage.vue'), meta: { title: '签到管理' } },
                { path: 'statistics', name: 'Statistics', component: () => import('@/views/statistics/Statistics.vue'), meta: { title: '数据统计' } },
                { path: 'payments', name: 'Payments', component: () => import('@/views/payments/PaymentList.vue'), meta: { title: '支付管理' } },
                { path: 'contracts', name: 'Contracts', component: () => import('@/views/payments/ContractList.vue'), meta: { title: '合同管理' } },
                { path: 'messages', name: 'Messages', component: () => import('@/views/messages/MessageList.vue'), meta: { title: '消息通知' } },
                { path: 'admin/users', name: 'AdminUsers', component: () => import('@/views/admin/UserManage.vue'), meta: { title: '用户管理' } },
                { path: 'admin/audit-logs', name: 'AuditLogs', component: () => import('@/views/admin/AuditLogs.vue'), meta: { title: '操作日志' } },
            ],
        },
        { path: '/:pathMatch(.*)*', redirect: '/dashboard' },
    ],
})

router.beforeEach((to, _from, next) => {
    const auth = useAuthStore()
    if (to.meta.requiresAuth !== false && !auth.isLoggedIn) {
        next('/login')
    } else if (to.path === '/login' && auth.isLoggedIn) {
        next('/dashboard')
    } else {
        next()
    }
})

export default router
