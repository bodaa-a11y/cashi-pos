import React from "react";
import { Trash2, Plus, Minus, ShoppingBag, Truck, ShoppingCart, Utensils, Tag, User } from "lucide-react";
import { Product, RestaurantTable, Customer } from "../../types";

interface CartPanelProps {
  cart: { product: Product; quantity: number; notes?: string }[];
  setCart: React.Dispatch<React.SetStateAction<any[]>>;
  totals: {
    subtotal: number;
    discountAmount: number;
    taxableAmount: number;
    taxAmount: number;
    grandTotal: number;
  };
  orderType: "dine_in" | "takeaway" | "delivery";
  setOrderType: (type: "dine_in" | "takeaway" | "delivery") => void;
  selectedTable: string;
  setSelectedTable: (id: string) => void;
  selectedWaiter: string;
  setSelectedWaiter: (id: string) => void;
  selectedCustomer: Customer | null;
  setSelectedCustomer: (cust: Customer | null) => void;
  appliedDiscount: { value: number; type: "fixed" | "percent"; reason: string };
  setAppliedDiscount: (disc: any) => void;
  updateQuantity: (index: number, change: number) => void;
  removeFromCart: (index: number) => void;
  handleOpenDiscountModal: () => void;
  handleHoldOrder: () => void;
  handleCheckout: () => void;
  tables: RestaurantTable[];
  customers: Customer[];
  setSelectedCategory: (cat: string) => void;
}

export default function CartPanel({
  cart,
  setCart,
  totals,
  orderType,
  setOrderType,
  selectedTable,
  setSelectedTable,
  selectedWaiter,
  setSelectedWaiter,
  selectedCustomer,
  setSelectedCustomer,
  appliedDiscount,
  setAppliedDiscount,
  updateQuantity,
  removeFromCart,
  handleOpenDiscountModal,
  handleHoldOrder,
  handleCheckout,
  tables,
  customers,
  setSelectedCategory
}: CartPanelProps) {
  return (
    <div className="w-full lg:w-[420px] bg-white border-l border-stone-200 flex flex-col shrink-0">
      {/* ORDER TYPE SELECTOR */}
      <div className="p-3 border-b border-stone-200 grid grid-cols-3 gap-2 shrink-0">
        <button
          onClick={() => setOrderType("dine_in")}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
            orderType === "dine_in"
              ? "bg-[#EAF4EA] text-[#2E7D32] border border-[#2E7D32]"
              : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>محلي (طاولة)</span>
        </button>

        <button
          onClick={() => setOrderType("takeaway")}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
            orderType === "takeaway"
              ? "bg-[#EAF4EA] text-[#2E7D32] border border-[#2E7D32]"
              : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <ShoppingBag className="w-4 h-4" />
          <span>سفري (استلام)</span>
        </button>

        <button
          onClick={() => setOrderType("delivery")}
          className={`py-2 rounded-xl text-xs font-bold transition-all flex flex-col items-center justify-center gap-1.5 ${
            orderType === "delivery"
              ? "bg-[#EAF4EA] text-[#2E7D32] border border-[#2E7D32]"
              : "bg-stone-50 text-stone-600 hover:bg-stone-100 border border-stone-200"
          }`}
        >
          <Truck className="w-4 h-4" />
          <span>توصيل خارجي</span>
        </button>
      </div>

      {/* ADDITIONAL METADATA ACCORDING TO TYPE */}
      {orderType === "dine_in" && (
        <div className="p-3 bg-stone-50 border-b border-stone-200 grid grid-cols-2 gap-2 shrink-0">
          <div>
            <label className="block text-[9px] font-bold text-stone-500 mb-1 text-right">رقم / كود الطاولة *</label>
            <select
              value={selectedTable}
              onChange={(e) => setSelectedTable(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-right focus:outline-none"
            >
              <option value="">تحديد الطاولة...</option>
              {tables.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.status === "occupied" ? "مشغولة" : "شبه فارغة"})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-stone-500 mb-1 text-right">اسم النادل / المضيف</label>
            <select
              value={selectedWaiter}
              onChange={(e) => setSelectedWaiter(e.target.value)}
              className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-right focus:outline-none"
            >
              <option value="">تحديد النادل...</option>
              <option value="w-1">نادل 1</option>
              <option value="w-2">نادل 2</option>
            </select>
          </div>
        </div>
      )}

      {orderType === "delivery" && (
        <div className="p-3 bg-stone-50 border-b border-stone-200 grid grid-cols-2 gap-2 shrink-0">
          <div>
            <label className="block text-[9px] font-bold text-stone-500 mb-1 text-right">شركة/تطبيق التوصيل</label>
            <select
              defaultValue="هنقرستيشن"
              className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-right focus:outline-none"
            >
              <option value="هنقرستيشن">هنقرستيشن</option>
              <option value="جاهز">جاهز</option>
              <option value="تويو">تويو</option>
              <option value="شخصي">سائق خاص</option>
            </select>
          </div>
          <div>
            <label className="block text-[9px] font-bold text-stone-500 mb-1 text-right">اختر عميل التوصيل</label>
            <select
              value={selectedCustomer ? selectedCustomer.id : ""}
              onChange={(e) => {
                const found = customers.find((c) => c.id === e.target.value);
                setSelectedCustomer(found || null);
              }}
              className="w-full bg-white border border-stone-200 rounded-lg p-1.5 text-xs text-right focus:outline-none"
            >
              <option value="">تحديد العميل...</option>
              {customers.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.fullName} - {c.phone}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

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
              onClick={() => setSelectedCategory("all")}
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
                  <span>خصم مالي:</span>
                  <span className="text-[9px] bg-red-50 px-1 py-0.5 rounded border border-red-100">{appliedDiscount.reason}</span>
                </div>
                <span className="font-mono">-{totals.discountAmount.toFixed(2)} ر.س</span>
              </div>
            )}

            <div className="flex justify-between text-stone-500">
              <span>الضريبة المضافة (15%):</span>
              <span className="font-mono">{totals.taxAmount.toFixed(2)} ر.س</span>
            </div>

            <div className="border-t border-stone-200 pt-2 flex justify-between items-center text-[#2E7D32]">
              <span className="font-black text-sm">الإجمالي النهائي المطلوب:</span>
              <span className="font-mono font-black text-xl">{totals.grandTotal.toFixed(2)} ر.س</span>
            </div>
          </div>
        )}

        {/* BUTTON ACTION GROUPS */}
        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={handleOpenDiscountModal}
            disabled={cart.length === 0}
            className="w-full py-2.5 border border-stone-200 rounded-xl hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs text-stone-700 flex items-center justify-center gap-1.5 transition-all"
          >
            <Tag className="w-4 h-4 text-red-600" />
            <span>تطبيق خصم</span>
          </button>
          
          <button
            onClick={handleHoldOrder}
            disabled={cart.length === 0}
            className="w-full py-2.5 border border-stone-200 rounded-xl hover:bg-stone-50 disabled:opacity-50 disabled:cursor-not-allowed font-bold text-xs text-stone-700 flex items-center justify-center gap-1.5 transition-all"
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>تعليق الفاتورة</span>
          </button>
        </div>

        <button
          onClick={handleCheckout}
          disabled={cart.length === 0}
          className="w-full py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] disabled:bg-stone-300 disabled:cursor-not-allowed text-white rounded-2xl font-black text-sm shadow-md hover:shadow flex items-center justify-center gap-2 transition-all"
        >
          <ShoppingCart className="w-5 h-5" />
          <span>تأكيد وطباعة الفاتورة (دفع)</span>
        </button>
      </div>
    </div>
  );
}
