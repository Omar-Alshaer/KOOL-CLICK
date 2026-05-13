import { guardManagerPage, mountManagerHeader, renderManagerMiniProfile } from "./manager-common.js";
import { db, collection, query, where, orderBy, limit, getDocs } from "../../../config/firebase.js";
import { escapeHtml } from "../../../core/utils/dom.js";
import { logError, logInfo, logWarn } from "../../../core/utils/logger.js";

let currentRestaurantId = "";
let isLoadingReport = false;

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} EGP`;
}

function normalizeOrderTimestamps(order) {
  const createdAt = order.createdAt || order.updatedAt || null;
  const updatedAt = order.updatedAt || order.createdAt || null;
  const collectedAt = order.collectedAt || null;

  return {
    ...order,
    createdAt,
    updatedAt,
    collectedAt,
  };
}

function getOrderFinalTotal(order) {
  if (typeof order.finalTotal === "number") return order.finalTotal;
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discountAmount || 0);
  return Math.max(0, subtotal - discount);
}

function buildReport(orders) {
  const report = {
    totalOrders: orders.length,
    collected: 0,
    cancelled: 0,
    pending: 0,
    preparing: 0,
    ready: 0,
    cashOrders: 0,
    instaOrders: 0,
    revenue: 0,
    avgOrderValue: 0,
    itemsSold: 0,
    uniqueClickers: 0,
    topItems: [],
  };

  const clickers = new Set();
  const itemTally = new Map();

  orders.forEach((order) => {
    if (order.status === "Collected") {
      report.collected += 1;
      report.revenue += getOrderFinalTotal(order);
    } else if (order.status === "Cancelled") {
      report.cancelled += 1;
    } else if (order.status === "Preparing") {
      report.preparing += 1;
    } else if (order.status === "Ready") {
      report.ready += 1;
    } else {
      report.pending += 1;
    }

    if (order.paymentMethod === "InstaPay") {
      report.instaOrders += 1;
    } else {
      report.cashOrders += 1;
    }

    if (order.clickerUid) clickers.add(order.clickerUid);
    if (Array.isArray(order.items)) {
      order.items.forEach((item) => {
        report.itemsSold += Number(item.qty || 0);
        const key = item.name || "Item";
        itemTally.set(key, (itemTally.get(key) || 0) + Number(item.qty || 0));
      });
    }
  });

  report.uniqueClickers = clickers.size;
  report.avgOrderValue = report.collected ? report.revenue / report.collected : 0;
  report.topItems = [...itemTally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  return report;
}

function renderTopItems(items) {
  const host = document.getElementById("reportTopItems");
  if (!host) return;
  if (!items.length) {
    host.innerHTML = `<div class="kc-note">No items yet.</div>`;
    return;
  }
  host.innerHTML = items
    .map(([name, qty]) => `<div class="kc-chip">${escapeHtml(name)}: ${qty}</div>`)
    .join("");
}

function renderReport(report) {
  document.getElementById("reportTotalOrders").textContent = report.totalOrders;
  document.getElementById("reportCollected").textContent = report.collected;
  document.getElementById("reportCancelled").textContent = report.cancelled;
  document.getElementById("reportRevenue").textContent = formatMoney(report.revenue);
  document.getElementById("reportPending").textContent = report.pending;
  document.getElementById("reportPreparing").textContent = report.preparing;
  document.getElementById("reportReady").textContent = report.ready;
  document.getElementById("reportCashOrders").textContent = report.cashOrders;
  document.getElementById("reportInstaOrders").textContent = report.instaOrders;
  document.getElementById("reportAvgOrder").textContent = formatMoney(report.avgOrderValue);
  document.getElementById("reportItemsSold").textContent = report.itemsSold;
  document.getElementById("reportUniqueClickers").textContent = report.uniqueClickers;
  renderTopItems(report.topItems);
}

async function loadReport(restaurantId) {
  if (!restaurantId || isLoadingReport) return;
  isLoadingReport = true;
  const startedAt = performance.now();
  try {
    const q = query(
      collection(db, "orders"),
      where("restaurantId", "==", restaurantId),
      orderBy("createdAt", "desc"),
      limit(320)
    );
    const snapshot = await getDocs(q);
    const orders = snapshot.docs.map((d) =>
      normalizeOrderTimestamps({ id: d.id, ...d.data() })
    );
    renderReport(buildReport(orders));
    logInfo("manager.reports.loaded", {
      restaurantId,
      count: orders.length,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    if (error?.code === "failed-precondition") {
      logWarn("manager.reports.indexMissing", { restaurantId });
      await loadReportFallback(restaurantId, startedAt);
    } else {
      logError("manager.reports.load.failed", error, { restaurantId });
    }
  } finally {
    isLoadingReport = false;
  }
}

async function loadReportFallback(restaurantId, startedAt = performance.now()) {
  const q = query(
    collection(db, "orders"),
    where("restaurantId", "==", restaurantId),
    limit(360)
  );

  try {
    const snapshot = await getDocs(q);
    const orders = snapshot.docs
      .map((d) => normalizeOrderTimestamps({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
      .slice(0, 320);
    renderReport(buildReport(orders));
    logInfo("manager.reports.fallbackLoaded", {
      restaurantId,
      count: orders.length,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    logError("manager.reports.fallback.failed", error, { restaurantId });
  }
}

async function init() {
  mountManagerHeader({ active: "reports" });
  const state = await guardManagerPage();
  if (!state) return;
  renderManagerMiniProfile("managerMini", state.profile);
  currentRestaurantId = state.profile.restaurantId;

  await loadReport(currentRestaurantId);
}

init();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && currentRestaurantId) {
    loadReport(currentRestaurantId);
  }
});
