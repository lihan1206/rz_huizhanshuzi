<template>
  <a-layout style="min-height: 100vh">
    <!-- 侧边栏 -->
    <a-layout-sider
      v-model:collapsed="collapsed"
      :trigger="null"
      collapsible
      width="240"
      style="background: #0a1628"
    >
      <!-- Logo -->
      <div class="sider-logo">
        <div class="logo-icon">🏛️</div>
        <transition name="fade">
          <div v-if="!collapsed" class="logo-text">
               <div class="logo-sub">会展数字化综合运营管理系统</div>
          </div>
        </transition>
      </div>

      <!-- 导航菜单 -->
      <a-menu
        v-model:selectedKeys="selectedKeys"
        v-model:openKeys="openKeys"
        mode="inline"
        theme="dark"
        :style="{ background: 'transparent', borderRight: 'none' }"
        @click="handleMenuClick"
      >
        <a-menu-item key="/dashboard">
          <template #icon><BarChartOutlined /></template>
          数据看板
        </a-menu-item>

        <a-menu-sub-menu key="expo-group" title="会展管理">
          <template #icon><CalendarOutlined /></template>
          <a-menu-item key="/expos">
            <template #icon><FundProjectionScreenOutlined /></template>
            会展项目管理
          </a-menu-item>
          <a-menu-item key="/exhibitors">
            <template #icon><ShopOutlined /></template>
            参展商管理
          </a-menu-item>
          <a-menu-item key="/visitors">
            <template #icon><TeamOutlined /></template>
            观众管理
          </a-menu-item>
        </a-menu-sub-menu>

        <a-menu-item key="/booths">
          <template #icon><AppstoreOutlined /></template>
          展位管理
        </a-menu-item>

        <a-menu-item key="/checkin">
          <template #icon><QrcodeOutlined /></template>
          签到管理
        </a-menu-item>

        <a-menu-item key="/statistics">
          <template #icon><LineChartOutlined /></template>
          数据统计
        </a-menu-item>

        <a-menu-sub-menu key="payment-group" title="财务管理">
          <template #icon><CreditCardOutlined /></template>
          <a-menu-item key="/payments">
            <template #icon><PayCircleOutlined /></template>
            支付管理
          </a-menu-item>
          <a-menu-item key="/contracts">
            <template #icon><FileDoneOutlined /></template>
            合同管理
          </a-menu-item>
        </a-menu-sub-menu>

        <a-menu-item key="/messages">
          <template #icon>
            <a-badge :count="unreadCount" size="small" :offset="[2, 2]">
              <BellOutlined />
            </a-badge>
          </template>
          消息通知
        </a-menu-item>

        <a-menu-sub-menu key="admin-group" title="系统管理">
          <template #icon><SettingOutlined /></template>
          <a-menu-item key="/admin/users">
            <template #icon><UserOutlined /></template>
            用户管理
          </a-menu-item>
          <a-menu-item key="/admin/audit-logs">
            <template #icon><AuditOutlined /></template>
            操作日志
          </a-menu-item>
        </a-menu-sub-menu>
      </a-menu>
    </a-layout-sider>

    <a-layout>
      <!-- 顶部栏 -->
      <a-layout-header class="main-header">
        <div class="header-left">
          <a-button
            type="text"
            :icon="collapsed ? h(MenuUnfoldOutlined) : h(MenuFoldOutlined)"
            @click="collapsed = !collapsed"
            style="color: #333; font-size: 18px"
          />
          <a-breadcrumb style="margin-left: 16px">
            <a-breadcrumb-item>首页</a-breadcrumb-item>
            <a-breadcrumb-item>{{ currentPageTitle }}</a-breadcrumb-item>
          </a-breadcrumb>
        </div>
        <div class="header-right">
          <a-badge :count="unreadCount">
            <a-button type="text" @click="$router.push('/messages')" :icon="h(BellOutlined)" />
          </a-badge>
          <a-divider type="vertical" />
          <a-dropdown>
            <div class="user-info">
              <a-avatar style="background: #1677ff; cursor: pointer">
                {{ authStore.user?.realName?.charAt(0) || authStore.user?.username?.charAt(0) || 'U' }}
              </a-avatar>
              <span style="margin-left: 8px; color: #333; font-weight: 500">
                {{ authStore.user?.realName || authStore.user?.username }}
              </span>
            </div>
            <template #overlay>
              <a-menu @click="handleUserMenu">
                <a-menu-item key="profile" disabled>
                  <UserOutlined /> 角色：{{ roleDisplayMap[authStore.user?.role || ''] || authStore.user?.role }}
                </a-menu-item>
                <a-menu-divider />
                <a-menu-item key="logout" style="color: #ff4d4f">
                  <LogoutOutlined /> 退出登录
                </a-menu-item>
              </a-menu>
            </template>
          </a-dropdown>
        </div>
      </a-layout-header>

      <!-- 内容区 -->
      <a-layout-content style="margin: 0; overflow: auto">
        <transition name="fade" mode="out-in">
          <router-view :key="$route.path" />
        </transition>
      </a-layout-content>
    </a-layout>
  </a-layout>
