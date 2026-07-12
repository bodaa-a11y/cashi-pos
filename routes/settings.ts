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

export default router;
