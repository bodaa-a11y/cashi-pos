import React from "react";
import { Store, Printer, Globe } from "lucide-react";

interface SettingsTabProps {
  settingsForm: {
    businessNameAr: string;
    businessNameEn: string;
    branchName: string;
    address: string;
    phone: string;
    taxNumber: string;
    currency: string;
    vatRate: number;
    receiptFooter: string;
    logoBase64: string;
  };
  setSettingsForm: React.Dispatch<React.SetStateAction<any>>;
  handleSaveSettings: (e: React.FormEvent) => Promise<void>;
  
  printerSettings: {
    type: string;
    interface: string;
    networkAddress: string;
    paperWidth: number;
    autoCut: boolean;
    openDrawerOnCash: boolean;
    printerName: string;
  };
  setPrinterSettings: React.Dispatch<React.SetStateAction<any>>;
  handleSavePrinterSettings: () => Promise<void>;
  printersList: string[];
  appInfo: any;
  handleLogoUploadSettings: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export default function SettingsTab({
  settingsForm,
  setSettingsForm,
  handleSaveSettings,
  printerSettings,
  setPrinterSettings,
  handleSavePrinterSettings,
  printersList,
  appInfo,
  handleLogoUploadSettings
}: SettingsTabProps) {
  return (
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

      {/* إعدادات المزامنة السحابية */}
      <form onSubmit={handleSaveSettings} className="bg-white border border-stone-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-stone-800 border-b border-stone-100 pb-2 flex items-center gap-2">
          <Globe className="w-5 h-5 text-stone-600" />
          <span>المزامنة السحابية والربط مع الويب (Hybrid Cloud Sync)</span>
        </h3>

        <div className="flex items-center gap-2 py-2">
          <input
            type="checkbox"
            id="cloudSyncEnabled"
            checked={settingsForm.cloudSyncEnabled || false}
            onChange={(e) => setSettingsForm({ ...settingsForm, cloudSyncEnabled: e.target.checked })}
            className="w-4 h-4 text-[#2E7D32] focus:ring-[#2E7D32]"
          />
          <label htmlFor="cloudSyncEnabled" className="text-xs font-bold text-stone-700 cursor-pointer">
            تفعيل مزامنة المبيعات والتقارير تلقائياً مع السحابة
          </label>
        </div>

        {settingsForm.cloudSyncEnabled && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 animate-in fade-in slide-in-from-top-2 duration-200">
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">رابط سيرفر المزامنة (API URL) *</label>
              <input
                type="url"
                required={settingsForm.cloudSyncEnabled}
                value={settingsForm.cloudApiUrl || ""}
                onChange={(e) => setSettingsForm({ ...settingsForm, cloudApiUrl: e.target.value })}
                placeholder="https://cashi-server.render.com"
                dir="ltr"
                className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">رمز المصادقة الأمني (Token) *</label>
              <input
                type="password"
                required={settingsForm.cloudSyncEnabled}
                value={settingsForm.cloudAuthToken || ""}
                onChange={(e) => setSettingsForm({ ...settingsForm, cloudAuthToken: e.target.value })}
                placeholder="ادخل رمز توكن المزامنة..."
                dir="ltr"
                className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-center focus:outline-none font-mono"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-stone-700 mb-1">رقم/معرف الفرع الحالي (Branch ID) *</label>
              <input
                type="text"
                required={settingsForm.cloudSyncEnabled}
                value={settingsForm.branchId || ""}
                onChange={(e) => setSettingsForm({ ...settingsForm, branchId: e.target.value })}
                placeholder="مثال: branch-01"
                dir="ltr"
                className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end pt-2">
          <button
            type="submit"
            className="px-6 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow transition-all"
          >
            حفظ إعدادات المزامنة السحابية
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
            type="button"
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
            type="button"
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
  );
}
