import express from "express";
import { readDB, writeDB, writeAuditLog } from "../db/db";
import { authenticate } from "../middleware/authenticate";

const router = express.Router();

// ─── نظام البث المباشر للطلبات (SSE) ─────────────────────────
const sseClients: express.Response[] = [];

function broadcastOrder(order: any) {
  const data = JSON.stringify(order);
  sseClients.forEach((client, index) => {
    try {
      client.write(`data: ${data}\n\n`);
    } catch (e) {
      sseClients.splice(index, 1);
    }
  });
}

// مسار البث المباشر للطلبات (SSE Stream)
router.get("/api/orders/stream", (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
    "Access-Control-Allow-Origin": "*"
  });
  res.write("data: {\"type\":\"connected\"}\n\n");
  sseClients.push(res);
  req.on("close", () => {
    const idx = sseClients.indexOf(res);
    if (idx !== -1) sseClients.splice(idx, 1);
  });
});

// دالة مساعدة لتصفية الطلبات بنطاق تاريخ
function filterOrdersByDateRange(orders: any[], from: string, to: string) {
  const fromDate = new Date(from);
  fromDate.setHours(0, 0, 0, 0);
  const toDate = new Date(to);
  toDate.setHours(23, 59, 59, 999);
  return orders.filter((o: any) => {
    const d = new Date(o.createdAt);
    return d >= fromDate && d <= toDate && (o.status === "completed" || o.status === "partially_refunded" || o.status === "refunded");
  });
}

// دالة حساب ملخص الطلبات المشتركة
function calculateOrdersSummary(db: any, orders: any[]) {
  const totalSales = orders.reduce((sum: number, o: any) => sum + (o.total - (o.refundedAmount || 0)), 0);
  const totalCost = orders.reduce((sum: number, o: any) => {
    return sum + o.items.reduce((itemSum: number, item: any) => {
      const prod = db.products.find((p: any) => p.id === item.productId);
      const activeQty = item.quantity - (item.refundedQuantity || 0);
      return itemSum + (prod ? prod.cost * activeQty : 0);
    }, 0);
  }, 0);

  const profit = totalSales - totalCost;
  const totalTax = orders.reduce((sum: number, o: any) => sum + (o.taxAmount || 0), 0);
  const avgOrderValue = orders.length > 0 ? totalSales / orders.length : 0;

  let cashSales = 0;
  let cardSales = 0;
  orders.forEach((o: any) => {
    (o.payments || []).forEach((p: any) => {
      // Adjust payment share if refunded
      const refundRatio = o.refundedAmount && o.total ? (1 - o.refundedAmount / o.total) : 1;
      if (p.method === "cash") cashSales += p.amount * refundRatio;
      else if (p.method === "card") cardSales += p.amount * refundRatio;
    });
  });

  // مبيعات حسب التصنيف
  const categorySalesMap: any = {};
  orders.forEach((o: any) => {
    o.items.forEach((item: any) => {
      const activeQty = item.quantity - (item.refundedQuantity || 0);
      if (activeQty <= 0) return;
      const prod = db.products.find((p: any) => p.id === item.productId);
      const catId = prod ? prod.categoryId : "other";
      const cat = db.categories.find((c: any) => c.id === catId);
      const catName = cat ? cat.nameAr : "تصنيفات أخرى";
      categorySalesMap[catName] = (categorySalesMap[catName] || 0) + (item.unitPrice * activeQty);
    });
  });
  const categorySales = Object.keys(categorySalesMap).map((name) => ({
    name,
    value: categorySalesMap[name]
  }));

  // مبيعات يومية للرسم البياني
  const dailySalesMap: any = {};
  orders.forEach((o: any) => {
    const dateStr = o.createdAt.split("T")[0];
    const activeTotal = o.total - (o.refundedAmount || 0);
    dailySalesMap[dateStr] = (dailySalesMap[dateStr] || 0) + activeTotal;
  });
  const sortedDates = Object.keys(dailySalesMap).sort();
  const chartData = sortedDates.map((date) => ({
    date,
    sales: dailySalesMap[date]
  }));

  // أداء الموظفين
  const waiterSalesMap: any = {};
  orders.forEach((o: any) => {
    const waiter = db.users.find((u: any) => u.id === o.waiterId || u.id === o.cashierId);
    const waiterName = waiter ? waiter.fullName : "الكاشير العام";
    const activeTotal = o.total - (o.refundedAmount || 0);
    waiterSalesMap[waiterName] = (waiterSalesMap[waiterName] || 0) + activeTotal;
  });
  const staffPerformance = Object.keys(waiterSalesMap).map((name) => ({
    name,
    sales: waiterSalesMap[name]
  }));

  // المنتجات الأكثر مبيعاً
  const productSalesMap: any = {};
  orders.forEach((o: any) => {
    o.items.forEach((item: any) => {
      const activeQty = item.quantity - (item.refundedQuantity || 0);
      productSalesMap[item.productNameSnapshot] = (productSalesMap[item.productNameSnapshot] || 0) + activeQty;
    });
  });
  const topSelling = Object.keys(productSalesMap)
    .map((name) => ({ name, qty: productSalesMap[name] }))
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 5);

  return {
    totalSales,
    totalCost,
    profit,
    totalTax,
    avgOrderValue,
    orderCount: orders.length,
    cashSales,
    cardSales,
    categorySales,
    chartData,
    staffPerformance,
    topSelling
  };
}

