import express from "express";
import { readDB, writeDB } from "../db/db";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

// 1. الأصناف الخام في المستودع
router.get("/api/inventory/items", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.inventory_items || []);
});

router.post("/api/inventory/items", authenticate(["admin", "manager"]), (req, res) => {
  const { nameAr, nameEn, sku, unit, quantity, lowStockThreshold } = req.body;
  const db = readDB();
  
  if (!db.inventory_items) db.inventory_items = [];

  const newItem = {
    id: `ii-${Date.now()}`,
    nameAr,
    nameEn,
    sku: sku || "",
    unit,
    quantity: Number(quantity || 0),
    lowStockThreshold: Number(lowStockThreshold || 0),
    createdAt: new Date().toISOString()
  };

  db.inventory_items.push(newItem);
  writeDB(db);
  res.json(newItem);
});

router.put("/api/inventory/items/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const { nameAr, nameEn, sku, unit, quantity, lowStockThreshold } = req.body;
  const db = readDB();
  
  if (!db.inventory_items) db.inventory_items = [];
  const item = db.inventory_items.find((i: any) => i.id === id);

  if (!item) {
    return res.status(404).json({ error: "الصنف الخام غير موجود" });
  }

  item.nameAr = nameAr || item.nameAr;
  item.nameEn = nameEn || item.nameEn;
  item.sku = sku !== undefined ? sku : item.sku;
  item.unit = unit || item.unit;
  item.quantity = quantity !== undefined ? Number(quantity) : item.quantity;
  item.lowStockThreshold = lowStockThreshold !== undefined ? Number(lowStockThreshold) : item.lowStockThreshold;
  item.updatedAt = new Date().toISOString();

  writeDB(db);
  res.json(item);
});

router.delete("/api/inventory/items/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  
  if (db.inventory_items) {
    db.inventory_items = db.inventory_items.filter((i: any) => i.id !== id);
  }
  
  // إزالة الصنف من كافة الوصفات
  if (db.recipes) {
    db.recipes.forEach((r: any) => {
      if (r.ingredients) {
        r.ingredients = r.ingredients.filter((ing: any) => ing.inventoryItemId !== id);
      }
    });
  }

  writeDB(db);
  res.json({ success: true });
});

// 2. الحركات المخزنية
router.get("/api/inventory/transactions", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.inventory_transactions || []);
});

router.post("/api/inventory/transactions", authenticate(["admin", "manager"]), (req, res) => {
  const { inventoryItemId, changeQty, reason } = req.body;
  const db = readDB();

  if (!db.inventory_items) db.inventory_items = [];
  const item = db.inventory_items.find((i: any) => i.id === inventoryItemId);

  if (!item) {
    return res.status(404).json({ error: "الصنف الخام غير موجود" });
  }

  const change = Number(changeQty);
  item.quantity = Math.max(0, item.quantity + change);

  if (!db.inventory_transactions) db.inventory_transactions = [];
  
  const creatorId = (req as any).user ? (req as any).user.id : "admin";
  const newTx = {
    id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
    inventoryItemId,
    changeQty: change,
    reason: reason || "تعديل مخزني يدوي",
    createdBy: creatorId,
    createdAt: new Date().toISOString()
  };

  db.inventory_transactions.push(newTx);
  writeDB(db);
  res.json({ success: true, item });
});

// 3. وصفات المنتجات (Recipes)
router.get("/api/recipes", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.recipes || []);
});

router.post("/api/recipes", authenticate(["admin", "manager"]), (req, res) => {
  const { productId, ingredients } = req.body; // ingredients: Array<{inventoryItemId: string, amount: number}>
  const db = readDB();

  if (!db.recipes) db.recipes = [];

  const existingIdx = db.recipes.findIndex((r: any) => r.productId === productId);
  const recipe = {
    id: existingIdx !== -1 ? db.recipes[existingIdx].id : `r-${Date.now()}`,
    productId,
    ingredients: ingredients || [],
    createdAt: existingIdx !== -1 ? db.recipes[existingIdx].createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  if (existingIdx !== -1) {
    db.recipes[existingIdx] = recipe;
  } else {
    db.recipes.push(recipe);
  }

  writeDB(db);
  res.json(recipe);
});

// 4. تنبيهات المخزون المنخفض
router.get("/api/reports/low-stock", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  const lowStock = (db.inventory_items || []).filter((item: any) => item.quantity <= item.lowStockThreshold);
  res.json(lowStock);
});

export default router;
