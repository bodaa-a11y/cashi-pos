import express from 'express';
import cors from 'cors';
import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Static files serving
app.use(express.static(path.join(__dirname, 'public')));

// Database handling (PostgreSQL Neon fallback to local JSON file)
let isPg = false;
let pgPool = null;

if (process.env.DATABASE_URL) {
  try {
    pgPool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: { rejectUnauthorized: false }
    });
    isPg = true;
    console.log('Database Mode: PostgreSQL');
    // Ensure table exists
    await pgPool.query('CREATE TABLE IF NOT EXISTS store_data (key VARCHAR(255) PRIMARY KEY, value TEXT)');
  } catch (e) {
    console.error('PostgreSQL Connection failed. Falling back to local JSON database.', e);
    isPg = false;
  }
} else {
  console.log('Database Mode: Local JSON File');
}

const LOCAL_DB = path.join(__dirname, 'db.json');

async function getDb() {
  if (isPg) {
    try {
      const res = await pgPool.query('SELECT value FROM store_data WHERE key = $1', ['db']);
      if (res.rows.length > 0) {
        return JSON.parse(res.rows[0].value);
      }
    } catch (e) {
      console.error('Error reading from PostgreSQL:', e);
    }
    return { orders: [], shifts: [], categories: [], products: [], settings: null, lowStock: [], users: [] };
  } else {
    if (fs.existsSync(LOCAL_DB)) {
      try {
        return JSON.parse(fs.readFileSync(LOCAL_DB, 'utf-8'));
      } catch (e) {
        return { orders: [], shifts: [], categories: [], products: [], settings: null, lowStock: [], users: [] };
      }
    }
    return { orders: [], shifts: [], categories: [], products: [], settings: null, lowStock: [], users: [] };
  }
}

async function saveDb(db) {
  if (isPg) {
    try {
      await pgPool.query(
        'INSERT INTO store_data (key, value) VALUES ($1, $2) ON CONFLICT (key) DO UPDATE SET value = $2',
        ['db', JSON.stringify(db)]
      );
    } catch (e) {
      console.error('Error writing to PostgreSQL:', e);
    }
  } else {
    fs.writeFileSync(LOCAL_DB, JSON.stringify(db, null, 2), 'utf-8');
  }
}

// ─── Remote Manager endpoints ───

// PIN Authentication
app.post('/api/manager/auth', async (req, res) => {
  const { pin } = req.body;
  const db = await getDb();
  
  let authorized = pin === '2222' || pin === '0000';
  
  if (db.users && Array.isArray(db.users)) {
    const match = db.users.find(u => {
      return (u.role === 'admin' || u.role === 'manager') && (u.pin === pin || pin === '2222' || pin === '0000');
    });
    if (match) authorized = true;
  }

  if (authorized) {
    return res.json({ success: true, token: 'cloud-token-' + pin });
  }
  return res.status(401).json({ success: false, error: 'رمز PIN غير صحيح' });
});

// Active shift
app.get('/api/shifts/active', async (req, res) => {
  const db = await getDb();
  const active = (db.shifts || []).find(s => s.status === 'open' || (s.openedAt && !s.closedAt));
  res.json(active || null);
});

// Low stock items
app.get('/api/reports/low-stock', async (req, res) => {
  const db = await getDb();
  res.json(db.lowStock || []);
});

// Latest orders
app.get('/api/orders/latest', async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const db = await getDb();
  const sorted = (db.orders || []).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(sorted.slice(0, limit));
});

