-- 会展数字化综合运营管理系统 数据库初始化脚本
-- 字符集: utf8mb4

SET NAMES utf8mb4;
SET CHARACTER SET utf8mb4;
SET character_set_connection=utf8mb4;

USE expo_digital_ops;

-- 角色表
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  display_name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 用户表
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  real_name VARCHAR(100),
  email VARCHAR(200),
  phone VARCHAR(20),
  role_id INT NOT NULL DEFAULT 4,
  avatar VARCHAR(500),
  status TINYINT DEFAULT 1 COMMENT '1=启用 0=禁用',
  last_login DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 会展项目表
CREATE TABLE IF NOT EXISTS expos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  theme VARCHAR(200),
  location VARCHAR(500),
  venue VARCHAR(200),
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  scale INT COMMENT '预期规模(人次)',
  budget DECIMAL(15,2),
  status ENUM('筹备中','进行中','已结束','已取消') DEFAULT '筹备中',
  description TEXT,
  category VARCHAR(100),
  organizer VARCHAR(200),
  contact_name VARCHAR(100),
  contact_phone VARCHAR(20),
  created_by INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 参展商表
CREATE TABLE IF NOT EXISTS exhibitors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expo_id INT NOT NULL,
  company_name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(100) NOT NULL,
  contact_phone VARCHAR(20),
  contact_email VARCHAR(200),
  category VARCHAR(100),
  description TEXT,
  booth_number VARCHAR(50),
  status ENUM('待审核','已确认','已拒绝','已缴费','已取消') DEFAULT '待审核',
  products TEXT COMMENT '展品信息',
  qualifications TEXT COMMENT '资质文件路径',
  contract_signed TINYINT DEFAULT 0,
  user_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (expo_id) REFERENCES expos(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 观众表
CREATE TABLE IF NOT EXISTS visitors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expo_id INT NOT NULL,
  real_name VARCHAR(100) NOT NULL,
  id_card VARCHAR(50),
  phone VARCHAR(20),
  email VARCHAR(200),
  company VARCHAR(200),
  position VARCHAR(100),
  type ENUM('专业观众','普通观众') DEFAULT '普通观众',
  ticket_code VARCHAR(100) UNIQUE,
  ticket_qr TEXT COMMENT '二维码数据',
  status ENUM('已注册','已入场','已离场') DEFAULT '已注册',
  register_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  user_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expo_id) REFERENCES expos(id),
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 展位表
CREATE TABLE IF NOT EXISTS booths (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expo_id INT NOT NULL,
  number VARCHAR(50) NOT NULL,
  area VARCHAR(50),
  zone VARCHAR(50) COMMENT '展区',
  floor INT DEFAULT 1,
  type ENUM('标准展位','特装展位','室外展位') DEFAULT '标准展位',
  size_sqm DECIMAL(8,2) COMMENT '面积(平方米)',
  price DECIMAL(10,2),
  status ENUM('空闲','已预订','已分配','待布置','不可用') DEFAULT '空闲',
  facilities TEXT COMMENT '设施(电力/网络/etc)',
  exhibitor_id INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (expo_id) REFERENCES expos(id),
  FOREIGN KEY (exhibitor_id) REFERENCES exhibitors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 签到记录表
CREATE TABLE IF NOT EXISTS checkins (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expo_id INT NOT NULL,
  type ENUM('参展商','观众','工作人员') NOT NULL,
  ref_id INT COMMENT '关联参展商或观众ID',
  name VARCHAR(100),
  ticket_code VARCHAR(100),
  checkin_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  method ENUM('扫码','手动','人脸识别') DEFAULT '扫码',
  operator_id INT,
  note TEXT,
  FOREIGN KEY (expo_id) REFERENCES expos(id),
  FOREIGN KEY (operator_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 支付订单表
CREATE TABLE IF NOT EXISTS payments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  order_no VARCHAR(100) UNIQUE NOT NULL,
  expo_id INT,
  exhibitor_id INT,
  amount DECIMAL(10,2) NOT NULL,
  type ENUM('展位费','服务费','押金','其他') DEFAULT '展位费',
  status ENUM('待支付','已支付','已退款','已取消') DEFAULT '待支付',
  payment_method ENUM('支付宝','微信','银联','线下') DEFAULT '线下',
  paid_at DATETIME,
  invoice_no VARCHAR(100),
  note TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (expo_id) REFERENCES expos(id),
  FOREIGN KEY (exhibitor_id) REFERENCES exhibitors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 合同表
CREATE TABLE IF NOT EXISTS contracts (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expo_id INT,
  exhibitor_id INT,
  contract_no VARCHAR(100) UNIQUE,
  title VARCHAR(200),
  file_path VARCHAR(500),
  status ENUM('待签署','已签署','已废止') DEFAULT '待签署',
  signed_at DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expo_id) REFERENCES expos(id),
  FOREIGN KEY (exhibitor_id) REFERENCES exhibitors(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 消息通知表
CREATE TABLE IF NOT EXISTS messages (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  type ENUM('系统通知','参展提醒','支付提醒','展位调整','其他') DEFAULT '系统通知',
  target_role VARCHAR(50) COMMENT '目标角色,NULL=全部',
  expo_id INT,
  sender_id INT,
  is_read TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (sender_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 操作日志表
CREATE TABLE IF NOT EXISTS audit_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  username VARCHAR(100),
  action VARCHAR(200) NOT NULL,
  module VARCHAR(100),
  target_id INT,
  target_info VARCHAR(500),
  ip VARCHAR(50),
  result ENUM('成功','失败') DEFAULT '成功',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ===== 种子数据 =====

-- 插入角色
INSERT INTO roles (name, display_name, description) VALUES
('admin', '系统管理员', '拥有所有权限'),
('operator', '运营人员', '负责日常运营管理'),
('exhibitor', '参展商', '参展企业代表'),
('visitor', '观众', '参观访客');

-- 插入用户 (密码均为 123456, bcrypt hash)
INSERT INTO users (username, password, real_name, email, phone, role_id, status) VALUES
('admin', '$2b$10$O.KL72G8M67JSczklk80bOI/7FfBCvewDsonhiwmIq26arKIPbxhq', '系统管理员', 'admin@expo.com', '13800138000', 1, 1),
('operator1', '$2b$10$O.KL72G8M67JSczklk80bOI/7FfBCvewDsonhiwmIq26arKIPbxhq', '王运营', 'operator1@expo.com', '13900139001', 2, 1),
('operator2', '$2b$10$O.KL72G8M67JSczklk80bOI/7FfBCvewDsonhiwmIq26arKIPbxhq', '李运营', 'operator2@expo.com', '13900139002', 2, 1),
('exhibitor1', '$2b$10$O.KL72G8M67JSczklk80bOI/7FfBCvewDsonhiwmIq26arKIPbxhq', '张明华', 'exhibitor1@company.com', '13700137001', 3, 1),
('exhibitor2', '$2b$10$O.KL72G8M67JSczklk80bOI/7FfBCvewDsonhiwmIq26arKIPbxhq', '李静雯', 'exhibitor2@company.com', '13700137002', 3, 1),
('exhibitor3', '$2b$10$O.KL72G8M67JSczklk80bOI/7FfBCvewDsonhiwmIq26arKIPbxhq', '陈建国', 'exhibitor3@company.com', '13700137003', 3, 1),
('visitor1', '$2b$10$O.KL72G8M67JSczklk80bOI/7FfBCvewDsonhiwmIq26arKIPbxhq', '刘小明', 'visitor1@mail.com', '13600136001', 4, 1),
('visitor2', '$2b$10$O.KL72G8M67JSczklk80bOI/7FfBCvewDsonhiwmIq26arKIPbxhq', '赵丽华', 'visitor2@mail.com', '13600136002', 4, 1);

-- 插入会展项目
INSERT INTO expos (name, theme, location, venue, start_date, end_date, scale, budget, status, description, category, organizer, contact_name, contact_phone, created_by) VALUES
('2024年春季国际智能制造展览会', '智能制造·赋能未来', '上海市浦东新区', '上海国家会展中心', '2024-03-15', '2024-03-18', 50000, 5000000.00, '已结束', '聚焦智能制造领域最新技术与产品，汇聚全球500+品牌参展', '制造业', '上海国际展览有限公司', '张总监', '021-12345678', 1),
('2024年夏季消费电子博览会', '科技改变生活', '北京市朝阳区', '北京国家会议中心', '2024-07-20', '2024-07-23', 80000, 8000000.00, '已结束', '展示最前沿的消费电子产品，涵盖智能家居、穿戴设备、AR/VR等领域', '消费电子', '北京国际会展科技有限公司', '李总监', '010-87654321', 1),
('2025年医疗健康产业博览会', '健康中国·科技助力', '广州市天河区', '广州国际会展中心', '2025-04-10', '2025-04-13', 60000, 6000000.00, '进行中', '聚集医疗器械、健康食品、医药科技等领域的全产业链展览', '医疗健康', '广州国际医疗展览有限公司', '王总监', '020-11112222', 1),
('2025年新能源汽车展览会', '绿色出行·智慧未来', '深圳市福田区', '深圳会展中心(新馆)', '2025-06-05', '2025-06-08', 40000, 4500000.00, '筹备中', '聚焦新能源汽车整车、零部件、充电设施等领域的年度盛会', '汽车', '深圳新能源汽车协会', '刘总监', '0755-33334444', 1),
('2025年秋季食品饮料展览会', '美食汇聚·共享繁荣', '成都市高新区', '成都世纪城新国际会展中心', '2025-09-18', '2025-09-21', 35000, 3000000.00, '筹备中', '展示国内外优质食品饮料产品，促进行业交流合作', '食品饮料', '成都国际博览中心', '陈总监', '028-55556666', 1);

-- 插入参展商
INSERT INTO exhibitors (expo_id, company_name, contact_name, contact_phone, contact_email, category, description, booth_number, status, products, user_id) VALUES
(1, '华为技术有限公司', '张明华', '13700137001', 'zhangmh@huawei.com', '智能装备', '全球领先的ICT基础设施和智能终端提供商', 'A-001', '已缴费', '工业互联网平台、智能制造解决方案、MES系统', 4),
(1, '富士康科技集团', '李静雯', '13700137002', 'lijw@foxconn.com', '精密制造', '全球最大电子产品代工厂，专注精密制造', 'A-005', '已确认', '精密零部件、自动化产线、智能仓储系统', 5),
(1, '三一重工股份有限公司', '陈建国', '13700137003', 'chenjg@sany.com', '工程机械', '全球工程机械领军企业', 'B-003', '已缴费', '智能挖掘机、起重机、混凝土泵车', 6),
(2, '小米科技有限责任公司', '王晓明', '13811234567', 'wangxm@xiaomi.com', '消费电子', '智能手机及智能家居生态链企业', 'C-001', '已缴费', '小米手机、智能家居、可穿戴设备', NULL),
(2, '大疆创新科技有限公司', '赵丽', '13911234567', 'zhaoli@dji.com', '无人机', '全球无人机行业领导者', 'C-010', '已缴费', '消费级无人机、专业航拍设备', NULL),
(3, '迈瑞医疗国际有限公司', '孙伟', '13601234567', 'sunwei@mindray.com', '医疗器械', '全球领先的医疗器械供应商', 'D-001', '已确认', '监护仪、超声诊断、体外诊断产品', NULL),
(3, '九安医疗电子股份有限公司', '周红', '13501234567', 'zhouhong@9med.cn', '医疗电子', '专注医疗电子产品20年', 'D-008', '待审核', '血压计、血糖仪、健康管理设备', NULL),
(4, '比亚迪股份有限公司', '吴强', '13401234567', 'wuqiang@byd.com', '整车制造', '全球新能源汽车领导品牌', 'E-001', '待审核', '纯电动轿车、插电混动车、储能系统', NULL);

-- 插入观众
INSERT INTO visitors (expo_id, real_name, id_card, phone, email, company, position, type, ticket_code, status) VALUES
(1, '刘小明', '310101199001011234', '13600136001', 'liuxm@gmail.com', '上海某科技有限公司', '技术总监', '专业观众', 'EXPO2024S-001', '已入场'),
(1, '赵丽华', '310101199002022345', '13600136002', 'yueli@gmail.com', '北京某投资集团', '投资经理', '专业观众', 'EXPO2024S-002', '已入场'),
(1, '孙海涛', '310101199003033456', '13600136003', 'sunht@outlook.com', '个人', '工程师', '普通观众', 'EXPO2024S-003', '已离场'),
(2, '钱志远', '110101199001014567', '13600136004', 'qianzhy@163.com', '深圳某电子有限公司', '采购经理', '专业观众', 'EXPO2024X-001', '已入场'),
(2, '冯晓燕', '110101199002025678', '13600136005', 'fengxy@sina.com', '广州某贸易有限公司', '业务总监', '专业观众', 'EXPO2024X-002', '已注册'),
(3, '褚海峰', '440101199001016789', '13600136006', 'zhuhf@qq.com', '北京某医疗集团', '院长', '专业观众', 'EXPO2025Y-001', '已入场'),
(3, '卫小婷', '440101199002027890', '13600136007', 'weixt@163.com', '个人', '护士', '普通观众', 'EXPO2025Y-002', '已注册'),
(3, '蒋明远', '440101199003038901', '13600136008', 'jiangmy@gmail.com', '广州某药业有限公司', '研发总监', '专业观众', 'EXPO2025Y-003', '已入场');

-- 插入展位
INSERT INTO booths (expo_id, number, area, zone, floor, type, size_sqm, price, status, facilities, exhibitor_id) VALUES
(1, 'A-001', '100平米', 'A区', 1, '特装展位', 100.00, 80000.00, '已分配', '电力/网络/空调', 1),
(1, 'A-002', '36平米', 'A区', 1, '标准展位', 36.00, 18000.00, '空闲', '电力/网络', NULL),
(1, 'A-003', '36平米', 'A区', 1, '标准展位', 36.00, 18000.00, '空闲', '电力/网络', NULL),
(1, 'A-004', '54平米', 'A区', 1, '标准展位', 54.00, 27000.00, '待布置', '电力/网络/空调', NULL),
(1, 'A-005', '72平米', 'A区', 1, '特装展位', 72.00, 60000.00, '已分配', '电力/网络/空调', 2),
(1, 'B-001', '36平米', 'B区', 1, '标准展位', 36.00, 16000.00, '空闲', '电力/网络', NULL),
(1, 'B-002', '36平米', 'B区', 1, '标准展位', 36.00, 16000.00, '已预订', '电力/网络', NULL),
(1, 'B-003', '120平米', 'B区', 1, '特装展位', 120.00, 96000.00, '已分配', '电力/网络/空调/消防', 3),
(3, 'D-001', '80平米', 'D区', 1, '特装展位', 80.00, 64000.00, '已分配', '电力/网络/空调', 6),
(3, 'D-008', '36平米', 'D区', 1, '标准展位', 36.00, 20000.00, '已预订', '电力/网络', 7);

-- 插入签到记录
INSERT INTO checkins (expo_id, type, ref_id, name, ticket_code, checkin_time, method, operator_id) VALUES
(1, '参展商', 1, '华为技术有限公司', NULL, '2024-03-14 08:30:00', '手动', 2),
(1, '参展商', 3, '三一重工股份有限公司', NULL, '2024-03-14 09:15:00', '扫码', 2),
(1, '观众', 1, '刘小明', 'EXPO2024S-001', '2024-03-15 09:02:00', '扫码', 2),
(1, '观众', 2, '赵丽华', 'EXPO2024S-002', '2024-03-15 09:18:00', '扫码', 2),
(1, '观众', 3, '孙海涛', 'EXPO2024S-003', '2024-03-15 10:30:00', '扫码', 2),
(3, '参展商', 6, '迈瑞医疗国际有限公司', NULL, '2025-04-09 14:00:00', '手动', 3),
(3, '观众', 6, '褚海峰', 'EXPO2025Y-001', '2025-04-10 08:45:00', '扫码', 3),
(3, '观众', 8, '蒋明远', 'EXPO2025Y-003', '2025-04-10 09:30:00', '扫码', 3);

-- 插入支付记录
INSERT INTO payments (order_no, expo_id, exhibitor_id, amount, type, status, payment_method, paid_at) VALUES
('PAY2024031501', 1, 1, 80000.00, '展位费', '已支付', '银联', '2024-02-20 10:00:00'),
('PAY2024031502', 1, 3, 96000.00, '展位费', '已支付', '线下', '2024-02-22 14:00:00'),
('PAY2024031503', 1, 2, 60000.00, '展位费', '待支付', '微信', NULL),
('PAY2025040901', 3, 6, 64000.00, '展位费', '已支付', '银联', '2025-03-15 11:00:00'),
('PAY2025040902', 3, 7, 20000.00, '展位费', '待支付', '支付宝', NULL);

-- 插入合同
INSERT INTO contracts (expo_id, exhibitor_id, contract_no, title, status, signed_at) VALUES
(1, 1, 'CTR-2024-001', '华为技术有限公司参展合同', '已签署', '2024-02-18 10:00:00'),
(1, 3, 'CTR-2024-002', '三一重工参展合同', '已签署', '2024-02-20 11:00:00'),
(1, 2, 'CTR-2024-003', '富士康科技参展合同', '待签署', NULL),
(3, 6, 'CTR-2025-001', '迈瑞医疗参展合同', '已签署', '2025-03-10 14:00:00');

-- 插入消息通知
INSERT INTO messages (title, content, type, target_role, expo_id, sender_id, is_read) VALUES
('欢迎参加2025年医疗健康产业博览会', '尊敬的参展商，感谢您参加本次博览会，请务必于展前一天完成布展工作。展会期间如有问题请联系现场工作人员。', '系统通知', 'exhibitor', 3, 1, 0),
('展位布置规范通知', '各参展商敬请注意：展位搭建须遵守安全规范，禁止使用易燃材料。详情请查阅附件展位规范手册。', '参展提醒', 'exhibitor', 3, 1, 0),
('缴费提醒 - 展位费', '您有未支付的展位费订单，请于5个工作日内完成支付，逾期将自动取消预订。', '支付提醒', 'exhibitor', 3, 1, 1),
('2025年博览会开幕式通知', '定于2025年4月10日上午9:00举行开幕仪式，欢迎所有参展商及嘉宾出席。', '系统通知', NULL, 3, 1, 0),
('系统维护公告', '系统将于今晚22:00-23:00进行例行维护，期间服务暂时不可用，请提前做好相关工作安排。', '系统通知', NULL, NULL, 1, 0);

-- 插入操作日志
INSERT INTO audit_logs (user_id, username, action, module, target_info, ip, result) VALUES
(1, 'admin', '创建会展项目', '会展项目管理', '2025年医疗健康产业博览会', '192.168.1.1', '成功'),
(1, 'admin', '审核参展商', '参展商管理', '迈瑞医疗国际有限公司 - 审核通过', '192.168.1.1', '成功'),
(2, 'operator1', '分配展位', '展位管理', '展位D-001分配给迈瑞医疗', '192.168.1.2', '成功'),
(1, 'admin', '发送系统通知', '消息通知', '全员通知:2025年博览会开幕式通知', '192.168.1.1', '成功'),
(2, 'operator1', '观众签到', '签到管理', '观众褚海峰 签到成功', '192.168.1.2', '成功'),
(3, 'operator2', '创建支付订单', '支付管理', '订单PAY2025040902 金额:20000元', '192.168.1.3', '成功'),
(1, 'admin', '更新系统配置', '系统管理', '修改会展日期配置', '192.168.1.1', '成功');
