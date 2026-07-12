import React, { useEffect, useState, useRef } from "react";
import { ArrowLeft, Clock, Check, Play, PlayCircle, AlertCircle, Volume2, Timer } from "lucide-react";
import { Order, OrderItem } from "../../types";

interface KitchenDashboardProps {
  onBack: () => void;
}

export default function KitchenDashboard({ onBack }: KitchenDashboardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [error, setError] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [audioEnabled, setAudioEnabled] = useState<boolean>(false);
  
  // Timer state for ticking elapsed times
  const [now, setNow] = useState<number>(Date.now());
  const eventSourceRef = useRef<EventSource | null>(null);

  // Play a synthesized kitchen notification beep
  const playAlertSound = () => {
    if (!audioEnabled) return;
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      // Beep 1
      const osc1 = audioCtx.createOscillator();
      const gain1 = audioCtx.createGain();
      osc1.type = "sine";
      osc1.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
      gain1.gain.setValueAtTime(0.15, audioCtx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.15);
      osc1.connect(gain1);
      gain1.connect(audioCtx.destination);
      osc1.start();
      osc1.stop(audioCtx.currentTime + 0.15);

      // Beep 2 (double beep for kitchen alert)
      setTimeout(() => {
        const osc2 = audioCtx.createOscillator();
        const gain2 = audioCtx.createGain();
        osc2.type = "sine";
        osc2.frequency.setValueAtTime(1046.5, audioCtx.currentTime); // C6 note
        gain2.gain.setValueAtTime(0.15, audioCtx.currentTime);
        gain2.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);
        osc2.connect(gain2);
        gain2.connect(audioCtx.destination);
        osc2.start();
        osc2.stop(audioCtx.currentTime + 0.2);
      }, 150);

    } catch (e) {
      console.warn("Audio context not allowed or failed:", e);
    }
  };

  const fetchActiveKitchenOrders = async () => {
    try {
      const res = await fetch("/api/orders");
      if (res.ok) {
        const allOrders: Order[] = await res.json();
        // Filter only orders that have items in kitchen states ('pending', 'preparing', 'ready')
        const active = allOrders.filter(o => 
          o.status === "completed" && // only completed/synced cash register orders
          (o.items || []).some(item => 
            !item.status || item.status === "pending" || item.status === "preparing" || item.status === "ready"
          )
        );
        setOrders(active);
      }
    } catch (err) {
      console.error(err);
      setError("فشل تحميل الطلبات النشطة");
    }
  };

  // SSE Stream setup
  useEffect(() => {
    fetchActiveKitchenOrders();

    const connectSSE = () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }

      const es = new EventSource("/api/orders/stream");
      eventSourceRef.current = es;

      es.onopen = () => {
        setIsConnected(true);
        setError("");
      };

      es.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          
          if (payload.type === "connected") return;
          
          // Trigger fetch and audio play on any new order broadcast
          fetchActiveKitchenOrders();
          playAlertSound();
        } catch (e) {
          console.error("SSE parse error", e);
        }
      };

      es.onerror = () => {
        setIsConnected(false);
        setError("انقطع الاتصال المباشر. جاري التحديث بالـ Polling...");
        es.close();
        // Fallback polling
        const timer = setTimeout(connectSSE, 5000);
        return () => clearTimeout(timer);
      };
    };

    connectSSE();

    // Elapsed timer ticking
    const elapsedTimer = setInterval(() => {
      setNow(Date.now());
    }, 10000);

    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
      clearInterval(elapsedTimer);
    };
  }, [audioEnabled]);

  // Fallback Polling if connection goes offline
  useEffect(() => {
    if (!isConnected) {
      const interval = setInterval(fetchActiveKitchenOrders, 5000);
      return () => clearInterval(interval);
    }
  }, [isConnected]);

  // Update item status handler
  const handleUpdateItemStatus = async (orderId: string, itemId: string, newStatus: "pending" | "preparing" | "ready" | "delivered") => {
    try {
      const res = await fetch(`/api/orders/${orderId}/items/${itemId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus })
      });

      if (res.ok) {
        fetchActiveKitchenOrders();
      } else {
        alert("فشل تحديث حالة الصنف");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper: group orders into stages for kitchen staff
  const pendingOrders = orders.filter(o => 
    (o.items || []).some(i => !i.status || i.status === "pending")
  );
  const preparingOrders = orders.filter(o => 
    (o.items || []).every(i => i.status === "preparing") || 
    ((o.items || []).some(i => i.status === "preparing") && !(o.items || []).some(i => !i.status || i.status === "pending"))
  );
  const readyOrders = orders.filter(o => 
    (o.items || []).some(i => i.status === "ready") && 
    !(o.items || []).some(i => !i.status || i.status === "pending" || i.status === "preparing")
  );

  const getElapsedTime = (createdAtStr: string) => {
    const elapsedMs = now - new Date(createdAtStr).getTime();
    const minutes = Math.floor(elapsedMs / 60000);
    return `${minutes} دقيقة`;
  };

  return (
    <div className="min-h-screen bg-stone-900 text-stone-100 flex flex-col font-sans select-none" style={{ fontFamily: "Cairo, sans-serif" }} dir="rtl">
      {/* Header */}
      <header className="bg-stone-800 border-b border-stone-700 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2 hover:bg-stone-700 rounded-xl transition-all text-stone-300"
            title="الرجوع لشاشة الدخول"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <span>شاشة المطبخ الذكية (KDS)</span>
              <span className={`w-2.5 h-2.5 rounded-full inline-block ${isConnected ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
            </h1>
            <p className="text-[10px] text-stone-400 font-medium">نظام المراقبة وتغيير الحالات الفوري للمطبخ</p>
          </div>
        </div>

        {/* Audio controls & Status message */}
        <div className="flex items-center gap-4">
          {error && (
            <span className="bg-amber-900/40 text-amber-300 border border-amber-800 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4" />
              <span>{error}</span>
            </span>
          )}

          <button
            onClick={() => {
              setAudioEnabled(!audioEnabled);
              // Trigger a test sound on enable to prompt permissions
              if (!audioEnabled) {
                setTimeout(playAlertSound, 100);
              }
            }}
            className={`py-2 px-4 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 ${
              audioEnabled 
                ? "bg-green-600/20 border-green-500/40 text-green-400 hover:bg-green-600/30" 
                : "bg-stone-700/50 border-stone-600 text-stone-300 hover:bg-stone-700"
            }`}
          >
            <Volume2 className="w-4 h-4" />
            <span>{audioEnabled ? "صوت التنبيه: مفعّل 🔊" : "صوت التنبيه: صامت 🔇"}</span>
          </button>
        </div>
      </header>

      {/* Grid columns of cooking stages */}
      <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-3 divide-x divide-x-reverse divide-stone-800">
        
        {/* Stage 1: New / Pending Orders */}
        <div className="flex flex-col h-full overflow-hidden bg-stone-900/30">
          <div className="p-4 bg-stone-850 border-b border-stone-800 flex justify-between items-center shrink-0">
            <span className="bg-red-950/40 text-red-400 border border-red-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {pendingOrders.length} طلبات
            </span>
            <h3 className="font-extrabold text-white text-sm">طلبات معلقة / جديدة 📥</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {pendingOrders.map(order => (
              <div key={order.id} className="bg-stone-800 border-2 border-stone-700 rounded-2xl p-4.5 space-y-3.5 shadow-md">
                <div className="flex justify-between items-start border-b border-stone-700 pb-2.5">
                  <div>
                    <h4 className="font-extrabold text-white text-sm">طلب #{order.orderNumber}</h4>
                    <span className="text-[10px] text-stone-400 font-bold bg-stone-700/40 px-2 py-0.5 rounded-full mt-1 inline-block">
                      {order.orderType === "dine_in" ? "صالة 🍽️" : order.orderType === "takeaway" ? "سفري 🛍️" : "توصيل 🚗"}
                      {order.tableId ? ` - طاولة ${order.tableId}` : ""}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    <span>منذ {getElapsedTime(order.createdAt)}</span>
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2.5">
                  {(order.items || []).map(item => {
                    const isItemPending = !item.status || item.status === "pending";
                    return (
                      <div key={item.id} className="flex justify-between items-center bg-stone-900/30 p-2.5 rounded-xl border border-stone-750">
                        <div className="text-right">
                          <p className={`font-bold text-xs ${!isItemPending ? "line-through text-stone-500 font-medium" : "text-stone-200"}`}>
                            {item.productNameSnapshot} <span className="text-[#2E7D32] font-extrabold font-mono">x{item.quantity}</span>
                          </p>
                          {item.notes && <p className="text-[9px] text-amber-500 font-medium mt-0.5">⚠️ {item.notes}</p>}
                        </div>

                        {/* Status switcher button */}
                        {isItemPending ? (
                          <button
                            onClick={() => handleUpdateItemStatus(order.id, item.id, "preparing")}
                            className="px-2.5 py-1 bg-amber-600 hover:bg-amber-500 text-white rounded-lg text-[10px] font-bold transition-all"
                          >
                            تجهيز 🍳
                          </button>
                        ) : (
                          <span className="text-[9px] font-bold text-stone-500 bg-stone-700/20 px-2 py-0.5 rounded">
                            {item.status === "preparing" ? "جاري التحضير" : "جاهز للتسليم"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {pendingOrders.length === 0 && (
              <div className="text-center py-20 text-stone-500 text-xs font-semibold">
                لا توجد طلبات جديدة معلقة حالياً.
              </div>
            )}
          </div>
        </div>

        {/* Stage 2: Preparing / cooking */}
        <div className="flex flex-col h-full overflow-hidden bg-stone-900/10">
          <div className="p-4 bg-stone-850 border-b border-stone-800 flex justify-between items-center shrink-0">
            <span className="bg-amber-950/40 text-amber-400 border border-amber-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {preparingOrders.length} طلبات
            </span>
            <h3 className="font-extrabold text-white text-sm">جاري التحضير والطهي 🍳</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {preparingOrders.map(order => (
              <div key={order.id} className="bg-stone-800 border-2 border-amber-500/30 rounded-2xl p-4.5 space-y-3.5 shadow-md">
                <div className="flex justify-between items-start border-b border-stone-700 pb-2.5">
                  <div>
                    <h4 className="font-extrabold text-white text-sm">طلب #{order.orderNumber}</h4>
                    <span className="text-[10px] text-stone-400 font-bold bg-stone-700/40 px-2 py-0.5 rounded-full mt-1 inline-block">
                      {order.orderType === "dine_in" ? "صالة 🍽️" : order.orderType === "takeaway" ? "سفري 🛍️" : "توصيل 🚗"}
                      {order.tableId ? ` - طاولة ${order.tableId}` : ""}
                    </span>
                  </div>
                  <span className="text-[10px] text-amber-400 font-mono font-bold flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 animate-pulse" />
                    <span>منذ {getElapsedTime(order.createdAt)}</span>
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2.5">
                  {(order.items || []).map(item => {
                    const isItemPreparing = item.status === "preparing";
                    return (
                      <div key={item.id} className="flex justify-between items-center bg-stone-900/30 p-2.5 rounded-xl border border-stone-750">
                        <div className="text-right">
                          <p className={`font-bold text-xs ${item.status === "ready" ? "line-through text-stone-500 font-medium" : "text-stone-200"}`}>
                            {item.productNameSnapshot} <span className="text-[#2E7D32] font-extrabold font-mono">x{item.quantity}</span>
                          </p>
                          {item.notes && <p className="text-[9px] text-amber-500 font-medium mt-0.5">⚠️ {item.notes}</p>}
                        </div>

                        {/* Status switcher button */}
                        {isItemPreparing ? (
                          <button
                            onClick={() => handleUpdateItemStatus(order.id, item.id, "ready")}
                            className="px-2.5 py-1 bg-green-700 hover:bg-green-600 text-white rounded-lg text-[10px] font-bold transition-all"
                          >
                            جاهز 🔔
                          </button>
                        ) : (
                          <span className="text-[9px] font-bold text-stone-500 bg-stone-700/20 px-2 py-0.5 rounded">
                            {item.status === "ready" ? "جاهز للتسليم" : "انتظار"}
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            {preparingOrders.length === 0 && (
              <div className="text-center py-20 text-stone-500 text-xs font-semibold">
                لا توجد أطباق قيد الطهي والتجهيز حالياً.
              </div>
            )}
          </div>
        </div>

        {/* Stage 3: Ready for pickup / delivery */}
        <div className="flex flex-col h-full overflow-hidden bg-stone-900/30">
          <div className="p-4 bg-stone-850 border-b border-stone-800 flex justify-between items-center shrink-0">
            <span className="bg-green-950/40 text-green-400 border border-green-900/30 px-2 py-0.5 rounded-full text-[10px] font-bold">
              {readyOrders.length} طلبات
            </span>
            <h3 className="font-extrabold text-white text-sm">جاهز للتسليم والكاشير 🔔</h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {readyOrders.map(order => (
              <div key={order.id} className="bg-stone-800 border-2 border-green-500/35 rounded-2xl p-4.5 space-y-3.5 shadow-md">
                <div className="flex justify-between items-start border-b border-stone-700 pb-2.5">
                  <div>
                    <h4 className="font-extrabold text-white text-sm">طلب #{order.orderNumber}</h4>
                    <span className="text-[10px] text-stone-400 font-bold bg-stone-700/40 px-2 py-0.5 rounded-full mt-1 inline-block">
                      {order.orderType === "dine_in" ? "صالة 🍽️" : order.orderType === "takeaway" ? "سفري 🛍️" : "توصيل 🚗"}
                      {order.tableId ? ` - طاولة ${order.tableId}` : ""}
                    </span>
                  </div>
                  <span className="text-[10px] text-green-400 font-mono font-bold flex items-center gap-1 bg-green-900/10 px-2 py-0.5 rounded">
                    جاهز تماماً 🎉
                  </span>
                </div>

                {/* Items */}
                <div className="space-y-2.5">
                  {(order.items || []).map(item => (
                    <div key={item.id} className="flex justify-between items-center bg-stone-900/30 p-2.5 rounded-xl border border-stone-750">
                      <div className="text-right">
                        <p className="font-bold text-xs text-stone-300">
                          {item.productNameSnapshot} <span className="text-[#2E7D32] font-extrabold font-mono">x{item.quantity}</span>
                        </p>
                      </div>

                      <button
                        onClick={() => handleUpdateItemStatus(order.id, item.id, "delivered")}
                        className="px-2.5 py-1 bg-stone-700 hover:bg-stone-600 text-stone-200 rounded-lg text-[10px] font-bold transition-all"
                      >
                        تسليم العميل ✓
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {readyOrders.length === 0 && (
              <div className="text-center py-20 text-stone-500 text-xs font-semibold">
                لا توجد طلبات جاهزة للتسليم بانتظار التحصيل/الندل.
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
