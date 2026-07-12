const fs = require('fs');
const path = require('path');

const dbPath = path.join(process.env.APPDATA, 'كاشي - نظام الكاشير المتكامل', 'db.json');

try {
  if (fs.existsSync(dbPath)) {
    const db = JSON.parse(fs.readFileSync(dbPath, 'utf-8'));
    if (db.settings) {
      console.log("Sync settings:", {
        cloudSyncEnabled: db.settings.cloudSyncEnabled,
        cloudApiUrl: db.settings.cloudApiUrl,
        cloudAuthToken: db.settings.cloudAuthToken ? "EXISTS" : "MISSING",
        branchId: db.settings.branchId
      });
    } else {
      console.log("No settings.");
    }
  } else {
    console.log("DB file not found.");
  }
} catch (e) {
  console.error(e);
}
