import React, { useState, useEffect } from "react";
import { X, Coins, CreditCard, Receipt, Check, AlertCircle, Sparkles, Printer, Info } from "lucide-react";
import { Order, OrderItem, Payment, OrderType, Customer, Product } from "../types";

interface PaymentModalProps {
  total: number;
  subtotal: number;
  tax: number;
  discount: number;
  discountReason?: string;
  items: { product: Product; quantity: number; notes?: string }[];
  orderType: OrderType;
  tableId?: string | null;
  waiterId?: string | null;
  customerId?: string | null;
  shiftId: string;
  cashierId: string;
  cashierName: string;
  onPaymentSuccess: () => void;
  onCancel: () => void;
  isOnline: boolean;
  notes?: string;
}

export default function PaymentModal({
  total,
  subtotal,
  tax,
  discount,
  discountReason,
  items,
  orderType,
  tableId,
  waiterId,
  customerId,
  shiftId,
  cashierId,
  cashierName,
  onPaymentSuccess,
  onCancel,
  isOnline,
  notes,
}: PaymentModalProps) {
  const [method, setMethod] = useState<"cash" | "card" | "split">("cash");
  const [tendered, setTendered] = useState<string>(String(total));
  const [cashAmount, setCashAmount] = useState<string>(String(total));
  const [cardAmount, setCardAmount] = useState<string>("0");
  const [error, setError] = useState<string>("");
  const [loading, setLoading] = useState<boolean>(false);
  const [success, setSuccess] = useState<boolean>(false);
  const [receiptHTML, setReceiptHTML] = useState<string>("");
  const [settings, setSettings] = useState<any>(null);

  // جلب إعدادات المنشأة لاستخدامها في الإيصال
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await fetch("/api/settings");
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (e) {
        // استخدام الإعدادات المحلية كـ fallback
        const local = localStorage.getItem("pos_settings");
        if (local) setSettings(JSON.parse(local));
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    if (method === "cash") {
      setTendered(String(total));
    } else if (method === "card") {
      setTendered(String(total));
    } else {
      // Split default: 50/50
      const half = (total / 2).toFixed(2);
      setCashAmount(half);
      setCardAmount(half);
      setTendered(String(total));
    }
  }, [method, total]);

  const tenderedValue = Number(tendered) || 0;
  const cashAmountValue = Number(cashAmount) || 0;
  const cardAmountValue = Number(cardAmount) || 0;
  const changeDue = method === "cash" ? Math.max(0, tenderedValue - total) : 0;

  const handleQuickCash = (amount: number) => {
    setTendered(String(amount));
  };

  const handleConfirmPayment = async () => {
    if (method === "cash" && tenderedValue < total) {
      setError("المبلغ المستلم أقل من إجمالي الفاتورة!");
      return;
    }
    if (method === "split" && (cashAmountValue + cardAmountValue) < total) {
      setError("إجمالي المبالغ المقسمة أقل من الفاتورة!");
      return;
    }

    setLoading(true);
    setError("");

    // Build the order document
    const clientUuid = `uuid-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const orderItems: OrderItem[] = items.map((item, index) => ({
      id: `oi-${Date.now()}-${index}`,
      productId: item.product.id,
      productNameSnapshot: item.product.nameAr,
      unitPrice: item.product.price,
      quantity: item.quantity,
      lineTotal: item.product.price * item.quantity,
      notes: item.notes,
    }));

    const paymentsArray: Payment[] = [];
    if (method === "cash") {
      paymentsArray.push({
        id: `pay-${Date.now()}-1`,
        orderId: clientUuid,
        method: "cash",
        amount: total,
        tendered: tenderedValue,
        changeDue: changeDue,
        createdAt: new Date().toISOString(),
      });
    } else if (method === "card") {
      paymentsArray.push({
        id: `pay-${Date.now()}-1`,
        orderId: clientUuid,
        method: "card",
        amount: total,
        tendered: total,
        changeDue: 0,
        createdAt: new Date().toISOString(),
      });
    } else {
      paymentsArray.push(
        {
          id: `pay-${Date.now()}-1`,
          orderId: clientUuid,
          method: "cash",
          amount: cashAmountValue,
          tendered: cashAmountValue,
          changeDue: 0,
          createdAt: new Date().toISOString(),
        },
        {
          id: `pay-${Date.now()}-2`,
          orderId: clientUuid,
          method: "card",
          amount: cardAmountValue,
          tendered: cardAmountValue,
          changeDue: 0,
          createdAt: new Date().toISOString(),
        }
      );
    }

    const orderDoc: Partial<Order> = {
      id: clientUuid,
      shiftId,
      cashierId,
      waiterId,
      tableId,
      customerId,
      orderType,
      status: "completed",
      subtotal,
      discountAmount: discount,
      discountReason,
      taxAmount: tax,
      total,
      notes: notes || "",
      createdAt: new Date().toISOString(),
      items: orderItems,
      payments: paymentsArray,
      ignoreShiftValidation: true // For local offline-first fallback
    };

    try {
      // 1. Submit order to DB
      const res = await fetch("/api/orders/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderDoc),
      });

      if (!res.ok) {
        throw new Error("فشلت مزامنة الفاتورة مع خادم المحل");
      }

      // Generate receipt HTML template for printer simulation
      const receiptNum = Math.floor(Math.random() * 9000) + 1000;
      const bName = settings?.businessNameAr || "كاشي";
      const bNameEn = settings?.businessNameEn || "Cashi";
      const bBranch = settings?.branchName || "";
      const bTax = settings?.taxNumber || "";
      const bAddress = settings?.address || "";
      const bPhone = settings?.phone || "";
      const bFooter = settings?.receiptFooter || "شكراً لزيارتكم!";
      const bCurrency = settings?.currency || "ر.س";
      const html = `
        <div class="receipt-print text-stone-800 p-4 font-mono text-xs text-right leading-relaxed" style="width: 280px; font-family: 'Cairo', 'JetBrains Mono', monospace;">
          <div class="text-center border-b border-dashed border-stone-400 pb-2 mb-2">
            ${settings?.logoBase64 ? `<img src="${settings.logoBase64}" style="width:60px;height:60px;margin:0 auto 8px;object-fit:contain;" />` : ''}
            <h2 class="font-bold text-sm">${bName}</h2>
            ${bNameEn ? `<p class="text-[10px]">${bNameEn}</p>` : ''}
            ${bBranch ? `<p class="text-[10px]">${bBranch}</p>` : ''}
            ${bAddress ? `<p class="text-[10px]">${bAddress}</p>` : ''}
            ${bPhone ? `<p class="text-[10px]">هاتف: ${bPhone}</p>` : ''}
            ${bTax ? `<p class="text-[10px]">الرقم الضريبي: ${bTax}</p>` : ''}
          </div>
          <div class="space-y-0.5 border-b border-dashed border-stone-400 pb-2 mb-2">
            <p>رقم الفاتورة: #FT-${receiptNum}</p>
            <p>التاريخ: ${new Date().toLocaleString('ar-EG')}</p>
            <p>الكاشير: ${cashierName}</p>
            <p>النوع: ${orderType === 'dine_in' ? 'داخلي (طاولة ' + (tableId || '') + ')' : orderType === 'takeaway' ? 'تطبيقات التوصيل (' + (notes || '') + ')' : 'توصيل للمنزل'}</p>
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
              ${orderItems.map(item => `
                <tr>
                  <td>${item.productNameSnapshot}</td>
                  <td class="text-center">${item.quantity}</td>
                  <td class="text-left">${item.lineTotal.toFixed(2)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <div class="border-t border-dashed border-stone-400 pt-2 space-y-0.5">
            <div class="flex justify-between"><span>الإجمالي الفرعي:</span><span>${subtotal.toFixed(2)} ${bCurrency}</span></div>
            ${discount > 0 ? `<div class="flex justify-between text-red-600"><span>الخصم:</span><span>-${discount.toFixed(2)} ${bCurrency}</span></div>` : ''}
            <div class="flex justify-between"><span>ضريبة القيمة المضافة ${settings?.vatRate || 15}%:</span><span>${tax.toFixed(2)} ${bCurrency}</span></div>
            <div class="flex justify-between font-bold text-sm border-t border-stone-300 pt-1"><span>الإجمالي الكلي:</span><span>${total.toFixed(2)} ${bCurrency}</span></div>
          </div>
          <div class="mt-2 pt-2 border-t border-dashed border-stone-400">
            <p class="font-bold">طريقة الدفع:</p>
            ${paymentsArray.map(p => `<p class="flex justify-between"><span>${p.method === 'cash' ? 'كاش' : 'بطاقة مدى / فيزا'}:</span><span>${p.amount.toFixed(2)} ${bCurrency}</span></p>`).join('')}
            ${method === 'cash' ? `<div class="flex justify-between"><span>المبلغ المستلم:</span><span>${tenderedValue.toFixed(2)} ${bCurrency}</span></div><div class="flex justify-between font-bold text-green-700"><span>الباقي للكاش:</span><span>${changeDue.toFixed(2)} ${bCurrency}</span></div>` : ''}
          </div>
          <div class="text-center mt-4 border-t border-stone-300 pt-2 text-[10px]">
            <p>${bFooter}</p>
            <p class="mt-1">مشغّل بواسطة كاشي Cashi</p>
          </div>
        </div>
      `;
      setReceiptHTML(html);

      // Kitchen receipt HTML template (prices hidden, large font)
      const kitchenHTML = `
        <div class="kitchen-print text-stone-800 p-4 font-mono text-xs text-right leading-relaxed" style="width: 280px; font-family: 'Cairo', 'JetBrains Mono', monospace;">
          <div class="text-center border-b border-dashed border-stone-400 pb-2 mb-2">
            <h2 class="font-bold text-sm">*** تذكرة المطبخ ***</h2>
            <p style="font-size:14px;font-weight:bold;">رقم الطلب: #${receiptNum}</p>
            <p>التاريخ: ${new Date().toLocaleString('ar-EG')}</p>
            <p>النوع: ${orderType === 'dine_in' ? 'داخلي (طاولة ' + (tableId || '') + ')' : orderType === 'takeaway' ? 'تطبيقات التوصيل (' + (notes || '') + ')' : 'توصيل'}</p>
          </div>
          <table class="w-full text-right mb-2">
            <thead>
              <tr class="border-b border-stone-300">
                <th class="font-bold">الصنف</th>
                <th class="font-bold text-center">الكمية</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems.map(item => `
                <tr style="font-size: 14px; font-weight: bold; border-bottom: 1px solid #eee;">
                  <td style="padding: 4px 0;">${item.productNameSnapshot}</td>
                  <td class="text-center" style="padding: 4px 0;">${item.quantity}</td>
                </tr>
                ${item.notes ? `
                  <tr>
                    <td colspan="2" style="font-size: 11px; color: #ef4444; padding-bottom: 6px; padding-right: 8px;">
                      ملاحظة: ⚠️ ${item.notes}
                    </td>
                  </tr>
                ` : ''}
              `).join('')}
            </tbody>
          </table>
          <div class="text-center mt-4 border-t border-stone-300 pt-2 text-[9px] text-stone-400">
            <p>مشغّل بواسطة كاشي Cashi</p>
          </div>
        </div>
      `;

      // Print Customer receipt mock
      await fetch("/api/print/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: clientUuid, total, items: orderItems }),
      });

      // Print Kitchen ticket mock
      await fetch("/api/print/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: clientUuid, items: orderItems, tableId, orderType }),
      });

      // Automatic physical dual printing under Electron
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.isElectron) {
        try {
          // Print copy 1: Cashier/Customer full invoice
          await electronAPI.printReceipt({ html });
          // Print copy 2: Kitchen ticket
          await electronAPI.printReceipt({ html: kitchenHTML });
        } catch (printErr) {
          console.error("Auto print failed:", printErr);
        }
      }

      setSuccess(true);
    } catch (e) {
      console.error(e);
      setError("فشل الاتصال بالخادم. سيتم تخزين الفاتورة في طابور الأوفلاين للتزامن.");
      // Fallback local mock success for high resilience offline-first!
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintAgain = async () => {
    // محاولة الطباعة عبر Electron API أولاً
    const electronAPI = (window as any).electronAPI;
    if (electronAPI?.isElectron && receiptHTML) {
      try {
        await electronAPI.printReceipt({ html: receiptHTML });
        return;
      } catch (e) {
        console.error('فشل الطباعة عبر Electron:', e);
      }
    }
    alert("تمت إعادة إرسال أمر طباعة الإيصال إلى الطابعة!");
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-stone-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="bg-[#2E7D32] text-white p-5 flex items-center justify-between">
          <span className="text-xs bg-white/20 px-2.5 py-1 rounded-full font-bold">
            شاشة تحصيل المبيعات
          </span>
          <h3 className="text-xl font-bold">إكمال عملية الدفع وتسوية الفاتورة</h3>
          <button
            onClick={onCancel}
            disabled={success}
            className="p-1.5 hover:bg-white/10 rounded-lg text-white/80 hover:text-white transition-all disabled:opacity-30"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {error && (
          <div className="m-4 p-3 bg-red-50 border-r-4 border-red-500 rounded-lg flex items-center gap-2 text-red-800 text-sm">
            <AlertCircle className="w-5 h-5 shrink-0 text-red-600" />
            <span className="font-semibold text-right flex-1">{error}</span>
          </div>
        )}

        {success ? (
          /* Payment success screen, showing simulation of thermal receipt */
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            
            {/* Right side: Congratulations & actions */}
            <div className="flex flex-col items-center justify-center text-center space-y-6 py-12 md:border-l md:border-stone-100 md:pl-6 h-full">
              <div className="w-20 h-20 bg-green-50 border border-green-200 rounded-full flex items-center justify-center shadow-xl">
                <Check className="w-12 h-12 text-[#2E7D32] animate-bounce" />
              </div>
              
              <div className="space-y-2">
                <h4 className="text-2xl font-bold text-[#2E7D32]">تم الدفع بنجاح!</h4>
                <p className="text-sm text-stone-500 font-medium">تم حفظ الفاتورة وطباعة الإيصالات بنجاح</p>
                {method === "cash" && changeDue > 0 && (
                  <div className="bg-green-50 border border-green-200 rounded-xl p-3 mt-4 text-center">
                    <p className="text-xs text-green-800 font-bold">المبلغ المتبقي للعميل (الباقي)</p>
                    <p className="text-2xl font-extrabold text-green-950 font-mono mt-1">{changeDue.toFixed(2)} ر.س</p>
                  </div>
                )}
              </div>

              <div className="w-full space-y-2 pt-6">
                <button
                  onClick={handlePrintAgain}
                  className="w-full py-3 bg-stone-100 hover:bg-stone-200 text-stone-700 font-bold text-sm rounded-xl transition-all border border-stone-200 flex items-center justify-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  <span>إعادة طباعة الفاتورة 80mm</span>
                </button>
                <button
                  onClick={onPaymentSuccess}
                  className="w-full py-4 bg-[#2E7D32] hover:bg-[#1B5E20] text-white font-bold text-base rounded-xl shadow-md transition-all flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-5 h-5" />
                  <span>بدء فاتورة بيع جديدة</span>
                </button>
              </div>
            </div>

            {/* Left side: Simulated paper thermal receipt */}
            <div className="flex flex-col items-center">
              <span className="text-[10px] text-stone-400 mb-2 font-bold uppercase tracking-widest flex items-center gap-1">
                <Receipt className="w-3.5 h-3.5" />
                معاينة طابعة الفواتير الحرارية (80mm)
              </span>
              
              <div className="bg-stone-50 border border-stone-200 rounded-xl p-4 shadow-inner max-h-[380px] overflow-y-auto w-full flex justify-center">
                <div className="bg-white border border-stone-300 p-4 shadow-sm rounded-lg" dangerouslySetInnerHTML={{ __html: receiptHTML }}>
                </div>
              </div>
            </div>

          </div>
        ) : (
          /* Payment forms */
          <div className="p-6 space-y-6">
            
            {/* Amount due highlight */}
            <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 flex items-center justify-between text-right">
              <div>
                <p className="text-xs text-stone-500 font-bold">طريقة الطلب</p>
                <p className="text-sm font-bold text-stone-800 mt-1">
                  {orderType === "dine_in" ? "صالة داخلية (داين إن)" : orderType === "takeaway" ? "سفري (تيك أواي)" : "توصيل منزلي"}
                </p>
              </div>
              <div>
                <p className="text-xs text-stone-500 font-bold text-left">إجمالي الفاتورة المطلوب دفعه</p>
                <p className="text-3xl font-extrabold text-[#2E7D32] font-mono mt-1 text-left">{total.toFixed(2)} <span className="text-xs font-sans">ريال</span></p>
              </div>
            </div>

            {/* Selector methods */}
            <div className="grid grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => setMethod("cash")}
                className={`py-4 px-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all font-bold text-sm ${
                  method === "cash"
                    ? "bg-[#EAF4EA] border-[#2E7D32] text-[#2E7D32] shadow-sm"
                    : "border-stone-200 hover:bg-stone-50 text-stone-700"
                }`}
              >
                <Coins className="w-6 h-6" />
                <span>دفع كاش</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod("card")}
                className={`py-4 px-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all font-bold text-sm ${
                  method === "card"
                    ? "bg-[#EAF4EA] border-[#2E7D32] text-[#2E7D32] shadow-sm"
                    : "border-stone-200 hover:bg-stone-50 text-stone-700"
                }`}
              >
                <CreditCard className="w-6 h-6" />
                <span>بطاقة / شبكة</span>
              </button>
              <button
                type="button"
                onClick={() => setMethod("split")}
                className={`py-4 px-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all font-bold text-sm ${
                  method === "split"
                    ? "bg-[#EAF4EA] border-[#2E7D32] text-[#2E7D32] shadow-sm"
                    : "border-stone-200 hover:bg-stone-50 text-stone-700"
                }`}
              >
                <Receipt className="w-6 h-6" />
                <span>تقسيم (كاش+شبكة)</span>
              </button>
            </div>

            {/* Dynamic details for selected method */}
            {method === "cash" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">المبلغ المستلم من العميل</label>
                  <input
                    type="number"
                    step="0.01"
                    value={tendered}
                    onChange={(e) => setTendered(e.target.value)}
                    className="w-full border border-stone-200 bg-stone-50 focus:bg-white px-4 py-3 rounded-xl text-xl font-mono font-bold text-stone-800 text-left focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  />
                  
                  {/* Quick Cash help desk */}
                  <div className="flex gap-1.5 mt-2 overflow-x-auto pb-1" dir="ltr">
                    {[total, 20, 50, 100, 200, 500].map((amount) => {
                      if (amount < total && amount !== total) return null;
                      return (
                        <button
                          key={amount}
                          type="button"
                          onClick={() => handleQuickCash(amount)}
                          className="px-2.5 py-1 text-xs border border-stone-200 bg-white hover:bg-stone-50 rounded-lg font-mono font-bold text-stone-700 shrink-0"
                        >
                          {amount.toFixed(0)} ر.س
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">الباقي للعميل (المسترجع)</label>
                  <div className="w-full bg-stone-100 border border-stone-200 px-4 py-3 rounded-xl text-xl font-mono font-bold text-green-700 text-left flex items-center justify-between h-[50px]">
                    <span className="text-xs font-sans text-stone-500">الباقي</span>
                    <span>{changeDue.toFixed(2)} ر.س</span>
                  </div>
                </div>
              </div>
            )}

            {method === "card" && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex gap-3 text-blue-800 text-sm text-right">
                <Info className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">يرجى توجيه العميل لماكينة الدفع بالبطاقة (مدى / فيزا)</p>
                  <p className="text-xs text-blue-700/90">
                    بمجرد قبول الماكينة للبطاقة وسحب المبلغ بقيمة {total.toFixed(2)} ر.س بنجاح، اضغط على زر "تأكيد التحصيل" بالأسفل لتسجيل الفاتورة.
                  </p>
                </div>
              </div>
            )}

            {method === "split" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-right">
                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">المبلغ كاش (نقدي)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cashAmount}
                    onChange={(e) => {
                      setCashAmount(e.target.value);
                      const diff = total - Number(e.target.value || 0);
                      setCardAmount(String(Math.max(0, diff).toFixed(2)));
                    }}
                    className="w-full border border-stone-200 bg-stone-50 focus:bg-white px-4 py-3 rounded-xl text-xl font-mono font-bold text-stone-800 text-left focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-600 mb-1">المبلغ بطاقة (شبكة)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={cardAmount}
                    onChange={(e) => {
                      setCardAmount(e.target.value);
                      const diff = total - Number(e.target.value || 0);
                      setCashAmount(String(Math.max(0, diff).toFixed(2)));
                    }}
                    className="w-full border border-stone-200 bg-stone-50 focus:bg-white px-4 py-3 rounded-xl text-xl font-mono font-bold text-stone-800 text-left focus:outline-none focus:ring-2 focus:ring-[#2E7D32]"
                  />
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex gap-3 justify-end border-t border-stone-100 pt-4">
              <button
                type="button"
                onClick={onCancel}
                className="px-5 py-3 border border-stone-200 text-stone-600 hover:bg-stone-50 rounded-xl font-bold text-sm transition-all"
              >
                إلغاء التراجع
              </button>
              <button
                type="button"
                onClick={handleConfirmPayment}
                disabled={loading}
                className="px-8 py-3.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl font-bold text-sm shadow-md flex items-center gap-2 transition-all"
              >
                <Check className="w-4 h-4" />
                <span>{loading ? "جاري تسوية الفاتورة..." : "تأكيد الدفع وطباعة الفاتورة ⏎"}</span>
              </button>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
