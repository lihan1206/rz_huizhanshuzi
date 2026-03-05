import { Router, Response } from 'express';
import { db } from '../utils/db';
import { authMiddleware, adminOrOperator, AuthRequest } from '../middleware/auth';
import { logger } from '../utils/logger';

const router = Router();
router.use(authMiddleware);

// 获取展位列表
router.get('/', async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, status, type, zone, page = 1, pageSize = 20 } = req.query;
        let where = 'WHERE 1=1';
        const params: any[] = [];
        if (expo_id) { where += ' AND b.expo_id = ?'; params.push(expo_id); }
        if (status) { where += ' AND b.status = ?'; params.push(status); }
        if (type) { where += ' AND b.type = ?'; params.push(type); }
        if (zone) { where += ' AND b.zone = ?'; params.push(zone); }
        const offset = (Number(page) - 1) * Number(pageSize);
        const [rows]: any = await db.query(
            `SELECT b.*, e.name as expo_name, ex.company_name as exhibitor_name FROM booths b 
       LEFT JOIN expos e ON b.expo_id = e.id 
       LEFT JOIN exhibitors ex ON b.exhibitor_id = ex.id 
       ${where} ORDER BY b.zone, b.number LIMIT ? OFFSET ?`,
            [...params, Number(pageSize), offset]
        );
        const [total]: any = await db.query(`SELECT COUNT(*) as cnt FROM booths b ${where}`, params);
        res.json({ success: true, data: { list: rows, total: total[0].cnt } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 获取单个展位
router.get('/:id', async (req, res: Response) => {
    try {
        const [rows]: any = await db.query(
            `SELECT b.*, e.name as expo_name, ex.company_name as exhibitor_name FROM booths b 
       LEFT JOIN expos e ON b.expo_id = e.id LEFT JOIN exhibitors ex ON b.exhibitor_id = ex.id WHERE b.id = ?`,
            [req.params.id]
        );
        if (!rows.length) return res.status(404).json({ success: false, message: '展位不存在' });
        res.json({ success: true, data: rows[0] });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 创建展位
router.post('/', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { expo_id, number, area, zone, floor, type, size_sqm, price, facilities } = req.body;
        if (!expo_id || !number) {
            return res.status(400).json({ success: false, message: '会展ID和展位编号为必填项' });
        }
        const [result]: any = await db.query(
            `INSERT INTO booths (expo_id, number, area, zone, floor, type, size_sqm, price, status, facilities) VALUES (?,?,?,?,?,?,?,?,'空闲',?)`,
            [expo_id, number, area, zone, floor || 1, type || '标准展位', size_sqm, price, facilities]
        );
        await logAudit(req, '创建展位', '展位管理', result.insertId, `展位${number}`);
        res.json({ success: true, message: '创建成功', data: { id: result.insertId } });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 更新展位
router.put('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { number, area, zone, floor, type, size_sqm, price, status, facilities } = req.body;
        await db.query(
            'UPDATE booths SET number=?, area=?, zone=?, floor=?, type=?, size_sqm=?, price=?, status=?, facilities=?, updated_at=NOW() WHERE id=?',
            [number, area, zone, floor, type, size_sqm, price, status, facilities, req.params.id]
        );
        await logAudit(req, '更新展位', '展位管理', Number(req.params.id), `展位${number}`);
        res.json({ success: true, message: '更新成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 分配展位给参展商
router.patch('/:id/assign', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const { exhibitor_id } = req.body;
        const [booth]: any = await db.query('SELECT * FROM booths WHERE id=?', [req.params.id]);
        if (!booth.length) return res.status(404).json({ success: false, message: '展位不存在' });
        if (booth[0].status === '已分配') {
            return res.status(400).json({ success: false, message: '展位已被分配，请先取消分配' });
        }
        await db.query('UPDATE booths SET exhibitor_id=?, status=\'已分配\', updated_at=NOW() WHERE id=?', [exhibitor_id, req.params.id]);
        await db.query('UPDATE exhibitors SET booth_number=? WHERE id=?', [booth[0].number, exhibitor_id]);
        const [ex]: any = await db.query('SELECT company_name FROM exhibitors WHERE id=?', [exhibitor_id]);
        await logAudit(req, '分配展位', '展位管理', Number(req.params.id), `展位${booth[0].number}分配给${ex[0]?.company_name}`);
        res.json({ success: true, message: '分配成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 取消分配
router.patch('/:id/unassign', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [booth]: any = await db.query('SELECT * FROM booths WHERE id=?', [req.params.id]);
        if (!booth.length) return res.status(404).json({ success: false, message: '展位不存在' });
        if (booth[0].exhibitor_id) {
            await db.query('UPDATE exhibitors SET booth_number=NULL WHERE id=?', [booth[0].exhibitor_id]);
        }
        await db.query('UPDATE booths SET exhibitor_id=NULL, status=\'空闲\', updated_at=NOW() WHERE id=?', [req.params.id]);
        await logAudit(req, '取消展位分配', '展位管理', Number(req.params.id), `展位${booth[0].number}`);
        res.json({ success: true, message: '取消分配成功' });
    } catch (err: any) { res.status(500).json({ success: false, message: err.message }); }
});

// 删除展位
router.delete('/:id', adminOrOperator, async (req: AuthRequest, res: Response) => {
    try {
        const [rows]: any = await db.query('SELECT number FROM booths WHERE id=?', [req.params.id]);
        if (!rows.length) return res.status(404).json({ success: false, message: '展位不存在' });
        await db.query('DELETE FROM booths WHERE id=?', [req.params.id]);
        await logAudit(req, '删除展位', '展位管理', Number(req.params.id), `展位${rows[0].number}`);
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
