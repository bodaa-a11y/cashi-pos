import React, { useState } from "react";
import { Plus, Edit2, Trash2, X, ShieldAlert, UserCheck } from "lucide-react";
import { User, UserRole } from "../../types";

interface StaffTabProps {
  users: User[];
  fetchUsers: () => Promise<void>;
}

export default function StaffTab({ users, fetchUsers }: StaffTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  
  // Form states
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [role, setRole] = useState<UserRole>("cashier");
  const [pinCode, setPinCode] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleOpenAdd = () => {
    setEditingUser(null);
    setFullName("");
    setUsername("");
    setRole("cashier");
    setPinCode("");
    setPassword("");
    setShowModal(true);
  };

  const handleOpenEdit = (user: User) => {
    setEditingUser(user);
    setFullName(user.fullName);
    setUsername(user.username || "");
    setRole(user.role);
    setPinCode(""); // Keep empty if not changing
    setPassword(""); // Keep empty if not changing
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName || !role) {
      alert("الرجاء إدخال اسم الموظف ودوره الوظيفي");
      return;
    }

    if (!editingUser && !pinCode) {
      alert("الرجاء إدخال رمز PIN للموظف الجديد");
      return;
    }

    setLoading(true);
    try {
      const url = editingUser ? `/api/users/${editingUser.id}` : "/api/users";
      const method = editingUser ? "PUT" : "POST";
      const body: any = {
        fullName,
        username,
        role,
      };
      if (pinCode) body.pinCode = pinCode;
      if (password) body.password = password;

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (res.ok) {
        alert(editingUser ? "تم تعديل الموظف بنجاح" : "تم إضافة الموظف بنجاح");
        setShowModal(false);
        fetchUsers();
      } else {
        alert(data.error || "فشلت العملية");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الاتصال بالسيرفر");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`هل أنت متأكد من تعطيل/حذف الموظف "${name}"؟`)) return;

    try {
      const res = await fetch(`/api/users/${id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (res.ok) {
        alert("تم حذف/تعطيل الموظف بنجاح");
        fetchUsers();
      } else {
        alert(data.error || "فشل حذف الموظف");
      }
    } catch (err) {
      console.error(err);
      alert("حدث خطأ أثناء الحذف");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center flex-row-reverse border-b border-stone-100 pb-3">
        <button
          onClick={handleOpenAdd}
          className="px-4 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow flex items-center gap-1.5 transition-all"
        >
          <Plus className="w-4 h-4" />
          <span>إضافة موظف جديد</span>
        </button>
        <h3 className="font-bold text-stone-800 text-right">إدارة الندل وصلاحيات موظفي الوردية</h3>
      </div>

      <div className="bg-white border border-stone-200 rounded-2xl overflow-hidden shadow-sm">
        <table className="w-full text-right text-xs">
          <thead className="bg-stone-50 border-b border-stone-100 text-stone-500 font-bold">
            <tr>
              <th className="p-4">الاسم الكامل</th>
              <th className="p-4">اسم المستخدم للوحات التحكم</th>
              <th className="p-4">الدور الوظيفي</th>
              <th className="p-4 text-center">كود الدخول السريع PIN</th>
              <th className="p-4 text-center">الحالة</th>
              <th className="p-4 text-center">إجراءات</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-stone-100 font-medium">
            {users.map((u) => (
              <tr key={u.id} className={`hover:bg-stone-50/50 ${!u.isActive ? "opacity-50 bg-stone-50/30" : ""}`}>
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
                    {u.role === "admin"
                      ? "مدير عام (أدمن)"
                      : u.role === "manager"
                      ? "مدير صالة"
                      : u.role === "cashier"
                      ? "كاشير الصندوق"
                      : "نادل الطاولات"}
                  </span>
                </td>
                <td className="p-4 text-center font-mono font-bold text-stone-700">
                  {u.isActive ? (u.pinCode && u.pinCode.length <= 6 ? u.pinCode : "مُشفر آمن 🔒") : "—"}
                </td>
                <td className="p-4 text-center">
                  {u.isActive ? (
                    <span className="bg-green-50 text-green-700 px-2 py-0.5 rounded text-[10px] font-bold">نشط</span>
                  ) : (
                    <span className="bg-stone-100 text-stone-500 px-2 py-0.5 rounded text-[10px] font-bold">معطل</span>
                  )}
                </td>
                <td className="p-4 text-center">
                  <div className="flex items-center justify-center gap-2">
                    <button
                      onClick={() => handleOpenEdit(u)}
                      className="p-1.5 text-stone-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                      title="تعديل الموظف"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    {u.isActive && (
                      <button
                        onClick={() => handleDelete(u.id, u.fullName)}
                        className="p-1.5 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="تعطيل الموظف"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-stone-400">
                  لا يوجد موظفين مسجلين حالياً.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md overflow-hidden shadow-xl text-right animate-in fade-in zoom-in-95 duration-200">
            <div className="bg-[#2E7D32] text-white p-4 flex justify-between items-center flex-row-reverse">
              <h3 className="font-bold text-sm flex items-center gap-1.5">
                <UserCheck className="w-5 h-5" />
                <span>{editingUser ? "تعديل بيانات الموظف" : "إضافة موظف جديد للنظام"}</span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-white/80 hover:text-white transition-all"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">الاسم الكامل *</label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">الدور الوظيفي *</label>
                  <select
                    value={role}
                    onChange={(e) => setRole(e.target.value as UserRole)}
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none font-bold"
                  >
                    <option value="waiter">نادل (Waiter)</option>
                    <option value="cashier">كاشير (Cashier)</option>
                    <option value="manager">مدير صالة (Manager)</option>
                    <option value="admin">مدير عام (Admin)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-stone-700 mb-1">اسم المستخدم (اختياري)</label>
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="مثال: m_ahmed"
                    dir="ltr"
                    className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-right focus:outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  رمز الدخول PIN {editingUser ? "(اتركه فارغاً للاحتفاظ بالقديم)" : "*"}
                </label>
                <input
                  type="password"
                  required={!editingUser}
                  value={pinCode}
                  onChange={(e) => setPinCode(e.target.value.replace(/\D/g, "").substring(0, 6))}
                  placeholder={editingUser ? "••••" : "رمز PIN سريع (4-6 أرقام)"}
                  dir="ltr"
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-center focus:outline-none font-mono font-bold tracking-widest"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-stone-700 mb-1">
                  كلمة المرور للوحة البعيدة {editingUser ? "(اتركه فارغاً للاحتفاظ بالقديم)" : "(اختياري)"}
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="كلمة مرور الدخول عبر الويب..."
                  dir="ltr"
                  className="w-full border border-stone-200 rounded-xl bg-stone-50 p-2.5 text-xs text-center focus:outline-none font-mono"
                />
              </div>

              <div className="pt-2 flex justify-between gap-3">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="flex-1 py-2.5 border border-stone-200 rounded-xl hover:bg-stone-50 text-stone-700 text-xs font-bold transition-all"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 py-2.5 bg-[#2E7D32] hover:bg-[#1B5E20] text-white rounded-xl text-xs font-bold shadow disabled:opacity-50 transition-all"
                >
                  {loading ? "جاري الحفظ..." : "حفظ الموظف"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