// 1. الطاولات
router.get("/api/tables", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const db = readDB();
  res.json(db.restaurant_tables);
});

router.post("/api/tables/merge", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const { sourceTableId, targetTableId } = req.body;
  const db = readDB();
  
  const sourceTable = db.restaurant_tables.find((t: any) => t.id === sourceTableId);
  const targetTable = db.restaurant_tables.find((t: any) => t.id === targetTableId);

  if (!sourceTable || !targetTable) {
    return res.status(404).json({ error: "إحدى الطاولتين غير موجودة" });
  }

  // Merge logic (update order tableIds in held orders if any)
  db.held_orders.forEach((o: any) => {
    if (o.tableId === sourceTableId) {
      o.tableId = targetTableId;
    }
  });

  sourceTable.status = "free";
  targetTable.status = "occupied";
  writeDB(db);
  res.json({ success: true });
});

router.post("/api/tables/split", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  res.json({ success: true, message: "فصل الطلبات متاح في المحطة" });
});

router.post("/api/tables/transfer", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const { sourceTableId, targetTableId } = req.body;
  const db = readDB();
  
  const sourceTable = db.restaurant_tables.find((t: any) => t.id === sourceTableId);
  const targetTable = db.restaurant_tables.find((t: any) => t.id === targetTableId);

  if (!sourceTable || !targetTable) {
    return res.status(404).json({ error: "الطاولة غير موجودة" });
  }

  db.held_orders.forEach((o: any) => {
    if (o.tableId === sourceTableId) {
      o.tableId = targetTableId;
    }
  });

  sourceTable.status = "free";
  targetTable.status = "occupied";
  writeDB(db);
  res.json({ success: true });
});

// 2. الورديات
router.get("/api/shifts/active", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const db = readDB();
  const activeShift = db.shifts.find((s: any) => s.status === "open");
  res.json(activeShift || null);
});

router.post("/api/shifts/open", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { openingCash, cashierId, cashierName } = req.body;
  const db = readDB();

  const activeShift = db.shifts.find((s: any) => s.status === "open");
  if (activeShift) {
    return res.status(400).json({ error: "هناك وردية مفتوحة بالفعل" });
  }

  const newShift = {
    id: `s-${Date.now()}`,
    shiftNumber: db.shifts.length + 1,
    openedAt: new Date().toISOString(),
    openingCash: Number(openingCash || 0),
    cashierId,
    cashierName,
    status: "open"
  };

  db.shifts.push(newShift);
  writeDB(db);
  writeAuditLog("فتح وردية", cashierId, cashierName, `تم فتح الوردية رقم #${newShift.shiftNumber} برصيد افتتاحي: ${openingCash} ر.س`);
  res.json(newShift);
});

