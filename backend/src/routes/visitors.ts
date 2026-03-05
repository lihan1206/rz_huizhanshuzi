import { Router, Response } from 'express';
import { db } from '../utils/db';
import { authMiddleware, adminOrOperator, AuthRequest } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// 获取观众列表
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, type, status, keyword, page = 1, pageSize = 10 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (expo_id) { where += ' AND v.expo_id = ?'; params.push(expo_id); }
        if (type) { where += ' AND v.type = ?'; params.push(type); }
        if (status) { where += ' AND v.status = ?'; params.push(status); }
        if (keyword) { where += ' AND (v.real_name LIKE ? OR v.phone LIKE ? OR v.company LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT v.*, e.name as expo_name FROM visitors v LEFT JOIN expos e ON v.expo_id = e.id ${where} ORDER BY v.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM visitors v ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 获取单个观众
router.get('/:id', async (req, res: Response) => {
    try {
        const [rows]: any = await db.query(
            'SELECT v.*, e.name as expo_name FROM visitors v LEFT JOIN expos e ON v.expo_id = e.id WHERE v.id = ?',
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: '观众不存在' });
        res.json({ success: true, data: rows[0] });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 注册观众
router.post('/', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, real_name, id_card, phone, email, company, position, type } = req.body;
        if (!expo_id || !real_name) {
            return res.status(400).json({ success: false, message: '会展ID和姓名为必填项' });
        }
        const ticketCode = `EXPO-${expo_id}-${uuidv4().slice(0, 8).toUpperCase()}`;
        const [result]: any = await db.query(
            `INSERT INTO visitors (expo_id, real_name, id_card, phone, email, company, position, type, ticket_code, status) VALUES (?,?,?,?,?,?,?,?,?,'已注册')`,
            [expo_id, real_name, id_card, phone, email, company, position, type || '普通观众', ticketCode]
        );
        await logAudit(req, '注册观众', '观众管理', result.insertId, real_name);
        res.json({ success: true, message: '注册成功', data: { id: result.insertId, ticketCode } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 更新观众
router.put('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { real_name, phone, email, company, position, type, status } = req.body;
        await db.query(
            'UPDATE visitors SET real_name=?, phone=?, email=?, company=?, position=?, type=?, status=? WHERE id=?',
            [real_name, phone, email, company, position, type, status, req.params.id]
        );
        res.json({ success: true, message: '更新成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 删除观众
router.delete('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query('SELECT real_name FROM visitors WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '观众不存在' });
        await db.query('DELETE FROM visitors WHERE id=?', [req.params.id]);
        await logAudit(req, '删除观众', '观众管理', Number(req.params.id), rows[0].real_name);
        res.json({ success: true, message: '删除成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 按票码查询
router.get('/ticket/:code', async (req, res: Response) => {
    try {
        const [rows]: any = await db.query(
            'SELECT v.*, e.name as expo_name FROM visitors v LEFT JOIN expos e ON v.expo_id = e.id WHERE v.ticket_code = ?',
            [req.params.code]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: '票码无效' });
        res.json({ success: true, data: rows[0] });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

async function logAudit(req: AuthRequest, action: string, module: string, targetId: number, info: string) {
    try {
        await db.query(`INSERT INTO audit_logs (user_id, username, action, module, target_id, target_info, ip, result) VALUES (?,?,?,?,?,?,?,?)`,
            [req.user!.id, req.user!.username, action, module, targetId, info, req.ip || '', '成功']);
    } catch (e) { logger.error('写入审计日志失败', e); }
}

export default router;
