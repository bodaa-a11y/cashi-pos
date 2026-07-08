import express from "express";
import path from "path";
import fs from "fs";
import { MongoClient } from "mongodb";
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
// مفتاح التوقيع المشترك (HMAC Secret) - عشوائي عند البدء لزيادة الأمان
// =============================================
const JWT_SECRET = crypto.randomBytes(32).toString("hex");

// =============================================
// دوال التشفير المخصصة بأملاح فريدة (Per-User Salted Hashing)
// =============================================
function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

function hashWithSalt(input: any, salt: string): string {
  const inputStr = String(input || "");
  return crypto.createHmac("sha256", salt).update(inputStr).digest("hex");
}

// دالة توقيع التوكن بنظام HMAC للتأمين ومنع التلاعب
function generateToken(payload: { id: string; username: string; role: string }): string {
  const expiry = Date.now() + 12 * 60 * 60 * 1000; // صلاحية التوكن 12 ساعة
  const data = JSON.stringify({ ...payload, expiry });
  const dataBase64 = Buffer.from(data).toString("base64");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(dataBase64).digest("hex");
  return `${dataBase64}.${signature}`;
}

// التحقق من صحة التوكن ومطابقة التوقيع
function verifyToken(token: string): { id: string; username: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [dataBase64, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(dataBase64).digest("hex");
    if (signature !== expectedSignature) return null;
    const data = JSON.parse(Buffer.from(dataBase64, "base64").toString("utf-8"));
    if (data.expiry < Date.now()) return null; // منتهي الصلاحية
    return data;
  } catch (e) {
    return null;
  }
}

// لضمان التوافقية القديمة
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
let cachedDB: any = null;
let mongoCollection: any = null;

function getSeedData() {
  return {
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
    recipes: [],
    print_jobs: [],
    audit_logs: []
  };
}

function readLocalDBOnly() {
  if (!fs.existsSync(DB_FILE)) {
    const seedData = getSeedData();
    fs.writeFileSync(DB_FILE, JSON.stringify(seedData, null, 2), "utf-8");
    return seedData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    console.error("Error reading db.json, using fallback seed data:", e);
    return getSeedData();
  }
}

function loadLocalDB() {
  cachedDB = readLocalDBOnly();
}

async function initCloudDB() {
  const mongoUri = process.env.MONGODB_URI;
  if (mongoUri) {
    console.log("🔗 [كاشي سحابي] جاري الاتصال بقاعدة بيانات MongoDB السحابية...");
    try {
      const client = new MongoClient(mongoUri);
      await client.connect();
      const db = client.db(process.env.MONGODB_DB || "cashi_db");
      mongoCollection = db.collection("cashi_pos_state");
      
      const doc = await mongoCollection.findOne({ _id: "cashi_pos" });
      if (doc && doc.data) {
        cachedDB = doc.data;
        console.log("✅ [كاشي سحابي] تم تحميل البيانات بنجاح من MongoDB.");
      } else {
        console.log("🌱 [كاشي سحابي] لم يتم العثور على بيانات سابقة. جاري تهيئة قاعدة البيانات بالبيانات الافتراضية...");
        cachedDB = readLocalDBOnly();
        await mongoCollection.updateOne({ _id: "cashi_pos" }, { $set: { data: cachedDB } }, { upsert: true });
        console.log("✅ [كاشي سحابي] تم رفع البيانات الافتراضية إلى MongoDB.");
      }
    } catch (err) {
      console.error("❌ [كاشي سحابي] فشل الاتصال بـ MongoDB. سيتم استخدام قاعدة البيانات المحلية:", err);
      loadLocalDB();
    }
  } else {
    loadLocalDB();
  }
}

function readDB() {
  if (!cachedDB) {
    loadLocalDB();
  }
  return cachedDB;
}

