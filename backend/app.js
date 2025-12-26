// 引入所有依赖（只定义一次，避免重复）
const express = require('express');
const mysql = require('mysql2');
const path = require('path'); // 路径处理模块
const app = express();
const port = 3000;

const frontendPath = path.join(__dirname, '../frontend');

// ========== 原有核心配置（保留所有功能） ==========
// 1. JSON解析中间件（必须，post接口拿数据）
app.use(express.json()); 

// 2. 静态文件托管（改用绝对路径，修复路径问题）
app.use(express.static(frontendPath));

// 3. 完整的跨域配置（修复跨域问题）
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS, PUT, PATCH, DELETE');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// 4. MySQL 连接配置（保留）
const db = mysql.createConnection({
  host: 'localhost',    
  user: 'root',         
  password: '12345678', 
  database: 'test_db'   
});

// 5. MySQL 连接 + 创建表（保留，补充 frequent_passengers 表）
db.connect((err) => {
  if (err) {
    console.error('MySQL连接失败：', err);
    return;
  }
  console.log('✅ MySQL连接成功！');
  // 创建 user 表
  const createUserTableSql = `
    CREATE TABLE IF NOT EXISTS user (
      id INT AUTO_INCREMENT PRIMARY KEY,
      username VARCHAR(50) NOT NULL UNIQUE,
      password VARCHAR(100) NOT NULL,
      phone VARCHAR(20) DEFAULT '',
      id_card VARCHAR(18) DEFAULT ''
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  db.query(createUserTableSql, (err) => {
    if (err) {
      console.error('❌ 创建user表失败：', err);
      return;
    }
    console.log('✅ user表创建成功！');
  });

  // 创建 orders 表（保存订单信息）
  const createOrdersTableSql = `
    CREATE TABLE IF NOT EXISTS orders (
      id INT AUTO_INCREMENT PRIMARY KEY,
      order_no VARCHAR(64) NOT NULL UNIQUE,
      user_id INT DEFAULT NULL,
      start_city VARCHAR(100) NOT NULL,
      end_city VARCHAR(100) NOT NULL,
      train_no VARCHAR(50) DEFAULT '',
      price DECIMAL(10,2) DEFAULT 0.00,
      depart_time VARCHAR(50) DEFAULT '',
      seat_type VARCHAR(50) DEFAULT '',
      status VARCHAR(30) DEFAULT 'pending',
      payment_binding_id INT DEFAULT NULL,
      payment_method VARCHAR(64) DEFAULT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;

  db.query(createOrdersTableSql, (err2) => {
    if (err2) {
      console.error('❌ 创建orders表失败：', err2);
      return;
    }
    console.log('✅ orders表创建成功');
  });

  // 创建 payment_bindings 表（存储用户绑定的支付方式）
  const createPaymentBindingsTableSql = `
    CREATE TABLE IF NOT EXISTS payment_bindings (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      user_id BIGINT UNSIGNED NOT NULL,
      method VARCHAR(32) NOT NULL,
      provider VARCHAR(64) DEFAULT NULL,
      account VARCHAR(128) NOT NULL,
      masked_account VARCHAR(64) DEFAULT NULL,
      external_id VARCHAR(128) DEFAULT NULL,
      metadata TEXT DEFAULT NULL,
      is_default TINYINT(1) NOT NULL DEFAULT 0,
      is_active TINYINT(1) NOT NULL DEFAULT 1,
      last_used_at DATETIME DEFAULT NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_user_method (user_id, method),
      INDEX idx_external_id (external_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  db.query(createPaymentBindingsTableSql, (errpb) => {
    if (errpb) {
      console.error('❌ 创建 payment_bindings 表失败：', errpb);
      return;
    }
    console.log('✅ payment_bindings 表创建成功');
  });

  // 补充创建 frequent_passengers 表（修复查询时报错问题）
  const createFrequentPassengersTableSql = `
    CREATE TABLE IF NOT EXISTS frequent_passengers (
      id INT AUTO_INCREMENT PRIMARY KEY,
      creator_user_id INT NOT NULL,
      creator_username VARCHAR(50) DEFAULT '',
      creator_phone VARCHAR(20) DEFAULT '',
      creator_id_card VARCHAR(18) DEFAULT '',
      passenger_name VARCHAR(50) NOT NULL,
      passenger_id_card VARCHAR(18) NOT NULL,
      passenger_phone VARCHAR(20) DEFAULT '',
      passenger_type VARCHAR(20) DEFAULT 'adult',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_creator (creator_user_id)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `;
  db.query(createFrequentPassengersTableSql, (errfp) => {
    if (errfp) {
      console.error('❌ 创建 frequent_passengers 表失败：', errfp);
      return;
    }
    console.log('✅ frequent_passengers 表创建成功');
  });
});

// 生成 10 位唯一订单号（数字），若冲突会重试若干次
function generateUniqueOrderNo(attempts, cb) {
  attempts = attempts || 5;
  const candidate = String(Math.floor(Math.random() * 1e10)).padStart(10, '0');
  db.query('SELECT 1 FROM orders WHERE order_no = ?', [candidate], (err, rows) => {
    if (err) return cb(err);
    if (rows && rows.length > 0) {
      if (attempts <= 0) return cb(new Error('无法生成唯一订单号'));
      return setImmediate(() => generateUniqueOrderNo(attempts - 1, cb));
    }
    cb(null, candidate);
  });
}

// ========== 原有接口（全部保留，修复语法错误） ==========
// 查询用户列表接口
app.get('/api/users', (req, res) => {
  db.query('SELECT * FROM user', (err, results) => {
    if (err) {
      res.status(500).send('查询失败：' + err);
      return;
    }
    res.json(results);
  });
});

// 查询单个用户信息（按 id）
app.get('/api/user/:id', (req, res) => {
  const userId = req.params.id;
  db.query('SELECT id, username, phone, id_card FROM user WHERE id = ?', [userId], (err, rows) => {
    if (err) return res.status(500).json({ code: -1, msg: '查询失败：' + err.message });
    if (!rows || rows.length === 0) return res.status(404).json({ code: -1, msg: '未找到用户' });
    res.json({ code: 0, data: rows[0] });
  });
});

// 更新用户信息（用户名或密码）
app.post('/api/user/update', (req, res) => {
  const { userId, username, password } = req.body;
  if (!userId) return res.json({ code: -1, msg: '缺少 userId' });

  const fields = [];
  const params = [];
  if (username !== undefined) {
    fields.push('username = ?');
    params.push(username);
  }
  if (password !== undefined) {
    fields.push('password = ?');
    params.push(password);
  }
  if (fields.length === 0) return res.json({ code: -1, msg: '没有要更新的字段' });

  params.push(userId);
  const sql = `UPDATE user SET ${fields.join(', ')} WHERE id = ?`;
  db.query(sql, params, (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') return res.json({ code: -1, msg: '用户名已存在' });
      return res.json({ code: -1, msg: '更新失败：' + err.message });
    }
    // 返回最新用户信息
    db.query('SELECT id, username, phone, id_card FROM user WHERE id = ?', [userId], (err2, rows) => {
      if (err2) return res.json({ code: -1, msg: '查询失败：' + err2.message });
      if (!rows || rows.length === 0) return res.json({ code: -1, msg: '未找到用户' });
      res.json({ code: 0, msg: '更新成功', data: rows[0] });
    });
  });
});

// 注册接口
app.post('/api/register', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ code: -1, msg: '用户名和密码不能为空！' });
  }

  const insertSql = `INSERT INTO user (username, password) VALUES (?, ?)`;
  db.query(insertSql, [username, password], (err, result) => {
    if (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return res.json({ code: -1, msg: '用户名已存在，请更换！' });
      }
      return res.json({ code: -1, msg: '注册失败：' + err.message });
    }
    res.json({ code: 0, msg: '注册成功！', data: { userId: result.insertId } });
  });
});

// 登录接口
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.json({ code: -1, msg: '用户名和密码不能为空！' });
  }

  const selectSql = `SELECT id, username FROM user WHERE username = ? AND password = ?`;
  db.query(selectSql, [username, password], (err, results) => {
    if (err) {
      return res.json({ code: -1, msg: '登录失败：' + err.message });
    }
    if (results.length === 0) {
      return res.json({ code: -1, msg: '用户名或密码错误！' });
    }
    res.json({
      code: 0,
      msg: '登录成功！',
      data: {
        userId: results[0].id,
        username: results[0].username
      }
    });
  });
});

// 身份认证接口：保存手机号和身份证号到 user 表（通过 userId 更新）
app.post('/api/verify', (req, res) => {
  const { userId, phone, id_card } = req.body;

  if (!userId) {
    return res.json({ code: -1, msg: '缺少 userId 参数' });
  }

  const updateSql = `UPDATE user SET phone = ?, id_card = ? WHERE id = ?`;
  db.query(updateSql, [phone || '', id_card || '', userId], (err, result) => {
    if (err) {
      return res.json({ code: -1, msg: '保存失败：' + err.message });
    }

    // 返回更新后的用户信息
    db.query('SELECT id, username, phone, id_card FROM user WHERE id = ?', [userId], (err2, rows) => {
      if (err2) {
        return res.json({ code: -1, msg: '查询失败：' + err2.message });
      }
      if (!rows || rows.length === 0) {
        return res.json({ code: -1, msg: '未找到用户' });
      }
      res.json({ code: 0, msg: '认证信息已保存', data: rows[0] });
    });
  });
});

// 创建订单接口：保存订单到 orders 表（修复原错误嵌套的逻辑）
app.post('/api/orders', (req, res) => {
  const { userId, start_city, end_city, train_no, price, depart_time, seat_type, status, payment_binding_id, payment_method } = req.body;
  
  // 校验必填字段
  if (!start_city || !end_city) {
    return res.json({ code: -1, msg: '出发地和目的地不能为空' });
  }

  // 生成 10 位唯一订单号后插入订单
  generateUniqueOrderNo(5, (genErr, orderNo) => {
    if (genErr) return res.json({ code: -1, msg: '生成订单号失败：' + genErr.message });
    
    const insertSql = `INSERT INTO orders (order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status, payment_binding_id, payment_method) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    
    // 如果前端传入了 payment_binding_id，则验证该绑定属于 userId 且处于激活状态
    const doInsert = () => {
      db.query(insertSql, [orderNo, userId || null, start_city, end_city, train_no || '', price || 0, depart_time || '', seat_type || '', status || 'pending', payment_binding_id || null, payment_method || null], (err, result) => {
        if (err) {
          return res.json({ code: -1, msg: '创建订单失败：' + err.message });
        }
        // 返回新订单信息（含生成的 order_no 和 id）
        const selectSql = 'SELECT id, order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status, payment_binding_id, payment_method, created_at FROM orders WHERE id = ?';
        db.query(selectSql, [result.insertId], (err2, rows) => {
          if (err2) return res.json({ code: -1, msg: '查询新订单失败：' + err2.message });
          res.json({ code: 0, msg: '订单创建成功', data: rows[0] });
        });
      });
    };

    if (payment_binding_id && userId) {
      db.query('SELECT id, user_id, method, is_active FROM payment_bindings WHERE id = ? LIMIT 1', [payment_binding_id], (errBind, rowsBind) => {
        if (errBind) return res.json({ code: -1, msg: '验证支付绑定失败：' + errBind.message });
        if (!rowsBind || rowsBind.length === 0) return res.json({ code: -1, msg: '未找到指定的支付绑定' });
        const bind = rowsBind[0];
        if (Number(bind.user_id) !== Number(userId)) return res.json({ code: -1, msg: '支付绑定不属于当前用户' });
        if (!bind.is_active) return res.json({ code: -1, msg: '支付绑定已被停用' });
        // 覆盖 payment_method 为绑定记录的 method（以数据库为准）
        payment_method = bind.method || payment_method;
        doInsert();
      });
    } else {
      doInsert();
    }
  });
});

