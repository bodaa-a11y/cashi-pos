import express from "express";
import { readDB, writeDB, writeAuditLog } from "../db/db";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

router.get("/api/expenses", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.expenses || []);
});

router.post("/api/expenses", authenticate(["admin", "manager"]), (req, res) => {
  const { category, amount, description, date } = req.body;
  if (!category || !amount) {
    return res.status(400).json({ error: "الفئة والقيمة مطلوبة" });
  }

  const db = readDB();
  if (!db.expenses) db.expenses = [];

  const newExpense = {
    id: `exp-${Date.now()}`,
    category: String(category).trim(),
    amount: Number(amount),
    description: description || "",
    date: date || new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    createdBy: (req as any).user?.fullName || "مدير",
  };

  db.expenses.push(newExpense);
  writeDB(db);
  writeAuditLog("إضافة مصروفات", (req as any).user?.id || "system", (req as any).user?.fullName || "مدير", `تسجيل مصروف بقيمة ${amount} ر.س للفئة ${category}`);
  res.json(newExpense);
});

router.put("/api/expenses/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const { category, amount, description, date } = req.body;

  const db = readDB();
  const expense = (db.expenses || []).find((e: any) => e.id === id);
  if (!expense) return res.status(404).json({ error: "المصروف غير موجود" });

  expense.category = category ?? expense.category;
  expense.amount = amount !== undefined ? Number(amount) : expense.amount;
  expense.description = description ?? expense.description;
  expense.date = date ?? expense.date;

  writeDB(db);
  res.json(expense);
});

router.delete("/api/expenses/:id", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  if (!db.expenses) db.expenses = [];
  const index = db.expenses.findIndex((e: any) => e.id === id);
  if (index === -1) return res.status(404).json({ error: "المصروف غير موجود" });

  const removed = db.expenses.splice(index, 1)[0];
  writeDB(db);
  writeAuditLog("حذف مصروفات", (req as any).user?.id || "system", (req as any).user?.fullName || "مدير", `حذف مصروف بقيمة ${removed.amount} ر.س من فئة ${removed.category}`);
  res.json({ success: true });
});

router.get("/api/finances/summary", authenticate(["admin", "manager"]), (req, res) => {
  const { from, to } = req.query;
  const db = readDB();

  const startDate = from ? new Date(String(from)) : new Date(0);
  const endDate = to ? new Date(String(to)) : new Date();

  // 1. Filter completed orders in range
  const completedOrders = (db.orders || []).filter((o: any) => {
    if (o.status !== "completed") return false;
    const orderDate = new Date(o.createdAt);
    return orderDate >= startDate && orderDate <= endDate;
  });

  const totalSales = completedOrders.reduce((sum: number, o: any) => sum + (o.total || 0), 0);

  // 2. Compute COGS (cost of goods sold)
  // Maps product IDs to their seed/configured cost in database
  const productCostMap: Record<string, number> = {};
  (db.products || []).forEach((p: any) => {
    productCostMap[p.id] = p.cost || 0;
  });

  let totalCOGS = 0;
  completedOrders.forEach((o: any) => {
    (o.items || []).forEach((item: any) => {
      const unitCost = productCostMap[item.productId] || 0;
      totalCOGS += unitCost * (item.quantity || 0);
    });
  });

  // 3. Filter expenses in range
  const expensesList = (db.expenses || []).filter((e: any) => {
    const expDate = new Date(e.date);
    return expDate >= startDate && expDate <= endDate;
  });

  const totalExpenses = expensesList.reduce((sum: number, e: any) => sum + (e.amount || 0), 0);

  // 4. Net Profit calculation
  const netProfit = totalSales - totalExpenses - totalCOGS;

  res.json({
    totalSales,
    totalExpenses,
    totalCOGS,
    netProfit,
    ordersCount: completedOrders.length,
    expensesCount: expensesList.length,
  });
});

export default router;
