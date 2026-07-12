import { readDB } from "../db/db";
import { verifyToken } from "../utils/hashing";

export function authenticate(allowedRoles?: string[]) {
  return (req: any, res: any, next: any) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ error: "غير مصرح: يجب تسجيل الدخول أولاً" });
    }

    const token = authHeader.split(" ")[1];
    if (!token) {
      return res.status(401).json({ error: "غير مصرح: صيغة التوكن غير صالحة" });
    }

    const decoded = verifyToken(token);
    if (!decoded) {
      return res.status(401).json({ error: "غير مصرح: توكن غير صالح أو منتهي الصلاحية" });
    }

    const db = readDB();
    const user = db.users.find((u: any) => u.id === decoded.id && u.isActive);

    if (!user) {
      return res.status(401).json({ error: "غير مصرح: المستخدم غير موجود أو تم تعطيله" });
    }

    if (allowedRoles && allowedRoles.length > 0 && !allowedRoles.includes(user.role)) {
      return res.status(403).json({ error: "غير مصرح: ليس لديك الصلاحيات الكافية للقيام بهذا الإجراء" });
    }

    req.user = user;
    next();
  };
}