router.post("/api/shifts/:id/close", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { id } = req.params;
  const { actualCash, closingNotes } = req.body;
  const db = readDB();
  const shift = db.shifts.find((s: any) => s.id === id);

  if (!shift) {
    return res.status(404).json({ error: "الوردية غير موجودة" });
  }

  shift.status = "closed";
  shift.closedAt = new Date().toISOString();
  shift.actualCash = Number(actualCash || 0);
  shift.closingNotes = closingNotes || "";

  writeDB(db);
  writeAuditLog("إغلاق وردية", shift.cashierId, shift.cashierName, `تم إغلاق الوردية رقم #${shift.shiftNumber} برصيد فعلي: ${actualCash} ر.س`);
  res.json(shift);
});

router.get("/api/shifts/:id/report", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const shift = db.shifts.find((s: any) => s.id === id);

  if (!shift) {
    return res.status(404).json({ error: "الوردية غير موجودة" });
  }

  const shiftOrders = db.orders.filter((o: any) => o.shiftId === id);
  const summary = calculateOrdersSummary(db, shiftOrders);

  res.json({
    shift,
    report: summary
  });
});

router.get("/api/shifts", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.shifts);
});

// 3. الفواتير والطلبات
router.get("/api/orders", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.orders);
});

router.get("/api/orders/latest", authenticate(["admin", "manager"]), (req, res) => {
  const limit = Number(req.query.limit) || 20;
  const db = readDB();
  res.json(db.orders.slice(-limit).reverse());
});

router.get("/api/orders/by-id/:id", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const order = db.orders.find((o: any) => o.id === id);
  if (!order) return res.status(404).json({ error: "الفاتورة غير موجودة" });
  res.json(order);
});

router.get("/api/orders/held", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const db = readDB();
  res.json(db.held_orders || []);
});

