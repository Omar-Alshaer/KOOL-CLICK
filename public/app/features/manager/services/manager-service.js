import {
  auth,
  db,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
} from "../../../config/firebase.js";

function managerEmailFromPhone(phone) {
  const normalized = String(phone).trim();
  return `${normalized}@managers.koolclick.app`;
}

export async function loginManager({ phone, password }) {
  const email = managerEmailFromPhone(phone);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const indexSnap = await getDoc(doc(db, "userAuthIndex", cred.user.uid));

  if (!indexSnap.exists() || indexSnap.data().role !== "manager") {
    await signOut(auth);
    throw new Error("Manager account is not configured for this user.");
  }

  const managerDoc = await getDoc(doc(db, "managers", cred.user.uid));
  if (!managerDoc.exists()) {
    await signOut(auth);
    throw new Error("Manager profile not found.");
  }

  const profile = { uid: cred.user.uid, ...managerDoc.data() };
  if (!profile.restaurantId) {
    await signOut(auth);
    throw new Error("Manager profile is missing restaurant assignment.");
  }

  return { user: cred.user, profile };
}

export async function getCurrentManagerProfile(uid) {
  const indexSnap = await getDoc(doc(db, "userAuthIndex", uid));
  if (!indexSnap.exists() || indexSnap.data().role !== "manager") return null;

  const managerDoc = await getDoc(doc(db, "managers", uid));
  if (!managerDoc.exists()) return null;

  const profile = { uid, ...managerDoc.data() };
  if (!profile.restaurantId) return null;
  return profile;
}

export function watchManagerAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function logoutManager() {
  await signOut(auth);
}

export async function getManagerOrders(restaurantId, limitCount = 120) {
  const q = query(
    collection(db, "orders"),
    where("restaurantId", "==", restaurantId),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRestaurantProducts(restaurantId, limitCount = 200) {
  try {
    const q = query(
      collection(db, "products"),
      where("restaurantId", "==", restaurantId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code !== "failed-precondition") {
      throw error;
    }
    const fallbackQuery = query(
      collection(db, "products"),
      where("restaurantId", "==", restaurantId),
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, limitCount);
  }
}

export async function addProduct({
  restaurantId,
  restaurantName,
  name,
  price,
  category,
  description,
  oldPrice,
  discountPercent,
  badge,
  isBestSeller,
  imageUrl,
}) {
  const productRef = doc(collection(db, "products"));
  await setDoc(productRef, {
    restaurantId,
    restaurantName: restaurantName || "",
    name,
    description: description || "",
    price: Number(price),
    oldPrice: Number(oldPrice || 0),
    discountPercent: Number(discountPercent || 0),
    badge: badge || "",
    isBestSeller: Boolean(isBestSeller),
    category: category || "General",
    imageUrl: imageUrl || "",
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return productRef.id;
}

export async function updateProduct(productId, patch) {
  const ref = doc(db, "products", productId);
  const nextPatch = { ...patch };
  if (Object.prototype.hasOwnProperty.call(nextPatch, "isActive")) {
    if (nextPatch.isActive === "false" || nextPatch.isActive === false) {
      nextPatch.isActive = false;
    } else if (nextPatch.isActive === "true" || nextPatch.isActive === true) {
      nextPatch.isActive = true;
    }
  }
  await updateDoc(ref, { ...nextPatch, updatedAt: serverTimestamp() });
}

export async function deleteProduct(productId) {
  await deleteDoc(doc(db, "products", productId));
}

export async function getOffers(restaurantId, limitCount = 120) {
  try {
    const q = query(
      collection(db, "offers"),
      where("restaurantId", "==", restaurantId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code !== "failed-precondition") throw error;
    const fallbackQuery = query(
      collection(db, "offers"),
      where("restaurantId", "==", restaurantId),
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, limitCount);
  }
}

export async function addOffer({
  restaurantId,
  restaurantName,
  title,
  description,
  discountType,
  discountValue,
  targetType,
  targetValue,
  targetLabel,
  imageUrl,
}) {
  const ref = doc(collection(db, "offers"));
  await setDoc(ref, {
    restaurantId,
    restaurantName: restaurantName || "",
    title,
    description,
    discountType,
    discountValue: Number(discountValue || 0),
    targetType: targetType || "",
    targetValue: targetValue || "",
    targetLabel: targetLabel || "",
    imageUrl: imageUrl || "",
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updateOffer(offerId, patch) {
  await updateDoc(doc(db, "offers", offerId), { ...patch, updatedAt: serverTimestamp() });
}

export async function deleteOffer(offerId) {
  await deleteDoc(doc(db, "offers", offerId));
}

export async function getPromoCodes(restaurantId, limitCount = 120) {
  try {
    const q = query(
      collection(db, "promoCodes"),
      where("restaurantId", "==", restaurantId),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code !== "failed-precondition") throw error;
    const fallbackQuery = query(
      collection(db, "promoCodes"),
      where("restaurantId", "==", restaurantId),
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, limitCount);
  }
}

export async function addPromoCode({
  restaurantId,
  code,
  type,
  value,
  minSubtotal,
}) {
  const ref = doc(collection(db, "promoCodes"));
  await setDoc(ref, {
    restaurantId,
    code: String(code || "").toUpperCase(),
    type,
    value: Number(value || 0),
    minSubtotal: Number(minSubtotal || 0),
    isActive: true,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

export async function updatePromoCode(promoId, patch) {
  await updateDoc(doc(db, "promoCodes", promoId), { ...patch, updatedAt: serverTimestamp() });
}

export async function deletePromoCode(promoId) {
  await deleteDoc(doc(db, "promoCodes", promoId));
}
