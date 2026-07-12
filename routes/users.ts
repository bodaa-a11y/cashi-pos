import express from "express";
import { readDB, writeDB, writeAuditLog } from "../db/db";
import { generateSalt, hashWithSalt } from "../utils/hashing";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

// عرض الموظفين النشطين
router.get("/api/users", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.users.filter((u: any) => u.isActive));
});

// إضافة موظف جديد
router.post("/api/users", authenticate(["admin", "manager"]), (req, res) => {
  const { fullName, username, role, pinCode, password } = req.body;
  if (!fullName || !role || !pinCode) {
    return res.status(400).json({ error: "الرجاء تعبئة الحقول المطلوبة (الاسم الكامل، الدور، رمز PIN)" });
  }
  const db = readDB();
  
  // التحقق من تكرار الـ PIN للموظفين النشطين
  const pinDuplicate = db.users.some((u: any) => {
    if (!u.isActive) return false;
    if (u.pinSalt) {
      return hashWithSalt(pinCode, u.pinSalt) === u.pinHash;
    }
    return false;
  });
  if (pinDuplicate) {
    return res.status(400).json({ error: "رمز PIN هذا مستخدم بالفعل من قبل موظف آخر" });
  }
  
  if (username && db.users.some((u: any) => u.username === username && u.isActive)) {
    return res.status(400).json({ error: "اسم المستخدم هذا مكرر بالفعل" });
  }

  const salt = generateSalt();
  const newUser = {
    id: `u-${Date.now()}`,
    fullName,
    username: username || "",
    role,
    pinSalt: salt,
    pinHash: hashWithSalt(pinCode, salt),
    passwordSalt: password ? salt : undefined,
    passwordHash: password ? hashWithSalt(password, salt) : undefined,
    isActive: true,
    createdAt: new Date().toISOString()
  };

  db.users.push(newUser);
  writeDB(db);
  
  const userId = (req as any).user ? (req as any).user.id : "system";
  const userName = (req as any).user ? (req as any).user.fullName : "مسؤول";
  writeAuditLog("إضافة موظف", userId, userName, `تم تسجيل موظف جديد: ${fullName} بدور: ${role}`);
  res.json(newUser);
});

// تعديل بيانات موظف
router.put("/api/users/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const { fullName, username, role, pinCode, password, isActive } = req.body;
  const db = readDB();
  const user = db.users.find((u: any) => u.id === id);

  if (!user) {
    return res.status(404).json({ error: "المستخدم غير موجود" });
  }

  // التحقق من عدم تكرار الـ PIN
  if (pinCode) {
    const pinDuplicate = db.users.some((u: any) => {
      if (u.id === id || !u.isActive) return false;
      if (u.pinSalt) {
        return hashWithSalt(pinCode, u.pinSalt) === u.pinHash;
      }
      return false;
    });
    if (pinDuplicate) {
      return res.status(400).json({ error: "رمز PIN هذا مستخدم بالفعل من قبل موظف آخر" });
    }
    const salt = user.pinSalt || generateSalt();
    user.pinSalt = salt;
    user.pinHash = hashWithSalt(pinCode, salt);
  }

  if (username && db.users.some((u: any) => u.username === username && u.id !== id && u.isActive)) {
    return res.status(400).json({ error: "اسم المستخدم هذا مكرر بالفعل لموظف آخر" });
  }

  user.fullName = fullName || user.fullName;
  user.username = username !== undefined ? username : user.username;
  user.role = role || user.role;
  if (isActive !== undefined) user.isActive = !!isActive;

  if (password) {
    const salt = user.passwordSalt || generateSalt();
    user.passwordSalt = salt;
    user.passwordHash = hashWithSalt(password, salt);
  }

  user.updatedAt = new Date().toISOString();
  writeDB(db);

  const userId = (req as any).user ? (req as any).user.id : "system";
  const userName = (req as any).user ? (req as any).user.fullName : "مسؤول";
  writeAuditLog("تعديل موظف", userId, userName, `تم تعديل بيانات الموظف: ${user.fullName}`);
  res.json(user);
});

// حذف موظف (تعطيله)
router.delete("/api/users/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const user = db.users.find((u: any) => u.id === id);

  if (user) {
    user.isActive = false;
    user.deletedAt = new Date().toISOString();
    writeDB(db);
    
    const userId = (req as any).user ? (req as any).user.id : "system";
    const userName = (req as any).user ? (req as any).user.fullName : "مسؤول";
    writeAuditLog("تعطيل موظف", userId, userName, `تم تعطيل/حذف الموظف: ${user.fullName}`);
    res.json({ success: true });
  } else {
    res.status(404).json({ error: "المستخدم غير موجود" });
  }
});

export default router;
