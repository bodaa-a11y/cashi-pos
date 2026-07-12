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
  
  // Connection states (Offline-First criteria)
  const [isOnline, setIsOnline] = useState<boolean>(navigator.onLine);
  const [offlineOrders, setOfflineOrders] = useState<any[]>([]);
  const [syncing, setSyncing] = useState<boolean>(false);
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

  // Detect internet connection changes
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      triggerSyncRoutine();
    };
    const handleOffline = () => {
      setIsOnline(false);
    };

    const handleLogoutEvent = () => {
      handleLogout();
    };

    const handleOfflineOrderAdded = (e: Event) => {
      const customEvent = e as CustomEvent;
      const newOrder = customEvent.detail;
      setOfflineOrders(prev => {
        const updated = [...prev, newOrder];
        localStorage.setItem("pos_offline_orders", JSON.stringify(updated));
        return updated;
      });
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("pos-logout", handleLogoutEvent);
    window.addEventListener("pos-offline-order-added", handleOfflineOrderAdded);

    setIsOnline(navigator.onLine);

    const stored = localStorage.getItem("pos_offline_orders");
    if (stored) {
      setOfflineOrders(JSON.parse(stored));
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("pos-logout", handleLogoutEvent);
      window.removeEventListener("pos-offline-order-added", handleOfflineOrderAdded);
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

  // Safety net background polling sync queue (every 30 seconds)
  useEffect(() => {
    const pollInterval = setInterval(() => {
      if (navigator.onLine) {
        setIsOnline(true);
        triggerSyncRoutine();
      } else {
        setIsOnline(false);
      }
    }, 30000);

    return () => clearInterval(pollInterval);
  }, [offlineOrders]);

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

  // Sync Offline Queue Routine
  const triggerSyncRoutine = async () => {
    if (offlineOrders.length === 0 || syncing || !navigator.onLine) return;
    setSyncing(true);

    const queue = [...offlineOrders];
    const remainingQueue: any[] = [];

    for (const order of queue) {
      try {
        const res = await fetch("/api/orders/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(order)
        });

        if (!res.ok) {
          remainingQueue.push(order);
        }
      } catch (e) {
        remainingQueue.push(order);
      }
    }

    setOfflineOrders(remainingQueue);
    localStorage.setItem("pos_offline_orders", JSON.stringify(remainingQueue));
    setSyncing(false);

    if (remainingQueue.length === 0 && queue.length > 0) {
      alert("تمت مزامنة كافة الفواتير المخزنة محلياً بنجاح مع الخادم المركزي! 🎉");
    }
  };

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
    <div className="min-h-screen flex flex-col bg-stone-100 selection:bg-green-100 select-none">
      
      {/* Top Banner indicating unsynced offline queue */}
      {offlineOrders.length > 0 && (
        <div className="bg-orange-500 text-white px-4 py-2 text-center text-xs font-bold flex items-center justify-center gap-3 shrink-0">
          <AlertTriangle className="w-4 h-4 shrink-0 animate-bounce" />
          <span>
            تنبيه: يوجد عدد ({offlineOrders.length}) فواتير تم بيعها أوفلاين معلقة بانتظار المزامنة.
          </span>
          <button
            onClick={triggerSyncRoutine}
            disabled={syncing || !isOnline}
            className="bg-white text-orange-700 px-3 py-1 rounded-md hover:bg-stone-50 transition-all font-extrabold flex items-center gap-1 disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${syncing ? "animate-spin" : ""}`} />
            <span>مزامنة الآن</span>
          </button>
        </div>
      )}

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
