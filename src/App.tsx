import { useState, useEffect } from "react";
import SplashScreen from "./components/SplashScreen";
import PinLogin from "./components/PinLogin";
import OpenShift from "./components/OpenShift";
import CloseShift from "./components/CloseShift";
import PaymentModal from "./components/PaymentModal";
import HeldOrders from "./components/HeldOrders";
import AdminDashboard from "./components/AdminDashboard";
import SaleInvoice from "./components/SaleInvoice";
import SetupWizard from "./components/SetupWizard";

import { User, Shift, HeldOrder, Order } from "./types";
import { Wifi, WifiOff, AlertTriangle, RefreshCw, Layers, Database } from "lucide-react";

export default function App() {
  // Navigation states
  const [activeScreen, setActiveScreen] = useState<"splash" | "setup" | "login" | "open_shift" | "sales" | "admin">("splash");
  
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

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    setIsOnline(navigator.onLine);

    const stored = localStorage.getItem("pos_offline_orders");
    if (stored) {
      setOfflineOrders(JSON.parse(stored));
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
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
        <PinLogin onLoginSuccess={handleLoginSuccess} />
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