</template>

<script setup lang="ts">
import { ref, computed, watch, h, onMounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { message, Modal } from 'ant-design-vue'
import api from '@/api'
import {
  BarChartOutlined, CalendarOutlined, ShopOutlined, TeamOutlined,
  AppstoreOutlined, QrcodeOutlined, LineChartOutlined, CreditCardOutlined,
  BellOutlined, SettingOutlined, UserOutlined, AuditOutlined,
  MenuFoldOutlined, MenuUnfoldOutlined, LogoutOutlined,
  FundProjectionScreenOutlined, PayCircleOutlined, FileDoneOutlined
} from '@ant-design/icons-vue'

const router = useRouter()
const route = useRoute()
const authStore = useAuthStore()
const collapsed = ref(false)
const unreadCount = ref(0)

const selectedKeys = ref([route.path])
const openKeys = ref(['expo-group'])

const roleDisplayMap: Record<string, string> = {
  admin: '系统管理员',
  operator: '运营人员',
  exhibitor: '参展商',
  visitor: '观众',
}

const currentPageTitle = computed(() => (route.meta.title as string) || '首页')

watch(
  () => route.path,
  (path) => {
    selectedKeys.value = [path]
  }
)

function handleMenuClick({ key }: { key: string }) {
  router.push(key)
}

function handleUserMenu({ key }: { key: string }) {
  if (key === 'logout') {
    Modal.confirm({
      title: '确认退出',
      content: '确定要退出登录吗？',
      okText: '退出',
      okType: 'danger',
      cancelText: '取消',
      onOk() {
        authStore.logout()
        message.success('已退出登录')
        router.push('/login')
      },
    })
  }
}

async function loadUnreadCount() {
  try {
    const res = await api.get('/messages', { params: { page: 1, pageSize: 1 } })
    unreadCount.value = res.data.data?.unread || 0
  } catch { /* 静默处理 */ }
}

onMounted(() => {
  loadUnreadCount()
  // 每60秒更新未读数
  setInterval(loadUnreadCount, 60000)
})
</script>

<style scoped>
.sider-logo {
  height: 64px;
  display: flex;
  align-items: center;
  padding: 0 20px;
  border-bottom: 1px solid rgba(255,255,255,0.08);
  gap: 10px;
  overflow: hidden;
}

.logo-icon {
  font-size: 28px;
  flex-shrink: 0;
}

.logo-title {
  font-size: 16px;
  font-weight: 700;
  color: #fff;
  line-height: 1.2;
  white-space: nowrap;
}

.logo-sub {
  font-size: 11px;
  color: rgba(255,255,255,0.5);
  white-space: nowrap;
}

.main-header {
  background: #fff;
  padding: 0 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  height: 64px;
  position: sticky;
  top: 0;
  z-index: 100;
}

.header-left {
  display: flex;
  align-items: center;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-info {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 8px;
  transition: background 0.2s;
}

.user-info:hover {
  background: #f5f5f5;
}

:deep(.ant-menu-dark .ant-menu-item) {
  color: rgba(255,255,255,0.65);
  margin: 4px 8px;
  border-radius: 8px;
  width: calc(100% - 16px);
}

:deep(.ant-menu-dark .ant-menu-item:hover) {
  background: rgba(22,119,255,0.15) !important;
  color: #fff;
}

:deep(.ant-menu-dark .ant-menu-item-selected) {
  background: rgba(22,119,255,0.25) !important;
  color: #1677ff !important;
}

:deep(.ant-menu-dark .ant-menu-submenu-title) {
  color: rgba(255,255,255,0.65);
  margin: 4px 8px;
  border-radius: 8px;
  width: calc(100% - 16px);
}

:deep(.ant-menu-dark .ant-menu-submenu-title:hover) {
  background: rgba(22,119,255,0.15) !important;
  color: #fff;
}

:deep(.ant-menu-dark.ant-menu-inline .ant-menu-sub) {
  background: rgba(0,0,0,0.15) !important;
}
</style>
