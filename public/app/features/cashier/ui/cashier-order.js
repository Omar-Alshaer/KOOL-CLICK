import {
  collectOrderByCashier,
  getCashierOrders,
  updateOrderProgress,
} from "../services/cashier-service.js";
import {
  guardCashierPage,
  mountCashierHeader,
  renderCashierMiniProfile,
} from "./cashier-common.js";
import { showErrorPopup, showSuccessPopup } from "../../../core/utils/popup.js";
import { withButtonLoading } from "../../../core/utils/loading.js";
import { APP_CONFIG } from "../../../config/app-config.js";
import { escapeHtml, safeClass, sanitizeUrl } from "../../../core/utils/dom.js";

let currentState = null;
let currentOrders = [];
let selectedOrderId = "";
let refreshIntervalId = null;
let isLoadingOrders = false;

function formatOrderId(id) {
  return `KC-${String(id).slice(0, 8).toUpperCase()}`;
}

function formatMoney(value) {
  return `${Number(value || 0).toFixed(2)} EGP`;
}

function formatTimestamp(value) {
  if (!value) return "N/A";
  let dateObj = null;

  if (typeof value?.toDate === "function") {
    dateObj = value.toDate();
  } else if (typeof value?.seconds === "number") {
    dateObj = new Date(value.seconds * 1000);
  } else if (value instanceof Date) {
    dateObj = value;
  }

  if (!dateObj || Number.isNaN(dateObj.getTime())) return "N/A";
  return dateObj.toLocaleString("en-GB");
}

function safeStatusLabel(status) {
  return safeClass(status, APP_CONFIG.orderStatuses, APP_CONFIG.orderStatuses[0]);
}

function parseSearchOrderId(raw) {
  return String(raw || "")
    .trim()
    .replace(/^KC-/i, "")
    .toLowerCase();
}

function getOrderFinalTotal(order) {
  if (typeof order.finalTotal === "number") return order.finalTotal;
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discountAmount || 0);
  return Math.max(0, subtotal - discount);
}

function renderEtaOptions(currentValue) {
  const presets = [0, 5, 10, 15, 20, 25, 30, 40, 50, 60];
  const current = Number(currentValue || 0);
  const options = new Set(presets);
  options.add(current);

  return [...options]
    .sort((a, b) => a - b)
    .map((minutes) => {
      const label = minutes === 0 ? "Ready now" : `${minutes} min`;
      return `<option value="${minutes}" ${minutes === current ? "selected" : ""}>${label}</option>`;
    })
    .join("");
}

function findOrderByAnyId(rawValue) {
  const normalized = parseSearchOrderId(rawValue);
  return (
    currentOrders.find((order) => {
      const id = String(order.id || "").toLowerCase();
      const qr = String(order.qrPayload || "").toLowerCase();
      return id === normalized || qr === normalized || qr === String(rawValue || "").toLowerCase();
    }) || null
  );
}

function chooseDefaultOrderId() {
  const fromQuery = parseSearchOrderId(new URLSearchParams(window.location.search).get("id") || "");
  if (fromQuery) {
    const found = currentOrders.find((order) => String(order.id).toLowerCase() === fromQuery);
    if (found) return found.id;
  }

  if (selectedOrderId && currentOrders.some((order) => order.id === selectedOrderId)) {
    return selectedOrderId;
  }

  const active = currentOrders.find((order) => order.status !== "Collected");
  if (active) return active.id;

  return currentOrders[0]?.id || "";
}

function syncPicker() {
  const picker = document.getElementById("orderPicker");
  if (!picker) return;

  if (!currentOrders.length) {
    picker.innerHTML = '<option value="">No orders available</option>';
    picker.disabled = true;
    return;
  }

  picker.disabled = false;
  picker.innerHTML = currentOrders
    .map((order) => {
      const finalTotal = getOrderFinalTotal(order);
      const safeClickerName = escapeHtml(order.clickerName || "Clicker");
      const statusLabel = safeStatusLabel(order.status);
      return `<option value="${order.id}">${formatOrderId(order.id)} | ${safeClickerName} | ${formatMoney(finalTotal)} | ${statusLabel} | ${formatTimestamp(order.createdAt)}</option>`;
    })
    .join("");

  if (!selectedOrderId || !currentOrders.some((order) => order.id === selectedOrderId)) {
    selectedOrderId = chooseDefaultOrderId();
  }

  picker.value = selectedOrderId;
}

