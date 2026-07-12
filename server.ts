import express from "express";
import path from "path";
import fs from "fs";
import http from "http";
import { fileURLToPath } from "url";
import crypto from "crypto";

// Modules
import {
  setDBPath,
  readDB,
  writeDB,
  initCloudDB,
  UPLOADS_DIR,
  BACKUPS_DIR,
  LOGS_DIR,
  runDatabaseBackup
} from "./db/db";

import { generateSalt, hashWithSalt } from "./utils/hashing";

// Routers
import authRouter from "./routes/auth";
import settingsRouter from "./routes/settings";
import productsRouter from "./routes/products";
import ordersRouter from "./routes/orders";
import usersRouter from "./routes/users";
import inventoryRouter from "./routes/inventory";
import suppliersRouter from "./routes/suppliers";
import customersRouter from "./routes/customers";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createServer(dbPath?: string) {
  if (dbPath) {
    setDBPath(dbPath);
  } else {
    // التأكد من تهيئة المجلدات الافتراضية
    [UPLOADS_DIR, BACKUPS_DIR, LOGS_DIR].forEach((d) => {
      if (!fs.existsSync(d)) {
        fs.mkdirSync(d, { recursive: true });
      }
    });
  }

  // تهيئة قاعدة البيانات والترحيل التلقائي القديم للموظفين
  const db = readDB();
  let needsWrite = false;
  if (db.users && Array.isArray(db.users)) {
    db.users.forEach((user: any) => {
      // 1. ترحيل رمز PIN للهاش الجديد بالملح
      if (!user.pinSalt && user.pinCode) {
        let foundPin = null;
        const legacyHashPIN = (pin: any) => {
          return crypto.createHmac("sha256", "cashi_secure_salt_2026").update(String(pin || "")).digest("hex");
        };
        for (let i = 0; i <= 9999; i++) {
          const cand = String(i).padStart(4, "0");
          if (legacyHashPIN(cand) === user.pinCode) {
            foundPin = cand;
            break;
          }
        }
        if (!foundPin) {
          for (let i = 0; i <= 9999; i++) {
            const cand = String(i);
            if (legacyHashPIN(cand) === user.pinCode) {
              foundPin = cand;
              break;
            }
          }
        }
        if (foundPin) {
          user.pinSalt = generateSalt();
          user.pinHash = hashWithSalt(foundPin, user.pinSalt);
          delete user.pinCode;
          needsWrite = true;
        }
      }

      // 2. ترحيل كلمة المرور للهاش الجديد بالملح
      if (!user.passwordSalt && user.passwordHash) {
        let foundPass = null;
        const legacyHashPIN = (pin: any) => {
          return crypto.createHmac("sha256", "cashi_secure_salt_2026").update(String(pin || "")).digest("hex");
        };
        for (let i = 0; i <= 9999; i++) {
          const cand = String(i).padStart(4, "0");
          if (legacyHashPIN(cand) === user.passwordHash) {
            foundPass = cand;
            break;
          }
        }
        if (!foundPass) {
          for (let i = 0; i <= 9999; i++) {
            const cand = String(i);
            if (legacyHashPIN(cand) === user.passwordHash) {
              foundPass = cand;
              break;
            }
          }
        }
        if (foundPass) {
          user.passwordSalt = generateSalt();
          user.passwordHash = hashWithSalt(foundPass, user.passwordSalt);
          needsWrite = true;
        }
      }
    });
  }

  if (needsWrite) {
    writeDB(db);
  }

  const app = express();

  // إعدادات الميدلوير العامة
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  // تقديم مجلد الصور المرفوعة
  app.use("/uploads", express.static(UPLOADS_DIR));

  // خدمة واجهة المستخدم الكاشير (React dist) في وضع الإنتاج
  const distPath = path.join(__dirname, "..", "dist");
  app.use(express.static(distPath));

  // خدمة لوحة تحكم المدير عن بُعد
  const managerStaticPath = path.join(__dirname, "..", "public", "manager");
  app.use("/manager", express.static(managerStaticPath));
  app.get("/manager", (req, res) => {
    const mPath = path.join(managerStaticPath, "index.html");
    if (fs.existsSync(mPath)) {
      res.sendFile(mPath);
    } else {
      res.status(404).send("<h1>لوحة تحكم المدير غير متوفرة</h1>");
    }
  });

  // ربط مسارات الـ Routers الفرعية
  app.use(authRouter);
  app.use(settingsRouter);
  app.use(productsRouter);
  app.use(ordersRouter);
  app.use(usersRouter);
  app.use(inventoryRouter);
  app.use(suppliersRouter);
  app.use(customersRouter);

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

  // تشغيل النسخ الاحتياطي التلقائي للبيانات كل 6 ساعات
  setInterval(runDatabaseBackup, 6 * 60 * 60 * 1000);

  // حلقة المزامنة السحابية للفواتير والبيانات
  function startCloudSyncLoop() {
    setInterval(async () => {
      try {
        const dbState = readDB();
        const settings = dbState.settings;
        if (!settings || !settings.cloudSyncEnabled || !settings.cloudApiUrl) {
          return;
        }

        // 1. مزامنة حالة التطبيق الكاملة (أصناف، منتجات، ورديات، مستخدمين، تنبيهات جرد)
        const syncStateUrl = `${settings.cloudApiUrl.replace(/\/$/, "")}/api/cloud-sync/full-state`;
        
        const lowStockItems: any[] = [];
        if (dbState.inventory_items) {
          dbState.inventory_items.forEach((item: any) => {
            const min = item.minStock || 5;
            if (item.quantity <= min) {
              lowStockItems.push(item);
            }
          });
        }

        await fetch(syncStateUrl, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${settings.cloudAuthToken}`
          },
          body: JSON.stringify({
            categories: dbState.categories || [],
            products: dbState.products || [],
            shifts: dbState.shifts || [],
            users: (dbState.users || []).map((u: any) => ({
              id: u.id,
              fullName: u.fullName,
              username: u.username,
              role: u.role,
              pin: u.pin // Needed for manager PIN login verification on cloud
            })),
            lowStock: lowStockItems,
            settings: {
              businessNameAr: settings.businessNameAr,
              businessNameEn: settings.businessNameEn,
              currency: settings.currency,
              vatRate: settings.vatRate
            }
          })
        }).catch(err => console.warn("[كاشي سحابي] ⚠️ فشل مزامنة حالة التطبيق السحابية:", err.message));

        // 2. مزامنة الفواتير غير المزامنة
        const unsyncedOrders = dbState.orders.filter((o: any) => !o.cloudSynced);
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

  // دالة بدء تشغيل السيرفر
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

// التشغيل المباشر (وضع التطوير بدون Electron)
const isDirectRun = process.argv[1] && (
  process.argv[1].endsWith("server.ts") || 
  process.argv[1].endsWith("server.js") ||
  process.argv[1].endsWith("server.cjs")
);

if (isDirectRun) {
  (async () => {
    const { createServer: createViteServer } = await import("vite");
    const { app: expressApp, start } = createServer();
    
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