// 查询订单接口：支持按 userId 过滤（修复 GET 接口获取参数方式）
app.get('/api/orders', (req, res) => {
  // GET 接口参数从 req.query 获取，而非 req.body
  const { userId } = req.query;
  let sql = 'SELECT id, order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status, payment_binding_id, payment_method, created_at FROM orders';
  const params = [];
  
  if (userId) {
    sql += ' WHERE user_id = ?';
    params.push(userId);
  }
  sql += ' ORDER BY created_at DESC';

  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ code: -1, msg: '查询订单失败：' + err.message });
    res.json({ code: 0, data: results });
  });
});

// ===== 支付绑定相关接口 =====
// 查询绑定（按 userId 过滤）
app.get('/api/payment_bindings', (req, res) => {
  const userId = req.query.userId;
  let sql = 'SELECT id, user_id, method, provider, account, masked_account, external_id, metadata, is_default, is_active, last_used_at, created_at, updated_at FROM payment_bindings';
  const params = [];
  if (userId) {
    sql += ' WHERE user_id = ? ORDER BY is_default DESC, created_at DESC';
    params.push(userId);
  } else {
    sql += ' ORDER BY created_at DESC';
  }
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ code: -1, msg: '查询支付绑定失败：' + err.message });
    res.json({ code: 0, data: results });
  });
});

