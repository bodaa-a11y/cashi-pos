import express from "express";
import crypto from "crypto";
import { readDB, writeDB, writeAuditLog } from "../db/db";
import { authenticate } from "../middleware/authenticate";
import { hashWithSalt } from "../utils/hashing";
import { PriceAuditLogEntry } from "../src/types";

const router = express.Router();

// أقصى نسبة تخفيض أو زيادة مسموح بها بدون تدخل المالك (افتراضياً 35%)
const MAX_OVERRIDE_PERCENT = Number(process.env.CASHI_MAX_PRICE_OVERRIDE_PERCENT ?? 35);

/**
 * دالة التحقق من رمز PIN الخاص بالمشرف/المدير
 */
function verifyManagerPin(db: any, pin: string): any {
  if (!pin) return null;
  const managers = (db.users || []).filter((u: any) => u.isActive && (u.role === "admin" || u.role === "manager"));
  for (const mgr of managers) {
    if (mgr.pinSalt && mgr.pinHash) {
      const hashed = hashWithSalt(pin, mgr.pinSalt);
      if (hashed === mgr.pinHash) return mgr;
    }
    // دعم الرمز الصريح القديم إذا وجد
    if (mgr.pinCode && String(mgr.pinCode) === String(pin)) {
      return mgr;
    }
  }
  return null;
}

/**
 * تعديل استثنائي لسعر صنف داخل طلب وقت البيع:
 * - مسموح مباشرة للمدير/الأدمن
 * - مسموح للكاشير بشرط إدخال رمز PIN معتمد للمدير/الأدمن
 * - يتم تسجيل العملية فورياً في سجل التدقيق المالي غير القابل للحذف
 */
router.post("/api/orders/override-price", authenticate(), (req, res) => {
  try {
    const {
      itemId,
      orderId,
      originalPrice,
      newPrice,
      reason,
      approverPin
    } = req.body;

    const requester = (req as any).user;
    if (!requester) {
      return res.status(401).json({ error: "غير مصرح: يجب تسجيل الدخول" });
    }

    if (typeof newPrice !== "number" || newPrice < 0) {
      return res.status(400).json({ error: "قيمة السعر الجديد غير صالحة" });
    }

    const db = readDB();
    const prod = (db.products || []).find((p: any) => p.id === itemId);
    if (!prod) {
      return res.status(404).json({ error: "الصنف غير موجود في النظام" });
    }

    const basePrice = Number(originalPrice || prod.price);
    let approver = requester;

    // إذا كان المستخدم كاشير عادي، يتطلب رمز PIN للمدير
    if (requester.role !== "admin" && requester.role !== "manager") {
      if (!approverPin) {
        return res.status(403).json({ error: "تعديل السعر يتطلب موافقة المدير - يرجى إدخال رمز PIN الخاص بالمدير" });
      }

      const verifiedManager = verifyManagerPin(db, approverPin);
      if (!verifiedManager) {
        return res.status(403).json({ error: "رمز PIN للمدير غير صحيح أو ليس لديه صلاحية إدارة" });
      }
      approver = verifiedManager;
    }

    const deltaPercent = basePrice > 0 ? ((newPrice - basePrice) / basePrice) * 100 : 0;

    // فحص النسبة القصوى المسموحة
    if (Math.abs(deltaPercent) > MAX_OVERRIDE_PERCENT && approver.role !== "admin") {
      return res.status(403).json({
        error: `التعديل يتجاوز الحد المسموح (${MAX_OVERRIDE_PERCENT}%). يتطلب موافقة مدير النظام الأول.`
      });
    }

    const auditEntry: PriceAuditLogEntry = {
      id: `price-audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      itemId,
      itemName: prod.nameAr || prod.nameEn || "صنف",
      orderId: orderId || undefined,
      channelId: null,
      originalPrice: basePrice,
      newPrice,
      deltaPercent: Math.round(deltaPercent * 100) / 100,
      reason: reason || "تعديل يدوي استثنائي وقت البيع",
      performedByUserId: requester.id,
      performedByUsername: requester.fullName || requester.username,
      approvedByUserId: approver.id,
      timestamp: new Date().toISOString()
    };

    if (!db.priceAuditLog) db.priceAuditLog = [];
    db.priceAuditLog.push(auditEntry);

    // أيضاً نوثقها في audit_logs العام للنظام
    writeAuditLog(
      "تعديل سعر استثنائي",
      requester.id,
      requester.fullName || requester.username,
      `تم تعديل سعر (${prod.nameAr}) من ${basePrice} إلى ${newPrice} ر.س (${deltaPercent.toFixed(1)}%). السبب: ${reason || "بدون سبب"}. موافقة: ${approver.fullName || approver.username}`
    );

    writeDB(db);

    res.json({
      success: true,
      entry: auditEntry,
      newPrice,
      originalPrice: basePrice
    });
  } catch (err: any) {
    res.status(500).json({ error: "فشل في تسجيل تعديل السعر: " + err.message });
  }
});

/**
 * عرض سجل تدقيق تعديلات الأسعار - مخصص للإدارة
 */
router.get("/api/price-audit-log", authenticate(["admin", "manager"]), (req, res) => {
  try {
    const db = readDB();
    const log: PriceAuditLogEntry[] = db.priceAuditLog || [];
    res.json(log.slice(-200).reverse());
  } catch (err: any) {
    res.status(500).json({ error: "فشل في جلب سجل التدقيق: " + err.message });
  }
});

export default router;
