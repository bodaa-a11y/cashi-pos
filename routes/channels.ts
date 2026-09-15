import express from "express";
import { readDB, writeDB, writeAuditLog } from "../db/db";
import { authenticate } from "../middleware/authenticate";
import { SalesChannel, ChannelItemPrice } from "../src/types";

const router = express.Router();

/**
 * جلب جميع قنوات البيع النشطة (للكاشير وللإدارة)
 */
router.get("/api/channels", (req, res) => {
  try {
    const db = readDB();
    const channels: SalesChannel[] = db.salesChannels || [];
    res.json(channels.filter(c => c.isActive !== false));
  } catch (err: any) {
    res.status(500).json({ error: "فشل في جلب قنوات البيع: " + err.message });
  }
});

/**
 * إضافة أو تعديل قناة بيع (مدير أو مشرف فقط)
 */
router.post("/api/channels", authenticate(["admin", "manager"]), (req, res) => {
  try {
    const { id, name, defaultMarkupPercent, isActive } = req.body;
    if (!id || !name || typeof defaultMarkupPercent !== "number") {
      return res.status(400).json({ error: "بيانات قناة البيع غير مكتملة (المعرف والاسم ونسبة الزيادة مطلوبة)" });
    }

    const db = readDB();
    if (!db.salesChannels) db.salesChannels = [];

    const now = new Date().toISOString();
    const existingIndex = db.salesChannels.findIndex((c: SalesChannel) => c.id === id);

    const channelData: SalesChannel = {
      id,
      name,
      defaultMarkupPercent: Number(defaultMarkupPercent) || 0,
      isActive: isActive !== false,
      createdAt: existingIndex >= 0 ? (db.salesChannels[existingIndex].createdAt || now) : now,
      updatedAt: now
    };

    if (existingIndex >= 0) {
      db.salesChannels[existingIndex] = channelData;
    } else {
      db.salesChannels.push(channelData);
    }

    writeDB(db);
    writeAuditLog(
      existingIndex >= 0 ? "تعديل قناة بيع" : "إضافة قناة بيع",
      (req as any).user?.id || "system",
      (req as any).user?.fullName || "مدير النظام",
      `تم حفظ قناة البيع ${name} بنسبة زيادة افتراضية ${defaultMarkupPercent}%`
    );

    res.json(channelData);
  } catch (err: any) {
    res.status(500).json({ error: "فشل في حفظ قناة البيع: " + err.message });
  }
});

/**
 * جلب جميع أسعار الأصناف المخصصة لقناة معينة
 */
router.get("/api/channels/:channelId/prices", authenticate(["admin", "manager"]), (req, res) => {
  try {
    const { channelId } = req.params;
    const db = readDB();
    const allPrices: ChannelItemPrice[] = db.channelItemPrices || [];
    const filtered = allPrices.filter(p => p.channelId === channelId);
    res.json(filtered);
  } catch (err: any) {
    res.status(500).json({ error: "فشل في جلب أسعار القناة: " + err.message });
  }
});

/**
 * تحديد سعر ثابت لصنف معين داخل قناة معينة (مدير أو مشرف فقط)
 */
router.put("/api/channels/:channelId/items/:itemId/price", authenticate(["admin", "manager"]), (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const { price } = req.body;

    if (typeof price !== "number" || price < 0) {
      return res.status(400).json({ error: "قيمة السعر غير صالحة" });
    }

    const db = readDB();
    if (!db.channelItemPrices) db.channelItemPrices = [];

    const now = new Date().toISOString();
    const existingIndex = db.channelItemPrices.findIndex(
      (p: ChannelItemPrice) => p.itemId === itemId && p.channelId === channelId
    );

    const priceEntry: ChannelItemPrice = {
      itemId,
      channelId,
      price: Number(price),
      updatedBy: (req as any).user?.id || "system",
      updatedAt: now
    };

    if (existingIndex >= 0) {
      db.channelItemPrices[existingIndex] = priceEntry;
    } else {
      db.channelItemPrices.push(priceEntry);
    }

    // مزامنة حقل deliveryPrice السريع في جدول المنتجات لو كانت القناة تطبيقا
    const prod = (db.products || []).find((p: any) => p.id === itemId);
    if (prod && ["takeaway", "hungerstation", "jahez", "toyou", "ninja", "keeta"].includes(channelId)) {
      prod.deliveryPrice = Number(price);
    }

    writeDB(db);
    res.json(priceEntry);
  } catch (err: any) {
    res.status(500).json({ error: "فشل في حفظ سعر الصنف للقناة: " + err.message });
  }
});

/**
 * حساب السعر الفعلي لصنف معين في قناة معينة:
 * 1) إذا وجد سعر مخصص محفوظ للصنف في هذه القناة -> يستخدمه
 * 2) غير ذلك -> السعر الأساسي + نسبة الزيادة الافتراضية للقناة
 */
router.get("/api/channels/:channelId/items/:itemId/resolved-price", (req, res) => {
  try {
    const { channelId, itemId } = req.params;
    const db = readDB();

    const prod = (db.products || []).find((p: any) => p.id === itemId);
    if (!prod) {
      return res.status(404).json({ error: "الصنف غير موجود" });
    }

    const basePrice = Number(prod.price) || 0;

    // قناة البيع العادية داخل الصالة
    if (channelId === "in-store") {
      return res.json({ itemId, channelId, price: basePrice, source: "base" });
    }

    const channels: SalesChannel[] = db.salesChannels || [];
    const channel = channels.find(c => c.id === channelId && c.isActive !== false);

    const customPrices: ChannelItemPrice[] = db.channelItemPrices || [];
    const custom = customPrices.find(p => p.itemId === itemId && p.channelId === channelId);

    if (custom) {
      return res.json({ itemId, channelId, price: custom.price, source: "custom" });
    }

    // استخدام سعر deliveryPrice في الصنف إن وجد كأولوية
    if (prod.deliveryPrice && Number(prod.deliveryPrice) > 0) {
      return res.json({ itemId, channelId, price: Number(prod.deliveryPrice), source: "product-delivery-price" });
    }

    if (channel) {
      const markup = Number(channel.defaultMarkupPercent) || 0;
      const computed = Math.round(basePrice * (1 + markup / 100) * 100) / 100;
      return res.json({ itemId, channelId, price: computed, source: "default-markup" });
    }

    res.json({ itemId, channelId, price: basePrice, source: "base-fallback" });
  } catch (err: any) {
    res.status(500).json({ error: "خطأ في حساب السعر: " + err.message });
  }
});

export default router;
