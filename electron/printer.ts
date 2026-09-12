/**
 * ===================================================
 *  كاشي - نظام الكاشير المتكامل
 *  Cashi POS — Printer Manager
 * ===================================================
 *
 * مدير الطابعات — يتحكم في طباعة الإيصالات وتذاكر المطبخ وفتح درج النقود.
 *
 * يتكامل حقيقي مع مكتبة node-thermal-printer
 * لإرسال أوامر ESC/POS للطابعات الحرارية بترميز PC720_ARABIC.
 */

import { BrowserWindow } from 'electron';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { execSync } from 'child_process';
import os from 'os';

const require = createRequire(import.meta.url);

// ═══════════════════════════════════════════════════════
//  تعريف الأنواع (Interfaces)
// ═══════════════════════════════════════════════════════

/** إعدادات الطابعة */
export interface PrinterConfig {
  /** نوع الطابعة */
  type: 'epson' | 'star' | 'generic';

  /** طريقة الاتصال */
  interface: 'usb' | 'network';

  /** عنوان الطابعة على الشبكة (IP:Port) — مطلوب إذا كان الاتصال عبر الشبكة */
  networkAddress?: string;

  /** منفذ USB — مطلوب إذا كان الاتصال عبر USB */
  usbPort?: string;

  /** عرض ورق الطباعة بالمليمتر */
  paperWidth: 58 | 80;

  /** قص الورق تلقائياً بعد الطباعة */
  autoCut: boolean;

  /** فتح درج النقود تلقائياً عند الدفع نقداً */
  openDrawerOnCash: boolean;

  /** اسم الطابعة في نظام التشغيل — للطباعة الاحتياطية */
  printerName?: string;

  /** الطباعة الصامتة المباشرة (true) أو إظهار نافذة خيارات الطباعة (false) */
  silentPrint?: boolean;
}

/** بيانات الإيصال */
export interface ReceiptData {
  /** اسم المنشأة بالعربية */
  businessName: string;

  /** اسم المنشأة بالإنجليزية (اختياري) */
  businessNameEn?: string;

  /** اسم الفرع */
  branchName?: string;

  /** العنوان */
  address?: string;

  /** رقم الهاتف */
  phone?: string;

  /** الرقم الضريبي */
  taxNumber?: string;

  /** مسار شعار المنشأة */
  logoPath?: string;

  /** رقم الإيصال */
  receiptNumber: string;

  /** تاريخ ووقت العملية */
  date: string;

  /** اسم الكاشير */
  cashierName: string;

  /** نوع الطلب (داخلي، خارجي، توصيل) */
  orderType: string;

  /** رقم الطاولة (اختياري — للطلبات الداخلية) */
  tableId?: string;

  /** قائمة الأصناف */
  items: Array<{
    /** اسم الصنف */
    name: string;
    /** الكمية */
    quantity: number;
    /** سعر الوحدة */
    unitPrice: number;
    /** الإجمالي */
    total: number;
  }>;

  /** المجموع الفرعي قبل الخصم والضريبة */
  subtotal: number;

  /** الخصم */
  discount: number;

  /** الضريبة */
  tax: number;

  /** المجموع النهائي */
  total: number;

  /** طرق الدفع المستخدمة */
  payments: Array<{
    /** طريقة الدفع (نقد، بطاقة، إلكتروني) */
    method: string;
    /** المبلغ */
    amount: number;
  }>;

  /** المبلغ المدفوع */
  tendered?: number;

  /** الباقي */
  change?: number;

  /** رسالة تذييل الإيصال */
  footerMessage?: string;
}

/** بيانات تذكرة المطبخ */
export interface KitchenTicketData {
  /** رقم الطلب */
  orderNumber: string;

  /** تاريخ ووقت الطلب */
  date: string;

  /** نوع الطلب */
  orderType: string;

  /** رقم الطاولة (اختياري) */
  tableId?: string;

  /** قائمة الأصناف المطلوبة */
  items: Array<{
    /** اسم الصنف */
    name: string;
    /** الكمية */
    quantity: number;
    /** ملاحظات خاصة (اختياري) */
    notes?: string;
  }>;
}

// ═══════════════════════════════════════════════════════
//  فئة مدير الطابعات (Singleton)
// ═══════════════════════════════════════════════════════

/**
 * مدير الطابعات — نمط Singleton
 * يُستخدم نسخة واحدة في كل التطبيق لإدارة الطباعة
 */
export class PrinterManager {
  // ─── Singleton ─────────────────────────────────────────
  private static instance: PrinterManager;

  /** إعدادات الطابعة الحالية */
  private printerConfig: PrinterConfig | null = null;

  /**
   * مرجع لمكتبة node-thermal-printer (يُحمّل ديناميكياً)
   */
  private thermalPrinter: any = null;

