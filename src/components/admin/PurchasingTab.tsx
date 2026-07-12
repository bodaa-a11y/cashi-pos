import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Check, X, ClipboardList, UserCheck, Search, ShoppingBag } from "lucide-react";
import { InventoryItem } from "../../types";

interface Supplier {
  id: string;
  name: string;
  phone: string;
  address: string;
  notes: string;
  isActive: boolean;
}

interface POItem {
  inventoryItemId: string;
  nameAr: string;
  unit: string;
  quantity: number;
  unitCost: number;
  total: number;
}

interface PurchaseOrder {
  id: string;
  poNumber: number;
  supplierId: string;
  supplierName: string;
  status: "draft" | "ordered" | "received" | "cancelled";
  items: POItem[];
  totalCost: number;
  notes: string;
  createdBy: string;
  createdAt: string;
  receivedAt: string | null;
}

interface PurchasingTabProps {
  inventoryItems: InventoryItem[];
  fetchInventory: () => Promise<void>;
  initialInventoryItemId?: string;
  onNavigateToNewOrder?: (itemId: string | null) => void;
}

export default function PurchasingTab({ 
  inventoryItems, 
  fetchInventory, 
  initialInventoryItemId,
  onNavigateToNewOrder
}: PurchasingTabProps) {
  const [view, setView] = useState<"suppliers" | "orders" | "new-order">("orders");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [orders, setOrders] = useState<PurchaseOrder[]>([]);
  
  // Suppliers Form States
  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [supName, setSupName] = useState("");
  const [supPhone, setSupPhone] = useState("");
  const [supAddress, setSupAddress] = useState("");
  const [supNotes, setSupNotes] = useState("");

  // Purchase Order Form States
  const [selectedSupplierId, setSelectedSupplierId] = useState("");
  const [poNotes, setPoNotes] = useState("");
  const [poItems, setPoItems] = useState<Array<{ inventoryItemId: string; quantity: number; unitCost: number }>>([]);
  const [poFilterStatus, setPoFilterStatus] = useState("");

  const fetchSuppliers = async () => {
    try {
      const res = await fetch("/api/suppliers");
      if (res.ok) setSuppliers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchOrders = async () => {
    try {
      let url = "/api/purchase-orders";
      if (poFilterStatus) url += `?status=${poFilterStatus}`;
      const res = await fetch(url);
      if (res.ok) setOrders(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchSuppliers();
    fetchOrders();
  }, [poFilterStatus]);

  useEffect(() => {
    if (initialInventoryItemId) {
      setView("new-order");
      setSelectedSupplierId("");
      setPoNotes("");
      const invItem = inventoryItems.find(i => i.id === initialInventoryItemId);
      if (invItem) {
        setPoItems([{ inventoryItemId: initialInventoryItemId, quantity: 1, unitCost: 0 }]);
      }
      // Reset the navigation param
      if (onNavigateToNewOrder) onNavigateToNewOrder(null);
    }
  }, [initialInventoryItemId, inventoryItems]);

  const handleOpenAddSupplier = () => {
    setEditingSupplier(null);
    setSupName("");
    setSupPhone("");
    setSupAddress("");
    setSupNotes("");
    setShowSupplierModal(true);
  };

  const handleOpenEditSupplier = (sup: Supplier) => {
    setEditingSupplier(sup);
    setSupName(sup.name);
    setSupPhone(sup.phone);
    setSupAddress(sup.address);
    setSupNotes(sup.notes);
    setShowSupplierModal(true);
  };

  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supName.trim()) {
      alert("اسم المورد مطلوب");
      return;
    }

    try {
      const url = editingSupplier ? `/api/suppliers/${editingSupplier.id}` : "/api/suppliers";
      const method = editingSupplier ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: supName, phone: supPhone, address: supAddress, notes: supNotes })
      });

      if (res.ok) {
        alert(editingSupplier ? "تم تعديل المورد بنجاح" : "تم إضافة المورد بنجاح");
        setShowSupplierModal(false);
        fetchSuppliers();
      } else {
        const err = await res.json();
        alert(err.error || "فشلت العملية");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  const handleToggleSupplierStatus = async (sup: Supplier) => {
    try {
      const res = await fetch(`/api/suppliers/${sup.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !sup.isActive })
      });
      if (res.ok) {
        fetchSuppliers();
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المورد "${name}"؟`)) return;
    try {
      const res = await fetch(`/api/suppliers/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("تم حذف المورد بنجاح");
        fetchSuppliers();
      } else {
        const err = await res.json();
        alert(err.error || "فشل حذف المورد");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // PO Items management
  const addPOItem = () => {
    setPoItems(prev => [...prev, { inventoryItemId: "", quantity: 1, unitCost: 0 }]);
  };

  const removePOItem = (index: number) => {
    setPoItems(prev => prev.filter((_, i) => i !== index));
  };

  const updatePOItem = (index: number, field: "inventoryItemId" | "quantity" | "unitCost", value: any) => {
    setPoItems(prev => prev.map((item, i) => {
      if (i !== index) return item;
      const updated = { ...item, [field]: value };
      if (field === "inventoryItemId") {
        const invItem = inventoryItems.find(x => x.id === value);
        if (invItem) {
          updated.unitCost = 0;
        }
      }
      return updated;
    }));
  };

  const handleCreateOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplierId) {
      alert("الرجاء اختيار مورد");
      return;
    }
    if (poItems.length === 0) {
      alert("الرجاء إضافة صنف واحد على الأقل لأمر الشراء");
      return;
    }
    if (poItems.some(it => !it.inventoryItemId || it.quantity <= 0 || it.unitCost < 0)) {
      alert("الرجاء التأكد من صحة جميع الأصناف والكميات والأسعار");
      return;
    }

    try {
      const res = await fetch("/api/purchase-orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ supplierId: selectedSupplierId, items: poItems, notes: poNotes })
      });

      if (res.ok) {
        alert("تم إنشاء أمر الشراء بنجاح!");
        setView("orders");
        setPoItems([]);
        setPoNotes("");
        fetchOrders();
      } else {
        const err = await res.json();
        alert(err.error || "فشل إنشاء أمر الشراء");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  const handleReceiveOrder = async (id: string, poNumber: number) => {
    if (!confirm(`تأكيد استلام أمر الشراء #${poNumber}؟ سيتم تحديث المخزون تلقائياً.`)) return;
    try {
      const res = await fetch(`/api/purchase-orders/${id}/receive`, { method: "POST" });
      if (res.ok) {
        alert("تم استلام الطلب وتحديث المخزون بنجاح! 🎉");
        fetchOrders();
        fetchInventory();
      } else {
        const err = await res.json();
        alert(err.error || "فشل استلام أمر الشراء");
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleCancelOrder = async (id: string, poNumber: number) => {
    if (!confirm(`هل أنت متأكد من إلغاء أمر الشراء #${poNumber}؟`)) return;
    try {
      const res = await fetch(`/api/purchase-orders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" })
      });
      if (res.ok) {
        alert("تم إلغاء أمر الشراء");
        fetchOrders();
      } else {
        const err = await res.json();
        alert(err.error || "فشل إلغاء الأمر");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-stone-200 pb-px">
        <button
          onClick={() => setView("orders")}
          className={`py-2.5 px-4 font-bold text-xs border-b-2 transition-all ${
            view === "orders" ? "border-[#2E7D32] text-[#2E7D32]" : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          أوامر الشراء
        </button>
        <button
          onClick={() => setView("suppliers")}
          className={`py-2.5 px-4 font-bold text-xs border-b-2 transition-all ${
            view === "suppliers" ? "border-[#2E7D32] text-[#2E7D32]" : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          الموردين
        </button>
        <button
          onClick={() => {
            setView("new-order");
            setSelectedSupplierId("");
            setPoItems([{ inventoryItemId: "", quantity: 1, unitCost: 0 }]);
            setPoNotes("");
          }}
          className={`py-2.5 px-4 font-bold text-xs border-b-2 transition-all ${
            view === "new-order" ? "border-[#2E7D32] text-[#2E7D32]" : "border-transparent text-stone-500 hover:text-stone-800"
          }`}
        >
          إنشاء أمر شراء جديد
        </button>
      </div>

      {/* VIEW: Suppliers */}
      {view === "suppliers" && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex justify-between items-center">
            <h3 className="font-bold text-stone-800 text-sm">قائمة الموردين</h3>
            <button
              onClick={handleOpenAddSupplier}
              className="py-1.5 px-3 bg-[#2E7D32] hover:bg-[#235F26] text-white text-xs font-bold rounded-lg flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة مورد جديد</span>
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-stone-50 text-stone-500 border-b border-stone-200">
                  <th className="p-3">اسم المورد</th>
                  <th className="p-3">رقم الهاتف</th>
                  <th className="p-3">العنوان</th>
                  <th className="p-3">ملاحظات</th>
                  <th className="p-3 text-center">الحالة</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {suppliers.map(sup => (
                  <tr key={sup.id} className="hover:bg-stone-50/50">
                    <td className="p-3 font-bold text-stone-800">{sup.name}</td>
                    <td className="p-3 text-stone-600 font-mono">{sup.phone || "—"}</td>
                    <td className="p-3 text-stone-600">{sup.address || "—"}</td>
                    <td className="p-3 text-stone-400 max-w-[200px] truncate">{sup.notes || "—"}</td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleToggleSupplierStatus(sup)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          sup.isActive ? "bg-green-50 text-green-700" : "bg-stone-100 text-stone-500"
                        }`}
                      >
                        {sup.isActive ? "نشط" : "معطل"}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleOpenEditSupplier(sup)}
                          className="p-1 hover:bg-stone-100 border border-stone-200 rounded text-stone-600"
                          title="تعديل"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                          className="p-1 hover:bg-red-50 border border-red-100 rounded text-red-600"
                          title="حذف"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400">
                      لا يوجد موردين مسجلين بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW: Orders */}
      {view === "orders" && (
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
            <h3 className="font-bold text-stone-800 text-sm">أوامر الشراء المودعة</h3>
            <div className="flex items-center gap-2">
              <label className="text-xs font-bold text-stone-500 shrink-0">تصفية حسب الحالة</label>
              <select
                value={poFilterStatus}
                onChange={(e) => setPoFilterStatus(e.target.value)}
                className="border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs focus:outline-none"
              >
                <option value="">جميع الحالات</option>
                <option value="draft">مسودة</option>
                <option value="ordered">مطلوب شحنه</option>
                <option value="received">تم الاستلام</option>
                <option value="cancelled">ملغي</option>
              </select>
            </div>
          </div>

          <div className="space-y-4">
            {orders.map(order => (
              <div key={order.id} className="border border-stone-200 rounded-xl p-4 space-y-3 hover:shadow-sm transition-all bg-stone-50/20">
                <div className="flex flex-wrap justify-between items-center gap-2 border-b border-stone-100 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-extrabold text-stone-800 text-sm">أمر شراء #{order.poNumber}</span>
                    <span className="text-[10px] text-stone-400 font-mono">{new Date(order.createdAt).toLocaleString("ar-EG")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      order.status === "received" ? "bg-green-50 text-green-700" :
                      order.status === "ordered" ? "bg-blue-50 text-blue-700" :
                      order.status === "cancelled" ? "bg-red-50 text-red-700" : "bg-stone-100 text-stone-600"
                    }`}>
                      {order.status === "received" ? "تم الاستلام" :
                       order.status === "ordered" ? "مطلوب شحنه" :
                       order.status === "cancelled" ? "ملغي" : "مسودة"}
                    </span>
                    <span className="text-xs font-bold text-stone-700">المورد: {order.supplierName}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-xs">
                  <div className="col-span-3 space-y-1">
                    <p className="font-bold text-stone-500">تفاصيل الأصناف:</p>
                    <div className="flex flex-wrap gap-2">
                      {order.items.map((it, idx) => (
                        <span key={idx} className="bg-white border border-stone-200 px-2 py-1 rounded text-stone-700 font-medium">
                          {it.nameAr} ({it.quantity} {it.unit} × {it.unitCost.toFixed(2)} ر.س)
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-xl p-3 flex flex-col justify-center items-center text-center space-y-1 shadow-sm">
                    <span className="text-[10px] font-bold text-stone-400">إجمالي التكلفة</span>
                    <span className="text-base font-extrabold text-[#2E7D32] font-mono">{order.totalCost.toFixed(2)} ر.س</span>
                  </div>
                </div>

                <div className="flex justify-between items-center text-xs border-t border-stone-100 pt-2">
                  <span className="text-stone-400">المنشئ: {order.createdBy} {order.receivedAt && `| تاريخ الاستلام: ${new Date(order.receivedAt).toLocaleString("ar-EG")}`}</span>
                  <div className="flex gap-2">
                    {order.status !== "received" && order.status !== "cancelled" && (
                      <>
                        <button
                          onClick={() => handleCancelOrder(order.id, order.poNumber)}
                          className="py-1 px-3 border border-red-200 hover:bg-red-50 text-red-600 font-bold rounded-lg transition-all"
                        >
                          إلغاء الأمر
                        </button>
                        <button
                          onClick={() => handleReceiveOrder(order.id, order.poNumber)}
                          className="py-1 px-3 bg-[#2E7D32] hover:bg-[#235F26] text-white font-bold rounded-lg flex items-center gap-1 transition-all shadow-sm"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>تأكيد الاستلام</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {orders.length === 0 && (
              <div className="p-8 text-center text-stone-400 bg-stone-50/50 rounded-xl">
                لا توجد أوامر شراء مطابقة حالياً.
              </div>
            )}
          </div>
        </div>
      )}

      {/* VIEW: New Order Form */}
      {view === "new-order" && (
        <form onSubmit={handleCreateOrder} className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
          <h3 className="font-bold text-stone-800 text-sm">إنشاء طلب توريد/شراء جديد</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">اختر المورد</label>
              <select
                value={selectedSupplierId}
                onChange={(e) => setSelectedSupplierId(e.target.value)}
                className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
              >
                <option value="">-- اختر مورد --</option>
                {suppliers.filter(s => s.isActive).map(s => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-stone-500 mb-1">ملاحظات الطلب</label>
              <input
                type="text"
                value={poNotes}
                onChange={(e) => setPoNotes(e.target.value)}
                className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-right focus:outline-none"
                placeholder="تفاصيل التوريد أو الشحن أو شروط الدفع"
              />
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-bold text-stone-500">أصناف التوريد والمخزون المطلوبة</label>
              <button
                type="button"
                onClick={addPOItem}
                className="py-1 px-2.5 border border-[#2E7D32] hover:bg-[#EAF4EA] text-[#2E7D32] text-xs font-bold rounded-lg flex items-center gap-1 transition-all"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة صنف</span>
              </button>
            </div>

            <div className="space-y-2">
              {poItems.map((item, idx) => (
                <div key={idx} className="flex flex-wrap items-center gap-2 bg-stone-50 p-3 rounded-xl border border-stone-100">
                  <div className="flex-1 min-w-[200px]">
                    <select
                      value={item.inventoryItemId}
                      onChange={(e) => updatePOItem(idx, "inventoryItemId", e.target.value)}
                      className="w-full border border-stone-200 rounded-lg bg-white p-2 text-xs text-right focus:outline-none"
                    >
                      <option value="">-- اختر الصنف من المخزون --</option>
                      {inventoryItems.map(x => (
                        <option key={x.id} value={x.id}>{x.nameAr} ({x.unit})</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <input
                      type="number"
                      min="1"
                      step="any"
                      placeholder="الكمية"
                      value={item.quantity}
                      onChange={(e) => updatePOItem(idx, "quantity", Number(e.target.value))}
                      className="w-full border border-stone-200 rounded-lg bg-white p-2 text-xs text-center focus:outline-none font-mono"
                    />
                  </div>

                  <div className="w-32">
                    <input
                      type="number"
                      min="0"
                      step="any"
                      placeholder="سعر التكلفة"
                      value={item.unitCost}
                      onChange={(e) => updatePOItem(idx, "unitCost", Number(e.target.value))}
                      className="w-full border border-stone-200 rounded-lg bg-white p-2 text-xs text-center focus:outline-none font-mono"
                    />
                  </div>

                  <div className="w-28 text-left font-mono font-bold text-stone-600 text-xs">
                    {(item.quantity * item.unitCost).toFixed(2)} ر.س
                  </div>

                  <button
                    type="button"
                    onClick={() => removePOItem(idx)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex justify-between items-center border-t border-stone-100 pt-4">
            <div className="text-right">
              <span className="text-xs text-stone-400 font-bold">إجمالي تكلفة أمر الشراء: </span>
              <span className="text-lg font-extrabold text-[#2E7D32] font-mono">
                {poItems.reduce((sum, item) => sum + (item.quantity * item.unitCost), 0).toFixed(2)} ر.س
              </span>
            </div>
            <button
              type="submit"
              className="py-2 px-5 bg-[#2E7D32] hover:bg-[#235F26] text-white text-xs font-bold rounded-lg transition-all shadow-sm flex items-center gap-1"
            >
              <ShoppingBag className="w-4 h-4" />
              <span>تأكيد وإرسال طلب الشراء</span>
            </button>
          </div>
        </form>
      )}

      {/* Supplier Create/Edit Modal */}
      {showSupplierModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveSupplier} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-right">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <button type="button" onClick={() => setShowSupplierModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-stone-800 text-sm">
                {editingSupplier ? "تعديل مورد" : "إضافة مورد جديد"}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">اسم المورد</label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-right focus:outline-none"
                  placeholder="شركة توريد الأغذية، إلخ..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-right focus:outline-none font-mono"
                  placeholder="05xxxxxxx"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">العنوان</label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-right focus:outline-none"
                  placeholder="المدينة، الشارع..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">ملاحظات / بنود</label>
                <textarea
                  value={supNotes}
                  onChange={(e) => setSupNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-right focus:outline-none resize-none"
                  placeholder="أصناف توريد رئيسية، أوقات التسليم المعتادة..."
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setShowSupplierModal(false)}
                className="py-2 px-4 border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-bold rounded-xl transition-all"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="py-2 px-5 bg-[#2E7D32] hover:bg-[#235F26] text-white text-xs font-bold rounded-xl transition-all shadow-sm"
              >
                حفظ البيانات
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
