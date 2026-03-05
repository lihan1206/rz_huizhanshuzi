export interface User {
    id: number
    username: string
    realName?: string
    email?: string
    phone?: string
    role: string
    roleId: number
    avatar?: string
    status?: number
    last_login?: string
}

export interface Expo {
    id: number
    name: string
    theme?: string
    location?: string
    venue?: string
    start_date: string
    end_date: string
    scale?: number
    budget?: number
    status: '筹备中' | '进行中' | '已结束' | '已取消'
    description?: string
    category?: string
    organizer?: string
    exhibitor_count?: number
    visitor_count?: number
    booth_count?: number
    created_at: string
}

export interface Exhibitor {
    id: number
    expo_id: number
    expo_name?: string
    company_name: string
    contact_name: string
    contact_phone?: string
    contact_email?: string
    category?: string
    booth_number?: string
    status: '待审核' | '已确认' | '已拒绝' | '已缴费' | '已取消'
    products?: string
    description?: string
    contract_signed?: number
    created_at: string
}

export interface Visitor {
    id: number
    expo_id: number
    expo_name?: string
    real_name: string
    phone?: string
    email?: string
    company?: string
    position?: string
    type: '专业观众' | '普通观众'
    ticket_code?: string
    status: '已注册' | '已入场' | '已离场'
    created_at: string
}

export interface Booth {
    id: number
    expo_id: number
    expo_name?: string
    number: string
    area?: string
    zone?: string
    floor?: number
    type: '标准展位' | '特装展位' | '室外展位'
    size_sqm?: number
    price?: number
    status: '空闲' | '已预订' | '已分配' | '待布置' | '不可用'
    facilities?: string
    exhibitor_id?: number
    exhibitor_name?: string
    created_at: string
}

export interface Checkin {
    id: number
    expo_id: number
    expo_name?: string
    type: '参展商' | '观众' | '工作人员'
    name: string
    ticket_code?: string
    checkin_time: string
    method: '扫码' | '手动' | '人脸识别'
    operator_name?: string
}

export interface Payment {
    id: number
    order_no: string
    expo_id?: number
    expo_name?: string
    exhibitor_id?: number
    exhibitor_name?: string
    amount: number
    type: '展位费' | '服务费' | '押金' | '其他'
    status: '待支付' | '已支付' | '已退款' | '已取消'
    payment_method?: string
    paid_at?: string
    created_at: string
}

export interface Message {
    id: number
    title: string
    content: string
    type: string
    target_role?: string
    expo_name?: string
    sender_name?: string
    is_read: number
    created_at: string
}

export interface AuditLog {
    id: number
    username: string
    action: string
    module: string
    target_info?: string
    ip?: string
    result: '成功' | '失败'
    created_at: string
}

export interface PageResult<T> {
    list: T[]
    total: number
    page?: number
    pageSize?: number
}
