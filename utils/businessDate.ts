// اليوم التشغيلي: يوم فتح الوردية — حصرياً، بلا أي fallback لـ createdAt
export function getOrderBusinessDate(o: any, db?: any): string {
  if (db && o?.shiftId && Array.isArray(db.shifts)) {
    const shift = db.shifts.find((s: any) => s.id === o.shiftId);
    if (shift?.openedAt) {
      const d = shift.openedAt.split("T")[0];
      if (d) return d;
    }
  }
  // فقط فواتير قديمة بلا وردية خالص
  return o?.createdAt ? o.createdAt.split("T")[0] : "";
}

// فلترة صارمة: لكل فاتورة يوم تشغيلي واحد فقط — لا عدّ مزدوج بعد منتصف الليل
export function filterOrdersByDateRange(orders: any[], from: string, to: string, db?: any) {
  return (orders || []).filter((o: any) => {
    const isCompleted =
      o.status === "completed" ||
      o.status === "partially_refunded" ||
      o.status === "refunded";
    if (!isCompleted) return false;
    const bDate = getOrderBusinessDate(o, db);
    return bDate >= from && bDate <= to; // ✅ خلاص — مفيش fallback لـ createdAt
  });
}
