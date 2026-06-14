const db = require('./db');

// TRC20 USDT 合约地址（主网）
const USDT_CONTRACT = 'TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t';

// 模拟 TRC20 监听（生产环境需接入 TronGrid API）
async function startTronListener() {
    console.log('🔍 TRC20 监听服务已启动（模拟模式）');
    
    // 每30秒扫描一次
    setInterval(async () => {
        try {
            const config = await getSystemConfig();
            if (config.auto_audit !== 1) return;
            
            // 获取所有启用的收款地址
            const [addresses] = await db.query("SELECT address FROM payment_addresses WHERE status=1");
            if (addresses.length === 0) return;
            
            // 模拟检测到转账（生产环境替换为真实API调用）
            // 这里演示逻辑，实际需要调用 TronGrid API
            await checkPendingOrders(addresses.map(a => a.address));
            
        } catch (err) {
            console.error('TRC20 监听错误:', err);
        }
    }, 30000);
}

async function getSystemConfig() {
    try {
        const [rows] = await db.query("SELECT * FROM system_config WHERE id=1");
        return rows[0] || { auto_audit: 1 };
    } catch (err) {
        return { auto_audit: 1 };
    }
}

async function checkPendingOrders(addresses) {
    // 获取待支付订单
    const [orders] = await db.query(
        "SELECT id, order_no, amount, payment_address FROM orders WHERE status=0 AND payment_address IS NOT NULL"
    );
    
    for (const order of orders) {
        // 模拟检查该地址是否有新转账（生产环境需调用TronGrid）
        // 这里演示自动完成逻辑
        if (addresses.includes(order.payment_address)) {
            // 模拟检测到转账
            await db.query(
                "UPDATE orders SET status=2, updated_at=NOW() WHERE id=?",
                [order.id]
            );
            console.log(`✅ 订单 ${order.order_no} 自动对账完成`);
            
            // WebSocket 推送（需要通过全局 push 函数）
            // 这里简化处理
        }
    }
}

module.exports = { startTronListener };