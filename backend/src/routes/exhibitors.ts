import { Router, Response } from 'express';
import { db } from '../utils/db';
import { authMiddleware, adminOrOperator, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// 获取参展商列表
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, status, keyword, page = 1, pageSize = 10 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (expo_id) { where += ' AND ex.expo_id = ?'; params.push(expo_id); }
        if (status) { where += ' AND ex.status = ?'; params.push(status); }
        if (keyword) { where += ' AND (ex.company_name LIKE ? OR ex.contact_name LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT ex.*, e.name as expo_name FROM exhibitors ex LEFT JOIN expos e ON ex.expo_id = e.id ${where} ORDER BY ex.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM exhibitors ex ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 获取单个参展商
router.get('/:id', async (_req, res: Response) => {
    try {
        const [rows]: any = await db.query(
            `SELECT ex.*, e.name as expo_name FROM exhibitors ex LEFT JOIN expos e ON ex.expo_id = e.id WHERE ex.id = ?`,
            [_req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: '参展商不存在' });
        res.json({ success: true, data: rows[0] });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 创建参展商
router.post('/', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, company_name, contact_name, contact_phone, contact_email, category, description, products, user_id } = req.body;
        if (!expo_id || !company_name || !contact_name) {
            return res.status(400).json({ success: false, message: '会展ID、公司名称、联系人为必填项' });
        }
        const [result]: any = await db.query(
            `INSERT INTO exhibitors (expo_id, company_name, contact_name, contact_phone, contact_email, category, description, products, status, user_id) VALUES (?,?,?,?,?,?,?,?,'待审核',?)`,
            [expo_id, company_name, contact_name, contact_phone, contact_email, category, description, products, user_id || null]
        );
        await logAudit(req, '新增参展商', '参展商管理', result.insertId, company_name);
        res.json({ success: true, message: '创建成功', data: { id: result.insertId } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 更新参展商
router.put('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { company_name, contact_name, contact_phone, contact_email, category, description, products, status, booth_number } = req.body;
        await db.query(
            `UPDATE exhibitors SET company_name=?, contact_name=?, contact_phone=?, contact_email=?, category=?, description=?, products=?, status=?, booth_number=?, updated_at=NOW() WHERE id=?`,
            [company_name, contact_name, contact_phone, contact_email, category, description, products, status, booth_number, req.params.id]
        );
        await logAudit(req, '更新参展商信息', '参展商管理', Number(req.params.id), company_name);
        res.json({ success: true, message: '更新成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 审核参展商
router.patch('/:id/review', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { status, reason } = req.body;
        if (!['已确认', '已拒绝'].includes(status)) {
            return res.status(400).json({ success: false, message: '无效的审核状态' });
        }
        await db.query('UPDATE exhibitors SET status=?, updated_at=NOW() WHERE id=?', [status, req.params.id]);
        const [rows]: any = await db.query('SELECT company_name FROM exhibitors WHERE id=?', [req.params.id]);
        await logAudit(req, `审核参展商-${status}`, '参展商管理', Number(req.params.id), rows[0]?.company_name + (reason ? ` 原因:${reason}` : ''));
        res.json({ success: true, message: `审核${status}` });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 删除参展商
router.delete('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query('SELECT company_name FROM exhibitors WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '参展商不存在' });
        await db.query('DELETE FROM exhibitors WHERE id=?', [req.params.id]);
        await logAudit(req, '删除参展商', '参展商管理', Number(req.params.id), rows[0].company_name);
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
