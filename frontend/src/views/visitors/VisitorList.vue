<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">👥 观众管理</span>
      <a-button type="primary" @click="openModal()" v-if="authStore.isAdminOrOperator">
        <template #icon><PlusOutlined /></template>注册观众
      </a-button>
    </div>

    <div class="search-area">
      <a-select v-model:value="query.expo_id" placeholder="选择会展" allow-clear style="width:200px" @change="search">
        <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.type" placeholder="观众类型" allow-clear style="width:130px" @change="search">
        <a-select-option value="专业观众">专业观众</a-select-option>
        <a-select-option value="普通观众">普通观众</a-select-option>
      </a-select>
      <a-select v-model:value="query.status" placeholder="状态" allow-clear style="width:120px" @change="search">
        <a-select-option value="已注册">已注册</a-select-option>
        <a-select-option value="已入场">已入场</a-select-option>
        <a-select-option value="已离场">已离场</a-select-option>
      </a-select>
      <a-input v-model:value="query.keyword" placeholder="姓名/电话/公司" allow-clear style="width:200px" @change="search" />
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>

    <a-card :bordered="false">
      <a-table :dataSource="list" :columns="columns" :pagination="pagination" :loading="loading" row-key="id" @change="handleTableChange" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="record.type === '专业观众' ? 'blue' : 'default'">{{ record.type }}</a-tag>
          </template>
          <template v-if="column.key === 'status'">
            <a-tag :color="record.status === '已入场' ? 'green' : record.status === '已注册' ? 'blue' : 'default'">{{ record.status }}</a-tag>
          </template>
          <template v-if="column.key === 'ticket'">
            <a-button size="small" type="link" @click="showTicket(record)">查看票码</a-button>
          </template>
          <template v-if="column.key === 'action'">
            <div class="action-btns">
              <a-button size="small" @click="openModal(record)"><EditOutlined /></a-button>
              <a-button size="small" danger @click="confirmDelete(record)"><DeleteOutlined /></a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 Modal -->
    <a-modal v-model:open="modalOpen" :title="editRecord ? '编辑观众信息' : '注册观众'" width="600px" @ok="handleSubmit" ok-text="保存" cancel-text="取消" :confirm-loading="submitting" :mask-closable="false">
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="formRef">
        <a-form-item label="所属会展" name="expo_id" :rules="[{required:true,message:'请选择会展'}]">
          <a-select v-model:value="form.expo_id" placeholder="选择会展">
            <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="姓名" name="real_name" :rules="[{required:true,message:'请输入姓名'}]">
          <a-input v-model:value="form.real_name" />
        </a-form-item>
        <a-form-item label="联系电话" name="phone">
          <a-input v-model:value="form.phone" />
        </a-form-item>
        <a-form-item label="邮箱" name="email">
          <a-input v-model:value="form.email" />
        </a-form-item>
        <a-form-item label="所属单位" name="company">
          <a-input v-model:value="form.company" />
        </a-form-item>
        <a-form-item label="职位" name="position">
          <a-input v-model:value="form.position" />
        </a-form-item>
        <a-form-item label="观众类型" name="type">
          <a-radio-group v-model:value="form.type">
            <a-radio value="专业观众">专业观众</a-radio>
            <a-radio value="普通观众">普通观众</a-radio>
          </a-radio-group>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 票码详情 Modal -->
    <a-modal v-model:open="ticketOpen" title="电子票务" :footer="null" width="400px">
      <div v-if="ticketRecord" style="text-align: center; padding: 16px">
        <h3 style="font-size:18px; margin-bottom: 8px">{{ ticketRecord.expo_name }}</h3>
        <p style="color: #666; margin-bottom: 16px">{{ ticketRecord.real_name }} | {{ ticketRecord.type }}</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 12px; margin-bottom: 16px">
          <div style="font-size: 13px; margin-bottom: 8px; color: #999">票码</div>
          <div style="font-size: 18px; font-weight: 700; letter-spacing: 2px; color: #1677ff">{{ ticketRecord.ticket_code }}</div>
          <div style="margin-top: 16px; font-size: 80px;">🎫</div>
        </div>
        <a-tag :color="ticketRecord.status === '已入场' ? 'green' : 'blue'" style="font-size: 14px; padding: 4px 16px">{{ ticketRecord.status }}</a-tag>
        <div style="margin-top: 16px; font-size: 12px; color: #999">
          注册时间：{{ ticketRecord.created_at?.slice(0,10) }}
        </div>
      </div>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue'
import type { Visitor, Expo } from '@/types'

const authStore = useAuthStore()
const list = ref<Visitor[]>([])
const expos = ref<Expo[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const ticketOpen = ref(false)
const submitting = ref(false)
const editRecord = ref<Visitor | null>(null)
const ticketRecord = ref<Visitor | null>(null)
const formRef = ref()

const query = reactive({ expo_id: undefined as number | undefined, type: undefined as string | undefined, status: undefined as string | undefined, keyword: '', page: 1, pageSize: 10 })
const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const form = reactive({ expo_id: undefined as number | undefined, real_name: '', phone: '', email: '', company: '', position: '', type: '普通观众', status: '已注册' })

const columns = [
  { title: '姓名', dataIndex: 'real_name', width: 90 },
  { title: '所属会展', dataIndex: 'expo_name', ellipsis: true },
  { title: '类型', key: 'type', width: 90 },
  { title: '单位', dataIndex: 'company', ellipsis: true },
  { title: '职位', dataIndex: 'position', width: 90 },
  { title: '联系电话', dataIndex: 'phone', width: 120 },
  { title: '状态', key: 'status', width: 80 },
  { title: '票务', key: 'ticket', width: 80 },
  { title: '操作', key: 'action', width: 120, fixed: 'right' },
]

async function loadList() {
  loading.value = true
  try {
    const res = await api.get('/visitors', { params: query })
    list.value = res.data.data.list
    pagination.total = res.data.data.total
  } finally { loading.value = false }
}
async function loadExpos() {
  const res = await api.get('/expos', { params: { pageSize: 100 } })
  expos.value = res.data.data.list
}
function search() { query.page = 1; pagination.current = 1; loadList() }
function handleTableChange(p: any) { query.page = p.current; query.pageSize = p.pageSize; pagination.current = p.current; loadList() }

function openModal(record?: Visitor) {
  editRecord.value = record || null
  if (record) {
    Object.assign(form, { expo_id: record.expo_id, real_name: record.real_name, phone: record.phone || '', email: record.email || '', company: record.company || '', position: record.position || '', type: record.type, status: record.status })
  } else {
    Object.assign(form, { expo_id: undefined, real_name: '', phone: '', email: '', company: '', position: '', type: '普通观众', status: '已注册' })
  }
  modalOpen.value = true
}

function showTicket(record: Visitor) {
  ticketRecord.value = record
  ticketOpen.value = true
}

async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    if (editRecord.value) {
      await api.put(`/visitors/${editRecord.value.id}`, form)
      message.success('更新成功')
    } else {
      const res = await api.post('/visitors', form)
      message.success(`注册成功！票码: ${res.data.data.ticketCode}`)
    }
    modalOpen.value = false
    loadList()
  } finally { submitting.value = false }
}

function confirmDelete(record: Visitor) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除观众「${record.real_name}」吗？`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await api.delete(`/visitors/${record.id}`)
      message.success('删除成功')
      loadList()
    },
  })
}

onMounted(() => { loadExpos(); loadList() })
</script>
