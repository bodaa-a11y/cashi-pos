const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'كاشي - نظام الكاشير المتكامل', 'db.json');

try {
  if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    console.log("Total orders in DB:", db.orders ? db.orders.length : 0);
    if (db.orders && db.orders.length > 0) {
      console.log("Latest 5 orders:");
      const latest = db.orders.slice(-5).reverse();
      for (const order of latest) {
        console.log({
          id: order.id,
          orderNumber: order.orderNumber,
          total: order.total,
          createdAt: order.createdAt,
          cloudSynced: order.cloudSynced,
          cloudSyncedAt: order.cloudSyncedAt
        });
      }
    }
  } else {
    console.log("DB file not found at:", dbPath);
  }
} catch (e) {
  console.error("Error checking orders:", e);
}
