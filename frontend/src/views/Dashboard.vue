<template>
  <div class="page-container">
    <!-- 顶部欢迎 -->
    <div class="gradient-header" style="background: linear-gradient(135deg, #1677ff 0%, #0958d9 100%)">
      <div style="display:flex; justify-content:space-between; align-items:center">
        <div>
          <h2 style="color:#fff; margin:0; font-size:22px">🏛️ 会展数字化综合运营管理系统</h2>
          <p style="color:rgba(255,255,255,0.75); margin:4px 0 0; font-size:13px">
            ExpoDigitalOps &nbsp;|&nbsp; {{ currentDate }}
          </p>
        </div>
        <a-tag color="green" style="font-size:13px">系统正常运行中</a-tag>
      </div>
    </div>

    <!-- KPI 卡片 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :xs="24" :sm="12" :md="6" v-for="kpi in kpiCards" :key="kpi.label">
        <div class="kpi-card" style="margin-bottom: 16px">
          <div class="kpi-icon" :style="{ background: kpi.bg }">
            <component :is="kpi.icon" style="font-size:26px; color:#fff" />
          </div>
          <div class="kpi-info">
            <h3 :style="{ color: kpi.color }">{{ stats[kpi.key] ?? '-' }}</h3>
            <p>{{ kpi.label }}</p>
            <a-tag :color="kpi.tagColor" size="small">{{ kpi.sub }}</a-tag>
          </div>
        </div>
      </a-col>
    </a-row>

    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :xs="24" :lg="14">
        <a-card title="📝 运营待办中心" :bordered="false">
          <a-row :gutter="12">
            <a-col :span="12" :md="6">
              <div class="stat-card todo-card" @click="router.push('/exhibitors')">
                <div class="todo-value">{{ todoSummary.pending_exhibitor_review || 0 }}</div>
                <div class="todo-label">待审核参展商</div>
              </div>
            </a-col>
            <a-col :span="12" :md="6">
              <div class="stat-card todo-card" @click="router.push('/payments')">
                <div class="todo-value">{{ todoSummary.pending_payments || 0 }}</div>
                <div class="todo-label">待支付订单</div>
              </div>
            </a-col>
            <a-col :span="12" :md="6">
              <div class="stat-card todo-card" @click="router.push('/contracts')">
                <div class="todo-value">{{ todoSummary.pending_contracts || 0 }}</div>
                <div class="todo-label">待签署合同</div>
              </div>
            </a-col>
            <a-col :span="12" :md="6">
              <div class="stat-card todo-card" @click="router.push('/booths')">
                <div class="todo-value">{{ todoSummary.free_booths_in_ongoing_expo || 0 }}</div>
                <div class="todo-label">进行中展会空闲展位</div>
              </div>
            </a-col>
          </a-row>
        </a-card>
      </a-col>
      <a-col :xs="24" :lg="10">
        <a-card title="⏰ 待办清单" :bordered="false">
          <a-list :dataSource="todoList" size="small">
            <template #renderItem="{ item }">
              <a-list-item>
                <a-list-item-meta>
                  <template #title>
                    <a-space>
                      <a-tag color="blue">{{ item.todo_type }}</a-tag>
                      <span>{{ item.title }}</span>
                    </a-space>
                  </template>
                  <template #description>
                    <span style="font-size:12px; color:#999">{{ item.expo_name || '-' }} · {{ item.time_at?.slice(0, 10) }}</span>
                  </template>
                </a-list-item-meta>
                <a-button size="small" type="link" @click="goTodo(item.todo_type)">去处理</a-button>
              </a-list-item>
            </template>
            <template #footer v-if="!todoList.length">
              <div style="text-align:center; color:#999; font-size:12px">当前暂无待办任务</div>
            </template>
          </a-list>
        </a-card>
      </a-col>
    </a-row>

    <!-- 图表区 -->
    <a-row :gutter="16" style="margin-bottom: 16px">
      <a-col :xs="24" :md="14">
        <a-card title="📈 观众注册趋势（近6个月）" :bordered="false">
          <div ref="trendChartRef" style="height:280px"></div>
        </a-card>
      </a-col>
      <a-col :xs="24" :md="10">
        <a-card title="🗂️ 展位占用分布" :bordered="false">
          <div ref="boothChartRef" style="height:280px"></div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16">
      <a-col :xs="24" :md="12">
        <a-card title="🏆 各会展参展商数量 TOP 5" :bordered="false">
          <div ref="expoChartRef" style="height:240px"></div>
        </a-card>
      </a-col>
      <a-col :xs="24" :md="12">
        <a-card title="⚡ 最新签到记录" :bordered="false">
          <a-table
            :dataSource="recentCheckins"
            :columns="checkinCols"
            :pagination="false"
            size="small"
            row-key="id"
          />
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import * as echarts from 'echarts'
import api from '@/api'
import dayjs from 'dayjs'
import { useRouter } from 'vue-router'
import {
  CalendarOutlined, TeamOutlined, ShopOutlined, CreditCardOutlined,
} from '@ant-design/icons-vue'

const router = useRouter()
const stats = ref<any>({})
const recentCheckins = ref([])
const todoSummary = ref<any>({})
const todoList = ref<any[]>([])
const trendChartRef = ref<HTMLElement>()
const boothChartRef = ref<HTMLElement>()
const expoChartRef = ref<HTMLElement>()
const currentDate = computed(() => dayjs().format('YYYY年MM月DD日 dddd'))

