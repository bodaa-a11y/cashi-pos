import express from "express";
import { readDB } from "../db/db";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

// تقريب لمنزلتين عشريتين
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

function dayRange(dateStr: string) {
  const from = new Date(dateStr + "T00:00:00");
  const to = new Date(dateStr + "T23:59:59.999");
  return { from, to };
}

function ordersOfDay(db: any, dateStr: string) {
  const { from, to } = dayRange(dateStr);
  return (db.orders || []).filter((o: any) => {
    const d = new Date(o.createdAt);
    return (
      d >= from && d <= to &&
      (o.status === "completed" || o.status === "partially_refunded" || o.status === "refunded")
    );
  });
}

// ═══════════════════════════════════════════════════════
// تقرير نهاية اليوم الشامل — كل الأصناف وكل قسم لوحده
// GET /api/reports/end-of-day?date=YYYY-MM-DD
// ═══════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════
// تقرير نهاية اليوم الشامل — كل الأصناف وكل قسم لوحده
// GET /api/reports/end-of-day?date=YYYY-MM-DD
// ═══════════════════════════════════════════════════════
router.get("/api/reports/end-of-day", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  try {
    const date = String(req.query.date || new Date().toISOString().split("T")[0]);
    const db = readDB();
    const orders = ordersOfDay(db, date);

    let totalSales = 0, totalTax = 0, totalDiscount = 0, totalRefunded = 0;
    let cashSales = 0, cardSales = 0, otherSales = 0, totalCost = 0;

    const cashierMap: any = {};
    const hourlyMap: any = {};
    const catMap: any = {};

    for (const o of orders) {
      const orderTotal = Number(o.total) || 0;
      const orderRefunded = Number(o.refundedAmount) || 0;
      const refundRatio = orderTotal > 0 ? Math.max(0, 1 - orderRefunded / orderTotal) : 1;
      const net = r2(orderTotal - orderRefunded);
      totalSales += net;
      totalTax += (Number(o.taxAmount) || 0) * refundRatio;
      totalDiscount += Number(o.discountAmount) || 0;
      totalRefunded += orderRefunded;

      (o.payments || []).forEach((p: any) => {
        const amt = r2((Number(p.amount) || 0) * refundRatio);
        if (p.method === "cash") cashSales += amt;
        else if (p.method === "card") cardSales += amt;
        else otherSales += amt;
      });

      // أداء الكاشير
      const cashierId = o.cashierId || "unknown";
      if (!cashierMap[cashierId]) {
        cashierMap[cashierId] = { id: cashierId, name: o.cashierName || "كاشير", orders: 0, sales: 0 };
      }
      cashierMap[cashierId].orders++;
      cashierMap[cashierId].sales = r2(cashierMap[cashierId].sales + net);

      // المبيعات بالساعة
      const orderDate = new Date(o.createdAt);
      const h = isNaN(orderDate.getTime()) ? 0 : orderDate.getHours();
      const hourKey = `${String(h).padStart(2, "0")}:00`;
      if (!hourlyMap[hourKey]) hourlyMap[hourKey] = { sales: 0, orders: 0 };
      hourlyMap[hourKey].sales = r2(hourlyMap[hourKey].sales + net);
      hourlyMap[hourKey].orders++;

      // الأصناف حسب القسم (التصنيف)
      for (const item of o.items || []) {
        const itemQty = Number(item.quantity) || 0;
        const itemRefundedQty = Number(item.refundedQuantity) || 0;
        const activeQty = itemQty - itemRefundedQty;
        if (activeQty <= 0) continue;

        const prod = (db.products || []).find((p: any) => p.id === item.productId);
        const catId = prod ? prod.categoryId : (item.categoryId || "other");
        if (!catMap[catId]) {
          const cat = (db.categories || []).find((c: any) => c.id === catId);
          catMap[catId] = {
            id: catId,
            name: cat ? (cat.nameAr || cat.nameEn) : (catId === "c-5" ? "شاورما" : catId === "c-1" ? "بيتزا" : "أخرى"),
            items: {},
            qty: 0, sales: 0, cost: 0, profit: 0,
          };
        }

        const unitPrice = Number(item.unitPrice) || 0;
        const itemCostPrice = Number(prod?.cost) || 0;
        const itemSales = r2(unitPrice * activeQty);
        const itemCost = r2(itemCostPrice * activeQty);
        const key = item.productId || item.productNameSnapshot || `item-${Math.random()}`;

        if (!catMap[catId].items[key]) {
          catMap[catId].items[key] = {
            name: item.productNameSnapshot || prod?.nameAr || prod?.nameEn || "صنف",
            qty: 0, sales: 0, cost: 0, profit: 0,
          };
        }

        const it = catMap[catId].items[key];
        it.qty += activeQty;
        it.sales = r2(it.sales + itemSales);
        it.cost = r2(it.cost + itemCost);
        it.profit = r2(it.sales - it.cost);

        const c = catMap[catId];
        c.qty += activeQty;
        c.sales = r2(c.sales + itemSales);
        c.cost = r2(c.cost + itemCost);
        c.profit = r2(c.sales - c.cost);
        totalCost += itemCost;
      }
    }

    const categories = Object.values(catMap)
      .map((c: any) => ({ ...c, items: Object.values(c.items).sort((a: any, b: any) => b.sales - a.sales) }))
      .sort((a: any, b: any) => b.sales - a.sales);

    const expenses = (db.expenses || []).filter((e: any) => e.date === date);
    const totalExpenses = r2(expenses.reduce((s: number, e: any) => s + (Number(e.amount) || 0), 0));

    const { from, to } = dayRange(date);
    const shifts = (db.shifts || [])
      .filter((s: any) => {
        const d = new Date(s.openedAt);
        return !isNaN(d.getTime()) && d >= from && d <= to;
      })
      .map((s: any) => ({
        id: s.id,
        shiftNumber: s.shiftNumber,
        cashierName: s.cashierName,
        openedAt: s.openedAt,
        closedAt: s.closedAt || null,
        status: s.status,
        openingCash: Number(s.openingCash) || 0,
        actualCash: s.actualCash != null ? Number(s.actualCash) : (s.closingCash != null ? Number(s.closingCash) : null),
        expectedCash: s.expectedCash != null ? Number(s.expectedCash) : null,
        cashDifference: s.cashDifference != null ? Number(s.cashDifference) : null,
      }));

    const topItems = categories
      .flatMap((c: any) => c.items.map((i: any) => ({ ...i, category: c.name })))
      .sort((a: any, b: any) => b.qty - a.qty)
      .slice(0, 10);

    return res.json({
      date,
      generatedAt: new Date().toISOString(),
      summary: {
        orderCount: orders.length,
        totalSales: r2(totalSales),
        totalRefunded: r2(totalRefunded),
        totalTax: r2(totalTax),
        totalDiscount: r2(totalDiscount),
        cashSales: r2(cashSales),
        cardSales: r2(cardSales),
        otherSales: r2(otherSales),
        avgOrderValue: orders.length ? r2(totalSales / orders.length) : 0,
        grossCost: r2(totalCost),
        grossProfit: r2(totalSales - totalCost),
        totalExpenses,
        netProfit: r2(totalSales - totalCost - totalExpenses),
      },
      categories,
      cashiers: Object.values(cashierMap).sort((a: any, b: any) => b.sales - a.sales),
      hourly: Object.keys(hourlyMap).sort().map((k) => ({ hour: k, ...hourlyMap[k] })),
      expenses,
      shifts,
      topItems,
    });
  } catch (err: any) {
    console.error("Error generating end-of-day report:", err);
    return res.status(500).json({ error: "فشل إنشاء تقرير نهاية اليوم: " + (err.message || "") });
  }
});

