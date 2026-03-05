<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">🗺️ 展位管理</span>
      <a-button type="primary" @click="openModal()" v-if="authStore.isAdminOrOperator">
        <template #icon><PlusOutlined /></template>新增展位
      </a-button>
    </div>

    <!-- 统计概览 -->
    <a-row :gutter="12" style="margin-bottom:16px">
      <a-col :span="6" v-for="item in boothStats" :key="item.label">
        <div class="stat-card" style="padding:16px; text-align:center">
          <div style="font-size:24px; font-weight:700" :style="{color:item.color}">{{ item.value }}</div>
          <div style="font-size:12px; color:#999; margin-top:4px">{{ item.label }}</div>
        </div>
      </a-col>
    </a-row>

    <div class="search-area">
      <a-select v-model:value="query.expo_id" placeholder="选择会展" allow-clear style="width:200px" @change="search">
        <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.status" placeholder="展位状态" allow-clear style="width:130px" @change="search">
        <a-select-option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.type" placeholder="展位类型" allow-clear style="width:130px" @change="search">
        <a-select-option value="标准展位">标准展位</a-select-option>
        <a-select-option value="特装展位">特装展位</a-select-option>
        <a-select-option value="室外展位">室外展位</a-select-option>
      </a-select>
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>

    <a-card :bordered="false">
      <a-table :dataSource="list" :columns="columns" :pagination="pagination" :loading="loading" row-key="id" @change="handleTableChange" :scroll="{ x: 1000 }">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
          </template>
          <template v-if="column.key === 'price'">
            ¥{{ Number(record.price || 0).toLocaleString() }}
          </template>
          <template v-if="column.key === 'action'">
            <div class="action-btns">
              <a-button size="small" @click="openModal(record)"><EditOutlined /></a-button>
              <a-button size="small" type="primary" ghost @click="openAssign(record)" v-if="record.status !== '已分配'">分配</a-button>
              <a-button size="small" @click="unassignBooth(record)" v-if="record.status === '已分配'">取消分配</a-button>
              <a-button size="small" danger @click="confirmDelete(record)"><DeleteOutlined /></a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑展位 Modal -->
    <a-modal v-model:open="modalOpen" :title="editRecord ? '编辑展位' : '新增展位'" @ok="handleSubmit" ok-text="保存" cancel-text="取消" :confirm-loading="submitting" :mask-closable="false">
      <a-form :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }" ref="formRef">
        <a-form-item label="所属会展" name="expo_id" :rules="[{required:true,message:'请选择会展'}]">
          <a-select v-model:value="form.expo_id">
            <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="展位编号" name="number" :rules="[{required:true,message:'请输入展位编号'}]">
          <a-input v-model:value="form.number" placeholder="如：A-001" />
        </a-form-item>
        <a-form-item label="展区" name="zone">
          <a-input v-model:value="form.zone" placeholder="如：A区/B区" />
        </a-form-item>
        <a-form-item label="展位类型" name="type">
          <a-select v-model:value="form.type">
            <a-select-option value="标准展位">标准展位</a-select-option>
            <a-select-option value="特装展位">特装展位</a-select-option>
            <a-select-option value="室外展位">室外展位</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="面积(㎡)" name="size_sqm">
          <a-input-number v-model:value="form.size_sqm" style="width:100%" :min="1" />
        </a-form-item>
        <a-form-item label="价格(元)" name="price">
          <a-input-number v-model:value="form.price" style="width:100%" :min="0" />
        </a-form-item>
        <a-form-item label="状态" name="status">
          <a-select v-model:value="form.status">
            <a-select-option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="配套设施" name="facilities">
          <a-input v-model:value="form.facilities" placeholder="如：电力/网络/空调" />
        </a-form-item>
      </a-form>
    </a-modal>

    <!-- 分配展位 Modal -->
    <a-modal v-model:open="assignOpen" title="分配展位给参展商" @ok="handleAssign" ok-text="确认分配" cancel-text="取消" :confirm-loading="submitting">
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="展位">&nbsp;<a-tag>{{ assignBooth?.number }}</a-tag></a-form-item>
        <a-form-item label="选择参展商">
          <a-select v-model:value="assignExhibitorId" placeholder="请选择参展商" style="width:100%">
            <a-select-option v-for="ex in exhibitors" :key="ex.id" :value="ex.id">{{ ex.company_name }}</a-select-option>
          </a-select>
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, computed, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, EditOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue'
import type { Booth, Expo, Exhibitor } from '@/types'