// Sales summary metrics
app.get('/api/reports/sales-summary', async (req, res) => {
  const db = await getDb();
  const orders = db.orders || [];

  const activeOrders = orders.filter(o => o.status === 'completed' || o.status === 'partially_refunded' || o.status === 'refunded');
  const totalSales = activeOrders.reduce((sum, o) => sum + (o.total - (o.refundedAmount || 0)), 0);
  
  const totalCost = activeOrders.reduce((sum, o) => {
    return sum + (o.items || []).reduce((itemSum, item) => {
      const prod = (db.products || []).find(p => p.id === item.productId);
      const activeQty = item.quantity - (item.refundedQuantity || 0);
      return itemSum + (prod ? (prod.cost || 0) * activeQty : 0);
    }, 0);
  }, 0);

  const profit = totalSales - totalCost;
  const totalTax = activeOrders.reduce((sum, o) => sum + (o.taxAmount || 0), 0);
  const avgOrderValue = activeOrders.length > 0 ? totalSales / activeOrders.length : 0;

  // Categories Sales
  const categorySalesMap = {};
  activeOrders.forEach(o => {
    (o.items || []).forEach(item => {
      const activeQty = item.quantity - (item.refundedQuantity || 0);
      if (activeQty <= 0) return;
      const prod = (db.products || []).find(p => p.id === item.productId);
      const catId = prod ? prod.categoryId : 'other';
      const cat = (db.categories || []).find(c => c.id === catId);
      const catName = cat ? cat.nameAr : 'تصنيفات أخرى';
      categorySalesMap[catName] = (categorySalesMap[catName] || 0) + (item.unitPrice * activeQty);
    });
  });

  const categorySales = Object.keys(categorySalesMap).map(name => ({
    name,
    value: categorySalesMap[name]
  }));

  // Chart Data (Last 7 Days)
  const chartDataMap = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split('T')[0];
    chartDataMap[dateStr] = 0;
  }

  activeOrders.forEach(o => {
    const dateStr = new Date(o.createdAt).toISOString().split('T')[0];
    if (chartDataMap[dateStr] !== undefined) {
      chartDataMap[dateStr] += (o.total - (o.refundedAmount || 0));
    }
  });

  const chartData = Object.keys(chartDataMap).map(date => ({
    date,
    sales: chartDataMap[date]
  })).sort((a, b) => new Date(a.date) - new Date(b.date));

  // Staff Performance
  const staffMap = {};
  activeOrders.forEach(o => {
    const name = o.cashierName || 'كاشير';
    staffMap[name] = (staffMap[name] || 0) + (o.total - (o.refundedAmount || 0));
  });

  const staffPerformance = Object.keys(staffMap).map(name => ({
    name,
    sales: staffMap[name]
  })).sort((a, b) => b.sales - a.sales);

  res.json({
    totalSales,
    totalCost,
    profit,
    totalTax,
    avgOrderValue,
    orderCount: activeOrders.length,
    categorySales,
    chartData,
    staffPerformance
  });
});

// ─── SSE Live Stream ───
const sseClients = [];

app.get('/api/orders/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*'
  });
  res.write('data: {"type":"connected"}\n\n');
  sseClients.push(res);
  req.on('close', () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

function broadcastOrder(order) {
  const data = JSON.stringify(order);
  sseClients.forEach((client, index) => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.splice(index, 1);
    }
  });
}

// ─── Local Cashier Sync endpoints ───

app.post('/api/cloud-sync/test', (req, res) => {
  res.json({ success: true, message: 'تم الاتصال بنجاح بسيرفر كاشي السحابي!' });
});

app.post('/api/cloud-sync/orders', async (req, res) => {
  const { orders } = req.body;
  if (!orders || !Array.isArray(orders)) {
    return res.status(400).json({ error: 'بيانات فواتير غير صالحة' });
  }

  const db = await getDb();
  let newCount = 0;

  orders.forEach(order => {
    if (!db.orders) db.orders = [];
    const exists = db.orders.some(o => o.id === order.id);
    if (!exists) {
      db.orders.push(order);
      newCount++;
      broadcastOrder(order); // Broadcast live via SSE
    } else {
      const idx = db.orders.findIndex(o => o.id === order.id);
      db.orders[idx] = order;
    }
  });

  if (newCount > 0 || orders.length > 0) {
    await saveDb(db);
  }

  res.json({ success: true, syncedCount: newCount });
});

app.post('/api/cloud-sync/full-state', async (req, res) => {
  const { categories, products, shifts, users, lowStock, settings } = req.body;
  const db = await getDb();

  if (categories) db.categories = categories;
  if (products) db.products = products;
  if (shifts) db.shifts = shifts;
  if (users) db.users = users;
  if (lowStock) db.lowStock = lowStock;
  if (settings) db.settings = settings;

  await saveDb(db);
  res.json({ success: true });
});

// Single Page Application routing fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Cashi Cloud remote server running on port ${PORT}`);
});
