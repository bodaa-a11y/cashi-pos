import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================
// مجلدات العمل لنسخة الإنتاج
// =============================================
let DB_FILE = path.join(process.cwd(), "db.json");
let UPLOADS_DIR = path.join(process.cwd(), "uploads");
let BACKUPS_DIR = path.join(process.cwd(), "backups");
let LOGS_DIR = path.join(process.cwd(), "logs");

// =============================================
// دوال الحماية وتشفير الرموز (SHA-256 Hashing)
// =============================================
function hashPIN(pin: any): string {
  const pinStr = String(pin || "");
  const salt = "cashi_secure_salt_2026";
  return crypto.createHmac("sha256", salt).update(pinStr).digest("hex");
}

// =============================================
// نظام مراقبة الأخطاء النصي (Error Log Writer)
// =============================================
function logError(message: string, error?: any) {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }
    const logFile = path.join(LOGS_DIR, "error.log");
    const timestamp = new Date().toISOString();
    const errStr = error ? (error.stack || error.message || String(error)) : "";
    const logMessage = `[${timestamp}] ERROR: ${message}\n${errStr}\n----------------------------------------\n`;
    fs.appendFileSync(logFile, logMessage, "utf-8");
  } catch (e) {
    console.error("Failed to write to log file:", e);
  }
}

// =============================================
// نظام النسخ الاحتياطي التلقائي (Auto-Backup Scheduler)
// =============================================
function runDatabaseBackup() {
  try {
    if (!fs.existsSync(BACKUPS_DIR)) {
      fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    }
    if (!fs.existsSync(DB_FILE)) return;

    const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
    const backupFile = path.join(BACKUPS_DIR, `db_backup_${timestamp}.json`);
    fs.copyFileSync(DB_FILE, backupFile);
    console.log(`[كاشي نسخ احتياطي] ✅ تم أخذ نسخة احتياطية: ${backupFile}`);

    // الحفاظ على آخر 10 نسخ وحذف الأقدم
    const files = fs.readdirSync(BACKUPS_DIR)
      .filter((f) => f.startsWith("db_backup_") && f.endsWith(".json"))
      .map((f) => ({
        name: f,
        path: path.join(BACKUPS_DIR, f),
        time: fs.statSync(path.join(BACKUPS_DIR, f)).mtime.getTime()
      }))
      .sort((a, b) => b.time - a.time);

    if (files.length > 10) {
      for (let i = 10; i < files.length; i++) {
        fs.unlinkSync(files[i].path);
        console.log(`[كاشي نسخ احتياطي] 🗑️ تم حذف النسخة الاحتياطية القديمة: ${files[i].name}`);
      }
    }
  } catch (error) {
    logError("فشل في أخذ النسخة الاحتياطية التلقائية", error);
  }
}

// =============================================
// حفظ صور المنتجات (Base64 Image Decoder)
// =============================================
function saveBase64Image(base64Str: string, destDir: string): string | null {
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }
    const type = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    
    let extension = "png";
    if (type.includes("jpeg") || type.includes("jpg")) extension = "jpg";
    else if (type.includes("webp")) extension = "webp";
    else if (type.includes("gif")) extension = "gif";

    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
    const destPath = path.join(destDir, filename);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.writeFileSync(destPath, buffer);
    return filename;
  } catch (error) {
    logError("خطأ أثناء فك وتشفير صورة المنتج المرفوعة", error);
    return null;
  }
}

