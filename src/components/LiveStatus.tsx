import React, { useState, useEffect, useCallback } from "react";
import {
  Activity, Banknote, RefreshCw, Users, Clock, AlertTriangle, Radio,
} from "lucide-react";

const fmt = (n: number) => (Number(n) || 0).toFixed(2);

/** شاشة مراقبة لحظية — تحديث تلقائي كل 30 ثانية */
export default function LiveStatus() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState("");
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchLive = useCallback(async () => {
    try {
      const token = localStorage.getItem("pos_token");
      const res = await fetch("/api/manager/live", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (res.ok) {
        setData(json);
        setLastUpdate(new Date());
        setError("");
      } else {
        setError(json.error || "فشل التحديث");
      }
    } catch (e) {
      setError("تعذر الاتصال بالخادم");
    }
  }, []);

  useEffect(() => {
    fetchLive();
    const t = setInterval(fetchLive, 30000); // تحديث كل 30 ثانية
    return () => clearInterval(t);
  }, [fetchLive]);

  return (
    <div className="p-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-[#2E7D32] rounded-2xl flex items-center justify-center animate-pulse">
            <Radio className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-stone-800">المراقبة اللحظية</h2>
            <p className="text-xs text-stone-500">
              آخر تحديث: {lastUpdate.toLocaleTimeString("ar-EG")}
              {error && <span className="text-red-500"> — {error}</span>}
            </p>
          </div>
        </div>
        <button onClick={fetchLive} className="p-2 border border-stone-200 rounded-xl hover:bg-stone-50">
          <RefreshCw className="w-5 h-5 text-stone-600" />
        </button>
      </div>

      {!data ? (
        <div className="text-center py-20 text-stone-400 font-bold">جاري التحميل...</div>
      ) : (
        <>
          {/* حالة الوردية + ملخص اليوم */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className={`rounded-2xl p-4 border ${data.activeShift ? "bg-green-50 border-green-200" : "bg-red-50 border-red-200"}`}>
              <div className="flex items-center gap-2 text-xs mb-1 text-stone-500">
                <Activity className="w-4 h-4" /> حالة الوردية
              </div>
              {data.activeShift ? (
                <>
                  <div className="font-bold text-green-700">مفتوحة — {data.activeShift.cashierName}</div>
                  <div className="text-[10px] text-stone-500">عهدة: {fmt(data.activeShift.openingCash)} ر.س</div>
                </>
              ) : (
                <div className="font-bold text-red-600">لا توجد وردية مفتوحة!</div>
              )}
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 text-stone-500 text-xs mb-1"><Banknote className="w-4 h-4" /> مبيعات اليوم</div>
              <div className="text-2xl font-bold text-[#2E7D32]">{fmt(data.today.sales)} <span className="text-xs">ر.س</span></div>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 text-stone-500 text-xs mb-1"><Clock className="w-4 h-4" /> فواتير اليوم</div>
              <div className="text-2xl font-bold text-stone-800">{data.today.orderCount}</div>
              <div className="text-[10px] text-stone-400">معلقة: {data.today.heldOrdersCount}</div>
            </div>
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center gap-2 text-stone-500 text-xs mb-1"><AlertTriangle className="w-4 h-4" /> مخزون منخفض</div>
              <div className="text-2xl font-bold text-amber-600">{data.lowStockCount}</div>
              <div className="text-[10px] text-stone-400">صنف يحتاج طلب شراء</div>
            </div>
          </div>

          <div className="grid lg:grid-cols-3 gap-6">
            {/* الكاشيرات النشطون */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-3">
                <Users className="w-5 h-5 text-[#2E7D32]" /> الكاشيرات اليوم
              </h3>
              {data.cashiers.length === 0 && <p className="text-xs text-stone-400 text-center py-4">لا توجد عمليات بيع اليوم</p>}
              {data.cashiers.map((c: any) => (
                <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-stone-50 last:border-0">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                      <span className="text-sm font-bold text-stone-700">{c.name}</span>
                    </div>
                    <div className="text-[10px] text-stone-400 mr-4">{c.orders} فاتورة · آخر نشاط: {new Date(c.lastActivityAt).toLocaleTimeString("ar-EG")}</div>
                  </div>
                  <div className="text-sm font-bold text-[#2E7D32]">{fmt(c.sales)}</div>
                </div>
              ))}
            </div>

            {/* آخر الفواتير */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-3">
                <Activity className="w-5 h-5 text-[#2E7D32]" /> آخر الفواتير
              </h3>
              <div className="space-y-2 max-h-80 overflow-y-auto">
                {data.recentOrders.map((o: any) => (
                  <div key={o.id} className="flex items-center justify-between text-sm bg-stone-50 rounded-xl px-3 py-2">
                    <div>
                      <span className="font-bold text-stone-700">#{o.orderNumber}</span>
                      <span className="text-[10px] text-stone-400 mr-2">{o.cashierName}</span>
                    </div>
                    <div className="text-left">
                      <div className="font-bold text-stone-800">{fmt(o.total)} ر.س</div>
                      <div className="text-[10px] text-stone-400">{new Date(o.createdAt).toLocaleTimeString("ar-EG")}</div>
                    </div>
                  </div>
                ))}
                {data.recentOrders.length === 0 && <p className="text-xs text-stone-400 text-center py-4">لا توجد فواتير اليوم</p>}
              </div>
            </div>

            {/* آخر تسجيلات الدخول */}
            <div className="bg-white rounded-2xl border border-stone-200 p-4">
              <h3 className="font-bold text-stone-700 flex items-center gap-2 mb-3">
                <Clock className="w-5 h-5 text-[#2E7D32]" /> آخر عمليات الدخول
              </h3>
              {data.lastLogins.map((l: any, i: number) => (
                <div key={i} className="flex items-center justify-between py-2 border-b border-stone-50 last:border-0 text-sm">
                  <div>
                    <div className="text-stone-700 font-bold text-xs">{l.userName}</div>
                    <div className="text-[10px] text-stone-400">{l.action}</div>
                  </div>
                  <div className="text-[10px] text-stone-400 font-mono">{new Date(l.at).toLocaleTimeString("ar-EG")}</div>
                </div>
              ))}
              {data.lastLogins.length === 0 && <p className="text-xs text-stone-400 text-center py-4">لا يوجد</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
