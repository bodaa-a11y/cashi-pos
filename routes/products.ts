import express from "express";
import fs from "fs";
import path from "path";
import { readDB, writeDB, logError, UPLOADS_DIR } from "../db/db";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

function saveBase64Image(base64Str: string, destDir: string): string | null {
  try {
    const matches = base64Str.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) {
      return null;
    }
    const type = matches[1];
    const buffer = Buffer.from(matches[2], "base64");
    
    let extension = "png";
    if (type.includes("jpeg") || type.includes("jpg")) extension = "jpg";
    else if (type.includes("webp")) extension = "webp";
    else if (type.includes("gif")) extension = "gif";

    const filename = `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.${extension}`;
    const destPath = path.join(destDir, filename);

    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    fs.writeFileSync(destPath, buffer);
    return filename;
  } catch (error) {
    logError("خطأ أثناء فك وتشفير صورة المنتج المرفوعة", error);
    return null;
  }
}

// عرض المنيو بالكامل (التصنيفات والأصناف)
router.get("/api/menu", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const db = readDB();
  res.json({
    categories: db.categories.filter((c: any) => c.isActive).sort((a: any, b: any) => a.sortOrder - b.sortOrder),
    products: db.products.filter((p: any) => p.isActive)
  });
});

// إضافة فئة تصنيف جديدة
router.post("/api/categories", authenticate(["admin", "manager"]), (req, res) => {
  const { nameAr, nameEn, sortOrder } = req.body;
  const db = readDB();
  const newCat = {
    id: `c-${Date.now()}`,
    nameAr,
    nameEn,
    sortOrder: sortOrder || db.categories.length + 1,
    isActive: true
  };
  db.categories.push(newCat);
  writeDB(db);
  res.json(newCat);
});

// إضافة صنف منتج جديد بالمنيو
router.post("/api/products", authenticate(["admin", "manager"]), (req, res) => {
  const { nameAr, nameEn, categoryId, price, cost, barcode, trackInventory, quantity, image, imageBase64 } = req.body;
  const db = readDB();

  let imageName = image || null;
  if (imageBase64) {
    const saved = saveBase64Image(imageBase64, UPLOADS_DIR);
    if (saved) {
      imageName = `/uploads/${saved}`;
    }
  }

  const newProd = {
    id: `p-${Date.now()}`,
    categoryId,
    nameAr,
    nameEn,
    price: Number(price),
    cost: Number(cost || 0),
    barcode: barcode || "",
    isActive: true,
    trackInventory: !!trackInventory,
    quantity: trackInventory ? Number(quantity || 0) : 0,
    image: imageName,
    createdAt: new Date().toISOString()
  };

  db.products.push(newProd);
  writeDB(db);
  res.json(newProd);
});

// تعديل صنف منتج بالمنيو
router.put("/api/products/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const { nameAr, nameEn, categoryId, price, cost, barcode, trackInventory, quantity, image, imageBase64, isActive } = req.body;
  const db = readDB();
  const prod = db.products.find((p: any) => p.id === id);

  if (!prod) {
    return res.status(404).json({ error: "المنتج غير موجود" });
  }

  let imageName = image !== undefined ? image : prod.image;
  if (imageBase64) {
    const saved = saveBase64Image(imageBase64, UPLOADS_DIR);
    if (saved) {
      imageName = `/uploads/${saved}`;
    }
  }

  prod.nameAr = nameAr || prod.nameAr;
  prod.nameEn = nameEn || prod.nameEn;
  prod.categoryId = categoryId || prod.categoryId;
  prod.price = price !== undefined ? Number(price) : prod.price;
  prod.cost = cost !== undefined ? Number(cost) : prod.cost;
  prod.barcode = barcode !== undefined ? barcode : prod.barcode;
  prod.trackInventory = trackInventory !== undefined ? !!trackInventory : prod.trackInventory;
  prod.quantity = trackInventory ? Number(quantity || 0) : 0;
  prod.image = imageName;
  if (isActive !== undefined) prod.isActive = !!isActive;
  prod.updatedAt = new Date().toISOString();

  writeDB(db);
  res.json(prod);
});

// حذف صنف منتج (تعطيله)
router.delete("/api/products/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const prod = db.products.find((p: any) => p.id === id);

  if (prod) {
    prod.isActive = false;
    prod.deletedAt = new Date().toISOString();
    writeDB(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "المنتج غير موجود" });
  }
});

export default router;