function writeDB(data: any) {
  cachedDB = data;
  if (mongoCollection) {
    mongoCollection.updateOne({ _id: "cashi_pos" }, { $set: { data: cachedDB } }, { upsert: true }).catch((err: any) => {
      console.error("❌ [كاشي سحابي] فشل حفظ التعديلات في MongoDB:", err);
    });
  } else {
    fs.writeFileSync(DB_FILE, JSON.stringify(cachedDB, null, 2), "utf-8");
  }
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
  // ميدلوير التحقق من الصلاحيات (Authentication Middleware)
  // =============================================
  function authenticate(allowedRoles: string[]) {
    return (req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      if (!authHeader) {
        const isLocal = req.ip === "127.0.0.1" || req.ip === "::1" || req.ip === "::ffff:127.0.0.1";
        if (isLocal) {
          return next();
        }
        return res.status(401).json({ error: "غير مصرح: يجب تسجيل الدخول أولاً" });
      }

      const token = authHeader.split(" ")[1];
      if (!token) {
        return res.status(401).json({ error: "غير مصرح: صيغة التوكن غير صالحة" });
      }

      const match = token.match(/(?:jwt|manager)-token-(.+)/);
      if (!match) {
        return res.status(401).json({ error: "غير مصرح: توكن غير صالح" });
      }

      const userId = match[1];
      const db = readDB();
      const user = db.users.find((u: any) => u.id === userId && u.isActive);

      if (!user) {
        return res.status(401).json({ error: "غير مصرح: المستخدم غير موجود أو تم تعطيله" });
      }

      if (allowedRoles && !allowedRoles.includes(user.role)) {
        return res.status(403).json({ error: "غير مصرح: ليس لديك الصلاحيات الكافية للقيام بهذا الإجراء" });
      }

      req.user = user;
      next();
    };
  }

  // =============================================
  // المصادقة (Auth)
  // =============================================
  app.post("/api/auth/login", (req, res) => {
    const { username, password } = req.body;
    const db = readDB();
    const user = db.users.find((u: any) => {
      if (u.username !== username || !u.isActive) return false;
      if (u.passwordSalt) {
        return u.passwordHash === hashWithSalt(password, u.passwordSalt);
      }
      return u.passwordHash === hashPIN(password);
    });
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
    const user = db.users.find((u: any) => {
      if (!u.isActive) return false;
      if (u.pinSalt) {
        return u.pinHash === hashWithSalt(pin, u.pinSalt);
      }
      return u.pinCode === hashPIN(pin);
    });
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
    const user = db.users.find((u: any) => {
      if (!u.isActive || (u.role !== "admin" && u.role !== "manager")) return false;
      if (u.pinSalt) {
        return u.pinHash === hashWithSalt(pin, u.pinSalt);
      }
      return u.pinCode === hashPIN(pin);
    });
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
      // 1. البحث عن وصفة للمنتج
      const recipe = db.recipes ? db.recipes.find((r: any) => r.productId === item.productId) : null;
      if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
        recipe.ingredients.forEach((ing: any) => {
          const rawItem = db.inventory_items.find((i: any) => i.id === ing.inventoryItemId);
          if (rawItem) {
            const consumed = ing.amount * item.quantity;
            rawItem.quantity = Math.max(0, rawItem.quantity - consumed);
            db.inventory_transactions.push({
              id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              inventoryItemId: rawItem.id,
              changeQty: -consumed,
              reason: `بيع منتج (${item.productNameSnapshot}) فاتورة #${orderNumber}`,
              orderId: order.id,
              createdBy: order.cashierId,
              createdAt: new Date().toISOString()
            });
          }
        });
      } else {
        // 2. إذا لم توجد وصفة، نفترض التتبع البسيط للمنتج نفسه (سلوك قديم)
        const prod = db.products.find((p: any) => p.id === item.productId);
        if (prod && prod.trackInventory) {
          prod.quantity = Math.max(0, (prod.quantity || 0) - item.quantity);
          db.inventory_transactions.push({
            id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            inventoryItemId: prod.id,
            changeQty: -item.quantity,
            reason: `فاتورة بيع رقم ${orderNumber}`,
            orderId: order.id,
            createdBy: order.cashierId,
            createdAt: new Date().toISOString()
          });
        }
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
    res.json(db.inventory_items || []);
  });

  app.post("/api/inventory", (req, res) => {
    const db = readDB();
    const newItem = {
      id: `i-${Date.now()}`,
      nameAr: req.body.nameAr,
      unit: req.body.unit,
      quantity: Number(req.body.quantity) || 0,
      lowStockThreshold: Number(req.body.lowStockThreshold) || 0
    };
    db.inventory_items.push(newItem);
    writeDB(db);
    res.json({ success: true, item: newItem });
  });

  app.put("/api/inventory/:id", (req, res) => {
    const db = readDB();
    const item = db.inventory_items.find((i: any) => i.id === req.params.id);
    if (item) {
      const oldQty = item.quantity;
      item.nameAr = req.body.nameAr !== undefined ? req.body.nameAr : item.nameAr;
      item.unit = req.body.unit !== undefined ? req.body.unit : item.unit;
      item.quantity = req.body.quantity !== undefined ? Number(req.body.quantity) : item.quantity;
      item.lowStockThreshold = req.body.lowStockThreshold !== undefined ? Number(req.body.lowStockThreshold) : item.lowStockThreshold;
      
      const diff = item.quantity - oldQty;
      if (diff !== 0) {
        db.inventory_transactions.push({
          id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          inventoryItemId: item.id,
          changeQty: diff,
          reason: req.body.reason || "تعديل يدوي للمخزون",
          createdBy: "admin",
          createdAt: new Date().toISOString()
        });
      }
      writeDB(db);
      res.json({ success: true, item });
    } else {
      res.status(404).json({ error: "المادة الخام غير موجودة" });
    }
  });

  app.delete("/api/inventory/:id", (req, res) => {
    const db = readDB();
    const index = db.inventory_items.findIndex((i: any) => i.id === req.params.id);
    if (index !== -1) {
      db.inventory_items.splice(index, 1);
      
      // Also clean up any recipes using this inventory item
      if (db.recipes) {
        db.recipes.forEach((r: any) => {
          r.ingredients = r.ingredients.filter((ing: any) => ing.inventoryItemId !== req.params.id);
        });
      }
      
      writeDB(db);
      res.json({ success: true });
    } else {
      res.status(404).json({ error: "المادة الخام غير موجودة" });
    }
  });

  app.get("/api/recipes", (req, res) => {
    const db = readDB();
    res.json(db.recipes || []);
  });

  app.post("/api/recipes", (req, res) => {
    const db = readDB();
    if (!db.recipes) db.recipes = [];
    
    const { productId, ingredients } = req.body;
    const index = db.recipes.findIndex((r: any) => r.productId === productId);
    
    const recipe = {
      productId,
      ingredients: (ingredients || []).map((ing: any) => ({
        inventoryItemId: ing.inventoryItemId,
        amount: Number(ing.amount) || 0
      }))
    };
    
    if (index !== -1) {
      db.recipes[index] = recipe;
    } else {
      db.recipes.push(recipe);
    }
    writeDB(db);
    res.json({ success: true, recipe });
  });

  app.get("/api/reports/low-stock", (req, res) => {
    const db = readDB();
    const items = (db.inventory_items || []).filter((item: any) => item.quantity <= item.lowStockThreshold);
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
    
    // Check for duplicate PIN
    const pinDuplicate = db.users.some((u: any) => {
      if (!u.isActive) return false;
      if (u.pinSalt) {
        return hashWithSalt(pinCode, u.pinSalt) === u.pinHash;
      }
      return u.pinCode === hashPIN(pinCode);
    });
    if (pinDuplicate) {
      return res.status(400).json({ error: "رمز PIN هذا مستخدم بالفعل من قبل موظف آخر" });
    }
    if (username && db.users.some((u: any) => u.username === username && u.isActive)) {
      return res.status(400).json({ error: "اسم المستخدم هذا موجود بالفعل" });
    }

    const pinSalt = generateSalt();
    const passwordSalt = generateSalt();

    const newUser = {
      id: `u-${Date.now()}`,
      fullName,
      username: username || "",
      role,
      pinSalt,
      pinHash: hashWithSalt(pinCode, pinSalt),
      passwordSalt,
      passwordHash: password ? hashWithSalt(password, passwordSalt) : hashWithSalt(pinCode, passwordSalt),
      isActive: true,
      createdAt: new Date().toISOString()
    };

    db.users.push(newUser);
    writeDB(db);
    writeAuditLog("إضافة موظف", "admin", "المدير", `تم إضافة موظف جديد: ${fullName} بدور: ${role}`);
    res.json({ success: true, user: newUser });
  });

  // تعديل موظف
  app.put("/api/users/:id", (req, res) => {
    const { id } = req.params;
    const { fullName, username, role, pinCode, password, isActive } = req.body;
    const db = readDB();
    const user = db.users.find((u: any) => u.id === id);
    if (!user) {
      return res.status(404).json({ error: "الموظف غير موجود" });
    }

    if (fullName) user.fullName = fullName;
    if (username) user.username = username;
    if (role) user.role = role;
    if (isActive !== undefined) user.isActive = !!isActive;
    
    if (pinCode) {
      if (!user.pinSalt) user.pinSalt = generateSalt();
      user.pinHash = hashWithSalt(pinCode, user.pinSalt);
    }
    if (password) {
      if (!user.passwordSalt) user.passwordSalt = generateSalt();
      user.passwordHash = hashWithSalt(password, user.passwordSalt);
    }

    writeDB(db);
    writeAuditLog("تعديل موظف", "admin", "المدير", `تم تعديل بيانات الموظف: ${user.fullName}`);
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
    const { from, to, transactionType } = req.query;
    const db = readDB();
    
    let completedOrders = db.orders.filter((o: any) => o.status === "completed");
    
    // 1. الفلترة بالتاريخ إذا تم تمريره
    if (from && to) {
      completedOrders = filterOrdersByDateRange(db.orders, from as string, to as string);
    }

    // 2. الفلترة بنوع الدفع / المعاملة
    if (transactionType && transactionType !== "all") {
      completedOrders = completedOrders.filter((o: any) => {
        if (transactionType === "cash") {
          return (o.payments || []).some((p: any) => p.method === "cash");
        }
        if (transactionType === "card") {
          return (o.payments || []).some((p: any) => p.method === "card");
        }
        if (transactionType === "delivery") {
          return o.orderType === "takeaway";
        }
        return true;
      });
    }

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

  // ─── Cloud Sync Endpoints (Central Cloud Server mode) ───
  app.post("/api/cloud-sync/test", (req, res) => {
    res.json({ success: true, message: "تم الاتصال بنجاح بسيرفر كاشي السحابي!" });
  });

  app.post("/api/cloud-sync/orders", (req, res) => {
    const { branchId, orders } = req.body;
    if (!orders || !Array.isArray(orders)) {
      return res.status(400).json({ error: "بيانات فواتير غير صالحة" });
    }

    try {
      const db = readDB();
      let newCount = 0;
      
      orders.forEach((order: any) => {
        order.branchId = branchId || "main";
        
        const exists = db.orders.some((o: any) => o.id === order.id);
        if (!exists) {
          db.orders.push(order);
          newCount++;
        }
      });

      if (newCount > 0) {
        writeDB(db);
        writeAuditLog("مزامنة سحابية", "cloud", "السحابة", `تم مزامنة ${newCount} فاتورة جديدة من الفرع: ${branchId}`);
      }

      res.json({ success: true, syncedCount: newCount });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/cloud-sync/menu", (req, res) => {
    const db = readDB();
    res.json({
      categories: db.categories,
      products: db.products
    });
  });

  // ─── Local Client test endpoint ───
  app.post("/api/settings/test-cloud-sync", authenticate(["admin", "manager"]), async (req, res) => {
    const { cloudApiUrl, cloudAuthToken, branchId } = req.body;
    if (!cloudApiUrl) {
      return res.status(400).json({ error: "الرجاء إدخال رابط المزامنة" });
    }

    try {
      const testUrl = `${cloudApiUrl.replace(/\/$/, "")}/api/cloud-sync/test`;
      const response = await fetch(testUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${cloudAuthToken}`
        },
        body: JSON.stringify({ branchId })
      });

      if (response.ok) {
        const data = await response.json();
        return res.json({ success: true, message: data.message || "تم الاتصال بنجاح" });
      } else {
        return res.status(400).json({ error: `فشل الاتصال: رمز الاستجابة ${response.status}` });
      }
    } catch (err: any) {
      return res.status(500).json({ error: `فشل الاتصال: ${err.message}` });
    }
  });

  function startCloudSyncLoop() {
    setInterval(async () => {
      try {
        const db = readDB();
        const settings = db.settings;
        if (!settings || !settings.cloudSyncEnabled || !settings.cloudApiUrl) {
          return;
        }

        const unsyncedOrders = db.orders.filter((o: any) => o.cloudSynced === false);
        if (unsyncedOrders.length > 0) {
          console.log(`[كاشي سحابي] 🔄 جاري مزامنة ${unsyncedOrders.length} فاتورة مع السحابة...`);
          const syncUrl = `${settings.cloudApiUrl.replace(/\/$/, "")}/api/cloud-sync/orders`;
          
          const response = await fetch(syncUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${settings.cloudAuthToken}`,
              "X-Branch-ID": settings.branchId || "main"
            },
            body: JSON.stringify({
              branchId: settings.branchId || "main",
              orders: unsyncedOrders
            })
          });

          if (response.ok) {
            const resData = await response.json();
            if (resData.success) {
              console.log(`[كاشي سحابي] ✅ تم مزامنة الفواتير بنجاح.`);
              const dbToUpdate = readDB();
              unsyncedOrders.forEach((order: any) => {
                const localOrder = dbToUpdate.orders.find((o: any) => o.id === order.id);
                if (localOrder) {
                  localOrder.cloudSynced = true;
                  localOrder.cloudSyncedAt = new Date().toISOString();
                }
              });
              writeDB(dbToUpdate);
            }
          } else {
            console.warn(`[كاشي سحابي] ⚠️ فشلت مزامنة الفواتير. رمز الحالة: ${response.status}`);
          }
        }
      } catch (e) {
        console.error("[كاشي سحابي] ❌ خطأ في محرك المزامنة:", e);
      }
    }, 30000); // 30 seconds
  }

  // =============================================
  // دالة بدء تشغيل السيرفر
  // =============================================
  async function start(port: number): Promise<http.Server> {
    await initCloudDB();
    if (!process.env.MONGODB_URI) {
      startCloudSyncLoop();
    }

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
