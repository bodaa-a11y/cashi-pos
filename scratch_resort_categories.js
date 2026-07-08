import fs from 'fs';
import path from 'path';

const paths = [
  'C:\\Users\\DELL\\AppData\\Roaming\\كاشي - نظام الكاشير المتكامل\\db.json',
  path.join(process.cwd(), 'db.json')
];

// Order: Shawarma first, then Pizza, then Fatayer, then Manaqeesh, etc.
const categoryOrder = {
  'c-5': 1, // شاورما
  'c-1': 2, // بيتزا
  'c-2': 3, // فطائر
  'c-3': 4, // المناقيش
  'c-4': 5, // بوكسات
  'c-6': 6, // مشاوي
  'c-7': 7, // سندوتشات
  'c-8': 8, // برجر
  'c-9': 9  // المقبلات والإضافات
};

paths.forEach(dbPath => {
  if (fs.existsSync(dbPath)) {
    try {
      const raw = fs.readFileSync(dbPath, 'utf-8');
      const db = JSON.parse(raw);
      
      db.categories.forEach(cat => {
        cat.sortOrder = categoryOrder[cat.id] || 99;
      });
      
      // Sort categories array in place by sortOrder
      db.categories.sort((a, b) => a.sortOrder - b.sortOrder);
      
      fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf-8');
      console.log(`✅ successfully resorted categories at ${dbPath}`);
    } catch (e) {
      console.error(`❌ Failed to update at ${dbPath}`, e);
    }
  }
});
