import fs from 'fs';
const db = JSON.parse(fs.readFileSync('C:\\Users\\DELL\\AppData\\Roaming\\كاشي - نظام الكاشير المتكامل\\db.json', 'utf-8'));
console.log('Users in DB:', db.users.map(u => ({ id: u.id, name: u.fullName, role: u.role, pinCode: u.pinCode, hasHash: !!u.pinHash, isActive: u.isActive })));
