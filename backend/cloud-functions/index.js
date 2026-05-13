const { onCall, HttpsError } = require("firebase-functions/v2/https");
const logger = require("firebase-functions/logger");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

initializeApp();

const db = getFirestore();

const APP_CONFIG = {
  points: {
    pointsPerStep: 5,
    stepAmountEgp: 50,
  },
  paymentMethods: {
    cod: "CashOnDelivery",
    instaPay: "InstaPay",
  },
};

const MAX_DISTINCT_PRODUCTS = 50;
const MAX_QTY_PER_ITEM = 50;
const MAX_RECEIPT_URL_LENGTH = 500;
const ORDER_CREATE_COOLDOWN_MS = 8000;
const ADMIN_LIST_LIMIT = 100;
const ADMIN_AUDIT_LIMIT = 100;
const ADMIN_MANAGED_ROLES = new Set(["clicker", "cashier", "manager", "admin"]);
const ADMIN_RECENT_AUTH_MAX_AGE_MS = 15 * 60 * 1000;
const ADMIN_RATE_LIMITS = {
  createUser: { max: 10, windowMs: 60 * 1000, label: "minute" },
  updateRole: { max: 5, windowMs: 60 * 1000, label: "minute" },
  deleteUser: { max: 10, windowMs: 60 * 60 * 1000, label: "hour" },
  listUsers: { max: 60, windowMs: 60 * 1000, label: "minute" },
  getAuditLogs: { max: 60, windowMs: 60 * 1000, label: "minute" },
};
const ROLE_PROFILE_COLLECTIONS = {
  clicker: "clickers",
  cashier: "cashiers",
  manager: "managers",
  admin: "admins"
};

let coldStartPending = true;

function assert(condition, code, message) {
  if (!condition) {
    throw new HttpsError(code, message);
  }
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function normalizeId(value, fieldName) {
  const normalized = String(value || "").trim();
  assert(/^[A-Za-z0-9_-]{1,160}$/.test(normalized), "invalid-argument", `${fieldName} is invalid.`);
  return normalized;
}

function normalizeText(value, fieldName, { min = 0, max = 160 } = {}) {
  const normalized = String(value || "").trim();
  assert(normalized.length >= min, "invalid-argument", `${fieldName} is required.`);
  assert(normalized.length <= max, "invalid-argument", `${fieldName} is too long.`);
  return normalized;
}

function normalizeOptionalText(value, fieldName, max = 160) {
  const normalized = String(value || "").trim();
  assert(normalized.length <= max, "invalid-argument", `${fieldName} is too long.`);
  return normalized;
}

function normalizeEmail(value, fieldName = "email") {
  const normalized = String(value || "")
    .trim()
    .toLowerCase();
  assert(
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized),
    "invalid-argument",
    `${fieldName} is invalid.`
  );
  assert(normalized.length <= 254, "invalid-argument", `${fieldName} is too long.`);
  return normalized;
}

function normalizePhone(value, fieldName = "phone") {
  const normalized = String(value || "").trim();
  assert(/^[0-9+()\-\s]{6,24}$/.test(normalized), "invalid-argument", `${fieldName} is invalid.`);
  return normalized;
}

function normalizePassword(value) {
  const password = String(value || "");
  assert(
    password.length >= 8 && password.length <= 128,
    "invalid-argument",
    "Password must be between 8 and 128 characters."
  );
  return password;
}

function normalizeAdminManagedRole(value) {
  const role = String(value || "").trim();
  assert(
    ADMIN_MANAGED_ROLES.has(role),
    "invalid-argument",
    "Role is not allowed for this operation."
  );
  return role;
}

function normalizeAdminLimit(value, fallback) {
  const limit = Number(value || fallback);
  assert(
    Number.isInteger(limit) && limit >= 1 && limit <= fallback,
    "invalid-argument",
    "Invalid limit."
  );
  return limit;
}

function loginEmailForRole(role, { email, phone }) {
  const phoneAlias = String(phone || "").replace(/[^0-9]/g, "");
  if (role === "cashier") return `${phoneAlias}@cashiers.koolclick.app`;
  if (role === "manager") return `${phoneAlias}@managers.koolclick.app`;
  return email;
}

function redactEmail(email) {
  const [local, domain] = String(email || "").split("@");
  if (!local || !domain) return "";
  return `${local.slice(0, 2)}***@${domain}`;
}

function safeMetadata(metadata = {}) {
  const output = {};
  Object.entries(metadata || {}).forEach(([key, value]) => {
    if (!/^[A-Za-z0-9_.-]{1,50}$/.test(key)) return;
    if (value === null || value === undefined) return;
    if (typeof value === "string") output[key] = value.slice(0, 200);
    if (typeof value === "number" && Number.isFinite(value)) output[key] = value;
    if (typeof value === "boolean") output[key] = value;
  });
  return output;
}

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function windowKey(windowMs, nowMs = Date.now()) {
  return Math.floor(nowMs / windowMs);
}

function errorCode(error) {
  return error instanceof HttpsError ? error.code : error?.code || "internal";
}

function assertRecentAuth(request, action) {
  const authTimeSeconds = Number(request.auth?.token?.auth_time || 0);
  assert(authTimeSeconds > 0, "permission-denied", "Recent authentication is required.");

  const ageMs = Date.now() - authTimeSeconds * 1000;
  assert(
    ageMs >= 0 && ageMs <= ADMIN_RECENT_AUTH_MAX_AGE_MS,
    "permission-denied",
    `Recent authentication is required before ${action}. Please sign in again.`
  );
}

async function enforceAdminRateLimit(adminUid, action) {
  const config = ADMIN_RATE_LIMITS[action];
  if (!config) return;

  const nowMs = Date.now();
  const bucket = windowKey(config.windowMs, nowMs);
  const ref = db.collection("adminRateLimits").doc(`${adminUid}_${action}_${bucket}`);

  await db.runTransaction(async (transaction) => {
    const snap = await transaction.get(ref);
    const current = Number(snap.data()?.count || 0);
    assert(
      current < config.max,
      "resource-exhausted",
      `Admin ${action} limit reached for this ${config.label}.`
    );

    transaction.set(
      ref,
      {
        adminUid,
        action,
        bucket,
        count: FieldValue.increment(1),
        limit: config.max,
        windowMs: config.windowMs,
        updatedAt: FieldValue.serverTimestamp(),
        expiresAt: new Date(nowMs + config.windowMs * 2),
      },
      { merge: true }
    );
  });
}

