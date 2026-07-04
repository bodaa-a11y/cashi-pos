/**
 * ===================================================
 *  كاشي - نظام الكاشير المتكامل
 *  Cashi POS — Electron Main Process
 * ===================================================
 *
 * هذا الملف هو نقطة الدخول الرئيسية لتطبيق إلكترون.
 * يقوم بتشغيل سيرفر Express داخل عملية إلكترون الرئيسية،
 * ويدير النافذة الرئيسية، وأيقونة شريط النظام، واتصالات IPC.
 */

import {
  app,
  BrowserWindow,
  ipcMain,
  Tray,
  Menu,
  nativeImage,
  dialog,
  shell,
} from 'electron';
import path from 'path';
import net from 'net';
import os from 'os';
import fs from 'fs';
import type http from 'http';
import { fileURLToPath } from 'url';

// تعريف __dirname في نطاق ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// استيراد وحدات المشروع — سيتم تجميعها مع البناء
import { createServer } from '../server.js';
import { PrinterManager } from './printer.js';

// ─── متغيرات عامة ────────────────────────────────────────────
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let httpServer: http.Server | null = null;
let appPort: number = 3847;
let localIP: string = '127.0.0.1';

// مسار أيقونة التطبيق
const ICON_PATH = path.join(__dirname, '..', 'assets', 'icon.png');

// مسار ملف إعدادات الطابعة
const PRINTER_CONFIG_PATH = path.join(
  app.getPath('userData'),
  'printer-config.json'
);

// ─── قفل النسخة الواحدة ──────────────────────────────────────
// منع تشغيل أكثر من نسخة واحدة من التطبيق في نفس الوقت
const gotTheLock = app.requestSingleInstanceLock();

if (!gotTheLock) {
  // إذا كانت هناك نسخة أخرى قيد التشغيل، أغلق هذه النسخة فوراً
  app.quit();
} else {
  // عند محاولة فتح نسخة ثانية، أظهر النافذة الحالية
  app.on('second-instance', (_event, _commandLine, _workingDirectory) => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  الدوال المساعدة
// ═══════════════════════════════════════════════════════════════

/**
 * البحث عن منفذ شبكة متاح
 * يبدأ من المنفذ الافتراضي ويجرب حتى يجد منفذاً حراً
 */
function findFreePort(startPort: number = 3847): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();

    server.listen(startPort, () => {
      const address = server.address();
      const port = typeof address === 'object' && address ? address.port : startPort;
      server.close(() => resolve(port));
    });

    server.on('error', (err: NodeJS.ErrnoException) => {
      if (err.code === 'EADDRINUSE') {
        // المنفذ مشغول، جرب المنفذ التالي
        resolve(findFreePort(startPort + 1));
      } else {
        reject(err);
      }
    });
  });
}

/**
 * الحصول على عنوان IP المحلي للجهاز على الشبكة
 * يُستخدم لعرض رابط لوحة المدير للوصول من أجهزة أخرى
 */
function getLocalIP(): string {
  const interfaces = os.networkInterfaces();

  for (const name of Object.keys(interfaces)) {
    const netInterfaces = interfaces[name];
    if (!netInterfaces) continue;

    for (const iface of netInterfaces) {
      // تجاهل العناوين الداخلية (loopback) وعناوين IPv6
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }

  return '127.0.0.1';
}

// ═══════════════════════════════════════════════════════════════
//  تشغيل سيرفر Express المدمج
// ═══════════════════════════════════════════════════════════════

/**
 * تشغيل سيرفر Express داخل عملية إلكترون
 * قاعدة البيانات تُحفظ في مجلد بيانات المستخدم
 */
async function startEmbeddedServer(): Promise<number> {
  // مسار قاعدة البيانات في مجلد بيانات التطبيق
  const dbPath = path.join(app.getPath('userData'), 'db.json');

  // إنشاء سيرفر Express
  const { app: expressApp, start } = createServer(dbPath);

  // البحث عن منفذ متاح
  appPort = await findFreePort(3847);

  // تشغيل السيرفر على المنفذ المتاح
  httpServer = await start(appPort);

  // الحصول على عنوان IP المحلي
  localIP = getLocalIP();

  console.log(`[كاشي] ✅ السيرفر يعمل على المنفذ: ${appPort}`);
  console.log(`[كاشي] 🌐 عنوان IP المحلي: ${localIP}`);
  console.log(
    `[كاشي] 📊 لوحة المدير: http://${localIP}:${appPort}/manager`
  );

  return appPort;
}

// ═══════════════════════════════════════════════════════════════
//  إنشاء النافذة الرئيسية
// ═══════════════════════════════════════════════════════════════

function createMainWindow(port: number): BrowserWindow {
  // تحميل أيقونة التطبيق
  let icon: nativeImage | undefined;
  try {
    if (fs.existsSync(ICON_PATH)) {
      icon = nativeImage.createFromPath(ICON_PATH);
    }
  } catch {
    console.warn('[كاشي] ⚠️ لم يتم العثور على أيقونة التطبيق');
  }

  // إنشاء النافذة الرئيسية بدون إطار (frameless) وبملء الشاشة
  const win = new BrowserWindow({
    fullscreen: true,
    frame: false,
    minWidth: 1024,
    minHeight: 768,
    icon,
    title: 'كاشي — نظام الكاشير المتكامل',
    backgroundColor: '#1a1a2e',
    show: false, // لا تعرض حتى يكتمل التحميل
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.js'),
      // تعطيل الوصول إلى الموارد البعيدة غير الآمنة
      webSecurity: true,
    },
  });

  // تحميل التطبيق من السيرفر المدمج
  win.loadURL(`http://localhost:${port}`);

  // عرض النافذة عندما يكتمل التحميل
  win.once('ready-to-show', () => {
    win.show();
    win.focus();
  });

  // ─── منع التنقل لروابط خارجية ──────────────────────────
  // حماية أمنية: منع فتح روابط خارجية داخل نافذة التطبيق
  win.webContents.on('will-navigate', (event, url) => {
    const parsedUrl = new URL(url);
    // السماح فقط بالتنقل داخل السيرفر المحلي
    if (
      parsedUrl.hostname !== 'localhost' &&
      parsedUrl.hostname !== '127.0.0.1'
    ) {
      event.preventDefault();
      // فتح الرابط الخارجي في المتصفح الافتراضي
      shell.openExternal(url);
    }
  });

  // منع فتح نوافذ جديدة — فتحها في المتصفح الافتراضي بدلاً من ذلك
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });

  // ─── التصغير إلى شريط النظام بدلاً من الإغلاق ────────
  // عند محاولة إغلاق النافذة، نخفيها فقط ونبقي التطبيق يعمل
  win.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      win.hide();
    }
  });

  // ─── أدوات المطور — فقط في وضع التطوير ─────────────────
  if (!app.isPackaged) {
    win.webContents.openDevTools({ mode: 'detach' });
    console.log('[كاشي] 🛠️ وضع التطوير — أدوات المطور مفعّلة');
  }

  return win;
}

