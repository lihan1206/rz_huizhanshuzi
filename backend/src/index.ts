import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { logger } from './utils/logger';
import { errorHandler } from './middleware/errorHandler';
import authRoutes from './routes/auth';
import exposRoutes from './routes/expos';
import exhibitorsRoutes from './routes/exhibitors';
import visitorsRoutes from './routes/visitors';
import boothsRoutes from './routes/booths';
import checkinRoutes from './routes/checkin';
import statisticsRoutes from './routes/statistics';
import paymentsRoutes from './routes/payments';
import messagesRoutes from './routes/messages';
import adminRoutes from './routes/admin';

const app = express();
const PORT = process.env.PORT || 8000;

app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// 使用 morgan 日志，通过 winston 输出
app.use(morgan('combined', {
    stream: { write: (msg: string) => logger.info(msg.trim()) }
}));

// 路由
app.use('/api/auth', authRoutes);
app.use('/api/expos', exposRoutes);
app.use('/api/exhibitors', exhibitorsRoutes);
app.use('/api/visitors', visitorsRoutes);
app.use('/api/booths', boothsRoutes);
app.use('/api/checkin', checkinRoutes);
app.use('/api/statistics', statisticsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/messages', messagesRoutes);
app.use('/api/admin', adminRoutes);

// 健康检查
app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString(), service: '会展数字化综合运营管理系统' });
});

// 错误处理
app.use(errorHandler);

app.listen(PORT, () => {
    logger.info(`服务器启动成功，端口: ${PORT}`);
});

export default app;
