import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  runTransaction,
  serverTimestamp,
  functions,
  httpsCallable,
} from "../../../config/firebase.js";
import { APP_CONFIG } from "../../../config/app-config.js";
import { logError, logInfo } from "../../../core/utils/logger.js";

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

function cashierEmailFromPhone(phone) {
  const normalized = String(phone).trim();
  return `${normalized}@cashiers.koolclick.app`;
}

export async function loginCashier({ phone, password }) {
  const email = cashierEmailFromPhone(phone);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const indexSnap = await getDoc(doc(db, "userAuthIndex", cred.user.uid));

  if (!indexSnap.exists() || indexSnap.data().role !== "cashier") {
    await signOut(auth);
    throw new Error("Cashier account is not configured for this user.");
  }

  const cashierDoc = await getDoc(doc(db, "cashiers", cred.user.uid));
  if (!cashierDoc.exists()) {
    await signOut(auth);
    throw new Error("Cashier profile not found.");
  }

  const profile = { uid: cred.user.uid, ...cashierDoc.data() };
  if (!profile.restaurantId) {
    await signOut(auth);
    throw new Error("Cashier profile is missing restaurant assignment.");
  }

  return { user: cred.user, profile };
}

export async function getCurrentCashierProfile(uid) {
  const indexSnap = await getDoc(doc(db, "userAuthIndex", uid));
  if (!indexSnap.exists() || indexSnap.data().role !== "cashier") return null;

  const cashierDoc = await getDoc(doc(db, "cashiers", uid));
  if (!cashierDoc.exists()) return null;

  const profile = { uid, ...cashierDoc.data() };
  if (!profile.restaurantId) return null;

  return profile;
}

export function watchCashierAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function logoutCashier() {
  await signOut(auth);
}

export async function getCashierOrders(restaurantId) {
  try {
    const indexedQuery = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      orderBy("createdAt", "desc"),
      limit(80)
    );

    const snapshot = await getDocs(indexedQuery);
    return snapshot.docs.map((d) => normalizeOrderTimestamps({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code !== "failed-precondition") throw error;

    const fallbackQuery = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      limit(120)
    );

    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => normalizeOrderTimestamps({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 80);
  }
}

export async function getCashierCollectedOrders(restaurantId) {
  const page = await getCashierCollectedOrdersPage({ restaurantId, pageSize: 120 });
  return page.orders;
}

export async function getCashierCollectedOrdersPage({ restaurantId, pageSize = 60, cursor = null }) {
  try {
    const constraints = [
      where("restaurantId", "==", restaurantId),
      where("status", "==", "Collected"),
      orderBy("collectedAt", "desc"),
    ];
    if (cursor) constraints.push(startAfter(cursor));
    constraints.push(limit(pageSize));

    const indexedQuery = query(
      collection(db, "orders"),
      ...constraints
    );

    const snapshot = await getDocs(indexedQuery);
    return {
      orders: snapshot.docs.map((d) => normalizeOrderTimestamps({ id: d.id, ...d.data() })),
      nextCursor: snapshot.docs[snapshot.docs.length - 1] || null,
      hasMore: snapshot.docs.length === pageSize,
    };
  } catch (error) {
    if (error?.code !== "failed-precondition") throw error;

    const fallbackQuery = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      where("status", "==", "Collected"),
      limit(pageSize + 30)
    );

    const snapshot = await getDocs(fallbackQuery);
    const docs = snapshot.docs
      .map((d) => normalizeOrderTimestamps({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.collectedAt?.seconds || b.updatedAt?.seconds || 0) - (a.collectedAt?.seconds || a.updatedAt?.seconds || 0))
      .slice(0, pageSize);
    return {
      orders: docs,
      nextCursor: null,
      hasMore: false,
    };
  }
}

export async function updateOrderProgress({ orderId, status, remainingTimeMinutes, cashierRestaurantId }) {
  if (!APP_CONFIG.orderStatuses.includes(status)) {
    throw new Error("Invalid order status.");
  }

  if (status === "Collected") {
    throw new Error("Use Mark Collected button to finalize payment and points.");
  }

  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists()) throw new Error("Order not found.");
    const order = orderSnap.data();
    if (cashierRestaurantId && order.restaurantId !== cashierRestaurantId) {
      throw new Error("This order does not belong to your restaurant.");
    }

    if (order.status === "Collected") {
      throw new Error("Collected orders cannot be edited.");
    }

    const newStatusHistory = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
    if (order.status !== status) {
      newStatusHistory.push({ status, at: serverTimestamp() });
    }

    transaction.update(orderRef, {
      status,
      statusHistory: newStatusHistory,
      remainingTimeMinutes: Number(remainingTimeMinutes),
      updatedAt: serverTimestamp(),
    });
  });
}

export async function confirmOrderPayment({ orderId, cashierRestaurantId }) {
  await runTransaction(db, async (transaction) => {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists()) throw new Error("Order not found.");
    const order = orderSnap.data();
    if (cashierRestaurantId && order.restaurantId !== cashierRestaurantId) {
      throw new Error("This order does not belong to your restaurant.");
    }

    transaction.update(orderRef, {
      paymentStatus: "Confirmed",
      updatedAt: serverTimestamp(),
    });
  });
}

export async function collectOrderByCashier({ orderId, cashierRestaurantId }) {
  const callable = httpsCallable(functions, "collectOrderByCashier");
  try {
    const response = await callable({ orderId, cashierRestaurantId });
    logInfo("cashier.collect.success", {
      orderId: String(orderId || "").slice(0, 8),
      restaurantId: cashierRestaurantId || "",
    });
    return response.data;
  } catch (error) {
    logError("cashier.collect.failed", error, {
      orderId: String(orderId || "").slice(0, 8),
      restaurantId: cashierRestaurantId || "",
    });
    throw error;
  }
}