function updateUrlWithOrderId(orderId) {
  const url = new URL(window.location.href);
  if (!orderId) {
    url.searchParams.delete("id");
  } else {
    url.searchParams.set("id", orderId);
  }
  window.history.replaceState({}, "", url);
}

function renderSelectedOrder() {
  const root = document.getElementById("orderRoot");
  if (!root) return;

  if (!currentOrders.length) {
    root.innerHTML = '<div class="kc-note">No orders found for this restaurant.</div>';
    return;
  }

  const order = currentOrders.find((x) => x.id === selectedOrderId) || null;
  if (!order) {
    root.innerHTML = '<div class="kc-note">Please choose an order from the list.</div>';
    return;
  }

  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discountAmount || 0);
  const finalTotal = getOrderFinalTotal(order);

  const statusLabel = safeStatusLabel(order.status);
  const safeClickerName = escapeHtml(order.clickerName || "N/A");
  const safeClickerPhone = escapeHtml(order.clickerPhone || "N/A");
  const safePaymentStatus = escapeHtml(order.paymentStatus || "N/A");
  const safePaymentMethod = escapeHtml(order.paymentMethod || "N/A");
  const safeReceiptUrl = sanitizeUrl(order.receiptImageUrl);

  root.innerHTML = `
    <article class="kc-card">
      <div class="kc-inline kc-inline-between">
        <div class="kc-order-id-wrap">
          <strong>Order ID</strong>
          <span class="kc-order-id-tag">${formatOrderId(order.id)}</span>
        </div>
        <span class="kc-status ${statusLabel}">${statusLabel}</span>
      </div>

      <div class="kc-order-layout kc-order-layout-stack kc-section-spaced-lg">
        <div class="kc-item kc-order-info">
          <div><strong>Clicker:</strong> ${safeClickerName}</div>
          <div class="kc-muted">Phone: ${safeClickerPhone}</div>
          <div class="kc-muted">Method: ${safePaymentMethod}</div>
          <div class="kc-muted">Payment: ${safePaymentStatus}</div>
          <div class="kc-muted">Ordered At: ${formatTimestamp(order.createdAt)}</div>
          <div class="kc-muted">Last Update: ${formatTimestamp(order.updatedAt)}</div>
          ${order.collectedAt ? `<div class="kc-muted">Collected At: ${formatTimestamp(order.collectedAt)}</div>` : ""}
          <div class="kc-muted">Points: ${order.pointsEarned || 0} ${order.pointsGranted ? "(granted)" : "(pending)"}</div>

          <div class="kc-checkout-totals kc-section-spaced-xs">
            <div><strong>Subtotal:</strong> ${formatMoney(subtotal)}</div>
            <div><strong>Discount:</strong> ${formatMoney(discount)}</div>
            <div><strong>Total:</strong> ${formatMoney(finalTotal)}</div>
          </div>

          ${
            safeReceiptUrl
              ? `
            <div class="kc-receipt-preview kc-section-spaced-lg">
              <div><strong>InstaPay Receipt</strong></div>
              <a class="kc-btn-secondary" href="${safeReceiptUrl}" target="_blank" rel="noopener noreferrer">Open Receipt</a>
              <img src="${safeReceiptUrl}" alt="Receipt for ${formatOrderId(order.id)}" />
            </div>
          `
              : ""
          }
        </div>

        <div class="kc-item kc-order-control-wrap">
          <div class="kc-order-controls">
            <div class="kc-order-control-head">Order Controls</div>

            <div class="kc-order-control-grid">
              <div class="kc-order-control-field">
                <label for="orderStatus">Status</label>
                <select id="orderStatus" class="kc-cashier-field">
                  <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
                  <option value="Preparing" ${order.status === "Preparing" ? "selected" : ""}>Preparing</option>
                  <option value="Ready" ${order.status === "Ready" ? "selected" : ""}>Ready</option>
                </select>
              </div>

              <div class="kc-order-control-field">
                <label for="orderEta">Remaining Time (minutes)</label>
                <select id="orderEta" class="kc-cashier-field">
                  ${renderEtaOptions(order.remainingTimeMinutes)}
                </select>
              </div>
            </div>

            <div class="kc-order-action-grid">
              <button type="button" id="orderSaveBtn" class="kc-order-btn-save">Save Progress</button>
              <button type="button" id="orderCollectBtn" class="kc-btn-danger kc-order-btn-collect">Mark Collected</button>
            </div>
          </div>
        </div>
      </div>

      <div class="kc-list kc-section-spaced-xl">
        ${(order.items || [])
          .map(
            (item) =>
              `<div class="kc-item">${escapeHtml(item.name || "")} x${item.qty} - ${formatMoney(item.price * item.qty)}</div>`
          )
          .join("")}
      </div>
    </article>
  `;

  document.getElementById("orderSaveBtn")?.addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    await withButtonLoading(
      btn,
      async () => {
        try {
          await updateOrderProgress({
            orderId: order.id,
            status: document.getElementById("orderStatus")?.value,
            remainingTimeMinutes: Number(document.getElementById("orderEta")?.value || 0),
            cashierRestaurantId: currentState.profile.restaurantId,
          });
          await showSuccessPopup("Order progress updated.", "Saved");
          await loadOrders();
        } catch (error) {
          await showErrorPopup(error.message || "Failed to update order.", "Save Failed");
        }
      },
      "Saving..."
    );
  });

  document.getElementById("orderCollectBtn")?.addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    await withButtonLoading(
      btn,
      async () => {
        try {
          const result = await collectOrderByCashier({
            orderId: order.id,
            cashierRestaurantId: currentState.profile.restaurantId,
          });
          const pointsNote =
            result.pointsAdded > 0 ? ` ${result.pointsAdded} points added to clicker.` : "";
          await showSuccessPopup(`Order marked as collected.${pointsNote}`, "Collected");
          await loadOrders();
        } catch (error) {
          await showErrorPopup(error.message || "Failed to collect order.", "Collect Failed");
        }
      },
      "Collecting..."
    );
  });
}

