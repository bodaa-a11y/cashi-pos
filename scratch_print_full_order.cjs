const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'كاشي - نظام الكاشير المتكامل', 'db.json');

try {
  if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    const order13 = db.orders.find(o => o.orderNumber === 13);
    console.log("Order 13:", JSON.stringify(order13, null, 2));
  } else {
    console.log("DB file not found.");
  }
} catch (e) {
  console.error(e);
}
