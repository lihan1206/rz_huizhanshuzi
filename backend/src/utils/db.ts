import mysql from 'mysql2/promise';
import { logger } from './logger';

function createPool() {
    const dbUrl = process.env.DATABASE_URL;
    if (dbUrl) {
        try {
            const url = new URL(dbUrl);
            return mysql.createPool({
                host: url.hostname,
                port: parseInt(url.port || '3306'),
                user: url.username,
                password: url.password,
                database: url.pathname.slice(1),
                charset: 'utf8mb4',
                waitForConnections: true,
                connectionLimit: 10,
                queueLimit: 0,
                connectTimeout: 30000,
            });
        } catch (err) {
            logger.error('DATABASE_URL 解析失败，使用默认配置');
        }
    }
    return mysql.createPool({
        host: process.env.DB_HOST || 'db',
        port: parseInt(process.env.DB_PORT || '3306'),
        user: process.env.DB_USER || 'expo_user',
        password: process.env.DB_PASSWORD || 'expo_pass123',
        database: process.env.DB_NAME || 'expo_digital_ops',
        charset: 'utf8mb4',
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        connectTimeout: 30000,
    });
}

export const db = createPool();

// 测试连接（启动时验证）
db.getConnection()
    .then(conn => { conn.release(); logger.info('数据库连接成功'); })
    .catch(err => logger.error('数据库连接失败:', err));

export default db;
