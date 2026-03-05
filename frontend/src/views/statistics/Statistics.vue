<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">📊 数据统计分析</span>
      <a-select v-model:value="selectedExpoId" placeholder="选择会展查看详情" allow-clear style="width:240px" @change="loadExpoStats">
        <a-select-option v-for="e in expos" :key="e.id" :value="e.id">{{ e.name }}</a-select-option>
      </a-select>
    </div>

    <!-- 全局统计 -->
    <a-row :gutter="16" style="margin-bottom:16px">
      <a-col :xs="24" :md="14">
        <a-card title="📈 近6个月观众注册趋势" :bordered="false">
          <div ref="trendRef" style="height:260px"></div>
        </a-card>
      </a-col>
      <a-col :xs="24" :md="10">
        <a-card title="🥧 展位占用状态分布" :bordered="false">
          <div ref="pieRef" style="height:260px"></div>
        </a-card>
      </a-col>
    </a-row>

    <a-row :gutter="16" v-if="expoStats">
      <a-col :xs="24" :md="12">
        <a-card :title="`📅 ${expoStats.expo?.name} - 每日签到`" :bordered="false">
          <div ref="dayChartRef" style="height:220px"></div>
        </a-card>
      </a-col>
      <a-col :xs="24" :md="12">
        <a-card :title="`📋 ${expoStats.expo?.name} - 数据概览`" :bordered="false">
          <a-descriptions :column="2" bordered size="small">
            <a-descriptions-item label="观众总数">{{ expoStats.visitors?.total }}</a-descriptions-item>
            <a-descriptions-item label="已入场观众">{{ expoStats.visitors?.checkedin }}</a-descriptions-item>
            <a-descriptions-item label="参展商总数">{{ expoStats.exhibitors?.total }}</a-descriptions-item>
            <a-descriptions-item label="已缴费参展商">{{ expoStats.exhibitors?.paid }}</a-descriptions-item>
            <a-descriptions-item label="展位总数">{{ expoStats.booths?.total }}</a-descriptions-item>
            <a-descriptions-item label="已分配展位">{{ expoStats.booths?.assigned }}</a-descriptions-item>
            <a-descriptions-item label="展位空闲">{{ expoStats.booths?.free }}</a-descriptions-item>
            <a-descriptions-item label="已收入金额">¥{{ Number(expoStats.payments?.revenue || 0).toLocaleString() }}</a-descriptions-item>
          </a-descriptions>
        </a-card>
      </a-col>
    </a-row>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import * as echarts from 'echarts'
import api from '@/api'
import type { Expo } from '@/types'

const expos = ref<Expo[]>([])
const selectedExpoId = ref<number | undefined>()
const expoStats = ref<any>(null)
const trendRef = ref<HTMLElement>()
const pieRef = ref<HTMLElement>()
const dayChartRef = ref<HTMLElement>()

async function loadDashboard() {
  const res = await api.get('/statistics/dashboard')
  const data = res.data.data
  if (trendRef.value) {
    const chart = echarts.init(trendRef.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { top: 20, right: 20, bottom: 30, left: 50 },
      xAxis: { type: 'category', data: data.trends.visitorTrend.map((d: any) => d.month) },
      yAxis: { type: 'value' },
      series: [{ name: '观众数', type: 'bar', data: data.trends.visitorTrend.map((d: any) => d.cnt), itemStyle: { borderRadius: [4,4,0,0], color: new echarts.graphic.LinearGradient(0,0,0,1,[{offset:0,color:'#1677ff'},{offset:1,color:'#4096ff80'}]) } }],
    })
  }
  if (pieRef.value) {
    const b = data.booths
    const chart = echarts.init(pieRef.value)
    chart.setOption({
      tooltip: { trigger: 'item' },
      legend: { bottom: 5 },
      series: [{ type: 'pie', radius: ['35%','65%'], data: [{ value: b.assigned, name: '已分配', itemStyle: { color: '#1677ff' } }, { value: b.free, name: '空闲', itemStyle: { color: '#52c41a' } }, { value: b.reserved, name: '已预订', itemStyle: { color: '#fa8c16' } }], label: { fontSize: 12 } }],
    })
  }
}

async function loadExpoStats(id: number | undefined) {
  if (!id) { expoStats.value = null; return }
  const res = await api.get(`/statistics/expo/${id}`)
  expoStats.value = res.data.data
  if (dayChartRef.value && expoStats.value?.checkinByDay?.length) {
    const chart = echarts.init(dayChartRef.value)
    chart.setOption({
      tooltip: { trigger: 'axis' },
      grid: { top:20, right:20, bottom:30, left:50 },
      xAxis: { type: 'category', data: expoStats.value.checkinByDay.map((d: any) => d.day) },
      yAxis: { type: 'value' },
      series: [{ name: '签到数', type: 'line', smooth: true, data: expoStats.value.checkinByDay.map((d: any) => d.cnt), areaStyle: { opacity: 0.15 }, lineStyle: { color: '#52c41a', width: 3 }, itemStyle: { color: '#52c41a' } }],
    })
  }
}

async function loadExpos() { const res = await api.get('/expos', { params: { pageSize: 100 } }); expos.value = res.data.data.list }
onMounted(() => { loadExpos(); loadDashboard() })
</script>
