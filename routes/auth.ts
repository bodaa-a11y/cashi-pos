import express from "express";
import { readDB, writeAuditLog } from "../db/db";
import { hashWithSalt, generateToken } from "../utils/hashing";

const router = express.Router();

// =============================================
// نظام الحد من محاولات الدخول العنيفة (Rate Limiter)
// =============================================
const pinLoginAttempts: Record<string, { attempts: number; lockUntil: number }> = {};

function pinRateLimiter(req: any, res: any, next: any) {
  const rawIp = req.headers["x-forwarded-for"] || req.ip || "unknown";
  const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp);
  const record = pinLoginAttempts[ip];
  if (record && record.lockUntil > Date.now()) {
    const secondsLeft = Math.ceil((record.lockUntil - Date.now()) / 1000);
    return res.status(429).json({ error: `تم قفل محاولات تسجيل الدخول مؤقتاً. يرجى المحاولة بعد ${secondsLeft} ثانية.` });
  }
  next();
}

function registerFailedAttempt(ip: string) {
  if (!pinLoginAttempts[ip]) {
    pinLoginAttempts[ip] = { attempts: 0, lockUntil: 0 };
  }
  pinLoginAttempts[ip].attempts++;
  if (pinLoginAttempts[ip].attempts >= 5) {
    pinLoginAttempts[ip].lockUntil = Date.now() + 60 * 1000; // قفل 60 ثانية
    pinLoginAttempts[ip].attempts = 0;
  }
}

function resetAttempts(ip: string) {
  if (pinLoginAttempts[ip]) {
    delete pinLoginAttempts[ip];
  }
}

// المصادقة العادية
router.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const db = readDB();
  const user = db.users.find((u: any) => {
    if (u.username !== username || !u.isActive) return false;
    if (u.passwordSalt) {
      return u.passwordHash === hashWithSalt(password, u.passwordSalt);
    }
    return false;
  });
  if (user) {
    writeAuditLog("دخول الإدارة", user.id, user.fullName, `تسجيل دخول ناجح باستخدام اسم المستخدم: ${username}`);
    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    res.json({ success: true, token, user });
  } else {
    res.status(401).json({ error: "اسم المستخدم أو كلمة المرور غير صحيحة" });
  }
});

// تسجيل دخول الكاشير بالـ PIN
router.post("/api/auth/pin-login", pinRateLimiter, (req, res) => {
  const { pin } = req.body;
  const rawIp = req.headers["x-forwarded-for"] || req.ip || "unknown";
  const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp);
  const db = readDB();
  const user = db.users.find((u: any) => {
    if (!u.isActive) return false;
    if (u.pinSalt) {
      return u.pinHash === hashWithSalt(pin, u.pinSalt);
    }
    return false;
  });
  if (user) {
    resetAttempts(ip);
    writeAuditLog("دخول الكاشير", user.id, user.fullName, `تسجيل دخول ناجح للمحطة بالرمز السريع`);
    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    res.json({ success: true, token, user });
  } else {
    registerFailedAttempt(ip);
    res.status(401).json({ error: "رمز PIN غير صحيح أو الحساب غير نشط" });
  }
});

// مصادقة المدير عن بعد
router.post("/api/manager/auth", pinRateLimiter, (req, res) => {
  const { pin } = req.body;
  const rawIp = req.headers["x-forwarded-for"] || req.ip || "unknown";
  const ip = Array.isArray(rawIp) ? rawIp[0] : String(rawIp);
  const db = readDB();
  const user = db.users.find((u: any) => {
    if (!u.isActive || (u.role !== "admin" && u.role !== "manager")) return false;
    if (u.pinSalt) {
      return u.pinHash === hashWithSalt(pin, u.pinSalt);
    }
    return false;
  });
  if (user) {
    resetAttempts(ip);
    writeAuditLog("دخول المدير عن بعد", user.id, user.fullName, `تسجيل دخول ناجح للوحة المراقبة عن بعد`);
    const token = generateToken({ id: user.id, username: user.username, role: user.role });
    res.json({ success: true, token, user });
  } else {
    registerFailedAttempt(ip);
    res.status(401).json({ error: "رمز PIN غير صحيح أو ليس لديك صلاحيات المدير" });
  }
});

export default router;
