import React, { useEffect, useState } from "react";
import { Plus, Edit2, Trash2, Check, X, Calendar, DollarSign, ArrowUpRight, TrendingUp, TrendingDown, ClipboardList } from "lucide-react";
import { User } from "../../types";

interface Expense {
  id: string;
  category: string;
  amount: number;
  description: string;
  date: string;
  createdAt: string;
  createdBy: string;
}

interface FinancialSummary {
  totalSales: number;
  totalExpenses: number;
  totalCOGS: number;
  netProfit: number;
  ordersCount: number;
  expensesCount: number;
}

interface FinancesTabProps {
  currentUser: User;
  currency: string;
}

const EXPENSE_CATEGORIES = [
  "إيجار العقار والفرع",
  "رواتب الموظفين والعمالة",
  "فواتير مياه وكهرباء وإنترنت",
  "صيانة عامة ومعدات",
  "دعاية وإعلان وتسويق",
  "رسوم حكومية وتراخيص",
  "أخرى / نثريات متنوعة"
];

export default function FinancesTab({ currentUser, currency }: FinancesTabProps) {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [summary, setSummary] = useState<FinancialSummary>({
    totalSales: 0,
    totalExpenses: 0,
    totalCOGS: 0,
    netProfit: 0,
    ordersCount: 0,
    expensesCount: 0,
  });

  // Filters
  const [fromDate, setFromDate] = useState(() => {
    const d = new Date();
    d.setDate(1); // Default to start of current month
    return d.toISOString().split("T")[0];
  });
  const [toDate, setToDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null);

  // Forms
  const [expCategory, setExpCategory] = useState(EXPENSE_CATEGORIES[0]);
  const [expCustomCategory, setExpCustomCategory] = useState("");
  const [expAmount, setExpAmount] = useState("");
  const [expDescription, setExpDescription] = useState("");
  const [expDate, setExpDate] = useState(() => new Date().toISOString().split("T")[0]);

  const fetchExpenses = async () => {
    try {
      const res = await fetch("/api/expenses");
      if (res.ok) setExpenses(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  const fetchFinancialSummary = async () => {
    try {
      const url = `/api/finances/summary?from=${fromDate}T00:00:00&to=${toDate}T23:59:59`;
      const res = await fetch(url);
      if (res.ok) setSummary(await res.json());
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchExpenses();
    fetchFinancialSummary();
  }, [fromDate, toDate]);

  const handleOpenAdd = () => {
    setEditingExpense(null);
    setExpCategory(EXPENSE_CATEGORIES[0]);
    setExpCustomCategory("");
    setExpAmount("");
    setExpDescription("");
    setExpDate(new Date().toISOString().split("T")[0]);
    setShowAddModal(true);
  };

  const handleOpenEdit = (e: Expense) => {
    setEditingExpense(e);
    if (EXPENSE_CATEGORIES.includes(e.category)) {
      setExpCategory(e.category);
      setExpCustomCategory("");
    } else {
      setExpCategory("أخرى / نثريات متنوعة");
      setExpCustomCategory(e.category);
    }
    setExpAmount(String(e.amount));
    setExpDescription(e.description);
    setExpDate(e.date);
    setShowAddModal(true);
  };

  const handleSaveExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    const finalCategory = expCategory === "أخرى / نثريات متنوعة" && expCustomCategory.trim() 
      ? expCustomCategory.trim() 
      : expCategory;

    const amountNum = Number(expAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert("الرجاء إدخال قيمة صحيحة للمصروف");
      return;
    }

    try {
      const url = editingExpense ? `/api/expenses/${editingExpense.id}` : "/api/expenses";
      const method = editingExpense ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          category: finalCategory,
          amount: amountNum,
          description: expDescription,
          date: expDate
        })
      });

      if (res.ok) {
        alert(editingExpense ? "تم تعديل المصروف بنجاح" : "تم تسجيل المصروف بنجاح");
        setShowAddModal(false);
        fetchExpenses();
        fetchFinancialSummary();
      } else {
        const err = await res.json();
        alert(err.error || "فشلت العملية");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء حفظ المصروف");
    }
  };

  const handleDeleteExpense = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا المصروف نهائياً؟")) return;
    try {
      const res = await fetch(`/api/expenses/${id}`, { method: "DELETE" });
      if (res.ok) {
        alert("تم حذف المصروف بنجاح");
        fetchExpenses();
        fetchFinancialSummary();
      } else {
        alert("فشل حذف المصروف");
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper percentages for standard visual charts
  const totalOutgoings = summary.totalExpenses + summary.totalCOGS;
  const cogsPercent = summary.totalSales > 0 ? (summary.totalCOGS / summary.totalSales) * 100 : 0;
  const expPercent = summary.totalSales > 0 ? (summary.totalExpenses / summary.totalSales) * 100 : 0;
  const profitPercent = summary.totalSales > 0 ? (summary.netProfit / summary.totalSales) * 100 : 0;

  return (
    <div className="space-y-6">
      {/* Date Filters Header */}
      <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm text-right flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h3 className="font-bold text-stone-800 text-sm">الحسابات والمالية وصافي الأرباح</h3>
          <p className="text-stone-400 text-xs mt-1">تتبع التدفقات المالية والمصاريف التشغيلية للمنشأة</p>
        </div>

        <div className="flex flex-wrap items-center gap-3 justify-end">
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-bold">من</span>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E7D32] bg-stone-50"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-stone-500 font-bold">إلى</span>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="border border-stone-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-[#2E7D32] bg-stone-50"
            />
          </div>
          <button
            onClick={fetchFinancialSummary}
            className="px-4 py-2 bg-stone-100 hover:bg-stone-200 text-stone-700 text-xs font-bold rounded-xl transition-all"
          >
            تحديث البيانات 🔄
          </button>
        </div>
      </div>

      {/* Financial Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Sales Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex items-center justify-between text-right">
          <div className="space-y-1">
            <span className="text-xs font-bold text-stone-400">إجمالي المبيعات (الخام)</span>
            <p className="text-2xl font-extrabold text-stone-800 font-mono">
              {summary.totalSales.toFixed(2)} <span className="text-xs font-bold font-sans">{currency}</span>
            </p>
            <span className="text-[10px] text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-full inline-block">
              {summary.ordersCount} فاتورة مدفوعة
            </span>
          </div>
          <div className="p-3 bg-green-50 text-[#2E7D32] rounded-2xl">
            <ArrowUpRight className="w-6 h-6" />
          </div>
        </div>

        {/* Total COGS Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex items-center justify-between text-right">
          <div className="space-y-1">
            <span className="text-xs font-bold text-stone-400">تكلفة المواد والمنتجات (COGS)</span>
            <p className="text-2xl font-extrabold text-[#9A733E] font-mono">
              {summary.totalCOGS.toFixed(2)} <span className="text-xs font-bold font-sans">{currency}</span>
            </p>
            <span className="text-[10px] text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-full inline-block">
              من وصفات المنيو
            </span>
          </div>
          <div className="p-3 bg-amber-50 text-amber-700 rounded-2xl">
            <ClipboardList className="w-6 h-6" />
          </div>
        </div>

        {/* Total Expenses Card */}
        <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm flex items-center justify-between text-right">
          <div className="space-y-1">
            <span className="text-xs font-bold text-stone-400">المصاريف التشغيلية</span>
            <p className="text-2xl font-extrabold text-red-600 font-mono">
              {summary.totalExpenses.toFixed(2)} <span className="text-xs font-bold font-sans">{currency}</span>
            </p>
            <span className="text-[10px] text-stone-400 font-bold bg-stone-50 px-2 py-0.5 rounded-full inline-block">
              {summary.expensesCount} مصاريف مسجلة
            </span>
          </div>
          <div className="p-3 bg-red-50 text-red-600 rounded-2xl">
            <TrendingDown className="w-6 h-6" />
          </div>
        </div>

        {/* Net Profit Card */}
        <div className={`border rounded-2xl p-5 shadow-sm flex items-center justify-between text-right ${
          summary.netProfit >= 0 ? "bg-emerald-50/30 border-emerald-100" : "bg-red-50/30 border-red-100"
        }`}>
          <div className="space-y-1">
            <span className="text-xs font-bold text-stone-500">صافي الأرباح (مبيعات - مصاريف - تكاليف)</span>
            <p className={`text-2xl font-extrabold font-mono ${
              summary.netProfit >= 0 ? "text-[#2E7D32]" : "text-red-700"
            }`}>
              {summary.netProfit.toFixed(2)} <span className="text-xs font-bold font-sans">{currency}</span>
            </p>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block ${
              summary.netProfit >= 0 ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
            }`}>
              {summary.netProfit >= 0 ? "أداء مالي إيجابي 👍" : "عجز / خسارة مالية ⚠️"}
            </span>
          </div>
          <div className={`p-3 rounded-xl ${
            summary.netProfit >= 0 ? "bg-[#2E7D32] text-white" : "bg-red-600 text-white"
          }`}>
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Visual Breakdown & Expenses List split */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Expenses List */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5 space-y-4 lg:col-span-2 text-right">
          <div className="flex justify-between items-center border-b border-stone-100 pb-3">
            <button
              onClick={handleOpenAdd}
              className="py-1.5 px-3 bg-[#2E7D32] hover:bg-[#235F26] text-white text-[11px] font-bold rounded-lg flex items-center gap-1 transition-all"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>تسجيل مصروف</span>
            </button>
            <h3 className="font-bold text-stone-800 text-sm">سجل المصاريف التشغيلية</h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-100 text-stone-500 font-bold">
                  <th className="p-3">التاريخ</th>
                  <th className="p-3">الفئة</th>
                  <th className="p-3">القيمة</th>
                  <th className="p-3">البيان / الوصف</th>
                  <th className="p-3">المنشئ</th>
                  <th className="p-3 text-center">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-stone-100 font-medium">
                {expenses.map((e) => (
                  <tr key={e.id} className="hover:bg-stone-50/50">
                    <td className="p-3 font-mono text-stone-600">{e.date}</td>
                    <td className="p-3 font-bold text-stone-800">{e.category}</td>
                    <td className="p-3 font-mono font-bold text-red-600">{e.amount.toFixed(2)} {currency}</td>
                    <td className="p-3 text-stone-500 max-w-[200px] truncate" title={e.description}>{e.description || "—"}</td>
                    <td className="p-3 text-stone-400">{e.createdBy}</td>
                    <td className="p-3 text-center">
                      <div className="flex gap-1 justify-center">
                        <button
                          onClick={() => handleOpenEdit(e)}
                          className="p-1 text-stone-500 hover:bg-stone-100 border border-stone-200 rounded"
                          title="تعديل"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(e.id)}
                          className="p-1 text-red-500 hover:bg-red-50 border border-red-100 rounded"
                          title="حذف"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {expenses.length === 0 && (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-stone-400">
                      لا توجد مصاريف مسجلة حتى الآن.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Financial Visual Chart (SVG based) */}
        <div className="bg-white border border-stone-200 rounded-2xl shadow-sm p-5 space-y-4 text-right flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-stone-800 text-sm border-b border-stone-100 pb-3">تحليل هيكل المصاريف والأرباح</h3>
            <p className="text-stone-400 text-xs mt-1">نسب التكاليف التشغيلية مقارنة بإجمالي المبيعات</p>
          </div>

          <div className="flex-1 flex flex-col justify-center py-6 space-y-5">
            {/* Sales Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-stone-400">100%</span>
                <span className="text-stone-700">إجمالي المبيعات</span>
              </div>
              <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                <div className="bg-[#2E7D32] h-full" style={{ width: "100%" }} />
              </div>
            </div>

            {/* COGS Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-stone-400">{cogsPercent.toFixed(1)}%</span>
                <span className="text-[#9A733E]">تكلفة البضاعة المباعة</span>
              </div>
              <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                <div className="bg-[#9A733E] h-full" style={{ width: `${Math.min(100, cogsPercent)}%` }} />
              </div>
            </div>

            {/* Expenses Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className="text-stone-400">{expPercent.toFixed(1)}%</span>
                <span className="text-red-600">المصاريف التشغيلية</span>
              </div>
              <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                <div className="bg-red-600 h-full" style={{ width: `${Math.min(100, expPercent)}%` }} />
              </div>
            </div>

            {/* Profit Bar */}
            <div className="space-y-1">
              <div className="flex justify-between text-xs font-bold">
                <span className={summary.netProfit >= 0 ? "text-[#2E7D32]" : "text-red-700"}>
                  {profitPercent.toFixed(1)}%
                </span>
                <span className="text-stone-700">هامش الأرباح الصافي</span>
              </div>
              <div className="w-full bg-stone-100 h-3 rounded-full overflow-hidden">
                <div className={`h-full ${summary.netProfit >= 0 ? "bg-emerald-500" : "bg-red-500"}`} style={{ width: `${Math.max(0, Math.min(100, profitPercent))}%` }} />
              </div>
            </div>
          </div>

          <div className="bg-stone-50 rounded-xl p-3 text-[11px] text-stone-500 font-medium leading-relaxed">
            * يتم احتساب الأرقام والنسب بناءً على نطاق التواريخ المفلتر أعلاه. يتم خصم قيمة المصروفات والمشتريات لتقدير دقيق لصافي الأرباح التشغيلية.
          </div>
        </div>
      </div>

      {/* MODAL: Record Expense */}
      {showAddModal && (
        <div className="fixed inset-0 bg-stone-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <form onSubmit={handleSaveExpense} className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-xl text-right">
            <div className="flex justify-between items-center border-b border-stone-100 pb-3">
              <button type="button" onClick={() => setShowAddModal(false)} className="text-stone-400 hover:text-stone-700">
                <X className="w-5 h-5" />
              </button>
              <h3 className="font-bold text-stone-800 text-sm">
                {editingExpense ? "تعديل المصروف التشغيلي" : "تسجيل مصروف جديد"}
              </h3>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">فئة المصروف</label>
                <select
                  value={expCategory}
                  onChange={(e) => setExpCategory(e.target.value)}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#2E7D32] font-bold text-stone-700"
                >
                  {EXPENSE_CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {expCategory === "أخرى / نثريات متنوعة" && (
                <div>
                  <label className="block text-xs font-bold text-[#2E7D32] mb-1">اكتب اسم فئة المصروف المخصصة</label>
                  <input
                    type="text"
                    required
                    value={expCustomCategory}
                    onChange={(e) => setExpCustomCategory(e.target.value)}
                    className="w-full border border-[#2E7D32]/30 rounded-xl bg-green-50/10 p-2.5 text-xs text-right focus:outline-none"
                    placeholder="مثال: فاتورة صيانة أجهزة الكاشير..."
                  />
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">التاريخ</label>
                  <input
                    type="date"
                    required
                    value={expDate}
                    onChange={(e) => setExpDate(e.target.value)}
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-center focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-500 mb-1">القيمة المحصلة ({currency})</label>
                  <input
                    type="number"
                    required
                    step="any"
                    value={expAmount}
                    onChange={(e) => setExpAmount(e.target.value)}
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-center focus:outline-none font-bold font-mono"
                    placeholder="0.00"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-500 mb-1">البيان / الوصف الإضافي</label>
                <textarea
                  value={expDescription}
                  onChange={(e) => setExpDescription(e.target.value)}
                  rows={3}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none resize-none"
                  placeholder="وصف وتفاصيل المصروف أو السداد..."
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
                className="py-2 px-5 bg-[#2E7D32] hover:bg-[#235F26] text-white text-xs font-bold rounded-xl shadow-sm flex items-center gap-1"
              >
                <Check className="w-3.5 h-3.5" />
                <span>حفظ المصروف</span>
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
