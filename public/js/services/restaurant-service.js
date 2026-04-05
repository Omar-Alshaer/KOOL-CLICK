import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
} from "../config/firebase.js";

const RESTAURANT_COLLECTION = "kc_restaurants";

export function getRestaurantCollectionName() {
  return RESTAURANT_COLLECTION;
}

export async function getRestaurants(limitCount = 200) {
  const q = query(
    collection(db, RESTAURANT_COLLECTION),
    orderBy("createdAt", "desc"),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function getRestaurantById(id) {
  if (!id) return null;
  const snap = await getDoc(doc(db, RESTAURANT_COLLECTION, id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() };
}

export async function getRestaurantProducts(restaurantId, limitCount = 300, onlyActive = true) {
  const baseConstraints = [where("restaurantId", "==", restaurantId)];
  const withActive = onlyActive ? [where("isActive", "==", true)] : [];

  try {
    const q = query(
      collection(db, "products"),
      ...withActive,
      ...baseConstraints,
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
      ...withActive,
      ...baseConstraints,
      limit(limitCount * 2)
    );
    const snapshot = await getDocs(fallbackQuery);
    return snapshot.docs
      .map((d) => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, limitCount);
  }
}
