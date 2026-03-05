<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">✅ 签到管理</span>
      <a-space>
        <a-button type="primary" @click="openScanModal" v-if="authStore.isAdminOrOperator">
          <template #icon><QrcodeOutlined /></template>扫码签到
        </a-button>
        <a-button @click="openManualModal" v-if="authStore.isAdminOrOperator">手动签到</a-button>
      </a-space>
    </div>

    <!-- 统计卡片 -->
    <a-row :gutter="12" style="margin-bottom:16px" v-if="statsData">
      <a-col :span="8">
        <div class="stat-card" style="padding:16px; display:flex; align-items:center; gap:12px">
          <div style="font-size:36px">📊</div>
          <div>
            <div style="font-size:22px; font-weight:700; color:#1677ff">{{ statsData.totalCheckins }}</div>
            <div style="font-size:12px; color:#999">签到总次数</div>
          </div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="stat-card" style="padding:16px; display:flex; align-items:center; gap:12px">
          <div style="font-size:36px">👤</div>
          <div>
            <div style="font-size:22px; font-weight:700; color:#52c41a">{{ statsData.visitorCheckedIn }}/{{ statsData.visitorTotal }}</div>
            <div style="font-size:12px; color:#999">观众入场率</div>
          </div>
        </div>
      </a-col>
      <a-col :span="8">
        <div class="stat-card" style="padding:16px; display:flex; align-items:center; gap:12px">
          <div style="font-size:36px">🏢</div>
          <div>
            <div style="font-size:22px; font-weight:700; color:#722ed1">{{ statsData.exhibitorTotal }}</div>
            <div style="font-size:12px; color:#999">参展商确认数</div>
          </div>
        </div>
      </a-col>
    </a-row>

    <div class="search-area">
      <a-select v-model:value="query.expo_id" placeholder="选择会展" allow-clear style="width:200px" @change="search">
        <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.type" placeholder="签到类型" allow-clear style="width:130px" @change="search">
        <a-select-option value="参展商">参展商</a-select-option>
        <a-select-option value="观众">观众</a-select-option>
        <a-select-option value="工作人员">工作人员</a-select-option>
      </a-select>
      <a-input v-model:value="query.keyword" placeholder="姓名/票码" allow-clear style="width:200px" @change="search" />
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>

    <a-card :bordered="false">
      <a-table :dataSource="list" :columns="columns" :pagination="pagination" :loading="loading" row-key="id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'type'">
            <a-tag :color="typeColor(record.type)">{{ record.type }}</a-tag>
          </template>
          <template v-if="column.key === 'method'">
            <a-tag>{{ record.method }}</a-tag>
          </template>
          <template v-if="column.key === 'time'">
            {{ record.checkin_time?.slice(0,19).replace('T',' ') }}
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 扫码签到 Modal -->
    <a-modal v-model:open="scanOpen" title="🔍 扫码签到" @ok="handleScan" ok-text="确认签到" cancel-text="取消" :confirm-loading="submitting">
      <a-alert type="info" message="请输入观众票码或扫描二维码" style="margin-bottom:16px" />
      <a-form :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }">
        <a-form-item label="所属会展">
          <a-select v-model:value="scanForm.expo_id" placeholder="选择会展" style="width:100%">
            <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="票码" required>
          <a-input v-model:value="scanForm.ticket_code" placeholder="请输入票码，如 EXPO-1-XXXXXXXX" size="large" ref="ticketInputRef" />
        </a-form-item>
      </a-form>
      <div v-if="scanResult" style="margin-top:16px">
        <a-result
          :status="scanResult.success ? 'success' : 'error'"
          :title="scanResult.success ? '签到成功！' : '签到失败'"
          :sub-title="scanResult.message"
        />
      </div>
    </a-modal>

    <!-- 手动签到 Modal -->
    <a-modal v-model:open="manualOpen" title="✏️ 手动签到" @ok="handleManual" ok-text="确认签到" cancel-text="取消" :confirm-loading="submitting" :mask-closable="false">
      <a-form :model="manualForm" :label-col="{ span: 6 }" :wrapper-col="{ span: 16 }" ref="manualFormRef">
        <a-form-item label="所属会展" name="expo_id" :rules="[{required:true,message:'请选择'}]">
          <a-select v-model:value="manualForm.expo_id">
            <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="签到类型" name="type" :rules="[{required:true,message:'请选择'}]">
          <a-select v-model:value="manualForm.type">
            <a-select-option value="参展商">参展商</a-select-option>
            <a-select-option value="观众">观众</a-select-option>
            <a-select-option value="工作人员">工作人员</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="姓名/公司" name="name" :rules="[{required:true,message:'请输入'}]">
          <a-input v-model:value="manualForm.name" />
        </a-form-item>
        <a-form-item label="备注" name="note">
          <a-input v-model:value="manualForm.note" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'
