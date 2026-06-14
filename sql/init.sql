-- 创建系统配置表
CREATE TABLE IF NOT EXISTS system_config (
    id INT PRIMARY KEY DEFAULT 1,
    auto_settle INT DEFAULT 0,
    auto_audit INT DEFAULT 1,
    rate DECIMAL(10,4) DEFAULT 8.8000,
    pay_method_config VARCHAR(20) DEFAULT 'all',
    min_amount DECIMAL(10,2) DEFAULT 10,
    trc20_address VARCHAR(100)
);

-- 创建订单表
CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_no VARCHAR(50) UNIQUE NOT NULL,
    amount DECIMAL(20,6),
    status INT DEFAULT 0 COMMENT '0:待支付 1:已支付 2:已完成 3:已取消',
    pay_type VARCHAR(20),
    receiver_name VARCHAR(100),
    account_number VARCHAR(100),
    bank_name VARCHAR(100),
    payment_address VARCHAR(100),
    tx_hash VARCHAR(100),
    created_at DATETIME,
    updated_at DATETIME
);

-- 创建风控日志表
CREATE TABLE IF NOT EXISTS user_risk_log (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id VARCHAR(50),
    action VARCHAR(20),
    ip_address VARCHAR(50),
    created_at DATETIME
);

-- 创建管理员用户表
CREATE TABLE IF NOT EXISTS admin_users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    role ENUM('master', 'sub') DEFAULT 'sub',
    whitelist_ips TEXT,
    permissions TEXT,
    created_at DATETIME DEFAULT NOW(),
    last_login DATETIME,
    last_login_ip VARCHAR(50)
);

-- 创建管理员操作日志表
CREATE TABLE IF NOT EXISTS admin_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    admin_id INT,
    action VARCHAR(255),
    ip VARCHAR(50),
    created_at DATETIME DEFAULT NOW()
);

-- 创建收款地址池表
CREATE TABLE IF NOT EXISTS payment_addresses (
    id INT AUTO_INCREMENT PRIMARY KEY,
    address VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(50),
    status TINYINT DEFAULT 1,
    total_received DECIMAL(20,6) DEFAULT 0,
    total_orders INT DEFAULT 0,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME
);

-- 创建公告表
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type ENUM('info', 'warning', 'success', 'error') DEFAULT 'info',
    is_active TINYINT DEFAULT 1,
    sort_order INT DEFAULT 0,
    start_time DATETIME,
    end_time DATETIME,
    created_by INT,
    created_at DATETIME DEFAULT NOW(),
    updated_at DATETIME
);

-- 创建汇率变更日志表
CREATE TABLE IF NOT EXISTS rate_change_logs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    old_rate DECIMAL(10,4),
    new_rate DECIMAL(10,4),
    changed_by INT,
    changed_at DATETIME DEFAULT NOW()
);

-- 创建网站图片配置表
CREATE TABLE IF NOT EXISTS site_images (
    id INT AUTO_INCREMENT PRIMARY KEY,
    image_key VARCHAR(50) UNIQUE NOT NULL,
    image_name VARCHAR(100),
    file_path VARCHAR(255),
    file_size INT DEFAULT 0,
    updated_at DATETIME DEFAULT NOW()
);

-- 插入默认图片配置
INSERT INTO site_images (image_key, image_name, file_path) VALUES 
('logo', '网站Logo', '/static/picture/logo.png'),
('qianbao', '钱包图标', '/static/picture/qianbao.png'),
('bb', '汇率图标', '/static/picture/bb.png'),
('trx_usdt', 'USDT图标', '/static/picture/trx-usdt.png'),
('cn', 'CNY图标', '/static/picture/cn.png'),
('yhk', '银行卡图标', '/static/picture/yhk.png'),
('zfb', '支付宝图标', '/static/picture/zfb.png')
ON DUPLICATE KEY UPDATE image_key=image_key;

-- 插入默认主账号（密码: admin123）
INSERT INTO admin_users (username, password, role) VALUES ('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMy.Mqr5e5qJq5qJq5qJq5qJq5qJq5qJq', 'master')
ON DUPLICATE KEY UPDATE username=username;

-- 插入默认配置
INSERT INTO system_config (id, auto_settle, auto_audit, rate, pay_method_config, min_amount) 
VALUES (1, 0, 1, 8.8000, 'all', 10)
ON DUPLICATE KEY UPDATE id=id;

-- 插入示例收款地址（请替换为真实地址）
INSERT INTO payment_addresses (address, name, status) VALUES 
('TExample1xxxxxxxxxxxxxxxxxxxxxxxxxx', '主收款地址1', 1),
('TExample2xxxxxxxxxxxxxxxxxxxxxxxxxx', '备用地址2', 1)
ON DUPLICATE KEY UPDATE address=address;