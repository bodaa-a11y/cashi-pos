import fs from "fs";
import path from "path";
import { MongoClient } from "mongodb";
import { generateSalt, hashWithSalt, hashPIN } from "../utils/hashing";

export let DB_FILE = path.join(process.cwd(), "db.json");
export let UPLOADS_DIR = path.join(process.cwd(), "uploads");
export let BACKUPS_DIR = path.join(process.cwd(), "backups");
export let LOGS_DIR = path.join(process.cwd(), "logs");

export let cachedDB: any = null;
export let mongoCollection: any = null;

// طابور كتابة متزامن لمنع التضارب وحوادث الكتابة المتوازية (In-Memory Sequential Promise Queue)
let writePromiseChain = Promise.resolve();

function queueWrite(writeOp: () => Promise<void> | void): Promise<void> {
  writePromiseChain = writePromiseChain.then(async () => {
    try {
      await writeOp();
    } catch (err) {
      console.error("❌ [كاشي] فشل إتمام عملية الكتابة المجدولة في الطابور:", err);
    }
  });
  return writePromiseChain;
}

export function logError(message: string, error?: any) {
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

export function getSeedData() {
  const cashierSalt = generateSalt();
  const adminSalt = generateSalt();
  const managerSalt = generateSalt();
  const waiter1Salt = generateSalt();
  const waiter2Salt = generateSalt();
  return {
    settings: null,
    users: [
      { id: "u-1", fullName: "أحمد كاشير", username: "cashier", role: "cashier", pinSalt: cashierSalt, pinHash: hashWithSalt("1234", cashierSalt), passwordSalt: cashierSalt, passwordHash: hashWithSalt("1234", cashierSalt), isActive: true, createdAt: new Date().toISOString() },
      { id: "u-2", fullName: "سليمان أدمن", username: "admin", role: "admin", pinSalt: adminSalt, pinHash: hashWithSalt("0000", adminSalt), passwordSalt: adminSalt, passwordHash: hashWithSalt("0000", adminSalt), isActive: true, createdAt: new Date().toISOString() },
      { id: "u-3", fullName: "خالد مدير", username: "manager", role: "manager", pinSalt: managerSalt, pinHash: hashWithSalt("2222", managerSalt), passwordSalt: managerSalt, passwordHash: hashWithSalt("2222", managerSalt), isActive: true, createdAt: new Date().toISOString() },
      { id: "u-4", fullName: "يوسف نادل", username: "waiter", role: "waiter", pinSalt: waiter1Salt, pinHash: hashWithSalt("1111", waiter1Salt), isActive: true, createdAt: new Date().toISOString() },
      { id: "u-5", fullName: "سارة نادلة", username: "waiter2", role: "waiter", pinSalt: waiter2Salt, pinHash: hashWithSalt("3333", waiter2Salt), isActive: true, createdAt: new Date().toISOString() }
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
      { id: "p-3", categoryId: "c-1", nameAr: "برجر دبل بقر بالجبن", nameEn: "Double Beef Burger", description: "شريحتين لحم بقري مشوي مع الجبن والخضار والصلصة المميزة", price: 24.00, cost: 11.50, barcode: "62811003", isActive: true, trackInventory: true, quantity: 45, image: null },
      { id: "p-4", categoryId: "c-2", nameAr: "ورق عنب بالزيت والليمون", nameEn: "Stuffed Grape Leaves", description: "ورق عنب محشي أرز وخضروات مطبوخ بزيت الزيتون ودبس الرمان", price: 12.00, cost: 4.00, barcode: "62811004", isActive: true, trackInventory: true, quantity: 100, image: null },
      { id: "p-5", categoryId: "c-2", nameAr: "حمص باللحم المفروم واللوز", nameEn: "Hummus with Meat", description: "حمص ناعم مغطى باللحم المفروم الساخن واللوز المحمص وزيت الزيتون", price: 15.00, cost: 6.00, barcode: "62811005", isActive: true, trackInventory: true, quantity: 40, image: null },
      { id: "p-6", categoryId: "c-2", nameAr: "سلطة فتوش بالرمان", nameEn: "Fattoush Salad", description: "خضار طازجة مع قطع الخبز المقرمش ودبس الرمان السماق والليمون", price: 10.00, cost: 3.00, barcode: "62811006", isActive: true, trackInventory: true, quantity: 60, image: null },
      { id: "p-7", categoryId: "c-3", nameAr: "بيبسي علبة بارد", nameEn: "Pepsi", description: "مشروب غازي بيبسي علبة 325 مل", price: 3.00, cost: 1.50, barcode: "62811007", isActive: true, trackInventory: true, quantity: 200, image: null },
      { id: "p-8", categoryId: "c-3", nameAr: "عصير برتقال خلاط طازج", nameEn: "Fresh Orange Juice", description: "عصير برتقال طبيعي معصور طازج بدون سكر مضاف", price: 10.00, cost: 3.50, barcode: "62811008", isActive: true, trackInventory: true, quantity: 80, image: null },
      { id: "p-9", categoryId: "c-3", nameAr: "مياه معدنية أروى صغيرة", nameEn: "Mineral Water", description: "مياه شرب معبأة مبردة 330 مل", price: 1.50, cost: 0.50, barcode: "62811009", isActive: true, trackInventory: true, quantity: 500, image: null },
      { id: "p-10", categoryId: "c-4", nameAr: "شاي أحمر كبوس بالنعناع", nameEn: "Red Tea", description: "شاي أحمر ساخن محضر بالنعناع الطازج في الكوب", price: 2.00, cost: 0.40, barcode: "62811010", isActive: true, trackInventory: true, quantity: 300, image: null },
      { id: "p-11", categoryId: "c-4", nameAr: "قهوة تركي بالحليب والهيل", nameEn: "Turkish Coffee", description: "قهوة تركية محضرة على الرمل مع الحليب والهيل المطحون", price: 7.00, cost: 1.80, barcode: "62811011", isActive: true, trackInventory: true, quantity: 150, image: null },
      { id: "p-12", categoryId: "c-5", nameAr: "كنافة نابلسية بالجبن القشدي", nameEn: "Konafa", description: "كنافة ساخنة بالجبن النابلسي المطاطي والفستق والقطر", price: 12.00, cost: 5.00, barcode: "62811012", isActive: true, trackInventory: true, quantity: 35, image: null }
    ],
    restaurant_tables: [
      { id: "t-1", nameAr: "طاولة 1 (عائلات)", nameEn: "Table 1 (Family)", seats: 4, status: "free" },
      { id: "t-2", nameAr: "طاولة 2 (شباب)", nameEn: "Table 2 (Single)", seats: 2, status: "free" },
      { id: "t-3", nameAr: "طاولة 3 (عائلات)", nameEn: "Table 3 (Family)", seats: 6, status: "free" },
      { id: "t-4", nameAr: "طاولة 4 (شباب)", nameEn: "Table 4 (Single)", seats: 4, status: "free" },
      { id: "t-5", nameAr: "طاولة 5 (شباب)", nameEn: "Table 5 (Single)", seats: 2, status: "free" }
    ],
    orders: [],
    held_orders: [],
    shifts: [],
    customers: [
      { id: "cust-1", name: "عميل نقدي افتراضي", phone: "0500000000", email: "", points: 0,
        loyaltyPoints: 0, creditBalance: 0, totalSpent: 0, visitsCount: 0, notes: "",
        createdAt: new Date().toISOString() }
    ],
    customer_ledger: [],
    inventory_items: [],
    inventory_transactions: [],
    suppliers: [],
    purchase_orders: [],
    recipes: [],
    print_jobs: [],
    audit_logs: []
  };
}

export function readLocalDBOnly() {
  if (DB_FILE.includes(process.cwd()) && !process.env.NODE_ENV?.includes("test")) {
    console.warn("⚠️ [تحذير كاشي] قاعدة البيانات تعمل بمسار نسبي داخل مجلد المشروع! هذا خطير في بيئة الإنتاج وقد يؤدي لفقدان البيانات.");
  }
  if (!fs.existsSync(DB_FILE)) {
    const seedData = getSeedData();
    const tempPath = `${DB_FILE}.tmp`;
    fs.writeFileSync(tempPath, JSON.stringify(seedData, null, 2), "utf-8");
    fs.renameSync(tempPath, DB_FILE);
    return seedData;
  }
  try {
    return JSON.parse(fs.readFileSync(DB_FILE, "utf-8"));
  } catch (e) {
    console.error("Error reading db.json, using fallback seed data:", e);
    return getSeedData();
  }
}

export function loadLocalDB() {
  cachedDB = readLocalDBOnly();
}

export async function initCloudDB() {
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

export function readDB() {
  if (!cachedDB) {
    loadLocalDB();
  }
  return cachedDB;
}

export function writeDB(data: any) {
  cachedDB = data;
  
  // جدولة الكتابة الفعلية في الطابور المتسلسل لمنع lost writes
  queueWrite(async () => {
    if (mongoCollection) {
      // TODO: النظام السحابي يخزن كامل قاعدة البيانات بمستند واحد {_id: "cashi_pos", data: cachedDB}
      // مخاطرة: مع نمو المبيعات (orders) وسجلات العمليات (audit_logs)، سيصطدم المستند بحد MongoDB الأقصى البالغ 16 ميجابايت.
      // توصية: يجب مستقبلاً تقسيم المستند السحابي إلى مجموعات منفصلة (Collections) لكل جدول:
      // db.collection("orders"), db.collection("products"), db.collection("users"), db.collection("settings"), db.collection("inventory")
      await mongoCollection.updateOne({ _id: "cashi_pos" }, { $set: { data: cachedDB } }, { upsert: true });
    } else {
      // الكتابة الذرية (Atomic Write) للملف المحلي
      const tempPath = `${DB_FILE}.tmp`;
      fs.writeFileSync(tempPath, JSON.stringify(cachedDB, null, 2), "utf-8");
      fs.renameSync(tempPath, DB_FILE);
    }
  });
}

export function writeAuditLog(action: string, userId: string, userName: string, details: string) {
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

export function runDatabaseBackup() {
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

export function setDBPath(dbPath: string) {
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
