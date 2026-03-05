<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">🏢 参展商管理</span>
      <a-button type="primary" @click="openModal()" v-if="authStore.isAdminOrOperator">
        <template #icon><PlusOutlined /></template>新增参展商
      </a-button>
    </div>

    <div class="search-area">
      <a-select v-model:value="query.expo_id" placeholder="选择会展" allow-clear style="width:200px" @change="search">
        <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.status" placeholder="审核状态" allow-clear style="width:130px" @change="search">
        <a-select-option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
      <a-input v-model:value="query.keyword" placeholder="公司名/联系人" allow-clear style="width:200px" @change="search" />
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>

    <a-card :bordered="false">
      <a-table :dataSource="list" :columns="columns" :pagination="pagination" :loading="loading" row-key="id" @change="handleTableChange" :scroll="{ x: 900 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
          </template>
          <template v-if="column.key === 'action'">
            <div class="action-btns">
              <a-button size="small" @click="openModal(record)"><EditOutlined /></a-button>
              <a-button size="small" type="primary" ghost @click="openReview(record)" v-if="record.status === '待审核'">审核</a-button>
              <a-button size="small" danger @click="confirmDelete(record)"><DeleteOutlined /></a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 编辑 Modal -->
    <a-modal v-model:open="modalOpen" :title="editRecord ? '编辑参展商' : '新增参展商'" width="680px" @ok="handleSubmit" ok-text="保存" cancel-text="取消" :confirm-loading="submitting" :mask-closable="false">
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="formRef">
        <a-form-item label="所属会展" name="expo_id" :rules="[{required:true,message:'请选择会展'}]">
          <a-select v-model:value="form.expo_id" placeholder="选择会展">
            <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="公司名称" name="company_name" :rules="[{required:true,message:'请输入公司名称'}]">
          <a-input v-model:value="form.company_name" />
        </a-form-item>
        <a-form-item label="联系人" name="contact_name" :rules="[{required:true,message:'请输入联系人'}]">
          <a-input v-model:value="form.contact_name" />
        </a-form-item>
        <a-form-item label="联系电话" name="contact_phone">
          <a-input v-model:value="form.contact_phone" />
        </a-form-item>
        <a-form-item label="邮箱" name="contact_email">
          <a-input v-model:value="form.contact_email" />
        </a-form-item>
        <a-form-item label="参展类别" name="category">
          <a-input v-model:value="form.category" placeholder="如：智能制造/消费电子" />
        </a-form-item>
        <a-form-item label="展品说明" name="products">
          <a-textarea v-model:value="form.products" :rows="3" />
        </a-form-item>
        <a-form-item label="展位号" name="booth_number" v-if="editRecord">
          <a-input v-model:value="form.booth_number" />
        </a-form-item>
        <a-form-item label="状态" name="status" v-if="editRecord">
          <a-select v-model:value="form.status">
            <a-select-option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 审核 Modal -->
    <a-modal v-model:open="reviewOpen" title="审核参展商" @ok="handleReview" ok-text="提交审核" cancel-text="取消" :confirm-loading="submitting">
      <a-form :model="reviewForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="公司">{{ reviewRecord?.company_name }}</a-form-item>
        <a-form-item label="审核结果" name="status">
          <a-radio-group v-model:value="reviewForm.status">
            <a-radio value="已确认"><a-tag color="green">审核通过</a-tag></a-radio>
            <a-radio value="已拒绝"><a-tag color="red">审核拒绝</a-tag></a-radio>
          </a-radio-group>
        </a-form-item>
        <a-form-item label="备注原因" v-if="reviewForm.status === '已拒绝'">
          <a-textarea v-model:value="reviewForm.reason" :rows="2" placeholder="请输入拒绝原因" />
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
import type { Exhibitor, Expo } from '@/types'

const authStore = useAuthStore()
const list = ref<Exhibitor[]>([])
const expos = ref<Expo[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const reviewOpen = ref(false)
const submitting = ref(false)
const editRecord = ref<Exhibitor | null>(null)
const reviewRecord = ref<Exhibitor | null>(null)
const formRef = ref()

const statusOptions = ['待审核', '已确认', '已拒绝', '已缴费', '已取消']
const query = reactive({ expo_id: undefined as number | undefined, status: undefined as string | undefined, keyword: '', page: 1, pageSize: 10 })
const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const form = reactive({ expo_id: undefined as number | undefined, company_name: '', contact_name: '', contact_phone: '', contact_email: '', category: '', products: '', booth_number: '', status: '待审核' })
const reviewForm = reactive({ status: '已确认', reason: '' })

function statusColor(s: string) {
  const map: Record<string, string> = { '待审核': 'orange', '已确认': 'blue', '已拒绝': 'red', '已缴费': 'green', '已取消': 'default' }
  return map[s] || 'default'
}

const columns = [
  { title: '公司名称', dataIndex: 'company_name', width: 180, ellipsis: true },
  { title: '所属会展', dataIndex: 'expo_name', width: 150, ellipsis: true },
  { title: '联系人', dataIndex: 'contact_name', width: 80 },
  { title: '联系电话', dataIndex: 'contact_phone', width: 120 },
  { title: '类别', dataIndex: 'category', width: 100 },
  { title: '展位号', dataIndex: 'booth_number', width: 80 },
  { title: '状态', key: 'status', width: 90 },
  { title: '操作', key: 'action', width: 180, fixed: 'right' },
]

async function loadList() {
  loading.value = true
  try {
    const res = await api.get('/exhibitors', { params: query })
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

function openModal(record?: Exhibitor) {
  editRecord.value = record || null
  if (record) {
    Object.assign(form, { expo_id: record.expo_id, company_name: record.company_name, contact_name: record.contact_name, contact_phone: record.contact_phone || '', contact_email: record.contact_email || '', category: record.category || '', products: record.products || '', booth_number: record.booth_number || '', status: record.status })
  } else {
    Object.assign(form, { expo_id: undefined, company_name: '', contact_name: '', contact_phone: '', contact_email: '', category: '', products: '', booth_number: '', status: '待审核' })
  }
  modalOpen.value = true
}

async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    if (editRecord.value) {
      await api.put(`/exhibitors/${editRecord.value.id}`, form)
      message.success('更新成功')
    } else {
      await api.post('/exhibitors', form)
      message.success('创建成功')
    }
    modalOpen.value = false
    loadList()
  } finally { submitting.value = false }
}

function openReview(record: Exhibitor) {
  reviewRecord.value = record
  reviewForm.status = '已确认'
  reviewForm.reason = ''
  reviewOpen.value = true
}

async function handleReview() {
  submitting.value = true
  try {
    await api.patch(`/exhibitors/${reviewRecord.value!.id}/review`, reviewForm)
    message.success(`审核${reviewForm.status}`)
    reviewOpen.value = false
    loadList()
  } finally { submitting.value = false }
}

function confirmDelete(record: Exhibitor) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除参展商「${record.company_name}」吗？`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await api.delete(`/exhibitors/${record.id}`)
      message.success('删除成功')
      loadList()
    },
  })
}

onMounted(() => { loadExpos(); loadList() })
</script>
