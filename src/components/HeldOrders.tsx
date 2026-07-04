import React, { useState, useEffect } from "react";
import { X, RefreshCw, Trash2, Calendar, ShoppingCart, UserCheck } from "lucide-react";
import { HeldOrder } from "../types";

interface HeldOrdersProps {
  onRestore: (held: HeldOrder) => void;
  onClose: () => void;
}

export default function HeldOrders({ onRestore, onClose }: HeldOrdersProps) {
  const [heldOrders, setHeldOrders] = useState<HeldOrder[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>("");

  const fetchHeldOrders = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/orders/held");
      if (response.ok) {
        const data = await response.json();
        setHeldOrders(data);
      } else {
        setError("فشل تحميل قائمة الفواتير المعلقة");
      }
    } catch (e) {
      setError("حدث خطأ في الاتصال بالخادم");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHeldOrders();
  }, []);

  const handleDeleteHeld = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid triggering restore on row click
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذه الفاتورة المعلقة؟")) return;

    try {
      const response = await fetch(`/api/orders/held/${id}`, {
        method: "DELETE",
      });
      if (response.ok) {
        setHeldOrders((prev) => prev.filter((ho) => ho.id !== id));
      } else {
        alert("فشل حذف الفاتورة المعلقة من النظام");
      }
    } catch (e) {
      alert("حدث خطأ أثناء الاتصال بالخادم لحذف الفاتورة");
    }
  };

  return (
    <div className="fixed inset-y-0 left-0 w-full max-w-md bg-white border-r border-stone-200 shadow-2xl z-40 flex flex-col animate-in slide-in-from-left duration-250">
      {/* Header */}
      <div className="bg-[#2E7D32] text-white p-5 flex items-center justify-between">
        <button
          onClick={fetchHeldOrders}
          disabled={loading}
          className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all"
          title="تحديث القائمة"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
        <h3 className="text-lg font-bold flex items-center gap-2">
          <ShoppingCart className="w-5 h-5" />
          الفواتير المعلقة (Held Orders)
        </h3>
        <button
          onClick={onClose}
          className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all"
        >
          <X className="w-6 h-6" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="p-3 bg-red-50 border-r-4 border-red-500 rounded-lg text-red-800 text-xs text-right font-medium">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-20 text-center space-y-3">
            <div className="w-8 h-8 border-3 border-green-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <p className="text-xs text-stone-500">جاري تحميل الفواتير...</p>
          </div>
        ) : heldOrders.length === 0 ? (
          <div className="py-20 text-center space-y-3">
            <ShoppingCart className="w-12 h-12 text-stone-300 mx-auto" />
            <p className="text-sm font-bold text-stone-500">لا توجد فواتير معلقة حالياً</p>
            <p className="text-xs text-stone-400 max-w-xs mx-auto">
              يمكنك تعليق أي فاتورة جارية بالضغط على زر "تعليق الفاتورة" للرجوع إليها لاحقاً وتوفير الوقت للعملاء الآخرين.
            </p>
          </div>
        ) : (
          heldOrders.map((held) => {
            const itemCount = held.cartSnapshot.items.reduce((sum, item) => sum + item.quantity, 0);
            const total = held.cartSnapshot.items.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
            
            return (
              <div
                key={held.id}
                onClick={() => onRestore(held)}
                className="bg-stone-50 hover:bg-[#EAF4EA] border border-stone-200 hover:border-green-300 rounded-xl p-4 transition-all shadow-sm cursor-pointer flex items-center justify-between text-right"
              >
                {/* Delete trigger */}
                <button
                  onClick={(e) => handleDeleteHeld(held.id, e)}
                  className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                  title="حذف الفاتورة المعلقة"
                >
                  <Trash2 className="w-5 h-5" />
                </button>

                {/* Details body */}
                <div className="space-y-1.5 flex-1 pl-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-extrabold text-stone-800 font-mono">
                      كود الفاتورة: #{held.id.split("-")[1] || held.id.substr(0, 6)}
                    </span>
                    <span className="text-xs font-bold text-stone-500 flex items-center gap-1 font-mono">
                      {new Date(held.createdAt).toLocaleTimeString("ar-EG", { hour: "2-digit", minute: "2-digit" })}
                      <Calendar className="w-3 h-3 text-stone-400" />
                    </span>
                  </div>
                  
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-stone-500">
                      عدد المنتجات: <strong className="text-stone-700">{itemCount} أصناف</strong>
                    </span>
                    <span className="font-extrabold text-[#2E7D32] font-mono text-sm">
                      {total.toFixed(2)} ر.س
                    </span>
                  </div>

                  {held.tableId && (
                    <div className="text-xs bg-green-50 border border-green-100 text-green-800 px-2.5 py-1 rounded-lg inline-block font-bold">
                      طاولة مخصصة: {held.tableId}
                    </div>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Footer bar */}
      <div className="bg-stone-50 border-t border-stone-100 p-4 text-center text-xs text-stone-500 font-medium">
        اضغط على أي فاتورة معلقة لاستدعائها في محطة البيع الحالية.
      </div>
    </div>
  );
}
