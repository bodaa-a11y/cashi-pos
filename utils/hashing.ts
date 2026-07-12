import crypto from "crypto";

// مفتاح التوقيع المشترك (HMAC Secret) - عشوائي عند البدء لزيادة الأمان
export const JWT_SECRET = crypto.randomBytes(32).toString("hex");

export function generateSalt(): string {
  return crypto.randomBytes(16).toString("hex");
}

export function hashWithSalt(input: any, salt: string): string {
  const inputStr = String(input || "");
  return crypto.createHmac("sha256", salt).update(inputStr).digest("hex");
}

// دالة توقيع التوكن بنظام HMAC للتأمين ومنع التلاعب
export function generateToken(payload: { id: string; username: string; role: string }): string {
  const expiry = Date.now() + 12 * 60 * 60 * 1000; // صلاحية التوكن 12 ساعة
  const data = JSON.stringify({ ...payload, expiry });
  const dataBase64 = Buffer.from(data).toString("base64");
  const signature = crypto.createHmac("sha256", JWT_SECRET).update(dataBase64).digest("hex");
  return `${dataBase64}.${signature}`;
}

// التحقق من صحة التوكن ومطابقة التوقيع
export function verifyToken(token: string): { id: string; username: string; role: string } | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 2) return null;
    const [dataBase64, signature] = parts;
    const expectedSignature = crypto.createHmac("sha256", JWT_SECRET).update(dataBase64).digest("hex");
    if (signature !== expectedSignature) return null;
    const data = JSON.parse(Buffer.from(dataBase64, "base64").toString("utf-8"));
    if (data.expiry < Date.now()) return null; // منتهي الصلاحية
    return data;
  } catch (e) {
    return null;
  }
}

// لضمان التوافقية القديمة في الـ Migration والتحقق
export function hashPIN(pin: any): string {
  const pinStr = String(pin || "");
  const salt = "cashi_secure_salt_2026";
  return crypto.createHmac("sha256", salt).update(pinStr).digest("hex");
}
