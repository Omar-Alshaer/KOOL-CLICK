import {
  db,
  collection,
  doc,
  getDoc,
  writeBatch,
  runTransaction,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  serverTimestamp,
} from "../config/firebase.js";
import { APP_CONFIG } from "../config/app-config.js";
import { getLevelFromPoints, pointsFromAmount } from "../utils/levels.js";
import { calculatePromoDiscount } from "../utils/promo.js";

function splitCartByRestaurant(cartItems) {
  const buckets = new Map();

  for (const item of cartItems) {
    const key = item.restaurantId;
    const group = buckets.get(key) || [];
    group.push(item);
    buckets.set(key, group);
  }

  return [...buckets.entries()].map(([restaurantId, items]) => ({ restaurantId, items }));
}

function calcSubtotal(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function splitDiscountByGroup(groups, totalDiscount) {
  if (totalDiscount <= 0 || !groups.length) {
    return groups.map(() => 0);
  }

  const totalSubtotal = groups.reduce((sum, group) => sum + calcSubtotal(group.items), 0);
  if (totalSubtotal <= 0) return groups.map(() => 0);

  const splits = [];
  let allocated = 0;

  groups.forEach((group, idx) => {
    if (idx === groups.length - 1) {
      splits.push(totalDiscount - allocated);
      return;
    }

    const ratio = calcSubtotal(group.items) / totalSubtotal;
    const part = Math.floor(totalDiscount * ratio);
    splits.push(part);
    allocated += part;
  });

  return splits;
}

export async function placeClickerOrders({
  uid,
  fullName,
  phone,
  cartItems,
  paymentMethod = APP_CONFIG.paymentMethods.cod,
  receiptImageUrl = "",
  promoCode = "",
}) {
  const groups = splitCartByRestaurant(cartItems);
  const createdOrderIds = [];
  let totalPointsToGrantNow = 0;
  const batch = writeBatch(db);
  const totalSubtotal = calcSubtotal(cartItems);
  const promo = promoCode
    ? APP_CONFIG.promoCodes.find((p) => p.code === promoCode.toUpperCase())
    : null;
  const totalDiscount = calculatePromoDiscount(totalSubtotal, promo);
  const splitDiscounts = splitDiscountByGroup(groups, totalDiscount);
  const instantPoints = paymentMethod === APP_CONFIG.paymentMethods.instaPay;

  groups.forEach((group, idx) => {
    const subtotal = calcSubtotal(group.items);
    const discountAmount = splitDiscounts[idx] || 0;
    const finalTotal = Math.max(0, subtotal - discountAmount);
    const pointsEarned = pointsFromAmount(finalTotal);
    const orderRef = doc(collection(db, "orders"));

    batch.set(orderRef, {
      clickerUid: uid,
      clickerName: fullName,
      clickerPhone: phone,
      restaurantId: group.restaurantId,
      items: group.items,
      subtotal,
      promoCode: promo?.code || "",
      discountAmount,
      finalTotal,
      pointsEarned,
      pointsGranted: instantPoints,
      status: APP_CONFIG.orderStatuses[0],
      remainingTimeMinutes: 20,
      paymentMethod,
      paymentStatus:
        paymentMethod === APP_CONFIG.paymentMethods.instaPay ? "ReceiptUploaded" : "PayOnPickup",
      receiptImageUrl,
      qrPayload: orderRef.id,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (instantPoints) {
      totalPointsToGrantNow += pointsEarned;
    }
    createdOrderIds.push(orderRef.id);
  });

  if (totalPointsToGrantNow > 0) {
    const clickerRef = doc(db, "clickers", uid);
    const clickerSnap = await getDoc(clickerRef);
    if (clickerSnap.exists()) {
      const currentPoints = clickerSnap.data().points || 0;
      const newPoints = currentPoints + totalPointsToGrantNow;
      const level = getLevelFromPoints(newPoints);

      batch.update(clickerRef, {
        points: newPoints,
        level: level.level,
        updatedAt: serverTimestamp(),
      });
    }
  }

  await batch.commit();
  return {
    createdOrderIds,
    totalSubtotal,
    totalDiscount,
    finalPayable: Math.max(0, totalSubtotal - totalDiscount),
    pointsGrantedNow: totalPointsToGrantNow,
    pointsPendingOnCollection: instantPoints ? 0 : groups.reduce((sum, group, idx) => {
      const subtotal = calcSubtotal(group.items);
      const discountAmount = splitDiscounts[idx] || 0;
      return sum + pointsFromAmount(Math.max(0, subtotal - discountAmount));
    }, 0),
  };
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
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
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
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => {
        const aSec = a.createdAt?.seconds || 0;
        const bSec = b.createdAt?.seconds || 0;
        return bSec - aSec;
      })
      .slice(0, 30);
  }
}

export function canClickerCancelOrder(order) {
  return order.status !== "Collected";
}

export async function cancelClickerOrder({ orderId, uid }) {
  const penalty = APP_CONFIG.points.cancellationPenaltyPoints || 0;
  let totalPenaltyApplied = penalty;

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, "orders", orderId);
    const clickerRef = doc(db, "clickers", uid);

    const [orderSnap, clickerSnap] = await Promise.all([
      transaction.get(orderRef),
      transaction.get(clickerRef),
    ]);

    if (!orderSnap.exists()) {
      throw new Error("Order not found.");
    }

    const order = orderSnap.data();
    if (!canClickerCancelOrder(order)) {
      throw new Error("This order can no longer be cancelled.");
    }

    if (!clickerSnap.exists()) {
      throw new Error("Clicker profile not found.");
    }

    const currentPoints = clickerSnap.data().points || 0;
    const revokeGrantedPoints = order.pointsGranted ? order.pointsEarned || 0 : 0;
    const totalPenalty = penalty + revokeGrantedPoints;
    totalPenaltyApplied = totalPenalty;
    const newPoints = currentPoints - totalPenalty;
    const level = getLevelFromPoints(newPoints);

    transaction.delete(orderRef);

    transaction.update(clickerRef, {
      points: newPoints,
      level: level.level,
      updatedAt: serverTimestamp(),
    });
  });

  return {
    penalty,
    totalDeducted: totalPenaltyApplied,
  };
}
