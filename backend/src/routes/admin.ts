import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import { db } from '../utils/db';
import { authMiddleware, adminOnly, adminOrOperator, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// 用户管理 —— 仅管理员
// 获取用户列表
router.get('/users', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { keyword, role_id, status, page = 1, pageSize = 10 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (keyword) { where += ' AND (u.username LIKE ? OR u.real_name LIKE ? OR u.email LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`, `%${keyword}%`); }
        if (role_id) { where += ' AND u.role_id = ?'; params.push(role_id); }
        if (status !== undefined && status !== '') { where += ' AND u.status = ?'; params.push(status); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT u.id, u.username, u.real_name, u.email, u.phone, u.role_id, u.status, u.last_login, u.created_at, r.display_name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id ${where} ORDER BY u.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM users u ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 创建用户
router.post('/users', adminOnly, async (req: AuthRequest, res: Response) => {
    try {
        const { username, password, real_name, email, phone, role_id } = req.body;
        if (!username || !password) return res.status(400).json({ success: false, message: '用户名和密码为必填项' });
        const [exist]: any = await db.query('SELECT id FROM users WHERE username=?', [username]);
        if (exist.length) return res.status(400).json({ success: false, message: '用户名已存在' });
        const hashed = await bcrypt.hash(password, 10);
        const [result]: any = await db.query(
            `INSERT INTO users (username, password, real_name, email, phone, role_id, status) VALUES (?,?,?,?,?,?,1)`,
            [username, hashed, real_name || null, email || null, phone || null, role_id || 4]
        );
        await logAudit(req, '创建用户', '系统管理', result.insertId, username);
        res.json({ success: true, message: '创建成功', data: { id: result.insertId } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 更新用户
router.put('/users/:id', adminOnly, async (req: AuthRequest, res: Response) => {
    try {
        const { real_name, email, phone, role_id, status } = req.body;
        await db.query(
            'UPDATE users SET real_name=?, email=?, phone=?, role_id=?, status=?, updated_at=NOW() WHERE id=?',
            [real_name, email, phone, role_id, status, req.params.id]
        );
        await logAudit(req, '更新用户信息', '系统管理', Number(req.params.id), `用户ID:${req.params.id}`);
        res.json({ success: true, message: '更新成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 重置密码
router.patch('/users/:id/reset-password', adminOnly, async (req: AuthRequest, res: Response) => {
    try {
        const newPass = req.body.password || '123456';
        const hashed = await bcrypt.hash(newPass, 10);
        await db.query('UPDATE users SET password=? WHERE id=?', [hashed, req.params.id]);
        await logAudit(req, '重置用户密码', '系统管理', Number(req.params.id), `用户ID:${req.params.id}`);
        res.json({ success: true, message: `密码已重置为: ${newPass}` });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 删除用户
router.delete('/users/:id', adminOnly, async (req: AuthRequest, res: Response) => {
    try {
        if (req.params.id === '1') return res.status(400).json({ success: false, message: '不能删除超级管理员账号' });
        const [rows]: any = await db.query('SELECT username FROM users WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '用户不存在' });
        await db.query('DELETE FROM users WHERE id=?', [req.params.id]);
        await logAudit(req, '删除用户', '系统管理', Number(req.params.id), rows[0].username);
        res.json({ success: true, message: '删除成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 获取角色列表
router.get('/roles', async (_req, res: Response) => {
    try {
        const [rows]: any = await db.query('SELECT * FROM roles ORDER BY id');
        res.json({ success: true, data: rows });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 获取操作日志
router.get('/audit-logs', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { keyword, module, result: result_filter, page = 1, pageSize = 20 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (keyword) { where += ' AND (a.action LIKE ? OR a.username LIKE ?)'; params.push(`%${keyword}%`, `%${keyword}%`); }
        if (module) { where += ' AND a.module = ?'; params.push(module); }
        if (result_filter) { where += ' AND a.result = ?'; params.push(result_filter); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT * FROM audit_logs a ${where} ORDER BY a.created_at DESC LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM audit_logs a ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

async function logAudit(req: AuthRequest, action: string, module: string, targetId: number, info: string) {
    try {
        await db.query(`INSERT INTO audit_logs (user_id, username, action, module, target_id, target_info, ip, result) VALUES (?,?,?,?,?,?,?,?)`,
            [req.user!.id, req.user!.username, action, module, targetId, info, req.ip || '', '成功']);
    } catch (e) { logger.error('写入审计日志失败', e); }
}

export default router;