// 创建绑定
app.post('/api/payment_bindings', (req, res) => {
  // 支持前端同时传 user_id 或 userId
  let { user_id, userId, method, provider, account, masked_account, external_id, metadata, is_default } = req.body || {};
  const uid = (user_id !== undefined) ? user_id : userId;
  const numericUserId = Number(uid) || uid; 
  if (!numericUserId || !method || !account) return res.json({ code: -1, msg: '缺少 user_id/method/account' });

  const insertSql = `INSERT INTO payment_bindings (user_id, method, provider, account, masked_account, external_id, metadata, is_default) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
  const metadataVal = (metadata && typeof metadata === 'object') ? JSON.stringify(metadata) : (metadata || null);
  db.query(insertSql, [numericUserId, method, provider || null, account, masked_account || null, external_id || null, metadataVal, is_default ? 1 : 0], (err, result) => {
    if (err) {
      console.error('创建支付绑定 SQL 错误：', err, 'payload:', { user_id: numericUserId, method, account });
      return res.json({ code: -1, msg: '创建支付绑定失败：' + err.message });
    }
    db.query('SELECT id, user_id, method, provider, account, masked_account, external_id, metadata, is_default, is_active, last_used_at, created_at, updated_at FROM payment_bindings WHERE id = ?', [result.insertId], (err2, rows) => {
      if (err2) {
        console.error('查询新绑定失败：', err2);
        return res.json({ code: -1, msg: '查询新绑定失败：' + err2.message });
      }
      res.json({ code: 0, msg: '绑定创建成功', data: rows[0] });
    });
  });
});

// 更新绑定（例如设为默认、停用、更新 metadata）
app.patch('/api/payment_bindings/:id', (req, res) => {
  const id = req.params.id;
  const { user_id, provider, account, masked_account, external_id, metadata, is_default, is_active, last_used_at } = req.body;
  // 只允许有限字段更新
  const fields = [];
  const params = [];
  if (provider !== undefined) { fields.push('provider = ?'); params.push(provider); }
  if (account !== undefined) { fields.push('account = ?'); params.push(account); }
  if (masked_account !== undefined) { fields.push('masked_account = ?'); params.push(masked_account); }
  if (external_id !== undefined) { fields.push('external_id = ?'); params.push(external_id); }
  if (metadata !== undefined) { fields.push('metadata = ?'); params.push(metadata ? JSON.stringify(metadata) : null); }
  if (is_default !== undefined) { fields.push('is_default = ?'); params.push(is_default ? 1 : 0); }
  if (is_active !== undefined) { fields.push('is_active = ?'); params.push(is_active ? 1 : 0); }
  if (last_used_at !== undefined) { fields.push('last_used_at = ?'); params.push(last_used_at); }
  if (fields.length === 0) return res.json({ code: -1, msg: '没有可更新的字段' });
  params.push(id);
  const sql = `UPDATE payment_bindings SET ${fields.join(', ')} WHERE id = ?`;
  db.query(sql, params, (err, result) => {
    if (err) return res.json({ code: -1, msg: '更新绑定失败：' + err.message });
    db.query('SELECT id, user_id, method, provider, account, masked_account, external_id, metadata, is_default, is_active, last_used_at, created_at, updated_at FROM payment_bindings WHERE id = ?', [id], (err2, rows) => {
      if (err2) return res.json({ code: -1, msg: '查询绑定失败：' + err2.message });
      if (!rows || rows.length === 0) return res.json({ code: -1, msg: '未找到绑定' });
      res.json({ code: 0, msg: '更新成功', data: rows[0] });
    });
  });
});

// 删除绑定
app.delete('/api/payment_bindings/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM payment_bindings WHERE id = ?', [id], (err, result) => {
    if (err) return res.json({ code: -1, msg: '删除绑定失败：' + err.message });
    if (result.affectedRows === 0) return res.json({ code: -1, msg: '未找到绑定' });
    res.json({ code: 0, msg: '解绑成功' });
  });
});

// 返回可用于前端选择的支付方式
app.get('/api/payment_methods', (req, res) => {
  const userId = req.query.userId;
  // 预定义的支付方式（与前端一致）
  const methods = ['wechat','alipay','unionpay','apple_pay','other'];
  if (!userId) {
    // 无 userId 时只返回基础列表
    return res.json({ code: 0, data: methods.map(m => ({ method: m })) });
  }
  db.query('SELECT id, method, provider, account, masked_account, is_default, is_active, last_used_at FROM payment_bindings WHERE user_id = ? AND is_active = 1', [userId], (err, rows) => {
    if (err) return res.json({ code: -1, msg: '查询支付绑定失败：' + err.message });
    const map = {};
    (rows || []).forEach(r => { map[r.method] = r; });
    const out = methods.map(m => ({ method: m, binding: map[m] || null }));
    res.json({ code: 0, data: out });
  });
});

// 标记订单为已支付（模拟重新支付）
app.post('/api/orders/pay', (req, res) => {
  const { order_no } = req.body;
  if (!order_no) return res.json({ code: -1, msg: '缺少 order_no' });
  db.query('UPDATE orders SET status = ? WHERE order_no = ?', ['paid', order_no], (err, result) => {
    if (err) return res.json({ code: -1, msg: '操作失败：' + err.message });
    if (result.affectedRows === 0) return res.json({ code: -1, msg: '未找到订单' });
    db.query('SELECT id, order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status, created_at FROM orders WHERE order_no = ?', [order_no], (err2, rows) => {
      if (err2) return res.json({ code: -1, msg: '查询订单失败：' + err2.message });
      res.json({ code: 0, msg: '标记为已支付', data: rows[0] });
    });
  });
});

// 无条件退款（将订单状态更新为 refunded）
app.post('/api/orders/refund', (req, res) => {
  const { order_no } = req.body;
  if (!order_no) return res.json({ code: -1, msg: '缺少 order_no' });
  db.query('UPDATE orders SET status = ? WHERE order_no = ?', ['refunded', order_no], (err, result) => {
    if (err) return res.json({ code: -1, msg: '退款失败：' + err.message });
    if (result.affectedRows === 0) return res.json({ code: -1, msg: '未找到订单' });
    db.query('SELECT id, order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status, created_at FROM orders WHERE order_no = ?', [order_no], (err2, rows) => {
      if (err2) return res.json({ code: -1, msg: '查询订单失败：' + err2.message });
      res.json({ code: 0, msg: '退款成功（无条件）', data: rows[0] });
    });
  });
});

// 取消（包括取消候补）——将订单状态更新为 cancelled
app.post('/api/orders/cancel', (req, res) => {
  const { order_no } = req.body;
  if (!order_no) return res.json({ code: -1, msg: '缺少 order_no' });
  db.query('UPDATE orders SET status = ? WHERE order_no = ?', ['cancelled', order_no], (err, result) => {
    if (err) return res.json({ code: -1, msg: '取消失败：' + err.message });
    if (result.affectedRows === 0) return res.json({ code: -1, msg: '未找到订单' });
    db.query('SELECT id, order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status, created_at FROM orders WHERE order_no = ?', [order_no], (err2, rows) => {
      if (err2) return res.json({ code: -1, msg: '查询订单失败：' + err2.message });
      res.json({ code: 0, msg: '取消成功', data: rows[0] });
    });
  });
});

// 改签接口：创建新订单并将旧订单标记为 changed
app.post('/api/orders/reschedule', (req, res) => {
  const { old_order_no, userId, start_city, end_city, train_no, price, depart_time, seat_type, status } = req.body;
  if (!old_order_no) return res.json({ code: -1, msg: '缺少 old_order_no' });

  // 首先创建新订单
  generateUniqueOrderNo(5, (genErr, orderNo) => {
    if (genErr) return res.json({ code: -1, msg: '生成订单号失败：' + genErr.message });
    const insertSql = `INSERT INTO orders (order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(insertSql, [orderNo, userId || null, start_city, end_city, train_no || '', price || 0, depart_time || '', seat_type || '', status || 'pending'], (err, result) => {
      if (err) return res.json({ code: -1, msg: '创建改签订单失败：' + err.message });
      // 标记旧订单为 changed
      db.query('UPDATE orders SET status = ? WHERE order_no = ?', ['changed', old_order_no], (err2) => {
        if (err2) {
          // 如果标记失败，仍返回新订单，但告知旧订单更新失败
          db.query('SELECT id, order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status, created_at FROM orders WHERE id = ?', [result.insertId], (err3, rows3) => {
            if (err3) return res.json({ code: -1, msg: '查询新订单失败：' + err3.message });
            return res.json({ code: 0, msg: '改签完成（但旧订单状态更新失败）', data: rows3[0] });
          });
          return;
        }
        // 返回新订单信息
        db.query('SELECT id, order_no, user_id, start_city, end_city, train_no, price, depart_time, seat_type, status, created_at FROM orders WHERE id = ?', [result.insertId], (err4, rows4) => {
          if (err4) return res.json({ code: -1, msg: '查询新订单失败：' + err4.message });
          res.json({ code: 0, msg: '改签成功', data: rows4[0] });
        });
      });
    });
  });
});

