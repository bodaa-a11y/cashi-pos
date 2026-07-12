import express from "express";
import { readDB, writeDB, writeAuditLog } from "../db/db";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

router.get("/api/customers", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { search } = req.query;
  const db = readDB();
  let list = db.customers || [];
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter((c: any) => c.name.toLowerCase().includes(q) || (c.phone || "").includes(q));
  }
  res.json(list);
});

router.get("/api/customers/:id", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const customer = (db.customers || []).find((c: any) => c.id === id);
  if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
  const orders = (db.orders || []).filter((o: any) => o.customerId === id);
  res.json({ customer, orders });
});

router.post("/api/customers", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { name, phone, email, notes } = req.body;
  const db = readDB();
  if (!db.customers) db.customers = [];
  if (!name || !String(name).trim()) return res.status(400).json({ error: "اسم العميل مطلوب" });

  const newCustomer = {
    id: `cust-${Date.now()}`,
    name: String(name).trim(),
    phone: phone || "",
    email: email || "",
    points: 0,
    loyaltyPoints: 0,
    creditBalance: 0,
    totalSpent: 0,
    visitsCount: 0,
    notes: notes || "",
    createdAt: new Date().toISOString(),
  };
  db.customers.push(newCustomer);
  writeDB(db);
  res.json(newCustomer);
});

router.put("/api/customers/:id", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { id } = req.params;
  const { name, phone, email, notes } = req.body;
  const db = readDB();
  const customer = (db.customers || []).find((c: any) => c.id === id);
  if (!customer) return res.status(404).json({ error: "العميل غير موجود" });
  customer.name = name ?? customer.name;
  customer.phone = phone ?? customer.phone;
  customer.email = email ?? customer.email;
  customer.notes = notes ?? customer.notes;
  writeDB(db);
  res.json(customer);
});

router.get("/api/customers/:id/ledger", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const ledger = (db.customer_ledger || []).filter((l: any) => l.customerId === id);
  res.json(ledger.slice().reverse());
});

// تسجيل دفعة على حساب آجل
router.post("/api/customers/:id/payment", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { id } = req.params;
  const { amount, notes } = req.body;
  const db = readDB();
  const customer = (db.customers || []).find((c: any) => c.id === id);
  if (!customer) return res.status(404).json({ error: "العميل غير موجود" });

  const paymentAmount = Number(amount || 0);
  if (paymentAmount <= 0) return res.status(400).json({ error: "قيمة الدفعة غير صالحة" });
  if (paymentAmount > customer.creditBalance) {
    return res.status(400).json({ error: `الدفعة أكبر من الرصيد الآجل المستحق (${customer.creditBalance} ر.س)` });
  }

  customer.creditBalance -= paymentAmount;
  if (!db.customer_ledger) db.customer_ledger = [];
  db.customer_ledger.push({
    id: `cl-${Date.now()}`,
    customerId: id,
    type: "payment",
    amount: paymentAmount,
    notes: notes || "",
    createdAt: new Date().toISOString(),
    createdBy: (req as any).user?.fullName || "نظام",
  });

  writeDB(db);
  writeAuditLog("تحصيل دفعة عميل", (req as any).user?.id || "system", (req as any).user?.fullName || "نظام", `تحصيل ${paymentAmount} ر.س من العميل ${customer.name}`);
  res.json(customer);
});

export default router;