  /** هل المكتبة الحرارية متاحة؟ */
  private isThermalAvailable: boolean = false;

  private constructor() {
    this.initThermalPrinter();
  }

  /**
   * الحصول على النسخة الوحيدة من مدير الطابعات
   */
  static getInstance(): PrinterManager {
    if (!PrinterManager.instance) {
      PrinterManager.instance = new PrinterManager();
    }
    return PrinterManager.instance;
  }

  /**
   * التحقق مما إذا كانت الطابعة الحرارية مهيأة ومتاحة
   */
  isThermalConfigured(): boolean {
    return this.isThermalAvailable && this.printerConfig !== null;
  }

  // ═══════════════════════════════════════════════════════
  //  تهيئة الطابعة الحرارية
  // ═══════════════════════════════════════════════════════

  /**
   * محاولة تحميل مكتبة node-thermal-printer ديناميكياً
   */
  private initThermalPrinter(): void {
    try {
      this.thermalPrinter = require('node-thermal-printer');
      this.isThermalAvailable = true;
      console.log('[كاشي طباعة] ✅ مكتبة node-thermal-printer متاحة');
    } catch {
      this.isThermalAvailable = false;
      console.log(
        '[كاشي طباعة] ℹ️ مكتبة node-thermal-printer غير مثبّتة — سيتم استخدام الطباعة الاحتياطية'
      );
    }
  }

  // ═══════════════════════════════════════════════════════
  //  إدارة الإعدادات
  // ═══════════════════════════════════════════════════════

  /**
   * تحميل إعدادات الطابعة من ملف JSON
   * @param configPath مسار ملف الإعدادات
   */
  loadConfig(configPath: string): void {
    try {
      if (fs.existsSync(configPath)) {
        const raw = fs.readFileSync(configPath, 'utf-8');
        let config = JSON.parse(raw);
        if (config && config.settings) {
          config = config.settings;
        }
        this.printerConfig = config as PrinterConfig;
        console.log('[كاشي طباعة] ✅ تم تحميل إعدادات الطابعة');
      } else {
        console.log('[كاشي طباعة] ℹ️ لا يوجد ملف إعدادات — سيتم استخدام الإعدادات الافتراضية');
        this.printerConfig = this.getDefaultConfig();
      }
    } catch (error) {
      console.error('[كاشي طباعة] ❌ خطأ في تحميل إعدادات الطابعة:', error);
      this.printerConfig = this.getDefaultConfig();
    }
  }

  /**
   * حفظ إعدادات الطابعة في ملف JSON
   * @param configPath مسار ملف الإعدادات
   * @param config الإعدادات المراد حفظها
   */
  saveConfig(configPath: string, config: PrinterConfig): void {
    try {
      const dir = path.dirname(configPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
      this.printerConfig = config;
      console.log('[كاشي طباعة] ✅ تم حفظ إعدادات الطابعة');
    } catch (error) {
      console.error('[كاشي طباعة] ❌ خطأ في حفظ إعدادات الطابعة:', error);
      throw error;
    }
  }

  /**
   * الحصول على الإعدادات الحالية
   */
  getConfig(): PrinterConfig | null {
    return this.printerConfig;
  }

  /**
   * الإعدادات الافتراضية للطابعة
   */
  private getDefaultConfig(): PrinterConfig {
    return {
      type: 'generic',
      interface: 'usb',
      paperWidth: 80,
      autoCut: true,
      openDrawerOnCash: true,
      silentPrint: true,
    };
  }

  // ═══════════════════════════════════════════════════════
  //  قائمة الطابعات المتاحة
  // ═══════════════════════════════════════════════════════

  /**
   * الحصول على قائمة الطابعات المتصلة بالجهاز
   */
  async getPrinterList(): Promise<string[]> {
    try {
      const win = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0];
      if (win) {
        const printers = win.webContents.getPrintersAsync
          ? await win.webContents.getPrintersAsync()
          : [];

        const printerNames = printers.map((p: Electron.PrinterInfo) => p.name);
        console.log(`[كاشي طباعة] 🖨️ تم العثور على ${printerNames.length} طابعة:`, printerNames);
        return printerNames;
      }
      return [];
    } catch (error) {
      console.error('[كاشي طباعة] ❌ خطأ في جلب قائمة الطابعات:', error);
      return [];
    }
  }

  // ═══════════════════════════════════════════════════════
  //  طباعة الإيصال
  // ═══════════════════════════════════════════════════════

  private getPrinterType(): any {
    const type = this.printerConfig?.type || 'generic';
    const PrinterTypes = this.thermalPrinter.types;
    if (type === 'epson') return PrinterTypes.EPSON;
    if (type === 'star') return PrinterTypes.STAR;
    return PrinterTypes.EPSON;
  }

