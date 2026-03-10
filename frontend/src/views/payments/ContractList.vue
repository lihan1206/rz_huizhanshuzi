<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">📄 合同管理</span>
      <a-button type="primary" @click="openModal" v-if="authStore.isAdminOrOperator">
        <template #icon><PlusOutlined /></template>新建合同
      </a-button>
    </div>
    <div class="search-area">
      <a-select v-model:value="query.status" placeholder="合同状态" allow-clear style="width:130px" @change="search">
        <a-select-option v-for="s in ['待签署','已签署','已废止']" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>
    <a-card :bordered="false">
      <a-table :dataSource="list" :columns="columns" :pagination="pagination" :loading="loading" row-key="id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === '已签署' ? 'green' : record.status === '待签署' ? 'orange' : 'default'">{{ record.status }}</a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <div class="action-btns">
              <a-button size="small" type="primary" ghost @click="signContract(record)" v-if="authStore.isAdminOrOperator && record.status === '待签署'">签署</a-button>
              <a-button size="small" @click="remindContract(record)" v-if="authStore.isAdminOrOperator && record.status === '待签署'">催签</a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>
    <a-modal v-model:open="modalOpen" title="新建合同" @ok="handleSubmit" ok-text="创建" cancel-text="取消" :confirm-loading="submitting">
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="formRef">
        <a-form-item label="所属会展">
          <a-select v-model:value="form.expo_id" allow-clear placeholder="选择会展">
            <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="参展商">
          <a-select v-model:value="form.exhibitor_id" allow-clear placeholder="选择参展商">
            <a-select-option v-for="ex in exhibitors" :key="ex.id" :value="ex.id">{{ ex.company_name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="合同名称" name="title" :rules="[{required:true,message:'请输入合同名称'}]">
          <a-input v-model:value="form.title" placeholder="如：参展合同" />
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
import { PlusOutlined, SearchOutlined } from '@ant-design/icons-vue'
import type { Expo, Exhibitor } from '@/types'
const authStore = useAuthStore()
const list = ref<any[]>([])
const expos = ref<Expo[]>([])
const exhibitors = ref<Exhibitor[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const submitting = ref(false)
const formRef = ref()
const query = reactive({ status: undefined as string | undefined, page: 1, pageSize: 10 })
const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const form = reactive({ expo_id: undefined as number | undefined, exhibitor_id: undefined as number | undefined, title: '' })
const columns = [
  { title: '合同编号', dataIndex: 'contract_no', width: 160 },
  { title: '合同名称', dataIndex: 'title', ellipsis: true },
  { title: '参展商', dataIndex: 'exhibitor_name' },
  { title: '所属会展', dataIndex: 'expo_name', ellipsis: true },
  { title: '状态', key: 'status', width: 90 },
  { title: '签署时间', dataIndex: 'signed_at', width: 130, customRender: ({ text }: any) => text?.slice(0,10) || '-' },
  { title: '操作', key: 'action', width: 160 },
]
async function loadList() {
  loading.value = true
  try { const res = await api.get('/payments/contracts', { params: query }); list.value = res.data.data.list; pagination.total = res.data.data.total }
  finally { loading.value = false }
}
function search() { query.page = 1; pagination.current = 1; loadList() }
function handleTableChange(p: any) { query.page = p.current; query.pageSize = p.pageSize; pagination.current = p.current; loadList() }
function openModal() { Object.assign(form, { expo_id: undefined, exhibitor_id: undefined, title: '' }); modalOpen.value = true }
async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try { await api.post('/payments/contracts', form); message.success('合同创建成功'); modalOpen.value = false; loadList() }
  finally { submitting.value = false }
}
function signContract(record: any) {
  Modal.confirm({ title: '确认签署合同', content: `确认签署合同「${record.title}」吗？签署后不可撤销。`, okText: '确认签署', cancelText: '取消',
    async onOk() { await api.patch(`/payments/contracts/${record.id}/sign`, {}); message.success('合同已签署'); loadList() } })
}
async function remindContract(record: any) {
  await api.post(`/payments/contracts/${record.id}/remind`, {})
  message.success('催签提醒已发送')
}
async function loadExpos() { const res = await api.get('/expos', { params: { pageSize: 100 } }); expos.value = res.data.data.list }
async function loadExhibitors() { const res = await api.get('/exhibitors', { params: { pageSize: 100 } }); exhibitors.value = res.data.data.list }
onMounted(() => { loadExpos(); loadExhibitors(); loadList() })
</script>