// مزامنة فاتورة جديدة
router.post("/api/orders/sync", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const order = req.body;
  const db = readDB();

  const shift = db.shifts.find((s: any) => s.id === order.shiftId);
  if (!shift && !order.ignoreShiftValidation) {
    return res.status(400).json({ error: "لا يوجد وردية صالحة لمزامنة الفاتورة عليها" });
  }

  const existingOrder = db.orders.find((o: any) => o.id === order.id);
  if (existingOrder) {
    return res.json({ success: true, duplicated: true, order: existingOrder });
  }

  // التحقق المالي وإعادة الحساب على السيرفر
  let serverSubtotal = 0;
  if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
    return res.status(400).json({ error: "الفاتورة فارغة ولا تحتوي على أصناف" });
  }

  for (const item of order.items) {
    const prod = db.products.find((p: any) => p.id === item.productId);
    if (!prod) {
      return res.status(400).json({ error: `الصنف المختار غير موجود في القائمة` });
    }
    const actualPrice = Number(prod.price);
    item.unitPrice = actualPrice; // فرض السعر الحقيقي من السيرفر
    item.lineTotal = actualPrice * item.quantity;
    if (!item.status) {
      item.status = "pending";
    }
    serverSubtotal += item.lineTotal;
  }

  const serverDiscount = Number(order.discountAmount) || 0;
  if (serverDiscount < 0 || serverDiscount > serverSubtotal) {
    return res.status(400).json({ error: "قيمة الخصم غير صالحة" });
  }

  // التحقق من صلاحية الموظف في الخصومات الكبيرة (مثال: أقصى خصم للكاشير العادي 30%)
  if (serverDiscount > (serverSubtotal * 0.3) && (req as any).user && (req as any).user.role !== "admin" && (req as any).user.role !== "manager") {
    writeAuditLog("محاولة تلاعب بالخصم", (req as any).user.id, (req as any).user.fullName, `محاولة تطبيق خصم يتجاوز 30% بدون صلاحيات كافية: ${serverDiscount} ر.س`);
    return res.status(400).json({ error: "غير مصرح لك بتطبيق خصم يتجاوز 30%، يرجى طلب موافقة المدير" });
  }

  const serverTotal = Math.max(0, serverSubtotal - serverDiscount);
  const vatRate = db.settings && db.settings.vatRate !== undefined ? Number(db.settings.vatRate) : 15;
  const serverTax = serverTotal - (serverTotal / (1 + vatRate / 100));

  // مقارنة الحسابات مع القيم المرسلة من الكلاينت للتأكد من عدم التلاعب
  const diffSubtotal = Math.abs((Number(order.subtotal) || 0) - serverSubtotal);
  const diffTotal = Math.abs((Number(order.total) || 0) - serverTotal);

  if (diffSubtotal > 0.01 || diffTotal > 0.01) {
    const userId = (req as any).user ? (req as any).user.id : "system";
    const userName = (req as any).user ? (req as any).user.fullName : "كاشير";
    writeAuditLog("تلاعب مالي مكتشف", userId, userName, `محاولة إرسال فاتورة بأسعار معدلة. المرسل: subtotal=${order.subtotal}, total=${order.total}. الحقيقي: subtotal=${serverSubtotal}, total=${serverTotal}`);
    return res.status(400).json({ error: "فشل التحقق المالي: إجماليات الفاتورة غير متطابقة مع أسعار المنيو الرسمية!" });
  }

  const orderNumber = db.orders.length + 1;
  const syncedOrder = {
    ...order,
    subtotal: serverSubtotal,
    discountAmount: serverDiscount,
    taxAmount: serverTax,
    total: serverTotal,
    orderNumber,
    syncedAt: new Date().toISOString()
  };

  db.orders.push(syncedOrder);

  // ─── تحديث بيانات العميل (نقاط ولاء + رصيد آجل) ─────────
  if (order.customerId && order.customerId !== "cust-1") {
    if (!db.customers) db.customers = [];
    const customer = db.customers.find((c: any) => c.id === order.customerId);
    if (customer) {
      customer.totalSpent = (customer.totalSpent || 0) + serverTotal;
      customer.visitsCount = (customer.visitsCount || 0) + 1;

      const pointsRate = db.settings?.loyaltyPointsPerCurrency ?? 0.1;
      customer.loyaltyPoints = (customer.loyaltyPoints || 0) + Math.floor(serverTotal * pointsRate);

      if (order.paymentMethod === "credit" || (order.payments || []).some((p: any) => p.method === "credit")) {
        const maxCredit = db.settings?.maxCreditLimit ?? 5000;
        const currentCredit = customer.creditBalance || 0;
        if (currentCredit + serverTotal > maxCredit) {
          return res.status(400).json({ error: `تجاوز الحد الائتماني المسموح به للعميل (${maxCredit} ر.س)! الرصيد المستحق الحالي: ${currentCredit} ر.س` });
        }

        customer.creditBalance = currentCredit + serverTotal;
        if (!db.customer_ledger) db.customer_ledger = [];
        db.customer_ledger.push({
          id: `cl-${Date.now()}`,
          customerId: order.customerId,
          type: "purchase",
          amount: serverTotal,
          orderId: syncedOrder.id,
          notes: `فاتورة #${orderNumber} — آجل`,
          createdAt: new Date().toISOString(),
          createdBy: order.cashierName || "كاشير",
        });
      }
    }
  }

  writeAuditLog("إصدار فاتورة", order.cashierId || "system", order.cashierName || "كاشير", `تم إصدار الفاتورة رقم #${orderNumber} بقيمة إجمالية: ${serverTotal} ر.س (${order.orderType === "dine_in" ? "داخلي" : order.orderType === "takeaway" ? "سفري" : "توصيل"})`);

  syncedOrder.items.forEach((item: any) => {
    // 1. البحث عن وصفة للمنتج
    const recipe = db.recipes ? db.recipes.find((r: any) => r.productId === item.productId) : null;
    if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
      recipe.ingredients.forEach((ing: any) => {
        const rawItem = db.inventory_items.find((i: any) => i.id === ing.inventoryItemId);
        if (rawItem) {
          const consumed = ing.amount * item.quantity;
          rawItem.quantity = Math.max(0, rawItem.quantity - consumed);
          db.inventory_transactions.push({
            id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            inventoryItemId: rawItem.id,
            changeQty: -consumed,
            reason: `بيع منتج (${item.productNameSnapshot}) فاتورة #${orderNumber}`,
            orderId: order.id,
            createdBy: order.cashierId,
            createdAt: new Date().toISOString()
          });
        }
      });
    } else {
      // 2. إذا لم توجد وصفة، نفترض التتبع البسيط للمنتج نفسه (سلوك قديم)
      const prod = db.products.find((p: any) => p.id === item.productId);
      if (prod && prod.trackInventory) {
        prod.quantity = Math.max(0, (prod.quantity || 0) - item.quantity);
        db.inventory_transactions.push({
          id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          inventoryItemId: prod.id,
          changeQty: -item.quantity,
          reason: `فاتورة بيع رقم ${orderNumber}`,
          orderId: order.id,
          createdBy: order.cashierId,
          createdAt: new Date().toISOString()
        });
      }
    }
  });

  if (syncedOrder.orderType === "dine_in" && syncedOrder.tableId) {
    const table = db.restaurant_tables.find((t: any) => t.id === syncedOrder.tableId);
    if (table) {
      table.status = "free";
    }
  }

  writeDB(db);

  // بث الطلب الجديد مباشرة لجميع المديرين المتصلين
  broadcastOrder(syncedOrder);

  res.json({ success: true, order: syncedOrder });
});

