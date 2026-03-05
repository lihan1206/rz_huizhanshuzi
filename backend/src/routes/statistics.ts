import { Router, Response } from 'express';
import { db } from '../utils/db';
import { authMiddleware, AuthRequest } from '../middleware/auth';

const router = Router();
router.use(authMiddleware);

// 获取仪表盘统计
router.get('/dashboard', async (_req: AuthRequest, res: Response) => {
    try {
        const [expoStats]: any = await db.query(`
      SELECT 
        COUNT(*) as total,
        SUM(status='筹备中') as preparing,
        SUM(status='进行中') as ongoing,
        SUM(status='已结束') as ended,
        SUM(status='已取消') as cancelled
      FROM expos
    `);
        const [exhibitorStats]: any = await db.query(`
      SELECT COUNT(*) as total,
        SUM(status='待审核') as pending,
        SUM(status='已确认') as confirmed,
        SUM(status='已缴费') as paid,
        SUM(status='已拒绝') as rejected
      FROM exhibitors
    `);
        const [visitorStats]: any = await db.query(`
      SELECT COUNT(*) as total,
        SUM(status='已注册') as registered,
        SUM(status='已入场') as checkedin,
        SUM(type='专业观众') as professional,
        SUM(type='普通观众') as general
      FROM visitors
    `);
        const [boothStats]: any = await db.query(`
      SELECT COUNT(*) as total,
        SUM(status='空闲') as free,
        SUM(status='已分配') as assigned,
        SUM(status='已预订') as reserved
      FROM booths
    `);
        const [paymentStats]: any = await db.query(`
      SELECT COUNT(*) as total,
        COALESCE(SUM(CASE WHEN status='已支付' THEN amount ELSE 0 END),0) as paid_amount,
        COALESCE(SUM(CASE WHEN status='待支付' THEN amount ELSE 0 END),0) as pending_amount
      FROM payments
    `);
        // 近6个月观众注册趋势
        const [visitorTrend]: any = await db.query(`
      SELECT DATE_FORMAT(created_at, '%Y-%m') as month, COUNT(*) as cnt
      FROM visitors 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 6 MONTH)
      GROUP BY month ORDER BY month
    `);
        // 各会展参展商数量
        const [expoExhibitors]: any = await db.query(`
      SELECT e.name, COUNT(ex.id) as exhibitor_count
      FROM expos e LEFT JOIN exhibitors ex ON e.id = ex.expo_id
      GROUP BY e.id, e.name ORDER BY exhibitor_count DESC LIMIT 5
    `);
        // 展位类型分布
        const [boothTypes]: any = await db.query(`
      SELECT type, COUNT(*) as cnt FROM booths GROUP BY type
    `);
        // 最新签到记录
        const [recentCheckins]: any = await db.query(`
      SELECT c.*, e.name as expo_name FROM checkins c 
      LEFT JOIN expos e ON c.expo_id = e.id 
      ORDER BY c.checkin_time DESC LIMIT 5
    `);
        // 消息未读数
        const [unreadMsg]: any = await db.query(`SELECT COUNT(*) as cnt FROM messages WHERE is_read=0`);

        res.json({
            success: true,
            data: {
                expos: expoStats[0],
                exhibitors: exhibitorStats[0],
                visitors: visitorStats[0],
                booths: boothStats[0],
                payments: paymentStats[0],
                trends: { visitorTrend, expoExhibitors, boothTypes },
                recentCheckins,
                unreadMessages: unreadMsg[0].cnt,
            }
        });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 按会展维度统计
router.get('/expo/:id', async (req, res: Response) => {
    try {
        const { id } = req.params;
        const [expo]: any = await db.query('SELECT * FROM expos WHERE id=?', [id]);
        if (!expo.length) return res.status(404).json({ success: false, message: '会展不存在' });
        const [visitors]: any = await db.query(`SELECT COUNT(*) as total, SUM(status='已入场') as checkedin FROM visitors WHERE expo_id=?`, [id]);
        const [exhibitors]: any = await db.query(`SELECT COUNT(*) as total, SUM(status='已缴费') as paid FROM exhibitors WHERE expo_id=?`, [id]);
        const [booths]: any = await db.query(`SELECT COUNT(*) as total, SUM(status='已分配') as assigned, SUM(status='空闲') as free FROM booths WHERE expo_id=?`, [id]);
        const [payments]: any = await db.query(`SELECT COALESCE(SUM(CASE WHEN status='已支付' THEN amount ELSE 0 END),0) as revenue FROM payments WHERE expo_id=?`, [id]);
        const [checkinByDay]: any = await db.query(`
      SELECT DATE(checkin_time) as day, COUNT(*) as cnt FROM checkins WHERE expo_id=?
      GROUP BY day ORDER BY day`, [id]);
        res.json({ success: true, data: { expo: expo[0], visitors: visitors[0], exhibitors: exhibitors[0], booths: booths[0], payments: payments[0], checkinByDay } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

export default router;