async function recordOperationalMetric(
  functionName,
  { status, latencyMs, code = "", metadata = {} } = {}
) {
  const dateKey = dayKey();
  const metricRef = db.collection("opsMetrics").doc(dateKey);
  const healthRef = db.collection("systemHealth").doc("current");
  const safe = safeMetadata(metadata);
  const fields = {
    [`functions.${functionName}.calls`]: FieldValue.increment(1),
    [`functions.${functionName}.${status}`]: FieldValue.increment(1),
    [`functions.${functionName}.latencyMsTotal`]: FieldValue.increment(
      Math.max(0, Math.round(latencyMs || 0))
    ),
    [`functions.${functionName}.lastCode`]: code || status,
    [`functions.${functionName}.lastSeenAt`]: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  };

  if (safe.reads) fields.firestoreReadUnits = FieldValue.increment(Number(safe.reads || 0));
  if (safe.writes) fields.firestoreWriteUnits = FieldValue.increment(Number(safe.writes || 0));
  if (safe.idempotentReplay) fields.idempotencyHits = FieldValue.increment(1);
  if (safe.abuseFlag) fields.abuseFlags = FieldValue.increment(1);
  if (coldStartPending) fields.coldStarts = FieldValue.increment(1);

  await Promise.allSettled([
    metricRef.set(fields, { merge: true }),
    healthRef.set(
      {
        lastFunctionName: functionName,
        lastStatus: status,
        lastCode: code || status,
        lastLatencyMs: Math.max(0, Math.round(latencyMs || 0)),
        lastMetadata: safe,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true }
    ),
  ]);
}

async function observeCallable(functionName, request, handler) {
  const startedAt = Date.now();
  const coldStart = coldStartPending;
  coldStartPending = false;

  try {
    const result = await handler();
    const latencyMs = Date.now() - startedAt;
    logger.info(`${functionName}.completed`, {
      status: "success",
      latencyMs,
      coldStart,
      uidHint: uidHint(request.auth?.uid || ""),
    });
    await recordOperationalMetric(functionName, {
      status: "success",
      latencyMs,
      metadata: { coldStart },
    });
    return result;
  } catch (error) {
    const latencyMs = Date.now() - startedAt;
    const code = errorCode(error);
    logger.error(`${functionName}.failed`, {
      status: "failure",
      code,
      latencyMs,
      coldStart,
      uidHint: uidHint(request.auth?.uid || ""),
    });
    await recordOperationalMetric(functionName, {
      status: "failure",
      latencyMs,
      code,
      metadata: { coldStart, abuseFlag: code === "resource-exhausted" },
    });
    throw error;
  }
}

async function assertSuperAdmin(uid) {
  assert(uid, "unauthenticated", "Authentication is required.");
  const userSnap = await db.collection("users").doc(uid).get();
  const user = userSnap.exists ? userSnap.data() : null;
  assert(
    user?.role === "superAdmin" && user.disabled !== true,
    "permission-denied",
    "Super admin access is required."
  );
  return { uid, ...user };
}

function buildRoleProfile(role, uid, payload, previous = {}) {
  const now = FieldValue.serverTimestamp();
  if (role === "clicker") {
    return {
      role: "clicker",
      authUid: uid,
      fullName: payload.displayName,
      username: payload.username || previous.username || "",
      phone: payload.phone || "",
      email: payload.email || "",
      avatar: previous.avatar || "",
      points: Number(previous.points || 0),
      level: Number(previous.level || 1),
      createdAt: previous.createdAt || now,
      updatedAt: now,
    };
  }

  if (role === "cashier" || role === "manager") {
    return {
      displayName: payload.displayName,
      phone: payload.phone,
      restaurantId: payload.restaurantId,
      restaurantName: payload.restaurantName || "",
      createdAt: previous.createdAt || now,
      updatedAt: now,
    };
  }

  return null;
}

async function assertClickerIndexAvailable(payload, uid = "") {
  if (!payload.username && !payload.phone) return;

  const refs = [];
  if (payload.username) refs.push(db.collection("clickerIndex").doc(payload.username));
  if (payload.phone) refs.push(db.collection("clickerIndex").doc(payload.phone));

  const snaps = await Promise.all(refs.map((ref) => ref.get()));
  snaps.forEach((snap) => {
    if (!snap.exists) return;
    const ownerUid = snap.data()?.uid || "";
    assert(
      !ownerUid || ownerUid === uid,
      "already-exists",
      "Clicker username or phone is already linked."
    );
  });
}

function writeClickerIndexEntries(batch, payload, uid) {
  if (payload.role !== "clicker") return;
  const indexData = {
    uid,
    authEmail: payload.authEmail,
    linkedAt: FieldValue.serverTimestamp(),
  };

  if (payload.username) {
    batch.set(db.collection("clickerIndex").doc(payload.username), indexData);
  }

  if (payload.phone) {
    batch.set(db.collection("clickerIndex").doc(payload.phone), indexData);
  }
}

function normalizeAdminUserPayload(data, { requirePassword = false } = {}) {
  assert(isPlainObject(data), "invalid-argument", "Request payload must be an object.");
  const role = normalizeAdminManagedRole(data.role);
  const displayName = normalizeText(data.displayName || data.fullName, "displayName", {
    min: 2,
    max: 120,
  });
  const phone =
    role === "cashier" || role === "manager"
      ? normalizePhone(data.phone)
      : normalizeOptionalText(data.phone, "phone", 24);
  const email =
    role === "cashier" || role === "manager"
      ? normalizeOptionalText(data.email, "email", 254)
      : normalizeEmail(data.email);
  if (email) normalizeEmail(email);
  const password = requirePassword ? normalizePassword(data.password) : "";
  const restaurantId =
    role === "cashier" || role === "manager"
      ? normalizeId(data.restaurantId, "restaurantId")
      : normalizeOptionalText(data.restaurantId, "restaurantId", 160);
  const restaurantName = normalizeOptionalText(data.restaurantName, "restaurantName", 160);
  const username =
    role === "clicker" ? normalizeOptionalText(data.username, "username", 40).toLowerCase() : "";

  return {
    role,
    displayName,
    phone,
    email,
    password,
    restaurantId,
    restaurantName,
    username,
    authEmail: loginEmailForRole(role, { email, phone }),
  };
}

