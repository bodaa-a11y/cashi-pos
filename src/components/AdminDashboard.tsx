import React, { useState, useEffect } from "react";
import {
  TrendingUp,
  BarChart2,
  List,
  Map,
  Users,
  Database,
  Calendar,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Package,
  ArrowRight,
  AlertTriangle,
  Download,
  DollarSign,
  ShoppingCart,
  FileSpreadsheet,
  Check,
  X,
  Settings,
  Printer,
  Clock,
  Globe,
  Sliders
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { Category, Product, RestaurantTable, User, Shift } from "../types";

interface AdminDashboardProps {
  onBack: () => void;
  currentUser: User;
}

const COLORS = ["#0088FE", "#00C49F", "#FFBB28", "#FF8042", "#8884d8", "#82ca9d"];

export default function AdminDashboard({ onBack, currentUser }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"overview" | "menu" | "tables" | "staff" | "inventory" | "shifts" | "reports" | "settings" | "audit">("overview");
  const [dateFilter, setDateFilter] = useState<"today" | "week" | "month">("month");
  
  // إعدادات المنشأة وتطبيق الويب
  const [settingsForm, setSettingsForm] = useState({
    businessNameAr: "",
    businessNameEn: "",
    branchName: "",
    address: "",
    phone: "",
    taxNumber: "",
    currency: "ر.س",
    vatRate: 15,
    receiptFooter: "",
    logoBase64: ""
  });
  const [appInfo, setAppInfo] = useState<any>(null);
  
  // إعدادات الطباعة
  const [printersList, setPrintersList] = useState<string[]>([]);
  const [printerSettings, setPrinterSettings] = useState({
    type: "generic",
    interface: "usb",
    networkAddress: "",
    paperWidth: 80,
    autoCut: true,
    openDrawerOnCash: true,
    printerName: ""
  });
  
  // حالات صفحة التقارير والفواتير
  const [selectedReportType, setSelectedReportType] = useState<"daily" | "monthly" | "range">("daily");
  const [selectedReportDate, setSelectedReportDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedReportMonth, setSelectedReportMonth] = useState({
    year: new Date().getFullYear(),
    month: new Date().getMonth() + 1
  });
  const [selectedReportRange, setSelectedReportRange] = useState({
    from: new Date().toISOString().split("T")[0],
    to: new Date().toISOString().split("T")[0]
  });
  const [reportResult, setReportResult] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [latestOrders, setLatestOrders] = useState<any[]>([]);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState<any>(null);
  
  // Data lists
  const [analytics, setAnalytics] = useState<any>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);

  // CRUD state
  const [showProductModal, setShowProductModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [productForm, setProductForm] = useState({
    nameAr: "",
    nameEn: "",
    categoryId: "",
    price: "",
    cost: "",
    trackInventory: false,
    quantity: "",
    image: "",
    imageBase64: ""
  });

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryNameAr, setNewCategoryNameAr] = useState("");
  const [newCategoryNameEn, setNewCategoryNameEn] = useState("");

  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [auditLogs, setAuditLogs] = useState<any[]>([]);

  const fetchAllData = async () => {
    setLoading(true);
    try {
      const [resMenu, resTables, resShifts, resUsers, resInventory, resAnalytics, resAuditLogs] = await Promise.all([
        fetch("/api/menu"),
        fetch("/api/tables"),
        fetch("/api/shifts"),
        fetch("/api/users"),
        fetch("/api/inventory"),
        fetch("/api/reports/sales-summary"),
        fetch("/api/audit-logs")
      ]);

      if (resMenu.ok) {
        const menu = await resMenu.json();
        setCategories(menu.categories);
        setProducts(menu.products);
      }
      if (resTables.ok) {
        const tbls = await resTables.json();
        setTables(tbls);
      }
      if (resShifts.ok) {
        const shs = await resShifts.json();
        setShifts(shs);
      }
      if (resInventory.ok) {
        const inv = await resInventory.json();
        setInventory(inv);
      }
      if (resAnalytics.ok) {
        const ana = await resAnalytics.json();
        setAnalytics(ana);
      }
      if (resUsers.ok) {
        const usrs = await resUsers.json();
        setUsers(usrs);
      }
      if (resAuditLogs.ok) {
        const logs = await resAuditLogs.json();
        setAuditLogs(logs);
      }

    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  // جلب إعدادات المنشأة وإعدادات طابعات الويندوز
  const fetchSettingsAndAppInfo = async () => {
    try {
      const res = await fetch("/api/settings");
      if (res.ok) {
        const data = await res.json();
        if (data) setSettingsForm(data);
      }
    } catch (e) {
      console.error(e);
    }

    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      try {
        const info = await electronAPI.getAppInfo();
        setAppInfo(info);
        
        const printersRes = await electronAPI.getPrinterList();
        if (printersRes && printersRes.success) {
          setPrintersList(printersRes.printers || []);
        }
        
        const printSettingsRes = await electronAPI.getPrinterSettings();
        if (printSettingsRes && printSettingsRes.success && printSettingsRes.settings) {
          let loadedSettings = printSettingsRes.settings;
          if (loadedSettings.settings) {
            loadedSettings = loadedSettings.settings;
          }
          setPrinterSettings(loadedSettings);
        }
      } catch (e) {
        console.error(e);
      }
    }
  };

  // جلب التقارير وقائمة الفواتير
  const handleFetchReport = async () => {
    setReportLoading(true);
    try {
      let url = "";
      if (selectedReportType === "daily") {
        url = `/api/reports/daily?date=${selectedReportDate}`;
      } else if (selectedReportType === "monthly") {
        url = `/api/reports/monthly?year=${selectedReportMonth.year}&month=${selectedReportMonth.month}`;
      } else {
        url = `/api/reports/date-range?from=${selectedReportRange.from}&to=${selectedReportRange.to}`;
      }

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setReportResult(data);
      } else {
        alert("فشل تحميل التقرير المطلوب");
      }
    } catch (e) {
      console.error(e);
    } finally {
      setReportLoading(false);
    }
  };

  const fetchLatestOrders = async () => {
    try {
      const res = await fetch("/api/orders/latest?limit=50");
      if (res.ok) {
        const data = await res.json();
        setLatestOrders(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchAllData();
    fetchSettingsAndAppInfo();
  }, [activeTab]);

  useEffect(() => {
    if (activeTab === "reports") {
      handleFetchReport();
      fetchLatestOrders();
    }
  }, [activeTab, selectedReportType, selectedReportDate, selectedReportMonth, selectedReportRange]);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settingsForm)
      });
      if (res.ok) {
        alert("تم حفظ إعدادات المنشأة بنجاح! 🎉");
      } else {
        alert("فشل حفظ الإعدادات");
      }
    } catch (e) {
      console.error(e);
      alert("حدث خطأ في الاتصال بالخادم");
    }
  };

  const handleSavePrinterSettings = async () => {
    const electronAPI = (window as any).electronAPI;
    if (electronAPI) {
      try {
        await electronAPI.savePrinterSettings(printerSettings);
        alert("تم حفظ إعدادات الطابعة الحرارية بنجاح! 🖨️");
      } catch (e) {
        console.error(e);
        alert("فشل حفظ إعدادات الطابعة");
      }
    } else {
      alert("إعدادات الطابعة متاحة فقط عند تشغيل التطبيق كبرنامج ويندوز");
    }
  };

  const handleReprintOrder = async (order: any) => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI) {
      alert("الطباعة الحرارية متاحة فقط داخل برنامج الويندوز");
      return;
    }

    try {
      const bCurrency = settingsForm.currency || "ر.س";
      const bFooter = settingsForm.receiptFooter || "شكراً لزيارتكم!";
      const bName = settingsForm.businessNameAr || "كاشي";
      const bNameEn = settingsForm.businessNameEn || "Cashi";
      const bBranch = settingsForm.branchName || "";
      const bAddress = settingsForm.address || "";
      const bPhone = settingsForm.phone || "";
      const bTax = settingsForm.taxNumber || "";

      const html = `
        <div class="receipt-print text-stone-800 p-4 font-mono text-xs text-right leading-relaxed" style="width: 280px; font-family: 'Cairo', 'JetBrains Mono', monospace;">
          <div class="text-center border-b border-dashed border-stone-400 pb-2 mb-2">
            ${settingsForm.logoBase64 ? `<img src="${settingsForm.logoBase64}" style="width:60px;height:60px;margin:0 auto 8px;object-fit:contain;" />` : ''}
            <h2 class="font-bold text-sm">${bName}</h2>
            ${bNameEn ? `<p class="text-[10px]">${bNameEn}</p>` : ''}
            ${bBranch ? `<p class="text-[10px]">${bBranch}</p>` : ''}
            ${bAddress ? `<p class="text-[10px]">${bAddress}</p>` : ''}
            ${bPhone ? `<p class="text-[10px]">هاتف: ${bPhone}</p>` : ''}
            ${bTax ? `<p class="text-[10px]">الرقم الضريبي: ${bTax}</p>` : ''}
          </div>
          <div class="space-y-0.5 border-b border-dashed border-stone-400 pb-2 mb-2">
            <p class="font-bold">نسخة معادة - فاتورة رقم: #FT-${order.orderNumber}</p>
            <p>التاريخ الأصلي: ${new Date(order.createdAt).toLocaleString('ar-EG')}</p>
            <p>تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
            <p>النوع: ${order.orderType === 'dine_in' ? 'داخلي' : order.orderType === 'takeaway' ? 'سفري' : 'توصيل'}</p>
          </div>
          <table class="w-full text-right mb-2">
            <thead>
              <tr class="border-b border-stone-300">
                <th class="font-bold">الصنف</th>
                <th class="font-bold text-center">الكمية</th>
                <th class="font-bold text-left">المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${order.items.map((item: any) => `
                <tr>
                  <td>${item.productNameSnapshot}</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-left">${item.lineTotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="border-t border-dashed border-stone-400 pt-2 space-y-0.5">
            <div class="flex justify-between"><span>الإجمالي الفرعي:</span><span>${order.subtotal.toFixed(2)} ${bCurrency}</span></div>
            ${order.discountAmount > 0 ? `<div class="flex justify-between text-red-600"><span>الخصم:</span><span>-${order.discountAmount.toFixed(2)} ${bCurrency}</span></div>` : ''}
            <div class="flex justify-between"><span>الضريبة:</span><span>${order.taxAmount.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between font-bold text-sm border-t border-stone-300 pt-1"><span>الإجمالي الكلي:</span><span>${order.total.toFixed(2)} ${bCurrency}</span></div>
          </div>
          <div class="text-center mt-4 border-t border-dashed border-stone-400 pt-2 text-[10px]">
            <p>${bFooter}</p>
            <p class="mt-1">مشغّل بواسطة كاشي Cashi</p>
          </div>
        </div>
      `;

      await electronAPI.printReceipt({ html });
      alert("تم إعادة إرسال الفاتورة للطابعة بنجاح! 🖨️");
    } catch (e) {
      console.error(e);
      alert("حدث خطأ في الطباعة");
    }
  };

  const handlePrintReport = async () => {
    const electronAPI = (window as any).electronAPI;
    if (!electronAPI || !reportResult) {
      alert("الطباعة متاحة فقط من داخل برنامج كاشي للويندوز");
      return;
    }

    try {
      const bCurrency = settingsForm.currency || "ر.س";
      const bName = settingsForm.businessNameAr || "كاشي";
      let reportTitle = "";
      let dateText = "";

      if (selectedReportType === "daily") {
        reportTitle = "تقرير المبيعات اليومي";
        dateText = `التاريخ: ${selectedReportDate}`;
      } else if (selectedReportType === "monthly") {
        reportTitle = "تقرير المبيعات الشهري";
        dateText = `الشهر: ${selectedReportMonth.month} / ${selectedReportMonth.year}`;
      } else {
        reportTitle = "تقرير المبيعات المخصص";
        dateText = `من: ${selectedReportRange.from}  إلى: ${selectedReportRange.to}`;
      }

      const html = `
        <div class="receipt-print text-stone-800 p-4 font-mono text-xs text-right leading-relaxed" style="width: 280px; font-family: 'Cairo', 'JetBrains Mono', monospace;">
          <div class="text-center border-b border-dashed border-stone-400 pb-2 mb-2">
            <h2 class="font-bold text-sm">${bName}</h2>
            <h3 class="font-bold text-xs mt-1 bg-stone-100 py-1">${reportTitle}</h3>
            <p class="text-[9px] mt-1 text-stone-600">${dateText}</p>
            <p class="text-[9px]">تاريخ الطباعة: ${new Date().toLocaleString('ar-EG')}</p>
          </div>
          <div class="space-y-1.5 border-b border-dashed border-stone-400 pb-2 mb-2">
            <div class="flex justify-between"><span>إجمالي المبيعات:</span><span class="font-bold">${reportResult.totalSales.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between"><span>إجمالي التكلفة:</span><span>${reportResult.totalCost.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between font-bold"><span>صافي الأرباح:</span><span class="text-emerald-700">${reportResult.profit.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between"><span>إجمالي الضريبة:</span><span>${reportResult.totalTax.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between"><span>عدد الفواتير:</span><span>${reportResult.orderCount} فاتورة</span></div>
            <div class="flex justify-between"><span>متوسط الفاتورة:</span><span>${reportResult.avgOrderValue.toFixed(2)} ${bCurrency}</span></div>
          </div>
          <div class="border-b border-dashed border-stone-400 pb-2 mb-2">
            <p class="font-bold text-center mb-1">المبيعات حسب التصنيفات</p>
            ${reportResult.categorySales.map((c: any) => `
              <div class="flex justify-between text-[10px]"><span>${c.name}:</span><span>${c.value.toFixed(2)} ${bCurrency}</span></div>
            `).join('')}
          </div>
          <div class="border-b border-dashed border-stone-400 pb-2 mb-2">
            <p class="font-bold text-center mb-1">المنتجات الأكثر مبيعاً</p>
            ${reportResult.topSelling.map((p: any, idx: number) => `
              <div class="flex justify-between text-[10px]"><span>${idx+1}. ${p.name}:</span><span>${p.qty} وحدة</span></div>
            `).join('')}
          </div>
          <div class="text-center mt-3 text-[9px] text-stone-400">
            <p>نظام كاشي لإدارة نقاط البيع</p>
          </div>
        </div>
      `;

      await electronAPI.printReceipt({ html });
      alert("تم إرسال تقرير المبيعات للطابعة الحرارية بنجاح! 🖨️");
    } catch (e) {
      console.error(e);
      alert("فشل طباعة التقرير");
    }
  };

  const handleLogoUploadSettings = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setSettingsForm({ ...settingsForm, logoBase64: ev.target?.result as string });
    };
    reader.readAsDataURL(file);
  };

  const handleProductImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      setProductForm(p => ({
        ...p,
        imageBase64: ev.target?.result as string
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!productForm.nameAr || !productForm.categoryId || !productForm.price || !productForm.cost) {
      alert("الرجاء ملء الحقول الأساسية المطلوبة");
      return;
    }

    const payload = {
      ...productForm,
      price: Number(productForm.price),
      cost: Number(productForm.cost),
      quantity: Number(productForm.quantity) || 0
    };

    try {
      let res;
      if (editingProduct) {
        res = await fetch(`/api/products/${editingProduct.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      } else {
        res = await fetch("/api/products", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
      }

      if (res.ok) {
        setShowProductModal(false);
        setEditingProduct(null);
        setProductForm({
          nameAr: "",
          nameEn: "",
          categoryId: "",
          price: "",
          cost: "",
          trackInventory: false,
          quantity: "",
          image: "",
          imageBase64: ""
        });
        fetchAllData();
      } else {
        alert("حدث خطأ أثناء حفظ المنتج");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryNameAr || !newCategoryNameEn) {
      alert("يرجى تعبئة أسماء الفئة باللغتين");
      return;
    }

    try {
      const res = await fetch("/api/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameAr: newCategoryNameAr,
          nameEn: newCategoryNameEn
        })
      });

      if (res.ok) {
        setShowCategoryModal(false);
        setNewCategoryNameAr("");
        setNewCategoryNameEn("");
        fetchAllData();
      } else {
        alert("فشل إنشاء الفئة");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm("هل أنت متأكد من رغبتك في حذف هذا الصنف من المنيو؟")) return;
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: "DELETE"
      });
      if (res.ok) {
        fetchAllData();
      } else {
        alert("فشل حذف المنتج");
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleExportCSV = () => {
    // Generate a simple CSV spreadsheet simulated download
    const rows = [
      ["رقم المرجع", "التاريخ والوقت", "الكاشير", "نوع الطلب", "الإجمالي"],
      ...(analytics?.chartData || []).map((c: any, i: number) => [`#ORD-${1000 + i}`, c.date, "أحمد كاشير", "داخلي / صالة", `${c.sales} ر.س`])
    ];

    let csvContent = "data:text/csv;charset=utf-8,\uFEFF" + rows.map(e => e.join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `تقارير_المبيعات_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const filteredProducts = products.filter(p =>
    p.nameAr.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.nameEn && p.nameEn.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-stone-100 flex flex-col font-sans">
      
      {/* Upper Navigation Panel */}
      <header className="bg-[#2E7D32] text-white px-6 py-4 shadow-md shrink-0 flex items-center justify-between">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-sm bg-white/10 hover:bg-white/20 px-3.5 py-2 rounded-xl border border-white/10 transition-all font-bold"
        >
          <ArrowRight className="w-4 h-4" />
          <span>رجوع لكاشير البيع</span>
        </button>

        <div className="text-center">
          <h2 className="text-xl font-bold">لوحة التحكم الإدارية الكبرى</h2>
          <p className="text-xs text-white/70">مرحباً، {currentUser.fullName} ({currentUser.role === 'admin' ? 'المدير العام' : 'مدير صالة'})</p>
        </div>

        <button
          onClick={fetchAllData}
          disabled={loading}
          className="p-2 hover:bg-white/10 rounded-xl text-white transition-all border border-white/10"
          title="تحديث البيانات"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </header>

      {/* Grid wrapper for panel tabs & workspace */}
      <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
        
        {/* Sidebar tabs */}
        <nav className="w-full md:w-64 bg-white border-l border-stone-200 p-4 space-y-1 overflow-y-auto shrink-0">
          <button
            onClick={() => setActiveTab("overview")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "overview" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            <span>نظرة عامة والتحليلات</span>
          </button>
          <button
            onClick={() => setActiveTab("menu")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "menu" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <List className="w-4 h-4" />
            <span>إدارة المنيو والأصناف</span>
          </button>
          <button
            onClick={() => setActiveTab("tables")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "tables" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Map className="w-4 h-4" />
            <span>خارطة الصالة والطاولات</span>
          </button>
          <button
            onClick={() => setActiveTab("inventory")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "inventory" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Package className="w-4 h-4" />
            <span>إدارة المخازن والمستودع</span>
          </button>
          <button
            onClick={() => setActiveTab("staff")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "staff" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Users className="w-4 h-4" />
            <span>الموظفون والصلاحيات</span>
          </button>
          <button
            onClick={() => setActiveTab("shifts")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "shifts" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Calendar className="w-4 h-4" />
            <span>سجل الورديات المقفلة</span>
          </button>
          
          <button
            onClick={() => setActiveTab("reports")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "reports" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <BarChart2 className="w-4 h-4" />
            <span>التقارير المتقدمة والفواتير</span>
          </button>

           <button
            onClick={() => setActiveTab("audit")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "audit" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Clock className="w-4 h-4 text-amber-600" />
            <span>سجل تدقيق العمليات (Audit)</span>
          </button>

          <button
            onClick={() => setActiveTab("settings")}
            className={`w-full py-3 px-4 rounded-xl font-bold text-sm text-right flex items-center justify-between transition-all ${
              activeTab === "settings" ? "bg-[#EAF4EA] text-[#2E7D32]" : "text-stone-600 hover:bg-stone-50"
            }`}
          >
            <Settings className="w-4 h-4" />
            <span>إعدادات النظام والطباعة</span>
          </button>
        </nav>

        {/* Dynamic Workspace Container */}
        <main className="flex-1 overflow-y-auto p-6 text-right">
          
          {activeTab === "overview" && (
            <div className="space-y-6">
              
              {/* Filter bar and download */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between bg-white border border-stone-200 rounded-xl p-4">
                <button
                  onClick={handleExportCSV}
                  className="w-full sm:w-auto px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow flex items-center justify-center gap-2 transition-all"
                >
                  <FileSpreadsheet className="w-4 h-4" />
                  <span>تصدير التقارير كملف Excel / CSV</span>
                </button>

                <div className="flex bg-stone-100 p-1 rounded-lg w-full sm:w-auto">
                  <button
                    onClick={() => setDateFilter("month")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                      dateFilter === "month" ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600"
                    }`}
                  >
                    أخر 30 يوم
                  </button>
                  <button
                    onClick={() => setDateFilter("week")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                      dateFilter === "week" ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600"
                    }`}
                  >
                    أخر 7 أيام
                  </button>
                  <button
                    onClick={() => setDateFilter("today")}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md transition-all ${
                      dateFilter === "today" ? "bg-white text-[#2E7D32] shadow-sm" : "text-stone-600"
                    }`}
                  >
                    اليوم
                  </button>
                </div>
              </div>

              {/* Stat Cards */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="p-3 bg-green-50 rounded-xl text-[#2E7D32]">
                      <DollarSign className="w-6 h-6" />
                    </span>
                    <p className="text-xs text-stone-500 font-bold">إجمالي المبيعات المحصلة</p>
                  </div>
                  <p className="text-3xl font-extrabold text-[#2E7D32] font-mono mt-3">{(analytics?.totalSales || 0).toFixed(2)} <span className="text-sm font-sans">ر.س</span></p>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="p-3 bg-blue-50 rounded-xl text-blue-600">
                      <ShoppingCart className="w-6 h-6" />
                    </span>
                    <p className="text-xs text-stone-500 font-bold">إجمالي فواتير الصالة سفري / محلي</p>
                  </div>
                  <p className="text-3xl font-extrabold text-stone-800 font-mono mt-3">{analytics?.orderCount} <span className="text-sm font-sans">فواتير</span></p>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="p-3 bg-amber-50 rounded-xl text-amber-600">
                      <TrendingUp className="w-6 h-6" />
                    </span>
                    <p className="text-xs text-stone-500 font-bold">متوسط قيمة الفاتورة</p>
                  </div>
                  <p className="text-3xl font-extrabold text-stone-800 font-mono mt-3">{(analytics?.avgOrderValue || 0).toFixed(2)} <span className="text-sm font-sans">ر.س</span></p>
                </div>

                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                  <div className="flex justify-between items-start">
                    <span className="p-3 bg-emerald-50 rounded-xl text-emerald-700">
                      <TrendingUp className="w-6 h-6" />
                    </span>
                    <p className="text-xs text-stone-500 font-bold">صافي الأرباح المقدرة</p>
                  </div>
                  <p className="text-3xl font-extrabold text-emerald-800 font-mono mt-3">{(analytics?.profit || 0).toFixed(2)} <span className="text-sm font-sans">ر.س</span></p>
                </div>
              </div>

              {/* Charts Zone */}
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Bar Chart Daily */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm lg:col-span-2 space-y-4">
                  <h3 className="font-bold text-stone-800 flex items-center justify-between text-right">
                    <span className="text-xs text-stone-400 font-normal">تحديث لحظي كل 30 ثانية</span>
                    <span>مبيعات الصالة اليومية (Bar Chart)</span>
                  </h3>
                  
                  <div className="h-64 w-full text-xs font-bold" dir="ltr">
                    {analytics?.chartData && analytics.chartData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={analytics.chartData}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis />
                          <Tooltip formatter={(value) => `${value} ر.س`} />
                          <Bar dataKey="sales" fill="#2E7D32" radius={[4, 4, 0, 0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-stone-400">
                        لا توجد بيانات كافية لعرض الرسم البياني
                      </div>
                    )}
                  </div>
                </div>

                {/* Pie Chart Categories */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-stone-800 text-right">توزيع المبيعات بحسب الفئات</h3>
                  
                  <div className="h-44 w-full" dir="ltr">
                    {analytics?.categorySales && analytics.categorySales.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie
                            data={analytics.categorySales}
                            cx="50%"
                            cy="50%"
                            innerRadius={40}
                            outerRadius={65}
                            fill="#8884d8"
                            paddingAngle={5}
                            dataKey="value"
                          >
                            {analytics.categorySales.map((entry: any, index: number) => (
                              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(value) => `${value} ر.س`} />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-stone-400">
                        لا توجد مبيعات مسجلة
                      </div>
                    )}
                  </div>

                  {/* Pie Legend list */}
                  <div className="space-y-1.5 max-h-24 overflow-y-auto">
                    {(analytics?.categorySales || []).map((entry: any, index: number) => (
                      <div key={entry.name} className="flex items-center justify-between text-xs">
                        <span className="font-bold font-mono text-stone-800">{entry.value.toFixed(2)} ر.س</span>
                        <div className="flex items-center gap-1.5">
                          <span className="font-bold text-stone-700">{entry.name}</span>
                          <span className="w-2.5 h-2.5 rounded-full inline-block" style={{ backgroundColor: COLORS[index % COLORS.length] }}></span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Lists section (Top selling & staff performance) */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Top selling */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3 text-right">
                  <h3 className="font-bold text-stone-800">الأصناف الأكثر مبيعاً ورواجاً</h3>
                  <div className="divide-y divide-stone-100">
                    {(analytics?.topSelling || []).map((item: any, i: number) => (
                      <div key={item.name} className="flex justify-between items-center py-2.5">
                        <span className="px-2.5 py-1 bg-[#EAF4EA] text-[#2E7D32] rounded-lg text-xs font-bold font-mono">
                          {item.qty} مبيعات
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-full bg-stone-100 text-stone-500 flex items-center justify-center font-bold text-xs">{i + 1}</span>
                          <span className="text-xs font-bold text-stone-700">{item.name}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Staff performance */}
                <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-3 text-right">
                  <h3 className="font-bold text-stone-800">أداء الكواشير والمبيعات المحققة</h3>
                  <div className="divide-y divide-stone-100">
                    {(analytics?.staffPerformance || []).map((staff: any) => (
                      <div key={staff.name} className="flex justify-between items-center py-2.5">
                        <span className="font-extrabold text-[#2E7D32] font-mono text-xs">
                          {staff.sales.toFixed(2)} ر.س
                        </span>
                        <span className="text-xs font-bold text-stone-700">{staff.name}</span>
                      </div>
                    ))}
                  </div>
                </div>

              </div>

            </div>
          )}

          {activeTab === "menu" && (
            <div className="space-y-6">
              
              {/* Menu manager buttons */}
              <div className="flex flex-col sm:flex-row gap-3 items-center justify-between">
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setEditingProduct(null);
                      setProductForm({
                        nameAr: "",
                        nameEn: "",
                        categoryId: categories[0]?.id || "",
                        price: "",
                        cost: "",
                        trackInventory: false,
                        quantity: ""
                      });
                      setShowProductModal(true);
                    }}
                    className="px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة صنف منتج جديد</span>
                  </button>

                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="px-4 py-2.5 border border-[#2E7D32] text-[#2E7D32] hover:bg-green-50 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    <span>إضافة فئة رئيسية</span>
                  </button>
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث بالاسم العربي أو الإنجليزي..."
                    className="w-full pr-9 pl-3 py-2 border border-stone-200 rounded-xl bg-white text-xs text-right focus:outline-none focus:border-[#2E7D32]"
                  />
                </div>
              </div>

              {/* Table list products */}
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-bold">
                    <tr>
                      <th className="p-4">اسم المنتج (عربي)</th>
                      <th className="p-4">اسم المنتج (EN)</th>
                      <th className="p-4">الفئة</th>
                      <th className="p-4 text-left">سعر البيع</th>
                      <th className="p-4 text-left">تكلفة المنتج</th>
                      <th className="p-4 text-center">تتبع المستودع</th>
                      <th className="p-4 text-center">الكمية المتوفرة</th>
                      <th className="p-4 text-center">خيارات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    {filteredProducts.map((prod) => {
                      const cat = categories.find(c => c.id === prod.categoryId);
                      return (
                        <tr key={prod.id} className="hover:bg-stone-50/50">
                          <td className="p-4 font-bold text-stone-800">{prod.nameAr}</td>
                          <td className="p-4 text-stone-500 font-mono">{prod.nameEn || "-"}</td>
                          <td className="p-4 text-stone-600 font-bold">{cat ? cat.nameAr : "غير محدد"}</td>
                          <td className="p-4 text-left font-bold font-mono text-[#2E7D32]">{prod.price.toFixed(2)} ر.س</td>
                          <td className="p-4 text-left font-mono text-stone-500">{prod.cost.toFixed(2)} ر.س</td>
                          <td className="p-4 text-center font-bold">
                            {prod.trackInventory ? (
                              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px]">نعم</span>
                            ) : (
                              <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded text-[10px]">لا</span>
                            )}
                          </td>
                          <td className="p-4 text-center font-mono font-bold text-stone-700">{prod.trackInventory ? prod.quantity : "∞"}</td>
                          <td className="p-4 flex gap-1.5 justify-center">
                            <button
                              onClick={() => {
                                setEditingProduct(prod);
                                setProductForm({
                                  nameAr: prod.nameAr,
                                  nameEn: prod.nameEn || "",
                                  categoryId: prod.categoryId,
                                  price: String(prod.price),
                                  cost: String(prod.cost),
                                  trackInventory: prod.trackInventory,
                                  quantity: String(prod.quantity || 0),
                                  image: prod.image || "",
                                  imageBase64: ""
                                });
                                setShowProductModal(true);
                              }}
                              className="p-1.5 text-stone-500 hover:text-[#2E7D32] hover:bg-green-50 rounded"
                              title="تعديل المنتج"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(prod.id)}
                              className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded"
                              title="حذف المنتج"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {activeTab === "tables" && (
            <div className="space-y-6">
              
              <div className="bg-white border border-stone-200 rounded-xl p-5 space-y-4">
                <h3 className="font-bold text-stone-800 text-right">مخطط وجدول الطاولات في الصالة</h3>
                <p className="text-xs text-stone-400">
                  معاينة وترتيب طاولات الصالون لتسهيل حجز العملاء وإسناد الندل لكل طلب داين إن.
                </p>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4">
                  {tables.map((tbl) => (
                    <div
                      key={tbl.id}
                      className={`border rounded-xl p-5 shadow-sm text-center space-y-2 ${
                        tbl.status === "free"
                          ? "bg-green-50/50 border-green-200 text-green-900"
                          : tbl.status === "occupied"
                          ? "bg-orange-50/50 border-orange-200 text-orange-900"
                          : "bg-red-50/50 border-red-200 text-red-900"
                      }`}
                    >
                      <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center mx-auto shadow font-extrabold text-[#2E7D32]">
                        {tbl.seats}
                      </div>
                      <p className="font-extrabold text-sm text-stone-800">{tbl.label}</p>
                      <p className="text-[10px] font-bold">
                        {tbl.status === "free" ? "متاحة ✅" : tbl.status === "occupied" ? "مشغولة عملاء 🍽️" : "محجوزة 🔒"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          )}

          {activeTab === "inventory" && (
            <div className="space-y-6">
              
              {/* Low inventory alert zones */}
              <div className="bg-amber-50 border-r-4 border-amber-500 rounded-xl p-4 text-amber-900 text-xs text-right space-y-2">
                <p className="font-bold flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                  <span>تنبيه: أصناف شارفت على النفاد في المستودعات (نقص عن الحد الأدنى)</span>
                </p>
                <p className="text-amber-700">
                  يوجد بعض مستلزمات المطبخ والمخزن التي انخفضت كميتها الفعالة عن حد الأمان الموصى به. يرجى مراجعة توريد بضائع جديدة.
                </p>
              </div>

              {/* Inventory table */}
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-bold">
                    <tr>
                      <th className="p-4">اسم المادة الخام</th>
                      <th className="p-4">الوحدة الاساسية</th>
                      <th className="p-4 text-center">الكمية المتوفرة حالياً</th>
                      <th className="p-4 text-center">حد النقص والأمان</th>
                      <th className="p-4 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    {inventory.map((item) => {
                      const isLow = item.quantity <= item.lowStockThreshold;
                      return (
                        <tr key={item.id} className="hover:bg-stone-50/50">
                          <td className="p-4 font-bold text-stone-800">{item.nameAr}</td>
                          <td className="p-4 text-stone-500">{item.unit}</td>
                          <td className={`p-4 text-center font-mono font-bold ${isLow ? "text-red-600" : "text-stone-700"}`}>
                            {item.quantity} {item.unit}
                          </td>
                          <td className="p-4 text-center font-mono text-stone-500">{item.lowStockThreshold} {item.unit}</td>
                          <td className="p-4 text-center">
                            {isLow ? (
                              <span className="bg-red-50 text-red-600 border border-red-100 px-2.5 py-1 rounded-full text-[10px] font-bold">
                                عجز / تزويد مطلوب ⚠️
                              </span>
                            ) : (
                              <span className="bg-green-50 text-green-700 border border-green-100 px-2.5 py-1 rounded-full text-[10px] font-bold">
                                سليم / آمن ✅
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {activeTab === "staff" && (
            <div className="space-y-6">
              
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-stone-100">
                  <h3 className="font-bold text-stone-800 text-right">إدارة الندل وصلاحيات موظفي الوردية</h3>
                </div>
                
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-bold">
                    <tr>
                      <th className="p-4">الاسم الكامل</th>
                      <th className="p-4">اسم المستخدم للوحات التحكم</th>
                      <th className="p-4">الدور الوظيفي</th>
                      <th className="p-4 text-center">كود الدخول السريع PIN</th>
                      <th className="p-4 text-center">الحالة</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-stone-50/50">
                        <td className="p-4 font-bold text-stone-800">{u.fullName}</td>
                        <td className="p-4 font-mono text-stone-400">{u.username || "ندل بدون هيدر"}</td>
                        <td className="p-4">
                          <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                            u.role === "admin"
                              ? "bg-red-50 text-red-700"
                              : u.role === "manager"
                              ? "bg-purple-50 text-purple-700"
                              : u.role === "cashier"
                              ? "bg-green-50 text-green-700"
                              : "bg-blue-50 text-blue-700"
                          }`}>
                            {u.role === "admin" ? "مدير عام (أدمن)" : u.role === "manager" ? "مدير صالة" : u.role === "cashier" ? "كاشير الصندوق" : "نادل الطاولات"}
                          </span>
                        </td>
                        <td className="p-4 text-center font-mono font-bold text-stone-700">{u.pinCode}</td>
                        <td className="p-4 text-center">
                          <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">نشط</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {activeTab === "shifts" && (
            <div className="space-y-6">
              
              <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-5 border-b border-stone-100">
                  <h3 className="font-bold text-stone-800 text-right">سجل الورديات Ledger Book</h3>
                </div>
                
                <table className="w-full text-right text-xs">
                  <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-bold">
                    <tr>
                      <th className="p-4">رقم الوردية</th>
                      <th className="p-4">اسم الكاشير المستلم</th>
                      <th className="p-4">تاريخ ووقت الفتح</th>
                      <th className="p-4">تاريخ ووقت الإغلاق</th>
                      <th className="p-4 text-left">العهدة الابتدائية</th>
                      <th className="p-4 text-left">الرصيد الفعلي</th>
                      <th className="p-4 text-left">العجز / الزيادة</th>
                      <th className="p-4 text-center">حالة الصندوق</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100 font-medium">
                    {shifts.map((sh) => (
                      <tr key={sh.id} className="hover:bg-stone-50/50">
                        <td className="p-4 font-bold text-stone-800">وردية #{sh.shiftNumber}</td>
                        <td className="p-4 font-bold text-stone-700">{sh.cashierName}</td>
                        <td className="p-4 text-stone-500 font-mono text-[10px]">{new Date(sh.openedAt).toLocaleString("ar-EG")}</td>
                        <td className="p-4 text-stone-500 font-mono text-[10px]">
                          {sh.closedAt ? new Date(sh.closedAt).toLocaleString("ar-EG") : "شغالة حالياً"}
                        </td>
                        <td className="p-4 text-left font-mono">{sh.openingCash.toFixed(2)} ر.س</td>
                        <td className="p-4 text-left font-mono">{sh.closingCash ? sh.closingCash.toFixed(2) : "-"}</td>
                        <td className={`p-4 text-left font-mono font-bold ${
                          (sh.cashDifference || 0) < 0
                            ? "text-red-600"
                            : (sh.cashDifference || 0) > 0
                            ? "text-blue-600"
                            : "text-green-600"
                        }`}>
                          {sh.cashDifference ? `${sh.cashDifference.toFixed(2)} ر.س` : "0.00 ر.س"}
                        </td>
                        <td className="p-4 text-center">
                          {sh.status === "open" ? (
                            <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-0.5 rounded text-[10px] font-bold">مفتوحة للبيع</span>
                          ) : (
                            <span className="bg-stone-100 text-stone-500 border border-stone-200 px-2 py-0.5 rounded text-[10px] font-bold">مغلقة ومقفلة</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

            </div>
          )}

          {/* ===================== تبويب التقارير والفواتير 🆕 ===================== */}
          {activeTab === "reports" && (
            <div className="space-y-6">
              <div className="flex flex-col lg:flex-row gap-4 items-stretch justify-between">
                {/* فلاتر التقارير */}
                <div className="flex-1 bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
                  <h3 className="font-bold text-stone-800 text-sm">استعلام تقارير المبيعات</h3>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-stone-500 mb-1">نوع التقرير</label>
                      <select
                        value={selectedReportType}
                        onChange={(e: any) => setSelectedReportType(e.target.value)}
                        className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                      >
                        <option value="daily">تقرير يومي</option>
                        <option value="monthly">تقرير شهري</option>
                        <option value="range">نطاق تاريخ مخصص</option>
                      </select>
                    </div>

                    {selectedReportType === "daily" && (
                      <div>
                        <label className="block text-xs font-bold text-stone-500 mb-1">اختر التاريخ</label>
                        <input
                          type="date"
                          value={selectedReportDate}
                          onChange={(e) => setSelectedReportDate(e.target.value)}
                          className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-center focus:outline-none"
                        />
                      </div>
                    )}

                    {selectedReportType === "monthly" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-stone-500 mb-1">الشهر</label>
                          <select
                            value={selectedReportMonth.month}
                            onChange={(e) => setSelectedReportMonth({ ...selectedReportMonth, month: Number(e.target.value) })}
                            className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                          >
                            {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                              <option key={m} value={m}>{m}</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-stone-500 mb-1">السنة</label>
                          <select
                            value={selectedReportMonth.year}
                            onChange={(e) => setSelectedReportMonth({ ...selectedReportMonth, year: Number(e.target.value) })}
                            className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                          >
                            {[2025, 2026, 2027, 2028].map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </select>
                        </div>
                      </div>
                    )}

                    {selectedReportType === "range" && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="block text-xs font-bold text-stone-500 mb-1">من تاريخ</label>
                          <input
                            type="date"
                            value={selectedReportRange.from}
                            onChange={(e) => setSelectedReportRange({ ...selectedReportRange, from: e.target.value })}
                            className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-center focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-bold text-stone-500 mb-1">إلى تاريخ</label>
                          <input
                            type="date"
                            value={selectedReportRange.to}
                            onChange={(e) => setSelectedReportRange({ ...selectedReportRange, to: e.target.value })}
                            className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2 text-xs text-center focus:outline-none"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {reportResult && (
                    <div className="pt-2">
                      <button
                        onClick={handlePrintReport}
                        className="px-4 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 justify-center"
                      >
                        <Printer className="w-4 h-4" />
                        <span>طباعة هذا التقرير حرارياً</span>
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* نتائج التقرير المستعلم عنه */}
              {reportLoading ? (
                <div className="bg-white border border-stone-200 rounded-2xl p-10 text-center text-stone-400">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3" />
                  <span>جاري تحميل تقارير المبيعات...</span>
                </div>
              ) : reportResult ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs text-stone-500 font-bold">إجمالي مبيعات التقرير</p>
                    <p className="text-2xl font-extrabold text-[#2E7D32] font-mono mt-2">
                      {reportResult.totalSales.toFixed(2)} <span className="text-xs font-sans">{settingsForm.currency}</span>
                    </p>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs text-stone-500 font-bold">صافي الأرباح المقدرة</p>
                    <p className="text-2xl font-extrabold text-emerald-800 font-mono mt-2">
                      {reportResult.profit.toFixed(2)} <span className="text-xs font-sans">{settingsForm.currency}</span>
                    </p>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs text-stone-500 font-bold">عدد الفواتير الكلي</p>
                    <p className="text-2xl font-extrabold text-stone-800 font-mono mt-2">
                      {reportResult.orderCount} <span className="text-xs font-sans">فاتورة</span>
                    </p>
                  </div>
                  <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm">
                    <p className="text-xs text-stone-500 font-bold">الضريبة المحصلة</p>
                    <p className="text-2xl font-extrabold text-stone-800 font-mono mt-2">
                      {reportResult.totalTax.toFixed(2)} <span className="text-xs font-sans">{settingsForm.currency}</span>
                    </p>
                  </div>
                </div>
              ) : null}

              {/* قائمة آخر الفواتير وإعادة الطباعة */}
              <div className="bg-white border border-stone-200 rounded-2xl p-5 shadow-sm space-y-4">
                <h3 className="font-bold text-stone-800 text-sm">سجل الفواتير الأخيرة (آخر 50 فاتورة)</h3>
                
                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead>
                      <tr className="bg-stone-50 text-stone-500 border-b border-stone-200">
                        <th className="p-3">رقم الفاتورة</th>
                        <th className="p-3">تاريخ الطلب</th>
                        <th className="p-3">نوع الطلب</th>
                        <th className="p-3">طريقة الدفع</th>
                        <th className="p-3 text-left">المبلغ الإجمالي</th>
                        <th className="p-3 text-center">إجراءات</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-medium">
                      {latestOrders.map((order) => (
                        <tr key={order.id} className="hover:bg-stone-50/50">
                          <td className="p-3 font-bold text-stone-800">#FT-{order.orderNumber}</td>
                          <td className="p-3 text-stone-500 font-mono text-[10px]">
                            {new Date(order.createdAt).toLocaleString("ar-EG")}
                          </td>
                          <td className="p-3">
                            {order.orderType === "dine_in" ? (
                              <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">داخلي (طاولة {order.tableId})</span>
                            ) : order.orderType === "takeaway" ? (
                              <span className="bg-amber-50 text-amber-700 px-2 py-0.5 rounded text-[10px] font-bold">سفري</span>
                            ) : (
                              <span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-[10px] font-bold">توصيل</span>
                            )}
                          </td>
                          <td className="p-3 text-stone-600">
                            {order.payments.map((p: any) => p.method === "cash" ? "كاش" : "شبكة").join(" + ")}
                          </td>
                          <td className="p-3 text-left font-mono font-bold text-stone-800">
                            {order.total.toFixed(2)} {settingsForm.currency}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleReprintOrder(order)}
                              className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 border border-stone-200 rounded-lg text-stone-700 font-bold flex items-center gap-1 mx-auto transition-all"
                            >
                              <Printer className="w-3.5 h-3.5" />
                              <span>إعادة طباعة الفاتورة</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                      {latestOrders.length === 0 && (
                        <tr>
                          <td colSpan={6} className="p-8 text-center text-stone-400">
                            لا توجد فواتير مكتملة مسجلة في السجل بعد.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* ===================== تبويب إعدادات النظام والطباعة 🆕 ===================== */}
          {activeTab === "settings" && (
            <div className="space-y-6">
              
              {/* إعدادات المنشأة */}
              <form onSubmit={handleSaveSettings} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-[#2E7D32] border-b border-stone-100 pb-2 flex items-center gap-2">
                  <Store className="w-5 h-5 text-[#2E7D32]" />
                  <span>بيانات وإعدادات المطعم / المنشأة</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">اسم المنشأة بالعربية *</label>
                    <input
                      type="text"
                      required
                      value={settingsForm.businessNameAr}
                      onChange={(e) => setSettingsForm({ ...settingsForm, businessNameAr: e.target.value })}
                      placeholder="مثال: مطعم كاشي المتميز"
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">الاسم بالإنجليزية</label>
                    <input
                      type="text"
                      value={settingsForm.businessNameEn}
                      onChange={(e) => setSettingsForm({ ...settingsForm, businessNameEn: e.target.value })}
                      placeholder="Cashi Restaurant"
                      dir="ltr"
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">اسم الفرع</label>
                    <input
                      type="text"
                      value={settingsForm.branchName}
                      onChange={(e) => setSettingsForm({ ...settingsForm, branchName: e.target.value })}
                      placeholder="مثال: الفرع الرئيسي - الرياض"
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">رقم الهاتف</label>
                    <input
                      type="text"
                      value={settingsForm.phone}
                      onChange={(e) => setSettingsForm({ ...settingsForm, phone: e.target.value })}
                      placeholder="هاتف التواصل..."
                      dir="ltr"
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">الرقم الضريبي VAT</label>
                    <input
                      type="text"
                      value={settingsForm.taxNumber}
                      onChange={(e) => setSettingsForm({ ...settingsForm, taxNumber: e.target.value })}
                      placeholder="الرقم الضريبي للمنشأة..."
                      dir="ltr"
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">العنوان بالتفصيل</label>
                  <input
                    type="text"
                    value={settingsForm.address}
                    onChange={(e) => setSettingsForm({ ...settingsForm, address: e.target.value })}
                    placeholder="العنوان للطباعة على رأس الإيصال..."
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">العملة الافتراضية</label>
                    <input
                      type="text"
                      value={settingsForm.currency}
                      onChange={(e) => setSettingsForm({ ...settingsForm, currency: e.target.value })}
                      placeholder="مثال: ر.س أو د.إ"
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">نسبة ضريبة القيمة المضافة %</label>
                    <input
                      type="number"
                      value={settingsForm.vatRate}
                      onChange={(e) => setSettingsForm({ ...settingsForm, vatRate: Number(e.target.value) })}
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">شعار المنشأة (شعار الفواتير)</label>
                  <div className="flex items-center gap-4 mt-2">
                    {settingsForm.logoBase64 && (
                      <img
                        src={settingsForm.logoBase64}
                        alt="logo preview"
                        className="w-16 h-16 object-contain rounded-xl bg-stone-50 border border-stone-200 p-2 shrink-0"
                      />
                    )}
                    <label className="px-4 py-2 border border-stone-200 rounded-xl hover:bg-stone-50 text-xs font-bold cursor-pointer transition-all flex items-center gap-1">
                      <span>اختيار صورة الشعار...</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUploadSettings}
                        className="hidden"
                      />
                    </label>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">تذييل الفاتورة (الرسالة أسفل الإيصال)</label>
                  <textarea
                    rows={2}
                    value={settingsForm.receiptFooter}
                    onChange={(e) => setSettingsForm({ ...settingsForm, receiptFooter: e.target.value })}
                    placeholder="شكراً لزيارتكم! نرجو رؤيتكم قريباً..."
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none resize-none"
                  />
                </div>

                <div className="flex justify-end pt-2">
                  <button
                    type="submit"
                    className="px-6 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow transition-all"
                  >
                    حفظ بيانات وإعدادات المطعم
                  </button>
                </div>
              </form>

              {/* إعدادات طابعة الفواتير الحرارية ESC/POS */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2 flex items-center gap-2">
                  <Printer className="w-5 h-5 text-stone-600" />
                  <span>إعدادات طابعة الفواتير الحرارية ودرج النقد</span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">نوع طابعة المطبخ والصالة</label>
                    <select
                      value={printerSettings.type}
                      onChange={(e) => setPrinterSettings({ ...printerSettings, type: e.target.value })}
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    >
                      <option value="generic">طابعة حرارية افتراضية (Generic ESC/POS)</option>
                      <option value="epson">طابعة إبسون الحرارية (EPSON)</option>
                      <option value="star">طابعة ستار (STAR)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">واجهة الاتصال بالطابعة</label>
                    <select
                      value={printerSettings.interface}
                      onChange={(e) => setPrinterSettings({ ...printerSettings, interface: e.target.value })}
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    >
                      <option value="usb">منفذ USB المحلي / طابعة نظام تشغيل ويندوز</option>
                      <option value="network">طابعة شبكة (Network Ethernet / IP)</option>
                    </select>
                  </div>
                </div>

                {printerSettings.interface === "network" ? (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">عنوان طابعة الشبكة (IP:Port)</label>
                    <input
                      type="text"
                      value={printerSettings.networkAddress}
                      onChange={(e) => setPrinterSettings({ ...printerSettings, networkAddress: e.target.value })}
                      placeholder="مثال: 192.168.1.200:9100"
                      dir="ltr"
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">اختر الطابعة الافتراضية من نظام تشغيل ويندوز</label>
                    <select
                      value={printerSettings.printerName}
                      onChange={(e) => setPrinterSettings({ ...printerSettings, printerName: e.target.value })}
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    >
                      <option value="">اختر طابعة الفواتير الموصلة بالويندوز...</option>
                      {printersList.map((p, idx) => (
                        <option key={idx} value={p}>{p}</option>
                      ))}
                    </select>
                    <p className="text-[10px] text-stone-400 mt-1">تأكد من توصيل طابعة USB وتثبيت تعريفاتها في لوحة تحكم الويندوز أولاً.</p>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">عرض ورق الطباعة الحراري</label>
                    <select
                      value={printerSettings.paperWidth}
                      onChange={(e) => setPrinterSettings({ ...printerSettings, paperWidth: Number(e.target.value) })}
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    >
                      <option value={80}>ورق عريض 80 مم (الافتراضي للمطاعم)</option>
                      <option value={58}>ورق ضيق 58 مم (طابعات البلوتوث والـ POS المحمولة)</option>
                    </select>
                  </div>

                  <div className="flex gap-4 items-center justify-end h-full pt-4">
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-700">
                      <span>فتح درج الكاشير مع الكاش</span>
                      <input
                        type="checkbox"
                        checked={printerSettings.openDrawerOnCash}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, openDrawerOnCash: e.target.checked })}
                        className="w-4 h-4 text-[#2E7D32]"
                      />
                    </label>
                    
                    <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-700">
                      <span>قطع الورق التلقائي (Auto-cut)</span>
                      <input
                        type="checkbox"
                        checked={printerSettings.autoCut}
                        onChange={(e) => setPrinterSettings({ ...printerSettings, autoCut: e.target.checked })}
                        className="w-4 h-4 text-[#2E7D32]"
                      />
                    </label>
                  </div>
                </div>

                <div className="flex gap-2 justify-end pt-2">
                  <button
                    onClick={async () => {
                      const api = (window as any).electronAPI;
                      if (api) {
                        try {
                          await api.printReceipt({ html: `
                            <div style="font-family:'Cairo';text-align:center;width:280px;font-size:12px;padding:10px;">
                              <h3 style="margin:0;">كاشي Cashi</h3>
                              <p style="margin:5px 0;">اختبار توافقية الطباعة بنجاح</p>
                              <p style="font-size:10px;color:#888;">${new Date().toLocaleString()}</p>
                              <div style="border-top:1px dashed #000;margin:10px 0;"></div>
                            </div>
                          `});
                          alert("تم إرسال إيصال تجريبي للطابعة! 🖨️");
                        } catch (e) {
                          alert("فشل طباعة الإيصال التجريبي");
                        }
                      } else {
                        alert("الطباعة متاحة فقط في برنامج الويندوز");
                      }
                    }}
                    className="px-4 py-2 border border-stone-200 rounded-xl hover:bg-stone-50 text-stone-700 text-xs font-bold shadow-sm"
                  >
                    طباعة إيصال تجريبي للاختبار
                  </button>
                  <button
                    onClick={handleSavePrinterSettings}
                    className="px-6 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow transition-all"
                  >
                    حفظ إعدادات طابعة الفواتير
                  </button>
                </div>
              </div>

              {/* لوحة تحكم المدير عن بُعد والشبكة */}
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
                <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2 flex items-center gap-2">
                  <Globe className="w-5 h-5 text-blue-600" />
                  <span>لوحة تحكم المدير عن بعد (Remote Manager Dashboard)</span>
                </h3>

                {appInfo ? (
                  <div className="space-y-3">
                    <p className="text-xs text-stone-600 leading-relaxed">
                      يسمح لك كاشي بمتابعة المبيعات والورديات لحظياً من أي جوال أو جهاز كمبيوتر متصل بنفس شبكة الـ WiFi في المحل.
                    </p>
                    
                    <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl flex flex-col md:flex-row gap-4 items-center justify-between">
                      <div className="space-y-1 text-right w-full">
                        <p className="text-xs font-bold text-blue-900">رابط الوصول للوحة تحكم المدير:</p>
                        <p className="text-sm font-mono font-bold text-blue-700 selection:bg-blue-200 p-1 bg-white rounded border border-blue-100 mt-1 select-text text-left" dir="ltr">
                          {appInfo.managerUrl}
                        </p>
                        <p className="text-[10px] text-blue-600 mt-1">رمز PIN للمدير للمصادقة: <span className="font-bold font-mono">2222</span> أو <span className="font-bold font-mono">0000</span></p>
                      </div>

                      <div className="shrink-0 flex flex-col items-center gap-1.5">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(appInfo.managerUrl)}`}
                          alt="QR Code Link"
                          className="w-24 h-24 bg-white p-1 rounded-xl shadow-sm border border-stone-200"
                        />
                        <span className="text-[9px] font-bold text-stone-500">امسح الكود لفتح لوحة المدير</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-stone-400">
                    رابط لوحة المدير والـ QR Code يتوفران تلقائياً عند تشغيل كاشي كبرنامج ويندوز.
                  </p>
                )}
              </div>

            </div>
          )}

          {activeTab === "audit" && (
            <div className="space-y-6">
              
              <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
                <div className="flex justify-between items-center border-b border-stone-100 pb-3 flex-row-reverse">
                  <div>
                    <h3 className="font-bold text-stone-800 text-right">سجل تدقيق العمليات (Audit Logs)</h3>
                    <p className="text-xs text-stone-400 mt-1">سجل المراقبة الأمني لكافة الحركات والعمليات الحساسة في النظام.</p>
                  </div>
                  <button
                    onClick={fetchAllData}
                    className="p-2 border border-stone-200 hover:bg-stone-50 text-stone-500 rounded-xl"
                    title="تحديث السجلات"
                  >
                    <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-right text-xs">
                    <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-bold">
                      <tr>
                        <th className="p-4">العملية / الحركة</th>
                        <th className="p-4">اسم الموظف</th>
                        <th className="p-4">المسؤول عن الحركة</th>
                        <th className="p-4">تفاصيل الحركة</th>
                        <th className="p-4 text-center">الوقت والتاريخ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-stone-100 font-medium">
                      {auditLogs.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-stone-400 font-bold">لا توجد سجلات تدقيق متوفرة حالياً في النظام.</td>
                        </tr>
                      ) : (
                        [...auditLogs].reverse().map((log) => (
                          <tr key={log.id} className="hover:bg-stone-50/50">
                            <td className="p-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                log.action.includes("حذف") || log.action.includes("إغلاق")
                                  ? "bg-red-50 text-red-700"
                                  : log.action.includes("تعديل")
                                  ? "bg-amber-50 text-amber-700"
                                  : log.action.includes("دخول")
                                  ? "bg-blue-50 text-blue-700"
                                  : "bg-green-50 text-green-700"
                              }`}>
                                {log.action}
                              </span>
                            </td>
                            <td className="p-4 font-bold text-stone-800">{log.userName}</td>
                            <td className="p-4 text-stone-400 font-mono">{log.userId}</td>
                            <td className="p-4 text-stone-600 font-medium leading-relaxed">{log.details}</td>
                            <td className="p-4 text-center font-mono text-stone-500">
                              {new Date(log.createdAt).toLocaleString("ar-SA")}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

        </main>
      </div>

      {/* Product Add/Edit Modal */}
      {showProductModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-right">
            <div className="bg-[#2E7D32] text-white p-5 flex items-center justify-between">
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
                {editingProduct ? "تعديل بيانات" : "إضافة صنف منتج"}
              </span>
              <h3 className="text-lg font-bold">أدخل تفاصيل صنف المنيو</h3>
              <button onClick={() => setShowProductModal(false)} className="p-1 hover:bg-white/15 rounded text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProduct} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الاسم بالعربي *</label>
                  <input
                    type="text"
                    required
                    value={productForm.nameAr}
                    onChange={(e) => setProductForm(p => ({ ...p, nameAr: e.target.value }))}
                    placeholder="مثال: شاورما سوبر"
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الاسم بالإنجليزي</label>
                  <input
                    type="text"
                    value={productForm.nameEn}
                    onChange={(e) => setProductForm(p => ({ ...p, nameEn: e.target.value }))}
                    placeholder="Chicken Shawarma"
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الفئة الغذائية *</label>
                <select
                  value={productForm.categoryId}
                  onChange={(e) => setProductForm(p => ({ ...p, categoryId: e.target.value }))}
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                >
                  <option value="">اختر الفئة الرئيسية...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.nameAr}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">سعر بيع الزبون (ر.س) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.price}
                    onChange={(e) => setProductForm(p => ({ ...p, price: e.target.value }))}
                    placeholder="مثال: 15.00"
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-left focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">تكلفة المنتج الإجمالية (ر.س) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={productForm.cost}
                    onChange={(e) => setProductForm(p => ({ ...p, cost: e.target.value }))}
                    placeholder="مثال: 6.00"
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-left focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">صورة الصنف للمنيو</label>
                <div className="flex items-center gap-3 mt-1.5 justify-end">
                  {(productForm.imageBase64 || productForm.image) && (
                    <img
                      src={productForm.imageBase64 || (productForm.image.startsWith('data:') ? productForm.image : `/uploads/${productForm.image}`)}
                      alt="preview"
                      className="w-12 h-12 object-cover rounded-xl border border-stone-200"
                    />
                  )}
                  <label className="px-4 py-2 border border-stone-200 rounded-xl hover:bg-stone-50 text-xs font-bold cursor-pointer transition-all flex items-center gap-1.5">
                    <span>اختر صورة...</span>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleProductImageUpload}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              <div className="border-t border-stone-100 pt-4 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer font-bold text-xs text-stone-700 justify-end">
                  <span>تفعيل تتبع ومراقبة المستودع لهذا المنتج</span>
                  <input
                    type="checkbox"
                    checked={productForm.trackInventory}
                    onChange={(e) => setProductForm(p => ({ ...p, trackInventory: e.target.checked }))}
                    className="w-4 h-4 text-[#2E7D32]"
                  />
                </label>

                {productForm.trackInventory && (
                  <div>
                    <label className="block text-xs font-bold text-stone-700 mb-1">الكمية الافتتاحية للمستودع حالياً</label>
                    <input
                      type="number"
                      value={productForm.quantity}
                      onChange={(e) => setProductForm(p => ({ ...p, quantity: e.target.value }))}
                      placeholder="أدخل عدد الوحدات المتوفرة..."
                      className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                    />
                  </div>
                )}
              </div>

              <div className="flex gap-2 justify-end border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 text-xs font-bold"
                >
                  إلغاء التراجع
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow"
                >
                  حفظ المنتج في المنيو
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden text-right">
            <div className="bg-[#2E7D32] text-white p-5 flex items-center justify-between">
              <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
                إنشاء فئة مبيعات
              </span>
              <h3 className="text-lg font-bold">أدخل اسم الفئة الجديدة</h3>
              <button onClick={() => setShowCategoryModal(false)} className="p-1 hover:bg-white/15 rounded text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الاسم بالعربي *</label>
                <input
                  type="text"
                  required
                  value={newCategoryNameAr}
                  onChange={(e) => setNewCategoryNameAr(e.target.value)}
                  placeholder="مثال: الشوربات والمشروبات الساخنة"
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الاسم بالإنجليزي *</label>
                <input
                  type="text"
                  required
                  value={newCategoryNameEn}
                  onChange={(e) => setNewCategoryNameEn(e.target.value)}
                  placeholder="e.g. Hot Drinks & Soups"
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none font-mono"
                />
              </div>

              <div className="flex gap-2 justify-end border-t border-stone-100 pt-4">
                <button
                  type="button"
                  onClick={() => setShowCategoryModal(false)}
                  className="px-4 py-2 border border-stone-200 rounded-xl text-stone-600 hover:bg-stone-50 text-xs font-bold"
                >
                  تراجع
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow"
                >
                  حفظ الفئة في المنيو
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