// ═══════════════════════════════════════════════════════════════
//  إنشاء أيقونة شريط النظام (System Tray)
// ═══════════════════════════════════════════════════════════════

function createSystemTray(): Tray {
  // تحميل أيقونة شريط النظام
  let trayIcon: nativeImage;
  try {
    if (fs.existsSync(ICON_PATH)) {
      trayIcon = nativeImage.createFromPath(ICON_PATH).resize({ width: 16, height: 16 });
    } else {
      // أيقونة فارغة احتياطية
      trayIcon = nativeImage.createEmpty();
    }
  } catch {
    trayIcon = nativeImage.createEmpty();
  }

  const systemTray = new Tray(trayIcon);
  systemTray.setToolTip('كاشي — نظام الكاشير المتكامل');

  // رابط لوحة المدير
  const managerUrl = `http://${localIP}:${appPort}/manager`;

  // قائمة أيقونة شريط النظام
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'إظهار / إخفاء النافذة',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
        }
      },
    },
    {
      label: `📊 لوحة المدير (${managerUrl})`,
      click: () => {
        // فتح لوحة المدير في المتصفح الافتراضي
        shell.openExternal(managerUrl);
      },
    },
    { type: 'separator' },
    {
      label: 'إنهاء التطبيق',
      click: () => {
        // تعيين علامة الإغلاق والخروج
        (app as any).isQuitting = true;
        app.quit();
      },
    },
  ]);

  systemTray.setContextMenu(contextMenu);

  // النقر المزدوج على أيقونة شريط النظام يُظهر/يُخفي النافذة
  systemTray.on('double-click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  return systemTray;
}

// ═══════════════════════════════════════════════════════════════
//  تسجيل معالجات IPC
// ═══════════════════════════════════════════════════════════════

/**
 * تسجيل جميع معالجات IPC للتواصل بين الواجهة الأمامية والعملية الرئيسية
 * هذه المعالجات تُمكّن الواجهة من الوصول لميزات النظام بأمان
 */
