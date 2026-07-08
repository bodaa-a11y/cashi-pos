import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  UserPlus,
  RefreshCw,
  Heart,
  Grid,
  Truck,
  ShoppingBag,
  Utensils,
  ChevronDown,
  Layers,
  ArrowLeftRight,
  Split,
  Plus,
  Minus,
  Trash2,
  Tag,
  Clock,
  Wifi,
  WifiOff,
  User,
  Coffee,
  X,
  PlusCircle,
  HelpCircle,
  ShoppingCart
} from "lucide-react";
import { Product, Category, RestaurantTable, Shift, Customer, HeldOrder } from "../types";
import CheckoutColumn from "./pos/CheckoutColumn";

interface SaleInvoiceProps {
  shift: Shift;
  onCloseShift: () => void;
  onOpenAdmin: () => void;
  isOnline: boolean;
  onTriggerPayment: (params: {
    items: { product: Product; quantity: number; notes?: string }[];
    subtotal: number;
    discount: number;
    discountReason?: string;
    tax: number;
    total: number;
    orderType: "dine_in" | "takeaway" | "delivery";
    tableId?: string | null;
    waiterId?: string | null;
    customerId?: string | null;
  }) => void;
  onOpenHeldList: () => void;
  heldCount: number;
}

export default function SaleInvoice({
  shift,
  onCloseShift,
  onOpenAdmin,
  isOnline,
  onTriggerPayment,
  onOpenHeldList,
  heldCount
}: SaleInvoiceProps) {
  // POS States
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [orderType, setOrderType] = useState<"dine_in" | "takeaway" | "delivery">("dine_in");
  const [selectedDeliveryApp, setSelectedDeliveryApp] = useState<string>("هنقرستيشن");
  const [selectedTable, setSelectedTable] = useState<string>("");
  const [selectedWaiter, setSelectedWaiter] = useState<string>("");
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  
  // Table status filter
  const [tableStatusFilter, setTableStatusFilter] = useState<string>("all");

  // Favorites filter
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false);

  // Cart State
  const [cart, setCart] = useState<{ product: Product; quantity: number; notes?: string }[]>([]);

  // Modals state
  const [showAddCustomerModal, setShowAddCustomerModal] = useState(false);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerNotes, setNewCustomerNotes] = useState("");

  const [showDiscountModal, setShowDiscountModal] = useState(false);
  const [discountType, setDiscountType] = useState<"fixed" | "percent">("fixed");
  const [discountValue, setDiscountValue] = useState("");
  const [discountReason, setDiscountReason] = useState("");
  const [appliedDiscount, setAppliedDiscount] = useState({ value: 0, type: "fixed" as "fixed" | "percent", reason: "" });

  const [editingCartItemIndex, setEditingCartItemIndex] = useState<number | null>(null);
  const [itemNotesInput, setItemNotesInput] = useState("");

  const [loadingMenu, setLoadingMenu] = useState(false);

  // Load core categories and products
  const fetchMenuData = async () => {
    setLoadingMenu(true);
    try {
      const res = await fetch("/api/menu");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories);
        setProducts(data.products);
      }
      
      const resTables = await fetch("/api/tables");
      if (resTables.ok) {
        setTables(await resTables.json());
      }

      const resCust = await fetch("/api/customers");
      if (resCust.ok) {
        setCustomers(await resCust.json());
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingMenu(false);
    }
  };

  useEffect(() => {
    fetchMenuData();
  }, []);

  // Sync state trigger on mount
  useEffect(() => {
    // Clear cart if shift changes
    setCart([]);
    setAppliedDiscount({ value: 0, type: "fixed", reason: "" });
  }, [shift]);

  // Cart operations
  const handleAddToCart = (product: Product) => {
    setCart((prev) => {
      const index = prev.findIndex((item) => item.product.id === product.id);
      if (index !== -1) {
        const newCart = [...prev];
        newCart[index] = { ...newCart[index], quantity: newCart[index].quantity + 1 };
        return newCart;
      }
      return [...prev, { product, quantity: 1, notes: "" }];
    });
  };

  const handleUpdateQuantity = (index: number, change: number) => {
    setCart((prev) => {
      const newCart = [...prev];
      const newQty = newCart[index].quantity + change;
      if (newQty <= 0) {
        newCart.splice(index, 1);
      } else {
        newCart[index] = { ...newCart[index], quantity: newQty };
      }
      return newCart;
    });
  };

  const handleRemoveFromCart = (index: number) => {
    setCart((prev) => prev.filter((_, i) => i !== index));
  };

  const handleOpenItemNotes = (index: number) => {
    setEditingCartItemIndex(index);
    setItemNotesInput(cart[index].notes || "");
  };

  const handleSaveItemNotes = () => {
    if (editingCartItemIndex !== null) {
      setCart((prev) => {
        const newCart = [...prev];
        newCart[editingCartItemIndex] = { ...newCart[editingCartItemIndex], notes: itemNotesInput };
        return newCart;
      });
      setEditingCartItemIndex(null);
    }
  };

  // Pricing math
  const subtotal = cart.reduce((sum, item) => sum + item.product.price * item.quantity, 0);
  
  let discountAmount = 0;
  if (appliedDiscount.value > 0) {
    if (appliedDiscount.type === "percent") {
      discountAmount = (subtotal * appliedDiscount.value) / 100;
    } else {
      discountAmount = appliedDiscount.value;
    }
  }
  discountAmount = Math.min(subtotal, discountAmount); // avoid negative totals

  const taxableAmount = Math.max(0, subtotal - discountAmount);
  const taxAmount = 0;
  const grandTotal = taxableAmount;

  // Table management endpoints helpers
  const handleTableStatusChange = async (tableId: string, status: "free" | "occupied" | "reserved") => {
    try {
      const res = await fetch(`/api/tables/${tableId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      if (res.ok) {
        fetchMenuData(); // refresh
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSplitTable = () => {
    if (!selectedTable) {
      alert("الرجاء اختيار طاولة مشغولة أولاً!");
      return;
    }
    alert(`تم فتح طلب فصل الحسابات للطاولة ${selectedTable}. يمكنك تحديد الأصناف وتوزيعها على الفواتير الفرعية الآن.`);
  };

  const handleMergeTables = async () => {
    const mainTable = prompt("أدخل رقم الطاولة الرئيسية المُراد الدمج إليها (مثال: t-1):");
    const targetTable = prompt("أدخل رقم الطاولة الثانية المراد دمجها:");
    if (!mainTable || !targetTable) return;

    try {
      const res = await fetch("/api/tables/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mainTableId: mainTable, mergeWithTableId: targetTable })
      });
      if (res.ok) {
        alert("تم دمج الطاولات بنجاح في مخطط الصالة.");
        fetchMenuData();
      } else {
        alert("فشل دمج الطاولات. يرجى التحقق من الأكواد.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleTransferTable = async () => {
    if (!selectedTable) {
      alert("يرجى اختيار الطاولة الحالية التي ترغب بنقل الطلبات منها");
      return;
    }
    const toTable = prompt("أدخل كود الطاولة الجديدة المُراد النقل إليها (مثال: t-5):");
    if (!toTable) return;

    try {
      const res = await fetch("/api/tables/transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fromTableId: selectedTable, toTableId: toTable })
      });
      if (res.ok) {
        alert("تم ترحيل وتحويل الفاتورة للطاولة الجديدة بنجاح.");
        setSelectedTable(toTable);
        fetchMenuData();
      } else {
        alert("خطأ أثناء نقل الطاولة. تأكد من تفرغ الطاولة المستهدفة.");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Add customer callback
  const handleAddCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustomerName || !newCustomerPhone) {
      alert("الرجاء إدخال الاسم ورقم الهاتف للعميل");
      return;
    }

    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: newCustomerName,
          phone: newCustomerPhone,
          notes: newCustomerNotes
        })
      });

      const data = await res.json();
      if (res.ok) {
        setCustomers((prev) => [...prev, data]);
        setSelectedCustomer(data);
        setShowAddCustomerModal(false);
        setNewCustomerName("");
        setNewCustomerPhone("");
        setNewCustomerNotes("");
      } else {
        alert(data.error || "فشل تسجيل العميل");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Suspend/Hold order
  const handleHoldOrder = async () => {
    if (cart.length === 0) {
      alert("لا يمكن تعليق سلة فارغة!");
      return;
    }

    try {
      const res = await fetch("/api/orders/hold", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cashierId: shift.cashierId,
          cartSnapshot: {
            items: cart,
            orderType,
            tableId: selectedTable || null,
            waiterId: selectedWaiter || null,
            customerId: selectedCustomer?.id || null
          },
          tableId: selectedTable || null,
          customerId: selectedCustomer?.id || null
        })
      });

      if (res.ok) {
        alert("تم تعليق وحفظ الفاتورة الحالية مؤقتاً بنجاح.");
        setCart([]);
        setSelectedTable("");
        setSelectedWaiter("");
        setSelectedCustomer(null);
        setAppliedDiscount({ value: 0, type: "fixed", reason: "" });
        onOpenHeldList(); // refresh held trigger list
      } else {
        alert("فشل تعليق الفاتورة");
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Checkout payment bridge
  const handleProceedToPayment = () => {
    if (cart.length === 0) {
      alert("السلة فارغة! أضف أطباقاً أولاً للبدء.");
      return;
    }

    if (orderType === "dine_in" && !selectedTable) {
      alert("الرجاء تحديد رقم الطاولة لطلب الصالة الداخلي!");
      return;
    }

    onTriggerPayment({
      items: cart,
      subtotal,
      discount: discountAmount,
      discountReason: appliedDiscount.reason || undefined,
      tax: taxAmount,
      total: grandTotal,
      orderType,
      tableId: selectedTable || null,
      waiterId: selectedWaiter || null,
      customerId: selectedCustomer?.id || null,
      notes: orderType === "takeaway" ? selectedDeliveryApp : ""
    });
  };

  // Reset checkout after successful payment
  const handleClearTerminal = () => {
    setCart([]);
    setSelectedTable("");
    setSelectedWaiter("");
    setSelectedCustomer(null);
    setAppliedDiscount({ value: 0, type: "fixed", reason: "" });
  };

  // Public methods mapping
  useEffect(() => {
    const handleRestoreHeld = (e: Event) => {
      const customEvent = e as CustomEvent<HeldOrder>;
      if (customEvent.detail && customEvent.detail.cartSnapshot) {
        const snap = customEvent.detail.cartSnapshot;
        setCart(snap.items || []);
        setOrderType(snap.orderType || "dine_in");
        setSelectedTable(snap.tableId || "");
        setSelectedWaiter(snap.waiterId || "");
        if (snap.customerId) {
          const found = customers.find((c) => c.id === snap.customerId);
          setSelectedCustomer(found || null);
        } else {
          setSelectedCustomer(null);
        }
      }
    };

    window.addEventListener("pos-clear-cart", handleClearTerminal);
    window.addEventListener("pos-restore-held", handleRestoreHeld);
    return () => {
      window.removeEventListener("pos-clear-cart", handleClearTerminal);
      window.removeEventListener("pos-restore-held", handleRestoreHeld);
    };
  }, [customers]);

  // Filter products based on search inputs, category tabs, and favorites
  const filteredProducts = products.filter((prod) => {
    // 1. Search Query
    const matchesSearch =
      prod.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (prod.nameEn && prod.nameEn.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (prod.barcode && prod.barcode.includes(searchQuery));

    // 2. Category Tab
    const matchesCategory = selectedCategory === "all" || prod.categoryId === selectedCategory;

    // 3. Favorites filter
    const matchesFavorites = !showOnlyFavorites || prod.price >= 15; // Mock top tier priced as favorites

    return matchesSearch && matchesCategory && matchesFavorites;
  });

  return (
    <div className="flex-1 flex flex-col md:flex-row overflow-hidden bg-stone-100">
      
      {/* LEFT COLUMN: Checkout Details (30% width) */}
      <CheckoutColumn
        isOnline={isOnline}
        shift={shift}
        onCloseShift={onCloseShift}
        onOpenHeldList={onOpenHeldList}
        heldCount={heldCount}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        customers={customers}
        tables={tables}
        selectedCustomer={selectedCustomer}
        setSelectedCustomer={setSelectedCustomer}
        setShowAddCustomerModal={setShowAddCustomerModal}
        cart={cart}
        setCart={setCart}
        totals={{
          subtotal,
          discountAmount,
          taxableAmount,
          taxAmount,
          grandTotal
        }}
        appliedDiscount={appliedDiscount}
        orderType={orderType}
        setOrderType={setOrderType}
        selectedTable={selectedTable}
        setSelectedTable={setSelectedTable}
        selectedWaiter={selectedWaiter}
        setSelectedWaiter={setSelectedWaiter}
        updateQuantity={handleUpdateQuantity}
        removeFromCart={handleRemoveFromCart}
        handleOpenDiscountModal={() => setShowDiscountModal(true)}
        handleHoldOrder={handleHoldOrder}
        handleProceedToPayment={handleProceedToPayment}
      />

      {/* RIGHT COLUMN: Menu and Controls (70% width) */}
      <section className="flex-1 flex flex-col overflow-hidden">
        
        {/* UPPER TOOLBAR (Refresh, search, favorites, dine-in toggle) */}
        <div className="bg-white border-b border-stone-200 p-4 shrink-0 flex flex-col md:flex-row gap-4 items-center justify-between">
          
          {/* Right side: terminal actions */}
          <div className="flex flex-col md:flex-row gap-3 items-center w-full md:w-auto shrink-0">
            <div className="flex bg-stone-100 p-1 rounded-xl w-full md:w-auto">
              <button
                onClick={() => {
                  setOrderType("delivery");
                  setSelectedTable("");
                }}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  orderType === "delivery" ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600 hover:bg-stone-200/50"
                }`}
              >
                <Truck className="w-3.5 h-3.5" />
                <span>توصيل سفري</span>
              </button>
              <button
                onClick={() => {
                  setOrderType("takeaway");
                  setSelectedTable("");
                }}
                className={`flex-1 md:flex-none px-4 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1 ${
                  orderType === "takeaway" ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600 hover:bg-stone-200/50"
                }`}
              >
                <ShoppingBag className="w-3.5 h-3.5" />
                <span>تطبيقات</span>
              </button>
              <button
                onClick={() => setOrderType("dine_in")}
                className={`flex-1 md:flex-none px-5 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                  orderType === "dine_in" ? "bg-[#2E7D32] text-white shadow-sm font-extrabold" : "text-stone-600 hover:bg-stone-200/50"
                }`}
              >
                <Utensils className="w-3.5 h-3.5" />
                <span>داخلي صالة</span>
              </button>
            </div>

            {orderType === "takeaway" && (
              <div className="flex bg-amber-50 border border-amber-200 p-1 rounded-lg gap-1.5 w-full md:w-auto text-xs font-bold overflow-x-auto select-none">
                {["هنقرستيشن", "كيتا", "نينجا", "ذا تشيفز", "جاهز", "تويو"].map((app) => (
                  <button
                    key={app}
                    onClick={() => setSelectedDeliveryApp(app)}
                    className={`px-3 py-1.5 rounded-md transition-all text-[11px] ${
                      selectedDeliveryApp === app
                        ? "bg-amber-600 text-white shadow-sm"
                        : "bg-white border border-amber-200 hover:bg-amber-100 text-stone-700"
                    }`}
                  >
                    {app}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Left side: Search & Refresh & Favorites */}
          <div className="flex items-center gap-2 w-full md:w-auto justify-end">
            <div className="relative w-full md:w-60">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="البحث السريع في الأصناف..."
                className="w-full pr-9 pl-3 py-1.5 border border-stone-200 rounded-xl bg-stone-50 focus:bg-white text-xs text-right focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
              />
            </div>

            <button
              onClick={() => setShowOnlyFavorites((prev) => !prev)}
              className={`p-2 rounded-xl border transition-all ${
                showOnlyFavorites
                  ? "bg-red-50 border-red-300 text-red-600"
                  : "border-stone-200 hover:bg-stone-50 text-stone-400"
              }`}
              title="المفضلة (الأصناف الفاخرة)"
            >
              <Heart className="w-5 h-5 fill-current" />
            </button>

            <button
              onClick={onOpenAdmin}
              className="px-4.5 py-2 text-xs font-bold border border-stone-200 hover:bg-stone-50 text-stone-700 rounded-xl flex items-center gap-1.5"
            >
              <span>لوحة الإدارة</span>
              <Coffee className="w-4 h-4 text-[#2E7D32]" />
            </button>

            <button
              onClick={fetchMenuData}
              className="p-2 border border-stone-200 hover:bg-stone-50 text-stone-500 rounded-xl"
              title="تحديث قائمة الأصناف والمنتجات"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>

        </div>

        {/* DINE-IN OPTIONS: Tables, waiter list, split/merge (Only shows when orderType = dine_in) */}
        {orderType === "dine_in" && (
          <div className="bg-white border-b border-stone-200 px-4 py-3 shrink-0 flex flex-col md:flex-row gap-4 items-center justify-between text-right">
            
            {/* Table and Waiter Selectors */}
            <div className="flex gap-3 w-full md:w-auto">
              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 font-bold">النادل:</span>
                <select
                  value={selectedWaiter}
                  onChange={(e) => setSelectedWaiter(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-700 focus:outline-none"
                >
                  <option value="">اختر نادل الخدمة...</option>
                  <option value="u-4">يوسف نادل</option>
                  <option value="u-5">سارة نادل</option>
                </select>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-stone-500 font-bold">طاولة الصالة:</span>
                <select
                  value={selectedTable}
                  onChange={(e) => setSelectedTable(e.target.value)}
                  className="bg-stone-50 border border-stone-200 rounded-xl px-3 py-1.5 text-xs font-bold text-stone-700 focus:outline-none"
                >
                  <option value="">اختر الطاولة...</option>
                  {tables.map((tbl) => (
                    <option key={tbl.id} value={tbl.id}>
                      {tbl.label} ({tbl.seats} مقاعد) - {tbl.status === 'free' ? 'متاحة' : tbl.status === 'occupied' ? 'مشغولة' : 'محجوزة'}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Table operational commands & indicators */}
            <div className="flex flex-wrap gap-1.5 w-full md:w-auto justify-end">
              <button
                onClick={handleTransferTable}
                className="px-2.5 py-1 text-[10px] font-bold border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg flex items-center gap-1 transition-all"
                title="نقل الطلبات إلى طاولة أخرى"
              >
                <ArrowLeftRight className="w-3 h-3" />
                <span>نقل طاولة</span>
              </button>
              <button
                onClick={handleMergeTables}
                className="px-2.5 py-1 text-[10px] font-bold border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg flex items-center gap-1 transition-all"
                title="دمج طاولتين معاً"
              >
                <Layers className="w-3 h-3" />
                <span>دمج طاولات</span>
              </button>
              <button
                onClick={handleSplitTable}
                className="px-2.5 py-1 text-[10px] font-bold border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-lg flex items-center gap-1 transition-all"
                title="فصل حسابات الفاتورة لصالح زبائن الطاولة"
              >
                <Split className="w-3 h-3" />
                <span>فصل طاولة</span>
              </button>

              {/* Status micro chips */}
              <div className="flex gap-1.5 items-center bg-stone-100 px-2 py-1 rounded-lg">
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-green-700">
                  <span className="w-2 h-2 rounded-full bg-green-500"></span>متاحة
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-orange-700">
                  <span className="w-2 h-2 rounded-full bg-orange-500"></span>مشغولة
                </span>
                <span className="inline-flex items-center gap-1 text-[9px] font-bold text-red-700">
                  <span className="w-2 h-2 rounded-full bg-red-500"></span>محجوزة
                </span>
              </div>
            </div>

          </div>
        )}

        {/* CATEGORY SELECTOR SLIDER */}
        <div className="bg-white border-b border-stone-200 px-4 py-3 shrink-0 overflow-x-auto flex gap-2 justify-start scrollbar-none">
          <button
            onClick={() => setSelectedCategory("all")}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
              selectedCategory === "all"
                ? "bg-[#2E7D32] border-[#2E7D32] text-white"
                : "border-stone-200 hover:bg-stone-50 text-stone-600"
            }`}
          >
            كل الأصناف
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all shrink-0 border ${
                selectedCategory === cat.id
                  ? "bg-[#2E7D32] border-[#2E7D32] text-white"
                  : "border-stone-200 hover:bg-stone-50 text-stone-600"
              }`}
            >
              {cat.nameAr}
            </button>
          ))}
        </div>

        {/* PRODUCTS TOUCH GRID (5 columns on large screen) */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {loadingMenu ? (
            <div className="py-24 text-center space-y-3">
              <div className="w-10 h-10 border-4 border-[#2E7D32] border-t-transparent rounded-full animate-spin mx-auto"></div>
              <p className="text-sm text-stone-500 font-bold">جاري تحميل قائمة المأكولات والمشروبات من السيرفر...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="py-24 text-center space-y-2">
              <ShoppingCart className="w-12 h-12 text-stone-300 mx-auto" />
              <p className="text-sm font-bold text-stone-500">لا توجد نتائج للبحث حالياً</p>
              <p className="text-xs text-stone-400">تأكد من كتابة اسم الصنف بالشكل الصحيح أو امسح شريط البحث</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
              {filteredProducts.map((prod) => (
                <div
                  key={prod.id}
                  onClick={() => handleAddToCart(prod)}
                  className="bg-white border border-stone-200 hover:border-green-400 rounded-2xl p-3 shadow-sm hover:shadow transition-all cursor-pointer flex flex-col justify-between text-right h-40 group relative overflow-hidden"
                >
                  {/* Quick plus indicator on hover */}
                  <span className="absolute left-2.5 top-2.5 bg-green-500 text-white w-6 h-6 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all shadow shadow-green-200">
                    <Plus className="w-4 h-4" />
                  </span>

                   {/* Thumbnail / placeholder circle */}
                  {prod.image ? (
                    <img
                      src={prod.image.startsWith('data:') ? prod.image : `/uploads/${prod.image}`}
                      alt={prod.nameAr}
                      className="w-12 h-12 rounded-xl object-cover shadow-sm shrink-0 border border-stone-100"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-[#EAF4EA] flex items-center justify-center text-[#2E7D32] shrink-0 font-bold text-xs shadow-sm">
                      {prod.nameAr.slice(0, 2)}
                    </div>
                  )}

                  {/* Body text */}
                  <div className="space-y-1 mt-3">
                    <h4 className="text-xs font-extrabold text-stone-800 line-clamp-2 leading-snug">
                      {prod.nameAr}
                    </h4>
                    {prod.nameEn && (
                      <p className="text-[9px] text-stone-400 font-mono font-medium truncate uppercase">
                        {prod.nameEn}
                      </p>
                    )}
                  </div>

                  {/* Pricing footer */}
                  <div className="flex items-center justify-between border-t border-stone-100 pt-2 mt-2">
                    <span className="text-[10px] font-bold text-[#2E7D32] font-mono bg-green-50 px-2 py-0.5 rounded">
                      {prod.price.toFixed(2)} ر.س
                    </span>
                    {prod.trackInventory && (
                      <span className="text-[8px] font-bold text-stone-400">
                        متاح: {prod.quantity} حبة
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

        </div>

      </section>

      {/* QUICK ADD CUSTOMER MODAL */}
      {showAddCustomerModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#2E7D32] text-white p-5 flex items-center justify-between">
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">تسجيل سريع</span>
              <h3 className="text-lg font-bold">إضافة عميل جديد للنظام</h3>
              <button onClick={() => setShowAddCustomerModal(false)} className="p-1 hover:bg-white/15 rounded text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddCustomerSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="أدخل الاسم الثنائي أو الثلاثي للعميل..."
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">رقم الهاتف الجوال *</label>
                <input
                  type="text"
                  required
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="مثال: 0551234567..."
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">ملاحظات العميل (اختياري)</label>
                <textarea
                  rows={2}
                  value={newCustomerNotes}
                  onChange={(e) => setNewCustomerNotes(e.target.value)}
                  placeholder="مثال: يفضل شاورما بدون مخلل، عميل دائم..."
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddCustomerModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 text-xs font-bold"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow"
                >
                  تسجيل واختيار العميل
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ITEM NOTES MODIFIERS MODAL */}
      {editingCartItemIndex !== null && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#2E7D32] text-white p-5 flex items-center justify-between">
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">تعديل المكونات</span>
              <h3 className="text-lg font-bold">تعديلات وملاحظات الصنف</h3>
              <button onClick={() => setEditingCartItemIndex(null)} className="p-1 hover:bg-white/15 rounded text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-stone-500 font-bold">
                أدخل طلبات الزبون الخاصة لتحضير طبق: <strong className="text-stone-800 font-extrabold">{cart[editingCartItemIndex]?.product.nameAr}</strong>
              </p>

              {/* Fast presets */}
              <div className="flex flex-wrap gap-1.5 justify-end">
                {["بدون مخلل", "زيادة ثوم", "محمص زيادة", "بدون بصل", "سبايسي حار 🔥", "شطة خفيفة", "بدون طماطم"].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setItemNotesInput((prev) => prev ? `${prev}، ${preset}` : preset)}
                    className="px-2.5 py-1 border border-stone-200 hover:bg-stone-50 rounded-lg text-xs text-stone-700 transition-all font-bold"
                  >
                    {preset}
                  </button>
                ))}
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">تعليمات التحضير المكتوبة</label>
                <textarea
                  rows={3}
                  value={itemNotesInput}
                  onChange={(e) => setItemNotesInput(e.target.value)}
                  placeholder="أدخل أي ملاحظات مخصصة تظهر في بون طباعة المطبخ..."
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingCartItemIndex(null)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 text-xs font-bold"
                >
                  تراجع
                </button>
                <button
                  type="button"
                  onClick={handleSaveItemNotes}
                  className="px-6 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow"
                >
                  حفظ التعليمات للسلة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* INVOICE DISCOUNT MODAL */}
      {showDiscountModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-right animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-[#2E7D32] text-white p-5 flex items-center justify-between">
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">تسوية الأسعار</span>
              <h3 className="text-lg font-bold">تطبيق خصم مالي على الفاتورة</h3>
              <button onClick={() => setShowDiscountModal(false)} className="p-1 hover:bg-white/15 rounded text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Type toggle */}
              <div className="flex bg-stone-100 p-1 rounded-xl w-full">
                <button
                  onClick={() => setDiscountType("percent")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    discountType === "percent" ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600"
                  }`}
                >
                  خصم نسبة مئوية (%)
                </button>
                <button
                  onClick={() => setDiscountType("fixed")}
                  className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    discountType === "fixed" ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600"
                  }`}
                >
                  خصم مبلغ مقطوع (ريال)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">قيمة الخصم المطلوبة</label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percent" ? "مثال: 10..." : "مثال: 5.00..."}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">سبب ومبرر الخصم *</label>
                <input
                  type="text"
                  required
                  value={discountReason}
                  onChange={(e) => setDiscountReason(e.target.value)}
                  placeholder="مثال: خصم موظف، تعويض عميل دائم..."
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setAppliedDiscount({ value: 0, type: "fixed", reason: "" });
                    setDiscountValue("");
                    setDiscountReason("");
                    setShowDiscountModal(false);
                  }}
                  className="px-4 py-2 border border-stone-200 text-stone-600 hover:bg-stone-50 text-xs font-bold"
                >
                  إلغاء وحذف الخصم
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!discountValue || isNaN(Number(discountValue)) || Number(discountValue) < 0) {
                      alert("يرجى إدخال قيمة خصم صحيحة");
                      return;
                    }
                    if (!discountReason) {
                      alert("الرجاء توضيح سبب تطبيق الخصم للمراجعة الإدارية");
                      return;
                    }
                    setAppliedDiscount({
                      value: Number(discountValue),
                      type: discountType,
                      reason: discountReason
                    });
                    setShowDiscountModal(false);
                  }}
                  className="px-6 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow"
                >
                  تطبيق الخصم للسلة
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
