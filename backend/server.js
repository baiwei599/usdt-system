const express = require('express');
const app = express();
const WebSocket = require('ws');
const db = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

app.use(express.json());

// CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(200);
    next();
});

app.use('/static', express.static(path.join(__dirname, '../frontend/static')));

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'usdt_secret_key_2024';
const server = app.listen(PORT, () => console.log(`✅ 服务器运行在端口 ${PORT}`));

const wss = new WebSocket.Server({ server });
function push(data) {
    wss.clients.forEach(c => { if (c.readyState === 1) c.send(JSON.stringify(data)); });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const dir = path.join(__dirname, '../frontend/static/picture');
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        cb(null, dir);
    },
    filename: (req, file, cb) => cb(null, file.originalname)
});
const upload = multer({ storage });

async function getConfig() {
    try {
        const [rows] = await db.query("SELECT * FROM system_config WHERE id=1");
        return rows[0] || { auto_audit: 1, rate: 8.8, pay_method_config: 'all', min_amount: 10 };
    } catch { return { auto_audit: 1, rate: 8.8, pay_method_config: 'all', min_amount: 10 }; }
}

// 风控 - 临时绕过
async function checkAML(userId) {
    return { ok: true };
}

let currentAddressIndex = 0;
async function getNextPaymentAddress() {
    const [addresses] = await db.query("SELECT * FROM payment_addresses WHERE status=1 ORDER BY id");
    if (addresses.length === 0) return null;
    return addresses[currentAddressIndex++ % addresses.length];
}

// 创建订单
app.post('/api/order/create', async (req, res) => {
    const { userId, amount, payType, receiverName, accountNumber, bankName } = req.body;
    if (!amount || amount < 10) return res.json({ ok: false, msg: '兑换数量不能少于10 USDT' });
    
    const aml = await checkAML(userId);
    if (!aml.ok) return res.json(aml);
    
    const paymentAddress = await getNextPaymentAddress();
    if (!paymentAddress) return res.json({ ok: false, msg: '系统暂无收款地址' });
    
    const orderNo = "ORD" + Date.now() + Math.floor(Math.random() * 1000);
    
    try {
        await db.query(
            `INSERT INTO orders (order_no, amount, status, pay_type, receiver_name, account_number, bank_name, payment_address, created_at)
             VALUES (?, ?, 0, ?, ?, ?, ?, ?, NOW())`,
            [orderNo, amount, payType || 'bank', receiverName || '', accountNumber || '', bankName || '', paymentAddress.address]
        );
        await db.query(`INSERT INTO user_risk_log (user_id, action, created_at) VALUES (?, 'exchange', NOW())`, [userId]);
        push({ type: 'new_order', orderNo, amount });
        res.json({ ok: true, orderNo, amount, paymentAddress: paymentAddress.address });
    } catch (err) {
        console.error(err);
        res.json({ ok: false, msg: '订单创建失败' });
    }
});

app.get('/api/orders', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM orders ORDER BY id DESC LIMIT 50");
        res.json(rows);
    } catch { res.json([]); }
});

app.get('/api/rate', async (req, res) => {
    const config = await getConfig();
    res.json({ rate: config.rate || 8.8 });
});

app.get('/api/pay-method-config', async (req, res) => {
    const config = await getConfig();
    res.json({ pay_method_config: config.pay_method_config || 'all' });
});

app.get('/api/announcements', async (req, res) => {
    try {
        const now = new Date();
        const [rows] = await db.query(
            `SELECT * FROM announcements WHERE is_active=1 AND (start_time IS NULL OR start_time <= ?) AND (end_time IS NULL OR end_time >= ?) ORDER BY sort_order ASC, id DESC`,
            [now, now]
        );
        res.json(rows);
    } catch { res.json([]); }
});

app.get('/api/admin/images', async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM site_images ORDER BY id");
        res.json(rows);
    } catch { res.json([]); }
});

app.post('/api/admin/images/upload', upload.single('image'), async (req, res) => {
    try {
        const { image_key } = req.body;
        const file = req.file;
        if (!file) return res.json({ success: false, msg: '请选择图片' });
        const filePath = `/static/picture/${file.filename}`;
        await db.query("UPDATE site_images SET file_path = ?, file_size = ?, updated_at = NOW() WHERE image_key = ?", [filePath, file.size, image_key]);
        res.json({ success: true, msg: '图片上传成功', url: filePath });
    } catch { res.json({ success: false, msg: '上传失败' }); }
});

