import { useEffect, useState } from "react";
import { SalesChannel } from "../types";

export function useChannels() {
  const [channels, setChannels] = useState<SalesChannel[]>([
    { id: "in-store", name: "بيع من المحل (صالة)", defaultMarkupPercent: 0, isActive: true },
    { id: "takeaway", name: "سفري / محلي استلام", defaultMarkupPercent: 0, isActive: true },
    { id: "hungerstation", name: "هنقرستيشن 🛵", defaultMarkupPercent: 15, isActive: true },
    { id: "jahez", name: "جاهز 🛵", defaultMarkupPercent: 15, isActive: true },
    { id: "toyou", name: "تويو 🛵", defaultMarkupPercent: 15, isActive: true },
    { id: "ninja", name: "نينجا 🛵", defaultMarkupPercent: 15, isActive: true },
    { id: "keeta", name: "كيتا 🛵", defaultMarkupPercent: 15, isActive: true }
  ]);
  const [loading, setLoading] = useState(true);

  const fetchChannels = () => {
    let cancelled = false;
    fetch("/api/channels")
      .then((r) => r.json())
      .then((data: SalesChannel[]) => {
        if (cancelled || !Array.isArray(data)) return;
        setChannels([
          { id: "in-store", name: "بيع من المحل (صالة)", defaultMarkupPercent: 0, isActive: true },
          ...data.filter((c) => c.id !== "in-store"),
        ]);
      })
      .catch((err) => console.warn("تعذر جلب قنوات البيع من الخادم، تم استخدام القنوات الافتراضية:", err))
      .finally(() => !cancelled && setLoading(false));

    return () => {
      cancelled = true;
    };
  };

  useEffect(() => {
    return fetchChannels();
  }, []);

  return { channels, loading, refreshChannels: fetchChannels };
}
