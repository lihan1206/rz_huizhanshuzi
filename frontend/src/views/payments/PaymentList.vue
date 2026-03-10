<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">💳 支付管理</span>
      <a-button type="primary" @click="openModal()" v-if="authStore.isAdminOrOperator">
        <template #icon><PlusOutlined /></template>创建订单
      </a-button>
    </div>

    <!-- 统计 -->
    <a-row :gutter="12" style="margin-bottom:16px" v-if="payStats">
      <a-col :span="8"><div class="stat-card" style="padding:16px; text-align:center"><div style="font-size:22px; font-weight:700; color:#1677ff">¥{{ Number(payStats.paid_amount || 0).toLocaleString() }}</div><div style="font-size:12px; color:#999">已收金额</div></div></a-col>
      <a-col :span="8"><div class="stat-card" style="padding:16px; text-align:center"><div style="font-size:22px; font-weight:700; color:#fa8c16">¥{{ Number(payStats.pending_amount || 0).toLocaleString() }}</div><div style="font-size:12px; color:#999">待收金额</div></div></a-col>
      <a-col :span="8"><div class="stat-card" style="padding:16px; text-align:center"><div style="font-size:22px; font-weight:700; color:#666">{{ payStats.pending_orders || 0 }}</div><div style="font-size:12px; color:#999">待支付订单</div></div></a-col>
    </a-row>

    <div class="search-area">
      <a-select v-model:value="query.expo_id" placeholder="所属会展" allow-clear style="width:220px" @change="search">
        <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.status" placeholder="订单状态" allow-clear style="width:130px" @change="search">
        <a-select-option v-for="s in ['待支付','已支付','已退款','已取消']" :key="s" :value="s">{{ s }}</a-select-option>
      </a-select>
      <a-input v-model:value="query.keyword" placeholder="订单号/公司名" allow-clear style="width:200px" @change="search" />
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>

    <a-card :bordered="false">
      <a-table :dataSource="list" :columns="columns" :pagination="pagination" :loading="loading" row-key="id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'status'">
            <a-tag :color="statusColor(record.status)">{{ record.status }}</a-tag>
          </template>
          <template v-if="column.key === 'amount'">
            <span style="font-weight:600; color:#1677ff">¥{{ Number(record.amount).toLocaleString() }}</span>
          </template>
          <template v-if="column.key === 'action'">
            <div class="action-btns">
              <a-button size="small" type="primary" ghost @click="confirmPay(record)" v-if="authStore.isAdminOrOperator && record.status === '待支付'">确认收款</a-button>
              <a-button size="small" @click="remindPayment(record)" v-if="authStore.isAdminOrOperator && record.status === '待支付'">催缴</a-button>
              <a-button size="small" danger ghost @click="cancelOrder(record)" v-if="authStore.isAdminOrOperator && record.status === '待支付'">取消订单</a-button>
              <a-button size="small" @click="confirmRefund(record)" v-if="authStore.isAdminOrOperator && record.status === '已支付'">退款</a-button>
              <a-button size="small" danger @click="confirmDelete(record)" v-if="authStore.isAdminOrOperator"><DeleteOutlined /></a-button>
            </div>
          </template>
        </template>
      </a-table>
    </a-card>

    <!-- 创建订单 Modal -->
    <a-modal v-model:open="modalOpen" title="创建支付订单" @ok="handleSubmit" ok-text="创建" cancel-text="取消" :confirm-loading="submitting">
      <a-form :model="form" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }" ref="formRef">
        <a-form-item label="所属会展">
          <a-select v-model:value="form.expo_id" placeholder="选择会展(可选)" allow-clear>
            <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="参展商">
          <a-select v-model:value="form.exhibitor_id" placeholder="选择参展商(可选)" allow-clear>
            <a-select-option v-for="ex in exhibitors" :key="ex.id" :value="ex.id">{{ ex.company_name }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="金额(元)" name="amount" :rules="[{required:true,message:'请输入金额'}]">
          <a-input-number v-model:value="form.amount" style="width:100%" :min="0" :precision="2" />
        </a-form-item>
        <a-form-item label="费用类型">
          <a-select v-model:value="form.type">
            <a-select-option v-for="t in ['展位费','服务费','押金','其他']" :key="t" :value="t">{{ t }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="支付方式">
          <a-select v-model:value="form.payment_method">
            <a-select-option v-for="m in ['支付宝','微信','银联','线下']" :key="m" :value="m">{{ m }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="备注"><a-input v-model:value="form.note" /></a-form-item>
      </a-form>
    </a-modal>

    <!-- 收款确认 Modal -->
    <a-modal v-model:open="payOpen" title="确认收款" @ok="handlePay" ok-text="确认已收款" cancel-text="取消" :confirm-loading="submitting">
      <p>订单号：<strong>{{ payRecord?.order_no }}</strong></p>
      <p>金额：<strong style="color:#1677ff">¥{{ Number(payRecord?.amount || 0).toLocaleString() }}</strong></p>
      <a-form :model="payForm" :label-col="{ span: 7 }" :wrapper-col="{ span: 15 }">
        <a-form-item label="支付方式">
          <a-select v-model:value="payForm.payment_method">
            <a-select-option v-for="m in ['支付宝','微信','银联','线下']" :key="m" :value="m">{{ m }}</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="发票号(可选)"><a-input v-model:value="payForm.invoice_no" /></a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'
import { message, Modal } from 'ant-design-vue'
import { PlusOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons-vue'
import type { Payment, Expo, Exhibitor } from '@/types'

const authStore = useAuthStore()
const list = ref<Payment[]>([])
const expos = ref<Expo[]>([])
const exhibitors = ref<Exhibitor[]>([])
const loading = ref(false)
const modalOpen = ref(false)
const payOpen = ref(false)
const submitting = ref(false)
const payRecord = ref<Payment | null>(null)
const payStats = ref<any>(null)
const formRef = ref()
const query = reactive({ expo_id: undefined as number | undefined, status: undefined as string | undefined, keyword: '', page: 1, pageSize: 10 })
const pagination = reactive({ current: 1, pageSize: 10, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const form = reactive({ expo_id: undefined as number | undefined, exhibitor_id: undefined as number | undefined, amount: undefined as number | undefined, type: '展位费', payment_method: '线下', note: '' })
const payForm = reactive({ payment_method: '线下', invoice_no: '' })

function statusColor(s: string) { const m: Record<string, string> = { '待支付': 'orange', '已支付': 'green', '已退款': 'blue', '已取消': 'default' }; return m[s] || 'default' }

const columns = [
  { title: '订单号', dataIndex: 'order_no', width: 200, ellipsis: true },
  { title: '所属会展', dataIndex: 'expo_name', width: 150, ellipsis: true },
  { title: '参展商', dataIndex: 'exhibitor_name', ellipsis: true },
  { title: '金额', key: 'amount', width: 120 },
  { title: '类型', dataIndex: 'type', width: 90 },
  { title: '状态', key: 'status', width: 90 },
  { title: '支付方式', dataIndex: 'payment_method', width: 90 },
  { title: '创建时间', dataIndex: 'created_at', width: 150, customRender: ({ text }: any) => text?.slice(0,10) },
  { title: '操作', key: 'action', width: 280, fixed: 'right' },
]

async function loadList() {
  loading.value = true
  try {
    const res = await api.get('/payments', { params: query })
    list.value = res.data.data.list
    pagination.total = res.data.data.total
  } finally { loading.value = false }
}
async function loadStats() {
  const res = await api.get('/payments/summary', { params: { expo_id: query.expo_id } })
  payStats.value = res.data.data.payments
}
async function loadExpos() { const res = await api.get('/expos', { params: { pageSize: 100 } }); expos.value = res.data.data.list }
async function loadExhibitors() { const res = await api.get('/exhibitors', { params: { pageSize: 100 } }); exhibitors.value = res.data.data.list }
function search() { query.page = 1; pagination.current = 1; loadList(); loadStats() }
function handleTableChange(p: any) { query.page = p.current; query.pageSize = p.pageSize; pagination.current = p.current; loadList() }

function openModal() { Object.assign(form, { expo_id: undefined, exhibitor_id: undefined, amount: undefined, type: '展位费', payment_method: '线下', note: '' }); modalOpen.value = true }
async function handleSubmit() {
  try { await formRef.value.validate() } catch { return }
  submitting.value = true
  try { await api.post('/payments', form); message.success('创建成功'); modalOpen.value = false; loadList(); loadStats() }
  finally { submitting.value = false }
}

function confirmPay(record: Payment) { payRecord.value = record; Object.assign(payForm, { payment_method: record.payment_method || '线下', invoice_no: '' }); payOpen.value = true }
async function handlePay() {
  submitting.value = true
  try { await api.patch(`/payments/${payRecord.value!.id}/pay`, payForm); message.success('确认收款成功'); payOpen.value = false; loadList(); loadStats() }
  finally { submitting.value = false }
}

function confirmRefund(record: Payment) {
  Modal.confirm({
    title: '确认退款',
    content: `确定对订单「${record.order_no}」退款 ¥${Number(record.amount).toLocaleString()} 吗？`,
    okText: '确认退款',
    okType: 'danger',
    cancelText: '取消',
    async onOk() { await api.patch(`/payments/${record.id}/refund`); message.success('退款成功'); loadList(); loadStats() },
  })
}

function cancelOrder(record: Payment) {
  Modal.confirm({
    title: '确认取消订单',
    content: `确定取消待支付订单「${record.order_no}」吗？`,
    okText: '确认取消',
    okType: 'danger',
    cancelText: '取消',
    async onOk() { await api.patch(`/payments/${record.id}/cancel`, {}); message.success('订单已取消'); loadList(); loadStats() },
  })
}

async function remindPayment(record: Payment) {
  await api.post(`/payments/${record.id}/remind`, {})
  message.success('催缴提醒已发送')
}

function confirmDelete(record: Payment) {
  Modal.confirm({
    title: '确认删除',
    content: `确定删除订单「${record.order_no}」吗？`,
    okText: '确认删除',
    okType: 'danger',
    cancelText: '取消',
    async onOk() { await api.delete(`/payments/${record.id}`); message.success('删除成功'); loadList() },
  })
}

onMounted(() => { loadExpos(); loadExhibitors(); loadList(); loadStats() })
</script>
