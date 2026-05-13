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
  deleteDoc,
  serverTimestamp,
} from "../../../config/firebase.js";
import { APP_CONFIG } from "../../../config/app-config.js";
import { getLevelFromPoints } from "../../../core/utils/levels.js";

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

export function updateProfileCache(uid, patch) {
  const cached = readProfileCache(uid);
  if (!cached) return;
  writeProfileCache({
    uid,
    profile: { ...cached.profile, ...patch },
  });
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
function generateUsernameBase(fullName) {
  const base = String(fullName || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 12);
  return base || "clicker";
}

function getBirthStampMMDD(birthDate) {
  if (!birthDate) return "";
  const cleaned = String(birthDate).replace(/[^0-9]/g, "");
  if (cleaned.length >= 8) {
    return cleaned.slice(4, 8);
  }
  if (cleaned.length >= 4) {
    return cleaned.slice(0, 4);
  }
  return "";
}

function buildUsernameCandidate(fullName, birthDate, suffixNumber = null) {
  const firstName = String(fullName || "").trim().split(/\s+/)[0] || fullName;
  const base = generateUsernameBase(firstName);
  const birthStamp = getBirthStampMMDD(birthDate);
  const core = birthStamp
    ? `${base}@${birthStamp}`
    : `${base}@${Math.floor(1000 + Math.random() * 9000)}`;
  if (suffixNumber === null || suffixNumber === undefined) return core;
  return `${core}${suffixNumber}`;
}

export async function registerClicker({ fullName, username, phone, email, password, birthDate, avatar }) {
  const authEmail = String(email || "").toLowerCase().trim();
  let normalizedUsername = String(username || "").toLowerCase().trim();
  if (!normalizedUsername) {
    normalizedUsername = buildUsernameCandidate(fullName, birthDate);
  }

  let usernameRef = doc(db, "clickerIndex", normalizedUsername);
  const phoneRef = doc(db, "clickerIndex", phone);
  const reservationExpiryMs = 10 * 60 * 1000;

  // Atomically check + reserve username and phone
  let reserved = false;
  let suffixCounter = 0;
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      await runTransaction(db, async (tx) => {
        const nowMs = Date.now();
        const [uSnap, pSnap] = await Promise.all([
          tx.get(usernameRef),
          tx.get(phoneRef),
        ]);
        if (uSnap.exists()) {
          const data = uSnap.data() || {};
          if (data.uid) throw new Error("USERNAME_TAKEN");
          const reservedAtMs = data.reservedAt?.seconds ? data.reservedAt.seconds * 1000 : 0;
          if (reservedAtMs && nowMs - reservedAtMs < reservationExpiryMs) {
            throw new Error("USERNAME_TAKEN");
          }
        }
        if (pSnap.exists()) {
          const data = pSnap.data() || {};
          if (data.uid) throw new Error("Phone number already registered.");
          const reservedAtMs = data.reservedAt?.seconds ? data.reservedAt.seconds * 1000 : 0;
          if (reservedAtMs && nowMs - reservedAtMs < reservationExpiryMs) {
            throw new Error("Phone number is reserved. Try again in a few minutes.");
          }
        }
        tx.set(usernameRef, { reserved: true, reservedAt: serverTimestamp() });
        tx.set(phoneRef, { reserved: true, reservedAt: serverTimestamp() });
      });
      reserved = true;
      break;
    } catch (error) {
      if (error?.message === "USERNAME_TAKEN") {
        normalizedUsername = buildUsernameCandidate(fullName, birthDate, suffixCounter);
        suffixCounter += 1;
        usernameRef = doc(db, "clickerIndex", normalizedUsername);
        continue;
      }
      throw error;
    }
  }

  if (!reserved) {
    throw new Error("Could not generate a unique username. Please try again.");
  }

  // Create Firebase Auth user
  let cred;
  try {
    cred = await createUserWithEmailAndPassword(auth, authEmail, password);
  } catch (err) {
    // Rollback reservations on auth failure
    await Promise.allSettled([
      deleteDoc(usernameRef),
      deleteDoc(phoneRef),
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
    setDoc(usernameRef, { uid: cred.user.uid, authEmail, linkedAt: serverTimestamp() }),
    setDoc(phoneRef,    { uid: cred.user.uid, authEmail, linkedAt: serverTimestamp() }),
  ]);

  writeProfileCache({ uid: cred.user.uid, profile: { ...profile, createdAt: null } });
  return cred.user;
}

// ─── Login ────────────────────────────────────────────────────────────────────
export async function loginClicker({ identifier, password }) {
  const authEmail = String(identifier || "").toLowerCase().trim();

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
  if (data.role !== "clicker") return null;
  if (data.authUid && data.authUid !== uid) return null;

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

// ─── Username update ─────────────────────────────────────────────────────────
export async function updateClickerUsername({ uid, newUsername }) {
  const normalized = String(newUsername || "").toLowerCase().trim().replace(/^@+/, "");
  if (!normalized) {
    throw new Error("Username is required.");
  }
  if (!/^[a-z0-9_]{3,20}$/.test(normalized)) {
    throw new Error("Username must be letters, numbers, or underscore only.");
  }

  const clickerRef = doc(db, "clickers", uid);
  const newIndexRef = doc(db, "clickerIndex", normalized);

  await runTransaction(db, async (tx) => {
    const clickerSnap = await tx.get(clickerRef);
    if (!clickerSnap.exists()) {
      throw new Error("Profile not found.");
    }
    const data = clickerSnap.data();
    const oldUsername = data.username || "";
    if (oldUsername === normalized) {
      return;
    }

    const newIndexSnap = await tx.get(newIndexRef);
    if (newIndexSnap.exists()) {
      const owner = newIndexSnap.data()?.uid;
      if (owner && owner !== uid) {
        throw new Error("Username already taken.");
      }
    }

    tx.set(newIndexRef, {
      uid,
      authEmail: data.email || "",
      linkedAt: serverTimestamp(),
    });

    if (oldUsername) {
      const oldIndexRef = doc(db, "clickerIndex", oldUsername);
      const oldIndexSnap = await tx.get(oldIndexRef);
      if (oldIndexSnap.exists() && oldIndexSnap.data()?.uid === uid) {
        tx.delete(oldIndexRef);
      }
    }

    tx.update(clickerRef, {
      username: normalized,
      updatedAt: serverTimestamp(),
    });
  });

  updateProfileCache(uid, { username: normalized });
  return normalized;
}
