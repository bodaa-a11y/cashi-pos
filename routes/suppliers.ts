import express from "express";
import { readDB, writeDB, writeAuditLog } from "../db/db";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

// ─── الموردين ───────────────────────────────────────────
router.get("/api/suppliers", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.suppliers || []);
});

router.post("/api/suppliers", authenticate(["admin", "manager"]), (req, res) => {
  const { name, phone, address, notes } = req.body;
  const db = readDB();
  if (!db.suppliers) db.suppliers = [];

  if (!name || !String(name).trim()) {
    return res.status(400).json({ error: "اسم المورد مطلوب" });
  }

  const newSupplier = {
    id: `sup-${Date.now()}`,
    name: String(name).trim(),
    phone: phone || "",
    address: address || "",
    notes: notes || "",
    isActive: true,
    createdAt: new Date().toISOString(),
  };

  db.suppliers.push(newSupplier);
  writeDB(db);
  writeAuditLog("إضافة مورد", (req as any).user?.id || "system", (req as any).user?.fullName || "نظام", `تمت إضافة المورد: ${newSupplier.name}`);
  res.json(newSupplier);
});

router.put("/api/suppliers/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const { name, phone, address, notes, isActive } = req.body;
  const db = readDB();
  const supplier = (db.suppliers || []).find((s: any) => s.id === id);
  if (!supplier) return res.status(404).json({ error: "المورد غير موجود" });

  supplier.name = name ?? supplier.name;
  supplier.phone = phone ?? supplier.phone;
  supplier.address = address ?? supplier.address;
  supplier.notes = notes ?? supplier.notes;
  if (isActive !== undefined) supplier.isActive = isActive;

  writeDB(db);
  res.json(supplier);
});

router.delete("/api/suppliers/:id", authenticate(["admin"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const hasOrders = (db.purchase_orders || []).some((po: any) => po.supplierId === id);
  if (hasOrders) {
    return res.status(400).json({ error: "لا يمكن حذف مورد له أوامر شراء مسجلة — عطّله بدل الحذف" });
  }
  db.suppliers = (db.suppliers || []).filter((s: any) => s.id !== id);
  writeDB(db);
  res.json({ success: true });
});

// ─── أوامر الشراء ───────────────────────────────────────
router.get("/api/purchase-orders", authenticate(["admin", "manager"]), (req, res) => {
  const { supplierId, status } = req.query;
  const db = readDB();
  let list = db.purchase_orders || [];
  if (supplierId) list = list.filter((po: any) => po.supplierId === supplierId);
  if (status) list = list.filter((po: any) => po.status === status);
  res.json(list.slice().reverse());
});

router.post("/api/purchase-orders", authenticate(["admin", "manager"]), (req, res) => {
  const { supplierId, items, notes } = req.body;
  const db = readDB();
  if (!db.purchase_orders) db.purchase_orders = [];

  const supplier = (db.suppliers || []).find((s: any) => s.id === supplierId);
  if (!supplier) return res.status(400).json({ error: "المورد غير موجود" });

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ error: "أمر الشراء لازم يحتوي على صنف واحد على الأقل" });
  }

  const normalizedItems = items.map((it: any) => {
    const invItem = (db.inventory_items || []).find((i: any) => i.id === it.inventoryItemId);
    if (!invItem) throw new Error("صنف مخزون غير موجود");
    const quantity = Number(it.quantity || 0);
    const unitCost = Number(it.unitCost || 0);
    return {
      inventoryItemId: invItem.id,
      nameAr: invItem.nameAr,
      unit: invItem.unit,
      quantity,
      unitCost,
      total: quantity * unitCost,
    };
  });

  const totalCost = normalizedItems.reduce((sum: number, it: any) => sum + it.total, 0);

  const poCount = db.purchase_orders.length + 1;
  const newPO = {
    id: `po-${Date.now()}`,
    poNumber: poCount,
    supplierId,
    supplierName: supplier.name,
    status: "draft", // draft | ordered | received | cancelled
    items: normalizedItems,
    totalCost,
    notes: notes || "",
    createdBy: (req as any).user?.fullName || "نظام",
    createdAt: new Date().toISOString(),
    receivedAt: null,
  };

  db.purchase_orders.push(newPO);
  writeDB(db);
  writeAuditLog("إنشاء أمر شراء", (req as any).user?.id || "system", (req as any).user?.fullName || "نظام", `أمر شراء #${poCount} من ${supplier.name} بقيمة ${totalCost}`);
  res.json(newPO);
});

router.put("/api/purchase-orders/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const { items, notes, status } = req.body;
  const db = readDB();
  const po = (db.purchase_orders || []).find((p: any) => p.id === id);
  if (!po) return res.status(404).json({ error: "أمر الشراء غير موجود" });
  if (po.status === "received") {
    return res.status(400).json({ error: "لا يمكن تعديل أمر شراء تم استلامه بالفعل" });
  }

  if (items) {
    const normalizedItems = items.map((it: any) => {
      const invItem = (db.inventory_items || []).find((i: any) => i.id === it.inventoryItemId);
      if (!invItem) throw new Error("صنف مخزون غير موجود");
      const quantity = Number(it.quantity || 0);
      const unitCost = Number(it.unitCost || 0);
      return { inventoryItemId: invItem.id, nameAr: invItem.nameAr, unit: invItem.unit, quantity, unitCost, total: quantity * unitCost };
    });
    po.items = normalizedItems;
    po.totalCost = normalizedItems.reduce((sum: number, it: any) => sum + it.total, 0);
  }
  if (notes !== undefined) po.notes = notes;
  if (status && ["draft", "ordered", "cancelled"].includes(status)) po.status = status;

  writeDB(db);
  res.json(po);
});

// ─── استلام أمر الشراء (بيزوّد المخزون فعلياً) ──────────
router.post("/api/purchase-orders/:id/receive", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const po = (db.purchase_orders || []).find((p: any) => p.id === id);
  if (!po) return res.status(404).json({ error: "أمر الشراء غير موجود" });
  if (po.status === "received") return res.status(400).json({ error: "تم استلام هذا الأمر بالفعل" });
  if (po.status === "cancelled") return res.status(400).json({ error: "لا يمكن استلام أمر شراء ملغي" });

  if (!db.inventory_transactions) db.inventory_transactions = [];

  for (const it of po.items) {
    const invItem = (db.inventory_items || []).find((i: any) => i.id === it.inventoryItemId);
    if (!invItem) continue;
    invItem.quantity = Number(invItem.quantity || 0) + Number(it.quantity || 0);

    db.inventory_transactions.push({
      id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      itemId: invItem.id,
      type: "purchase",
      quantityChange: Number(it.quantity || 0),
      reason: `استلام أمر شراء #${po.poNumber} من ${po.supplierName}`,
      createdBy: (req as any).user?.fullName || "نظام",
      createdAt: new Date().toISOString(),
    });
  }

  po.status = "received";
  po.receivedAt = new Date().toISOString();

  writeDB(db);
  writeAuditLog("استلام أمر شراء", (req as any).user?.id || "system", (req as any).user?.fullName || "نظام", `تم استلام أمر الشراء #${po.poNumber} وتحديث المخزون`);
  res.json(po);
});

export default router;