const kpiCards = [
  { key: 'expoTotal', label: '会展项目总数', icon: CalendarOutlined, bg: 'linear-gradient(135deg,#1677ff,#4096ff)', color: '#1677ff', tagColor: 'blue', sub: '' },
  { key: 'exhibitorTotal', label: '参展商总数', icon: ShopOutlined, bg: 'linear-gradient(135deg,#52c41a,#73d13d)', color: '#52c41a', tagColor: 'green', sub: '' },
  { key: 'visitorTotal', label: '观众注册总数', icon: TeamOutlined, bg: 'linear-gradient(135deg,#722ed1,#9254de)', color: '#722ed1', tagColor: 'purple', sub: '' },
  { key: 'paidAmount', label: '已收入金额(元)', icon: CreditCardOutlined, bg: 'linear-gradient(135deg,#fa8c16,#ffa940)', color: '#fa8c16', tagColor: 'orange', sub: '' },
]

const checkinCols = [
  { title: '姓名', dataIndex: 'name', width: 90 },
  { title: '类型', dataIndex: 'type', width: 80 },
  { title: '签到方式', dataIndex: 'method', width: 80 },
  { title: '时间', dataIndex: 'checkin_time', customRender: ({ text }: any) => dayjs(text).format('MM-DD HH:mm'), ellipsis: true },
]

async function loadData() {
  try {
    const res = await api.get('/statistics/dashboard')
    const data = res.data.data
    stats.value = {
      expoTotal: data.expos.total,
      exhibitorTotal: data.exhibitors.total,
      visitorTotal: data.visitors.total,
      paidAmount: Number(data.payments.paid_amount).toLocaleString(),
    }
    kpiCards[0].sub = `进行中 ${data.expos.ongoing}`
    kpiCards[1].sub = `已缴费 ${data.exhibitors.paid}`
    kpiCards[2].sub = `已入场 ${data.visitors.checkedin}`
    kpiCards[3].sub = `待收 ${Number(data.payments.pending_amount).toLocaleString()}元`

    recentCheckins.value = data.recentCheckins
    todoSummary.value = data.todos?.summary || {}
    todoList.value = data.todos?.list || []

    // 趋势图
    if (trendChartRef.value) {
      const chart = echarts.init(trendChartRef.value)
      chart.setOption({
        tooltip: { trigger: 'axis' },
        grid: { top: 20, right: 20, bottom: 30, left: 50 },
        xAxis: { type: 'category', data: data.trends.visitorTrend.map((d: any) => d.month), axisLabel: { fontSize: 11 } },
        yAxis: { type: 'value' },
        series: [{
          name: '观众注册数',
          type: 'line',
          data: data.trends.visitorTrend.map((d: any) => d.cnt),
          smooth: true,
          areaStyle: { opacity: 0.15 },
          lineStyle: { color: '#1677ff', width: 3 },
          itemStyle: { color: '#1677ff' },
        }],
      })
    }

    // 展位饼图
    if (boothChartRef.value) {
      const b = data.booths
      const chart = echarts.init(boothChartRef.value)
      chart.setOption({
        tooltip: { trigger: 'item' },
        legend: { bottom: 5, fontSize: 11 },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          data: [
            { value: b.assigned, name: '已分配', itemStyle: { color: '#1677ff' } },
            { value: b.free, name: '空闲', itemStyle: { color: '#52c41a' } },
            { value: b.reserved, name: '已预订', itemStyle: { color: '#fa8c16' } },
          ],
          label: { fontSize: 12 },
        }],
      })
    }

    // 参展商柱图
    if (expoChartRef.value) {
      const chart = echarts.init(expoChartRef.value)
      chart.setOption({
        tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
        grid: { top: 10, right: 20, bottom: 60, left: 40 },
        xAxis: {
          type: 'category',
          data: data.trends.expoExhibitors.map((d: any) => d.name.slice(0, 8)),
          axisLabel: { fontSize: 10, rotate: 15 },
        },
        yAxis: { type: 'value' },
        series: [{
          type: 'bar',
          data: data.trends.expoExhibitors.map((d: any) => d.exhibitor_count),
          itemStyle: { borderRadius: [4, 4, 0, 0], color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [{ offset: 0, color: '#1677ff' }, { offset: 1, color: '#4096ff' }]) },
        }],
      })
    }
  } catch { /* 错误已由 axios 处理 */ }
}

function goTodo(type: string) {
  if (type === '参展商审核') {
    router.push('/exhibitors')
    return
  }
  if (type === '订单催缴') {
    router.push('/payments')
    return
  }
  if (type === '合同催签') {
    router.push('/contracts')
    return
  }
  router.push('/dashboard')
}

onMounted(loadData)
</script>

<style scoped>
.todo-card {
  padding: 14px;
  text-align: center;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: 8px;
}

.todo-card:hover {
  transform: translateY(-2px);
}

.todo-value {
  font-size: 24px;
  font-weight: 700;
  color: #1677ff;
}

.todo-label {
  font-size: 12px;
  color: #666;
  margin-top: 4px;
}
</style>
