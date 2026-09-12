import React, { useState, useEffect, useCallback } from "react";
import { Lock, ShieldAlert } from "lucide-react";
import { User as UserType } from "../types";

interface PinLoginProps {
  onLoginSuccess: (user: UserType, token: string) => void;
  onOpenKitchen?: () => void;
}

/**
 * شاشة دخول موحّدة — باسورد واحد (PIN) لجميع المستخدمين.
 * - الكاشير يدخل بـ PIN الخاص به
 * - الأدمن/المدير يدخل بـ PIN الخاص به (الافتراضي 0000) ويفتح له صلاحياته تلقائياً
 * - يدعم كيبورد الجهاز الفعلي (أرقام + Enter + Backspace + Escape)
 */
export default function PinLogin({ onLoginSuccess, onOpenKitchen }: PinLoginProps) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleKeyPress = useCallback((num: string) => {
    setError("");
    setPin((prev) => (prev.length < 6 ? prev + num : prev));
  }, []);

  const handleClear = useCallback(() => {
    setPin("");
    setError("");
  }, []);

  const handleDelete = useCallback(() => {
    setPin((prev) => prev.slice(0, -1));
  }, []);

  const handlePinSubmit = useCallback(async (code: string) => {
    if (code.length < 4 || loading) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: code }),
      });
      const data = await response.json();
      if (response.ok && data.success) {
        onLoginSuccess(data.user, data.token);
      } else {
        setError(data.error || "رمز PIN غير صحيح");
        setPin("");
      }
    } catch (err) {
      setError("حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  }, [loading, onLoginSuccess]);

  // ═══ دعم الكيبورد الفعلي للجهاز ═══
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key >= "0" && e.key <= "9") {
        handleKeyPress(e.key);
      } else if (e.key === "Backspace") {
        e.preventDefault();
        handleDelete();
      } else if (e.key === "Enter") {
        e.preventDefault();
        setPin((current) => {
          if (current.length >= 4) handlePinSubmit(current);
          return current;
        });
      } else if (e.key === "Escape") {
        handleClear();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [handleKeyPress, handleDelete, handleClear, handlePinSubmit]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
        {/* Header Branding */}
        <div className="bg-[#2E7D32] text-white p-6 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/20">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">تسجيل الدخول للمحطة</h2>
          <p className="text-white/80 text-xs mt-1">أدخل رمز PIN الخاص بك — الكاشير والمدير بنفس الشاشة</p>
        </div>

        {/* Errors Alert */}
        {error && (
          <div className="m-4 p-3 bg-red-50 border-r-4 border-red-500 rounded-lg flex items-center gap-2 text-red-800 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
            <span className="font-medium text-right flex-1">{error}</span>
          </div>
        )}

        {/* Kitchen shortcut */}
        {onOpenKitchen && (
          <div className="px-6 pt-4">
            <button
              type="button"
              onClick={onOpenKitchen}
              className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5"
            >
              📺 الانتقال لشاشة المطبخ (KDS)
            </button>
          </div>
        )}

        {/* Content Area */}
        <div className="p-6">
          <div className="flex flex-col items-center">
            {/* PIN display indicators */}
            <div className="flex gap-3 mb-6 justify-center" dir="ltr">
              {[...Array(6)].map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-full border-2 transition-all duration-150 ${
                    i < pin.length
                      ? "bg-[#2E7D32] border-[#2E7D32] scale-110"
                      : "border-stone-300 bg-stone-50"
                  }`}
                />
              ))}
            </div>

            {/* Guide prompt */}
            <p className="text-xs text-stone-500 mb-6 text-center">
              اكتب رمزك من الكيبورد أو استخدم الأزرار — Enter للتأكيد وBackspace للمسح
            </p>

            {/* Standard tactile PIN keypad */}
            <div className="grid grid-cols-3 gap-3 w-full max-w-[280px]">
              {["1", "2", "3", "4", "5", "6", "7", "8", "9"].map((num) => (
                <button
                  key={num}
                  onClick={() => handleKeyPress(num)}
                  className="keypad-button h-16 w-full rounded-xl bg-stone-50 border border-stone-200 hover:bg-stone-100 text-stone-800 font-bold text-2xl flex items-center justify-center transition-all shadow-sm active:bg-stone-200 focus:outline-none"
                >
                  {num}
                </button>
              ))}
              <button
                onClick={handleClear}
                className="keypad-button h-16 w-full rounded-xl bg-red-50 border border-red-100 text-red-600 hover:bg-red-100 font-bold text-sm flex items-center justify-center transition-all shadow-sm active:bg-red-200 focus:outline-none"
              >
                مسح
              </button>
              <button
                onClick={() => handleKeyPress("0")}
                className="keypad-button h-16 w-full rounded-xl bg-stone-50 border border-stone-200 hover:bg-stone-100 text-stone-800 font-bold text-2xl flex items-center justify-center transition-all shadow-sm active:bg-stone-200 focus:outline-none"
              >
                0
              </button>
              <button
                onClick={handleDelete}
                className="keypad-button h-16 w-full rounded-xl bg-stone-100 border border-stone-200 text-stone-600 hover:bg-stone-200 font-bold text-lg flex items-center justify-center transition-all shadow-sm active:bg-stone-300 focus:outline-none"
              >
                ⌫
              </button>
            </div>

            {/* Submit button */}
            <button
              onClick={() => handlePinSubmit(pin)}
              disabled={loading || pin.length < 4}
              className="mt-6 w-full max-w-[280px] bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-stone-300 disabled:text-stone-500 text-white py-4 rounded-xl font-bold text-base transition-all shadow-md flex items-center justify-center gap-2"
            >
              {loading ? "جاري التحقق..." : "تأكيد الدخول ⏎"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
