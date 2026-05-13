import { db, collection, query, where, limit, getDocs } from "../../config/firebase.js";

export async function getPromoByCode(code, restaurantId = "") {
  const normalized = String(code || "")
    .trim()
    .toUpperCase();
  if (!normalized) return null;

  const constraints = [where("code", "==", normalized)];
  if (restaurantId) constraints.push(where("restaurantId", "==", restaurantId));

  const q = query(collection(db, "promoCodes"), ...constraints, limit(1));
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  const doc = snapshot.docs[0];
  return { id: doc.id, ...doc.data() };
}
