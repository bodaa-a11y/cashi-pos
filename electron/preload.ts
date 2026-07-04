/**
 * ===================================================
 *  كاشي - نظام الكاشير المتكامل
 *  Cashi POS — Preload Script
 * ===================================================
 *
 * سكريبت التحميل المسبق (Preload)
 * يعمل كجسر آمن بين عملية إلكترون الرئيسية (Main Process)
 * والواجهة الأمامية (Renderer Process).
 *
 * يستخدم contextBridge لعرض قنوات IPC محددة فقط،
 * مما يمنع الواجهة الأمامية من الوصول المباشر لـ Node.js أو إلكترون.
 */

import { contextBridge, ipcRenderer } from 'electron';

// ─── تعريف الأنواع للواجهة المكشوفة ──────────────────────────
// هذا التعريف يُتيح الإكمال التلقائي في TypeScript عند استخدام window.electronAPI

/**
 * واجهة الـ API المكشوفة للواجهة الأمامية
 * تحتوي على جميع الدوال المتاحة للتواصل مع العملية الرئيسية
 */
export interface ElectronAPI {
  /** علامة تدل على أن التطبيق يعمل داخل إلكترون */
  isElectron: true;

  /** طباعة إيصال البيع */
  printReceipt: (data: any) => Promise<{ success: boolean; error?: string }>;

  /** طباعة تذكرة المطبخ */
  printKitchenTicket: (data: any) => Promise<{ success: boolean; error?: string }>;

  /** فتح درج النقود */
  openCashDrawer: () => Promise<{ success: boolean; error?: string }>;

  /** الحصول على قائمة الطابعات المتاحة */
  getPrinterList: () => Promise<{ success: boolean; printers: string[] }>;

  /** الحصول على معلومات التطبيق (الإصدار، IP، المنفذ، رابط المدير) */
  getAppInfo: () => Promise<{
    version: string;
    localIP: string;
    port: number;
    managerUrl: string;
  }>;

  /** حفظ إعدادات الطابعة */
  savePrinterSettings: (settings: any) => Promise<{ success: boolean; error?: string }>;

  /** قراءة إعدادات الطابعة المحفوظة */
  getPrinterSettings: () => Promise<{ success: boolean; settings: any }>;
}

// ─── تعريف نوع Window العام ───────────────────────────────────
// يُضاف إلى الكائن العام لكي يتعرف عليه TypeScript في الواجهة الأمامية

declare global {
  interface Window {
    /** واجهة إلكترون المكشوفة — متاحة فقط عند تشغيل التطبيق في إلكترون */
    electronAPI: ElectronAPI;
  }
}

// ═══════════════════════════════════════════════════════════════
//  كشف الـ API الآمن للواجهة الأمامية
// ═══════════════════════════════════════════════════════════════

/**
 * عرض واجهة برمجة آمنة (API) للواجهة الأمامية عبر contextBridge
 *
 * الأمان:
 * - كل دالة مكشوفة تستدعي ipcRenderer.invoke فقط على قنوات محددة
 * - لا يتم كشف ipcRenderer مباشرة أبداً
 * - لا يمكن للواجهة الأمامية إرسال رسائل على قنوات غير معرّفة هنا
 * - contextIsolation يمنع الواجهة من تعديل هذا الكائن
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // ─── علامة التعريف ─────────────────────────────────────
  // تُستخدم في الواجهة الأمامية للتحقق مما إذا كان التطبيق
  // يعمل في إلكترون أم في المتصفح العادي
  isElectron: true as const,

  // ─── الطباعة ───────────────────────────────────────────
  // طباعة إيصال البيع — يُرسل بيانات الإيصال للطابعة الحرارية
  printReceipt: (data: any) => {
    return ipcRenderer.invoke('print-receipt', data);
  },

  // طباعة تذكرة المطبخ — تذكرة مختصرة تُرسل لطابعة المطبخ
  printKitchenTicket: (data: any) => {
    return ipcRenderer.invoke('print-kitchen', data);
  },

  // فتح درج النقود — إرسال أمر فتح الدرج عبر الطابعة
  openCashDrawer: () => {
    return ipcRenderer.invoke('open-drawer');
  },

  // ─── إدارة الطابعات ───────────────────────────────────
  // الحصول على قائمة بجميع الطابعات المتصلة بالجهاز
  getPrinterList: () => {
    return ipcRenderer.invoke('get-printers');
  },

  // حفظ إعدادات الطابعة (نوعها، عنوانها، عرض الورق، إلخ)
  savePrinterSettings: (settings: any) => {
    return ipcRenderer.invoke('save-printer-settings', settings);
  },

  // قراءة إعدادات الطابعة المحفوظة مسبقاً
  getPrinterSettings: () => {
    return ipcRenderer.invoke('get-printer-settings');
  },

  // ─── معلومات التطبيق ──────────────────────────────────
  // الحصول على معلومات النظام (الإصدار، IP المحلي، المنفذ، رابط لوحة المدير)
  getAppInfo: () => {
    return ipcRenderer.invoke('get-app-info');
  },
});

// ─── تأكيد تحميل السكريبت ────────────────────────────────────
console.log('[كاشي] ✅ تم تحميل سكريبت Preload بنجاح');