// =============================================
// دوال قراءة وكتابة قاعدة البيانات
// =============================================
function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const seedData = {
      settings: null,
      users: [
        { id: "u-1", fullName: "أحمد كاشير", username: "cashier", role: "cashier", pinCode: hashPIN("1234"), passwordHash: hashPIN("1234"), isActive: true, createdAt: new Date().toISOString() },
        { id: "u-2", fullName: "سليمان أدمن", username: "admin", role: "admin", pinCode: hashPIN("0000"), passwordHash: hashPIN("0000"), isActive: true, createdAt: new Date().toISOString() },
        { id: "u-3", fullName: "خالد مدير", username: "manager", role: "manager", pinCode: hashPIN("2222"), passwordHash: hashPIN("2222"), isActive: true, createdAt: new Date().toISOString() },
        { id: "u-4", fullName: "يوسف نادل", username: "waiter", role: "waiter", pinCode: hashPIN("1111"), isActive: true, createdAt: new Date().toISOString() },
        { id: "u-5", fullName: "سارة نادلة", username: "waiter2", role: "waiter", pinCode: hashPIN("3333"), isActive: true, createdAt: new Date().toISOString() }
      ],
      categories: [
        { id: "c-1", nameAr: "الأطباق الرئيسية", nameEn: "Main Dishes", sortOrder: 1, isActive: true },
        { id: "c-2", nameAr: "المقبلات والشوربات", nameEn: "Appetizers", sortOrder: 2, isActive: true },
        { id: "c-3", nameAr: "المشروبات الباردة", nameEn: "Cold Drinks", sortOrder: 3, isActive: true },
        { id: "c-4", nameAr: "المشروبات الساخنة", nameEn: "Hot Drinks", sortOrder: 4, isActive: true },
        { id: "c-5", nameAr: "الحلويات الشرقية", nameEn: "Desserts", sortOrder: 5, isActive: true }
      ],
      products: [
        { id: "p-1", categoryId: "c-1", nameAr: "شاورما دجاج سوبر", nameEn: "Super Chicken Shawarma", description: "شاورما دجاج فاخرة مع الثوم والمخلل والبطاطس", price: 18.00, cost: 7.00, barcode: "62811001", isActive: true, trackInventory: true, quantity: 85, image: null },
        { id: "p-2", categoryId: "c-1", nameAr: "كبسة لحم نعيمي غنم", nameEn: "Meat Kabsa", description: "أرز بسمتي مع لحم نعيمي طازج والمكسرات والبهارات", price: 55.00, cost: 25.00, barcode: "62811002", isActive: true, trackInventory: true, quantity: 30, image: null },
        { id: "p-3", categoryId: "c-1", nameAr: "منسف أردني بالجميد الكركي", nameEn: "Jordanian Mansaf", description: "المنسف الأردني التقليدي مع اللحم والجميد البلدي", price: 65.00, cost: 30.00, barcode: "62811003", isActive: true, trackInventory: true, quantity: 20, image: null },
        { id: "p-4", categoryId: "c-2", nameAr: "صحن حمص ناعم بالزيت", nameEn: "Hummus Plate", description: "حمص بلدي ناعم مع زيت الزيتون البكر", price: 8.00, cost: 2.50, barcode: "62811004", isActive: true, trackInventory: true, quantity: 150, image: null },
        { id: "p-5", categoryId: "c-2", nameAr: "سلطة فتوش لبنانية بدبس الرمان", nameEn: "Fattoush Salad", description: "خضار طازجة مع الخبز المحمص ودبس الرمان", price: 12.00, cost: 3.00, barcode: "62811005", isActive: true, trackInventory: true, quantity: 120, image: null },
        { id: "p-6", categoryId: "c-3", nameAr: "عصير برتقال طازج بارد", nameEn: "Fresh Orange Juice", description: "عصير برتقال طبيعي معصور طازج بدون سكر", price: 15.00, cost: 4.00, barcode: "62811006", isActive: true, trackInventory: true, quantity: 200, image: null },
        { id: "p-7", categoryId: "c-3", nameAr: "كوكا كولا علبة بارد", nameEn: "Coca Cola Can", description: "مشروب غازي كوكا كولا بارد 330 مل", price: 5.00, cost: 1.50, barcode: "62811007", isActive: true, trackInventory: true, quantity: 45, image: null },
        { id: "p-8", categoryId: "c-4", nameAr: "شاي أكبر أخضر 100 جم", nameEn: "Akbar Green Tea 100g", description: "شاي أخضر سيلاني فاخر علبة معدنية", price: 10.00, cost: 3.50, barcode: "62811008", isActive: true, trackInventory: true, quantity: 60, image: null },
        { id: "p-9", categoryId: "c-4", nameAr: "كابتشينو برغوة كثيفة", nameEn: "Cappuccino", description: "إسبريسو غني مع حليب مبخر ورغوة حليب", price: 14.00, cost: 4.50, barcode: "62811009", isActive: true, trackInventory: true, quantity: 95, image: null },
        { id: "p-10", categoryId: "c-5", nameAr: "كنافة نابلسية خشنة بالجبن", nameEn: "Cheese Knafeh", description: "كنافة نابلسية بالجبن العكاوي الساخن والقطر", price: 18.00, cost: 6.00, barcode: "62811010", isActive: true, trackInventory: true, quantity: 40, image: null }
      ],
      restaurant_tables: [
        { id: "t-1", label: "طاولة 1 (عائلية)", seats: 6, status: "free", posX: 100, posY: 100 },
        { id: "t-2", label: "طاولة 2", seats: 4, status: "free", posX: 250, posY: 100 },
        { id: "t-3", label: "طاولة 3 (VIP)", seats: 8, status: "free", posX: 400, posY: 100 },
        { id: "t-4", label: "طاولة 4", seats: 2, status: "free", posX: 100, posY: 250 },
        { id: "t-5", label: "طاولة 5", seats: 4, status: "free", posX: 250, posY: 250 },
        { id: "t-6", label: "طاولة 6", seats: 4, status: "free", posX: 400, posY: 250 }
      ],
      shifts: [],
      cash_movements: [],
      customers: [
        { id: "cust-1", fullName: "عبد الله محمد", phone: "0551234567", notes: "عميل دائم يفضل شاورما بدون مخلل", createdAt: new Date().toISOString() },
        { id: "cust-2", fullName: "منى العتيبي", phone: "0569876543", notes: "تطلب ديلفري دائمًا", createdAt: new Date().toISOString() }
      ],
      held_orders: [],
      orders: [],
      inventory_items: [
        { id: "i-1", nameAr: "دجاج شاورما متبل", unit: "كجم", quantity: 45, lowStockThreshold: 10 },
        { id: "i-2", nameAr: "أرز بسمتي هندي", unit: "كجم", quantity: 120, lowStockThreshold: 20 },
        { id: "i-3", nameAr: "جبنة عكاوي بلدي", unit: "كجم", quantity: 8, lowStockThreshold: 15 },
        { id: "i-4", nameAr: "بن قهوة كولومبي", unit: "كجم", quantity: 3, lowStockThreshold: 5 }
      ],
      inventory_transactions: [],
      print_jobs: [],
      audit_logs: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), "utf-8");
    return seedData;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
}

function writeDB(data: any) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), "utf-8");
}

// =============================================
// نظام تدقيق العمليات (Audit Logging System)
// =============================================
function writeAuditLog(action: string, userId: string, userName: string, details: string) {
  try {
    const db = readDB();
    if (!db.audit_logs) {
      db.audit_logs = [];
    }
    const log = {
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      action,
      userId,
      userName,
      details,
      createdAt: new Date().toISOString()
    };
    db.audit_logs.push(log);
    if (db.audit_logs.length > 1000) {
      db.audit_logs.shift(); // الحفاظ على آخر 1000 سجل
    }
    writeDB(db);
  } catch (error) {
    logError("فشل في كتابة سجل تدقيق العمليات", error);
  }
}

