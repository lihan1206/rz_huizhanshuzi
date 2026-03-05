import { Router, Response } from 'express';
import { db } from '../utils/db';
import { authMiddleware, adminOrOperator, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// 获取会展列表
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { status, keyword, page = 1, pageSize = 10 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (status) { where += ' AND e.status = ?'; params.push(status); }
        if (keyword) { where += ' AND (e.name LIKE ? OR e.location LIKE ? OR e.theme LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT e.*, u.real_name as creator_name,
        (SELECT COUNT(*) FROM exhibitors WHERE expo_id = e.id) as exhibitor_count,
        (SELECT COUNT(*) FROM visitors WHERE expo_id = e.id) as visitor_count,
        (SELECT COUNT(*) FROM booths WHERE expo_id = e.id) as booth_count
       FROM expos e LEFT JOIN users u ON e.created_by = u.id ${where} ORDER BY e.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM expos e ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt, page: Number(page), pageSize: Number(pageSize) } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 获取单个会展
router.get('/:id', async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query(
            `SELECT e.*, u.real_name as creator_name FROM expos e LEFT JOIN users u ON e.created_by = u.id WHERE e.id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: '会展项目不存在' });
        res.json({ success: true, data: rows[0] });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 创建会展
router.post('/', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { name, theme, location, venue, start_date, end_date, scale, budget, status, description, category, organizer, contact_name, contact_phone } = req.body;
        if (!name || !start_date || !end_date) {
            return res.status(400).json({ success: false, message: '名称、开始日期、结束日期为必填项' });
        }
        const [result]: any = await db.query(
            `INSERT INTO expos (name, theme, location, venue, start_date, end_date, scale, budget, status, description, category, organizer, contact_name, contact_phone, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
            [name, theme, location, venue, start_date, end_date, scale, budget, status || '筹备中', description, category, organizer, contact_name, contact_phone, req.user!.id]
        );
        await logAudit(req, '创建会展项目', '会展项目管理', result.insertId, name);
        res.json({ success: true, message: '创建成功', data: { id: result.insertId } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 更新会展
router.put('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { name, theme, location, venue, start_date, end_date, scale, budget, status, description, category, organizer, contact_name, contact_phone } = req.body;
        await db.query(
            `UPDATE expos SET name=?, theme=?, location=?, venue=?, start_date=?, end_date=?, scale=?, budget=?, status=?, description=?, category=?, organizer=?, contact_name=?, contact_phone=?, updated_at=NOW() WHERE id=?`,
            [name, theme, location, venue, start_date, end_date, scale, budget, status, description, category, organizer, contact_name, contact_phone, req.params.id]
        );
        await logAudit(req, '编辑会展项目', '会展项目管理', Number(req.params.id), name);
        res.json({ success: true, message: '更新成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 删除会展
router.delete('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query('SELECT name FROM expos WHERE id = ?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '会展项目不存在' });
        await db.query('DELETE FROM expos WHERE id = ?', [req.params.id]);
        await logAudit(req, '删除会展项目', '会展项目管理', Number(req.params.id), rows[0].name);
        res.json({ success: true, message: '删除成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

async function logAudit(req: AuthRequest, action: string, module: string, targetId: number, info: string) {
    try {
        await db.query(
            `INSERT INTO audit_logs (user_id, username, action, module, target_id, target_info, ip, result) VALUES (?,?,?,?,?,?,?,?)`,
            [req.user!.id, req.user!.username, action, module, targetId, info, req.ip || '', '成功']
        );
    } catch (e) { logger.error('写入审计日志失败', e); }
}

export default router;
