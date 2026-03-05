<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">🔔 消息通知</span>
      <a-space>
        <a-button @click="markAllRead">全部已读</a-button>
        <a-button type="primary" @click="openModal" v-if="authStore.isAdminOrOperator">
          <template #icon><SendOutlined /></template>发送通知
        </a-button>
      </a-space>
    </div>

    <div class="search-area">
      <a-select v-model:value="query.type" placeholder="消息类型" allow-clear style="width:150px" @change="search">
        <a-select-option v-for="t in msgTypes" :key="t" :value="t">{{ t }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.is_read" placeholder="阅读状态" allow-clear style="width:130px" @change="search">
        <a-select-option :value="0">未读</a-select-option>
        <a-select-option :value="1">已读</a-select-option>
      </a-select>
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>

    <a-card :bordered="false">
      <a-list :dataSource="list" :loading="loading" :pagination="{ ...pagination, onChange: (p:number) => { query.page = p; loadList() } }">
        <template #renderItem="{ item }">
          <a-list-item :style="{ background: item.is_read ? 'transparent' : '#e6f4ff', borderRadius: '8px', marginBottom: '6px', padding: '12px 16px' }">
            <a-list-item-meta>
              <template #avatar>
                <div style="font-size:28px">{{ typeIcon(item.type) }}</div>
              </template>
              <template #title>
                <div style="display:flex; align-items:center; gap:8px">
                  <span :style="{ fontWeight: item.is_read ? 400 : 700 }">{{ item.title }}</span>
                  <a-badge status="processing" v-if="!item.is_read" text="未读" />
                  <a-tag size="small">{{ item.type }}</a-tag>
                  <a-tag size="small" v-if="item.expo_name" color="blue">{{ item.expo_name }}</a-tag>
                </div>
              </template>
              <template #description>
                <div>{{ item.content }}</div>
                <div style="font-size:11px; color:#999; margin-top:4px">发送人：{{ item.sender_name || '系统' }} &nbsp; {{ item.created_at?.slice(0,16) }}</div>
              </template>
            </a-list-item-meta>
            <template #actions>
              <a-button size="small" @click="markRead(item)" v-if="!item.is_read">标为已读</a-button>
              <a-button size="small" danger @click="confirmDelete(item)"><DeleteOutlined /></a-button>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-card>

    <!-- 发送通知 Modal -->
    <a-modal v-model:open="modalOpen" title="发送系统通知" @ok="handleSubmit" ok-text="发送" cancel-text="取消" :confirm-loading="submitting" :mask-closable="false">
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="formRef">
        <a-form-item label="通知标题" name="title" :rules="[{required:true,message:'请输入标题'}]">
          <a-input v-model:value="form.title" />
        </a-form-item>
        <a-form-item label="消息类型" name="type">
          <a-select v-model:value="form.type">
            <a-select-option v-for="t in msgTypes" :key="t" :value="t">{{ t }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="目标角色" name="target_role">
          <a-select v-model:value="form.target_role" allow-clear placeholder="不选则发给全员">
            <a-select-option value="admin">管理员</a-select-option>
            <a-select-option value="operator">运营人员</a-select-option>
            <a-select-option value="exhibitor">参展商</a-select-option>
            <a-select-option value="visitor">观众</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="关联会展">
          <a-select v-model:value="form.expo_id" allow-clear placeholder="可选">
            <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="通知内容" name="content" :rules="[{required:true,message:'请输入内容'}]">
          <a-textarea v-model:value="form.content" :rows="4" placeholder="请输入通知内容..." />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'
import { message, Modal } from 'ant-design-vue'
import { DeleteOutlined, SendOutlined, SearchOutlined } from '@ant-design/icons-vue'
import type { Expo } from '@/types'

const authStore = useAuthStore()
const list = ref<any[]>([])
const expos = ref<Expo[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const submitting = ref(false)
const formRef = ref()
const msgTypes = ['系统通知', '参展提醒', '支付提醒', '展位调整', '其他']
const query = reactive({ type: undefined as string | undefined, is_read: undefined as number | undefined, page: 1, pageSize: 10 })
const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const form = reactive({ title: '', content: '', type: '系统通知', target_role: undefined as string | undefined, expo_id: undefined as number | undefined })

function typeIcon(t: string) { const m: Record<string, string> = { '系统通知': '📢', '参展提醒': '🏢', '支付提醒': '💳', '展位调整': '🗺️', '其他': '📩' }; return m[t] || '📩' }

async function loadList() {
  loading.value = true
  try { const res = await api.get('/messages', { params: query }); list.value = res.data.data.list; pagination.total = res.data.data.total }
  finally { loading.value = false }
}
async function loadExpos() { const res = await api.get('/expos', { params: { pageSize: 100 } }); expos.value = res.data.data.list }
function search() { query.page = 1; pagination.current = 1; loadList() }

async function markRead(item: any) {
  await api.patch(`/messages/${item.id}/read`)
  item.is_read = 1
}
async function markAllRead() {
  await api.patch('/messages/read-all')
  message.success('全部已标为已读')
  loadList()
}

function openModal() { Object.assign(form, { title: '', content: '', type: '系统通知', target_role: undefined, expo_id: undefined }); modalOpen.value = true }
async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try { await api.post('/messages', form); message.success('通知发送成功'); modalOpen.value = false; loadList() }
  finally { submitting.value = false }
}

function confirmDelete(item: any) {
  Modal.confirm({
    title: '确认删除',
    content: `确定删除消息「${item.title}」吗？`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() { await api.delete(`/messages/${item.id}`); message.success('删除成功'); loadList() },
  })
}

onMounted(() => { loadExpos(); loadList() })
</script>
