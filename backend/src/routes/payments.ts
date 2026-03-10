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

// 支付与合同运营汇总
router.get('/summary', async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id } = req.query;
        const payWhere = expo_id ? 'WHERE p.expo_id = ?' : '';
        const payParams = expo_id ? [expo_id] : [];
        const contractWhere = expo_id ? 'WHERE c.expo_id = ?' : '';
        const contractParams = expo_id ? [expo_id] : [];

        const [paymentSummary]: any = await db.query(
            `SELECT
                COUNT(*) as total_orders,
                SUM(p.status='待支付') as pending_orders,
                SUM(p.status='已支付') as paid_orders,
                SUM(p.status='已退款') as refunded_orders,
                COALESCE(SUM(CASE WHEN p.status='已支付' THEN p.amount ELSE 0 END), 0) as paid_amount,
                COALESCE(SUM(CASE WHEN p.status='待支付' THEN p.amount ELSE 0 END), 0) as pending_amount
            FROM payments p ${payWhere}`,
            payParams
        );

        const [pendingPayments]: any = await db.query(
            `SELECT p.id, p.order_no, p.amount, p.created_at, ex.company_name as exhibitor_name, e.name as expo_name
             FROM payments p
             LEFT JOIN exhibitors ex ON p.exhibitor_id = ex.id
             LEFT JOIN expos e ON p.expo_id = e.id
             ${payWhere ? `${payWhere} AND p.status='待支付'` : 'WHERE p.status=\'待支付\''}
             ORDER BY p.created_at ASC
             LIMIT 8`,
            payParams
        );

        const [contractSummary]: any = await db.query(
            `SELECT
                COUNT(*) as total_contracts,
                SUM(c.status='待签署') as pending_contracts,
                SUM(c.status='已签署') as signed_contracts
             FROM contracts c ${contractWhere}`,
            contractParams
        );

        const [pendingContracts]: any = await db.query(
            `SELECT c.id, c.contract_no, c.title, c.created_at, ex.company_name as exhibitor_name, e.name as expo_name
             FROM contracts c
             LEFT JOIN exhibitors ex ON c.exhibitor_id = ex.id
             LEFT JOIN expos e ON c.expo_id = e.id
             ${contractWhere ? `${contractWhere} AND c.status='待签署'` : 'WHERE c.status=\'待签署\''}
             ORDER BY c.created_at ASC
             LIMIT 8`,
            contractParams
        );

        res.json({
            success: true,
            data: {
                payments: paymentSummary[0],
                contracts: contractSummary[0],
                pendingPayments,
                pendingContracts,
            }
        });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 创建订单
router.post('/', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, exhibitor_id, amount, type, payment_method, note } = req.body;
        if (!amount) return res.status(400).json({ success: false, message: '金额为必填项' });
        if (expo_id && exhibitor_id) {
            const [pendingRows]: any = await db.query(
                'SELECT id FROM payments WHERE expo_id=? AND exhibitor_id=? AND status=\'待支付\' LIMIT 1',
                [expo_id, exhibitor_id]
            );
            if (pendingRows.length) {
                return res.status(400).json({ success: false, message: '该参展商已有待支付订单，请先处理后再创建' });
            }
        }
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

// 取消订单（仅待支付）
router.patch('/:id/cancel', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query('SELECT order_no, status FROM payments WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '订单不存在' });
        if (rows[0].status !== '待支付') {
            return res.status(400).json({ success: false, message: '仅待支付订单可取消' });
        }
        await db.query('UPDATE payments SET status=\'已取消\', updated_at=NOW() WHERE id=?', [req.params.id]);
        await logAudit(req, '取消支付订单', '支付管理', Number(req.params.id), `订单${rows[0].order_no} 已取消`);
        res.json({ success: true, message: '订单已取消' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 催缴提醒
router.post('/:id/remind', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query(
            `SELECT p.id, p.order_no, p.amount, p.status, p.expo_id, ex.company_name, e.name as expo_name
             FROM payments p
             LEFT JOIN exhibitors ex ON p.exhibitor_id = ex.id
             LEFT JOIN expos e ON p.expo_id = e.id
             WHERE p.id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: '订单不存在' });
        const order = rows[0];
        if (order.status !== '待支付') {
            return res.status(400).json({ success: false, message: '仅待支付订单可发送催缴提醒' });
        }

        const title = `缴费提醒：${order.order_no}`;
        const content = `请尽快完成订单 ${order.order_no} 的缴费，金额 ¥${Number(order.amount).toLocaleString()}。参展商：${order.company_name || '未绑定'}${order.expo_name ? `，会展：${order.expo_name}` : ''}。`;
        await db.query(
            `INSERT INTO messages (title, content, type, target_role, expo_id, sender_id, is_read) VALUES (?,?,?,?,?,?,0)`,
            [title, content, '支付提醒', 'exhibitor', order.expo_id || null, req.user!.id]
        );
        await logAudit(req, '发送催缴提醒', '支付管理', Number(req.params.id), `订单${order.order_no}`);
        res.json({ success: true, message: '催缴提醒已发送' });
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
        const [contractRows]: any = await db.query('SELECT contract_no, title FROM contracts WHERE id=?', [req.params.id]);
        if (!contractRows.length) return res.status(404).json({ success: false, message: '合同不存在' });
        await db.query('UPDATE contracts SET status=\'已签署\', signed_at=NOW() WHERE id=?', [req.params.id]);
        // 更新参展商合同状态
        const [rows]: any = await db.query('SELECT exhibitor_id FROM contracts WHERE id=?', [req.params.id]);
        if (rows[0]?.exhibitor_id) {
            await db.query('UPDATE exhibitors SET contract_signed=1 WHERE id=?', [rows[0].exhibitor_id]);
        }
        await logAudit(req, '签署合同', '合同管理', Number(req.params.id), contractRows[0].contract_no || contractRows[0].title || '');
        res.json({ success: true, message: '合同签署成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 催签提醒
router.post('/contracts/:id/remind', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query(
            `SELECT c.id, c.contract_no, c.title, c.status, c.expo_id, ex.company_name, e.name as expo_name
             FROM contracts c
             LEFT JOIN exhibitors ex ON c.exhibitor_id = ex.id
             LEFT JOIN expos e ON c.expo_id = e.id
             WHERE c.id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: '合同不存在' });
        const contract = rows[0];
        if (contract.status !== '待签署') {
            return res.status(400).json({ success: false, message: '仅待签署合同可发送催签提醒' });
        }

        const title = `合同待签提醒：${contract.contract_no || contract.title}`;
        const content = `请尽快完成合同签署。合同：${contract.title || '-'}（${contract.contract_no || '无编号'}），参展商：${contract.company_name || '未绑定'}${contract.expo_name ? `，会展：${contract.expo_name}` : ''}。`;
        await db.query(
            `INSERT INTO messages (title, content, type, target_role, expo_id, sender_id, is_read) VALUES (?,?,?,?,?,?,0)`,
            [title, content, '系统通知', 'exhibitor', contract.expo_id || null, req.user!.id]
        );
        await logAudit(req, '发送催签提醒', '合同管理', Number(req.params.id), contract.contract_no || contract.title || '');
        res.json({ success: true, message: '催签提醒已发送' });
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