const authStore = useAuthStore()
const list = ref<Booth[]>([])
const expos = ref<Expo[]>([])
const exhibitors = ref<Exhibitor[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const assignOpen = ref(false)
const submitting = ref(false)
const editRecord = ref<Booth | null>(null)
const assignBooth = ref<Booth | null>(null)
const assignExhibitorId = ref<number | undefined>(undefined)
const formRef = ref()
const statusOptions = ['空闲', '已预订', '已分配', '待布置', '不可用']
const query = reactive({ expo_id: undefined as number | undefined, status: undefined as string | undefined, type: undefined as string | undefined, page: 1, pageSize: 20 })
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const form = reactive({ expo_id: undefined as number | undefined, number: '', area: '', zone: '', floor: 1, type: '标准展位', size_sqm: undefined as number | undefined, price: undefined as number | undefined, status: '空闲', facilities: '' })

function statusColor(s: string) {
  const m: Record<string, string> = { '空闲': 'green', '已预订': 'orange', '已分配': 'blue', '待布置': 'purple', '不可用': 'red' }
  return m[s] || 'default'
}

const boothStats = computed(() => {
  const total = list.value.length
  const free = list.value.filter(b => b.status === '空闲').length
  const assigned = list.value.filter(b => b.status === '已分配').length
  const reserved = list.value.filter(b => b.status === '已预订').length
  return [
    { label: '展位总数', value: pagination.total || total, color: '#1677ff' },
    { label: '已分配', value: assigned, color: '#52c41a' },
    { label: '已预订', value: reserved, color: '#fa8c16' },
    { label: '空闲', value: free, color: '#999' },
  ]
})

const columns = [
  { title: '展位编号', dataIndex: 'number', width: 90 },
  { title: '展区', dataIndex: 'zone', width: 80 },
  { title: '类型', dataIndex: 'type', width: 100 },
  { title: '面积(㎡)', dataIndex: 'size_sqm', width: 90 },
  { title: '价格', key: 'price', width: 100 },
  { title: '状态', key: 'status', width: 90 },
  { title: '分配给', dataIndex: 'exhibitor_name', ellipsis: true },
  { title: '会展', dataIndex: 'expo_name', ellipsis: true },
  { title: '操作', key: 'action', width: 200, fixed: 'right' },
]

async function loadList() {
  loading.value = true
  try {
    const res = await api.get('/booths', { params: query })
    list.value = res.data.data.list
    pagination.total = res.data.data.total
  } finally { loading.value = false }
}
async function loadExpos() { const res = await api.get('/expos', { params: { pageSize: 100 } }); expos.value = res.data.data.list }
async function loadExhibitors() { const res = await api.get('/exhibitors', { params: { pageSize: 100 } }); exhibitors.value = res.data.data.list }
function search() { query.page = 1; pagination.current = 1; loadList() }
function handleTableChange(p: any) { query.page = p.current; query.pageSize = p.pageSize; pagination.current = p.current; loadList() }

function openModal(record?: Booth) {
  editRecord.value = record || null
  if (record) {
    Object.assign(form, { expo_id: record.expo_id, number: record.number, area: record.area || '', zone: record.zone || '', floor: record.floor || 1, type: record.type, size_sqm: record.size_sqm, price: record.price, status: record.status, facilities: record.facilities || '' })
  } else {
    Object.assign(form, { expo_id: undefined, number: '', area: '', zone: '', floor: 1, type: '标准展位', size_sqm: undefined, price: undefined, status: '空闲', facilities: '' })
  }
  modalOpen.value = true
}
async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    if (editRecord.value) { await api.put(`/booths/${editRecord.value.id}`, form); message.success('更新成功') }
    else { await api.post('/booths', form); message.success('创建成功') }
    modalOpen.value = false; loadList()
  } finally { submitting.value = false }
}

function openAssign(record: Booth) { assignBooth.value = record; assignExhibitorId.value = undefined; assignOpen.value = true }
async function handleAssign() {
  if (!assignExhibitorId.value) { message.warning('请选择参展商'); return }
  submitting.value = true
  try {
    await api.patch(`/booths/${assignBooth.value!.id}/assign`, { exhibitor_id: assignExhibitorId.value })
    message.success('分配成功')
    assignOpen.value = false; loadList()
  } finally { submitting.value = false }
}
async function unassignBooth(record: Booth) {
  Modal.confirm({
    title: '取消分配',
    content: `确定取消展位「${record.number}」的分配吗？`,
    okText: '确认',
    cancelText: '取消',
    async onOk() {
      await api.patch(`/booths/${record.id}/unassign`, {})
      message.success('取消分配成功')
      loadList()
    },
  })
}
function confirmDelete(record: Booth) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除展位「${record.number}」吗？`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await api.delete(`/booths/${record.id}`)
      message.success('删除成功')
      loadList()
    },
  })
}
onMounted(() => { loadExpos(); loadExhibitors(); loadList() })
</script>
