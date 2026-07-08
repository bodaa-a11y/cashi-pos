import fs from 'fs';
import path from 'path';

const dbPath = 'C:\\Users\\DELL\\AppData\\Roaming\\كاشي - نظام الكاشير المتكامل\\db.json';

if (fs.existsSync(dbPath)) {
  try {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    const db = JSON.parse(raw);
    if (!db.settings) {
      db.settings = {};
    }
    db.settings.vatRate = 0;
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
    console.log('✅ Successfully updated VAT rate to 0 in Roaming db.json');
  } catch (e) {
    console.error(e);
  }
} else {
  console.log('Roaming db.json does not exist yet.');
}