app.post('/api/admin/login', async (req, res) => {
    const { username, password } = req.body;
    try {
        const [users] = await db.query("SELECT * FROM admin_users WHERE username = ?", [username]);
        if (users.length === 0) return res.json({ success: false, msg: '用户不存在' });
        const user = users[0];
        const isValid = await bcrypt.compare(password, user.password);
        if (!isValid) return res.json({ success: false, msg: '密码错误' });
        const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
        await db.query("UPDATE admin_users SET last_login = NOW(), last_login_ip = ? WHERE id = ?", [req.ip, user.id]);
        res.json({ success: true, token, user: { id: user.id, username: user.username, role: user.role } });
    } catch { res.json({ success: false, msg: '登录失败' }); }
});

function verifyToken(req, res, next) {
    const token = req.headers['authorization']?.split(' ')[1];
    if (!token) return res.status(401).json({ success: false, msg: '未登录' });
    try {
        req.admin = jwt.verify(token, JWT_SECRET);
        next();
    } catch { res.status(401).json({ success: false, msg: 'Token无效' }); }
}

app.post('/api/admin/order/status', verifyToken, async (req, res) => {
    const { orderId, status } = req.body;
    try {
        await db.query("UPDATE orders SET status = ?, updated_at = NOW() WHERE id = ?", [status, orderId]);
        await db.query("INSERT INTO admin_logs (admin_id, action, ip, created_at) VALUES (?, ?, ?, NOW())", [req.admin.id, `修改订单 ${orderId} 状态为 ${status}`, req.ip]);
        push({ type: 'order_update', orderId, status });
        res.json({ success: true });
    } catch { res.json({ success: false }); }
});

app.post('/api/admin/rate', verifyToken, async (req, res) => {
    const { rate } = req.body;
    try {
        const [old] = await db.query("SELECT rate FROM system_config WHERE id=1");
        await db.query("UPDATE system_config SET rate = ? WHERE id=1", [rate]);
        await db.query("INSERT INTO rate_change_logs (old_rate, new_rate, changed_by, changed_at) VALUES (?, ?, ?, NOW())", [old[0].rate, rate, req.admin.id]);
        push({ type: 'rate_update', rate });
        res.json({ success: true });
    } catch { res.json({ success: false }); }
});

app.post('/api/admin/auto-audit', verifyToken, async (req, res) => {
    const { enabled } = req.body;
    try {
        await db.query("UPDATE system_config SET auto_audit = ? WHERE id=1", [enabled]);
        res.json({ success: true });
    } catch { res.json({ success: false }); }
});

app.post('/api/admin/pay-method', verifyToken, async (req, res) => {
    const { pay_method_config } = req.body;
    try {
        await db.query("UPDATE system_config SET pay_method_config = ? WHERE id=1", [pay_method_config]);
        res.json({ success: true });
    } catch { res.json({ success: false }); }
});

app.get('/api/admin/addresses', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query("SELECT * FROM payment_addresses ORDER BY id");
        res.json(rows);
    } catch { res.json([]); }
});

app.post('/api/admin/addresses', verifyToken, async (req, res) => {
    const { address, name } = req.body;
    try {
        await db.query("INSERT INTO payment_addresses (address, name, created_at) VALUES (?, ?, NOW())", [address, name || '未命名']);
        res.json({ success: true });
    } catch { res.json({ success: false }); }
});

app.get('/api/admin/logs', verifyToken, async (req, res) => {
    try {
        const [rows] = await db.query(`SELECT l.*, u.username FROM admin_logs l LEFT JOIN admin_users u ON l.admin_id = u.id ORDER BY l.id DESC LIMIT 100`);
        res.json(rows);
    } catch { res.json([]); }
});

app.get('/', (req, res) => res.send('USDT兑换系统 V8.1 运行中'));

const { startTronListener } = require('./tronListener');
startTronListener();

console.log("✅ 后端代码已加载");