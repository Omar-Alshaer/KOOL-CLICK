import { getCashierCollectedOrders } from "./services/cashier-service.js";
import { guardCashierPage, mountCashierHeader, renderCashierMiniProfile } from "./cashier-common.js";
import { showErrorPopup } from "./utils/popup.js";

let currentState = null;
let completedOrders = [];

function formatOrderId(id) {
  return `KC-${String(id).slice(0, 8).toUpperCase()}`;
}

function finalTotal(order) {
  return order.finalTotal ?? order.subtotal ?? 0;
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

function renderCompleted(orders) {
  const root = document.getElementById("completedRoot");

  if (!orders.length) {
    root.innerHTML = '<div class="kc-note">No completed orders yet.</div>';
    return;
  }

  root.innerHTML = orders
    .map(
      (order) => `
      <article class="kc-card">
        <div class="kc-inline" style="justify-content: space-between">
          <div class="kc-order-id-wrap">
            <strong>Order ID</strong>
            <span class="kc-order-id-tag">${formatOrderId(order.id)}</span>
          </div>
          <span class="kc-status Collected">Collected</span>
        </div>

        <div class="kc-two" style="margin-top: 0.55rem">
          <div class="kc-item">
            <div><strong>Clicker:</strong> ${order.clickerName || "N/A"}</div>
            <div class="kc-muted">Phone: ${order.clickerPhone || "N/A"}</div>
            <div class="kc-muted">Payment: ${order.paymentStatus || "N/A"}</div>
            <div class="kc-muted">Ordered At: ${formatTimestamp(order.createdAt)}</div>
          </div>
          <div class="kc-item">
            <div class="kc-muted">Method: ${order.paymentMethod || "N/A"}</div>
            <div class="kc-muted">Final Total: ${finalTotal(order)} EGP</div>
            <div class="kc-muted">Collected At: ${formatTimestamp(order.collectedAt)}</div>
            <div class="kc-muted">Points: ${order.pointsEarned || 0} ${order.pointsGranted ? "(granted)" : "(pending)"}</div>
          </div>
        </div>

        <div class="kc-list" style="margin-top: 0.6rem">
          ${(order.items || [])
            .map((item) => `<div class="kc-item">${item.name} x${item.qty} - ${item.price * item.qty} EGP</div>`)
            .join("")}
        </div>
      </article>
    `
    )
    .join("");
}

function applyFilter() {
  const q = document.getElementById("completedSearch").value.trim().toLowerCase();
  let out = [...completedOrders];

  if (q) {
    out = out.filter((order) => {
      const idHit = order.id.toLowerCase().includes(q);
      const clickerHit = (order.clickerName || "").toLowerCase().includes(q);
      const phoneHit = (order.clickerPhone || "").toLowerCase().includes(q);
      return idHit || clickerHit || phoneHit;
    });
  }

  renderCompleted(out);
}

async function init() {
  mountCashierHeader({ active: "completed" });
  currentState = await guardCashierPage();
  if (!currentState) return;

  renderCashierMiniProfile("cashierMini", currentState.profile);

  try {
    completedOrders = await getCashierCollectedOrders(currentState.profile.restaurantId);
    applyFilter();
  } catch (error) {
    await showErrorPopup(error.message || "Could not load completed orders.", "Load Failed");
  }

  document.getElementById("completedSearch")?.addEventListener("input", applyFilter);
}

init();
