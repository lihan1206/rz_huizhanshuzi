import { Router, Response } from 'express';
import { db } from '../utils/db';
import { authMiddleware, adminOrOperator, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// 获取支付订单列表
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, status, keyword, page = 1, pageSize = 10 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (expo_id) { where += ' AND p.expo_id = ?'; params.push(expo_id); }
        if (status) { where += ' AND p.status = ?'; params.push(status); }
        if (keyword) { where += ' AND (p.order_no LIKE ? OR ex.company_name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT p.*, e.name as expo_name, ex.company_name as exhibitor_name FROM payments p 
       LEFT JOIN expos e ON p.expo_id = e.id LEFT JOIN exhibitors ex ON p.exhibitor_id = ex.id 
       ${where} ORDER BY p.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM payments p LEFT JOIN exhibitors ex ON p.exhibitor_id = ex.id ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 创建订单
router.post('/', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, exhibitor_id, amount, type, payment_method, note } = req.body;
        if (!amount) return res.status(400).json({ success: false, message: '金额为必填项' });
        const orderNo = `PAY${Date.now()}${uuidv4().slice(0, 6).toUpperCase()}`;
        const [result]: any = await db.query(
            `INSERT INTO payments (order_no, expo_id, exhibitor_id, amount, type, status, payment_method, note) VALUES (?,?,?,?,?,?,?,?)`,
            [orderNo, expo_id || null, exhibitor_id || null, amount, type || '展位费', '待支付', payment_method || '线下', note || null]
        );
        await logAudit(req, '创建支付订单', '支付管理', result.insertId, `订单${orderNo} 金额:${amount}元`);
        res.json({ success: true, message: '创建成功', data: { id: result.insertId, orderNo } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 更新支付状态
router.patch('/:id/pay', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { payment_method, invoice_no } = req.body;
        const [rows]: any = await db.query('SELECT order_no, exhibitor_id FROM payments WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '订单不存在' });
        await db.query('UPDATE payments SET status=\'已支付\', payment_method=?, invoice_no=?, paid_at=NOW(), updated_at=NOW() WHERE id=?',
            [payment_method || '线下', invoice_no || null, req.params.id]);
        // 若关联参展商，更新其状态为已缴费
        if (rows[0].exhibitor_id) {
            await db.query('UPDATE exhibitors SET status=\'已缴费\', updated_at=NOW() WHERE id=? AND status=\'已确认\'', [rows[0].exhibitor_id]);
        }
        await logAudit(req, '确认支付', '支付管理', Number(req.params.id), `订单${rows[0].order_no} 支付成功`);
        res.json({ success: true, message: '支付确认成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 退款
router.patch('/:id/refund', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query('SELECT order_no FROM payments WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '订单不存在' });
        await db.query('UPDATE payments SET status=\'已退款\', updated_at=NOW() WHERE id=?', [req.params.id]);
        await logAudit(req, '订单退款', '支付管理', Number(req.params.id), `订单${rows[0].order_no} 已退款`);
        res.json({ success: true, message: '退款成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 获取合同列表
router.get('/contracts', async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, status, page = 1, pageSize = 10 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (expo_id) { where += ' AND c.expo_id = ?'; params.push(expo_id); }
        if (status) { where += ' AND c.status = ?'; params.push(status); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT c.*, e.name as expo_name, ex.company_name as exhibitor_name FROM contracts c 
       LEFT JOIN expos e ON c.expo_id = e.id LEFT JOIN exhibitors ex ON c.exhibitor_id = ex.id 
       ${where} ORDER BY c.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM contracts c ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 创建合同
router.post('/contracts', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, exhibitor_id, title } = req.body;
        const contractNo = `CTR-${new Date().getFullYear()}-${uuidv4().slice(0, 6).toUpperCase()}`;
        const [result]: any = await db.query(
            `INSERT INTO contracts (expo_id, exhibitor_id, contract_no, title, status) VALUES (?,?,?,?,'待签署')`,
            [expo_id || null, exhibitor_id || null, contractNo, title]
        );
        res.json({ success: true, message: '合同创建成功', data: { id: result.insertId, contractNo } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 签署合同
router.patch('/contracts/:id/sign', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        await db.query('UPDATE contracts SET status=\'已签署\', signed_at=NOW() WHERE id=?', [req.params.id]);
        // 更新参展商合同状态
        const [rows]: any = await db.query('SELECT exhibitor_id FROM contracts WHERE id=?', [req.params.id]);
        if (rows[0]?.exhibitor_id) {
            await db.query('UPDATE exhibitors SET contract_signed=1 WHERE id=?', [rows[0].exhibitor_id]);
        }
        res.json({ success: true, message: '合同签署成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 删除订单
router.delete('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        await db.query('DELETE FROM payments WHERE id=?', [req.params.id]);
        res.json({ success: true, message: '删除成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

async function logAudit(req: AuthRequest, action: string, module: string, targetId: number, info: string) {
    try {
        await db.query(`INSERT INTO audit_logs (user_id, username, action, module, target_id, target_info, ip, result) VALUES (?,?,?,?,?,?,?,?)`,
            [req.user!.id, req.user!.username, action, module, targetId, info, req.ip || '', '成功']);
    } catch (e) { logger.error('写入审计日志失败', e); }
}

export default router;
