import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from "react";
import SplashScreen from "./components/SplashScreen";
import PinLogin from "./components/PinLogin";
import OpenShift from "./components/OpenShift";
import CloseShift from "./components/CloseShift";
import PaymentModal from "./components/PaymentModal";
import HeldOrders from "./components/HeldOrders";
import AdminDashboard from "./components/AdminDashboard";
import SaleInvoice from "./components/SaleInvoice";
import SetupWizard from "./components/SetupWizard";
import KitchenDashboard from "./components/pos/KitchenDashboard";

import { User, Shift, HeldOrder, Order } from "./types";
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Layers, Database } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  public state: ErrorBoundaryState = {
    hasError: false,
    error: null
  };

  public static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an uncaught error:", error, errorInfo);
    fetch("/api/logs/error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: error.message,
        stack: error.stack,
        componentStack: errorInfo.componentStack
      })
    }).catch(err => console.error("Failed to send error to logger:", err));
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-stone-100 flex flex-col items-center justify-center p-6 text-center select-none" style={{ fontFamily: "Cairo, sans-serif" }}>
          <div className="bg-white p-8 rounded-3xl shadow-xl max-w-md w-full border border-stone-200">
            <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-8 h-8">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </div>
            <h1 className="text-xl font-bold text-stone-900 mb-2">حدث خطأ غير متوقع في الواجهة</h1>
            <p className="text-sm text-stone-500 mb-6 leading-relaxed font-semibold">
              لقد واجه البرنامج مشكلة تقنية مفاجئة. يرجى محاولة إعادة تحميل البرنامج أو التواصل مع الدعم الفني.
            </p>
            <div className="bg-stone-50 p-3 rounded-lg text-left text-xs font-mono text-stone-600 overflow-auto max-h-32 mb-6 border border-stone-200">
              {this.state.error?.message || "Unknown error"}
            </div>
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-[#2E7D32] hover:bg-[#1B5E20] text-white py-3 rounded-xl font-bold transition-all shadow-md shadow-green-700/20"
            >
              إعادة تحميل البرنامج 🔄
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function CashiApp() {
  // Navigation states
  const [activeScreen, setActiveScreen] = useState<"splash" | "setup" | "login" | "open_shift" | "sales" | "admin" | "kitchen">("splash");
  
  // إعدادات المنشأة
  const [settings, setSettings] = useState<any>(null);
  const [settingsChecked, setSettingsChecked] = useState<boolean>(false);

  // Auth & Shift states
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [activeShift, setActiveShift] = useState<Shift | null>(null);

  // Layout modals
  const [showHeldList, setShowHeldList] = useState<boolean>(false);
  const [showCloseShiftModal, setShowCloseShiftModal] = useState<boolean>(false);
  const [paymentParams, setPaymentParams] = useState<any | null>(null);
  const isOnline = true;
  const [heldCount, setHeldCount] = useState<number>(0);

  // فحص إعدادات المنشأة عند بدء التشغيل
  useEffect(() => {
    const checkSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          if (data && data.businessNameAr) {
            setSettings(data);
            setSettingsChecked(true);
          } else {
            setSettingsChecked(true);
          }
        } else {
          setSettingsChecked(true);
        }
      } catch (e) {
        // Offline — تحقق من الإعدادات المحلية
        const localSettings = localStorage.getItem("pos_settings");
        if (localSettings) {
          setSettings(JSON.parse(localSettings));
        }
        setSettingsChecked(true);
      }
    };
    checkSettings();
  }, []);

  // تنظيف وإلغاء طوابير الأوفلاين القديمة عند الإقلاع لضمان عدم تسريب فواتير سابقة
  useEffect(() => {
    try {
      localStorage.removeItem("pos_offline_orders");
    } catch {}

    const handleLogoutEvent = () => {
      handleLogout();
    };

    window.addEventListener("pos-logout", handleLogoutEvent);

    return () => {
      window.removeEventListener("pos-logout", handleLogoutEvent);
    };
  }, []);

  // Poll server and count held bills
  const fetchHeldCount = async () => {
    try {
      const res = await fetch("/api/orders/held");
      if (res.ok) {
        const data = await res.json();
        setHeldCount(data.length);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchHeldCount();
    }
  }, [currentUser, showHeldList]);



  // Check if cashier has an already open shift on successful login
  const checkActiveShiftAndRoute = async (user: User) => {
    try {
      const res = await fetch("/api/shifts/active");
      if (res.ok) {
        const activeShiftData = await res.json();
        if (activeShiftData) {
          setActiveShift(activeShiftData);
          setActiveScreen("sales");
        } else {
          setActiveScreen("open_shift");
        }
      } else {
        setActiveScreen("open_shift");
      }
    } catch (e) {
      setActiveScreen("open_shift");
    }
  };

  const handleLoginSuccess = (user: User, token: string) => {
    setCurrentUser(user);
    localStorage.setItem("pos_token", token);
    localStorage.setItem("pos_user", JSON.stringify(user));
    
    checkActiveShiftAndRoute(user);
  };

  const handleShiftOpened = (shift: Shift) => {
    setActiveShift(shift);
    setActiveScreen("sales");
  };

  const handleShiftClosed = () => {
    setActiveShift(null);
    setShowCloseShiftModal(false);
    setActiveScreen("login");
    localStorage.removeItem("pos_user");
    localStorage.removeItem("pos_token");
    setCurrentUser(null);
  };

  const handleLogout = () => {
    localStorage.removeItem("pos_user");
    localStorage.removeItem("pos_token");
    setCurrentUser(null);
    setActiveShift(null);
    setActiveScreen("login");
  };

  // معالج إكمال الإعداد الأول
  const handleSetupComplete = (newSettings: any) => {
    setSettings(newSettings);
    localStorage.setItem("pos_settings", JSON.stringify(newSettings));
    setActiveScreen("login");
  };

  // معالج انتهاء شاشة البداية
  const handleSplashComplete = () => {
    if (!settingsChecked) {
      // انتظر حتى يتم فحص الإعدادات
      const interval = setInterval(() => {
        // سيتم استدعاء useEffect عند تغيير settingsChecked
      }, 100);
      setTimeout(() => clearInterval(interval), 3000);
      return;
    }
    if (!settings) {
      setActiveScreen("setup");
    } else {
      setActiveScreen("login");
    }
  };

  // عندما يتم فحص الإعدادات بعد الـ splash
  useEffect(() => {
    if (settingsChecked && activeScreen === "splash") {
      // لا نفعل شيء — الـ splash سيتولى الأمر عند انتهائه
    }
  }, [settingsChecked]);

  // Restore Held order callback
  const handleRestoreHeldOrder = async (held: HeldOrder) => {
    const injectEvent = new CustomEvent("pos-restore-held", { detail: held });
    window.dispatchEvent(injectEvent);
    
    alert("تم استدعاء السلة المحفوظة وتجهيزها في طاولة الصندوق.");
    setShowHeldList(false);
    
    try {
      await fetch(`/api/orders/held/${held.id}`, { method: "DELETE" });
      fetchHeldCount();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="h-screen w-screen flex flex-col bg-stone-100 selection:bg-green-100 select-none overflow-hidden">

      {/* Screen Routing */}
      {activeScreen === "splash" && (
        <SplashScreen onComplete={() => {
          if (!settingsChecked) {
            // انتظر ثم تحقق
            setTimeout(() => {
              if (!settings) {
                setActiveScreen("setup");
              } else {
                setActiveScreen("login");
              }
            }, 500);
          } else if (!settings) {
            setActiveScreen("setup");
          } else {
            setActiveScreen("login");
          }
        }} />
      )}

      {activeScreen === "setup" && (
        <SetupWizard onSetupComplete={handleSetupComplete} />
      )}

      {activeScreen === "login" && (
        <PinLogin onLoginSuccess={handleLoginSuccess} onOpenKitchen={() => setActiveScreen("kitchen")} />
      )}

      {activeScreen === "kitchen" && (
        <KitchenDashboard onBack={() => setActiveScreen("login")} />
      )}

      {activeScreen === "open_shift" && currentUser && (
        <OpenShift
          user={currentUser}
          onShiftOpened={handleShiftOpened}
          onBackToLogin={handleLogout}
        />
      )}

      {activeScreen === "sales" && currentUser && activeShift && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <SaleInvoice
            shift={activeShift}
            onCloseShift={() => setShowCloseShiftModal(true)}
            onOpenAdmin={() => setActiveScreen("admin")}
            isOnline={isOnline}
            onOpenHeldList={() => setShowHeldList(true)}
            heldCount={heldCount}
            onTriggerPayment={(params) => setPaymentParams(params)}
          />

          {/* Suspended bills side panel */}
          {showHeldList && (
            <HeldOrders
              onRestore={handleRestoreHeldOrder}
              onClose={() => setShowHeldList(false)}
            />
          )}

          {/* Close Shift Modal layout */}
          {showCloseShiftModal && (
            <CloseShift
              shift={activeShift}
              onShiftClosed={handleShiftClosed}
              onCancel={() => setShowCloseShiftModal(false)}
            />
          )}

          {/* Checkout Payment processing Modal */}
          {paymentParams && (
            <PaymentModal
              {...paymentParams}
              shiftId={activeShift.id}
              cashierId={currentUser.id}
              cashierName={currentUser.fullName}
              isOnline={isOnline}
              onCancel={() => setPaymentParams(null)}
              onPaymentSuccess={() => {
                window.dispatchEvent(new Event("pos-clear-cart"));
                setPaymentParams(null);
                fetchHeldCount();
              }}
            />
          )}
        </div>
      )}

      {activeScreen === "admin" && currentUser && (
        <AdminDashboard
          currentUser={currentUser}
          onBack={() => setActiveScreen("sales")}
        />
      )}

    </div>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <CashiApp />
    </ErrorBoundary>
  );
}