// ═══════════════════════════════════════════════════════
// المراقبة اللحظية — حالة الكاشير والتعاملات اليومية
// GET /api/manager/live
// ═══════════════════════════════════════════════════════
router.get("/api/manager/live", authenticate(["admin", "manager"]), (_req, res) => {
  const db = readDB();
  const today = new Date().toISOString().split("T")[0];
  const orders = ordersOfDay(db, today);

  let todaySales = 0, todayCash = 0, todayCard = 0;
  const cashierMap: any = {};

  for (const o of orders) {
    const net = r2((o.total || 0) - (o.refundedAmount || 0));
    todaySales += net;
    (o.payments || []).forEach((p: any) => {
      if (p.method === "cash") todayCash += p.amount;
      else if (p.method === "card") todayCard += p.amount;
    });
    const id = o.cashierId || "unknown";
    if (!cashierMap[id]) cashierMap[id] = { id, name: o.cashierName || "كاشير", orders: 0, sales: 0, lastActivityAt: o.createdAt };
    cashierMap[id].orders++;
    cashierMap[id].sales = r2(cashierMap[id].sales + net);
    if (new Date(o.createdAt) > new Date(cashierMap[id].lastActivityAt)) {
      cashierMap[id].lastActivityAt = o.createdAt;
    }
  }

  const activeShift = (db.shifts || []).find((s: any) => s.status === "open") || null;
  const { from, to } = dayRange(today);

  // آخر عمليات دخول اليوم (من سجل التدقيق)
  const lastLogins = (db.audit_logs || [])
    .filter((l: any) => {
      const d = new Date(l.createdAt);
      return d >= from && d <= to && l.action && l.action.includes("دخول");
    })
    .slice(-10)
    .reverse()
    .map((l: any) => ({ userName: l.userName, action: l.action, at: l.createdAt }));

  const recentOrders = orders
    .slice(-10)
    .reverse()
    .map((o: any) => ({
      id: o.id,
      orderNumber: o.orderNumber,
      cashierName: o.cashierName,
      total: o.total,
      orderType: o.orderType,
      status: o.status,
      createdAt: o.createdAt,
      itemsCount: (o.items || []).length,
    }));

  res.json({
    now: new Date().toISOString(),
    activeShift: activeShift
      ? {
          shiftNumber: activeShift.shiftNumber,
          cashierName: activeShift.cashierName,
          openedAt: activeShift.openedAt,
          openingCash: activeShift.openingCash,
        }
      : null,
    today: {
      date: today,
      sales: r2(todaySales),
      cash: r2(todayCash),
      card: r2(todayCard),
      orderCount: orders.length,
      heldOrdersCount: (db.held_orders || []).length,
    },
    cashiers: Object.values(cashierMap).sort((a: any, b: any) => b.sales - a.sales),
    recentOrders,
    lastLogins,
    lowStockCount: (db.inventory_items || []).filter((i: any) => i.quantity <= (i.lowStockThreshold || 0)).length,
  });
});

export default router;
