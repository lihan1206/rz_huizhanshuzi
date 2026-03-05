import { Router, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../utils/db';
import { AuthRequest, authMiddleware } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'expo_jwt_secret_key_2024';

// 登录
router.post('/login', async (req, res: Response) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ success: false, message: '用户名和密码不能为空' });
        }
        const [rows]: any = await db.query(
            'SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.username = ?',
            [username]
        );
        if (!rows || rows.length === 0) {
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }
        const user = rows[0];
        if (user.status === 0) {
            return res.status(403).json({ success: false, message: '账号已被禁用，请联系管理员' });
        }
        const valid = await bcrypt.compare(password, user.password);
        if (!valid) {
            return res.status(401).json({ success: false, message: '用户名或密码错误' });
        }
        // 更新最后登录时间
        await db.query('UPDATE users SET last_login = NOW() WHERE id = ?', [user.id]);
        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role_name, roleId: user.role_id },
            JWT_SECRET,
            { expiresIn: '24h' }
        );
        logger.info(`用户登录: ${username}`);
        res.json({
            success: true,
            message: '登录成功',
            data: {
                token,
                user: {
                    id: user.id,
                    username: user.username,
                    realName: user.real_name,
                    email: user.email,
                    phone: user.phone,
                    role: user.role_name,
                    roleId: user.role_id,
                    avatar: user.avatar,
                }
            }
        });
    } catch (err: any) {
        logger.error('登录失败:', err);
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 获取当前用户信息
router.get('/me', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query(
            'SELECT u.id, u.username, u.real_name, u.email, u.phone, u.avatar, u.status, u.last_login, r.name as role, r.display_name as role_display FROM users u LEFT JOIN roles r ON u.role_id = r.id WHERE u.id = ?',
            [req.user!.id]
        );
        if (!rows || rows.length === 0) {
            return res.status(404).json({ success: false, message: '用户不存在' });
        }
        res.json({ success: true, data: rows[0] });
    } catch (err) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

// 修改密码
router.put('/password', authMiddleware, async (req: AuthRequest, res: Response) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const [rows]: any = await db.query('SELECT password FROM users WHERE id = ?', [req.user!.id]);
        const valid = await bcrypt.compare(oldPassword, rows[0].password);
        if (!valid) {
            return res.status(400).json({ success: false, message: '原密码错误' });
        }
        const hashed = await bcrypt.hash(newPassword, 10);
        await db.query('UPDATE users SET password = ? WHERE id = ?', [hashed, req.user!.id]);
        res.json({ success: true, message: '密码修改成功' });
    } catch (err) {
        res.status(500).json({ success: false, message: '服务器错误' });
    }
});

export default router;