function publicUserRecord(uid, data = {}) {
  return {
    uid,
    role: data.role || "",
    displayName: data.displayName || data.fullName || "",
    email: data.email || "",
    authEmail: redactEmail(data.authEmail || data.email || ""),
    phone: data.phone || "",
    restaurantId: data.restaurantId || "",
    restaurantName: data.restaurantName || "",
    disabled: data.disabled === true,
    createdAt: data.createdAt || null,
    updatedAt: data.updatedAt || null,
  };
}

function publicAuditRecord(id, data = {}) {
  return {
    id,
    adminUid: data.adminUid || "",
    action: data.action || "",
    targetUid: data.targetUid || "",
    status: data.status || "",
    metadata: safeMetadata(data.metadata || {}),
    createdAt: data.createdAt || null,
  };
}

async function readManagedUser(uid) {
  const userSnap = await db.collection("users").doc(uid).get();
  if (userSnap.exists) {
    return { uid, ...userSnap.data() };
  }

  const [clickerSnap, cashierSnap, managerSnap, indexSnap] = await Promise.all([
    db.collection("clickers").doc(uid).get(),
    db.collection("cashiers").doc(uid).get(),
    db.collection("managers").doc(uid).get(),
    db.collection("userAuthIndex").doc(uid).get(),
  ]);

  if (clickerSnap.exists) {
    const profile = clickerSnap.data() || {};
    return {
      uid,
      role: "clicker",
      authUid: uid,
      displayName: profile.fullName || profile.displayName || "",
      email: profile.email || "",
      authEmail: profile.email || "",
      phone: profile.phone || "",
      createdAt: profile.createdAt || null,
      updatedAt: profile.updatedAt || null,
    };
  }

  if (cashierSnap.exists) {
    const profile = cashierSnap.data() || {};
    return {
      uid,
      role: "cashier",
      authUid: uid,
      displayName: profile.displayName || "",
      authEmail: indexSnap.data()?.authEmail || "",
      phone: profile.phone || "",
      restaurantId: profile.restaurantId || "",
      restaurantName: profile.restaurantName || "",
      createdAt: profile.createdAt || null,
      updatedAt: profile.updatedAt || null,
    };
  }

  if (managerSnap.exists) {
    const profile = managerSnap.data() || {};
    return {
      uid,
      role: "manager",
      authUid: uid,
      displayName: profile.displayName || "",
      authEmail: indexSnap.data()?.authEmail || "",
      phone: profile.phone || "",
      restaurantId: profile.restaurantId || "",
      restaurantName: profile.restaurantName || "",
      createdAt: profile.createdAt || null,
      updatedAt: profile.updatedAt || null,
    };
  }

  if (indexSnap.exists) {
    return {
      uid,
      role: indexSnap.data()?.role || "",
      authUid: uid,
      authEmail: indexSnap.data()?.authEmail || "",
      createdAt: indexSnap.data()?.createdAt || null,
      updatedAt: indexSnap.data()?.updatedAt || null,
    };
  }

  return null;
}

function createdAtMillis(user) {
  if (typeof user?.createdAt?.toMillis === "function") return user.createdAt.toMillis();
  if (user?.createdAt?.seconds) return user.createdAt.seconds * 1000;
  return 0;
}

function auditLogRef() {
  return db.collection("auditLogs").doc();
}

function writeAuditInBatch(
  batch,
  { adminUid, action, targetUid = "", status = "success", metadata = {} }
) {
  batch.set(auditLogRef(), {
    adminUid,
    action,
    targetUid,
    status,
    metadata: safeMetadata(metadata),
    createdAt: FieldValue.serverTimestamp(),
  });
}

function normalizeQty(value) {
  const qty = Number(value || 0);
  assert(
    Number.isInteger(qty) && qty >= 1 && qty <= MAX_QTY_PER_ITEM,
    "invalid-argument",
    "Invalid item quantity."
  );
  return qty;
}

function normalizePaymentMethod(value) {
  const method = String(value || APP_CONFIG.paymentMethods.cod).trim();
  assert(
    [APP_CONFIG.paymentMethods.cod, APP_CONFIG.paymentMethods.instaPay].includes(method),
    "invalid-argument",
    "Invalid payment method."
  );
  return method;
}

function normalizePromoCode(value) {
  const code = String(value || "")
    .trim()
    .toUpperCase();
  assert(code.length <= 40, "invalid-argument", "Promo code is too long.");
  return code;
}

function normalizeReceiptUrl(value, paymentMethod) {
  const url = String(value || "").trim();
  if (paymentMethod !== APP_CONFIG.paymentMethods.instaPay) return "";

  assert(url, "invalid-argument", "Receipt image is required for InstaPay orders.");
  assert(url.length <= MAX_RECEIPT_URL_LENGTH, "invalid-argument", "Receipt URL is too long.");

  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new HttpsError("invalid-argument", "Receipt URL is invalid.");
  }

  assert(parsed.protocol === "https:", "invalid-argument", "Receipt URL must use HTTPS.");
  assert(
    parsed.hostname === "res.cloudinary.com",
    "invalid-argument",
    "Receipt URL host is not allowed."
  );
  return parsed.href;
}

function pointsFromAmount(amountEgp) {
  const steps = Math.floor(Number(amountEgp || 0) / APP_CONFIG.points.stepAmountEgp);
  return steps * APP_CONFIG.points.pointsPerStep;
}

function getLevelFromPoints(points) {
  const levels = [
    { level: 1, minPoints: 0 },
    { level: 2, minPoints: 100 },
    { level: 3, minPoints: 250 },
    { level: 4, minPoints: 500 },
  ];
  let current = levels[0];
  for (const level of levels) {
    if (points >= level.minPoints) current = level;
  }
  return current.level;
}

function normalizeOfferValue(value) {
  return String(value || "").trim();
}

function computeOfferPrice(basePrice, offer) {
  const price = Number(basePrice || 0);
  if (!offer || offer.isActive === false) return price;

  if (offer.discountType === "flat") {
    return Math.max(0, price - Number(offer.discountValue || 0));
  }

  if (offer.discountType === "percent") {
    const percent = Number(offer.discountValue || 0);
    return Math.max(0, price * (1 - percent / 100));
  }

  return price;
}

