import { getCashierCollectedOrdersPage } from "../services/cashier-service.js";
import {
  guardCashierPage,
  mountCashierHeader,
  renderCashierMiniProfile,
} from "./cashier-common.js";
import { showErrorPopup } from "../../../core/utils/popup.js";
import { escapeHtml } from "../../../core/utils/dom.js";
import { logError, logInfo } from "../../../core/utils/logger.js";

let currentState = null;
let completedOrders = [];
let completedCursor = null;
let hasMoreCompleted = false;
let isLoadingCompleted = false;
const COMPLETED_PAGE_SIZE = 60;

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
    .map((order) => {
      const safeClickerName = escapeHtml(order.clickerName || "N/A");
      const safeClickerPhone = escapeHtml(order.clickerPhone || "N/A");
      const safePaymentStatus = escapeHtml(order.paymentStatus || "N/A");
      const safePaymentMethod = escapeHtml(order.paymentMethod || "N/A");
      return `
      <article class="kc-card">
        <div class="kc-inline kc-inline-between">
          <div class="kc-order-id-wrap">
            <strong>Order ID</strong>
            <span class="kc-order-id-tag">${formatOrderId(order.id)}</span>
          </div>
          <span class="kc-status Collected">Collected</span>
        </div>

        <div class="kc-two kc-section-spaced-xs">
          <div class="kc-item">
            <div><strong>Clicker:</strong> ${safeClickerName}</div>
            <div class="kc-muted">Phone: ${safeClickerPhone}</div>
            <div class="kc-muted">Payment: ${safePaymentStatus}</div>
            <div class="kc-muted">Ordered At: ${formatTimestamp(order.createdAt)}</div>
          </div>
          <div class="kc-item">
            <div class="kc-muted">Method: ${safePaymentMethod}</div>
            <div class="kc-muted">Final Total: ${finalTotal(order)} EGP</div>
            <div class="kc-muted">Collected At: ${formatTimestamp(order.collectedAt)}</div>
            <div class="kc-muted">Points: ${order.pointsEarned || 0} ${order.pointsGranted ? "(granted)" : "(pending)"}</div>
          </div>
        </div>

        <div class="kc-list kc-section-spaced-lg">
          ${(order.items || [])
            .map(
              (item) =>
                `<div class="kc-item">${escapeHtml(item.name || "")} x${item.qty} - ${item.price * item.qty} EGP</div>`
            )
            .join("")}
        </div>
      </article>
    `;
    })
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

  await loadCompletedPage({ reset: true });

  document.getElementById("completedSearch")?.addEventListener("input", applyFilter);
  window.addEventListener("scroll", handleCompletedScroll, { passive: true });
}

init();

async function loadCompletedPage({ reset = false } = {}) {
  if (!currentState?.profile?.restaurantId || isLoadingCompleted) return;
  isLoadingCompleted = true;
  const startedAt = performance.now();

  try {
    const page = await getCashierCollectedOrdersPage({
      restaurantId: currentState.profile.restaurantId,
      pageSize: COMPLETED_PAGE_SIZE,
      cursor: reset ? null : completedCursor,
    });

    completedOrders = reset ? page.orders : [...completedOrders, ...page.orders];
    completedCursor = page.nextCursor;
    hasMoreCompleted = page.hasMore;
    applyFilter();
    logInfo("cashier.completed.loaded", {
      count: page.orders.length,
      total: completedOrders.length,
      hasMore: hasMoreCompleted,
      durationMs: Math.round(performance.now() - startedAt),
    });
  } catch (error) {
    logError("cashier.completed.load.failed", error);
    await showErrorPopup(error.message || "Could not load completed orders.", "Load Failed");
  } finally {
    isLoadingCompleted = false;
  }
}

function handleCompletedScroll() {
  if (!hasMoreCompleted || isLoadingCompleted) return;
  const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
  if (nearBottom) {
    loadCompletedPage();
  }
}
