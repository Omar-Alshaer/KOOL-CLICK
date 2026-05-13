import {
  db,
  collection,
  doc,
  functions,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  httpsCallable,
} from "../config/firebase.js";
import { APP_CONFIG } from "../config/app-config.js";
import { logError, logInfo } from "../utils/logger.js";

function normalizeOrderTimestamps(order) {
  const createdAt = order.createdAt || order.updatedAt || null;
  const updatedAt = order.updatedAt || order.createdAt || null;
  const collectedAt = order.collectedAt || null;

  return {
    ...order,
    createdAt,
    updatedAt,
    collectedAt,
  };
}

export async function placeClickerOrders({
  cartItems,
  paymentMethod = APP_CONFIG.paymentMethods.cod,
  receiptImageUrl = "",
  promoData = null,
}) {
  const callable = httpsCallable(functions, "createClickerOrders");
  const clientRequestId =
    globalThis.crypto?.randomUUID?.() ||
    `${Date.now()}_${Math.random().toString(36).slice(2)}`;

  const payload = {
    clientRequestId,
    paymentMethod,
    receiptImageUrl,
    promoCode: promoData?.code || "",
    items: cartItems.map((item) => ({
      productId: item.menuId,
      qty: item.qty,
      offerId: item.offerId || "",
    })),
  };

  try {
    const response = await callable(payload);
    logInfo("orders.create.success", {
      requestId: clientRequestId,
      itemCount: payload.items.length,
      orderCount: response.data?.createdOrderIds?.length || 0,
    });
    return response.data;
  } catch (error) {
    logError("orders.create.failed", error, {
      requestId: clientRequestId,
      itemCount: payload.items.length,
    });
    throw error;
  }
}

export async function getClickerOrders(uid) {
  try {
    const indexedQuery = query(
      collection(db, "orders"),
      where("clickerUid", "==", uid),
      orderBy("createdAt", "desc"),
      limit(30)
    );

    const snapshot = await getDocs(indexedQuery);
    return snapshot.docs.map((d) => normalizeOrderTimestamps({ id: d.id, ...d.data() }));
  } catch (error) {
    // Fallback when composite index is not created yet.
    if (error?.code !== "failed-precondition") {
      throw error;
    }

    const fallbackQuery = query(
      collection(db, "orders"),
      where("clickerUid", "==", uid),
      limit(60)
    );

    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => normalizeOrderTimestamps({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aSec = a.createdAt?.seconds || 0;
        const bSec = b.createdAt?.seconds || 0;
        return bSec - aSec;
      })
      .slice(0, 30);
  }
}

export function canClickerCancelOrder(order) {
  return order.status !== "Collected" && order.status !== "Cancelled";
}

export async function cancelClickerOrder({ orderId }) {
  const callable = httpsCallable(functions, "cancelClickerOrder");
  try {
    const response = await callable({ orderId });
    logInfo("orders.cancel.success", { orderId: String(orderId || "").slice(0, 8) });
    return response.data;
  } catch (error) {
    logError("orders.cancel.failed", error, { orderId: String(orderId || "").slice(0, 8) });
    throw error;
  }
}
