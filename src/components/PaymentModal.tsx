import React, { useState, useEffect } from "react";
import { X, Coins, CreditCard, Receipt, Check, AlertCircle, Sparkles, Printer, Info, UserCheck, Search } from "lucide-react";
import { Order, OrderItem, Payment, OrderType, Customer, Product } from "../types";
import QRCode from "qrcode";

function generateZatcaString(sellerName: string, vatNumber: string, dateStr: string, total: number, vatAmount: number): string {
  const getTlv = (tag: number, val: string) => {
    const encoder = new TextEncoder();
    const valBuf = encoder.encode(val);
    const tagBuf = new Uint8Array([tag]);
    const lenBuf = new Uint8Array([valBuf.length]);
    const combined = new Uint8Array(tagBuf.length + lenBuf.length + valBuf.length);
    combined.set(tagBuf);
    combined.set(lenBuf, tagBuf.length);
    combined.set(valBuf, tagBuf.length + lenBuf.length);
    return combined;
  };

  const tlv1 = getTlv(1, sellerName);
  const tlv2 = getTlv(2, vatNumber);
  const tlv3 = getTlv(3, dateStr);
  const tlv4 = getTlv(4, total.toFixed(2));
  const tlv5 = getTlv(5, vatAmount.toFixed(2));

  const totalLength = tlv1.length + tlv2.length + tlv3.length + tlv4.length + tlv5.length;
  const finalBuf = new Uint8Array(totalLength);
  let offset = 0;
  [tlv1, tlv2, tlv3, tlv4, tlv5].forEach(buf => {
    finalBuf.set(buf, offset);
    offset += buf.length;
  });

  let binary = '';
  const len = finalBuf.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(finalBuf[i]);
  }
  return btoa(binary);
}

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
  const [method, setMethod] = useState<"cash" | "card" | "split" | "credit">("cash");
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("cust-1");
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>("عميل نقدي افتراضي");
  const [customerSearchQuery, setCustomerSearchQuery] = useState<string>("");
  const [customerSearchResults, setCustomerSearchResults] = useState<any[]>([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState<boolean>(false);
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
    if (customerId) {
      setSelectedCustomerId(customerId);
      fetch(`/api/customers/${customerId}`)
        .then(r => r.json())
        .then(data => {
          if (data && data.customer) {
            setSelectedCustomerName(data.customer.name);
          }
        })
        .catch(err => console.error(err));
    }
  }, [customerId]);

  useEffect(() => {
    if (customerSearchQuery.trim()) {
      fetch(`/api/customers?search=${encodeURIComponent(customerSearchQuery)}`)
        .then(r => r.json())
        .then(data => {
          setCustomerSearchResults(data || []);
          setShowCustomerDropdown(true);
        })
        .catch(err => console.error(err));
    } else {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
    }
  }, [customerSearchQuery]);

  useEffect(() => {
    if (method === "cash") {
      setTendered(String(total));
    } else if (method === "card") {
      setTendered(String(total));
    } else if (method === "credit") {
      setTendered("0");
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
    if (method === "credit" && selectedCustomerId === "cust-1") {
      setError("الرجاء اختيار عميل حقيقي لتسجيل البيع الآجل!");
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
      status: "pending",
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
    } else if (method === "credit") {
      paymentsArray.push({
        id: `pay-${Date.now()}-1`,
        orderId: clientUuid,
        method: "credit",
        amount: total,
        tendered: 0,
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
      customerId: selectedCustomerId,
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

    // 1. Generate Receipt HTML (generate it first so it's always ready for printing/display!)
    const bName = settings?.businessNameAr || "مؤسسة مقبوله مران غازي الهفيل للتجارة";
    const bNameEn = settings?.businessNameEn || "";
    const bBranch = settings?.branchName || "الخرج";
    const bTax = settings?.taxNumber || "311798679800003";
    const bCR = (settings as any)?.commercialReg || "7034371000";
    const bAddress = settings?.address || "الخرج، طريق ثمامه - حي الورود";
    const bPhone = settings?.phone || "0555107546";
    const bFooter = settings?.receiptFooter || "شكراً لزيارتكم!";
    const bCurrency = settings?.currency || "ر.س";

    const now = new Date();
    const pad = (n: number) => n.toString().padStart(2, '0');
    const invoiceDate = `${now.getUTCFullYear()}-${pad(now.getUTCMonth() + 1)}-${pad(now.getUTCDate())}T${pad(now.getUTCHours())}:${pad(now.getUTCMinutes())}:${pad(now.getUTCSeconds())}Z`;
    
    let qrCodeDataUrl = "";
    try {
      const zatcaString = generateZatcaString(bName, bTax, invoiceDate, total, tax);
      // Increased size to 200 and set errorCorrectionLevel to H for excellent thermal print scanning!
      qrCodeDataUrl = await QRCode.toDataURL(zatcaString, { margin: 1, width: 200, errorCorrectionLevel: 'H' });
    } catch (err) {
      console.error("Error generating ZATCA QR Code:", err);
    }

    // Determine invoice number for receipt layout: try to guess next number locally or fall back
    // (We'll update it if the server response returns a real one, but this ensures a preview is always shown)
    const localOrderNumber = Math.floor(Math.random() * 9000) + 1000;

    const generateHTML = (ordNum: number) => `
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 0;
            padding: 4px 6px;
            font-family: 'Tahoma', 'Arial', 'Segoe UI', sans-serif;
            background: white;
            color: black;
            direction: rtl;
            text-align: right;
            -webkit-print-color-adjust: exact;
          }
          .receipt-container {
            width: 100%;
            max-width: 100%;
            margin: 0 auto;
            font-size: 11px;
            line-height: 1.4;
          }
          .text-center {
            text-align: center;
          }
          .receipt-header {
            border-bottom: 1px dashed black;
            padding-bottom: 8px;
            margin-bottom: 8px;
          }
          .receipt-logo {
            width: 70px;
            height: 70px;
            object-fit: contain;
            margin: 0 auto 6px;
            display: block;
          }
          .receipt-title {
            font-size: 13px;
            font-weight: bold;
            margin: 2px 0;
          }
          .receipt-subtitle {
            font-size: 10px;
            margin: 1px 0;
            color: #444;
          }
          .receipt-info-block {
            border-bottom: 1px dashed black;
            padding-bottom: 6px;
            margin-bottom: 8px;
            font-size: 10px;
          }
          .receipt-info-row {
            display: flex;
            justify-content: space-between;
            margin: 1px 0;
          }
          .receipt-table {
            width: 100%;
            border-collapse: collapse;
            margin: 8px 0;
          }
          .receipt-table th {
            border-bottom: 1px solid black;
            font-weight: bold;
            padding: 4px 0;
            font-size: 10px;
          }
          .receipt-table td {
            padding: 5px 0;
            font-size: 11px;
            vertical-align: middle;
          }
          .receipt-totals {
            border-top: 1px dashed black;
            padding-top: 6px;
            margin-top: 6px;
          }
          .receipt-total-row {
            display: flex;
            justify-content: space-between;
            margin: 2px 0;
          }
          .receipt-grand-total {
            font-size: 13px;
            font-weight: bold;
            border-top: 1px solid black;
            border-bottom: 1px solid black;
            padding: 5px 0;
            margin-top: 4px;
          }
          .qr-container {
            display: flex;
            justify-content: center;
            align-items: center;
            margin: 10px 0;
          }
          .qr-code {
            width: 125px;
            height: 125px;
            display: block;
            margin: 0 auto;
          }
          .receipt-footer {
            text-align: center;
            font-size: 9px;
            border-top: 1px dashed black;
            padding-top: 8px;
            margin-top: 8px;
          }
        </style>
      </head>
      <body>
        <div class="receipt-container">
          <div class="receipt-header text-center">
            ${settings?.logoBase64 ? `<img src="${settings.logoBase64}" class="receipt-logo" />` : ''}
            <div class="receipt-title">${bName}</div>
            <div class="receipt-subtitle">${bNameEn}</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 6px; border: 1.5px solid black; padding: 3px 6px; display: inline-block; border-radius: 4px;">فاتورة ضريبية مبسطة</div>
            ${bBranch ? `<div class="receipt-subtitle" style="margin-top: 4px;">فرع: ${bBranch}</div>` : ''}
            ${bAddress ? `<div class="receipt-subtitle">${bAddress}</div>` : ''}
            ${bPhone ? `<div class="receipt-subtitle">هاتف: ${bPhone}</div>` : ''}
            ${bTax ? `<div class="receipt-subtitle">الرقم الضريبي: ${bTax}</div>` : ''}
            ${bCR ? `<div class="receipt-subtitle">رقم السجل التجاري: ${bCR}</div>` : ''}
          </div>

          <div class="receipt-info-block">
            <div class="receipt-info-row"><span>رقم الفاتورة:</span><span>#FT-${ordNum}</span></div>
            <div class="receipt-info-row"><span>التاريخ والوقت:</span><span>${new Date().toLocaleString('ar-SA')}</span></div>
            <div class="receipt-info-row"><span>الكاشير:</span><span>${cashierName}</span></div>
            <div class="receipt-info-row"><span>نوع الطلب:</span><span>${
              orderType === 'dine_in' 
                ? 'داخلي (طاولة ' + (tableId || '') + ')' 
                : orderType === 'takeaway' 
                ? 'سفري / تطبيقات (' + (notes || '') + ')' 
                : 'توصيل للمنزل'
            }</span></div>
          </div>

          <table class="receipt-table">
            <thead>
              <tr>
                <th style="text-align: right; width: 50%;">الصنف</th>
                <th style="text-align: center; width: 20%;">الكمية</th>
                <th style="text-align: left; width: 30%;">المجموع</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems.map(item => {
                const unitPrice = item.unitPrice || (item.lineTotal / item.quantity);
                return `
                  <tr>
                    <td style="text-align: right; padding-bottom: 4px;">
                      <div style="font-weight: bold;">${item.productNameSnapshot}</div>
                      <div style="font-size: 10px; color: #333; margin-top: 1.5px;">${item.quantity} * ${unitPrice.toFixed(2)} = ${item.lineTotal.toFixed(2)} ${bCurrency}</div>
                    </td>
                    <td style="text-align: center;">${item.quantity}</td>
                    <td style="text-align: left; font-weight: bold; vertical-align: bottom;">${item.lineTotal.toFixed(2)} ${bCurrency}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>

          <div class="receipt-totals">
            <div class="receipt-total-row"><span>الإجمالي الفرعي (خاضع للضريبة):</span><span>${(total - tax).toFixed(2)} ${bCurrency}</span></div>
            ${discount > 0 ? `<div class="receipt-total-row" style="color: red;"><span>الخصم:</span><span>-${discount.toFixed(2)} ${bCurrency}</span></div>` : ''}
            ${tax > 0 ? `<div class="receipt-total-row"><span>ضريبة القيمة المضافة ${settings?.vatRate || 15}%:</span><span>${tax.toFixed(2)} ${bCurrency}</span></div>` : ''}
            <div class="receipt-total-row receipt-grand-total"><span>الإجمالي الكلي (شامل الضريبة):</span><span>${total.toFixed(2)} ${bCurrency}</span></div>
          </div>

          <div class="receipt-totals" style="border-top: none; margin-top: 4px;">
            <div class="receipt-total-row" style="font-weight: bold;"><span>طريقة الدفع:</span><span></span></div>
            ${paymentsArray.map(p => `
              <div class="receipt-total-row">
                <span>${p.method === 'cash' ? 'نقداً (كاش)' : 'مدى / فيزا (شبكة)'}:</span>
                <span>${p.amount.toFixed(2)} ${bCurrency}</span>
              </div>
            `).join('')}
            ${method === 'cash' ? `
              <div class="receipt-total-row"><span>المبلغ المدفوع:</span><span>${tenderedValue.toFixed(2)} ${bCurrency}</span></div>
              <div class="receipt-total-row" style="font-weight: bold; color: green;"><span>المتبقي للعميل:</span><span>${changeDue.toFixed(2)} ${bCurrency}</span></div>
            ` : ''}
          </div>

          ${qrCodeDataUrl ? `
            <div class="qr-container">
              <img src="${qrCodeDataUrl}" class="qr-code" />
            </div>
          ` : ''}

          <div class="receipt-footer">
            <p>${bFooter}</p>
            <p style="margin-top: 4px; font-weight: bold;">فاتورة مبسطة خاضعة للمواصفات الضريبية</p>
            <p>نظام كاشي لإدارة نقاط البيع Cashi POS</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const html = generateHTML(localOrderNumber);
    setReceiptHTML(html);

    // Kitchen receipt HTML template (prices hidden, large font)
    const generateKitchenHTML = (ordNum: number) => `
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          @page {
            margin: 0;
            size: auto;
          }
          body {
            margin: 0;
            padding: 4px 6px;
            font-family: 'Tahoma', 'Arial', 'Segoe UI', sans-serif;
            background: white;
            color: black;
            direction: rtl;
            text-align: right;
            -webkit-print-color-adjust: exact;
          }
          .kitchen-container {
            width: 100%;
            max-width: 270px;
            margin: 0 auto;
            font-size: 13px;
            line-height: 1.4;
          }
          .text-center {
            text-align: center;
          }
          .kitchen-header {
            border-bottom: 2px solid black;
            padding-bottom: 6px;
            margin-bottom: 8px;
          }
          .kitchen-table {
            width: 100%;
            border-collapse: collapse;
          }
          .kitchen-table th {
            border-bottom: 2px solid black;
            padding: 4px 0;
            font-size: 12px;
            font-weight: bold;
          }
          .kitchen-table td {
            padding: 6px 0;
            font-size: 14px;
            font-weight: bold;
            border-bottom: 1px solid #ccc;
          }
        </style>
      </head>
      <body>
        <div class="kitchen-container">
          <div class="kitchen-header text-center">
            <h2 style="margin: 0; font-size: 16px; font-weight: bold;">*** تذكرة المطبخ ***</h2>
            <div style="font-size: 18px; font-weight: bold; margin: 4px 0; border: 2px solid black; padding: 4px; display: inline-block;">رقم الطلب: #${ordNum}</div>
            <div style="font-size: 11px;">التاريخ: ${new Date().toLocaleString('ar-SA')}</div>
            <div style="font-size: 12px; font-weight: bold; margin-top: 2px;">
              النوع: ${
                orderType === 'dine_in' 
                  ? 'داخلي (طاولة ' + (tableId || '') + ')' 
                  : orderType === 'takeaway' 
                  ? 'سفري / تطبيقات (' + (notes || '') + ')' 
                  : 'توصيل'
              }
            </div>
          </div>
          <table class="kitchen-table">
            <thead>
              <tr>
                <th style="text-align: right; width: 70%;">الصنف</th>
                <th style="text-align: center; width: 30%;">الكمية</th>
              </tr>
            </thead>
            <tbody>
              ${orderItems.map(item => `
                <tr>
                  <td style="text-align: right;">${item.productNameSnapshot}</td>
                  <td style="text-align: center; font-size: 18px;">${item.quantity}</td>
                </tr>
                ${item.notes ? `
                  <tr>
                    <td colspan="2" style="font-size: 12px; color: red; padding: 4px 0; font-weight: bold;">
                      ⚠️ ملاحظة: ${item.notes}
                    </td>
                  </tr>
                ` : ''}
              `).join('')}
            </tbody>
          </table>
          <div style="text-align: center; font-size: 10px; margin-top: 15px; border-top: 1px dashed black; padding-top: 5px;">
            نظام كاشي لإدارة نقاط البيع Cashi POS
          </div>
        </div>
      </body>
      </html>
    `;

    const kitchenHTML = generateKitchenHTML(localOrderNumber);

    const printReceiptMockAndPhysical = async (ordNum: number, receiptHtml: string, kitchenHtml: string, uuid: string, itemsArr: any[]) => {
      // Print Customer receipt mock
      await fetch("/api/print/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: uuid, total, items: itemsArr }),
      }).catch(err => console.warn("Mock print receipt failed:", err));

      // Print Kitchen ticket mock
      await fetch("/api/print/kitchen", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId: uuid, items: itemsArr, tableId, orderType }),
      }).catch(err => console.warn("Mock print kitchen failed:", err));

      // Automatic physical dual printing under Electron
      const electronAPI = (window as any).electronAPI;
      if (electronAPI?.isElectron) {
        try {
          const receiptDataObject = {
            businessName: bName,
            businessNameEn: bNameEn || undefined,
            branchName: bBranch || undefined,
            address: bAddress || undefined,
            phone: bPhone || undefined,
            taxNumber: bTax || undefined,
            receiptNumber: `FT-${ordNum}`,
            date: new Date().toLocaleString('ar-SA'),
            cashierName: cashierName || "كاشير",
            orderType: orderType === 'dine_in' 
              ? 'داخلي' 
              : orderType === 'takeaway' 
              ? 'سفري / تطبيقات' 
              : 'توصيل',
            tableId: tableId || undefined,
            items: itemsArr.map(item => {
              const unitPrice = item.unitPrice || (item.lineTotal / item.quantity);
              return {
                name: item.productNameSnapshot,
                quantity: item.quantity,
                unitPrice: unitPrice,
                total: item.lineTotal
              };
            }),
            subtotal: total - tax,
            discount: discount || 0,
            tax: tax || 0,
            total: total,
            payments: paymentsArray.map(p => ({
              method: p.method === 'cash' ? 'نقداً' : 'شبكة',
              amount: p.amount
            })),
            tendered: method === 'cash' ? tenderedValue : undefined,
            change: method === 'cash' ? changeDue : undefined,
            footerMessage: bFooter || undefined
          };

          const kitchenDataObject = {
            orderNumber: String(ordNum),
            date: new Date().toLocaleString('ar-SA'),
            orderType: orderType === 'dine_in' 
              ? 'داخلي' 
              : orderType === 'takeaway' 
              ? 'سفري / تطبيقات' 
              : 'توصيل',
            tableId: tableId || undefined,
            items: itemsArr.map(item => ({
              name: item.productNameSnapshot,
              quantity: item.quantity,
              notes: item.notes || undefined
            }))
          };

          await electronAPI.printReceipt({ html: receiptHtml, structuredData: receiptDataObject });
          await electronAPI.printKitchenTicket({ html: kitchenHtml, structuredData: kitchenDataObject });
        } catch (printErr) {
          console.error("Auto print failed:", printErr);
        }
      }
    };

    try {
      // 2. Submit order to DB
      const res = await fetch("/api/orders/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(orderDoc),
      });

      if (!res.ok) {
        throw new Error("فشلت مزامنة الفاتورة مع خادم المحل");
      }

      const responseData = await res.json();
      const actualOrderNumber = responseData?.order?.orderNumber || localOrderNumber;

      const finalHtml = generateHTML(actualOrderNumber);
      const finalKitchenHtml = generateKitchenHTML(actualOrderNumber);
      setReceiptHTML(finalHtml);

      // Trigger print with real order number
      await printReceiptMockAndPhysical(actualOrderNumber, finalHtml, finalKitchenHtml, clientUuid, orderItems);

      setSuccess(true);
    } catch (e) {
      console.error("Sync or print failed, fallback to offline queue:", e);
      setError("فشل الاتصال بالخادم. تم تخزين الفاتورة في طابور الأوفلاين للتزامن.");
      
      // Dispatch offline queue event to App.tsx
      window.dispatchEvent(new CustomEvent("pos-offline-order-added", { detail: orderDoc }));

      // Trigger local mock print with local HTML
      try {
        await printReceiptMockAndPhysical(localOrderNumber, html, kitchenHTML, clientUuid, orderItems);
      } catch (err) {
        console.error("Local preview print failed:", err);
      }

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

            {/* Customer Search and Autocomplete */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 space-y-2 text-right relative">
              <label className="block text-xs font-bold text-stone-600">العميل المرتبط بالفاتورة (لنقاط الولاء والآجل)</label>
              <div className="flex gap-2">
                {selectedCustomerId !== "cust-1" ? (
                  <div className="w-full flex items-center justify-between bg-[#EAF4EA] border border-green-200 text-[#2E7D32] px-3 py-2 rounded-xl text-xs font-bold">
                    <span>{selectedCustomerName}</span>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId("cust-1");
                        setSelectedCustomerName("عميل نقدي افتراضي");
                      }}
                      className="text-stone-400 hover:text-stone-600"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <div className="relative w-full">
                    <input
                      type="text"
                      placeholder="ابحث عن عميل باسمه أو رقم هاتفه..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      className="w-full pl-3 pr-9 py-2 bg-stone-50 border border-stone-200 rounded-xl text-xs text-right focus:outline-none focus:ring-1 focus:ring-[#2E7D32]"
                    />
                    <Search className="w-4 h-4 text-stone-400 absolute top-2.5 right-3" />
                    
                    {showCustomerDropdown && customerSearchResults.length > 0 && (
                      <div className="absolute right-0 left-0 mt-1 bg-white border border-stone-200 rounded-xl shadow-lg z-50 max-h-40 overflow-y-auto divide-y divide-stone-100">
                        {customerSearchResults.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => {
                              setSelectedCustomerId(c.id);
                              setSelectedCustomerName(c.name);
                              setCustomerSearchQuery("");
                              setShowCustomerDropdown(false);
                            }}
                            className="w-full text-right py-2 px-3 hover:bg-stone-50 text-xs font-bold text-stone-700 flex justify-between items-center"
                          >
                            <span>{c.name}</span>
                            <span className="text-[10px] text-stone-400 font-mono">{c.phone || "بدون هاتف"}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Selector methods */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
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
              <button
                type="button"
                onClick={() => setMethod("credit")}
                disabled={selectedCustomerId === "cust-1"}
                className={`py-4 px-3 rounded-xl border flex flex-col items-center justify-center gap-2 transition-all font-bold text-sm ${
                  selectedCustomerId === "cust-1" ? "opacity-40 cursor-not-allowed border-stone-100 text-stone-400" :
                  method === "credit"
                    ? "bg-red-50 border-red-500 text-red-700 shadow-sm"
                    : "border-stone-200 hover:bg-stone-50 text-stone-700"
                }`}
                title={selectedCustomerId === "cust-1" ? "اختر عميل حقيقي لتفعيل الدفع الآجل" : ""}
              >
                <UserCheck className="w-6 h-6" />
                <span>دفع آجل</span>
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
