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
  getDocs,
  runTransaction,
  serverTimestamp,
} from "../config/firebase.js";
import { APP_CONFIG } from "../config/app-config.js";
import { getLevelFromPoints } from "../utils/levels.js";

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
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code !== "failed-precondition") throw error;

    const fallbackQuery = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      limit(120)
    );

    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 80);
  }
}

export async function getCashierCollectedOrders(restaurantId) {
  try {
    const indexedQuery = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      where("status", "==", "Collected"),
      orderBy("collectedAt", "desc"),
      limit(120)
    );

    const snapshot = await getDocs(indexedQuery);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code !== "failed-precondition") throw error;

    const fallbackQuery = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      where("status", "==", "Collected"),
      limit(150)
    );

    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.collectedAt?.seconds || b.updatedAt?.seconds || 0) - (a.collectedAt?.seconds || a.updatedAt?.seconds || 0))
      .slice(0, 120);
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

    transaction.update(orderRef, {
      status,
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
  return runTransaction(db, async (transaction) => {
    const orderRef = doc(db, "orders", orderId);
    const orderSnap = await transaction.get(orderRef);

    if (!orderSnap.exists()) throw new Error("Order not found.");
    const order = orderSnap.data();
    if (cashierRestaurantId && order.restaurantId !== cashierRestaurantId) {
      throw new Error("This order does not belong to your restaurant.");
    }

    if (order.status === "Collected") {
      throw new Error("Order already collected.");
    }

    const isCod = order.paymentMethod === APP_CONFIG.paymentMethods.cod;
    const shouldGrantPointsNow = order.pointsGranted !== true;
    let clickerSnap = null;
    let clickerRef = null;

    if (shouldGrantPointsNow) {
      const clickerUid = order.clickerUid;
      if (!clickerUid) throw new Error("Clicker profile not linked to this order.");

      clickerRef = doc(db, "clickers", clickerUid);
      clickerSnap = await transaction.get(clickerRef);

      if (!clickerSnap.exists()) {
        throw new Error("Clicker profile not found, points could not be added.");
      }
    }

    transaction.update(orderRef, {
      status: "Collected",
      paymentStatus: isCod ? "PaidOnPickup" : (order.paymentStatus || "Confirmed"),
      pointsGranted: true,
      collectedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    if (shouldGrantPointsNow && clickerRef && clickerSnap?.exists()) {
      const currentPoints = clickerSnap.data().points || 0;
      const newPoints = currentPoints + (order.pointsEarned || 0);
      const level = getLevelFromPoints(newPoints);

      transaction.update(clickerRef, {
        points: newPoints,
        level: level.level,
        updatedAt: serverTimestamp(),
      });
    }

    return {
      pointsAdded: shouldGrantPointsNow ? (order.pointsEarned || 0) : 0,
      paymentStatus: isCod ? "PaidOnPickup" : (order.paymentStatus || "Confirmed"),
    };
  });
}
