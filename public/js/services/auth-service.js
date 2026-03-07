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
  deleteDoc,
  serverTimestamp,
  runTransaction,
} from "../config/firebase.js";
import { APP_CONFIG } from "../config/app-config.js";
import { getLevelFromPoints } from "../utils/levels.js";

const PROFILE_CACHE_KEY = "kc_student_profile_cache";
const PROFILE_CACHE_TTL_MS = 5 * 60 * 1000;

function studentEmailFromUniversityId(universityId) {
  return `${universityId}@students.koolclick.app`;
}

function writeProfileCache({ uid, universityId, profile }) {
  try {
    localStorage.setItem(
      PROFILE_CACHE_KEY,
      JSON.stringify({
        uid,
        universityId,
        profile,
        ts: Date.now(),
      })
    );
  } catch {
    // ignore cache write failures
  }
}

function readProfileCache(uid) {
  try {
    const raw = localStorage.getItem(PROFILE_CACHE_KEY);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || parsed.uid !== uid || !parsed.profile || !parsed.universityId) return null;
    if (Date.now() - parsed.ts > PROFILE_CACHE_TTL_MS) return null;

    return parsed;
  } catch {
    return null;
  }
}

function clearProfileCache() {
  try {
    localStorage.removeItem(PROFILE_CACHE_KEY);
  } catch {
    // ignore cache clear failures
  }
}

export function applyPointsDeltaToProfileCache(uid, deltaPoints) {
  if (!deltaPoints) return;

  const cached = readProfileCache(uid);
  if (!cached) return;

  const current = Number(cached.profile.points || 0);
  const updatedPoints = current + Number(deltaPoints);
  const level = getLevelFromPoints(updatedPoints);

  writeProfileCache({
    uid,
    universityId: cached.universityId,
    profile: {
      ...cached.profile,
      points: updatedPoints,
      level: level.level,
    },
  });
}

export async function registerStudent({ universityId, password, fullName, phone, birthDate, avatar }) {
  const universityRef = doc(db, "universityIds", universityId);

  await runTransaction(db, async (transaction) => {
    const existing = await transaction.get(universityRef);
    if (existing.exists()) {
      throw new Error("University ID already exists.");
    }
    transaction.set(universityRef, { reservedAt: serverTimestamp() });
  });

  let cred;
  try {
    const email = studentEmailFromUniversityId(universityId);
    cred = await createUserWithEmailAndPassword(auth, email, password);
  } catch (error) {
    await deleteDoc(universityRef);
    throw error;
  }

  const signupPoints = APP_CONFIG.signupBonusPoints || 0;
  const signupLevel = getLevelFromPoints(signupPoints);
  const profile = {
    role: "student",
    authUid: cred.user.uid,
    universityId,
    fullName,
    phone,
    birthDate,
    avatar,
    points: signupPoints,
    level: signupLevel.level,
    createdAt: serverTimestamp(),
  };

  await setDoc(doc(db, "users", universityId), profile);

  await setDoc(doc(db, "userAuthIndex", cred.user.uid), {
    universityId,
    role: "student",
    createdAt: serverTimestamp(),
  });

  await setDoc(
    universityRef,
    {
      authUid: cred.user.uid,
      role: "student",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  writeProfileCache({
    uid: cred.user.uid,
    universityId,
    profile: {
      ...profile,
      createdAt: null,
    },
  });

  return cred.user;
}

export async function loginStudent({ universityId, password }) {
  const email = studentEmailFromUniversityId(universityId);
  const cred = await signInWithEmailAndPassword(auth, email, password);
  const userDoc = await getDoc(doc(db, "users", universityId));

  if (!userDoc.exists() || userDoc.data().role !== "student" || userDoc.data().authUid !== cred.user.uid) {
    await signOut(auth);
    throw new Error("Only student access is allowed here.");
  }

  await setDoc(
    doc(db, "userAuthIndex", cred.user.uid),
    {
      universityId,
      role: "student",
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  const profile = userDoc.data();
  writeProfileCache({ uid: cred.user.uid, universityId, profile });

  return { user: cred.user, profile };
}

export async function getCurrentStudentProfile(uid, options = {}) {
  const forceFresh = options?.forceFresh === true;
  const cached = !forceFresh ? readProfileCache(uid) : null;
  if (cached) return cached.profile;

  const indexSnap = await getDoc(doc(db, "userAuthIndex", uid));
  if (!indexSnap.exists()) return null;

  const { universityId } = indexSnap.data();
  if (!universityId) return null;

  const userSnap = await getDoc(doc(db, "users", universityId));
  if (!userSnap.exists()) return null;

  const data = userSnap.data();
  if (data.role !== "student" || data.authUid !== uid) return null;

  writeProfileCache({ uid, universityId, profile: data });
  return data;
}

export async function logoutUser() {
  clearProfileCache();
  await signOut(auth);
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback);
}
