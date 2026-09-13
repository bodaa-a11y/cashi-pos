import express from "express";
import { readDB, writeDB, writeAuditLog, mongoCollection, DB_FILE } from "../db/db";
import { authenticate } from "../middleware/authenticate";
import os from "os";
import fs from "fs";
import path from "path";

const router = express.Router();

// الحصول على الإعدادات (مسار مفتوح — يُستخدم عند بدء التشغيل للتحقق من حالة الإعداد)
router.get("/api/settings", (req, res) => {
  const db = readDB();
  res.json(db.settings || null);
});

// تعيين الإعدادات لأول مرة
router.post("/api/settings", (req, res, next) => {
  const db = readDB();
  if (db.settings && db.settings.setupCompletedAt) {
    return authenticate(["admin", "manager"])(req, res, next);
  }
  next();
}, (req, res) => {
  const { businessNameAr, businessNameEn, branchName, address, phone, taxNumber, currency, vatRate, receiptFooter, logoBase64, commercialReg } = req.body;
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
    commercialReg: commercialReg || "",
    setupCompletedAt: new Date().toISOString()
  };
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// تعديل الإعدادات
router.put("/api/settings", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  if (!db.settings) {
    return res.status(400).json({ error: "لم يتم إعداد النظام بعد" });
  }
  db.settings = { ...db.settings, ...req.body, updatedAt: new Date().toISOString() };
  writeDB(db);
  res.json({ success: true, settings: db.settings });
});

// فحص الاتصال بالخادم السحابي
router.post("/api/settings/test-cloud-sync", authenticate(["admin", "manager"]), async (req, res) => {
  const { url, token } = req.body;
  if (!url) {
    return res.status(400).json({ error: "عنوان الخادم السحابي مطلوب" });
  }
  try {
    const response = await fetch(`${url}/api/cloud/test`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token || ""}`
      },
      body: JSON.stringify({ ping: true })
    });
    if (response.status === 200) {
      res.json({ success: true, message: "تم الاتصال بنجاح بالخادم السحابي" });
    } else {
      res.status(response.status).json({ error: `فشل الاتصال: رمز الحالة ${response.status}` });
    }
  } catch (error: any) {
    res.status(500).json({ error: `فشل الاتصال بالخادم السحابي: ${error.message}` });
  }
});

// المزامنة السحابية اليدوية
router.post("/api/cloud-sync/test", authenticate(["admin", "manager"]), async (req, res) => {
  res.json({ success: true, message: "السيرفر متصل بالإنترنت" });
});

// مزامنة الفواتير سحابياً
router.post("/api/cloud-sync/orders", authenticate(["admin", "manager"]), async (req, res) => {
  const { orders } = req.body;
  const db = readDB();
  if (orders && Array.isArray(orders)) {
    orders.forEach((o: any) => {
      const idx = db.orders.findIndex((existing: any) => existing.id === o.id);
      if (idx === -1) {
        db.orders.push(o);
      } else {
        db.orders[idx] = o;
      }
    });
    writeDB(db);
  }
  res.json({ success: true, message: "تمت مزامنة الفواتير بنجاح" });
});

// مزامنة المنيو سحابياً
router.get("/api/cloud-sync/menu", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json({
    categories: db.categories.filter((c: any) => c.isActive),
    products: db.products.filter((p: any) => p.isActive)
  });
});

// معلومات النظام والشبكة المحلية
router.get("/api/system/info", authenticate(["admin", "manager"]), (req, res) => {
  const interfaces = os.networkInterfaces();
  let localIP = "127.0.0.1";
  for (const name of Object.keys(interfaces)) {
    for (const net of interfaces[name] || []) {
      if (net.family === "IPv4" && !net.internal) {
        localIP = net.address;
        break;
      }
    }
  }
  res.json({
    platform: os.platform(),
    arch: os.arch(),
    totalMemory: os.totalmem(),
    freeMemory: os.freemem(),
    localIP,
    dbPath: DB_FILE,
    mode: mongoCollection ? "cloud" : "local"
  });
});

// تصدير نسخة احتياطية بصيغة .cashi
router.get("/api/backup/export", authenticate(["admin", "manager"]), (req, res) => {
  try {
    const db = readDB();
    const backupPayload = {
      app: "cashi-pos",
      version: "1.0.0",
      createdAt: new Date().toISOString(),
      storeName: db.settings?.businessNameAr || "Cashi",
      data: db
    };
    const jsonStr = JSON.stringify(backupPayload, null, 2);
    const dateStr = new Date().toISOString().split("T")[0];
    const filename = `cashi_backup_${dateStr}_${Date.now().toString().slice(-4)}.cashi`;

    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.setHeader("Content-Type", "application/octet-stream");
    res.send(Buffer.from(jsonStr, "utf-8"));
  } catch (error: any) {
    res.status(500).json({ error: "فشل تصدير النسخة الاحتياطية: " + error.message });
  }
});

// استعادة نسخة احتياطية من ملف .cashi
router.post("/api/backup/restore", authenticate(["admin", "manager"]), (req, res) => {
  try {
    const { backupContent } = req.body;
    if (!backupContent) {
      return res.status(400).json({ error: "محتوى النسخة الاحتياطية مطلوب" });
    }

    let parsed: any;
    try {
      parsed = typeof backupContent === "string" ? JSON.parse(backupContent) : backupContent;
    } catch (e) {
      return res.status(400).json({ error: "الملف المرفوع تالف أو غير صالح كملف نسخة احتياطية لبرنامج كاشي" });
    }

    // التحقق من صلاحية الملف وهيكل البيانات
    const dataToRestore = parsed.data || parsed;
    if (!dataToRestore.settings && !dataToRestore.products && !dataToRestore.categories) {
      return res.status(400).json({ error: "هيكل بيانات النسخة الاحتياطية غير متوافق مع نظام كاشي" });
    }

    // أخذ نسخة أمان قبل الاستعادة
    try {
      const currentDB = readDB();
      const currentBackup = {
        app: "cashi-pos",
        type: "pre_restore_safety_backup",
        createdAt: new Date().toISOString(),
        data: currentDB
      };
      if (!fs.existsSync(path.dirname(DB_FILE))) {
        fs.mkdirSync(path.dirname(DB_FILE), { recursive: true });
      }
      fs.writeFileSync(`${DB_FILE}.safety_backup_${Date.now()}.json`, JSON.stringify(currentBackup, null, 2), "utf-8");
    } catch (safeErr) {
      console.warn("تعذر أخذ نسخة أمان قبل الاستعادة:", safeErr);
    }

    // تطبيق البيانات المستعادة
    writeDB(dataToRestore);
    writeAuditLog("استعادة نسخة احتياطية", (req as any).user?.id || "system", (req as any).user?.fullName || "مدير النظام", `تمت استعادة نسخة احتياطية بنجاح بتاريخ ${parsed.createdAt || new Date().toISOString()}`);

    res.json({
      success: true,
      message: "تم استعادة النسخة الاحتياطية بنجاح! سيتم تحديث الصفحة الآن لتطبيق البيانات.",
      details: {
        productsCount: (dataToRestore.products || []).length,
        categoriesCount: (dataToRestore.categories || []).length,
        ordersCount: (dataToRestore.orders || []).length
      }
    });
  } catch (error: any) {
    res.status(500).json({ error: "فشل استعادة النسخة الاحتياطية: " + error.message });
  }
});

export default router;
