import { APP_CONFIG } from "../config/app-config.js";

function normalizeCode(code) {
  return (code || "").trim().toUpperCase();
}

export function findPromoByCode(code) {
  const normalized = normalizeCode(code);
  if (!normalized) return null;
  return APP_CONFIG.promoCodes.find((p) => p.code === normalized) || null;
}

export function calculatePromoDiscount(subtotal, promo) {
  if (!promo || subtotal <= 0) return 0;
  if (subtotal < (promo.minSubtotal || 0)) return 0;

  if (promo.type === "percent") {
    return Math.floor((subtotal * promo.value) / 100);
  }

  if (promo.type === "flat") {
    return Math.min(promo.value, subtotal);
  }

  return 0;
}

export function validatePromo(subtotal, code) {
  const promo = findPromoByCode(code);
  if (!promo) {
    return { valid: false, reason: "Promo code is invalid.", promo: null, discount: 0 };
  }

  if (subtotal < (promo.minSubtotal || 0)) {
    return {
      valid: false,
      reason: `Minimum subtotal for ${promo.code} is ${promo.minSubtotal} EGP.`,
      promo,
      discount: 0,
    };
  }

  const discount = calculatePromoDiscount(subtotal, promo);
  return { valid: true, reason: "Promo applied.", promo, discount };
}
