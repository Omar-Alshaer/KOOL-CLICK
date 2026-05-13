import {
  db,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  doc,
  getDoc,
} from "../../config/firebase.js";

export async function getActiveOffers(limitCount = 12) {
  try {
    const q = query(
      collection(db, "offers"),
      where("isActive", "==", true),
      orderBy("createdAt", "desc"),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
  } catch (error) {
    if (error?.code !== "failed-precondition") throw error;
    const fallbackQuery = query(
      collection(db, "offers"),
      where("isActive", "==", true),
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, limitCount);
  }
}

export async function getOfferById(offerId) {
  if (!offerId) return null;
  const snap = await getDoc(doc(db, "offers", offerId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}