function registerIPCHandlers(): void {
  const printerManager = PrinterManager.getInstance();

  // ─── طباعة الإيصال ─────────────────────────────────────
  ipcMain.handle('print-receipt', async (_event, data) => {
    try {
      if (data && data.html) {
        if (mainWindow) {
          const result = await printerManager.fallbackPrint(data.html, mainWindow);
          return { success: result };
        }
      }
      const result = await printerManager.printReceipt(data);
      return { success: result };
    } catch (error) {
      console.error('[كاشي] ❌ خطأ في طباعة الإيصال:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'خطأ غير معروف',
      };
    }
  });

  // ─── طباعة تذكرة المطبخ ────────────────────────────────
  ipcMain.handle('print-kitchen', async (_event, data) => {
    try {
      const result = await printerManager.printKitchenTicket(data);
      return { success: result };
    } catch (error) {
      console.error('[كاشي] ❌ خطأ في طباعة تذكرة المطبخ:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'خطأ غير معروف',
      };
    }
  });

  // ─── فتح درج النقود ────────────────────────────────────
  ipcMain.handle('open-drawer', async () => {
    try {
      const result = await printerManager.openCashDrawer();
      return { success: result };
    } catch (error) {
      console.error('[كاشي] ❌ خطأ في فتح درج النقود:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'خطأ غير معروف',
      };
    }
  });

  // ─── قائمة الطابعات المتاحة ────────────────────────────
  ipcMain.handle('get-printers', async () => {
    try {
      const printers = await printerManager.getPrinterList();
      return { success: true, printers };
    } catch (error) {
      console.error('[كاشي] ❌ خطأ في جلب قائمة الطابعات:', error);
      return { success: false, printers: [] };
    }
  });

  // ─── معلومات التطبيق ───────────────────────────────────
  ipcMain.handle('get-app-info', () => {
    return {
      version: app.getVersion(),
      localIP,
      port: appPort,
      managerUrl: `http://${localIP}:${appPort}/manager`,
    };
  });

  // ─── حفظ إعدادات الطابعة ──────────────────────────────
  ipcMain.handle('save-printer-settings', async (_event, settings) => {
    try {
      printerManager.saveConfig(PRINTER_CONFIG_PATH, settings);
      console.log('[كاشي] ✅ تم حفظ إعدادات الطابعة');
      return { success: true };
    } catch (error) {
      console.error('[كاشي] ❌ خطأ في حفظ إعدادات الطابعة:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'خطأ غير معروف',
      };
    }
  });

  // ─── قراءة إعدادات الطابعة ─────────────────────────────
  ipcMain.handle('get-printer-settings', () => {
    try {
      printerManager.loadConfig(PRINTER_CONFIG_PATH);
      return { success: true, settings: printerManager.getConfig() };
    } catch (error) {
      console.error('[كاشي] ❌ خطأ في قراءة إعدادات الطابعة:', error);
      return { success: false, settings: null };
    }
  });
}

// ═══════════════════════════════════════════════════════════════
//  بدء تشغيل التطبيق
// ═══════════════════════════════════════════════════════════════

/**
 * الدالة الرئيسية لتهيئة وتشغيل جميع مكونات التطبيق
 */
async function bootstrap(): Promise<void> {
  if (!gotTheLock) {
    app.quit();
    return;
  }
  try {
    console.log('[كاشي] 🚀 جاري تشغيل نظام كاشي...');

    // 1. تشغيل السيرفر المدمج
    const port = await startEmbeddedServer();

    // 2. تسجيل معالجات IPC
    registerIPCHandlers();

    // 3. إنشاء النافذة الرئيسية
    mainWindow = createMainWindow(port);

    // 4. إنشاء أيقونة شريط النظام
    tray = createSystemTray();

    // 5. تحميل إعدادات الطابعة المحفوظة
    const printerManager = PrinterManager.getInstance();
    try {
      printerManager.loadConfig(PRINTER_CONFIG_PATH);
      console.log('[كاشي] ✅ تم تحميل إعدادات الطابعة');
    } catch {
      console.log('[كاشي] ℹ️ لا توجد إعدادات طابعة محفوظة — سيتم استخدام الإعدادات الافتراضية');
    }

    console.log('[كاشي] ✅ تم تشغيل النظام بنجاح!');
  } catch (error) {
    console.error('[كاشي] ❌ فشل تشغيل النظام:', error);

    // عرض رسالة خطأ للمستخدم
    dialog.showErrorBox(
      'خطأ في تشغيل كاشي',
      `حدث خطأ أثناء تشغيل النظام:\n\n${
        error instanceof Error ? error.message : String(error)
      }\n\nيرجى إعادة تشغيل التطبيق.`
    );

    app.quit();
  }
}

// ─── أحداث دورة حياة التطبيق ─────────────────────────────────

// عندما يكون إلكترون جاهزاً، ابدأ التطبيق
app.whenReady().then(bootstrap);

// ─── إغلاق رشيق (Graceful Shutdown) ──────────────────────────
// عند إنهاء التطبيق، أغلق السيرفر بشكل صحيح
app.on('before-quit', () => {
  (app as any).isQuitting = true;
});

app.on('will-quit', (event) => {
  if (httpServer) {
    event.preventDefault();
    console.log('[كاشي] 🔄 جاري إغلاق السيرفر...');

    httpServer.close(() => {
      console.log('[كاشي] ✅ تم إغلاق السيرفر بنجاح');
      httpServer = null;
      app.quit();
    });

    // مهلة أمان — إذا لم يُغلق السيرفر خلال 5 ثوانٍ، أغلق بالقوة
    setTimeout(() => {
      console.warn('[كاشي] ⚠️ مهلة إغلاق السيرفر انتهت — إغلاق قسري');
      httpServer = null;
      app.quit();
    }, 5000);
  }
});

// على macOS، لا تغلق التطبيق عند إغلاق جميع النوافذ
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    // على Windows و Linux، أخفِ فقط (التطبيق يبقى في شريط النظام)
    // لا نغلق التطبيق هنا لأنه يعمل كخدمة
  }
});

// على macOS، عند إعادة تنشيط التطبيق
app.on('activate', () => {
  if (mainWindow) {
    mainWindow.show();
    mainWindow.focus();
  }
});
