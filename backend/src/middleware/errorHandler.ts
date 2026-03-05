import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export function errorHandler(err: any, _req: Request, res: Response, _next: NextFunction) {
    logger.error(err.message || err);
    const status = err.status || 500;
    res.status(status).json({
        success: false,
        message: err.message || '服务器内部错误',
        error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    });
}