  private getPrinterInterface(): string {
    const config = this.printerConfig;
    if (!config) return '';
    if (config.interface === 'network') {
      let addr = config.networkAddress || '';
      if (!addr.includes(':')) {
        addr += ':9100';
      }
      return `tcp://${addr}`;
    } else {
      return `printer:${config.printerName || ''}`;
    }
  }

  /**
   * طباعة إيصال البيع
   * @param data بيانات الإيصال
   * @returns true إذا نجحت الطباعة
   */
  async printReceipt(data: ReceiptData): Promise<boolean> {
    if (!this.isThermalAvailable || !this.printerConfig) {
      console.log('[كاشي طباعة] ⚠️ الطباعة الحرارية غير متوفرة، سيتم استخدام الطباعة الاحتياطية');
      throw new Error('مكتبة الطباعة الحرارية غير متوفرة أو لم يتم إعداد الطابعة');
    }

    const ThermalPrinter = this.thermalPrinter.printer;
    const printer = new ThermalPrinter({
      type: this.getPrinterType(),
      interface: this.getPrinterInterface(),
      characterSet: 'PC720_ARABIC',
      removeSpecialCharacters: false,
      width: this.printerConfig.paperWidth === 80 ? 48 : 32,
    });

    try {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(data.businessName);
      if (data.businessNameEn) {
        printer.println(data.businessNameEn);
      }
      printer.bold(false);
      printer.setTextNormal();

      if (data.branchName) printer.println(data.branchName);
      if (data.address) printer.println(data.address);
      if (data.phone) printer.println(`هاتف: ${data.phone}`);
      if (data.taxNumber) printer.println(`الرقم الضريبي: ${data.taxNumber}`);

      printer.drawLine();

      // معلومات الطلب
      printer.alignLeft();
      printer.println(`رقم الإيصال: ${data.receiptNumber}`);
      printer.println(`التاريخ: ${data.date}`);
      printer.println(`الكاشير: ${data.cashierName}`);
      printer.println(`نوع الطلب: ${data.orderType}`);
      if (data.tableId) printer.println(`الطاولة: ${data.tableId}`);

      printer.drawLine();

      // الأصناف
      const cols = this.printerConfig.paperWidth === 80
        ? [
            { text: 'الصنف', align: 'LEFT', width: 0.5 },
            { text: 'الكمية', align: 'CENTER', width: 0.15 },
            { text: 'السعر', align: 'RIGHT', width: 0.15 },
            { text: 'الإجمالي', align: 'RIGHT', width: 0.2 },
          ]
        : [
            { text: 'الصنف', align: 'LEFT', width: 0.4 },
            { text: 'كم', align: 'CENTER', width: 0.15 },
            { text: 'سعر', align: 'RIGHT', width: 0.25 },
            { text: 'إجمالي', align: 'RIGHT', width: 0.2 },
          ];
      
      printer.tableCustom(cols as any);

      for (const item of data.items) {
        const itemCols = this.printerConfig.paperWidth === 80
          ? [
              { text: item.name, align: 'LEFT', width: 0.5 },
              { text: String(item.quantity), align: 'CENTER', width: 0.15 },
              { text: item.unitPrice.toFixed(2), align: 'RIGHT', width: 0.15 },
              { text: item.total.toFixed(2), align: 'RIGHT', width: 0.2 },
            ]
          : [
              { text: item.name, align: 'LEFT', width: 0.4 },
              { text: String(item.quantity), align: 'CENTER', width: 0.15 },
              { text: item.unitPrice.toFixed(2), align: 'RIGHT', width: 0.25 },
              { text: item.total.toFixed(2), align: 'RIGHT', width: 0.2 },
            ];
        printer.tableCustom(itemCols as any);
      }

      printer.drawLine();

      // المجاميع
      printer.alignRight();
      printer.println(`المجموع الفرعي: ${data.subtotal.toFixed(2)} ر.س`);
      if (data.discount > 0) {
        printer.println(`الخصم: -${data.discount.toFixed(2)} ر.س`);
      }
      if (data.tax > 0) {
        printer.println(`الضريبة: ${data.tax.toFixed(2)} ر.س`);
      }
      printer.bold(true);
      printer.setTextSize(1, 1);
      printer.println(`الإجمالي: ${data.total.toFixed(2)} ر.س`);
      printer.bold(false);
      printer.setTextNormal();

      // طرق الدفع
      printer.drawLine();
      for (const payment of data.payments) {
        printer.println(`${payment.method}: ${payment.amount.toFixed(2)} ر.س`);
      }
      if (data.tendered !== undefined) {
        printer.println(`المدفوع: ${data.tendered.toFixed(2)} ر.س`);
        printer.println(`الباقي: ${(data.change ?? 0).toFixed(2)} ر.س`);
      }

      // التذييل
      printer.drawLine();
      printer.alignCenter();
      if (data.footerMessage) {
        printer.println(data.footerMessage);
      }
      printer.println('شكراً لزيارتكم!');
      printer.println('Thank you for your visit!');

      if (this.printerConfig.autoCut) {
        printer.cut();
      }

      // فتح الدرج إذا كان الدفع نقداً والإعدادات تسمح بذلك
      const hasCashPayment = data.payments.some(p => p.method.toLowerCase().includes('cash') || p.method.includes('نقدي') || p.method.includes('نقد'));
      if (this.printerConfig.openDrawerOnCash && hasCashPayment) {
        printer.openCashDrawer();
      }

      // التحقق من الاتصال بالطابعة
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected && this.printerConfig.interface === 'network') {
        throw new Error('الطابعة الحرارية غير متصلة بالشبكة أو غير قابلة للوصول');
      }

      await printer.execute();
      console.log(`[كاشي طباعة] ✅ تم إرسال الإيصال #${data.receiptNumber} للطابعة بنجاح`);
      return true;
    } catch (error) {
      console.error('[كاشي طباعة] ❌ فشلت الطباعة الحرارية للإيصال:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  طباعة تذكرة المطبخ
  // ═══════════════════════════════════════════════════════

  /**
   * طباعة تذكرة المطبخ
   * @param data بيانات تذكرة المطبخ
   * @returns true إذا نجحت الطباعة
   */
  async printKitchenTicket(data: KitchenTicketData): Promise<boolean> {
    if (!this.isThermalAvailable || !this.printerConfig) {
      console.log('[كاشي طباعة] ⚠️ الطباعة الحرارية غير متوفرة، سيتم استخدام الطباعة الاحتياطية');
      throw new Error('مكتبة الطباعة الحرارية غير متوفرة أو لم يتم إعداد الطابعة');
    }

    const ThermalPrinter = this.thermalPrinter.printer;
    const printer = new ThermalPrinter({
      type: this.getPrinterType(),
      interface: this.getPrinterInterface(),
      characterSet: 'PC720_ARABIC',
      removeSpecialCharacters: false,
      width: this.printerConfig.paperWidth === 80 ? 48 : 32,
    });

    try {
      printer.alignCenter();
      printer.bold(true);
      printer.setTextSize(2, 2);
      printer.println('*** طلب جديد للمطبخ ***');
      printer.setTextNormal();
      printer.bold(false);

      printer.drawLine();

      printer.alignLeft();
      printer.bold(true);
      printer.println(`رقم الطلب: #${data.orderNumber}`);
      printer.bold(false);
      printer.println(`النوع: ${data.orderType}`);
      if (data.tableId) {
        printer.setTextSize(1, 1);
        printer.println(`الطاولة: ${data.tableId}`);
        printer.setTextNormal();
      }
      printer.println(`الوقت: ${data.date}`);

      printer.drawLine();

      // الأصناف المطلوبة
      for (const item of data.items) {
        printer.bold(true);
        printer.setTextSize(1, 1);
        printer.println(`${item.quantity} x ${item.name}`);
        printer.setTextNormal();
        printer.bold(false);

        if (item.notes) {
          printer.println(`   ⚠️ ملاحظة: ${item.notes}`);
        }
      }

      printer.drawLine();
      printer.cut();

      // صفير التنبيه
      try {
        printer.beep(1, 3);
      } catch {}

      // التحقق من الاتصال بالطابعة
      const isConnected = await printer.isPrinterConnected();
      if (!isConnected && this.printerConfig.interface === 'network') {
        throw new Error('الطابعة الحرارية المطبخية غير متصلة بالشبكة أو غير قابلة للوصول');
      }

      await printer.execute();
      console.log(`[كاشي طباعة] ✅ تم إرسال تذكرة المطبخ للطلب #${data.orderNumber} للطابعة بنجاح`);
      return true;
    } catch (error) {
      console.error('[كاشي طباعة] ❌ فشلت الطباعة الحرارية للمطبخ:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  فتح درج النقود
  // ═══════════════════════════════════════════════════════

  /**
   * فتح درج النقود
   * @returns true إذا تم فتح الدرج بنجاح
   */
  async openCashDrawer(): Promise<boolean> {
    if (!this.isThermalAvailable || !this.printerConfig) {
      console.log('[كاشي طباعة] ⚠️ مكتبة الطباعة الحرارية غير متوفرة لفتح الدرج');
      throw new Error('مكتبة الطباعة الحرارية غير متوفرة أو لم يتم إعداد الطابعة');
    }

    const ThermalPrinter = this.thermalPrinter.printer;
    const printer = new ThermalPrinter({
      type: this.getPrinterType(),
      interface: this.getPrinterInterface(),
      characterSet: 'PC720_ARABIC',
      removeSpecialCharacters: false,
    });

    try {
      printer.openCashDrawer();
      await printer.execute();
      console.log('[كاشي طباعة] ✅ تم إرسال نبض فتح درج النقود للطابعة');
      return true;
    } catch (error) {
      console.error('[كاشي طباعة] ❌ فشل فتح درج النقود عبر الطابعة:', error);
      throw error;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  الطباعة الخام عبر Win32 API (بدون درايفر رسومي)
  // ═══════════════════════════════════════════════════════

  /**
   * إرسال بيانات خام مباشرة للطابعة عبر Win32 Spooler API
   * هذه الطريقة تتجاوز درايفر الطابعة وترسل أوامر ESC/POS مباشرة
   * @param printerName اسم الطابعة في ويندوز
   * @param data البيانات الخام (ESC/POS)
   * @returns true إذا نجح الإرسال
   */
  private async sendRawToWinPrinter(printerName: string, data: Buffer): Promise<boolean> {
    if (process.platform !== 'win32') {
      console.warn('[كاشي طباعة] ⚠️ الطباعة الخام متاحة فقط على ويندوز');
      return false;
    }

    const runId = Date.now();
    const tempDataFile = path.join(os.tmpdir(), `cashi-raw-${runId}.bin`);
    const tempPsFile = path.join(os.tmpdir(), `cashi-raw-${runId}.ps1`);
    const className = `CashiRaw_${runId}`;

    try {
      // كتابة البيانات الخام في ملف مؤقت
      fs.writeFileSync(tempDataFile, data);

      // سكريبت PowerShell يستخدم Win32 API لإرسال البيانات مباشرة للطابعة
      const safeDataPath = tempDataFile.replace(/'/g, "''");
      const safePrinterName = printerName.replace(/'/g, "''");
      const psScript = `
Add-Type -TypeDefinition @"
using System;
using System.IO;
using System.Runtime.InteropServices;
public class ${className} {
    [StructLayout(LayoutKind.Sequential)] public struct DOCINFOA {
        [MarshalAs(UnmanagedType.LPStr)] public string pDocName;
        [MarshalAs(UnmanagedType.LPStr)] public string pOutputFile;
        [MarshalAs(UnmanagedType.LPStr)] public string pDataType;
    }
    [DllImport("winspool.drv", CharSet=CharSet.Ansi, SetLastError=true)]
    public static extern bool OpenPrinter(string p, out IntPtr h, IntPtr d);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartDocPrinter(IntPtr h, int l, ref DOCINFOA di);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool StartPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool WritePrinter(IntPtr h, IntPtr p, int c, out int w);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndPagePrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool EndDocPrinter(IntPtr h);
    [DllImport("winspool.drv", SetLastError=true)]
    public static extern bool ClosePrinter(IntPtr h);
    public static bool SendFile(string printer, string filePath) {
        byte[] data = File.ReadAllBytes(filePath);
        IntPtr hPrinter;
        if (!OpenPrinter(printer, out hPrinter, IntPtr.Zero)) return false;
        DOCINFOA di = new DOCINFOA { pDocName = "Cashi Receipt", pDataType = "RAW" };
        if (!StartDocPrinter(hPrinter, 1, ref di)) { ClosePrinter(hPrinter); return false; }
        if (!StartPagePrinter(hPrinter)) { EndDocPrinter(hPrinter); ClosePrinter(hPrinter); return false; }
        IntPtr ptr = Marshal.AllocCoTaskMem(data.Length);
        Marshal.Copy(data, 0, ptr, data.Length);
        int written;
        bool ok = WritePrinter(hPrinter, ptr, data.Length, out written);
        Marshal.FreeCoTaskMem(ptr);
        EndPagePrinter(hPrinter);
        EndDocPrinter(hPrinter);
        ClosePrinter(hPrinter);
        return ok && written == data.Length;
    }
}
"@
try {
  \$r = [${className}]::SendFile('${safePrinterName}', '${safeDataPath}')
  if (\$r) { Write-Output "OK" } else { Write-Output "FAIL" }
} catch { Write-Output "FAIL" }
`;

      fs.writeFileSync(tempPsFile, psScript, 'utf-8');
      const output = execSync(
        `powershell -NoProfile -ExecutionPolicy Bypass -File "${tempPsFile}"`,
        { encoding: 'utf-8', timeout: 20000 }
      ).trim();

      const success = output.includes('OK');
      if (success) {
        console.log(`[كاشي طباعة] ✅ تم إرسال ${data.length} بايت خام للطابعة: ${printerName}`);
      } else {
        console.error(`[كاشي طباعة] ❌ فشل إرسال البيانات الخام. Output: ${output}`);
      }
      return success;
    } catch (error) {
      console.error('[كاشي طباعة] ❌ خطأ في الطباعة الخام:', error);
      return false;
    } finally {
      try { fs.unlinkSync(tempDataFile); } catch {}
      try { fs.unlinkSync(tempPsFile); } catch {}
    }
  }

  // ═══════════════════════════════════════════════════════
  //  طباعة HTML كصورة Raster (للطابعات الحرارية USB)
  // ═══════════════════════════════════════════════════════

  /**
   * تحويل محتوى HTML لصورة وإرسالها كأوامر ESC/POS raster مباشرة
   * هذه الطريقة لا تحتاج درايفر رسومي — تعمل مع أي طابعة حرارية ESC/POS
   *
   * الخطوات:
   * 1. فتح نافذة مخفية وتحميل HTML الفاتورة
   * 2. التقاط الصفحة كصورة
   * 3. تحويل الصورة لـ bitmap أبيض وأسود (monochrome)
   * 4. ترميز البيانات بصيغة ESC/POS raster (أمر GS v 0)
   * 5. إرسال البيانات الخام مباشرة للطابعة عبر Win32 API
   *
   * @param html محتوى HTML الإيصال
   * @param parentWindow النافذة الأم
   * @returns true إذا نجحت الطباعة
   */
  async printHtmlAsRaster(html: string, parentWindow: BrowserWindow): Promise<boolean> {
    const config = this.printerConfig;
    const paperW = config?.paperWidth ?? 80;
    const printerName = config?.printerName?.trim();

    if (!printerName) {
      throw new Error('اسم الطابعة غير محدد في الإعدادات');
    }

    // عرض منطقة الطباعة الفعلية بالبكسل (203 DPI معيار الطابعات الحرارية)
    const DPI = 203;
    const printableWidthMM = paperW === 80 ? 72 : 48;
    const printableWidthPx = Math.round((printableWidthMM / 25.4) * DPI); // ~576 لـ 80mm

    // إنشاء نافذة مخفية لعرض HTML الفاتورة
    const renderWindow = new BrowserWindow({
      show: false,
      width: printableWidthPx,
      height: 900,
      x: -10000,
      y: -10000,
      webPreferences: {
        contextIsolation: true,
        nodeIntegration: false,
        offscreen: true,
      },
    });

    try {
      // تحميل HTML الإيصال
      await renderWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
      );

      // انتظار اكتمال تحميل الخطوط والعناصر
      await new Promise((r) => setTimeout(r, 800));

      // قياس الارتفاع الفعلي للمحتوى
      const scrollHeight: number = await renderWindow.webContents.executeJavaScript(
        `Math.max(document.body.scrollHeight || 0, document.documentElement.scrollHeight || 0, 350)`
      );

      // ضبط حجم النافذة لتطابق المحتوى
      const captureHeight = Math.min(scrollHeight + 30, 5000);
      renderWindow.setContentSize(printableWidthPx, captureHeight);
      await new Promise((r) => setTimeout(r, 400));

      // التقاط صورة الإيصال كاملاً
      const image = await renderWindow.webContents.capturePage({
        x: 0,
        y: 0,
        width: printableWidthPx,
        height: captureHeight,
      });

      if (!renderWindow.isDestroyed()) renderWindow.close();

      const size = image.getSize();
      if (size.width === 0 || size.height === 0) {
        throw new Error('فشل التقاط صورة الإيصال — الصورة فارغة');
      }

      console.log(`[كاشي طباعة] 📸 تم التقاط صورة الإيصال: ${size.width}×${size.height}px`);

      // الحصول على بيانات البكسل الخام (RGBA)
      const bitmap = image.toBitmap();

      // تحويل الصورة إلى أبيض وأسود وترميزها كـ ESC/POS raster
      const widthBytes = Math.ceil(size.width / 8);
      const rasterData = Buffer.alloc(widthBytes * size.height);

      for (let y = 0; y < size.height; y++) {
        for (let xByte = 0; xByte < widthBytes; xByte++) {
          let byteVal = 0;
          for (let bit = 0; bit < 8; bit++) {
            const x = xByte * 8 + bit;
            if (x < size.width) {
              const idx = (y * size.width + x) * 4; // RGBA format
              const r = bitmap[idx];
              const g = bitmap[idx + 1];
              const b = bitmap[idx + 2];
              // تحويل لدرجة رمادية — البكسل الداكن = 1 (طباعة)
              const gray = 0.299 * r + 0.587 * g + 0.114 * b;
              if (gray < 128) {
                byteVal |= 0x80 >> bit;
              }
            }
          }
          rasterData[y * widthBytes + xByte] = byteVal;
        }
      }

      // بناء أوامر ESC/POS الكاملة
      const header = Buffer.from([
        0x1b, 0x40, // ESC @ — تهيئة الطابعة
        0x1d, 0x76, 0x30, 0x00, // GS v 0 m=0 — طباعة صورة raster
        widthBytes & 0xff,
        (widthBytes >> 8) & 0xff, // xL xH — عرض الصورة بالبايت
        size.height & 0xff,
        (size.height >> 8) & 0xff, // yL yH — ارتفاع الصورة بالنقاط
      ]);

      const footer = Buffer.from([
        0x0a, 0x0a, 0x0a, 0x0a, // تغذية ورق إضافية
        0x1d, 0x56, 0x42, 0x00, // GS V B 0 — قص جزئي للورق
      ]);

      const fullData = Buffer.concat([header, rasterData, footer]);

      console.log(
        `[كاشي طباعة] 🖨️ إرسال ${fullData.length} بايت raster للطابعة: ${printerName}`
      );

      // إرسال البيانات الخام مباشرة للطابعة
      const success = await this.sendRawToWinPrinter(printerName, fullData);

      if (success) {
        console.log('[كاشي طباعة] ✅ تمت طباعة الإيصال كصورة raster بنجاح!');
      } else {
        throw new Error('فشل إرسال بيانات raster للطابعة');
      }

      return success;
    } catch (err) {
      if (!renderWindow.isDestroyed()) renderWindow.close();
      throw err;
    }
  }

  // ═══════════════════════════════════════════════════════
  //  الطباعة الاحتياطية عبر Electron
  // ═══════════════════════════════════════════════════════

  /**
   * طباعة احتياطية باستخدام نظام الطباعة المدمج في Electron
   * للطابعات الحرارية USB: يحاول أولاً الطباعة كصورة raster مباشرة
   * إذا فشلت: يستخدم نظام طباعة Electron/Windows كاحتياط
   * @param html محتوى HTML للطباعة
   * @param parentWindow النافذة الأم (للحوارات)
   * @returns true إذا نجحت الطباعة
   */
  async fallbackPrint(html: string, parentWindow: BrowserWindow): Promise<boolean> {
    const config = this.printerConfig;

    // ═══ للطابعات الحرارية USB على ويندوز: طباعة raster مباشرة ═══
    if (process.platform === 'win32' && config?.printerName?.trim()) {
      try {
        console.log('[كاشي طباعة] 🖨️ محاولة الطباعة الحرارية المباشرة (HTML → صورة → ESC/POS raster)...');
        return await this.printHtmlAsRaster(html, parentWindow);
      } catch (rasterErr) {
        console.warn('[كاشي طباعة] ⚠️ فشلت طباعة Raster، جاري التحويل لطباعة Electron:', rasterErr);
        // نكمل للطباعة الاحتياطية عبر Electron
      }
    }

    // ═══ الطريقة الاحتياطية: طباعة عبر نظام Electron/Windows ═══
    return new Promise((resolve, reject) => {
      const paperW = config?.paperWidth ?? 80;
      const isSilent = config?.silentPrint !== false;
      const targetPrinter = config?.printerName?.trim() || undefined;
      const winWidth = paperW === 80 ? 320 : 230;

      const printWindow = new BrowserWindow({
        show: false,
        parent: parentWindow,
        width: winWidth,
        height: 750,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      printWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
      );

      printWindow.webContents.on('did-finish-load', async () => {
        try {
          // انتظر قليلاً لضمان اكتمال تحميل الخطوط وصور الباركود وQR
          await new Promise((r) => setTimeout(r, 450));

          // قياس الارتفاع الفعلي لمحتوى الإيصال بالبكسل من الـ DOM مباشرة
          let scrollHeight = 500;
          try {
            scrollHeight = await printWindow.webContents.executeJavaScript(
              `Math.max(
                document.body.scrollHeight || 0,
                document.documentElement.scrollHeight || 0,
                document.querySelector('.receipt-container')?.scrollHeight || 0,
                document.querySelector('.kitchen-container')?.scrollHeight || 0,
                document.querySelector('.report-container')?.scrollHeight || 0,
                350
              )`
            );
          } catch {
            scrollHeight = 600;
          }

          // تحويل البكسل (بدقة 96 DPI) إلى ميكرومتر بدقة لمقاس الورق الحراري
          // مع إضافة 12 مم هامش للتغذية وقص الورق في نهاية الفاتورة
          const contentHeightMicrons = Math.max(
            Math.ceil((scrollHeight / 96) * 25.4 * 1000) + 12000,
            50000 // حد أدنى 50 مم
          );

          console.log(`[كاشي طباعة] 📏 أبعاد الإيصال الحراري: عرض ${paperW} مم، ارتفاع ${(contentHeightMicrons / 1000).toFixed(1)} مم (${scrollHeight}px)`);

          const printOptions: Electron.WebContentsPrintOptions = {
            silent: isSilent,
            printBackground: true,
            deviceName: targetPrinter,
            margins: {
              marginType: 'none',
            },
            pageSize: {
              width: paperW * 1000, // 80000µm أو 58000µm
              height: contentHeightMicrons, // الارتفاع الفعلي الحقيقي بدلاً من 3 أمتار
            },
          };

          printWindow.webContents.print(printOptions, (success, failureReason) => {
            if (!printWindow.isDestroyed()) {
              printWindow.close();
            }

            if (success) {
              console.log(`[كاشي طباعة] ✅ تمت طباعة الإيصال بنجاح على: ${targetPrinter || 'طابعة النظام الافتراضية'}`);
              resolve(true);
            } else {
              console.error(`[كاشي طباعة] ❌ فشلت الطباعة على ${targetPrinter || 'الافتراضية'}:`, failureReason);
              
              // إذا فشلت الطباعة الصامتة على طابعة محددة، نعيد المحاولة بإظهار نافذة اختيار الطابعة
              if (isSilent) {
                console.log('[كاشي طباعة] 🔄 محاولة الطباعة بإظهار نافذة اختيار الطابعة من ويندوز...');
                const retryWindow = new BrowserWindow({
                  show: false,
                  parent: parentWindow,
                  width: winWidth,
                  height: 750,
                  webPreferences: { contextIsolation: true, nodeIntegration: false },
                });
                retryWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
                retryWindow.webContents.on('did-finish-load', () => {
                  setTimeout(() => {
                    retryWindow.webContents.print({
                      silent: false, // إظهار نافذة الويندوز لاختيار الطابعة يدوياً
                      printBackground: true,
                      margins: { marginType: 'none' },
                    }, (retrySuccess, retryReason) => {
                      if (!retryWindow.isDestroyed()) retryWindow.close();
                      if (retrySuccess) {
                        console.log('[كاشي طباعة] ✅ نجحت الطباعة عبر نافذة الويندوز');
                        resolve(true);
                      } else {
                        reject(new Error(retryReason || 'ألغى المستخدم أو فشلت الطباعة'));
                      }
                    });
                  }, 400);
                });
                return;
              }

              reject(new Error(`فشلت الطباعة: ${failureReason}`));
            }
          });
        } catch (err) {
          if (!printWindow.isDestroyed()) {
            printWindow.close();
          }
          reject(err);
        }
      });

      setTimeout(() => {
        if (!printWindow.isDestroyed()) {
          printWindow.close();
        }
        reject(new Error('مهلة الطباعة انتهت'));
      }, 25000);
    });
  }

  // ═══════════════════════════════════════════════════════
  //  دوال مساعدة
  // ═══════════════════════════════════════════════════════

  /**
   * التحقق من اتصال الطابعة
   * @returns true إذا كانت الطابعة متصلة وجاهزة
   */
  async isPrinterConnected(): Promise<boolean> {
    if (!this.isThermalAvailable || !this.printerConfig) {
      return false;
    }
    try {
      const ThermalPrinter = this.thermalPrinter.printer;
      const printer = new ThermalPrinter({
        type: this.getPrinterType(),
        interface: this.getPrinterInterface(),
      });
      return await printer.isPrinterConnected();
    } catch {
      return false;
    }
  }

  /**
   * طباعة صفحة اختبار للتحقق من عمل الطابعة
   */
  async printTestPage(): Promise<boolean> {
    if (!this.isThermalAvailable || !this.printerConfig) {
      throw new Error('مكتبة الطباعة الحرارية غير متوفرة');
    }
    const ThermalPrinter = this.thermalPrinter.printer;
    const printer = new ThermalPrinter({
      type: this.getPrinterType(),
      interface: this.getPrinterInterface(),
      characterSet: 'PC720_ARABIC',
      removeSpecialCharacters: false,
    });

    try {
      printer.alignCenter();
      printer.bold(true);
      printer.println('=== صفحة اختبار كاشي ===');
      printer.println('Cashi POS — Printer Test Page');
      printer.bold(false);
      printer.drawLine();
      printer.println('الطابعة تعمل بشكل صحيح بنجاح ✅');
      printer.println(`تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}`);
      printer.drawLine();
      printer.println('أرقام وحسابات: 1234567890 | ١٢٣٤٥٦٧٨٩٠');
      printer.println('اختبار الحروف العربية: طابعة كاشي الحرارية');
      printer.drawLine();
      printer.cut();
      await printer.execute();
      return true;
    } catch (error) {
      console.error('[كاشي طباعة] ❌ فشل طباعة صفحة الاختبار:', error);
      throw error;
    }
  }
}
