export function resolveItemPrice(prod: any, ctx: { channelId?: string; isDeliveryApp?: boolean; channel?: any }): number {
  const base = Number(prod.price);
  if (ctx.channelId && ctx.channelId !== "in-store" && ctx.channelId !== "takeaway") {
    const ch = ctx.channel;
    if (ch?.customPrice != null) return Number(ch.customPrice);
    if (ch?.defaultMarkupPercent) return Math.round(base * (1 + ch.defaultMarkupPercent / 100) * 100) / 100;
  }
  if (ctx.isDeliveryApp && prod.deliveryPrice && Number(prod.deliveryPrice) > 0) {
    return Number(prod.deliveryPrice);
  }
  return base;
}
