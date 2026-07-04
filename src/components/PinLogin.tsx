import React, { useState } from "react";
import { Lock, User, Key, CheckCircle, ShieldAlert } from "lucide-react";
import { User as UserType } from "../types";

interface PinLoginProps {
  onLoginSuccess: (user: UserType, token: string) => void;
}

export default function PinLogin({ onLoginSuccess }: PinLoginProps) {
  const [pin, setPin] = useState("");
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleKeyPress = (num: string) => {
    setError("");
    if (pin.length < 6) {
      setPin((prev) => prev + num);
    }
  };

  const handleClear = () => {
    setPin("");
    setError("");
  };

  const handleDelete = () => {
    setPin((prev) => prev.slice(0, -1));
  };

  const handlePinSubmit = async () => {
    if (pin.length < 4) {
      setError("الرجاء إدخال رمز PIN لا يقل عن 4 أرقام");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/pin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
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
  };

  const handleAdminSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      setError("الرجاء ملء كافة الحقول");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        onLoginSuccess(data.user, data.token);
      } else {
        setError(data.error || "فشل تسجيل دخول الأدمن");
      }
    } catch (err) {
      setError("حدث خطأ أثناء الاتصال بالخادم. يرجى المحاولة لاحقاً.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-stone-100 p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-stone-200 overflow-hidden">
        {/* Header Branding */}
        <div className="bg-[#2E7D32] text-white p-6 text-center">
          <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center mx-auto mb-3 border border-white/20">
            <Lock className="w-8 h-8 text-white" />
          </div>
          <h2 className="text-2xl font-bold">تسجيل الدخول للمحطة</h2>
          <p className="text-white/80 text-xs mt-1">نظام الكاشير الاحترافي المتكامل</p>
        </div>

        {/* Errors Alert */}
        {error && (
          <div className="m-4 p-3 bg-red-50 border-r-4 border-red-500 rounded-lg flex items-center gap-2 text-red-800 text-sm">
            <ShieldAlert className="w-5 h-5 shrink-0 text-red-600" />
            <span className="font-medium text-right flex-1">{error}</span>
          </div>
        )}

        {/* Toggle Mode Button */}
        <div className="px-6 pt-4 flex justify-center">
          <div className="flex bg-stone-100 p-1 rounded-xl w-full">
            <button
              onClick={() => {
                setIsAdminMode(false);
                setError("");
              }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                !isAdminMode ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600 hover:bg-stone-200/50"
              }`}
            >
              رمز الدخول السريع (PIN)
            </button>
            <button
              onClick={() => {
                setIsAdminMode(true);
                setError("");
              }}
              className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                isAdminMode ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600 hover:bg-stone-200/50"
              }`}
            >
              دخول الإدارة (أدمن)
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6">
          {!isAdminMode ? (
            /* PIN Mode Layout */
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
                أدخل كود PIN السريع المخصص لك (مثال: <code className="bg-stone-100 px-1 py-0.5 rounded font-mono font-bold text-stone-800">1234</code> للكاشير، أو <code className="bg-stone-100 px-1 py-0.5 rounded font-mono font-bold text-stone-800">0000</code> للأدمن)
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

              {/* Submit button for PIN mode */}
              <button
                onClick={handlePinSubmit}
                disabled={loading || pin.length < 4}
                className="mt-6 w-full max-w-[280px] bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-stone-300 disabled:text-stone-500 text-white py-4 rounded-xl font-bold text-base transition-all shadow-md flex items-center justify-center gap-2"
              >
                {loading ? "جاري التحقق..." : "تأكيد الدخول ⏎"}
              </button>
            </div>
          ) : (
            /* Admin Credentials Form */
            <form onSubmit={handleAdminSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1 text-right">
                  اسم المستخدم الإداري
                </label>
                <div className="relative">
                  <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: admin"
                    className="w-full pr-10 pl-3 py-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] text-sm text-right"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-stone-700 mb-1 text-right">
                  كلمة المرور الإدارية
                </label>
                <div className="relative">
                  <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="مثال: admin"
                    className="w-full pr-10 pl-3 py-3 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2E7D32] focus:border-[#2E7D32] text-sm text-right"
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-stone-300 text-white py-4 rounded-xl font-bold text-base transition-all shadow-md flex items-center justify-center gap-2"
                >
                  {loading ? "جاري التحقق..." : "تسجيل الدخول كمدير 🔑"}
                </button>
              </div>

              <div className="text-center pt-2">
                <p className="text-xs text-stone-400">
                  ملاحظة: البيانات الافتراضية للأدمن هي <code className="bg-stone-50 px-1 py-0.5 rounded font-mono font-bold text-stone-600">admin</code> كاسم مستخدم وكلمة مرور.
                </p>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
