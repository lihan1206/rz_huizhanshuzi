<template>
  <div class="login-page">
    <!-- 背景装饰 -->
    <div class="bg-decoration">
      <div class="bg-circle circle-1"></div>
      <div class="bg-circle circle-2"></div>
      <div class="bg-circle circle-3"></div>
    </div>

    <div class="login-container">
      <!-- 左侧介绍 -->
      <div class="login-left">
        <div class="left-content">
          <div class="product-logo">🏛️</div>
          <h1 class="product-name">会展数字化综合运营管理系统</h1>
           <div class="feature-list">
            <div v-for="f in features" :key="f.title" class="feature-item">
              <span class="feature-icon">{{ f.icon }}</span>
              <div>
                <div class="feature-title">{{ f.title }}</div>
                <div class="feature-text">{{ f.desc }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右侧登录表单 -->
      <div class="login-right">
        <div class="login-form-box">
          <div class="form-header">
            <h2>欢迎登录</h2>
            <p>请使用管理员账号登录系统</p>
          </div>

          <a-form
            :model="formState"
            :rules="rules"
            ref="formRef"
            layout="vertical"
            @finish="handleLogin"
          >
            <a-form-item name="username" label="用户名">
              <a-input
                v-model:value="formState.username"
                size="large"
                placeholder="请输入用户名"
                prefix-icon="UserOutlined"
              >
                <template #prefix><UserOutlined style="color: #999" /></template>
              </a-input>
            </a-form-item>

            <a-form-item name="password" label="密码">
              <a-input-password
                v-model:value="formState.password"
                size="large"
                placeholder="请输入密码"
              >
                <template #prefix><LockOutlined style="color: #999" /></template>
              </a-input-password>
            </a-form-item>

            <a-form-item>
              <a-button
                type="primary"
                html-type="submit"
                size="large"
                block
                :loading="loading"
                style="height: 48px; font-size: 16px; font-weight: 600; border-radius: 10px;"
              >
                {{ loading ? '登录中...' : '立即登录' }}
              </a-button>
            </a-form-item>
          </a-form>

          <a-divider>测试账号</a-divider>
          <div class="test-accounts">
            <a-tag
              v-for="acc in testAccounts"
              :key="acc.user"
              class="test-account-tag"
              @click="fillAccount(acc)"
              style="cursor: pointer"
              :color="acc.color"
            >
              {{ acc.label }}: {{ acc.user }}/123456
            </a-tag>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { message } from 'ant-design-vue'
import { UserOutlined, LockOutlined } from '@ant-design/icons-vue'

const router = useRouter()
const authStore = useAuthStore()
const formRef = ref()
const loading = ref(false)

const formState = reactive({ username: 'admin', password: '123456' })

const rules = {
  username: [{ required: true, message: '请输入用户名' }],
  password: [{ required: true, message: '请输入密码' }],
}

const features = [
  { icon: '📋', title: '会展全生命周期管理', desc: '从筹备到结束的全流程数字化' },
  { icon: '👥', title: '参展商与观众管理', desc: '审核、票务、二维码一体化' },
  { icon: '🗺️', title: '展位可视化管理', desc: '展位状态、分配、占用实时查看' },
  { icon: '📊', title: '数据驱动决策', desc: '多维度统计分析与可视化看板' },
]

const testAccounts = [
  { label: '管理员', user: 'admin', color: 'red' },
  { label: '运营', user: 'operator1', color: 'blue' },
  { label: '参展商', user: 'exhibitor1', color: 'green' },
]

function fillAccount(acc: { user: string }) {
  formState.username = acc.user
  formState.password = '123456'
}

async function handleLogin() {
  loading.value = true
  try {
    await authStore.login(formState.username, formState.password)
    message.success('登录成功，欢迎回来！')
    router.push('/dashboard')
  } catch (err: any) {
    // 错误已由 axios 拦截器处理
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  background: linear-gradient(135deg, #0a1628 0%, #1a2744 50%, #0d2137 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
}

.bg-decoration { position: absolute; inset: 0; pointer-events: none; }

.bg-circle {
  position: absolute;
  border-radius: 50%;
  opacity: 0.08;
}

.circle-1 {
  width: 600px; height: 600px;
  background: radial-gradient(circle, #1677ff, transparent);
  top: -200px; left: -200px;
}

.circle-2 {
  width: 400px; height: 400px;
  background: radial-gradient(circle, #722ed1, transparent);
  bottom: -100px; right: -100px;
}

.circle-3 {
  width: 300px; height: 300px;
  background: radial-gradient(circle, #13c2c2, transparent);
  top: 50%; right: 30%;
}

.login-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  max-width: 1000px;
  width: 90%;
  background: rgba(255,255,255,0.03);
  backdrop-filter: blur(20px);
  border-radius: 24px;
  border: 1px solid rgba(255,255,255,0.1);
  overflow: hidden;
  box-shadow: 0 40px 80px rgba(0,0,0,0.4);
}

/* 左侧 */
.login-left {
  padding: 48px 40px;
  background: linear-gradient(135deg, rgba(22,119,255,0.15), rgba(114,46,209,0.1));
  display: flex;
  align-items: center;
}

.left-content { width: 100%; }

.product-logo {
  font-size: 56px;
  margin-bottom: 16px;
}

.product-name {
  font-size: 28px;
  font-weight: 800;
  color: #fff;
  margin: 0 0 8px;
}

.product-desc {
  font-size: 14px;
  color: rgba(255,255,255,0.6);
  margin: 0 0 32px;
}

.feature-list { display: flex; flex-direction: column; gap: 20px; }

.feature-item {
  display: flex;
  gap: 14px;
  align-items: flex-start;
}

.feature-icon {
  font-size: 24px;
  flex-shrink: 0;
  line-height: 1;
}

.feature-title {
  font-size: 14px;
  font-weight: 600;
  color: rgba(255,255,255,0.9);
  margin-bottom: 4px;
}

.feature-text {
  font-size: 12px;
  color: rgba(255,255,255,0.5);
}

/* 右侧 */
.login-right {
  padding: 48px 40px;
  background: #fff;
  display: flex;
  align-items: center;
}

.login-form-box { width: 100%; }

.form-header {
  margin-bottom: 32px;
}

.form-header h2 {
  font-size: 24px;
  font-weight: 700;
  color: #1a1a2e;
  margin: 0 0 8px;
}

.form-header p {
  font-size: 14px;
  color: #999;
  margin: 0;
}

.test-accounts {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.test-account-tag {
  transition: transform 0.15s;
}

.test-account-tag:hover {
  transform: scale(1.04);
}

@media (max-width: 700px) {
  .login-container { grid-template-columns: 1fr; }
  .login-left { display: none; }
}
</style>