// تعليق وحفظ مسودة فاتورة (تعليق الطلب)
router.post("/api/orders/hold", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const order = req.body;
  const db = readDB();
  
  if (!db.held_orders) {
    db.held_orders = [];
  }

  const existingIdx = db.held_orders.findIndex((o: any) => o.id === order.id);
  if (existingIdx !== -1) {
    db.held_orders[existingIdx] = order;
  } else {
    db.held_orders.push(order);
  }

  if (order.orderType === "dine_in" && order.tableId) {
    const table = db.restaurant_tables.find((t: any) => t.id === order.tableId);
    if (table) {
      table.status = "occupied";
    }
  }

  writeDB(db);
  res.json({ success: true });
});

// حذف مسودة الفاتورة المعلقة بعد استكمال دفعها
router.delete("/api/orders/held/:id", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const { id } = req.params;
  const db = readDB();
  if (db.held_orders) {
    db.held_orders = db.held_orders.filter((o: any) => o.id !== id);
  }
  writeDB(db);
  res.json({ success: true });
});

// 4. طباعة الفواتير وتذاكر المطبخ
router.post("/api/print/receipt", authenticate(["admin", "manager", "cashier"]), (req, res) => {
  const printJob = req.body;
  const db = readDB();
  const newJob = {
    id: `pj-${Date.now()}`,
    type: "receipt",
    data: printJob,
    createdAt: new Date().toISOString()
  };
  if (!db.print_jobs) db.print_jobs = [];
  db.print_jobs.push(newJob);
  writeDB(db);
  res.json({ success: true, printJobId: newJob.id });
});

router.post("/api/print/kitchen", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const printJob = req.body;
  const db = readDB();
  const newJob = {
    id: `pj-${Date.now()}`,
    type: "kitchen",
    data: printJob,
    createdAt: new Date().toISOString()
  };
  if (!db.print_jobs) db.print_jobs = [];
  db.print_jobs.push(newJob);
  writeDB(db);
  res.json({ success: true, printJobId: newJob.id });
});

router.get("/api/print/latest", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const db = readDB();
  if (!db.print_jobs) return res.json(null);
  res.json(db.print_jobs[db.print_jobs.length - 1] || null);
});

// 5. إدارة العملاء
router.get("/api/customers", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const db = readDB();
  res.json(db.customers || []);
});

router.post("/api/customers", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const { name, phone, email } = req.body;
  if (!name || !phone) {
    return res.status(400).json({ error: "الرجاء تعبئة الاسم ورقم الجوال" });
  }
  const db = readDB();
  if (!db.customers) db.customers = [];
  const existing = db.customers.find((c: any) => c.phone === phone);
  if (existing) {
    return res.json(existing);
  }

  const newCust = {
    id: `cust-${Date.now()}`,
    name,
    phone,
    email: email || "",
    points: 0,
    createdAt: new Date().toISOString()
  };
  db.customers.push(newCust);
  writeDB(db);
  res.json(newCust);
});

// 6. التقارير المالية والمدير
router.get("/api/audit-logs", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  res.json(db.audit_logs || []);
});

