<template>
  <div class="page-container">
    <div class="page-header">
      <span class="page-title">📋 操作日志审计</span>
    </div>
    <div class="search-area">
      <a-input v-model:value="query.keyword" placeholder="操作/用户名" allow-clear style="width:200px" @change="search" />
      <a-select v-model:value="query.module" placeholder="功能模块" allow-clear style="width:150px" @change="search">
        <a-select-option v-for="m in modules" :key="m" :value="m">{{ m }}</a-select-option>
      </a-select>
      <a-select v-model:value="query.result" placeholder="操作结果" allow-clear style="width:120px" @change="search">
        <a-select-option value="成功">成功</a-select-option>
        <a-select-option value="失败">失败</a-select-option>
      </a-select>
      <a-button type="primary" @click="search"><SearchOutlined /></a-button>
    </div>
    <a-card :bordered="false">
      <a-table :dataSource="list" :columns="columns" :pagination="pagination" :loading="loading" row-key="id" @change="handleTableChange">
        <template #bodyCell="{ column, record }">
          <template v-if="column.key === 'result'">
            <a-tag :color="record.result === '成功' ? 'green' : 'red'">{{ record.result }}</a-tag>
          </template>
          <template v-if="column.key === 'created_at'">
            {{ record.created_at?.slice(0,19).replace('T',' ') }}
          </template>
        </template>
      </a-table>
    </a-card>
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import api from '@/api'
import { SearchOutlined } from '@ant-design/icons-vue'
const authStore = useAuthStore()
const list = ref<any[]>([])
const loading = ref(false)
const modules = ['会展项目管理', '参展商管理', '观众管理', '展位管理', '签到管理', '支付管理', '消息通知', '系统管理']
const query = reactive({ keyword: '', module: undefined as string | undefined, result: undefined as string | undefined, page: 1, pageSize: 20 })
const pagination = reactive({ current: 1, pageSize: 20, total: 0, showSizeChanger: true, showTotal: (t: number) => `共 ${t} 条` })
const columns = [
  { title: '操作用户', dataIndex: 'username', width: 100 },
  { title: '操作行为', dataIndex: 'action', width: 150 },
  { title: '功能模块', dataIndex: 'module', width: 130 },
  { title: '操作对象', dataIndex: 'target_info', ellipsis: true },
  { title: 'IP地址', dataIndex: 'ip', width: 120 },
  { title: '结果', key: 'result', width: 80 },
  { title: '操作时间', key: 'created_at', width: 160 },
]
async function loadList() {
  loading.value = true
  try { const res = await api.get('/admin/audit-logs', { params: query }); list.value = res.data.data.list; pagination.total = res.data.data.total }
  finally { loading.value = false }
}
function search() { query.page = 1; pagination.current = 1; loadList() }
function handleTableChange(p: any) { query.page = p.current; query.pageSize = p.pageSize; pagination.current = p.current; loadList() }
onMounted(loadList)
</script>