async function loadOrders() {
  if (!currentState?.profile?.restaurantId || isLoadingOrders) return;
  isLoadingOrders = true;

  try {
    currentOrders = await getCashierOrders(currentState.profile.restaurantId);
    selectedOrderId = chooseDefaultOrderId();
    syncPicker();
    updateUrlWithOrderId(selectedOrderId);
    renderSelectedOrder();
  } catch (error) {
    await showErrorPopup(error.message || "Could not load orders.", "Orders Error");
  } finally {
    isLoadingOrders = false;
  }
}

function startRefreshLoop() {
  if (refreshIntervalId) return;
  refreshIntervalId = window.setInterval(() => {
    if (document.visibilityState === "visible") {
      loadOrders();
    }
  }, 20000);
}

function stopRefreshLoop() {
  if (!refreshIntervalId) return;
  clearInterval(refreshIntervalId);
  refreshIntervalId = null;
}

function wireUi() {
  document.getElementById("orderPicker")?.addEventListener("change", (event) => {
    selectedOrderId = event.target.value;
    updateUrlWithOrderId(selectedOrderId);
    renderSelectedOrder();
  });

  document.getElementById("orderRefreshBtn")?.addEventListener("click", async () => {
    await loadOrders();
  });

  document.getElementById("orderSearchBtn")?.addEventListener("click", async () => {
    const raw = document.getElementById("orderSearchInput")?.value || "";
    if (!raw.trim()) return;

    const found = findOrderByAnyId(raw);
    if (!found) {
      await showErrorPopup("Order not found in this restaurant.", "Search Result");
      return;
    }

    selectedOrderId = found.id;
    syncPicker();
    updateUrlWithOrderId(selectedOrderId);
    renderSelectedOrder();
  });
}

async function init() {
  mountCashierHeader({ active: "order" });
  currentState = await guardCashierPage();
  if (!currentState) return;

  renderCashierMiniProfile("cashierMini", currentState.profile);
  wireUi();
  await loadOrders();
  startRefreshLoop();
}

init();

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible") {
    loadOrders();
    startRefreshLoop();
  } else {
    stopRefreshLoop();
  }
});

window.addEventListener("beforeunload", () => {
  stopRefreshLoop();
});
