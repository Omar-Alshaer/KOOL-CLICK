import {
  auth,
  db,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  doc,
  setDoc,
  getDoc,
  runTransaction,
  serverTimestamp,
} from "../config/firebase.js";
import { APP_CONFIG } from "../config/app-config.js";
import { getLevelFromPoints } from "../utils/levels.js";

// ─── Cache ────────────────────────────────────────────────────────────────────
const PROFILE_CACHE_KEY = "kc_clicker_profile_cache";
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

function makeAuthEmail(phone) {
  return `${phone}@koolclick.app`;
}

function writeProfileCache({ uid, profile }) {
  try {
    localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({ uid, profile, ts: Date.now() })
    );
  } catch { /* ignore */ }
}

function readProfileCache(uid) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.uid !== uid || !parsed.profile) return null;
    if (Date.now() - parsed.ts > PROFILE_CACHE_TTL_MS) return null;
    return parsed;
  } catch { return null; }
}

function clearProfileCache() {
  try { localStorage.removeItem(PROFILE_CACHE_KEY); } catch { /* ignore */ }
}

// ─── Detect login input type ──────────────────────────────────────────────────
export function detectLoginInput(value) {
  if (/^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(value)) return "email";
  if (/^01\d{9}$/.test(value)) return "phone";
  return "username";
}

// ─── Points cache delta ───────────────────────────────────────────────────────
export function applyPointsDeltaToProfileCache(uid, deltaPoints) {
  if (!deltaPoints) return;
  const cached = readProfileCache(uid);
  if (!cached) return;
  const current = Number(cached.profile.points || 0);
  const updatedPoints = current + Number(deltaPoints);
  const level = getLevelFromPoints(updatedPoints);
  writeProfileCache({
    uid,
    profile: { ...cached.profile, points: updatedPoints, level: level.level },
  });
}

// ─── Register ─────────────────────────────────────────────────────────────────
export async function registerClicker({ fullName, username, phone, email, password, birthDate, avatar }) {
  const normalizedUsername = username.toLowerCase().trim();
  const authEmail = makeAuthEmail(phone);

  const usernameRef = doc(db, "clickerIndex", normalizedUsername);
  const phoneRef    = doc(db, "clickerIndex", phone);

  // Atomically check + reserve username and phone
  await runTransaction(db, async (tx) => {
    const [uSnap, pSnap] = await Promise.all([
      tx.get(usernameRef),
      tx.get(phoneRef),
    ]);
    if (uSnap.exists()) throw new Error("Username already taken. Choose another.");
    if (pSnap.exists()) throw new Error("Phone number already registered.");
    tx.set(usernameRef, { reserved: true });
    tx.set(phoneRef,    { reserved: true });
  });

  // Create Firebase Auth user
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, authEmail, password);
  } catch (err) {
    // Rollback reservations on auth failure
    await Promise.allSettled([
      setDoc(usernameRef, { _deleted: true }),
      setDoc(phoneRef,    { _deleted: true }),
    ]);
    throw err;
  }

  const signupPoints = APP_CONFIG.signupBonusPoints || 0;
  const signupLevel  = getLevelFromPoints(signupPoints);
  const profile = {
    role: "clicker",
    authUid: cred.user.uid,
    fullName,
    username: normalizedUsername,
    phone,
    email: email || "",
    birthDate,
    avatar,
    points: signupPoints,
    level: signupLevel.level,
    createdAt: serverTimestamp(),
  };

  // Write profile + finalize index entries
  await Promise.all([
    setDoc(doc(db, "clickers", cred.user.uid), profile),
    setDoc(usernameRef, { uid: cred.user.uid, authEmail }),
    setDoc(phoneRef,    { uid: cred.user.uid, authEmail }),
  ]);

  writeProfileCache({ uid: cred.user.uid, profile: { ...profile, createdAt: null } });
  return cred.user;
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function loginClicker({ identifier, password }) {
  const type = detectLoginInput(identifier);
  let authEmail;

  if (type === "email") {
    authEmail = identifier;
  } else {
    const key = type === "phone" ? identifier : identifier.toLowerCase().trim();
    const snap = await getDoc(doc(db, "clickerIndex", key));
    if (!snap.exists() || !snap.data().authEmail) {
      throw new Error(
        "No account found with this " + (type === "phone" ? "phone number" : "username") + "."
      );
    }
    authEmail = snap.data().authEmail;
  }

  const cred = await signInWithEmailAndPassword(auth, authEmail, password);

  const profileSnap = await getDoc(doc(db, "clickers", cred.user.uid));
  if (!profileSnap.exists() || profileSnap.data().role !== "clicker") {
    await signOut(auth);
    throw new Error("Only Clicker access is allowed here.");
  }

  const profile = profileSnap.data();
  writeProfileCache({ uid: cred.user.uid, profile });
  return { user: cred.user, profile };
}

// ─── Get Profile ──────────────────────────────────────────────────────────────
export async function getCurrentClickerProfile(uid, options = {}) {
  const forceFresh = options?.forceFresh === true;
  const cached = !forceFresh ? readProfileCache(uid) : null;
  if (cached) return cached.profile;

  const snap = await getDoc(doc(db, "clickers", uid));
  if (!snap.exists()) return null;

  const data = snap.data();
  if (data.role !== "clicker" || data.authUid !== uid) return null;

  writeProfileCache({ uid, profile: data });
  return data;
}

// ─── Logout ───────────────────────────────────────────────────────────────────
export async function logoutUser() {
  clearProfileCache();
  await signOut(auth);
}

// ─── Auth State ───────────────────────────────────────────────────────────────
export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
