import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'expo_jwt_secret_key_2024';

export interface AuthRequest extends Request {
    user?: { id: number; username: string; role: string; roleId: number };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, message: '未授权，请先登录' });
    }
    const token = authHeader.split(' ')[1];
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as any;
        req.user = decoded;
        next();
    } catch {
        return res.status(401).json({ success: false, message: 'Token无效或已过期，请重新登录' });
    }
}

export function adminOnly(req: AuthRequest, res: Response, next: NextFunction) {
    if (req.user?.role !== 'admin') {
        return res.status(403).json({ success: false, message: '权限不足，仅管理员可操作' });
    }
    next();
}

export function adminOrOperator(req: AuthRequest, res: Response, next: NextFunction) {
    if (!['admin', 'operator'].includes(req.user?.role || '')) {
        return res.status(403).json({ success: false, message: '权限不足' });
    }
    next();
}
