import React, { useState, useEffect } from "react";
import { Play, ArrowRight, ShieldAlert, Coins, HelpCircle } from "lucide-react";
import { User, Shift } from "../types";

interface OpenShiftProps {
  user: User;
  onShiftOpened: (shift: Shift) => void;
  onBackToLogin: () => void;
}

export default function OpenShift({ user, onShiftOpened, onBackToLogin }: OpenShiftProps) {
  const [openingCash, setOpeningCash] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [suggestedShiftNum, setSuggestedShiftNum] = useState<string>("سيتم توليده تلقائياً");

  // Fetch shifts length to suggest next shift number
  useEffect(() => {
    async function fetchShiftCount() {
      try {
        const res = await fetch("/api/shifts");
        if (res.ok) {
          const shifts = await res.json();
          setSuggestedShiftNum(String(shifts.length + 1));
        }
      } catch (e) {
        console.error("Error fetching shift count", e);
      }
    }
    fetchShiftCount();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openingCash || isNaN(Number(openingCash)) || Number(openingCash) < 0) {
      setError("الرجاء إدخال مبلغ افتتاحي صحيح (صفر أو أكثر)");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/shifts/open", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashierId: user.id,
          cashierName: user.fullName,
          openingCash: Number(openingCash),
          notes,
        }),
      });

      const data = await response.json();
      if (response.ok) {
        onShiftOpened(data);
      } else {
        setError(data.error || "فشل فتح الوردية. يرجى المحاولة مرة أخرى.");
      }
    } catch (err) {
      setError("خطأ في الاتصال بالخادم. يرجى التحقق من اتصال الشبكة.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-stone-100 flex items-center justify-center p-4">
      <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
        {/* Banner header */}
        <div className="bg-[#2E7D32] text-white p-6 relative">
          <button
            onClick={onBackToLogin}
            className="absolute left-6 top-6 flex items-center gap-1 text-xs bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-lg border border-white/10 transition-all"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            <span>خروج</span>
          </button>

          <h2 className="text-2xl font-bold mt-2">فتح الوردية الجديدة</h2>
          <p className="text-white/80 text-sm mt-1">ابدأ يومك الجديد في المطعم واستلم عهدتك</p>
        </div>

        {/* Warning Alert if no active shift */}
        <div className="m-6 p-4 bg-orange-50 border-r-4 border-orange-500 rounded-xl flex gap-3 text-orange-800 text-sm">
          <ShieldAlert className="w-6 h-6 text-orange-600 shrink-0 mt-0.5" />
          <div className="space-y-1 text-right">
            <p className="font-bold">تنبيه: لا توجد وردية مفتوحة حالياً!</p>
            <p className="text-xs text-orange-700/90">
              يجب فتح وردية جديدة وإدخال الرصيد الافتتاحي للدرج لتتمكن من إنشاء فواتير المبيعات وتحصيل المبالغ.
            </p>
          </div>
        </div>

        {error && (
          <div className="mx-6 px-4 py-3 bg-red-50 border-r-4 border-red-500 rounded-lg text-red-800 text-sm text-right font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Shift Number (Read Only) */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1.5 text-right">
              رقم الوردية التلقائي
            </label>
            <input
              type="text"
              readOnly
              value={suggestedShiftNum !== "سيتم توليده تلقائياً" ? `وردية رقم: ${suggestedShiftNum}` : suggestedShiftNum}
              placeholder="سيتم تحميل رقم الوردية من النظام"
              className="w-full bg-stone-50 border border-stone-200 text-stone-500 px-4 py-3 rounded-xl text-right text-sm focus:outline-none"
            />
            <p className="text-xs text-stone-400 mt-1 text-right">
              يتم توليد رقم الوردية تلقائياً وتسلسلياً من النظام لضمان دقة الرقابة المالية.
            </p>
          </div>

          {/* Opening Cash Input */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1.5 text-right flex items-center justify-between">
              <span className="text-red-500 text-xs">* حقل إجباري</span>
              <span>المبلغ الافتتاحي (العهدة النقدية بالدرج)</span>
            </label>
            <div className="relative">
              <Coins className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
              <input
                type="number"
                step="0.01"
                required
                value={openingCash}
                onChange={(e) => setOpeningCash(e.target.value)}
                placeholder="أدخل رصيد الكاش الافتتاحي في درج الكاشير..."
                className="w-full pr-12 pl-16 py-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-left font-mono font-bold text-lg text-stone-800"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-stone-400">
                ريال سعودي
              </span>
            </div>
            <p className="text-xs text-stone-400 mt-1 text-right">
              مثال: الفكة والعملات النقدية المتواجدة في الصندوق لبدء يوم البيع وإرجاع الباقي للعملاء.
            </p>
          </div>

          {/* Notes (Optional) */}
          <div>
            <label className="block text-sm font-bold text-stone-700 mb-1.5 text-right">
              ملاحظات الفتح (اختياري)
            </label>
            <textarea
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="أدخل أي ملاحظات حول عهدة الدرج أو حالة الجهاز..."
              className="w-full border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32] text-sm text-right p-3"
            />
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-stone-300 text-white py-4 rounded-xl font-bold text-base transition-all shadow-md flex items-center justify-center gap-2"
          >
            <Play className="w-5 h-5" />
            <span>{loading ? "جاري فتح الوردية وتجهيز الصندوق..." : "▶ فتح الوردية وبدء البيع"}</span>
          </button>
        </form>

        {/* Footer Bar */}
        <div className="bg-stone-50 px-6 py-4 border-t border-stone-100 text-center">
          <p className="text-xs text-stone-500 font-medium">تأكد من صحة البيانات قبل فتح الوردية</p>
        </div>
      </div>
    </div>
  );
}
