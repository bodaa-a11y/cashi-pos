import React from "react";
import { ShoppingBag, Clock, UserPlus, Search, Trash2, Plus, Minus, Tag } from "lucide-react";
import { Product, RestaurantTable, Customer, Shift } from "../../types";

interface CheckoutColumnProps {
  isOnline: boolean;
  shift: Shift;
  onCloseShift: () => void;
  onOpenHeldList: () => void;
  heldCount: number;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  customers: Customer[];
  tables: RestaurantTable[];
  selectedCustomer: Customer | null;
  setSelectedCustomer: (cust: Customer | null) => void;
  setShowAddCustomerModal: (show: boolean) => void;
  cart: { product: Product; quantity: number; notes?: string }[];
  setCart: React.Dispatch<React.SetStateAction<any[]>>;
  totals: {
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    grandTotal: number;
  };
  appliedDiscount: { value: number; type: "fixed" | "percent"; reason: string };
  orderType: "dine_in" | "takeaway" | "delivery";
  setOrderType: (type: "dine_in" | "takeaway" | "delivery") => void;
  selectedTable: string;
  setSelectedTable: (id: string) => void;
  selectedWaiter: string;
  setSelectedWaiter: (id: string) => void;
  updateQuantity: (index: number, change: number) => void;
  removeFromCart: (index: number) => void;
  handleOpenDiscountModal: () => void;
  handleHoldOrder: () => void;
  handleProceedToPayment: () => void;
}