function offerTargetsProduct(offer, product) {
  if (!offer || !product) return false;
  const targetType = offer.targetType || "";
  const targetValue = normalizeOfferValue(offer.targetValue);

  if (targetType === "product") {
    return (
      normalizeOfferValue(product.id) === targetValue ||
      normalizeOfferValue(product.name) === targetValue
    );
  }

  if (targetType === "section") {
    return normalizeOfferValue(product.category || "General") === targetValue;
  }

  return false;
}

function calculatePromoDiscount(subtotal, promo) {
  if (!promo || subtotal <= 0) return 0;
  if (subtotal < Number(promo.minSubtotal || 0)) return 0;

  if (promo.type === "percent") {
    return Math.floor((subtotal * Number(promo.value || 0)) / 100);
  }

  if (promo.type === "flat") {
    return Math.min(Number(promo.value || 0), subtotal);
  }

  return 0;
}

function isTimestampExpired(timestamp) {
  if (!timestamp || typeof timestamp.toMillis !== "function") return false;
  return timestamp.toMillis() < Date.now();
}

function isTimestampNotStarted(timestamp) {
  if (!timestamp || typeof timestamp.toMillis !== "function") return false;
  return timestamp.toMillis() > Date.now();
}

function splitCartByRestaurant(cartItems) {
  const buckets = new Map();
  for (const item of cartItems) {
    const group = buckets.get(item.restaurantId) || [];
    group.push(item);
    buckets.set(item.restaurantId, group);
  }
  return [...buckets.entries()].map(([restaurantId, items]) => ({ restaurantId, items }));
}

function calcSubtotal(items) {
  return Number(items.reduce((sum, item) => sum + item.price * item.qty, 0).toFixed(2));
}

function calcItemsCount(items) {
  return items.reduce((sum, item) => sum + item.qty, 0);
}

function buildOrderNumber(orderId) {
  return String(orderId || "")
    .replace(/[^a-zA-Z0-9]/g, "")
    .slice(0, 8)
    .toUpperCase();
}

function splitDiscountByGroup(groups, totalDiscount) {
  if (totalDiscount <= 0 || !groups.length) return groups.map(() => 0);

  const totalSubtotal = groups.reduce((sum, group) => sum + calcSubtotal(group.items), 0);
  if (totalSubtotal <= 0) return groups.map(() => 0);

  const splits = [];
  let allocated = 0;
  groups.forEach((group, idx) => {
    if (idx === groups.length - 1) {
      splits.push(Number((totalDiscount - allocated).toFixed(2)));
      return;
    }
    const ratio = calcSubtotal(group.items) / totalSubtotal;
    const part = Math.floor(totalDiscount * ratio);
    splits.push(part);
    allocated += part;
  });
  return splits;
}

function sanitizeOrderSummary(summary) {
  return {
    createdOrderIds: summary.createdOrderIds,
    totalSubtotal: summary.totalSubtotal,
    totalDiscount: summary.totalDiscount,
    finalPayable: summary.finalPayable,
    pointsGrantedNow: summary.pointsGrantedNow,
    pointsPendingOnCollection: summary.pointsPendingOnCollection,
  };
}

function uidHint(uid) {
  return String(uid || "").slice(0, 8);
}

function normalizeCreateOrderPayload(data) {
  assert(isPlainObject(data), "invalid-argument", "Request payload must be an object.");
  assert(Array.isArray(data.items), "invalid-argument", "Items must be an array.");
  assert(data.items.length > 0, "invalid-argument", "Cart is empty.");
  assert(
    data.items.length <= MAX_DISTINCT_PRODUCTS,
    "invalid-argument",
    "Cart has too many items."
  );

  const paymentMethod = normalizePaymentMethod(data.paymentMethod);
  const receiptImageUrl = normalizeReceiptUrl(data.receiptImageUrl, paymentMethod);
  const promoCode = normalizePromoCode(data.promoCode);
  const clientRequestId = normalizeId(data.clientRequestId, "clientRequestId");

  const merged = new Map();
  for (const rawItem of data.items) {
    assert(isPlainObject(rawItem), "invalid-argument", "Cart item is invalid.");
    const productId = normalizeId(rawItem.productId, "productId");
    const qty = normalizeQty(rawItem.qty);
    const offerId = rawItem.offerId ? normalizeId(rawItem.offerId, "offerId") : "";
    const key = `${productId}:${offerId}`;
    const existing = merged.get(key) || { productId, offerId, qty: 0 };
    existing.qty += qty;
    assert(existing.qty <= MAX_QTY_PER_ITEM, "invalid-argument", "Item quantity is too large.");
    merged.set(key, existing);
  }

  return {
    items: [...merged.values()],
    promoCode,
    paymentMethod,
    receiptImageUrl,
    clientRequestId,
  };
}

async function getPromoInTransaction(transaction, promoCode, restaurantId) {
  if (!promoCode) return null;

  const promoQuery = db
    .collection("promoCodes")
    .where("code", "==", promoCode)
    .where("restaurantId", "==", restaurantId)
    .limit(1);
  const promoSnap = await transaction.get(promoQuery);
  if (promoSnap.empty) return null;

  const doc = promoSnap.docs[0];
  const promo = { id: doc.id, ref: doc.ref, ...doc.data() };
  if (promo.isActive === false) return null;
  if (isTimestampExpired(promo.expiresAt) || isTimestampNotStarted(promo.startsAt)) return null;

  const usageLimit = Number(promo.usageLimit || 0);
  const usedCount = Number(promo.usedCount || 0);
  assert(
    !usageLimit || usedCount < usageLimit,
    "failed-precondition",
    "Promo code usage limit reached."
  );
  return promo;
}