// 查询常用乘客：按 creator_user_id 过滤
app.get('/api/frequent_passengers', (req, res) => {
  const userId = req.query.userId;
  let sql = 'SELECT id, creator_user_id, creator_username, creator_phone, creator_id_card, passenger_name, passenger_id_card, passenger_phone, passenger_type, created_at FROM frequent_passengers';
  const params = [];
  if (userId) {
    sql += ' WHERE creator_user_id = ? ORDER BY created_at DESC';
    params.push(userId);
  } else {
    sql += ' ORDER BY created_at DESC';
  }
  db.query(sql, params, (err, results) => {
    if (err) return res.status(500).json({ code: -1, msg: '查询常用乘客失败：' + err.message });
    res.json({ code: 0, data: results });
  });
});

// 创建常用乘客（由前端提交）
app.post('/api/frequent_passengers', (req, res) => {
  const { userId, passenger_name, passenger_id_card, passenger_phone, passenger_type } = req.body;
  if (!userId) return res.json({ code: -1, msg: '缺少 userId' });
  if (!passenger_name || !passenger_id_card) return res.json({ code: -1, msg: '乘客姓名和身份证号为必填' });
  
  // 先查询创建者信息，补充 creator_* 字段
  db.query('SELECT username, phone, id_card FROM user WHERE id = ?', [userId], (errUser, rowsUser) => {
    if (errUser) return res.json({ code: -1, msg: '查询创建者信息失败：' + errUser.message });
    if (!rowsUser || rowsUser.length === 0) return res.json({ code: -1, msg: '创建者不存在' });
    
    const creator = rowsUser[0];
    const insertSql = `INSERT INTO frequent_passengers (creator_user_id, creator_username, creator_phone, creator_id_card, passenger_name, passenger_id_card, passenger_phone, passenger_type) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;
    db.query(insertSql, [
      userId, 
      creator.username || '', 
      creator.phone || '', 
      creator.id_card || '', 
      passenger_name, 
      passenger_id_card, 
      passenger_phone || '', 
      passenger_type || 'adult'
    ], (err, result) => {
      if (err) return res.json({ code: -1, msg: '创建常用乘客失败：' + err.message });
      db.query('SELECT id, creator_user_id, creator_username, creator_phone, creator_id_card, passenger_name, passenger_id_card, passenger_phone, passenger_type, created_at FROM frequent_passengers WHERE id = ?', [result.insertId], (err2, rows) => {
        if (err2) return res.json({ code: -1, msg: '查询新乘客失败：' + err2.message });
        res.json({ code: 0, msg: '常用乘客创建成功', data: rows[0] });
      });
    });
  });
});

// 删除常用乘客（按 id）
app.delete('/api/frequent_passengers/:id', (req, res) => {
  const id = req.params.id;
  db.query('DELETE FROM frequent_passengers WHERE id = ?', [id], (err, result) => {
    if (err) return res.json({ code: -1, msg: '删除失败：' + err.message });
    if (result.affectedRows === 0) return res.json({ code: -1, msg: '未找到要删除的记录' });
    res.json({ code: 0, msg: '删除成功' });
  });
});

// 更新常用乘客（按 id），仅允许创建者本人修改
app.put('/api/frequent_passengers/:id', (req, res) => {
  const id = req.params.id;
  const { userId, passenger_name, passenger_id_card, passenger_phone, passenger_type } = req.body;
  if (!userId) return res.json({ code: -1, msg: '缺少 userId' });

  db.query('SELECT creator_user_id FROM frequent_passengers WHERE id = ?', [id], (err, rows) => {
    if (err) return res.json({ code: -1, msg: '查询失败：' + err.message });
    if (!rows || rows.length === 0) return res.json({ code: -1, msg: '未找到记录' });
    const creatorId = rows[0].creator_user_id;
    if (Number(creatorId) !== Number(userId)) return res.json({ code: -1, msg: '无权修改该常用乘客' });

    if (!passenger_name || !passenger_id_card) return res.json({ code: -1, msg: '乘客姓名和身份证号为必填' });
    const updateSql = `UPDATE frequent_passengers SET passenger_name = ?, passenger_id_card = ?, passenger_phone = ?, passenger_type = ? WHERE id = ?`;
    db.query(updateSql, [passenger_name, passenger_id_card, passenger_phone || '', passenger_type || 'adult', id], (err2, result2) => {
      if (err2) return res.json({ code: -1, msg: '更新失败：' + err2.message });
      db.query('SELECT id, creator_user_id, creator_username, creator_phone, creator_id_card, passenger_name, passenger_id_card, passenger_phone, passenger_type, created_at FROM frequent_passengers WHERE id = ?', [id], (err3, rows3) => {
        if (err3) return res.json({ code: -1, msg: '查询更新后记录失败：' + err3.message });
        res.json({ code: 0, msg: '更新成功', data: rows3[0] });
      });
    });
  });
});

// ========== 启动服务（保留） ==========
app.listen(port, () => {
  console.log(`✅ 后端服务运行在：http://localhost:${port}`);
});