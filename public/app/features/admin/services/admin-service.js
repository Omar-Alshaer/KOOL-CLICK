import {
  auth,
  db,
  functions,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  getDoc,
  httpsCallable,
} from "../../../config/firebase.js";

function requireCallableResult(result) {
  return result?.data || {};
}

export async function loginSuperAdmin({ email, password }) {
  const authEmail = String(email || "")
    .trim()
    .toLowerCase();
  const cred = await signInWithEmailAndPassword(auth, authEmail, password);
  const profile = await getCurrentSuperAdminProfile(cred.user.uid);

  if (!profile) {
    await signOut(auth);
    throw new Error("Super admin access is not configured for this account.");
  }

  return { user: cred.user, profile };
}

export async function getCurrentSuperAdminProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) return null;

  const data = snap.data() || {};
  if (data.role !== "superAdmin" || data.disabled === true) return null;
  return { uid, ...data };
}

export function watchSuperAdminAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}

export async function logoutSuperAdmin() {
  await signOut(auth);
}

export async function adminListUsers(limit = 100) {
  const callable = httpsCallable(functions, "adminListUsers");
  return requireCallableResult(await callable({ limit })).users || [];
}

export async function adminGetAuditLogs(limit = 100) {
  const callable = httpsCallable(functions, "adminGetAuditLogs");
  return requireCallableResult(await callable({ limit })).logs || [];
}

export async function adminCreateUser(payload) {
  const callable = httpsCallable(functions, "adminCreateUser");
  return requireCallableResult(await callable(payload));
}

export async function adminUpdateUserRole(payload) {
  const callable = httpsCallable(functions, "adminUpdateUserRole");
  return requireCallableResult(await callable(payload));
}

export async function adminDeleteUser(targetUid) {
  const callable = httpsCallable(functions, "adminDeleteUser");
  return requireCallableResult(await callable({ targetUid }));
}
