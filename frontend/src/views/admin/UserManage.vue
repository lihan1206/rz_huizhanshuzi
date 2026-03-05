<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">👤 用户管理</span>
      <a-button type="primary" @click="openModal()" v-if="authStore.isAdmin">
        <template #icon><PlusOutlined /></template>新增用户
      </a-button>
    </div>
    <div class="search-area">
      <a-input v-model:value="query.keyword" placeholder="用户名/姓名/邮箱" allow-clear style="width:220px" @change="search" />
      <a-select v-model:value="query.role_id" placeholder="角色筛选" allow-clear style="width:130px" @change="search">
        <a-select-option v-for="r in roles" :key="r.id" :value="r.id">{{ r.display_name }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width:100px" @change="search">
        <a-select-option :value="1">启用</a-select-option>
        <a-select-option :value="0">禁用</a-select-option>
      </a-select>
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>
    <a-card :bordered="false">
      <a-table :dataSource="list" :columns="columns" :pagination="pagination" :loading="loading" row-key="id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-badge :status="record.status ? 'success' : 'default'" :text="record.status ? '启用' : '禁用'" />
          </template>
          <template v-if="column.key === 'role'">
            <a-tag :color="roleColor(record.role_name)">{{ record.role_name }}</a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <div class="action-btns" v-if="authStore.isAdmin">
              <a-button size="small" @click="openModal(record)"><EditOutlined /></a-button>
              <a-button size="small" @click="confirmResetPwd(record)">重置密码</a-button>
              <a-button size="small" danger @click="confirmDelete(record)" :disabled="record.id === 1"><DeleteOutlined /></a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 用户 Modal -->
    <a-modal v-model:open="modalOpen" :title="editRecord ? '编辑用户' : '新增用户'" @ok="handleSubmit" ok-text="保存" cancel-text="取消" :confirm-loading="submitting" :mask-closable="false">
      <a-form :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }" ref="formRef">
        <a-form-item label="用户名" name="username" :rules="[{required:true,message:'请输入用户名'}]">
          <a-input v-model:value="form.username" :disabled="!!editRecord" />
        </a-form-item>
        <a-form-item label="密码" name="password" :rules="editRecord ? [] : [{required:true,message:'请输入密码'}]" v-if="!editRecord">
          <a-input-password v-model:value="form.password" placeholder="初始密码" />
        </a-form-item>
        <a-form-item label="真实姓名"><a-input v-model:value="form.real_name" /></a-form-item>
        <a-form-item label="邮箱"><a-input v-model:value="form.email" /></a-form-item>
        <a-form-item label="手机号"><a-input v-model:value="form.phone" /></a-form-item>
        <a-form-item label="角色" name="role_id" :rules="[{required:true,message:'请选择角色'}]">
          <a-select v-model:value="form.role_id">
            <a-select-option v-for="r in roles" :key="r.id" :value="r.id">{{ r.display_name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="状态">
          <a-switch v-model:checked="form.statusBool" checked-children="启用" un-checked-children="禁用" />
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
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue'
type Role = { id: number; name: string; display_name: string }
const authStore = useAuthStore()
const list = ref<any[]>([])
const roles = ref<Role[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const submitting = ref(false)
const editRecord = ref<any>(null)
const formRef = ref()
const query = reactive({ keyword: '', role_id: undefined as number | undefined, status: undefined as number | undefined, page: 1, pageSize: 10 })
const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const form = reactive({ username: '', password: '', real_name: '', email: '', phone: '', role_id: 4, statusBool: true })
const columns = [
  { title: '用户名', dataIndex: 'username', width: 100 },
  { title: '真实姓名', dataIndex: 'real_name', width: 90 },
  { title: '角色', key: 'role', width: 100 },
  { title: '邮箱', dataIndex: 'email', ellipsis: true },
  { title: '手机号', dataIndex: 'phone', width: 120 },
  { title: '状态', key: 'status', width: 80 },
  { title: '最后登录', dataIndex: 'last_login', width: 150, customRender: ({ text }: any) => text?.slice(0,16) || '-' },
  { title: '操作', key: 'action', width: 200, fixed: 'right' },
]
function roleColor(r: string) { const m: Record<string, string> = { '系统管理员': 'red', '运营人员': 'blue', '参展商': 'green', '观众': 'default' }; return m[r] || 'default' }
async function loadList() {
  loading.value = true
  try { const res = await api.get('/admin/users', { params: query }); list.value = res.data.data.list; pagination.total = res.data.data.total }
  finally { loading.value = false }
}
async function loadRoles() { const res = await api.get('/admin/roles'); roles.value = res.data.data }
function search() { query.page = 1; pagination.current = 1; loadList() }
function handleTableChange(p: any) { query.page = p.current; query.pageSize = p.pageSize; pagination.current = p.current; loadList() }
function openModal(record?: any) {
  editRecord.value = record || null
  if (record) { Object.assign(form, { username: record.username, password: '', real_name: record.real_name || '', email: record.email || '', phone: record.phone || '', role_id: record.role_id, statusBool: record.status === 1 }) }
  else { Object.assign(form, { username: '', password: '', real_name: '', email: '', phone: '', role_id: 4, statusBool: true }) }
  modalOpen.value = true
}
async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    const payload = { ...form, status: form.statusBool ? 1 : 0 }
    if (editRecord.value) { await api.put(`/admin/users/${editRecord.value.id}`, payload); message.success('更新成功') }
    else { await api.post('/admin/users', payload); message.success('创建成功') }
    modalOpen.value = false; loadList()
  } finally { submitting.value = false }
}
function confirmResetPwd(record: any) {
  Modal.confirm({ title: '重置密码', content: `确定将「${record.username}」的密码重置为 123456 吗？`, okText: '确认重置', cancelText: '取消',
    async onOk() { await api.patch(`/admin/users/${record.id}/reset-password`, { password: '123456' }); message.success('密码已重置为 123456') } })
}
function confirmDelete(record: any) {
  Modal.confirm({ title: '确认删除', content: `确定删除用户「${record.username}」吗？`, okText: '确认删除', okType: 'danger', cancelText: '取消',
    async onOk() { await api.delete(`/admin/users/${record.id}`); message.success('删除成功'); loadList() } })
}
onMounted(() => { loadRoles(); loadList() })
</script>