import { message } from 'ant-design-vue'
import { QrcodeOutlined, SearchOutlined } from '@ant-design/icons-vue'
import type { Expo } from '@/types'

const authStore = useAuthStore()
const list = ref([])
const expos = ref<Expo[]>([])
const loading = ref(false)
const scanOpen = ref(false)
const manualOpen = ref(false)
const submitting = ref(false)
const statsData = ref<any>(null)
const scanResult = ref<any>(null)
const manualFormRef = ref()
const ticketInputRef = ref()
const query = reactive({ expo_id: undefined as number | undefined, type: undefined as string | undefined, keyword: '', page: 1, pageSize: 20 })
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const scanForm = reactive({ ticket_code: '', expo_id: undefined as number | undefined })
const manualForm = reactive({ expo_id: undefined as number | undefined, type: '观众', name: '', note: '' })

function typeColor(t: string) { const m: Record<string, string> = { '参展商': 'blue', '观众': 'green', '工作人员': 'purple' }; return m[t] || 'default' }

const columns = [
  { title: '姓名/公司', dataIndex: 'name', width: 120 },
  { title: '类型', key: 'type', width: 90 },
  { title: '票码', dataIndex: 'ticket_code', ellipsis: true },
  { title: '签到方式', key: 'method', width: 90 },
  { title: '所属会展', dataIndex: 'expo_name', ellipsis: true },
  { title: '操作人', dataIndex: 'operator_name', width: 90 },
  { title: '签到时间', key: 'time', width: 160 },
]

async function loadList() {
  loading.value = true
  try {
    const res = await api.get('/checkin', { params: query })
    list.value = res.data.data.list
    pagination.total = res.data.data.total
  } finally { loading.value = false }
}
async function loadExpos() { const res = await api.get('/expos', { params: { pageSize: 100 } }); expos.value = res.data.data.list }
async function loadStats() {
  if (query.expo_id) {
    const res = await api.get(`/checkin/stats/${query.expo_id}`)
    statsData.value = res.data.data
  }
}
function search() { query.page = 1; pagination.current = 1; loadList(); loadStats() }
function handleTableChange(p: any) { query.page = p.current; query.pageSize = p.pageSize; pagination.current = p.current; loadList() }

function openScanModal() { scanForm.ticket_code = ''; scanForm.expo_id = query.expo_id; scanResult.value = null; scanOpen.value = true }
async function handleScan() {
  if (!scanForm.ticket_code) { message.warning('请输入票码'); return }
  submitting.value = true
  try {
    const res = await api.post('/checkin/scan', { ticket_code: scanForm.ticket_code, expo_id: scanForm.expo_id })
    scanResult.value = { success: true, message: `${res.data.data.real_name} 签到成功！` }
    message.success('签到成功')
    loadList()
  } catch (err: any) {
    scanResult.value = { success: false, message: err.response?.data?.message || '签到失败' }
  } finally { submitting.value = false }
}

function openManualModal() { Object.assign(manualForm, { expo_id: query.expo_id, type: '观众', name: '', note: '' }); manualOpen.value = true }
async function handleManual() {
  try { await manualFormRef.value.validate() } catch { return }
  submitting.value = true
  try {
    await api.post('/checkin', { ...manualForm, method: '手动' })
    message.success('签到成功')
    manualOpen.value = false
    loadList()
  } finally { submitting.value = false }
}

onMounted(() => { loadExpos(); loadList() })
</script>
