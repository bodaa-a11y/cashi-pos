import { useEffect, useState } from "react";
import { ShoppingBag, CheckCircle } from "lucide-react";

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showToast, setShowToast] = useState(false);

  useEffect(() => {
    // Show a success login toast at 1.5s
    const toastTimer = setTimeout(() => {
      setShowToast(true);
    }, 1500);

    // Complete splash screen at 3.5s
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 3500);

    return () => {
      clearTimeout(toastTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-[#1B5E20] to-[#2E7D32] text-white z-50 overflow-hidden">
      {/* Decorative floating shapes */}
      <div className="absolute top-10 left-10 w-32 h-32 bg-white/5 rounded-full blur-xl"></div>
      <div className="absolute bottom-10 right-10 w-48 h-48 bg-white/5 rounded-full blur-2xl"></div>

      <div className="flex flex-col items-center text-center space-y-6 max-w-md px-6">
        {/* Animated Icon */}
        <div className="relative flex items-center justify-center w-28 h-28 bg-white/10 rounded-full border border-white/20 shadow-2xl backdrop-blur-md">
          <ShoppingBag className="w-14 h-14 text-white" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-4 w-4 bg-green-500"></span>
          </span>
        </div>

        {/* Text */}
        <div className="space-y-2">
          <h1 className="text-5xl font-extrabold tracking-tight">كاشي</h1>
          <p className="text-white/70 text-lg font-bold mt-1">Cashi</p>
          <p className="text-white/50 text-xs font-mono tracking-widest uppercase mt-1">نظام نقطة البيع المتكامل</p>
        </div>

        {/* Loading Spinner */}
        <div className="flex flex-col items-center space-y-3 pt-6">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
          <span className="text-white/60 text-sm font-medium">جاري تهيئة النظام وتوصيل الطابعات...</span>
        </div>
      </div>

      {/* Elegant success login toast at the bottom */}
      {showToast && (
        <div className="fixed bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-3 bg-white text-green-950 px-6 py-4 rounded-xl shadow-2xl border border-green-100 z-50 animate-bounce">
          <CheckCircle className="w-6 h-6 text-green-600 shrink-0" />
          <div className="text-right">
            <p className="font-bold text-sm">كاشي جاهز للعمل</p>
            <p className="text-xs text-gray-500">تم تهيئة النظام بنجاح</p>
          </div>
        </div>
      )}
    </div>
  );
}
