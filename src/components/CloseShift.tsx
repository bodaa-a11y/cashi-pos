import React, { useState, useEffect } from "react";
import { X, Check, Save, AlertTriangle, Info, Printer } from "lucide-react";
import { Shift } from "../types";

interface CloseShiftProps {
  shift: Shift;
  onShiftClosed: () => void;
  onCancel: () => void;
}

interface ShiftReport {
  shift: Shift;
  totalSales: number;
  cashSales: number;
  cardSales: number;
  expectedCash: number;
  orderCount: number;
}

export default function CloseShift({ shift, onShiftClosed, onCancel }: CloseShiftProps) {
  const [report, setReport] = useState<ShiftReport | null>(null);
  const [actualCash, setActualCash] = useState<string>("0");
  const [notes, setNotes] = useState<string>("وردية منتهية بشكل طبيعي");
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");
  const [settings, setSettings] = useState<any>(null);

  useEffect(() => {
    async function fetchReport() {
      try {
        const response = await fetch(`/api/shifts/${shift.id}/report`);
        if (response.ok) {
          const data = await response.json();
          setReport(data);
          // Set initial actual cash to expected cash as default helper
          setActualCash(String(data.expectedCash));
        } else {
          setError("فشل تحميل تقرير الوردية من الخادم");
        }
      } catch (e) {
        setError("خطأ أثناء الاتصال بالخادم لتحميل تقرير الوردية");
      }
    }
    fetchReport();

    // جلب إعدادات المنشأة للطباعة
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (e) {
        const local = localStorage.getItem("pos_settings");
        if (local) setSettings(JSON.parse(local));
      }
    };
    fetchSettings();
  }, [shift.id]);

  const expectedCashValue = report ? report.expectedCash : 0;
  const actualCashValue = Number(actualCash) || 0;
  const differenceValue = actualCashValue - expectedCashValue;

  const handleCloseShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (actualCash === "" || isNaN(actualCashValue)) {
      setError("الرجاء إدخال المبلغ الفعلي المتواجد بالدرج بشكل صحيح");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch(`/api/shifts/${shift.id}/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          closingCash: actualCashValue,
          expectedCash: expectedCashValue,
          cashDifference: differenceValue,
          notes,
        }),
      });

      if (response.ok) {
        onShiftClosed();
      } else {
        const errData = await response.json();
        setError(errData.error || "فشل إغلاق الوردية");
      }
    } catch (e) {
      setError("خطأ في الشبكة أثناء إرسال طلب إغلاق الوردية");
    } finally {
      setLoading(false);
    }
  };

  const handlePrintXReport = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      alert("الطباعة الحرارية متاحة فقط داخل برنامج كاشي للويندوز");
      return;
    }

    try {
      const bCurrency = settings?.currency || "ر.س";
      const bName = settings?.businessNameAr || "كاشي";
      const html = `
        <div class="receipt-print text-stone-800 p-4 font-mono text-xs text-right leading-relaxed" style="width: 280px; font-family: 'Cairo', 'JetBrains Mono', monospace;">
          <div class="text-center border-b border-dashed border-stone-400 pb-2 mb-2">
            <h2 class="font-bold text-sm">${bName}</h2>
            <h3 class="font-bold text-xs mt-1 bg-stone-100 py-1">تقرير إغلاق الوردية (Z-Report)</h3>
            <p class="text-[9px]">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
          </div>
          <div class="space-y-1.5 border-b border-dashed border-stone-400 pb-2 mb-2">
            <p>رقم الوردية: #${shift.shiftNumber}</p>
            <p>الكاشير المسؤول: ${shift.cashierName}</p>
            <p>تاريخ الفتح: ${new Date(shift.openedAt).toLocaleString('ar-EG')}</p>
          </div>
          <div class="space-y-1 border-b border-dashed border-stone-400 pb-2 mb-2">
            <div class="flex justify-between"><span>الرصيد الافتتاحي:</span><span>${shift.openingCash.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between"><span>إجمالي المبيعات:</span><span>${(report?.totalSales || 0).toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between"><span>المبيعات النقدية:</span><span>${(report?.cashSales || 0).toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between"><span>مبيعات الشبكة:</span><span>${(report?.cardSales || 0).toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between"><span>عدد الفواتير:</span><span>${report?.orderCount}</span></div>
          </div>
          <div class="space-y-1 border-b border-dashed border-stone-400 pb-2 mb-2 font-bold">
            <div class="flex justify-between"><span>الكاش المتوقع بالدرج:</span><span>${expectedCashValue.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between"><span>الكاش الفعلي بالدرج:</span><span>${actualCashValue.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between ${differenceValue < 0 ? 'text-red-600' : differenceValue > 0 ? 'text-blue-600' : 'text-green-600'}">
              <span>العجز / الزيادة:</span>
              <span>${differenceValue.toFixed(2)} ${bCurrency}</span>
            </div>
          </div>
          ${notes ? `<div class="text-[10px] bg-stone-50 p-2 border border-stone-200 mt-2"><strong>الملاحظات:</strong><p>${notes}</p></div>` : ''}
          <div class="text-center mt-4 text-[9px] text-stone-400">
            <p>مشغّل بواسطة كاشي Cashi</p>
          </div>
        </div>
      `;

      await electronAPI.printReceipt({ html });
      alert("تم إرسال تقرير Z-Report لطابعة الصندوق! 🖨️");
    } catch (e) {
      console.error(e);
      alert("فشل طباعة تقرير الوردية");
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-[#2E7D32] text-white p-5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrintXReport}
              className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg border border-white/10 text-white transition-all"
              title="طباعة التقرير"
            >
              <Printer className="w-5 h-5" />
            </button>
            <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
              رقم الوردية: {shift.shiftNumber}
            </span>
          </div>
          <h3 className="text-xl font-bold">إغلاق الوردية وتسليم الصندوق (Z Report)</h3>
          <button
            onClick={onCancel}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border-r-4 border-red-500 rounded-lg text-red-800 text-sm text-right font-medium">
            {error}
          </div>
        )}

        {!report && !error ? (
          <div className="p-12 text-center space-y-3">
            <div className="w-12 h-12 border-4 border-green-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-sm text-stone-500 font-medium">جاري حساب إجماليات الصندوق ومبيعات الوردية...</p>
          </div>
        ) : (
          <form onSubmit={handleCloseShiftSubmit} className="p-6 space-y-6">
            
            {/* Quick Shift Summary Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-right">
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-stone-500 font-medium mb-1">إجمالي المبيعات</p>
                <p className="text-lg font-bold text-[#2E7D32] font-mono">{(report?.totalSales || 0).toFixed(2)} <span className="text-xs">ر.س</span></p>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-stone-500 font-medium mb-1">المبيعات النقدية (كاش)</p>
                <p className="text-lg font-bold text-stone-800 font-mono">{(report?.cashSales || 0).toFixed(2)} <span className="text-xs">ر.س</span></p>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-stone-500 font-medium mb-1">مبيعات الشبكة (مدى/بطاقة)</p>
                <p className="text-lg font-bold text-stone-800 font-mono">{(report?.cardSales || 0).toFixed(2)} <span className="text-xs">ر.س</span></p>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 shadow-sm">
                <p className="text-xs text-stone-500 font-medium mb-1">عدد الفواتير المنفذة</p>
                <p className="text-lg font-bold text-stone-800 font-mono">{report?.orderCount} <span className="text-xs">فاتورة</span></p>
              </div>
            </div>

            {/* Calculations Zone */}
            <div className="bg-[#EAF4EA] border border-green-200 rounded-xl p-5 space-y-4">
              <h4 className="text-sm font-bold text-green-950 text-right border-b border-green-300 pb-2 flex items-center justify-between">
                <span className="text-xs text-green-800 font-normal">معادلة الدرج: الكاش الافتتاحي ({shift.openingCash.toFixed(2)} ر.س) + الكاش المحصل</span>
                <span>مطابقة مبالغ صندوق الكاشير</span>
              </h4>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
                {/* Expected Cash */}
                <div className="text-right">
                  <label className="block text-xs font-bold text-stone-600 mb-1">المبلغ المتوقع في الدرج</label>
                  <p className="text-2xl font-bold font-mono text-stone-800 bg-white border border-stone-300 px-4 py-2.5 rounded-xl">
                    {expectedCashValue.toFixed(2)} <span className="text-xs">ر.س</span>
                  </p>
                </div>

                {/* Actual Cash Input */}
                <div className="text-right">
                  <label className="block text-xs font-bold text-green-900 mb-1 flex items-center justify-between">
                    <span className="text-red-500 text-[10px]">* مطلوب عد الصندوق</span>
                    <span>المبلغ الفعلي في الدرج</span>
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={actualCash}
                    onChange={(e) => setActualCash(e.target.value)}
                    placeholder="قم بعد الصندوق وأدخل القيمة هنا..."
                    className="w-full border border-green-300 bg-white px-4 py-2 text-xl font-mono font-bold text-stone-800 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-left"
                  />
                </div>

                {/* Cash Discrepancy */}
                <div className="text-right">
                  <label className="block text-xs font-bold text-stone-600 mb-1">العجز أو الزيادة في الدرج</label>
                  <div
                    className={`text-2xl font-bold font-mono px-4 py-2.5 rounded-xl border flex items-center justify-between ${
                      differenceValue < 0
                        ? "bg-red-50 text-red-600 border-red-200"
                        : differenceValue > 0
                        ? "bg-blue-50 text-blue-600 border-blue-200"
                        : "bg-green-50 text-green-600 border-green-200"
                    }`}
                  >
                    <span className="text-xs font-sans">
                      {differenceValue < 0 ? "عجز ⚠️" : differenceValue > 0 ? "زيادة 💵" : "مطابق ✅"}
                    </span>
                    <span>
                      {differenceValue.toFixed(2)} <span className="text-xs">ر.س</span>
                    </span>
                  </div>
                </div>
              </div>

              {differenceValue < 0 && (
                <p className="text-xs text-red-700 font-bold text-right flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>تنبيه: يوجد نقص مالي في الصندوق بقيمة {Math.abs(differenceValue).toFixed(2)} ر.س. يرجى تبرير هذا العجز في حقل الملاحظات.</span>
                </p>
              )}
            </div>

            {/* Notes and feedback */}
            <div className="text-right">
              <label className="block text-sm font-bold text-stone-700 mb-1">تبريرات وملاحظات تسليم الوردية</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="أدخل أي ملاحظات حول العجز، الزيادة، أو تحديات العمل بالوردية..."
                className="w-full border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-sm text-right p-3"
              />
            </div>

            {/* Action buttons */}
            <div className="flex gap-3 justify-end border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-3 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl font-bold text-sm transition-all"
              >
                تراجع وإلغاء
              </button>
              <button
                type="submit"
                disabled={loading}
                className="px-8 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all"
              >
                <Save className="w-4 h-4" />
                <span>{loading ? "جاري قفل الصندوق..." : "قفل الوردية نهائياً (Z-Report)"}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
