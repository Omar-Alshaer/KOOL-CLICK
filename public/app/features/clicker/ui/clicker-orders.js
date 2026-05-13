import { guardClickerPage, mountHeader, renderClickerMiniProfile } from "./clicker-common.js";
import { cancelClickerOrder, canClickerCancelOrder, getClickerOrders } from "../services/order-service.js";
import { APP_CONFIG } from "../../../config/app-config.js";
import { applyPointsDeltaToProfileCache } from "../services/auth-service.js";
import { showConfirmPopup, showErrorPopup, showSuccessPopup } from "../../../core/utils/popup.js";
import QRCode from "https://esm.sh/qrcode@1.5.4";
import { withButtonLoading } from "../../../core/utils/loading.js";
import { escapeHtml, safeClass } from "../../../core/utils/dom.js";

function formatOrderId(id) {
  return `KC-${String(id).slice(0, 8).toUpperCase()}`;
}

function finalTotal(order) {
  return order.finalTotal ?? order.subtotal ?? 0;
}

function safeStatusLabel(status) {
  return safeClass(status, APP_CONFIG.orderStatuses, APP_CONFIG.orderStatuses[0]);
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

async function buildQrDataUrl(payload) {
  try {
    return await QRCode.toDataURL(payload, {
      width: 140,
      margin: 1,
      color: {
        dark: "#3B0270",
        light: "#FFF1F1",
      },
    });
  } catch {
    return "";
  }
}

async function renderOrders(orders) {
  const root = document.getElementById("ordersRoot");

  if (!orders.length) {
    root.innerHTML = `
      <div class="kc-empty-state">
        <div class="kc-empty-icon">📦</div>
        <h3 class="kc-empty-title">No orders yet</h3>
        <p class="kc-empty-msg">Place your first order and start earning points!</p>
        <a class="kc-btn" href="./menu.html">Order Now</a>
      </div>
    `;
    return;
  }

  const qrUrls = await Promise.all(
    orders.map((order) => buildQrDataUrl(order.qrPayload || order.id))
  );

  root.innerHTML = orders
    .map((order, idx) => {
      const statusLabel = safeStatusLabel(order.status);
      const safeRestaurant = escapeHtml(order.restaurantName || order.restaurantId || "");
      const safePaymentStatus = escapeHtml(order.paymentStatus || "N/A");
      const safePaymentMethod = escapeHtml(order.paymentMethod || "N/A");
      const safePromo = escapeHtml(order.promoCode || "");
      const safeOrderId = escapeHtml(order.orderNumber || formatOrderId(order.id));
      return `
      <article class="kc-card">
        <div class="kc-inline kc-inline-between">
          <div class="kc-order-id-wrap">
            <strong>Order ID</strong>
            <span class="kc-order-id-tag">${safeOrderId}</span>
          </div>
          <span class="kc-status ${statusLabel}">${statusLabel}</span>
        </div>
        <div class="kc-order-top">
          <div>
            <div class="kc-muted kc-summary-top">Restaurant: ${safeRestaurant}</div>
            <div class="kc-muted">Remaining time: ${order.remainingTimeMinutes ?? "--"} mins</div>
            <div class="kc-muted">Payment: ${safePaymentStatus}</div>
            <div class="kc-muted">Method: ${safePaymentMethod}</div>
            <div class="kc-muted">Ordered At: ${formatTimestamp(order.createdAt)}</div>
            <div class="kc-muted">Last Update: ${formatTimestamp(order.updatedAt)}</div>
            ${safePromo ? `<div class="kc-muted">Promo: ${safePromo} (-${order.discountAmount || 0} EGP)</div>` : ""}
            <div class="kc-muted">Subtotal: ${order.subtotal ?? 0} EGP | Final: ${finalTotal(order)} EGP</div>
          </div>
          <div class="kc-order-qr-box">
            ${qrUrls[idx] ? `<img class="kc-order-qr" src="${qrUrls[idx]}" alt="QR for order ${order.id}" />` : '<div class="kc-muted">QR unavailable</div>'}
            <div class="kc-muted">Scan at cashier</div>
          </div>
        </div>
        <div class="kc-inline kc-inline-between kc-section-spaced-xs">
          <div class="kc-muted">Points: ${order.pointsEarned || 0} ${order.pointsGranted ? "(granted)" : "(after collection)"}</div>
        </div>
        <div class="kc-list kc-section-spaced-xl">
          ${order.items
            .map(
              (item) => {
                const safeName = escapeHtml(item.name || "");
                const safeOfferTitle = escapeHtml(item.offerTitle || "Special Offer");
                const safeOfferLabel = escapeHtml(item.offerLabel || "");
                return `
                <div class="kc-item">
                  <div><strong>${safeName}</strong> x${item.qty} - ${item.price * item.qty} EGP</div>
                  ${
                    item.offerId
                      ? `
                        <div class="kc-offer-inline">
                          <span class="kc-badge kc-badge-offer">Offer</span>
                          <span class="kc-muted">${safeOfferTitle}</span>
                          ${safeOfferLabel ? `<span class="kc-badge kc-badge-discount">${safeOfferLabel}</span>` : ""}
                        </div>
                      `
                      : ""
                  }
                  ${
                    item.basePrice && Number(item.basePrice) > Number(item.price)
                      ? `<div class="kc-muted">Old price: ${Number(item.basePrice).toFixed(2)} EGP</div>`
                      : ""
                  }
                </div>
              `
              ;})
            .join("")}
        </div>
        ${
        canClickerCancelOrder(order)
            ? `<div class="kc-order-footer"><button type="button" class="kc-btn-danger kc-order-cancel-btn" data-cancel-order="${order.id}">Cancel Order</button></div>`
            : ""
        }
      </article>
    `
      ;})
    .join("");
}

async function loadAndRender(state) {
  const orders = await getClickerOrders(state.uid);
  await renderOrders(orders);

  document.querySelectorAll("button[data-cancel-order]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const orderId = btn.dataset.cancelOrder;

      const ok = await showConfirmPopup(
        `If you cancel this order, ${APP_CONFIG.points.cancellationPenaltyPoints} points will be deducted. Continue?`,
        "Cancel Order",
        "Yes, Cancel",
        "Keep Order",
        { dangerous: true }
      );
      if (!ok) return;

      await withButtonLoading(btn, async () => {
        try {
          const result = await cancelClickerOrder({
            orderId,
            uid: state.uid,
          });
          applyPointsDeltaToProfileCache(state.uid, -result.totalDeducted);
          await showSuccessPopup(
            `Order cancelled. ${result.totalDeducted} points deducted (${result.penalty} cancellation penalty).`,
            "Order Cancelled"
          );
          await loadAndRender(state);
        } catch (error) {
          await showErrorPopup(error.message || "Could not cancel order.", "Cancel Failed");
        }
      }, "Cancelling...");
    });
  });
}

async function init() {
  mountHeader({ active: "orders" });
  const state = await guardClickerPage();
  if (!state) return;

  renderClickerMiniProfile("clickerMini", state.profile);

  try {
    await loadAndRender(state);
  } catch (error) {
    const msg = escapeHtml(error.message || "Could not load orders.");
    document.getElementById("ordersRoot").innerHTML = `<div class="kc-note">${msg}</div>`;
    await showErrorPopup(error.message || "Could not load orders.", "Orders Unavailable");
  }
}

init();
