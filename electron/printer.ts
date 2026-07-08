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
  //  الطباعة الاحتياطية عبر Electron
  // ═══════════════════════════════════════════════════════

  /**
   * طباعة احتياطية باستخدام نظام الطباعة المدمج في Electron
   * @param html محتوى HTML للطباعة
   * @param parentWindow النافذة الأم (للحوارات)
   * @returns true إذا نجحت الطباعة
   */
  async fallbackPrint(html: string, parentWindow: BrowserWindow): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const printWindow = new BrowserWindow({
        show: false,
        parent: parentWindow,
        webPreferences: {
          contextIsolation: true,
          nodeIntegration: false,
        },
      });

      printWindow.loadURL(
        `data:text/html;charset=utf-8,${encodeURIComponent(html)}`
      );

      printWindow.webContents.on('did-finish-load', () => {
        const printOptions: Electron.WebContentsPrintOptions = {
          silent: true,
          printBackground: true,
          deviceName: this.printerConfig?.printerName || undefined,
          margins: {
            marginType: 'none',
          },
          pageSize: {
            width: (this.printerConfig?.paperWidth ?? 80) * 1000,
            height: 297000,
          },
        };

        printWindow.webContents.print(printOptions, (success, failureReason) => {
          printWindow.close();

          if (success) {
            console.log('[كاشي طباعة] ✅ تمت الطباعة الاحتياطية بنجاح');
            resolve(true);
          } else {
            console.error('[كاشي طباعة] ❌ فشلت الطباعة الاحتياطية:', failureReason);
            reject(new Error(`فشلت الطباعة: ${failureReason}`));
          }
        });
      });

      setTimeout(() => {
        if (!printWindow.isDestroyed()) {
          printWindow.close();
        }
        reject(new Error('مهلة الطباعة انتهت'));
      }, 10000);
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
