import { Router, Response } from 'express';
import { db } from '../utils/db';
import { authMiddleware, adminOrOperator, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// 获取签到记录列表
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, type, keyword, page = 1, pageSize = 20 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (expo_id) { where += ' AND c.expo_id = ?'; params.push(expo_id); }
        if (type) { where += ' AND c.type = ?'; params.push(type); }
        if (keyword) { where += ' AND (c.name LIKE ? OR c.ticket_code LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT c.*, e.name as expo_name, u.real_name as operator_name FROM checkins c 
       LEFT JOIN expos e ON c.expo_id = e.id LEFT JOIN users u ON c.operator_id = u.id 
       ${where} ORDER BY c.checkin_time DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM checkins c ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 手动签到
router.post('/', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, type, ref_id, name, ticket_code, method, note } = req.body;
        if (!expo_id || !type || !name) {
            return res.status(400).json({ success: false, message: '会展ID、类型、姓名为必填项' });
        }
        // 若提供票码，更新观众状态
        if (ticket_code) {
            await db.query('UPDATE visitors SET status=\'已入场\' WHERE ticket_code=?', [ticket_code]);
        }
        const [result]: any = await db.query(
            `INSERT INTO checkins (expo_id, type, ref_id, name, ticket_code, method, operator_id, note) VALUES (?,?,?,?,?,?,?,?)`,
            [expo_id, type, ref_id || null, name, ticket_code || null, method || '手动', req.user!.id, note || null]
        );
        await logAudit(req, '签到操作', '签到管理', result.insertId, `${type}:${name} 签到成功`);
        res.json({ success: true, message: '签到成功', data: { id: result.insertId } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 按票码签到
router.post('/scan', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { ticket_code, expo_id } = req.body;
        if (!ticket_code) return res.status(400).json({ success: false, message: '请提供票码' });
        const [visitors]: any = await db.query(
            'SELECT v.*, e.name as expo_name FROM visitors v LEFT JOIN expos e ON v.expo_id = e.id WHERE v.ticket_code = ?',
            [ticket_code]
        );
        if (!visitors.length) return res.status(404).json({ success: false, message: '票码无效，请核查' });
        const visitor = visitors[0];
        if (visitor.status === '已入场') {
            return res.status(400).json({ success: false, message: '该票码已签到，请勿重复签到', data: visitor });
        }
        if (expo_id && visitor.expo_id !== Number(expo_id)) {
            return res.status(400).json({ success: false, message: '票码不属于该会展' });
        }
        await db.query('UPDATE visitors SET status=\'已入场\' WHERE id=?', [visitor.id]);
        const [result]: any = await db.query(
            `INSERT INTO checkins (expo_id, type, ref_id, name, ticket_code, method, operator_id) VALUES (?,?,?,?,?,?,?)`,
            [visitor.expo_id, '观众', visitor.id, visitor.real_name, ticket_code, '扫码', req.user!.id]
        );
        res.json({ success: true, message: '签到成功', data: { ...visitor, checkin_id: result.insertId } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 获取签到统计
router.get('/stats/:expo_id', async (req, res: Response) => {
    try {
        const { expo_id } = req.params;
        const [total]: any = await db.query('SELECT COUNT(*) as cnt FROM checkins WHERE expo_id=?', [expo_id]);
        const [byType]: any = await db.query('SELECT type, COUNT(*) as cnt FROM checkins WHERE expo_id=? GROUP BY type', [expo_id]);
        const [visitors]: any = await db.query('SELECT COUNT(*) as total, SUM(status=\'已入场\') as checkedin FROM visitors WHERE expo_id=?', [expo_id]);
        const [exhibitors]: any = await db.query('SELECT COUNT(*) as total FROM exhibitors WHERE expo_id=? AND status IN (\'已确认\',\'已缴费\')', [expo_id]);
        res.json({
            success: true,
            data: {
                totalCheckins: total[0].cnt,
                byType,
                visitorTotal: visitors[0].total,
                visitorCheckedIn: visitors[0].checkedin,
                exhibitorTotal: exhibitors[0].total,
            }
        });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

async function logAudit(req: AuthRequest, action: string, module: string, targetId: number, info: string) {
    try {
        await db.query(`INSERT INTO audit_logs (user_id, username, action, module, target_id, target_info, ip, result) VALUES (?,?,?,?,?,?,?,?)`,
            [req.user!.id, req.user!.username, action, module, targetId, info, req.ip || '', '成功']);
    } catch (e) { logger.error('写入审计日志失败', e); }
}

export default router;
