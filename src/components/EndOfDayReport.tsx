import React, { useState, useEffect, useCallback } from "react";
import {
  FileText, Printer, RefreshCw, Calendar, TrendingUp,
  Banknote, CreditCard, Package, Users, Clock, Receipt,
} from "lucide-react";

const fmt = (n: number) => (Number(n) || 0).toFixed(2);

export default function EndOfDayReport() {
  const today = new Date().toISOString().split("T")[0];
  const [date, setDate] = useState(today);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState(false);

  const fetchReport = useCallback(async (d: string) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("pos_token");
      const headers: any = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/reports/end-of-day?date=${d}`, {
        headers,
      });
      const json = await res.json().catch(() => null);
      if (res.ok && json) {
        setData(json);
      } else {
        setError((json && json.error) || `فشل تحميل التقرير (رمز الاستجابة ${res.status})`);
      }
    } catch (e: any) {
      console.error("EndOfDay fetch error:", e);
      setError("حدث خطأ أثناء الاتصال بالخادم: " + (e?.message || "يرجى التحقق من الشبكة"));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchReport(date); }, [date, fetchReport]);

  // ── بناء HTML للطباعة الحرارية (يطبع كصورة raster فالعربي يطلع سليم) ──
  const buildPrintHtml = () => {
    const s = data.summary;
    const cats = data.categories.map((c: any) => `
      <div style="margin-top:10px;">
        <div style="background:#2E7D32;color:#fff;padding:4px 8px;font-weight:bold;border-radius:4px;">${c.name}</div>
        <table style="width:100%;border-collapse:collapse;font-size:12px;" dir="rtl">
          <tr style="border-bottom:1px solid #999;font-weight:bold;">
            <td style="text-align:right;padding:3px;">الصنف</td>
            <td style="text-align:center;">كمية</td>
            <td style="text-align:center;">مبيعات</td>
            <td style="text-align:center;">ربح</td>
          </tr>
          ${c.items.map((i: any) => `
            <tr style="border-bottom:1px dashed #ccc;">
              <td style="text-align:right;padding:3px;">${i.name}</td>
              <td style="text-align:center;">${i.qty}</td>
              <td style="text-align:center;">${fmt(i.sales)}</td>
              <td style="text-align:center;">${fmt(i.profit)}</td>
            </tr>`).join("")}
          <tr style="font-weight:bold;background:#f0f0f0;">
            <td style="text-align:right;padding:3px;">إجمالي ${c.name}</td>
            <td style="text-align:center;">${c.qty}</td>
            <td style="text-align:center;">${fmt(c.sales)}</td>
            <td style="text-align:center;">${fmt(c.profit)}</td>
          </tr>
        </table>
      </div>`).join("");

    return `<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="utf-8">
      <style>body{font-family:'Cairo',Arial,sans-serif;width:100%;margin:0;padding:8px;color:#000;font-size:13px;direction:rtl;}</style>
      </head><body>
      <div style="text-align:center;font-weight:bold;font-size:16px;">تقرير نهاية اليوم</div>
      <div style="text-align:center;font-size:12px;">التاريخ: ${data.date}</div>
      <hr style="border:none;border-top:2px solid #000;"/>
      <table style="width:100%;font-size:12px;" dir="rtl">
        <tr><td>عدد الفواتير:</td><td style="text-align:left;">${s.orderCount}</td></tr>
        <tr><td>إجمالي المبيعات:</td><td style="text-align:left;font-weight:bold;">${fmt(s.totalSales)} ر.س</td></tr>
        <tr><td>نقدي:</td><td style="text-align:left;">${fmt(s.cashSales)} ر.س</td></tr>
        <tr><td>شبكة:</td><td style="text-align:left;">${fmt(s.cardSales)} ر.س</td></tr>
        ${(s.appSales || 0) > 0 ? `<tr><td>تطبيقات التوصيل:</td><td style="text-align:left;">${fmt(s.appSales)} ر.س</td></tr>` : ''}
        <tr><td>الضريبة:</td><td style="text-align:left;">${fmt(s.totalTax)} ر.س</td></tr>
        <tr><td>الخصومات:</td><td style="text-align:left;">${fmt(s.totalDiscount)} ر.س</td></tr>
        <tr><td>مرتجعات:</td><td style="text-align:left;">${fmt(s.totalRefunded)} ر.س</td></tr>
        <tr><td>المصروفات:</td><td style="text-align:left;">${fmt(s.totalExpenses)} ر.س</td></tr>
        <tr style="font-weight:bold;font-size:14px;"><td>صافي الربح:</td><td style="text-align:left;">${fmt(s.netProfit)} ر.س</td></tr>
      </table>
      <hr style="border:none;border-top:1px solid #000;"/>
      ${cats}
      <hr style="border:none;border-top:2px solid #000;"/>
      <div style="text-align:center;font-size:11px;margin-top:8px;">نظام كاشي — تقرير مُولّد آلياً</div>
      </body></html>`;
  };

  const handlePrint = async () => {
    if (!data || printing) return;
    setPrinting(true);
    try {
      const api = (window as any).electronAPI;
      if (api?.printReceipt) {
        await api.printReceipt({ html: buildPrintHtml() });
      } else {
        const w = window.open("", "_blank");
        if (w) { w.document.write(buildPrintHtml()); w.document.close(); w.print(); }
      }
    } finally {
      setPrinting(false);
    }
  };

  const s = data?.summary;

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#2E7D32] rounded-2xl flex items-center justify-center">
            <FileText className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800">تقرير نهاية اليوم</h2>
            <p className="text-xs text-stone-500">كل الأصناف والأقسام والكاشيرات بتقرير واحد</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Calendar className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-stone-400" />
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="pr-9 pl-3 py-2 border border-stone-200 rounded-xl bg-white text-sm focus:ring-2 focus:ring-[#2E7D32] outline-none"
            />
          </div>
          <button
            onClick={() => fetchReport(date)}
            className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50"
            title="تحديث"
          >
            <RefreshCw className={`w-5 h-5 text-stone-600 ${loading ? "animate-spin" : ""}`} />
          </button>
          <button
            onClick={handlePrint}
            disabled={!data || printing}
            className="flex items-center gap-2 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-stone-300 text-white px-4 py-2 rounded-xl font-bold text-sm transition-all"
          >
            <Printer className="w-4 h-4" />
            {printing ? "جاري الطباعة..." : "طباعة التقرير"}
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border-r-4 border-red-500 rounded-lg text-red-800 text-sm">{error}</div>
      )}

      {loading && !data && (
        <div className="text-center py-20 text-stone-400 font-bold">جاري تحميل التقرير...</div>
      )}

      {data && s && (
        <>
          {/* ── بطاقات الملخص ── */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 text-stone-500 text-xs mb-1"><Receipt className="w-4 h-4" /> عدد الفواتير</div>
              <div className="text-2xl font-bold text-stone-800">{s.orderCount}</div>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 text-stone-500 text-xs mb-1"><TrendingUp className="w-4 h-4" /> إجمالي المبيعات</div>
              <div className="text-2xl font-bold text-[#2E7D32]">{fmt(s.totalSales)} <span className="text-xs">ر.س</span></div>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 text-stone-500 text-xs mb-1"><Banknote className="w-4 h-4" /> نقدي / شبكة</div>
              <div className="text-sm font-bold text-stone-800">{fmt(s.cashSales)} / {fmt(s.cardSales)}</div>
            </div>
            <div className="bg-amber-50 rounded-2xl border border-amber-200 p-4">
              <div className="flex items-center gap-2 text-amber-700 text-xs mb-1">📱 تطبيقات توصيل</div>
              <div className="text-2xl font-bold text-amber-900">{fmt(s.appSales || 0)} <span className="text-xs">ر.س</span></div>
            </div>
            <div className="bg-[#2E7D32] rounded-2xl p-4 text-white">
              <div className="flex items-center gap-2 text-white/70 text-xs mb-1"><CreditCard className="w-4 h-4" /> صافي الربح</div>
              <div className="text-2xl font-bold">{fmt(s.netProfit)} <span className="text-xs">ر.س</span></div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* ── الأقسام والأصناف ── */}
            <div className="lg:col-span-2 space-y-4">
              <h3 className="font-bold text-stone-700 flex items-center gap-2"><Package className="w-5 h-5 text-[#2E7D32]" /> المبيعات حسب القسم</h3>
              {data.categories.length === 0 && (
                <div className="bg-white rounded-2xl border border-stone-200 p-10 text-center text-stone-400">لا توجد مبيعات في هذا اليوم</div>
              )}
              {data.categories.map((c: any) => (
                <div key={c.id} className="bg-white rounded-2xl border border-stone-200 overflow-hidden">
                  <div className="bg-stone-50 px-4 py-3 flex items-center justify-between border-b border-stone-200">
                    <span className="font-bold text-stone-800">{c.name}</span>
                    <span className="text-xs text-stone-500">
                      {c.qty} قطعة · مبيعات {fmt(c.sales)} ر.س · ربح {fmt(c.profit)} ر.س
                    </span>
                  </div>
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-stone-400 text-xs border-b border-stone-100">
                        <th className="text-right py-2 px-4 font-medium">الصنف</th>
                        <th className="py-2 px-2 font-medium">الكمية</th>
                        <th className="py-2 px-2 font-medium">المبيعات</th>
                        <th className="py-2 px-2 font-medium">التكلفة</th>
                        <th className="py-2 px-4 font-medium">الربح</th>
                      </tr>
                    </thead>
                    <tbody>
                      {c.items.map((i: any, idx: number) => (
                        <tr key={idx} className="border-b border-stone-50 last:border-0">
                          <td className="text-right py-2 px-4 text-stone-700">{i.name}</td>
                          <td className="text-center py-2 px-2 font-bold">{i.qty}</td>
                          <td className="text-center py-2 px-2">{fmt(i.sales)}</td>
                          <td className="text-center py-2 px-2 text-stone-400">{fmt(i.cost)}</td>
                          <td className="text-center py-2 px-4 font-bold text-[#2E7D32]">{fmt(i.profit)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>

            {/* ── العمود الجانبي: كاشيرات + ساعات + مصروفات + ورديات ── */}
            <div className="space-y-4">
              <div className="bg-white rounded-2xl border border-stone-200 p-4">
                <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-3"><Users className="w-5 h-5 text-[#2E7D32]" /> أداء الكاشيرات</h3>
                {data.cashiers.length === 0 && <p className="text-xs text-stone-400 text-center py-3">لا يوجد</p>}
                {data.cashiers.map((c: any) => (
                  <div key={c.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0">
                    <div>
                      <div className="text-sm font-bold text-stone-700">{c.name}</div>
                      <div className="text-[10px] text-stone-400">{c.orders} فاتورة</div>
                    </div>
                    <div className="text-sm font-bold text-[#2E7D32]">{fmt(c.sales)} ر.س</div>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 p-4">
                <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-3"><Clock className="w-5 h-5 text-[#2E7D32]" /> المبيعات بالساعة</h3>
                <div className="space-y-1.5">
                  {data.hourly.map((h: any) => {
                    const max = Math.max(...data.hourly.map((x: any) => x.sales), 1);
                    return (
                      <div key={h.hour} className="flex items-center gap-2 text-xs">
                        <span className="w-10 text-stone-400 font-mono" dir="ltr">{h.hour}</span>
                        <div className="flex-1 bg-stone-100 rounded-full h-4 overflow-hidden">
                          <div className="bg-[#2E7D32] h-full rounded-full" style={{ width: `${(h.sales / max) * 100}%` }} />
                        </div>
                        <span className="w-16 text-left font-bold text-stone-600">{fmt(h.sales)}</span>
                      </div>
                    );
                  })}
                  {data.hourly.length === 0 && <p className="text-xs text-stone-400 text-center py-3">لا توجد بيانات</p>}
                </div>
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 p-4">
                <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-3"><CreditCard className="w-5 h-5 text-red-500" /> المصروفات ({fmt(s.totalExpenses)} ر.س)</h3>
                {data.expenses.length === 0 && <p className="text-xs text-stone-400 text-center py-3">لا توجد مصروفات</p>}
                {data.expenses.map((e: any) => (
                  <div key={e.id} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0 text-sm">
                    <span className="text-stone-600">{e.category}</span>
                    <span className="font-bold text-red-600">{fmt(e.amount)} ر.س</span>
                  </div>
                ))}
              </div>

              <div className="bg-white rounded-2xl border border-stone-200 p-4">
                <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-3"><Receipt className="w-5 h-5 text-[#2E7D32]" /> الورديات</h3>
                {data.shifts.length === 0 && <p className="text-xs text-stone-400 text-center py-3">لا توجد ورديات</p>}
                {data.shifts.map((sh: any) => (
                  <div key={sh.id} className="py-2 border-b border-stone-50 last:border-0 text-sm">
                    <div className="flex justify-between">
                      <span className="font-bold text-stone-700">وردية #{sh.shiftNumber} — {sh.cashierName}</span>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${sh.status === "open" ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"}`}>
                        {sh.status === "open" ? "مفتوحة" : "مغلقة"}
                      </span>
                    </div>
                    <div className="text-[10px] text-stone-400 mt-0.5">
                      عهدة: {fmt(sh.openingCash)} ر.س
                      {sh.actualCash != null && <> · فعلي: {fmt(sh.actualCash)} ر.س · فرق: {fmt(sh.cashDifference)} ر.س</>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