export default function CheckoutColumn({
  isOnline,
  shift,
  onCloseShift,
  onOpenHeldList,
  heldCount,
  searchQuery,
  setSearchQuery,
  customers,
  tables,
  selectedCustomer,
  setSelectedCustomer,
  setShowAddCustomerModal,
  cart,
  setCart,
  totals,
  appliedDiscount,
  orderType,
  setOrderType,
  selectedTable,
  setSelectedTable,
  selectedWaiter,
  setSelectedWaiter,
  updateQuantity,
  removeFromCart,
  handleOpenDiscountModal,
  handleHoldOrder,
  handleProceedToPayment
}: CheckoutColumnProps) {
  return (
    <aside className="w-full md:w-[32%] bg-white border-l border-stone-200 flex flex-col overflow-hidden shrink-0">
      
      {/* Header toolbar */}
      <div className="bg-[#2E7D32] text-white p-4 shrink-0 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`w-3.5 h-3.5 rounded-full ${isOnline ? "bg-green-400" : "bg-orange-400"} animate-pulse`}></span>
          <span className="text-[10px] font-bold">
            {isOnline ? "متصل بالخادم" : "أوفلاين - البيع محلي"}
          </span>
        </div>

        <h3 className="font-bold text-base flex items-center gap-1.5">
          <ShoppingBag className="w-5 h-5" />
          <span>فاتورة البيع الجارية</span>
        </h3>

        <button
          onClick={onCloseShift}
          className="text-xs bg-red-700/80 hover:bg-red-800 border border-red-600/50 px-2.5 py-1.5 rounded-lg transition-all font-bold flex items-center gap-1"
        >
          <Clock className="w-3.5 h-3.5" />
          <span>إقفال الوردية</span>
        </button>
      </div>

      {/* Client Selector Row */}
      <div className="p-3 border-b border-stone-100 bg-stone-50 flex items-center gap-2 shrink-0 text-right">
        <button
          onClick={() => setShowAddCustomerModal(true)}
          className="w-10 h-10 rounded-full bg-green-50 border border-green-200 text-[#2E7D32] hover:bg-green-100 flex items-center justify-center shrink-0 shadow-sm transition-all"
          title="إضافة عميل جديد"
        >
          <UserPlus className="w-5 h-5" />
        </button>

        <div className="flex-1 text-right">
          <select
            value={selectedCustomer ? selectedCustomer.id : ""}
            onChange={(e) => {
              const found = customers.find((c) => c.id === e.target.value);
              setSelectedCustomer(found || null);
            }}
            className="w-full bg-white border border-stone-200 rounded-xl px-3 py-2 text-xs font-bold text-stone-700 focus:outline-none"
          >
            <option value="">عميل نقدي عام (افتراضي)</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.fullName} ({c.phone})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Product Fast Search Input / Barcode Scanner */}
      <div className="p-3 border-b border-stone-100 shrink-0">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-stone-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث فورا بالاسم أو الباركود..."
            className="w-full pr-10 pl-3 py-2.5 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
          />
        </div>
      </div>

      {/* CART ROWS SCROLL AREA */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2.5 bg-stone-50/50">
        {cart.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-16 h-16 bg-stone-100 rounded-full flex items-center justify-center mx-auto text-stone-300">
              <ShoppingBag className="w-8 h-8" />
            </div>
            <p className="text-sm font-extrabold text-stone-500">السلة فارغة حالياً</p>
            <p className="text-xs text-stone-400 max-w-xs mx-auto">أضف منتجات من قائمة الأصناف المقابلة للبدء في إنشاء الفاتورة</p>
            <button
              onClick={() => setSearchQuery("")}
              className="text-[11px] font-bold text-[#2E7D32] bg-green-50 px-3 py-1.5 rounded-lg border border-green-200 hover:bg-green-100 transition-all"
            >
              اضغط على المنتجات لإضافتها 👆
            </button>
          </div>
        ) : (
          cart.map((item, index) => (
            <div
              key={`${item.product.id}-${index}`}
              className="bg-white border border-stone-200 rounded-xl p-3 shadow-sm hover:border-green-300 transition-all flex flex-col gap-2 text-right"
            >
              <div className="flex items-center justify-between">
                <button
                  onClick={() => removeFromCart(index)}
                  className="p-1.5 text-stone-300 hover:text-red-600 rounded-lg hover:bg-red-50 transition-all shrink-0 ml-1"
                  title="حذف الصنف"
                >
                  <Trash2 className="w-4 h-4" />
                </button>

                <div className="flex items-center gap-1 font-mono shrink-0 ml-4">
                  <button
                    onClick={() => updateQuantity(index, 1)}
                    className="w-7 h-7 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg flex items-center justify-center font-bold"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-8 text-center text-sm font-bold text-stone-800">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(index, -1)}
                    className="w-7 h-7 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg flex items-center justify-center font-bold"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                </div>

                <div className="flex-1 pr-2">
                  <h4 className="text-xs font-bold text-stone-800">{item.product.nameAr}</h4>
                  <div className="flex items-center justify-between mt-1 text-[10px]">
                    <span className="font-bold text-[#2E7D32] font-mono">{(item.product.price * item.quantity).toFixed(2)} ر.س</span>
                    <span className="text-stone-400 font-mono">سعر الحبة: {item.product.price.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-2 flex items-center gap-2">
                <span className="text-[10px] text-stone-400 shrink-0 font-bold">الملاحظة:</span>
                <input
                  type="text"
                  value={item.notes || ""}
                  onChange={(e) => {
                    const value = e.target.value;
                    setCart((prev) => {
                      const newCart = [...prev];
                      newCart[index] = { ...newCart[index], notes: value };
                      return newCart;
                    });
                  }}
                  placeholder="مثال: بدون بصل، زيادة ثوم، إلخ..."
                  className="flex-1 bg-stone-50 border border-stone-200 rounded-lg px-2 py-1 text-[11px] text-right text-stone-700 focus:outline-none focus:ring-1 focus:ring-[#2E7D32] focus:bg-white transition-all"
                />
              </div>
            </div>
          ))
        )}
      </div>

      {/* PRICING MATH BOX */}
      <div className="border-t border-stone-200 p-4 bg-stone-50 space-y-3 shrink-0">
        {cart.length === 0 ? (
          <p className="text-xs text-stone-400 text-center py-4 font-medium">
            ستظهر هنا تفاصيل الفاتورة بعد إضافة المنتجات
          </p>
        ) : (
          <div className="space-y-2 text-right text-xs">
            <div className="flex justify-between text-stone-500">
              <span>الإجمالي الفرعي:</span>
              <span className="font-mono">{totals.subtotal.toFixed(2)} ر.س</span>
            </div>

            {totals.discountAmount > 0 && (
              <div className="flex justify-between text-red-600 font-bold">
                <div className="flex items-center gap-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>الخصم {appliedDiscount.value > 0 ? `(${appliedDiscount.reason})` : ""}:</span>
                </div>
                <span className="font-bold font-mono">-{totals.discountAmount.toFixed(2)} ر.س</span>
              </div>
            )}

            {totals.taxAmount > 0 && (
              <div className="flex justify-between text-stone-500">
                <span>ضريبة القيمة المضافة (15%):</span>
                <span className="font-bold font-mono">{totals.taxAmount.toFixed(2)} ر.س</span>
              </div>
            )}

            <div className="flex justify-between text-lg font-extrabold text-stone-800 border-t border-stone-200 pt-2">
              <span>الإجمالي الكلي:</span>
              <span className="font-mono text-[#2E7D32]">{totals.grandTotal.toFixed(2)} ر.س</span>
            </div>
          </div>
        )}

        {/* Action row */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={handleHoldOrder}
            disabled={cart.length === 0}
            className="py-2.5 bg-amber-50 hover:bg-amber-100 disabled:opacity-40 text-amber-800 rounded-xl text-xs font-bold border border-amber-200 transition-all"
          >
            تعليق الفاتورة ⏸
          </button>
          <button
            onClick={handleProceedToPayment}
            disabled={cart.length === 0}
            className="py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:opacity-40 text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            تسوية ودفع ⏎
          </button>
        </div>

        {/* Held bills bar */}
        <button
          onClick={onOpenHeldList}
          className="w-full mt-2.5 py-1.5 bg-stone-200 hover:bg-stone-300 text-stone-700 text-[10px] font-bold rounded-lg flex items-center justify-center gap-1 border-0"
        >
          <span>الفواتير المعلقة والباركينج</span>
          <span className="bg-stone-600 text-white font-bold w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-mono">
            {heldCount}
          </span>
        </button>
      </div>

    </aside>
  );
}
