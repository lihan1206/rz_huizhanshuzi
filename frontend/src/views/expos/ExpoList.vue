<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">📋 会展项目管理</span>
      <a-button type="primary" @click="openModal()" v-if="authStore.isAdminOrOperator">
        <template #icon><PlusOutlined /></template>
        新增会展
      </a-button>
    </div>

    <!-- 搜索区 -->
    <div class="search-area">
      <a-input v-model:value="query.keyword" placeholder="搜索名称/地点/主题" allow-clear style="width:220px" @change="search" />
      <a-select v-model:value="query.status" placeholder="状态筛选" allow-clear style="width:140px" @change="search">
        <a-select-option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
      <a-button type="primary" @click="search"><SearchOutlined /> 查询</a-button>
    </div>

    <!-- 表格 -->
    <a-card :bordered="false">
      <a-table
        :dataSource="list"
        :columns="columns"
        :pagination="pagination"
        :loading="loading"
        row-key="id"
        @change="handleTableChange"
        :scroll="{ x: 1000 }"
      >
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
          </template>
          <template v-if="column.key === 'dates'">
            {{ record.start_date }} ~ {{ record.end_date }}
          </template>
          <template v-if="column.key === 'counts'">
            <a-space>
              <a-tag color="blue">参展商 {{ record.exhibitor_count }}</a-tag>
              <a-tag color="green">观众 {{ record.visitor_count }}</a-tag>
            </a-space>
          </template>
          <template v-if="column.key === 'action'">
            <div class="action-btns">
              <a-button size="small" @click="openModal(record)"><EditOutlined /> 编辑</a-button>
              <a-button size="small" danger @click="confirmDelete(record)"><DeleteOutlined /> 删除</a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 新增/编辑 Modal -->
    <a-modal
      v-model:open="modalOpen"
      :title="editRecord ? '编辑会展项目' : '新增会展项目'"
      width="720px"
      @ok="handleSubmit"
      ok-text="保存"
      cancel-text="取消"
      :confirm-loading="submitting"
      :mask-closable="false"
    >
      <a-form :model="form" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="formRef">
        <a-row :gutter="16">
          <a-col :span="12">
            <a-form-item label="会展名称" name="name" :rules="[{required:true,message:'请输入名称'}]">
              <a-input v-model:value="form.name" placeholder="如：2025年春季展" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="主题" name="theme">
              <a-input v-model:value="form.theme" placeholder="展会主题" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="举办地点" name="location">
              <a-input v-model:value="form.location" placeholder="城市/地区" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="场馆名称" name="venue">
              <a-input v-model:value="form.venue" placeholder="会展中心名称" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="开始日期" name="start_date" :rules="[{required:true,message:'请选择日期'}]">
              <a-input v-model:value="form.start_date" type="date" style="width:100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="结束日期" name="end_date" :rules="[{required:true,message:'请选择日期'}]">
              <a-input v-model:value="form.end_date" type="date" style="width:100%" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="状态" name="status">
              <a-select v-model:value="form.status">
                <a-select-option v-for="s in statusOptions" :key="s" :value="s">{{ s }}</a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="类别" name="category">
              <a-input v-model:value="form.category" placeholder="如：制造业/消费电子" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="预期规模" name="scale">
              <a-input-number v-model:value="form.scale" style="width:100%" :min="0" addonAfter="人次" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="预算(元)" name="budget">
              <a-input-number v-model:value="form.budget" style="width:100%" :min="0" :formatter="v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="主办方" name="organizer">
              <a-input v-model:value="form.organizer" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item label="联系人" name="contact_name">
              <a-input v-model:value="form.contact_name" />
            </a-form-item>
          </a-col>
          <a-col :span="24">
            <a-form-item label="描述" name="description" :label-col="{ span: 3 }" :wrapper-col="{ span: 20 }">
              <a-textarea v-model:value="form.description" :rows="3" placeholder="会展简介..." />
            </a-form-item>
          </a-col>
        </a-row>
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
import type { Expo } from '@/types'
import dayjs from 'dayjs'

const authStore = useAuthStore()
const list = ref<Expo[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const submitting = ref(false)
const editRecord = ref<Expo | null>(null)
const formRef = ref()

const statusOptions = ['筹备中', '进行中', '已结束', '已取消']
const query = reactive({ keyword: '', status: undefined as string | undefined, page: 1, pageSize: 10 })
const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showQuickJumper: true, showTotal: (t: number) => `共 ${t} 条` })

const form = reactive({ name: '', theme: '', location: '', venue: '', start_date: '', end_date: '', scale: undefined as number | undefined, budget: undefined as number | undefined, status: '筹备中', description: '', category: '', organizer: '', contact_name: '', contact_phone: '' })

const columns = [
  { title: '会展名称', dataIndex: 'name', width: 200, ellipsis: true },
  { title: '类别', dataIndex: 'category', width: 100 },
  { title: '举办地点', dataIndex: 'venue', ellipsis: true },
  { title: '会期', key: 'dates', width: 200 },
  { title: '状态', key: 'status', width: 90 },
  { title: '数据', key: 'counts', width: 180 },
  { title: '操作', key: 'action', width: 140, fixed: 'right' },
]

function statusColor(s: string) {
  const map: Record<string, string> = { '筹备中': 'blue', '进行中': 'green', '已结束': 'default', '已取消': 'red' }
  return map[s] || 'default'
}

async function loadList() {
  loading.value = true
  try {
    const res = await api.get('/expos', { params: query })
    list.value = res.data.data.list
    pagination.total = res.data.data.total
  } finally { loading.value = false }
}

function search() { query.page = 1; pagination.current = 1; loadList() }
function handleTableChange(p: any) { query.page = p.current; query.pageSize = p.pageSize; pagination.current = p.current; loadList() }

function openModal(record?: Expo) {
  editRecord.value = record || null
  if (record) {
    Object.assign(form, { name: record.name, theme: record.theme || '', location: record.location || '', venue: record.venue || '', start_date: record.start_date?.slice(0,10) || '', end_date: record.end_date?.slice(0,10) || '', scale: record.scale, budget: record.budget, status: record.status, description: record.description || '', category: record.category || '', organizer: (record as any).organizer || '', contact_name: (record as any).contact_name || '' })
  } else {
    Object.assign(form, { name: '', theme: '', location: '', venue: '', start_date: '', end_date: '', scale: undefined, budget: undefined, status: '筹备中', description: '', category: '', organizer: '', contact_name: '' })
  }
  modalOpen.value = true
}

async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try {
    if (editRecord.value) {
      await api.put(`/expos/${editRecord.value.id}`, form)
      message.success('更新成功')
    } else {
      await api.post('/expos', form)
      message.success('创建成功')
    }
    modalOpen.value = false
    loadList()
  } finally { submitting.value = false }
}

function confirmDelete(record: Expo) {
  Modal.confirm({
    title: '确认删除',
    content: `确定要删除会展「${record.name}」吗？删除后无法恢复。`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() {
      await api.delete(`/expos/${record.id}`)
      message.success('删除成功')
      loadList()
    },
  })
}

onMounted(loadList)
</script>