router.get("/api/reports/date-range", authenticate(["admin", "manager"]), (req, res) => {
  const { from, to } = req.query;
  const db = readDB();
  const filtered = filterOrdersByDateRange(db.orders, from as string, to as string);
  res.json(calculateOrdersSummary(db, filtered));
});

router.get("/api/reports/monthly", authenticate(["admin", "manager"]), (req, res) => {
  const { month, year } = req.query;
  const db = readDB();
  const from = `${year}-${month}-01`;
  const to = `${year}-${month}-31`; // Simplified date range end
  const filtered = filterOrdersByDateRange(db.orders, from, to);
  res.json(calculateOrdersSummary(db, filtered));
});

router.get("/api/reports/daily", authenticate(["admin", "manager"]), (req, res) => {
  const { date } = req.query;
  const db = readDB();
  const filtered = filterOrdersByDateRange(db.orders, date as string, date as string);
  res.json(calculateOrdersSummary(db, filtered));
});

router.get("/api/manager/summary", authenticate(["admin", "manager"]), (req, res) => {
  const db = readDB();
  const today = new Date().toISOString().split("T")[0];
  const todayOrders = filterOrdersByDateRange(db.orders, today, today);
  const summary = calculateOrdersSummary(db, todayOrders);
  const activeShift = db.shifts.find((s: any) => s.status === "open");
  const lowStock = db.inventory_items.filter((item: any) => item.quantity <= item.lowStockThreshold);

  res.json({
    ...summary,
    activeShift: activeShift || null,
    lowStockItems: lowStock,
    todayOrderCount: todayOrders.length,
    settings: db.settings
  });
});

router.get("/api/reports/sales-summary", authenticate(["admin", "manager"]), (req, res) => {
  let { from, to } = req.query;
  
  if (!from || !to) {
    // Default to last 30 days to prevent Invalid Date empty filter
    const today = new Date().toISOString().split("T")[0];
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    from = thirtyDaysAgo.toISOString().split("T")[0];
    to = today;
  }

  const db = readDB();
  const completedOrders = filterOrdersByDateRange(db.orders, from as string, to as string);
  const summary = calculateOrdersSummary(db, completedOrders);
  res.json(summary);
});