// =============================================
// إنشاء وتصدير السيرفر كوحدة
// =============================================
export function createServer(dbPath?: string) {
  if (dbPath) {
    DB_FILE = dbPath;
    const dir = path.dirname(DB_FILE);
    UPLOADS_DIR = path.join(dir, "uploads");
    BACKUPS_DIR = path.join(dir, "backups");
    LOGS_DIR = path.join(dir, "logs");

    // إنشاء المجلدات إذا لم تكن موجودة
    [dir, UPLOADS_DIR, BACKUPS_DIR, LOGS_DIR].forEach((d) => {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    });
  }

  // تهيئة قاعدة البيانات والتحقق من صحة تشفير المستخدمين (ترحيل إجباري)
  const db = readDB();
  const hasUnhashedUsers = db.users && db.users.some((u: any) => u.pinCode && u.pinCode.length !== 64);
  
  // طلب المستخدم: حذف الموظفين وإعادتهم من جديد برمز PIN مشفر
  if (hasUnhashedUsers || !db.users || db.users.length === 0) {
    console.log("[كاشي] 🔄 ترحيل الموظفين: حذف جميع الموظفين وإعادة إضافتهم برموز مشفرة...");
    db.users = [
      { id: "u-1", fullName: "أحمد كاشير", username: "cashier", role: "cashier", pinCode: hashPIN("1234"), passwordHash: hashPIN("1234"), isActive: true, createdAt: new Date().toISOString() },
      { id: "u-2", fullName: "سليمان أدمن", username: "admin", role: "admin", pinCode: hashPIN("0000"), passwordHash: hashPIN("0000"), isActive: true, createdAt: new Date().toISOString() },
      { id: "u-3", fullName: "خالد مدير", username: "manager", role: "manager", pinCode: hashPIN("2222"), passwordHash: hashPIN("2222"), isActive: true, createdAt: new Date().toISOString() },
      { id: "u-4", fullName: "يوسف نادل", username: "waiter", role: "waiter", pinCode: hashPIN("1111"), isActive: true, createdAt: new Date().toISOString() },
      { id: "u-5", fullName: "سارة نادلة", username: "waiter2", role: "waiter", pinCode: hashPIN("3333"), isActive: true, createdAt: new Date().toISOString() }
    ];
    writeDB(db);
  }

  // تشغيل جدولة النسخ الاحتياطي التلقائي
  runDatabaseBackup();
  const backupInterval = setInterval(runDatabaseBackup, 24 * 60 * 60 * 1000);

  const app = express();
  app.use(express.json({ limit: "15mb" }));
  app.use("/uploads", express.static(UPLOADS_DIR));

  // =============================================
  // إعدادات المطعم (Setup Wizard) — معالج الإعداد الأول
  // =============================================
  app.get("/api/settings", (req, res) => {
    const db = readDB();
    res.json(db.settings || null);
  });

  app.post("/api/settings", (req, res) => {
    const { businessNameAr, businessNameEn, branchName, address, phone, taxNumber, currency, vatRate, receiptFooter, logoBase64 } = req.body;
    const db = readDB();
    db.settings = {
      businessNameAr: businessNameAr || "كاشي",
      businessNameEn: businessNameEn || "Cashi",
      branchName: branchName || "",
      address: address || "",
      phone: phone || "",
      taxNumber: taxNumber || "",
      currency: currency || "ر.س",
      vatRate: vatRate !== undefined ? Number(vatRate) : 15,
      receiptFooter: receiptFooter || "شكراً لزيارتكم!",
      logoBase64: logoBase64 || null,
      setupCompletedAt: new Date().toISOString()
    };
    writeDB(db);
    res.json({ success: true, settings: db.settings });
  });

  app.put("/api/settings", (req, res) => {
    const db = readDB();
    if (!db.settings) {
      return res.status(400).json({ error: "لم يتم إعداد النظام بعد" });
    }
    db.settings = { ...db.settings, ...req.body, updatedAt: new Date().toISOString() };
    writeDB(db);
    res.json({ success: true, settings: db.settings });
  });

  // =============================================
  // المصادقة (Auth)
  // =============================================
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const hashedPassword = hashPIN(password);
    const user = db.users.find(
      (u: any) => u.username === username && u.passwordHash === hashedPassword && u.isActive
    );
    if (user) {
      writeAuditLog("دخول الإدارة", user.id, user.fullName, `تسجيل دخول ناجح باستخدام اسم المستخدم: ${username}`);
      res.json({ success: true, token: `jwt-token-${user.id}`, user });
    } else {
      res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }
  });

  app.post("/api/auth/pin-login", (req, res) => {
    const { pin } = req.body;
    const db = readDB();
    const hashedPin = hashPIN(pin);
    const user = db.users.find((u: any) => u.pinCode === hashedPin && u.isActive);
    if (user) {
      writeAuditLog("دخول الكاشير", user.id, user.fullName, `تسجيل دخول ناجح للمحطة بالرمز السريع`);
      res.json({ success: true, token: `jwt-token-${user.id}`, user });
    } else {
      res.status(401).json({ error: "رمز PIN غير صحيح أو الحساب غير نشط" });
    }
  });

  // مصادقة المدير عن بُعد
  app.post("/api/manager/auth", (req, res) => {
    const { pin } = req.body;
    const db = readDB();
    const hashedPin = hashPIN(pin);
    const user = db.users.find(
      (u: any) => u.pinCode === hashedPin && u.isActive && (u.role === "admin" || u.role === "manager")
    );
    if (user) {
      writeAuditLog("دخول المدير عن بعد", user.id, user.fullName, `تسجيل دخول ناجح للوحة المراقبة عن بعد`);
      res.json({ success: true, token: `manager-token-${user.id}`, user });
    } else {
      res.status(401).json({ error: "رمز PIN غير صحيح أو ليس لديك صلاحيات المدير" });
    }
  });

  // =============================================
  // القائمة (Menu)
  // =============================================
  app.get("/api/menu", (req, res) => {
    const db = readDB();
    res.json({
      categories: db.categories.filter((c: any) => c.isActive).sort((a: any, b: any) => a.sortOrder - b.sortOrder),
      products: db.products.filter((p: any) => p.isActive)
    });
  });

  // =============================================
  // إدارة التصنيفات
  // =============================================
  app.post("/api/categories", (req, res) => {
    const { nameAr, nameEn, sortOrder } = req.body;
    const db = readDB();
    const newCat = {
      id: `c-${Date.now()}`,
      nameAr,
      nameEn,
      sortOrder: sortOrder || db.categories.length + 1,
      isActive: true
    };
    db.categories.push(newCat);
    writeDB(db);
    res.json(newCat);
  });

  // =============================================
  // إدارة المنتجات
  // =============================================
  app.post("/api/products", (req, res) => {
    const { categoryId, nameAr, nameEn, description, price, cost, barcode, trackInventory, quantity, imageBase64 } = req.body;
    
    let imageName: string | null = null;
    if (imageBase64) {
      imageName = saveBase64Image(imageBase64, UPLOADS_DIR);
    }

    const db = readDB();
    const newProduct = {
      id: `p-${Date.now()}`,
      categoryId,
      nameAr,
      nameEn,
      description,
      price: Number(price),
      cost: Number(cost),
      barcode,
      isActive: true,
      trackInventory: !!trackInventory,
      quantity: Number(quantity) || 0,
      image: imageName
    };
    
    db.products.push(newProduct);
    writeDB(db);
    writeAuditLog("إضافة صنف", "admin", "الإدارة", `تم إضافة صنف جديد: ${nameAr} (${price} ر.س)`);
    res.json(newProduct);
  });

  app.put("/api/products/:id", (req, res) => {
    const { id } = req.params;
    const { categoryId, nameAr, nameEn, description, price, cost, barcode, trackInventory, quantity, imageBase64, image } = req.body;
    
    const db = readDB();
    const index = db.products.findIndex((p: any) => p.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "المنتج غير موجود" });
    }

    let imageName = image !== undefined ? image : db.products[index].image;
    if (imageBase64) {
      const newImg = saveBase64Image(imageBase64, UPLOADS_DIR);
      if (newImg) {
        if (db.products[index].image) {
          const oldImgPath = path.join(UPLOADS_DIR, db.products[index].image);
          if (fs.existsSync(oldImgPath)) {
            try { fs.unlinkSync(oldImgPath); } catch {}
          }
        }
        imageName = newImg;
      }
    }

    db.products[index] = {
      ...db.products[index],
      categoryId: categoryId ?? db.products[index].categoryId,
      nameAr: nameAr ?? db.products[index].nameAr,
      nameEn: nameEn ?? db.products[index].nameEn,
      description: description ?? db.products[index].description,
      price: price !== undefined ? Number(price) : db.products[index].price,
      cost: cost !== undefined ? Number(cost) : db.products[index].cost,
      barcode: barcode ?? db.products[index].barcode,
      trackInventory: trackInventory !== undefined ? !!trackInventory : db.products[index].trackInventory,
      quantity: quantity !== undefined ? Number(quantity) : db.products[index].quantity,
      image: imageName
    };

    writeDB(db);
    writeAuditLog("تعديل صنف", "admin", "الإدارة", `تم تعديل الصنف: ${db.products[index].nameAr}`);
    res.json(db.products[index]);
  });

  app.delete("/api/products/:id", (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const index = db.products.findIndex((p: any) => p.id === id);
    if (index !== -1) {
      const name = db.products[index].nameAr;
      db.products[index].isActive = false;
      writeDB(db);
      writeAuditLog("حذف صنف", "admin", "الإدارة", `تم إزالة الصنف من المنيو: ${name}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "المنتج غير موجود" });
    }
  });

  // =============================================
  // إدارة الطاولات
  // =============================================
  app.get("/api/tables", (req, res) => {
    const db = readDB();
    res.json(db.restaurant_tables);
  });

  app.patch("/api/tables/:id/status", (req, res) => {
    const { id } = req.params;
    const { status, mergedWithTableId } = req.body;
    const db = readDB();
    const table = db.restaurant_tables.find((t: any) => t.id === id);
    if (table) {
      table.status = status;
      if (mergedWithTableId !== undefined) {
        table.mergedWithTableId = mergedWithTableId;
      }
      writeDB(db);
      res.json(table);
    } else {
      res.status(404).json({ error: "الطاولة غير موجودة" });
    }
  });

  app.post("/api/tables/merge", (req, res) => {
    const { mainTableId, mergeWithTableId } = req.body;
    const db = readDB();
    const mainTable = db.restaurant_tables.find((t: any) => t.id === mainTableId);
    const targetTable = db.restaurant_tables.find((t: any) => t.id === mergeWithTableId);
    if (mainTable && targetTable) {
      mainTable.status = "merged";
      mainTable.mergedWithTableId = mergeWithTableId;
      writeDB(db);
      res.json({ mainTable, targetTable });
    } else {
      res.status(404).json({ error: "إحدى الطاولات غير موجودة" });
    }
  });

  app.post("/api/tables/split", (req, res) => {
    const { tableId } = req.body;
    const db = readDB();
    const table = db.restaurant_tables.find((t: any) => t.id === tableId);
    if (table) {
      table.status = "free";
      table.mergedWithTableId = null;
      writeDB(db);
      res.json(table);
    } else {
      res.status(404).json({ error: "الطاولة غير موجودة" });
    }
  });

  app.post("/api/tables/transfer", (req, res) => {
    const { fromTableId, toTableId } = req.body;
    const db = readDB();
    const fromTable = db.restaurant_tables.find((t: any) => t.id === fromTableId);
    const toTable = db.restaurant_tables.find((t: any) => t.id === toTableId);
    if (fromTable && toTable) {
      toTable.status = "occupied";
      fromTable.status = "free";
      writeDB(db);
      res.json({ success: true, fromTable, toTable });
    } else {
      res.status(404).json({ error: "الطاولات المحددة غير صالحة" });
    }
  });

  // =============================================
  // إدارة الورديات (Shifts)
  // =============================================
  app.get("/api/shifts/active", (req, res) => {
    const db = readDB();
    const activeShift = db.shifts.find((s: any) => s.status === "open");
    res.json(activeShift || null);
  });

  app.post("/api/shifts/open", (req, res) => {
    const { cashierId, cashierName, openingCash, notes } = req.body;
    const db = readDB();
    const activeShift = db.shifts.find((s: any) => s.status === "open");
    if (activeShift) {
      return res.status(400).json({ error: "يوجد وردية مفتوحة بالفعل حاليًا", shift: activeShift });
    }

    const shiftNumber = db.shifts.length + 1;
    const newShift = {
      id: `sh-${Date.now()}`,
      shiftNumber,
      cashierId,
      cashierName,
      openingCash: Number(openingCash),
      notes,
      openedAt: new Date().toISOString(),
      status: "open"
    };
    db.shifts.push(newShift);
    writeDB(db);
    writeAuditLog("فتح وردية", cashierId, cashierName, `تم افتتاح الوردية رقم #${shiftNumber} برصيد نقدي: ${openingCash} ر.س`);
    res.json(newShift);
  });

  app.get("/api/shifts/:id/report", (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const shift = db.shifts.find((s: any) => s.id === id);
    if (!shift) {
      return res.status(404).json({ error: "الوردية غير موجودة" });
    }

    const shiftOrders = db.orders.filter((o: any) => o.shiftId === id && o.status === "completed");
    const totalSales = shiftOrders.reduce((sum: number, o: any) => sum + o.total, 0);
    const orderCount = shiftOrders.length;

    let cashSales = 0;
    let cardSales = 0;

    shiftOrders.forEach((o: any) => {
      o.payments.forEach((p: any) => {
        if (p.method === "cash") {
          cashSales += p.amount;
        } else if (p.method === "card") {
          cardSales += p.amount;
        }
      });
    });

    const expectedCash = shift.openingCash + cashSales;

    res.json({
      shift,
      totalSales,
      cashSales,
      cardSales,
      expectedCash,
      orderCount
    });
  });

  app.post("/api/shifts/:id/close", (req, res) => {
    const { id } = req.params;
    const { closingCash, expectedCash, cashDifference, notes } = req.body;
    const db = readDB();
    const index = db.shifts.findIndex((s: any) => s.id === id);
    if (index !== -1) {
      const shift = db.shifts[index];
      shift.status = "closed";
      shift.closedAt = new Date().toISOString();
      shift.closingCash = Number(closingCash);
      shift.expectedCash = Number(expectedCash);
      shift.cashDifference = Number(cashDifference);
      shift.notes = notes;
      writeDB(db);
      writeAuditLog("إغلاق وردية", shift.cashierId, shift.cashierName, `تم إغلاق الوردية رقم #${shift.shiftNumber} برصيد فعلي: ${closingCash} ر.س، المتوقع: ${expectedCash} ر.س، الفارق: ${cashDifference} ر.س`);
      res.json(shift);
    } else {
      res.status(404).json({ error: "الوردية غير موجودة" });
    }
  });

  app.get("/api/shifts", (req, res) => {
    const db = readDB();
    res.json(db.shifts);
  });

  // =============================================
  // الطلبات والمزامنة (Orders & Sync)
  // =============================================
  app.post("/api/orders/sync", (req, res) => {
    const order = req.body;
    const db = readDB();

    const shift = db.shifts.find((s: any) => s.id === order.shiftId);
    if (!shift && !order.ignoreShiftValidation) {
      return res.status(400).json({ error: "لا يوجد وردية صالحة لمزامنة الفاتورة عليها" });
    }

    const existingOrder = db.orders.find((o: any) => o.id === order.id);
    if (existingOrder) {
      return res.json({ success: true, duplicated: true, order: existingOrder });
    }

    const orderNumber = db.orders.length + 1;
    const syncedOrder = {
      ...order,
      orderNumber,
      syncedAt: new Date().toISOString()
    };

    db.orders.push(syncedOrder);
    writeAuditLog("إصدار فاتورة", order.cashierId || "system", order.cashierName || "كاشير", `تم إصدار الفاتورة رقم #${orderNumber} بقيمة إجمالية: ${order.total} ر.س (${order.orderType === "dine_in" ? "داخلي" : order.orderType === "takeaway" ? "سفري" : "توصيل"})`);

    syncedOrder.items.forEach((item: any) => {
      const prod = db.products.find((p: any) => p.id === item.productId);
      if (prod && prod.trackInventory) {
        prod.quantity = Math.max(0, (prod.quantity || 0) - item.quantity);
        db.inventory_transactions.push({
          id: `it-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
          inventoryItemId: prod.id,
          changeQty: -item.quantity,
          reason: `فاتورة بيع رقم ${orderNumber}`,
          orderId: order.id,
          createdBy: order.cashierId,
          createdAt: new Date().toISOString()
        });
      }
    });

    if (syncedOrder.orderType === "dine_in" && syncedOrder.tableId) {
      const table = db.restaurant_tables.find((t: any) => t.id === syncedOrder.tableId);
      if (table) {
        table.status = "free";
      }
    }

    writeDB(db);
    res.json({ success: true, order: syncedOrder });
  });

  app.get("/api/orders", (req, res) => {
    const db = readDB();
    res.json(db.orders);
  });

  // =============================================
  // آخر الفواتير + تفاصيل فاتورة + إعادة طباعة 🆕
  // =============================================
  app.get("/api/orders/latest", (req, res) => {
    const limit = parseInt(req.query.limit as string) || 20;
    const db = readDB();
    const sorted = [...db.orders]
      .filter((o: any) => o.status === "completed")
      .sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limit);
    res.json(sorted);
  });

  app.get("/api/orders/by-id/:id", (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const order = db.orders.find((o: any) => o.id === id);
    if (order) {
      res.json(order);
    } else {
      res.status(404).json({ error: "الفاتورة غير موجودة" });
    }
  });

  // =============================================
  // الطلبات المعلقة (Held Orders)
  // =============================================
  app.get("/api/orders/held", (req, res) => {
    const db = readDB();
    res.json(db.held_orders);
  });

  app.post("/api/orders/hold", (req, res) => {
    const { id, cashierId, cartSnapshot, tableId, customerId } = req.body;
    const db = readDB();
    const newHeld = {
      id: id || `ho-${Date.now()}`,
      cashierId,
      cartSnapshot,
      tableId,
      customerId,
      createdAt: new Date().toISOString()
    };

    if (tableId) {
      const table = db.restaurant_tables.find((t: any) => t.id === tableId);
      if (table) {
        table.status = "occupied";
      }
    }

    db.held_orders.push(newHeld);
    writeDB(db);
    res.json(newHeld);
  });

  app.delete("/api/orders/held/:id", (req, res) => {
    const { id } = req.params;
    const db = readDB();
    db.held_orders = db.held_orders.filter((ho: any) => ho.id !== id);
    writeDB(db);
    res.json({ success: true });
  });

  // =============================================
  // العملاء
  // =============================================
  app.get("/api/customers", (req, res) => {
    const { search } = req.query;
    const db = readDB();
    if (search) {
      const query = String(search).toLowerCase();
      const filtered = db.customers.filter(
        (c: any) => c.fullName.toLowerCase().includes(query) || c.phone.includes(query)
      );
      return res.json(filtered);
    }
    res.json(db.customers);
  });

  app.post("/api/customers", (req, res) => {
    const { fullName, phone, notes } = req.body;
    const db = readDB();
    const existing = db.customers.find((c: any) => c.phone === phone);
    if (existing) {
      return res.status(400).json({ error: "رقم هاتف العميل مسجل بالفعل" });
    }
    const newCustomer = {
      id: `cust-${Date.now()}`,
      fullName,
      phone,
      notes,
      createdAt: new Date().toISOString()
    };
    db.customers.push(newCustomer);
    writeDB(db);
    res.json(newCustomer);
  });

  // =============================================
  // المخزون
  // =============================================
  app.get("/api/inventory", (req, res) => {
    const db = readDB();
    res.json(db.inventory_items);
  });

  app.get("/api/reports/low-stock", (req, res) => {
    const db = readDB();
    const items = db.inventory_items.filter((item: any) => item.quantity <= item.lowStockThreshold);
    res.json(items);
  });

  // =============================================
  // الطباعة (Print Jobs)
  // =============================================
  app.post("/api/print/receipt", (req, res) => {
    const printJob = req.body;
    const db = readDB();
    const newJob = {
      id: `pj-${Date.now()}`,
      type: "receipt",
      data: printJob,
      createdAt: new Date().toISOString()
    };
    db.print_jobs.push(newJob);
    writeDB(db);
    res.json({ success: true, printJobId: newJob.id });
  });

  app.post("/api/print/kitchen", (req, res) => {
    const printJob = req.body;
    const db = readDB();
    const newJob = {
      id: `pj-${Date.now()}`,
      type: "kitchen",
      data: printJob,
      createdAt: new Date().toISOString()
    };
    db.print_jobs.push(newJob);
    writeDB(db);
    res.json({ success: true, printJobId: newJob.id });
  });

  app.get("/api/print/latest", (req, res) => {
    const db = readDB();
    res.json(db.print_jobs[db.print_jobs.length - 1] || null);
  });

  // =============================================
  // المستخدمون 🆕
  // =============================================
  app.get("/api/users", (req, res) => {
    const db = readDB();
    res.json(db.users);
  });

  // إضافة موظف جديد
  app.post("/api/users", (req, res) => {
    const { fullName, username, role, pinCode, password } = req.body;
    if (!fullName || !role || !pinCode) {
      return res.status(400).json({ error: "الرجاء تعبئة الحقول المطلوبة (الاسم الكامل، الدور، رمز PIN)" });
    }
    const db = readDB();
    const hashedPin = hashPIN(pinCode);
    if (db.users.some((u: any) => u.pinCode === hashedPin && u.isActive)) {
      return res.status(400).json({ error: "رمز PIN هذا مستخدم بالفعل من قبل موظف آخر" });
    }
    if (username && db.users.some((u: any) => u.username === username && u.isActive)) {
      return res.status(400).json({ error: "اسم المستخدم هذا موجود بالفعل" });
    }

    const newUser = {
      id: `u-${Date.now()}`,
      fullName,
      username: username || "",
      role,
      pinCode: hashedPin,
      passwordHash: password ? hashPIN(password) : hashedPin,
      isActive: true,
      createdAt: new Date().toISOString()
    };
    db.users.push(newUser);
    writeDB(db);
    writeAuditLog("إضافة موظف", "admin", "الإدارة", `تم إضافة موظف جديد: ${fullName} بدور: ${role}`);
    res.json({ success: true, user: newUser });
  });

  // تعديل موظف
  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { fullName, username, role, pinCode, password, isActive } = req.body;
    const db = readDB();
    const index = db.users.findIndex((u: any) => u.id === id);
    if (index === -1) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

    const user = db.users[index];
    if (fullName) user.fullName = fullName;
    if (username) user.username = username;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = !!isActive;
    
    if (pinCode) {
      user.pinCode = hashPIN(pinCode);
    }
    if (password) {
      user.passwordHash = hashPIN(password);
    }

    writeDB(db);
    writeAuditLog("تعديل موظف", "admin", "الإدارة", `تم تعديل بيانات الموظف: ${user.fullName}`);
    res.json({ success: true, user });
  });

  // حذف موظف (تعطيله)
  app.delete("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const db = readDB();
    const index = db.users.findIndex((u: any) => u.id === id);
    if (index !== -1) {
      const name = db.users[index].fullName;
      db.users[index].isActive = false;
      writeDB(db);
      writeAuditLog("حذف موظف", "admin", "الإدارة", `تم تعطيل/حذف الموظف: ${name}`);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "الموظف غير موجود" });
    }
  });

  // =============================================
  // سجل العمليات والتدقيق (Audit Logs) 🆕
  // =============================================
  app.get("/api/audit-logs", (req, res) => {
    const db = readDB();
    res.json(db.audit_logs || []);
  });

  // =============================================
  // التقارير المتقدمة 🆕
  // =============================================

  // دالة مساعدة لتصفية الطلبات بنطاق تاريخ
  function filterOrdersByDateRange(orders: any[], from: string, to: string) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    return orders.filter((o: any) => {
      const d = new Date(o.createdAt);
      return d >= fromDate && d <= toDate && o.status === "completed";
    });
  }

  // تقرير بنطاق تاريخ مخصص
  app.get("/api/reports/date-range", (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) {
      return res.status(400).json({ error: "يرجى تحديد from و to" });
    }
    const db = readDB();
    const filtered = filterOrdersByDateRange(db.orders, from as string, to as string);
    const summary = calculateOrdersSummary(db, filtered);
    res.json(summary);
  });

  // تقرير شهري
  app.get("/api/reports/monthly", (req, res) => {
    const year = parseInt(req.query.year as string) || new Date().getFullYear();
    const month = parseInt(req.query.month as string) || (new Date().getMonth() + 1);
    const from = `${year}-${String(month).padStart(2, "0")}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const to = `${year}-${String(month).padStart(2, "0")}-${lastDay}`;
    
    const db = readDB();
    const filtered = filterOrdersByDateRange(db.orders, from, to);
    const summary = calculateOrdersSummary(db, filtered);
    res.json({ ...summary, year, month, from, to });
  });

  // تقرير يومي
  app.get("/api/reports/daily", (req, res) => {
    const date = (req.query.date as string) || new Date().toISOString().split("T")[0];
    const db = readDB();
    const filtered = filterOrdersByDateRange(db.orders, date, date);
    const summary = calculateOrdersSummary(db, filtered);
    res.json({ ...summary, date });
  });

  // ملخص المدير اللحظي 🆕
  app.get("/api/manager/summary", (req, res) => {
    const db = readDB();
    const today = new Date().toISOString().split("T")[0];
    const todayOrders = filterOrdersByDateRange(db.orders, today, today);
    const summary = calculateOrdersSummary(db, todayOrders);
    const activeShift = db.shifts.find((s: any) => s.status === "open");
    const lowStock = db.inventory_items.filter((item: any) => item.quantity <= item.lowStockThreshold);

    res.json({
      ...summary,
      activeShift: activeShift || null,
      lowStockItems: lowStock,
      todayOrderCount: todayOrders.length,
      settings: db.settings
    });
  });

  // دالة حساب ملخص الطلبات المشتركة
  function calculateOrdersSummary(db: any, orders: any[]) {
    const totalSales = orders.reduce((sum: number, o: any) => sum + o.total, 0);
    const totalCost = orders.reduce((sum: number, o: any) => {
      return sum + o.items.reduce((itemSum: number, item: any) => {
        const prod = db.products.find((p: any) => p.id === item.productId);
        return itemSum + (prod ? prod.cost * item.quantity : 0);
      }, 0);
    }, 0);

    const profit = totalSales - totalCost;
    const totalTax = orders.reduce((sum: number, o: any) => sum + (o.taxAmount || 0), 0);
    const avgOrderValue = orders.length > 0 ? totalSales / orders.length : 0;

    let cashSales = 0;
    let cardSales = 0;
    orders.forEach((o: any) => {
      (o.payments || []).forEach((p: any) => {
        if (p.method === "cash") cashSales += p.amount;
        else if (p.method === "card") cardSales += p.amount;
      });
    });

    // مبيعات حسب التصنيف
    const categorySalesMap: any = {};
    orders.forEach((o: any) => {
      o.items.forEach((item: any) => {
        const prod = db.products.find((p: any) => p.id === item.productId);
        const catId = prod ? prod.categoryId : "other";
        const cat = db.categories.find((c: any) => c.id === catId);
        const catName = cat ? cat.nameAr : "تصنيفات أخرى";
        categorySalesMap[catName] = (categorySalesMap[catName] || 0) + item.lineTotal;
      });
    });
    const categorySales = Object.keys(categorySalesMap).map((name) => ({
      name,
      value: categorySalesMap[name]
    }));

    // مبيعات يومية للرسم البياني
    const dailySalesMap: any = {};
    orders.forEach((o: any) => {
      const dateStr = o.createdAt.split("T")[0];
      dailySalesMap[dateStr] = (dailySalesMap[dateStr] || 0) + o.total;
    });
    const sortedDates = Object.keys(dailySalesMap).sort();
    const chartData = sortedDates.map((date) => ({
      date,
      sales: dailySalesMap[date]
    }));

    // أداء الموظفين
    const waiterSalesMap: any = {};
    orders.forEach((o: any) => {
      const waiter = db.users.find((u: any) => u.id === o.waiterId || u.id === o.cashierId);
      const waiterName = waiter ? waiter.fullName : "الكاشير العام";
      waiterSalesMap[waiterName] = (waiterSalesMap[waiterName] || 0) + o.total;
    });
    const staffPerformance = Object.keys(waiterSalesMap).map((name) => ({
      name,
      sales: waiterSalesMap[name]
    }));

    // المنتجات الأكثر مبيعاً
    const productSalesMap: any = {};
    orders.forEach((o: any) => {
      o.items.forEach((item: any) => {
        productSalesMap[item.productNameSnapshot] = (productSalesMap[item.productNameSnapshot] || 0) + item.quantity;
      });
    });
    const topSelling = Object.keys(productSalesMap)
      .map((name) => ({ name, qty: productSalesMap[name] }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      totalSales,
      totalCost,
      profit,
      totalTax,
      avgOrderValue,
      orderCount: orders.length,
      cashSales,
      cardSales,
      categorySales,
      chartData,
      staffPerformance,
      topSelling
    };
  }

  // تقرير ملخص المبيعات العام (التوافقية مع الكود القديم)
  app.get("/api/reports/sales-summary", (req, res) => {
    const db = readDB();
    const completedOrders = db.orders.filter((o: any) => o.status === "completed");
    const summary = calculateOrdersSummary(db, completedOrders);
    res.json(summary);
  });

  // معلومات النظام 🆕
  app.get("/api/system/info", (req, res) => {
    const db = readDB();
    res.json({
      appName: "كاشي",
      version: "1.0.0",
      dbPath: DB_FILE,
      settings: db.settings,
      totalUsers: db.users.length,
      totalProducts: db.products.filter((p: any) => p.isActive).length,
      totalOrders: db.orders.length
    });
  });

  // =============================================
  // خدمة واجهة المستخدم الكاشير (React dist) 🆕
  // =============================================
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));

  // =============================================
  // خدمة لوحة تحكم المدير عن بُعد 🆕
  // =============================================
  const managerStaticPath = path.join(__dirname, "..", "public", "manager");
  app.use("/manager", express.static(managerStaticPath));
  app.get("/manager", (req, res) => {
    const managerPath = path.join(managerStaticPath, "index.html");
    if (fs.existsSync(managerPath)) {
      res.sendFile(managerPath);
    } else {
      res.status(404).send("<h1>لوحة تحكم المدير غير متوفرة</h1>");
    }
  });

  // توجيه باقي المسارات لواجهة React (SPA Routing)
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api") || req.path.startsWith("/manager")) {
      return next();
    }
    const indexPath = path.join(distPath, "index.html");
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      next();
    }
  });

  // معالج أخطاء عام لـ Express (Global Error Handler)
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    const errMsg = `خطأ أثناء معالجة الطلب ${req.method} ${req.url}`;
    console.error(errMsg, err);
    logError(errMsg, err);
    res.status(500).json({ error: "حدث خطأ داخلي في الخادم. تم تسجيل الخطأ في السجلات الفنية." });
  });

  // =============================================
  // دالة بدء تشغيل السيرفر
  // =============================================
  function start(port: number): Promise<http.Server> {
    return new Promise((resolve, reject) => {
      try {
        const server = app.listen(port, "0.0.0.0", () => {
          console.log(`✅ كاشي POS Server يعمل على http://localhost:${port}`);
          console.log(`📊 لوحة تحكم المدير: http://localhost:${port}/manager`);
          resolve(server);
        });
        server.on("error", reject);
      } catch (e) {
        reject(e);
      }
    });
  }

  return { app, start };
}

// =============================================
// التشغيل المباشر (وضع التطوير بدون Electron)
// =============================================
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith("server.ts") || 
  process.argv[1].endsWith("server.js") ||
  process.argv[1].endsWith("server.cjs")
);

if (isDirectRun) {
  (async () => {
    const { createServer: createViteServer } = await import("vite");
    const { app: expressApp, start } = createServer();
    
    // في وضع التطوير: استخدام Vite middleware
    if (process.env.NODE_ENV !== "production") {
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa"
      });
      expressApp.use(vite.middlewares);
    } else {
      const distPath = path.join(process.cwd(), "dist");
      expressApp.use(express.static(distPath));
      expressApp.get("*", (req, res) => {
        res.sendFile(path.join(distPath, "index.html"));
      });
    }

    await start(3000);
  })();
}
