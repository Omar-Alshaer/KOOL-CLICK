import { guardManagerPage, mountManagerHeader, renderManagerMiniProfile } from "./manager-common.js";
import { db, collection, query, where, orderBy, limit, onSnapshot } from "./config/firebase.js";
import { escapeHtml } from "./utils/dom.js";
import { logError, logWarn } from "./utils/logger.js";

let unsubscribeOrders = null;

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

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} EGP`;
}

function summarizeOrders(orders) {
  const summary = {
    totalOrders: orders.length,
    collectedOrders: 0,
    pendingOrders: 0,
    preparingOrders: 0,
    readyOrders: 0,
    totalRevenue: 0,
    itemsSold: 0,
  };

  orders.forEach((order) => {
    const status = order.status || "Pending";
    if (status === "Collected") {
      summary.collectedOrders += 1;
      summary.totalRevenue += getOrderFinalTotal(order);
    } else if (status === "Preparing") {
      summary.preparingOrders += 1;
    } else if (status === "Ready") {
      summary.readyOrders += 1;
    } else {
      summary.pendingOrders += 1;
    }

    if (Array.isArray(order.items)) {
      order.items.forEach((item) => {
        summary.itemsSold += Number(item.qty || 0);
      });
    }
  });

  return summary;
}

function renderSummary(summary) {
  document.getElementById("mgrTotalOrders").textContent = summary.totalOrders;
  document.getElementById("mgrCollectedOrders").textContent = summary.collectedOrders;
  document.getElementById("mgrPendingOrders").textContent = summary.pendingOrders;
  document.getElementById("mgrPreparingOrders").textContent = summary.preparingOrders;
  document.getElementById("mgrReadyOrders").textContent = summary.readyOrders;
  document.getElementById("mgrRevenue").textContent = formatMoney(summary.totalRevenue);
  document.getElementById("mgrItemsSold").textContent = summary.itemsSold;
}

function renderTopItems(orders) {
  const tally = new Map();
  orders.forEach((order) => {
    if (!Array.isArray(order.items)) return;
    order.items.forEach((item) => {
      const key = item.name || "Item";
      tally.set(key, (tally.get(key) || 0) + Number(item.qty || 0));
    });
  });

  const top = [...tally.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  const list = document.getElementById("mgrTopItems");
  if (!list) return;

  if (!top.length) {
    list.innerHTML = `<div class="kc-note">No sales data yet.</div>`;
    return;
  }

  list.innerHTML = top
    .map(([name, qty]) => `<div class="kc-chip">${escapeHtml(name)}: ${qty}</div>`)
    .join("");
}

function renderDashboard(orders) {
  const summary = summarizeOrders(orders);
  renderSummary(summary);
  renderTopItems(orders);
}

function subscribeOrders(restaurantId) {
  if (unsubscribeOrders) {
    unsubscribeOrders();
    unsubscribeOrders = null;
  }

  const base = [where("restaurantId", "==", restaurantId)];
  try {
    const q = query(
      collection(db, "orders"),
      ...base,
      orderBy("createdAt", "desc"),
      limit(200)
    );

    unsubscribeOrders = onSnapshot(
      q,
      (snapshot) => {
        const orders = snapshot.docs.map((d) =>
          normalizeOrderTimestamps({ id: d.id, ...d.data() })
        );
        renderDashboard(orders);
      },
      (error) => {
        if (error?.code === "failed-precondition") {
          logWarn("manager.dashboard.indexMissing", { restaurantId });
          subscribeOrdersFallback(restaurantId);
          return;
        }
        logError("manager.dashboard.listener.failed", error, { restaurantId });
      }
    );
  } catch (error) {
    if (error?.code === "failed-precondition") {
      logWarn("manager.dashboard.indexMissing", { restaurantId });
      subscribeOrdersFallback(restaurantId);
    } else {
      logError("manager.dashboard.listener.failed", error, { restaurantId });
    }
  }
}

function subscribeOrdersFallback(restaurantId) {
  if (unsubscribeOrders) {
    unsubscribeOrders();
    unsubscribeOrders = null;
  }

  const q = query(
    collection(db, "orders"),
    where("restaurantId", "==", restaurantId),
    limit(260)
  );

  unsubscribeOrders = onSnapshot(
    q,
    (snapshot) => {
      const orders = snapshot.docs
        .map((d) => normalizeOrderTimestamps({ id: d.id, ...d.data() }))
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
        .slice(0, 200);
      renderDashboard(orders);
    },
    (error) => {
      logError("manager.dashboard.fallback.failed", error, { restaurantId });
    }
  );
}

async function init() {
  mountManagerHeader({ active: "dashboard" });
  const state = await guardManagerPage();
  if (!state) return;

  renderManagerMiniProfile("managerMini", state.profile);

  subscribeOrders(state.profile.restaurantId);
}

init();

window.addEventListener("beforeunload", () => {
  if (unsubscribeOrders) {
    unsubscribeOrders();
    unsubscribeOrders = null;
  }
});