// =============================================
// المرحلة 8: ميزة المرتجعات وإلغاء الفواتير (Refund Endpoint)
// =============================================
router.post("/api/orders/:id/refund", authenticate(["admin", "manager"]), (req, res) => {
  const { id } = req.params;
  const { reason, itemsToRefund } = req.body;

  if (!reason) {
    return res.status(400).json({ error: "سبب المرتجع مطلوب وإلزامي" });
  }

  const db = readDB();
  const order = db.orders.find((o: any) => o.id === id);
  if (!order) {
    return res.status(404).json({ error: "الفاتورة غير موجودة" });
  }

  if (order.status === "refunded") {
    return res.status(400).json({ error: "الفاتورة مسترجعة بالكامل بالفعل" });
  }

  const cashierId = (req as any).user ? (req as any).user.id : "admin";
  const cashierName = (req as any).user ? (req as any).user.fullName : "المدير";

  let isPartial = false;
  let refundedAmount = 0;

  if (itemsToRefund && Array.isArray(itemsToRefund) && itemsToRefund.length > 0) {
    isPartial = true;
    for (const refundItem of itemsToRefund) {
      const originalItem = order.items.find((oi: any) => oi.productId === refundItem.productId);
      if (!originalItem) {
        return res.status(400).json({ error: `الصنف ${refundItem.productId} غير موجود في الفاتورة` });
      }
      
      const alreadyRefunded = originalItem.refundedQuantity || 0;
      if (refundItem.quantity <= 0 || (refundItem.quantity + alreadyRefunded) > originalItem.quantity) {
        return res.status(400).json({ error: `الكمية المرتجعة غير صالحة للصنف ${originalItem.productNameSnapshot}` });
      }

      originalItem.refundedQuantity = alreadyRefunded + refundItem.quantity;
      refundedAmount += originalItem.unitPrice * refundItem.quantity;

      // تحديث المخزون بناءً على وصفة الاستهلاك
      const recipe = db.recipes ? db.recipes.find((r: any) => r.productId === refundItem.productId) : null;
      if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
        recipe.ingredients.forEach((ing: any) => {
          const rawItem = db.inventory_items.find((i: any) => i.id === ing.inventoryItemId);
          if (rawItem) {
            const returnedQty = ing.amount * refundItem.quantity;
            rawItem.quantity += returnedQty;
            db.inventory_transactions.push({
              id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              inventoryItemId: rawItem.id,
              changeQty: returnedQty,
              reason: `مرتجع جزئي لمنتج (${originalItem.productNameSnapshot}) فاتورة #${order.orderNumber}`,
              orderId: order.id,
              createdBy: cashierId,
              createdAt: new Date().toISOString()
            });
          }
        });
      } else {
        const prod = db.products.find((p: any) => p.id === refundItem.productId);
        if (prod && prod.trackInventory) {
          prod.quantity = (prod.quantity || 0) + refundItem.quantity;
          db.inventory_transactions.push({
            id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            inventoryItemId: prod.id,
            changeQty: refundItem.quantity,
            reason: `مرتجع جزئي فاتورة رقم ${order.orderNumber}`,
            orderId: order.id,
            createdBy: cashierId,
            createdAt: new Date().toISOString()
          });
        }
      }
    }

    order.status = "partially_refunded";
    if (!order.refundedAmount) order.refundedAmount = 0;
    order.refundedAmount += refundedAmount;
    order.refundReason = reason;

  } else {
    order.status = "refunded";
    order.refundReason = reason;
    order.refundedAmount = order.total;

    order.items.forEach((item: any) => {
      const remainingQty = item.quantity - (item.refundedQuantity || 0);
      if (remainingQty <= 0) return;

      item.refundedQuantity = item.quantity;

      const recipe = db.recipes ? db.recipes.find((r: any) => r.productId === item.productId) : null;
      if (recipe && recipe.ingredients && recipe.ingredients.length > 0) {
        recipe.ingredients.forEach((ing: any) => {
          const rawItem = db.inventory_items.find((i: any) => i.id === ing.inventoryItemId);
          if (rawItem) {
            const returnedQty = ing.amount * remainingQty;
            rawItem.quantity += returnedQty;
            db.inventory_transactions.push({
              id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
              inventoryItemId: rawItem.id,
              changeQty: returnedQty,
              reason: `مرتجع كامل لمنتج (${item.productNameSnapshot}) فاتورة #${order.orderNumber}`,
              orderId: order.id,
              createdBy: cashierId,
              createdAt: new Date().toISOString()
            });
          }
        });
      } else {
        const prod = db.products.find((p: any) => p.id === item.productId);
        if (prod && prod.trackInventory) {
          prod.quantity = (prod.quantity || 0) + remainingQty;
          db.inventory_transactions.push({
            id: `it-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
            inventoryItemId: prod.id,
            changeQty: remainingQty,
            reason: `مرتجع كامل فاتورة رقم ${order.orderNumber}`,
            orderId: order.id,
            createdBy: cashierId,
            createdAt: new Date().toISOString()
          });
        }
      }
    });
  }

  writeDB(db);
  writeAuditLog(
    isPartial ? "مرتجع جزئي" : "مرتجع كامل",
    cashierId,
    cashierName,
    `تم عمل مرتجع للفاتورة #${order.orderNumber} لسبب: ${reason}`
  );

  res.json({ success: true, order });
});

// تحديث حالة صنف في الطلب بالمطبخ
router.post("/api/orders/:orderId/items/:itemId/status", authenticate(["admin", "manager", "cashier", "waiter"]), (req, res) => {
  const { orderId, itemId } = req.params;
  const { status } = req.body; // pending | preparing | ready | delivered
  const db = readDB();
  const order = db.orders.find((o: any) => o.id === orderId);
  if (!order) return res.status(404).json({ error: "الطلب غير موجود" });
  if (!order.items) order.items = [];
  const item = order.items.find((i: any) => i.id === itemId);
  if (!item) return res.status(404).json({ error: "الصنف غير موجود بالطلب" });
  
  item.status = status;
  writeDB(db);
  broadcastOrder({ type: "order_item_updated", orderId, itemId, status, order });
  res.json({ success: true, order });
});

export default router;
