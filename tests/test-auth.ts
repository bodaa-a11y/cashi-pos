/**
 * سكريبت فحص أمان مسارات النظام (Cashi POS Auth Security Tester)
 * يقوم هذا السكريبت بإرسال طلبات لكافة مسارات النظام للتأكد من أنها محمية
 * وتُرجع رمز الحالة 401 (غير مصرح) في حال غياب التوكن.
 */

const PORT = process.env.PORT || 3847;
const BASE_URL = `http://localhost:${PORT}`;

// قائمة بالمسارات المحمية مع تحديد نوع الطلب (HTTP Method)
const protectedRoutes = [
  { path: "/api/settings", method: "GET" },
  { path: "/api/settings", method: "POST" },
  { path: "/api/settings", method: "PUT" },
  { path: "/api/menu", method: "GET" },
  { path: "/api/categories", method: "POST" },
  { path: "/api/products", method: "POST" },
  { path: "/api/products/p-123", method: "PUT" },
  { path: "/api/products/p-123", method: "DELETE" },
  { path: "/api/tables", method: "GET" },
  { path: "/api/tables/merge", method: "POST" },
  { path: "/api/tables/split", method: "POST" },
  { path: "/api/tables/transfer", method: "POST" },
  { path: "/api/shifts/active", method: "GET" },
  { path: "/api/shifts/open", method: "POST" },
  { path: "/api/shifts/s-123/close", method: "POST" },
  { path: "/api/shifts/s-123/report", method: "GET" },
  { path: "/api/shifts", method: "GET" },
  { path: "/api/orders", method: "GET" },
  { path: "/api/orders/latest", method: "GET" },
  { path: "/api/orders/by-id/o-123", method: "GET" },
  { path: "/api/orders/held", method: "GET" },
  { path: "/api/orders/sync", method: "POST" },
  { path: "/api/orders/hold", method: "POST" },
  { path: "/api/orders/held/o-123", method: "DELETE" },
  { path: "/api/customers", method: "GET" },
  { path: "/api/customers", method: "POST" },
  { path: "/api/inventory", method: "GET" },
  { path: "/api/inventory", method: "POST" },
  { path: "/api/inventory/i-123", method: "PUT" },
  { path: "/api/inventory/i-123", method: "DELETE" },
  { path: "/api/recipes", method: "GET" },
  { path: "/api/recipes", method: "POST" },
  { path: "/api/reports/low-stock", method: "GET" },
  { path: "/api/print/receipt", method: "POST" },
  { path: "/api/print/kitchen", method: "POST" },
  { path: "/api/print/latest", method: "GET" },
  { path: "/api/users", method: "GET" },
  { path: "/api/users", method: "POST" },
  { path: "/api/users/u-123", method: "PUT" },
  { path: "/api/users/u-123", method: "DELETE" },
  { path: "/api/audit-logs", method: "GET" },
  { path: "/api/reports/date-range", method: "GET" },
  { path: "/api/reports/monthly", method: "GET" },
  { path: "/api/reports/daily", method: "GET" },
  { path: "/api/manager/summary", method: "GET" },
  { path: "/api/reports/sales-summary", method: "GET" },
  { path: "/api/system/info", method: "GET" },
  { path: "/api/cloud-sync/test", method: "POST" },
  { path: "/api/cloud-sync/orders", method: "POST" },
  { path: "/api/cloud-sync/menu", method: "GET" }
];

async function runTests() {
  console.log("==================================================");
  console.log("🔒 بدء فحص صلاحيات مسارات نظام كاشي Cashi POS...");
  console.log(`📡 الاتصال بالسيرفر على الرابط: ${BASE_URL}`);
  console.log("==================================================");

  let successCount = 0;
  let failureCount = 0;

  for (const route of protectedRoutes) {
    try {
      const response = await fetch(`${BASE_URL}${route.path}`, {
        method: route.method,
        headers: {
          "Content-Type": "application/json"
          // لا نرسل توكن هنا لاختبار الحظر
        },
        body: route.method !== "GET" && route.method !== "DELETE" ? JSON.stringify({}) : undefined
      });

      if (response.status === 401) {
        console.log(`✅ [${route.method}] ${route.path} -> تم الحظر بنجاح (401 Unauthorized)`);
        successCount++;
      } else {
        console.error(`❌ [${route.method}] ${route.path} -> ثغرة! السيرفر أرجع رمز الحالة: ${response.status}`);
        failureCount++;
      }
    } catch (error: any) {
      console.error(`⚠️ فشل الاتصال بالمسار [${route.method}] ${route.path}: ${error.message}`);
      failureCount++;
    }
  }

  console.log("==================================================");
  console.log("📊 نتائج الفحص الأمني:");
  console.log(`   - عدد المسارات الآمنة والمحمية: ${successCount}`);
  console.log(`   - عدد المسارات المفتوحة أو الفاشلة: ${failureCount}`);
  console.log("==================================================");

  if (failureCount > 0) {
    console.error("❌ تحذير: يوجد مسارات غير محمية وتحتاج لمراجعة أمنية فورية!");
    process.exit(1);
  } else {
    console.log("🎉 مبارك: جميع مسارات النظام محمية ومؤمنة بنسبة 100%!");
    process.exit(0);
  }
}

runTests();
