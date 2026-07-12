import React, { useEffect, useState } from "react";
import { Plus, Edit2, Check, X, Search, FileText, DollarSign, Award, Eye } from "lucide-react";
import { User } from "../../types";

interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  points: number;
  loyaltyPoints: number;
  creditBalance: number;
  totalSpent: number;
  visitsCount: number;
  notes: string;
  createdAt: string;
}

interface LedgerEntry {
  id: string;
  customerId: string;
  type: "purchase" | "payment";
  amount: number;
  orderId?: string;
  notes: string;
  createdAt: string;
  createdBy: string;
}

interface CustomersTabProps {
  currentUser: User;
  currency: string;
}

export default function CustomersTab({ currentUser, currency }: CustomersTabProps) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  
  // Forms
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [custName, setCustName] = useState("");
  const [custPhone, setCustPhone] = useState("");
  const [custEmail, setCustEmail] = useState("");
  const [custNotes, setCustNotes] = useState("");
  
  // Payment Form
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");
  
  // Details View State
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<any[]>([]);
  const [customerLedger, setCustomerLedger] = useState<LedgerEntry[]>([]);

  const fetchCustomers = async () => {
    try {
      let url = "/api/customers";
      if (searchQuery) url += `?search=${encodeURIComponent(searchQuery)}`;
      const res = await fetch(url);
      if (res.ok) setCustomers(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchCustomers();
  }, [searchQuery]);

  const handleOpenAdd = () => {
    setEditingCustomer(null);
    setCustName("");
    setCustPhone("");
    setCustEmail("");
    setCustNotes("");
    setShowAddModal(true);
  };

  const handleOpenEdit = (c: Customer) => {
    setEditingCustomer(c);
    setCustName(c.name);
    setCustPhone(c.phone);
    setCustEmail(c.email);
    setCustNotes(c.notes);
    setShowAddModal(true);
  };

  const handleSaveCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!custName.trim()) {
      alert("اسم العميل مطلوب");
      return;
    }

    try {
      const url = editingCustomer ? `/api/customers/${editingCustomer.id}` : "/api/customers";
      const method = editingCustomer ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: custName, phone: custPhone, email: custEmail, notes: custNotes })
      });

      if (res.ok) {
        alert(editingCustomer ? "تم تعديل العميل بنجاح" : "تم إضافة العميل بنجاح");
        setShowAddModal(false);
        fetchCustomers();
      } else {
        const err = await res.json();
        alert(err.error || "فشلت العملية");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    }
  };

  const handleViewDetails = async (c: Customer) => {
    setSelectedCustomer(c);
    try {
      // Get detailed stats & orders
      const resData = await fetch(`/api/customers/${c.id}`);
      if (resData.ok) {
        const payload = await resData.json();
        setCustomerOrders(payload.orders || []);
      }
      // Get ledger logs
      const resLedger = await fetch(`/api/customers/${c.id}/ledger`);
      if (resLedger.ok) {
        setCustomerLedger(await resLedger.json());
      }
      setShowDetailsModal(true);
    } catch (err) {
      console.error(err);
    }
  };

  const handleOpenPayment = (c: Customer) => {
    setSelectedCustomer(c);
    setPaymentAmount(String(c.creditBalance));
    setPaymentNotes("دفعة سداد حساب آجل");
    setShowPaymentModal(true);
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCustomer) return;
    const amount = Number(paymentAmount);
    if (isNaN(amount) || amount <= 0) {
      alert("الرجاء إدخال مبلغ صحيح");
      return;
    }

    try {
      const res = await fetch(`/api/customers/${selectedCustomer.id}/payment`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, notes: paymentNotes })
      });

      if (res.ok) {
        alert("تم تحصيل الدفعة بنجاح وتنزيل الرصيد الآجل!");
        setShowPaymentModal(false);
        fetchCustomers();
        // Update selection if viewing details
        if (showDetailsModal) {
          const updatedCustomer = await res.json();
          setSelectedCustomer(updatedCustomer);
          const resLedger = await fetch(`/api/customers/${selectedCustomer.id}/ledger`);
          if (resLedger.ok) setCustomerLedger(await resLedger.json());
        }
      } else {
        const err = await res.json();
        alert(err.error || "فشلت العملية");
      }
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      {/* Top Header Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <input
            type="text"
            placeholder="بحث باسم العميل أو رقم الهاتف..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-3 pr-10 py-2.5 bg-white border border-stone-200 rounded-xl text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
          />
          <Search className="w-4 h-4 text-stone-400 absolute top-3 right-3" />
        </div>

        <button
          onClick={handleOpenAdd}
          className="py-2.5 px-4 bg-[#2E7D32] hover:bg-[#235F26] text-white text-xs font-bold rounded-xl flex items-center gap-1.5 justify-center transition-all shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة عميل جديد</span>
        </button>
      </div>

      {/* Customers List Table */}
      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-5 border-b border-stone-100">
          <h3 className="font-bold text-stone-800 text-sm">قائمة العملاء (CRM)</h3>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 font-bold">
                <th className="p-4">اسم العميل</th>
                <th className="p-4">رقم الهاتف</th>
                <th className="p-4 text-center">نقاط الولاء</th>
                <th className="p-4 text-center">الحساب الآجل المستحق</th>
                <th className="p-4 text-center">إجمالي المشتريات</th>
                <th className="p-4 text-center">عدد الزيارات</th>
                <th className="p-4 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100 font-medium">
              {customers.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50/50">
                  <td className="p-4 font-bold text-stone-800">{c.name}</td>
                  <td className="p-4 font-mono text-stone-600">{c.phone || "—"}</td>
                  <td className="p-4 text-center">
                    <span className="bg-amber-50 text-amber-800 border border-amber-100 px-2 py-0.5 rounded text-[10px] font-bold inline-flex items-center gap-1">
                      <Award className="w-3 h-3" />
                      <span>{c.loyaltyPoints || 0} نقطة</span>
                    </span>
                  </td>
                  <td className="p-4 text-center font-mono font-bold">
                    {c.creditBalance > 0 ? (
                      <span className="text-red-600 bg-red-50 px-2.5 py-0.5 rounded">
                        {c.creditBalance.toFixed(2)} {currency}
                      </span>
                    ) : (
                      <span className="text-stone-400">0.00</span>
                    )}
                  </td>
                  <td className="p-4 text-center font-mono text-stone-600">{c.totalSpent?.toFixed(2) || "0.00"} {currency}</td>
                  <td className="p-4 text-center font-mono text-stone-500">{c.visitsCount || 0}</td>
                  <td className="p-4 text-center">
                    <div className="flex gap-1 justify-center">
                      <button
                        onClick={() => handleViewDetails(c)}
                        className="p-1 hover:bg-stone-100 border border-stone-200 rounded text-stone-600"
                        title="تفاصيل وملخص الحساب"
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleOpenEdit(c)}
                        className="p-1 hover:bg-stone-100 border border-stone-200 rounded text-stone-600"
                        title="تعديل"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      {c.creditBalance > 0 && (
                        <button
                          onClick={() => handleOpenPayment(c)}
                          className="py-1 px-2.5 bg-green-50 hover:bg-green-100 border border-green-200 text-green-700 rounded text-[10px] font-bold"
                          title="تسجيل دفعة سداد"
                        >
                          تحصيل دفعة
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {customers.length === 0 && (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-stone-400">
                    لا يوجد عملاء مطابقين للبحث.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Create/Edit Customer */}
      {showAddModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveCustomer} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-right">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <button type="button" onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-stone-800 text-sm">
                {editingCustomer ? "تعديل العميل" : "إضافة عميل جديد للولاء والآجل"}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">اسم العميل بالكامل</label>
                <input
                  type="text"
                  required
                  value={custName}
                  onChange={(e) => setCustName(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                  placeholder="محمد أحمد، إلخ..."
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">رقم الهاتف</label>
                <input
                  type="text"
                  value={custPhone}
                  onChange={(e) => setCustPhone(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none font-mono"
                  placeholder="05xxxxxxxx"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">البريد الإلكتروني (اختياري)</label>
                <input
                  type="email"
                  value={custEmail}
                  onChange={(e) => setCustEmail(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-left focus:outline-none font-mono"
                  placeholder="name@domain.com"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">ملاحظات العميل</label>
                <textarea
                  value={custNotes}
                  onChange={(e) => setCustNotes(e.target.value)}
                  rows={2}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-right focus:outline-none resize-none"
                  placeholder="عنوان المنزل، تفاصيل إضافية..."
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="py-2 px-4 border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-bold rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="py-2 px-5 bg-[#2E7D32] hover:bg-[#235F26] text-white text-xs font-bold rounded-xl shadow-sm"
              >
                حفظ العميل
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Customer Payment */}
      {showPaymentModal && selectedCustomer && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSavePayment} className="bg-white rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-xl text-right">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <button type="button" onClick={() => setShowPaymentModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-stone-800 text-sm">تحصيل دفعة مالية — {selectedCustomer.name}</h3>
            </div>

            <div className="bg-stone-50 border border-stone-100 p-3 rounded-xl space-y-1 text-xs">
              <div className="flex justify-between text-stone-500">
                <span>الرصيد الآجل المتبقي حالياً:</span>
                <span className="font-bold text-red-600 font-mono">{selectedCustomer.creditBalance.toFixed(2)} {currency}</span>
              </div>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">قيمة الدفعة المحصلة ({currency})</label>
                <input
                  type="number"
                  required
                  step="any"
                  max={selectedCustomer.creditBalance}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-center focus:outline-none font-bold font-mono"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">ملاحظات الإيداع / الإيصال</label>
                <input
                  type="text"
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                  placeholder="سداد جزء/كامل الحساب الآجل"
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end border-t border-stone-100 pt-3">
              <button
                type="button"
                onClick={() => setShowPaymentModal(false)}
                className="py-2 px-4 border border-stone-200 hover:bg-stone-50 text-stone-600 text-xs font-bold rounded-xl"
              >
                إلغاء
              </button>
              <button
                type="submit"
                className="py-2 px-5 bg-[#2E7D32] hover:bg-[#235F26] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>تسجيل التحصيل</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* MODAL: Customer Profile details & Ledger */}
      {showDetailsModal && selectedCustomer && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-xl text-right flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3 shrink-0">
              <button type="button" onClick={() => setShowDetailsModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-stone-800 text-sm">ملف تفاصيل العميل: {selectedCustomer.name}</h3>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 flex-1">
              {/* Profile KPI Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-stone-50 border border-stone-100 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-stone-400">إجمالي المشتريات</span>
                  <span className="text-sm font-extrabold text-stone-800 font-mono mt-1">
                    {selectedCustomer.totalSpent?.toFixed(2) || "0.00"} {currency}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-100 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-stone-400">الرصيد الآجل المطلوب</span>
                  <span className="text-sm font-extrabold text-red-600 font-mono mt-1">
                    {selectedCustomer.creditBalance.toFixed(2)} {currency}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-100 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-stone-400">نقاط الولاء</span>
                  <span className="text-sm font-extrabold text-amber-700 font-mono mt-1">
                    {selectedCustomer.loyaltyPoints || 0}
                  </span>
                </div>
                <div className="bg-stone-50 border border-stone-100 p-3 rounded-xl flex flex-col justify-center items-center text-center">
                  <span className="text-[10px] font-bold text-stone-400">إجمالي الزيارات</span>
                  <span className="text-sm font-extrabold text-stone-800 font-mono mt-1">
                    {selectedCustomer.visitsCount || 0}
                  </span>
                </div>
              </div>

              {/* Details sections */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Section A: Customer Ledger (كشف الحساب المالي) */}
                <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-stone-800 text-xs border-b border-stone-100 pb-1.5 flex items-center justify-between">
                    <span>كشف حساب المديونيات والدفعات (Ledger)</span>
                    {selectedCustomer.creditBalance > 0 && (
                      <button
                        onClick={() => handleOpenPayment(selectedCustomer)}
                        className="py-1 px-2 bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 rounded text-[9px] font-bold transition-all"
                      >
                        سداد جزء
                      </button>
                    )}
                  </h4>

                  <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1">
                    {customerLedger.map(log => (
                      <div key={log.id} className={`border p-2.5 rounded-lg text-xs space-y-1 ${
                        log.type === "payment" ? "bg-green-50/20 border-green-100" : "bg-red-50/10 border-red-100"
                      }`}>
                        <div className="flex justify-between items-center font-bold">
                          <span className={log.type === "payment" ? "text-green-700" : "text-red-700"}>
                            {log.type === "payment" ? "سداد / تحصيل دفعة" : "شراء آجل"}
                          </span>
                          <span className="font-mono">
                            {log.type === "payment" ? "-" : "+"}{log.amount.toFixed(2)} {currency}
                          </span>
                        </div>
                        <p className="text-stone-500 font-medium text-[10px]">{log.notes}</p>
                        <div className="flex justify-between items-center text-[9px] text-stone-400 pt-1 border-t border-stone-50 font-medium">
                          <span>المنشئ: {log.createdBy}</span>
                          <span className="font-mono">{new Date(log.createdAt).toLocaleString("ar-EG")}</span>
                        </div>
                      </div>
                    ))}
                    {customerLedger.length === 0 && (
                      <div className="p-8 text-center text-stone-400 bg-stone-50/30 rounded-lg">
                        لا يوجد سجل عمليات آجل أو دفعات للعميل.
                      </div>
                    )}
                  </div>
                </div>

                {/* Section B: Order History */}
                <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-3">
                  <h4 className="font-bold text-stone-800 text-xs border-b border-stone-100 pb-1.5">
                    سجل الفواتير والطلبات
                  </h4>

                  <div className="max-h-[250px] overflow-y-auto space-y-2 pr-1">
                    {customerOrders.map(order => (
                      <div key={order.id} className="border border-stone-100 p-2.5 rounded-lg text-xs space-y-1 bg-stone-50/30">
                        <div className="flex justify-between items-center font-bold">
                          <span className="text-stone-800">فاتورة #FT-{order.orderNumber}</span>
                          <span className="font-mono">{order.total.toFixed(2)} {currency}</span>
                        </div>
                        <div className="flex justify-between text-[10px] text-stone-500 font-medium">
                          <span>طريقة الدفع: {order.payments.map((p: any) => p.method === "cash" ? "كاش" : p.method === "credit" ? "آجل" : "شبكة").join(" + ")}</span>
                          <span className="font-mono">{new Date(order.createdAt).toLocaleString("ar-EG")}</span>
                        </div>
                      </div>
                    ))}
                    {customerOrders.length === 0 && (
                      <div className="p-8 text-center text-stone-400 bg-stone-50/30 rounded-lg">
                        لا توجد مبيعات سابقة مسجلة لهذا العميل.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex justify-end border-t border-stone-100 pt-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowDetailsModal(false)}
                className="py-2 px-5 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all"
              >
                إغلاق النافذة
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
