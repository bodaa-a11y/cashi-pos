import React, { useState, useRef } from "react";
// No framer motion
import {
  Store,
  MapPin,
  Phone,
  FileText,
  Palette,
  ChevronLeft,
  ChevronRight,
  Upload,
  Check,
  DollarSign,
  Image as ImageIcon,
  Building2,
  Globe
} from "lucide-react";

interface SetupWizardProps {
  onSetupComplete: (settings: any) => void;
}

export default function SetupWizard({ onSetupComplete }: SetupWizardProps) {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // بيانات النموذج
  const [form, setForm] = useState({
    businessNameAr: "",
    businessNameEn: "",
    branchName: "",
    address: "",
    phone: "",
    taxNumber: "",
    currency: "ر.س",
    vatRate: 15,
    receiptFooter: "شكراً لزيارتكم! نتمنى لكم يوماً سعيداً",
    logoBase64: "" as string
  });

  const steps = [
    { icon: Store, title: "معلومات المنشأة", subtitle: "اسم المطعم أو المحل" },
    { icon: MapPin, title: "العنوان والتواصل", subtitle: "بيانات الموقع والهاتف" },
    { icon: FileText, title: "المعلومات الضريبية", subtitle: "الرقم الضريبي والعملة" },
    { icon: ImageIcon, title: "الشعار والمظهر", subtitle: "شعار المنشأة ورسالة الإيصال" }
  ];

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError("حجم الصورة يجب أن لا يتجاوز 2 ميجابايت");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      setForm({ ...form, logoBase64: ev.target?.result as string });
      setError("");
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    if (!form.businessNameAr.trim()) {
      setError("يرجى إدخال اسم المنشأة بالعربية");
      setStep(0);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });

      if (res.ok) {
        const data = await res.json();
        onSetupComplete(data.settings);
      } else {
        setError("حدث خطأ في حفظ الإعدادات. حاول مرة أخرى.");
      }
    } catch (e) {
      setError("فشل الاتصال بالخادم. تأكد من تشغيل النظام.");
    } finally {
      setLoading(false);
    }
  };

  const nextStep = () => {
    if (step === 0 && !form.businessNameAr.trim()) {
      setError("يرجى إدخال اسم المنشأة بالعربية");
      return;
    }
    setError("");
    if (step < steps.length - 1) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const prevStep = () => {
    setError("");
    if (step > 0) setStep(step - 1);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-emerald-900 via-emerald-800 to-teal-900 flex items-center justify-center p-6 selection:bg-emerald-300/20">
      <div className="w-full max-w-2xl">
        {/* الهيدر مع اللوجو */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center border border-white/20 shadow-xl">
            <Store className="w-10 h-10 text-emerald-300" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">مرحباً بك في كاشي</h1>
          <p className="text-emerald-200/80 text-sm">قم بإعداد بيانات منشأتك لبدء استخدام النظام</p>
        </div>

        {/* مؤشر الخطوات */}
        <div className="flex items-center justify-center gap-2 mb-6">
          {steps.map((s, i) => (
            <React.Fragment key={i}>
              <button
                onClick={() => { if (i <= step) { setStep(i); setError(""); } }}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all text-sm
                  ${i === step
                    ? "bg-white text-emerald-800 shadow-lg font-bold"
                    : i < step
                      ? "bg-emerald-600/50 text-white cursor-pointer hover:bg-emerald-600/70"
                      : "bg-white/10 text-emerald-300/60 cursor-default"
                  }`}
              >
                {i < step ? (
                  <Check className="w-4 h-4 text-emerald-300" />
                ) : (
                  <s.icon className="w-4 h-4" />
                )}
                <span className="hidden sm:inline">{s.title}</span>
                <span className="sm:hidden">{i + 1}</span>
              </button>
              {i < steps.length - 1 && (
                <div className={`w-6 h-0.5 ${i < step ? "bg-emerald-400" : "bg-white/20"} rounded-full`} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* الكارت الرئيسي */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 shadow-2xl overflow-hidden">
          <div className="p-8">
            <>
              {/* ===================== الخطوة 1: معلومات المنشأة ===================== */}
              {step === 0 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <Building2 className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-white">معلومات المنشأة</h2>
                    <p className="text-emerald-200/60 text-sm mt-1">هذه البيانات ستظهر في الفواتير والإيصالات</p>
                  </div>

                  <div>
                    <label className="block text-emerald-100 text-sm font-bold mb-2">
                      اسم المنشأة بالعربية <span className="text-red-400">*</span>
                    </label>
                    <input
                      type="text"
                      value={form.businessNameAr}
                      onChange={(e) => setForm({ ...form, businessNameAr: e.target.value })}
                      placeholder="مثال: مطعم الذواقة"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all text-lg"
                      autoFocus
                    />
                  </div>

                  <div>
                    <label className="block text-emerald-100 text-sm font-bold mb-2">
                      اسم المنشأة بالإنجليزية (اختياري)
                    </label>
                    <input
                      type="text"
                      value={form.businessNameEn}
                      onChange={(e) => setForm({ ...form, businessNameEn: e.target.value })}
                      placeholder="Example: Al-Thawwaqa Restaurant"
                      dir="ltr"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-emerald-100 text-sm font-bold mb-2">
                      اسم الفرع (اختياري)
                    </label>
                    <input
                      type="text"
                      value={form.branchName}
                      onChange={(e) => setForm({ ...form, branchName: e.target.value })}
                      placeholder="مثال: الفرع الرئيسي - الرياض"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* ===================== الخطوة 2: العنوان والتواصل ===================== */}
              {step === 1 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <MapPin className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-white">العنوان والتواصل</h2>
                    <p className="text-emerald-200/60 text-sm mt-1">عنوان المنشأة وأرقام التواصل للطباعة على الفواتير</p>
                  </div>

                  <div>
                    <label className="block text-emerald-100 text-sm font-bold mb-2">
                      العنوان
                    </label>
                    <textarea
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="مثال: حي العليا، شارع الملك فهد، الرياض"
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all resize-none"
                    />
                  </div>

                  <div>
                    <label className="block text-emerald-100 text-sm font-bold mb-2">
                      رقم الهاتف
                    </label>
                    <input
                      type="tel"
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="مثال: 0112345678"
                      dir="ltr"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                    />
                  </div>
                </div>
              )}

              {/* ===================== الخطوة 3: المعلومات الضريبية ===================== */}
              {step === 2 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <FileText className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-white">المعلومات الضريبية</h2>
                    <p className="text-emerald-200/60 text-sm mt-1">بيانات الضريبة والعملة المستخدمة</p>
                  </div>

                  <div>
                    <label className="block text-emerald-100 text-sm font-bold mb-2">
                      الرقم الضريبي
                    </label>
                    <input
                      type="text"
                      value={form.taxNumber}
                      onChange={(e) => setForm({ ...form, taxNumber: e.target.value })}
                      placeholder="مثال: 300058472900003"
                      dir="ltr"
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 focus:border-emerald-400/50 transition-all"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-emerald-100 text-sm font-bold mb-2">
                        العملة
                      </label>
                      <select
                        value={form.currency}
                        onChange={(e) => setForm({ ...form, currency: e.target.value })}
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                      >
                        <option value="ر.س" className="bg-emerald-900">ر.س (ريال سعودي)</option>
                        <option value="د.إ" className="bg-emerald-900">د.إ (درهم إماراتي)</option>
                        <option value="ر.ع" className="bg-emerald-900">ر.ع (ريال عُماني)</option>
                        <option value="د.ك" className="bg-emerald-900">د.ك (دينار كويتي)</option>
                        <option value="ر.ق" className="bg-emerald-900">ر.ق (ريال قطري)</option>
                        <option value="د.ب" className="bg-emerald-900">د.ب (دينار بحريني)</option>
                        <option value="ج.م" className="bg-emerald-900">ج.م (جنيه مصري)</option>
                        <option value="د.ج" className="bg-emerald-900">د.ج (دينار جزائري)</option>
                        <option value="د.أ" className="bg-emerald-900">د.أ (دينار أردني)</option>
                        <option value="ل.ل" className="bg-emerald-900">ل.ل (ليرة لبنانية)</option>
                        <option value="$" className="bg-emerald-900">$ (دولار أمريكي)</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-emerald-100 text-sm font-bold mb-2">
                        نسبة ضريبة القيمة المضافة %
                      </label>
                      <input
                        type="number"
                        value={form.vatRate}
                        onChange={(e) => setForm({ ...form, vatRate: Number(e.target.value) })}
                        min={0}
                        max={100}
                        className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* ===================== الخطوة 4: الشعار والمظهر ===================== */}
              {step === 3 && (
                <div className="space-y-5">
                  <div className="text-center mb-6">
                    <Palette className="w-12 h-12 text-emerald-400 mx-auto mb-3" />
                    <h2 className="text-xl font-bold text-white">الشعار والمظهر</h2>
                    <p className="text-emerald-200/60 text-sm mt-1">ارفع شعار منشأتك وخصص رسالة الإيصال</p>
                  </div>

                  {/* منطقة رفع الشعار */}
                  <div>
                    <label className="block text-emerald-100 text-sm font-bold mb-2">
                      شعار المنشأة (اختياري)
                    </label>
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full border-2 border-dashed border-white/30 rounded-2xl p-6 text-center cursor-pointer hover:border-emerald-400/60 hover:bg-white/5 transition-all group"
                    >
                      {form.logoBase64 ? (
                        <div className="flex flex-col items-center gap-3">
                          <img
                            src={form.logoBase64}
                            alt="شعار المنشأة"
                            className="w-24 h-24 object-contain rounded-xl bg-white/10 p-2"
                          />
                          <span className="text-emerald-300 text-sm">اضغط لتغيير الشعار</span>
                        </div>
                      ) : (
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-16 h-16 rounded-2xl bg-white/10 flex items-center justify-center group-hover:bg-emerald-500/20 transition-all">
                            <Upload className="w-8 h-8 text-emerald-300/60 group-hover:text-emerald-300 transition-colors" />
                          </div>
                          <div>
                            <p className="text-white font-bold text-sm">اضغط لرفع الشعار</p>
                            <p className="text-emerald-200/50 text-xs mt-1">PNG, JPG — حد أقصى 2 ميجابايت</p>
                          </div>
                        </div>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/jpg,image/webp"
                      onChange={handleLogoUpload}
                      className="hidden"
                    />
                  </div>

                  {/* رسالة أسفل الإيصال */}
                  <div>
                    <label className="block text-emerald-100 text-sm font-bold mb-2">
                      رسالة أسفل الإيصال
                    </label>
                    <textarea
                      value={form.receiptFooter}
                      onChange={(e) => setForm({ ...form, receiptFooter: e.target.value })}
                      placeholder="شكراً لزيارتكم!"
                      rows={2}
                      className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-emerald-400/50 transition-all resize-none"
                    />
                  </div>

                  {/* معاينة الإيصال */}
                  <div className="bg-white rounded-xl p-4 text-stone-800 text-xs text-center space-y-1 shadow-inner max-w-[280px] mx-auto" dir="rtl">
                    {form.logoBase64 && (
                      <img src={form.logoBase64} alt="logo" className="w-14 h-14 mx-auto mb-2 object-contain" />
                    )}
                    <p className="font-bold text-sm">{form.businessNameAr || "اسم المنشأة"}</p>
                    {form.businessNameEn && <p className="text-[10px] text-stone-500">{form.businessNameEn}</p>}
                    {form.branchName && <p className="text-[10px]">{form.branchName}</p>}
                    {form.address && <p className="text-[10px] text-stone-500">{form.address}</p>}
                    {form.phone && <p className="text-[10px]">هاتف: {form.phone}</p>}
                    {form.taxNumber && <p className="text-[10px]">الرقم الضريبي: {form.taxNumber}</p>}
                    <div className="border-t border-dashed border-stone-300 my-2" />
                    <p className="text-[10px] text-stone-400">— معاينة رأس الإيصال —</p>
                    <div className="border-t border-dashed border-stone-300 my-2" />
                    <p className="text-[10px] text-stone-500">{form.receiptFooter}</p>
                    <p className="text-[9px] text-stone-300 mt-1">مشغّل بواسطة كاشي Cashi</p>
                  </div>
                </div>
              )}
            </>
          </div>

          {/* رسالة الخطأ */}
          {error && (
            <div className="mx-8 mb-4 px-4 py-2 bg-red-500/20 border border-red-400/30 rounded-xl text-red-200 text-sm text-center">
              {error}
            </div>
          )}

          {/* أزرار التنقل */}
          <div className="px-8 pb-8 flex items-center justify-between gap-4">
            <button
              onClick={prevStep}
              disabled={step === 0}
              className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed font-bold"
            >
              <ChevronRight className="w-5 h-5" />
              <span>السابق</span>
            </button>

            <div className="text-emerald-200/40 text-sm font-bold">
              {step + 1} / {steps.length}
            </div>

            <button
              onClick={nextStep}
              disabled={loading}
              className={`flex items-center gap-2 px-8 py-3 rounded-xl font-bold transition-all shadow-lg
                ${step === steps.length - 1
                  ? "bg-emerald-500 hover:bg-emerald-400 text-white shadow-emerald-500/30"
                  : "bg-white text-emerald-800 hover:bg-emerald-50 shadow-white/20"
                }
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            >
              {loading ? (
                <>
                  <RefreshCw className="w-5 h-5 animate-spin" />
                  <span>جاري الحفظ...</span>
                </>
              ) : step === steps.length - 1 ? (
                <>
                  <Check className="w-5 h-5" />
                  <span>ابدأ استخدام كاشي</span>
                </>
              ) : (
                <>
                  <span>التالي</span>
                  <ChevronLeft className="w-5 h-5" />
                </>
              )}
            </button>
          </div>
        </div>

        {/* رسالة أسفل الكارت */}
        <p className="text-center text-emerald-200/30 text-xs mt-6">
          يمكنك تعديل هذه البيانات لاحقاً من لوحة التحكم → الإعدادات
        </p>
      </div>
    </div>
  );
}

// لإصلاح خطأ missing import
function RefreshCw(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
      <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16" />
      <path d="M16 16h5v5" />
    </svg>
  );
}