exports.createClickerOrders = onCall({ region: "us-central1" }, async (request) =>
  observeCallable("createClickerOrders", request, async () => {
    assert(request.auth?.uid, "unauthenticated", "You must be signed in to place an order.");

    const uid = request.auth.uid;
    const payload = normalizeCreateOrderPayload(request.data);
    const requestRef = db.collection("orderRequests").doc(`${uid}_${payload.clientRequestId}`);
    const rateRef = db.collection("orderRateLimits").doc(uid);

    const result = await db.runTransaction(async (transaction) => {
      const existingRequest = await transaction.get(requestRef);
      if (existingRequest.exists) {
        logger.info("createClickerOrders.idempotentReplay", {
          uidHint: uidHint(uid),
          clientRequestId: payload.clientRequestId,
        });
        return sanitizeOrderSummary(existingRequest.data().summary || {});
      }

      const rateSnap = await transaction.get(rateRef);
      if (rateSnap.exists) {
        const lastCreateAt = rateSnap.data()?.lastCreateAt;
        const lastMs = typeof lastCreateAt?.toMillis === "function" ? lastCreateAt.toMillis() : 0;
        assert(
          !lastMs || Date.now() - lastMs >= ORDER_CREATE_COOLDOWN_MS,
          "resource-exhausted",
          "Please wait a few seconds before placing another order."
        );
      }

      const clickerRef = db.collection("clickers").doc(uid);
      const clickerSnap = await transaction.get(clickerRef);
      assert(clickerSnap.exists, "permission-denied", "Clicker profile not found.");

      const clicker = clickerSnap.data() || {};
      assert(clicker.role === "clicker", "permission-denied", "Only clickers can place orders.");
      assert(
        !clicker.authUid || clicker.authUid === uid,
        "permission-denied",
        "Profile ownership mismatch."
      );

      const productIds = [...new Set(payload.items.map((item) => item.productId))];
      const productRefs = productIds.map((id) => db.collection("products").doc(id));
      const productSnaps = await Promise.all(productRefs.map((ref) => transaction.get(ref)));
      const productMap = new Map();

      productSnaps.forEach((snap) => {
        assert(snap.exists, "failed-precondition", "One or more products are no longer available.");
        productMap.set(snap.id, { id: snap.id, ...snap.data() });
      });

      const offerIds = [...new Set(payload.items.map((item) => item.offerId).filter(Boolean))];
      const offerRefs = offerIds.map((id) => db.collection("offers").doc(id));
      const offerSnaps = await Promise.all(offerRefs.map((ref) => transaction.get(ref)));
      const offerMap = new Map();

      offerSnaps.forEach((snap) => {
        if (snap.exists) offerMap.set(snap.id, { id: snap.id, ...snap.data() });
      });

      const verifiedItems = payload.items.map((item) => {
        const product = productMap.get(item.productId);
        assert(product, "failed-precondition", "Product not found.");
        assert(
          product.isActive !== false && product.isActive !== "false",
          "failed-precondition",
          `${product.name || "Product"} is sold out.`
        );

        const basePrice = Number(product.price || 0);
        assert(
          Number.isFinite(basePrice) && basePrice >= 0,
          "failed-precondition",
          "Invalid product price."
        );

        let offer = null;
        let finalPrice = basePrice;
        if (item.offerId) {
          const candidate = offerMap.get(item.offerId) || null;
          const validOffer =
            candidate &&
            candidate.isActive !== false &&
            candidate.restaurantId === product.restaurantId &&
            offerTargetsProduct(candidate, product);

          if (validOffer) {
            offer = candidate;
            finalPrice = computeOfferPrice(basePrice, offer);
          }
        }

        const offerLabel = offer
          ? offer.discountType === "flat"
            ? `-${Number(offer.discountValue || 0).toFixed(0)} EGP`
            : `-${Number(offer.discountValue || 0).toFixed(0)}%`
          : "";

        return {
          menuId: product.id,
          restaurantId: product.restaurantId,
          restaurantName: product.restaurantName || "",
          name: product.name || "",
          price: Number(finalPrice.toFixed(2)),
          qty: item.qty,
          offerId: offer?.id || "",
          offerTitle: offer?.title || "",
          offerLabel,
          basePrice: offer ? basePrice : null,
        };
      });

      const groups = splitCartByRestaurant(verifiedItems);
      assert(groups.length > 0, "invalid-argument", "Cart is empty.");

      const totalSubtotal = calcSubtotal(verifiedItems);
      const promo =
        groups.length === 1
          ? await getPromoInTransaction(transaction, payload.promoCode, groups[0].restaurantId)
          : null;
      const totalDiscount = calculatePromoDiscount(totalSubtotal, promo);
      const splitDiscounts = splitDiscountByGroup(groups, totalDiscount);
      const instantPoints = payload.paymentMethod === APP_CONFIG.paymentMethods.instaPay;

      const createdOrderIds = [];
      let pointsGrantedNow = 0;
      let pointsPendingOnCollection = 0;

      groups.forEach((group, idx) => {
        const orderRef = db.collection("orders").doc();
        const subtotal = calcSubtotal(group.items);
        const discountAmount = splitDiscounts[idx] || 0;
        const finalTotal = Number(Math.max(0, subtotal - discountAmount).toFixed(2));
        const pointsEarned = pointsFromAmount(finalTotal);
        const itemsCount = calcItemsCount(group.items);
        const restaurantName = group.items[0]?.restaurantName || "";

        transaction.set(orderRef, {
          orderNumber: buildOrderNumber(orderRef.id),
          clickerUid: uid,
          clickerName: clicker.fullName || "",
          clickerPhone: clicker.phone || "",
          restaurantId: group.restaurantId,
          restaurantName,
          items: group.items,
          itemsCount,
          subtotal,
          promoCode: promo?.code || "",
          discountAmount,
          finalTotal,
          pointsEarned,
          pointsGranted: instantPoints,
          status: "Pending",
          statusHistory: [{ status: "Pending", at: FieldValue.serverTimestamp() }],
          remainingTimeMinutes: 20,
          paymentMethod: payload.paymentMethod,
          paymentStatus: instantPoints ? "ReceiptUploaded" : "PayOnPickup",
          receiptImageUrl: payload.receiptImageUrl,
          qrPayload: orderRef.id,
          createdAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        if (instantPoints) {
          pointsGrantedNow += pointsEarned;
        } else {
          pointsPendingOnCollection += pointsEarned;
        }
        createdOrderIds.push(orderRef.id);
      });

      if (pointsGrantedNow > 0) {
        const currentPoints = Number(clicker.points || 0);
        const nextPoints = currentPoints + pointsGrantedNow;
        transaction.update(clickerRef, {
          points: nextPoints,
          level: getLevelFromPoints(nextPoints),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      if (promo?.ref && totalDiscount > 0) {
        transaction.update(promo.ref, {
          usedCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      const summary = sanitizeOrderSummary({
        createdOrderIds,
        totalSubtotal,
        totalDiscount,
        finalPayable: Number(Math.max(0, totalSubtotal - totalDiscount).toFixed(2)),
        pointsGrantedNow,
        pointsPendingOnCollection,
      });

      transaction.set(requestRef, {
        uid,
        createdAt: FieldValue.serverTimestamp(),
        summary,
      });

      transaction.set(
        rateRef,
        {
          lastCreateAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info("createClickerOrders.success", {
        uidHint: uidHint(uid),
        clientRequestId: payload.clientRequestId,
        distinctProducts: productIds.length,
        orderCount: createdOrderIds.length,
        paymentMethod: payload.paymentMethod,
        pointsGrantedNow,
      });

      return summary;
    });

    return result;
  })
);

exports.cancelClickerOrder = onCall({ region: "us-central1" }, async (request) =>
  observeCallable("cancelClickerOrder", request, async () => {
    assert(request.auth?.uid, "unauthenticated", "You must be signed in to cancel an order.");
    assert(isPlainObject(request.data), "invalid-argument", "Request payload must be an object.");

    const uid = request.auth.uid;
    const orderId = normalizeId(request.data.orderId, "orderId");
    const penalty = 20;

    return db.runTransaction(async (transaction) => {
      const orderRef = db.collection("orders").doc(orderId);
      const clickerRef = db.collection("clickers").doc(uid);

      const [orderSnap, clickerSnap] = await Promise.all([
        transaction.get(orderRef),
        transaction.get(clickerRef),
      ]);

      assert(orderSnap.exists, "not-found", "Order not found.");
      assert(clickerSnap.exists, "permission-denied", "Clicker profile not found.");

      const order = orderSnap.data() || {};
      const clicker = clickerSnap.data() || {};

      assert(order.clickerUid === uid, "permission-denied", "This order does not belong to you.");
      assert(
        order.status !== "Collected" && order.status !== "Cancelled",
        "failed-precondition",
        "This order can no longer be cancelled."
      );

      const revokeGrantedPoints = order.pointsGranted ? Number(order.pointsEarned || 0) : 0;
      const totalDeducted = penalty + revokeGrantedPoints;
      const nextPoints = Number(clicker.points || 0) - totalDeducted;
      const statusHistory = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
      statusHistory.push({ status: "Cancelled", at: FieldValue.serverTimestamp() });

      transaction.update(orderRef, {
        status: "Cancelled",
        statusHistory,
        cancelledAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      transaction.update(clickerRef, {
        points: nextPoints,
        level: getLevelFromPoints(nextPoints),
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info("cancelClickerOrder.success", {
        uidHint: uidHint(uid),
        orderId: orderId.slice(0, 8),
        totalDeducted,
      });

      return {
        penalty,
        totalDeducted,
      };
    });
  })
);

exports.collectOrderByCashier = onCall({ region: "us-central1" }, async (request) =>
  observeCallable("collectOrderByCashier", request, async () => {
    assert(request.auth?.uid, "unauthenticated", "You must be signed in to collect an order.");
    assert(isPlainObject(request.data), "invalid-argument", "Request payload must be an object.");

    const uid = request.auth.uid;
    const orderId = normalizeId(request.data.orderId, "orderId");

    return db.runTransaction(async (transaction) => {
      const indexRef = db.collection("userAuthIndex").doc(uid);
      const cashierRef = db.collection("cashiers").doc(uid);
      const orderRef = db.collection("orders").doc(orderId);

      const [indexSnap, cashierSnap, orderSnap] = await Promise.all([
        transaction.get(indexRef),
        transaction.get(cashierRef),
        transaction.get(orderRef),
      ]);

      assert(
        indexSnap.exists && indexSnap.data()?.role === "cashier",
        "permission-denied",
        "Cashier role is required."
      );
      assert(cashierSnap.exists, "permission-denied", "Cashier profile not found.");
      assert(orderSnap.exists, "not-found", "Order not found.");

      const cashier = cashierSnap.data() || {};
      const order = orderSnap.data() || {};

      assert(
        cashier.restaurantId && order.restaurantId === cashier.restaurantId,
        "permission-denied",
        "This order does not belong to your restaurant."
      );
      assert(order.status !== "Collected", "failed-precondition", "Order already collected.");
      assert(
        order.status !== "Cancelled",
        "failed-precondition",
        "Cancelled orders cannot be collected."
      );

      const statusHistory = Array.isArray(order.statusHistory) ? [...order.statusHistory] : [];
      statusHistory.push({ status: "Collected", at: FieldValue.serverTimestamp() });

      const isCod = order.paymentMethod === APP_CONFIG.paymentMethods.cod;
      const shouldGrantPointsNow = order.pointsGranted !== true;
      let pointsAdded = 0;
      let clickerRef = null;
      let clickerSnap = null;

      if (shouldGrantPointsNow) {
        assert(
          order.clickerUid,
          "failed-precondition",
          "Clicker profile not linked to this order."
        );
        clickerRef = db.collection("clickers").doc(order.clickerUid);
        clickerSnap = await transaction.get(clickerRef);
        assert(clickerSnap.exists, "failed-precondition", "Clicker profile not found.");
      }

      transaction.update(orderRef, {
        status: "Collected",
        statusHistory,
        paymentStatus: isCod ? "PaidOnPickup" : order.paymentStatus || "Confirmed",
        pointsGranted: true,
        collectedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      if (shouldGrantPointsNow && clickerRef && clickerSnap) {
        const clicker = clickerSnap.data() || {};
        pointsAdded = Number(order.pointsEarned || 0);
        const nextPoints = Number(clicker.points || 0) + pointsAdded;

        transaction.update(clickerRef, {
          points: nextPoints,
          level: getLevelFromPoints(nextPoints),
          updatedAt: FieldValue.serverTimestamp(),
        });
      }

      logger.info("collectOrderByCashier.success", {
        uidHint: uidHint(uid),
        orderId: orderId.slice(0, 8),
        restaurantId: cashier.restaurantId,
        pointsAdded,
      });

      return {
        pointsAdded,
        paymentStatus: isCod ? "PaidOnPickup" : order.paymentStatus || "Confirmed",
      };
    });
  })
);

exports.adminCreateUser = onCall({ region: "us-central1" }, async (request) =>
  observeCallable("adminCreateUser", request, async () => {
    const adminUid = request.auth?.uid;
    const admin = await assertSuperAdmin(adminUid);
    assertRecentAuth(request, "creating users");
    await enforceAdminRateLimit(admin.uid, "createUser");
    const payload = normalizeAdminUserPayload(request.data, { requirePassword: true });
    if (payload.role === "clicker") {
      await assertClickerIndexAvailable(payload);
    }

    logger.info("adminCreateUser.request", {
      adminUidHint: uidHint(admin.uid),
      role: payload.role,
      authEmail: redactEmail(payload.authEmail),
    });

    let userRecord = null;
    try {
      userRecord = await getAuth().createUser({
        email: payload.authEmail,
        password: payload.password,
        displayName: payload.displayName,
        disabled: false,
      });

      const uid = userRecord.uid;
      const batch = db.batch();
      const userRef = db.collection("users").doc(uid);
      const indexRef = db.collection("userAuthIndex").doc(uid);
      const now = FieldValue.serverTimestamp();

      batch.set(userRef, {
        authUid: uid,
        role: payload.role,
        email: payload.email || "",
        authEmail: payload.authEmail,
        displayName: payload.displayName,
        phone: payload.phone || "",
        restaurantId: payload.restaurantId || "",
        restaurantName: payload.restaurantName || "",
        disabled: false,
        createdBy: admin.uid,
        createdAt: now,
        updatedAt: now,
      });

      batch.set(indexRef, {
        role: payload.role,
        authEmail: payload.authEmail,
        createdBy: admin.uid,
        createdAt: now,
        updatedAt: now,
      });

      const profileCollection = ROLE_PROFILE_COLLECTIONS[payload.role];
      if (profileCollection) {
        batch.set(
          db.collection(profileCollection).doc(uid),
          buildRoleProfile(payload.role, uid, payload)
        );
      }
      writeClickerIndexEntries(batch, payload, uid);

      writeAuditInBatch(batch, {
        adminUid: admin.uid,
        action: "adminCreateUser",
        targetUid: uid,
        metadata: {
          role: payload.role,
          restaurantId: payload.restaurantId || "",
        },
      });

      await batch.commit();

      logger.info("adminCreateUser.success", {
        adminUidHint: uidHint(admin.uid),
        targetUidHint: uidHint(uid),
        role: payload.role,
      });

      return publicUserRecord(uid, {
        role: payload.role,
        email: payload.email,
        authEmail: payload.authEmail,
        displayName: payload.displayName,
        phone: payload.phone,
        restaurantId: payload.restaurantId,
        restaurantName: payload.restaurantName,
        disabled: false,
      });
    } catch (error) {
      if (userRecord?.uid) {
        await getAuth()
          .deleteUser(userRecord.uid)
          .catch(() => {});
      }

      logger.error("adminCreateUser.failure", {
        adminUidHint: uidHint(admin.uid),
        role: payload.role,
        code: error?.code || "",
        message: error?.message || "Unknown error",
      });

      if (error instanceof HttpsError) throw error;
      throw new HttpsError("internal", "Could not create user safely.");
    }
  })
);

exports.adminUpdateUserRole = onCall({ region: "us-central1" }, async (request) =>
  observeCallable("adminUpdateUserRole", request, async () => {
    const adminUid = request.auth?.uid;
    const admin = await assertSuperAdmin(adminUid);
    assertRecentAuth(request, "changing user roles");
    await enforceAdminRateLimit(admin.uid, "updateRole");
    assert(isPlainObject(request.data), "invalid-argument", "Request payload must be an object.");

    const targetUid = normalizeId(request.data.targetUid, "targetUid");
    assert(
      targetUid !== admin.uid,
      "failed-precondition",
      "Super admins cannot change their own role."
    );

    const payload = normalizeAdminUserPayload(request.data, { requirePassword: false });
    const userRef = db.collection("users").doc(targetUid);
    const currentUser = await readManagedUser(targetUid);
    assert(currentUser, "not-found", "User profile not found.");
    assert(
      currentUser.role !== "superAdmin",
      "failed-precondition",
      "Super admin accounts must be managed out of band."
    );
    if (payload.role === "clicker") {
      await assertClickerIndexAvailable(payload, targetUid);
    }

    const nextAuthEmail = payload.authEmail || currentUser.authEmail || currentUser.email || "";
    if (nextAuthEmail && nextAuthEmail !== currentUser.authEmail) {
      await getAuth()
        .updateUser(targetUid, {
          email: nextAuthEmail,
          displayName: payload.displayName,
        })
        .catch((error) => {
          logger.error("adminUpdateUserRole.authFailure", {
            adminUidHint: uidHint(admin.uid),
            targetUidHint: uidHint(targetUid),
            code: error?.code || "",
          });
          throw new HttpsError("failed-precondition", "Could not update Firebase Auth user.");
        });
    } else {
      await getAuth()
        .updateUser(targetUid, { displayName: payload.displayName })
        .catch(() => {});
    }

    const batch = db.batch();
    const now = FieldValue.serverTimestamp();
    batch.set(
      userRef,
      {
        authUid: targetUid,
        role: payload.role,
        email: payload.email || currentUser.email || "",
        authEmail: nextAuthEmail,
        displayName: payload.displayName,
        phone: payload.phone || "",
        restaurantId: payload.restaurantId || "",
        restaurantName: payload.restaurantName || "",
        disabled: false,
        updatedBy: admin.uid,
        updatedAt: now,
      },
      { merge: true }
    );

    batch.set(
      db.collection("userAuthIndex").doc(targetUid),
      {
        role: payload.role,
        authEmail: nextAuthEmail,
        updatedBy: admin.uid,
        updatedAt: now,
      },
      { merge: true }
    );

    for (const [role, collectionName] of Object.entries(ROLE_PROFILE_COLLECTIONS)) {
      const ref = db.collection(collectionName).doc(targetUid);
      if (role === payload.role) {
        const previousSnap = await ref.get();
        batch.set(ref, buildRoleProfile(role, targetUid, payload, previousSnap.data() || {}), {
          merge: true,
        });
      } else {
        batch.delete(ref);
      }
    }
    writeClickerIndexEntries(batch, payload, targetUid);

    writeAuditInBatch(batch, {
      adminUid: admin.uid,
      action: "adminUpdateUserRole",
      targetUid,
      metadata: {
        fromRole: currentUser.role || "",
        toRole: payload.role,
        restaurantId: payload.restaurantId || "",
      },
    });

    await batch.commit();

    logger.info("adminUpdateUserRole.success", {
      adminUidHint: uidHint(admin.uid),
      targetUidHint: uidHint(targetUid),
      fromRole: currentUser.role || "",
      toRole: payload.role,
    });

    return publicUserRecord(targetUid, {
      ...currentUser,
      ...payload,
      authEmail: nextAuthEmail,
      role: payload.role,
      disabled: false,
    });
  })
);

exports.adminDeleteUser = onCall({ region: "us-central1" }, async (request) =>
  observeCallable("adminDeleteUser", request, async () => {
    const adminUid = request.auth?.uid;
    const admin = await assertSuperAdmin(adminUid);
    assertRecentAuth(request, "deleting users");
    await enforceAdminRateLimit(admin.uid, "deleteUser");
    assert(isPlainObject(request.data), "invalid-argument", "Request payload must be an object.");

    const targetUid = normalizeId(request.data.targetUid, "targetUid");
    assert(
      targetUid !== admin.uid,
      "failed-precondition",
      "Super admins cannot delete their own account."
    );

    const userRef = db.collection("users").doc(targetUid);
    const targetUser = await readManagedUser(targetUid);
    assert(targetUser, "not-found", "User profile not found.");
    assert(
      targetUser.role !== "superAdmin",
      "failed-precondition",
      "Super admin accounts must be managed out of band."
    );

    await getAuth()
      .deleteUser(targetUid)
      .catch((error) => {
        if (error?.code !== "auth/user-not-found") {
          logger.error("adminDeleteUser.authFailure", {
            adminUidHint: uidHint(admin.uid),
            targetUidHint: uidHint(targetUid),
            code: error?.code || "",
          });
          throw new HttpsError("failed-precondition", "Could not delete Firebase Auth user.");
        }
      });

    const batch = db.batch();
    batch.delete(userRef);
    batch.delete(db.collection("userAuthIndex").doc(targetUid));
    batch.delete(db.collection("clickers").doc(targetUid));
    batch.delete(db.collection("cashiers").doc(targetUid));
    batch.delete(db.collection("managers").doc(targetUid));
    batch.set(db.collection("deletedUsers").doc(targetUid), {
      authUid: targetUid,
      deletedBy: admin.uid,
      previousRole: targetUser.role || "",
      email: targetUser.email || "",
      restaurantId: targetUser.restaurantId || "",
      deletedAt: FieldValue.serverTimestamp(),
    });

    writeAuditInBatch(batch, {
      adminUid: admin.uid,
      action: "adminDeleteUser",
      targetUid,
      metadata: {
        role: targetUser.role || "",
        restaurantId: targetUser.restaurantId || "",
      },
    });

    await batch.commit();

    logger.info("adminDeleteUser.success", {
      adminUidHint: uidHint(admin.uid),
      targetUidHint: uidHint(targetUid),
      role: targetUser.role || "",
    });

    return { deleted: true, targetUid };
  })
);

exports.adminListUsers = onCall({ region: "us-central1" }, async (request) =>
  observeCallable("adminListUsers", request, async () => {
    const adminUid = request.auth?.uid;
    const admin = await assertSuperAdmin(adminUid);
    await enforceAdminRateLimit(admin.uid, "listUsers");
    const limitCount = normalizeAdminLimit(request.data?.limit, ADMIN_LIST_LIMIT);

    const managedUsers = new Map();
    const usersSnapshot = await db
      .collection("users")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();

    usersSnapshot.docs.forEach((doc) => {
      managedUsers.set(doc.id, publicUserRecord(doc.id, doc.data()));
    });

    const [clickersSnap, cashiersSnap, managersSnap] = await Promise.all([
      db.collection("clickers").limit(limitCount).get(),
      db.collection("cashiers").limit(limitCount).get(),
      db.collection("managers").limit(limitCount).get(),
    ]);

    clickersSnap.docs.forEach((doc) => {
      if (managedUsers.has(doc.id)) return;
      const data = doc.data() || {};
      managedUsers.set(
        doc.id,
        publicUserRecord(doc.id, {
          role: "clicker",
          displayName: data.fullName || data.displayName || "",
          email: data.email || "",
          phone: data.phone || "",
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        })
      );
    });

    cashiersSnap.docs.forEach((doc) => {
      if (managedUsers.has(doc.id)) return;
      const data = doc.data() || {};
      managedUsers.set(
        doc.id,
        publicUserRecord(doc.id, {
          role: "cashier",
          displayName: data.displayName || "",
          phone: data.phone || "",
          restaurantId: data.restaurantId || "",
          restaurantName: data.restaurantName || "",
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        })
      );
    });

    managersSnap.docs.forEach((doc) => {
      if (managedUsers.has(doc.id)) return;
      const data = doc.data() || {};
      managedUsers.set(
        doc.id,
        publicUserRecord(doc.id, {
          role: "manager",
          displayName: data.displayName || "",
          phone: data.phone || "",
          restaurantId: data.restaurantId || "",
          restaurantName: data.restaurantName || "",
          createdAt: data.createdAt || null,
          updatedAt: data.updatedAt || null,
        })
      );
    });

    const users = [...managedUsers.values()]
      .sort((a, b) => createdAtMillis(b) - createdAtMillis(a))
      .slice(0, limitCount);

    return {
      users,
    };
  })
);

exports.adminGetAuditLogs = onCall({ region: "us-central1" }, async (request) =>
  observeCallable("adminGetAuditLogs", request, async () => {
    const adminUid = request.auth?.uid;
    const admin = await assertSuperAdmin(adminUid);
    await enforceAdminRateLimit(admin.uid, "getAuditLogs");
    const limitCount = normalizeAdminLimit(request.data?.limit, ADMIN_AUDIT_LIMIT);

    const snapshot = await db
      .collection("auditLogs")
      .orderBy("createdAt", "desc")
      .limit(limitCount)
      .get();

    return {
      logs: snapshot.docs.map((doc) => publicAuditRecord(doc.id, doc.data())),
    };
  })
);
