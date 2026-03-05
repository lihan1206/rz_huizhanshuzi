import { Router, Response } from 'express';
import { db } from '../utils/db';
import { authMiddleware, adminOrOperator, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// 获取消息列表
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { type, is_read, page = 1, pageSize = 10 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (type) { where += ' AND m.type = ?'; params.push(type); }
        if (is_read !== undefined && is_read !== '') { where += ' AND m.is_read = ?'; params.push(is_read); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT m.*, u.real_name as sender_name, e.name as expo_name FROM messages m 
       LEFT JOIN users u ON m.sender_id = u.id LEFT JOIN expos e ON m.expo_id = e.id 
       ${where} ORDER BY m.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM messages m ${where}`, params);
        const [unread]: any = await db.query('SELECT COUNT(*) as cnt FROM messages WHERE is_read=0');
        res.json({ success: true, data: { list: rows, total: total[0].cnt, unread: unread[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 发送消息
router.post('/', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { title, content, type, target_role, expo_id } = req.body;
        if (!title || !content) return res.status(400).json({ success: false, message: '标题和内容为必填项' });
        const [result]: any = await db.query(
            `INSERT INTO messages (title, content, type, target_role, expo_id, sender_id, is_read) VALUES (?,?,?,?,?,?,0)`,
            [title, content, type || '系统通知', target_role || null, expo_id || null, req.user!.id]
        );
        await logAudit(req, '发送消息通知', '消息通知', result.insertId, `通知:${title}`);
        res.json({ success: true, message: '发送成功', data: { id: result.insertId } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 标记已读
router.patch('/:id/read', async (req: AuthRequest, res: Response) => {
    try {
        await db.query('UPDATE messages SET is_read=1 WHERE id=?', [req.params.id]);
        res.json({ success: true, message: '已标记为已读' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 全部标为已读
router.patch('/read-all', async (_req: AuthRequest, res: Response) => {
    try {
        await db.query('UPDATE messages SET is_read=1 WHERE is_read=0');
        res.json({ success: true, message: '全部标记为已读' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 删除消息
router.delete('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query('SELECT title FROM messages WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '消息不存在' });
        await db.query('DELETE FROM messages WHERE id=?', [req.params.id]);
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
