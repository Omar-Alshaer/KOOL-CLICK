import { guardStudentPage, mountHeader, renderStudentMiniProfile } from "./student-common.js";
import { cancelStudentOrder, canStudentCancelOrder, getStudentOrders } from "./services/order-service.js";
import { APP_CONFIG } from "./config/app-config.js";
import { applyPointsDeltaToProfileCache } from "./services/auth-service.js";
import { restaurants } from "./data/restaurants.js";
import { showConfirmPopup, showErrorPopup, showSuccessPopup } from "./utils/popup.js";
import QRCode from "https://esm.sh/qrcode@1.5.4";

function getRestaurantName(restaurantId) {
  return restaurants.find((r) => r.id === restaurantId)?.name || restaurantId;
}

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
    root.innerHTML = '<div class="kc-note">No orders yet.</div>';
    return;
  }

  const qrUrls = await Promise.all(
    orders.map((order) => buildQrDataUrl(order.qrPayload || order.id))
  );

  root.innerHTML = orders
    .map((order, idx) => `
      <article class="kc-card">
        <div class="kc-inline" style="justify-content: space-between">
          <div class="kc-order-id-wrap">
            <strong>Order ID</strong>
            <span class="kc-order-id-tag">${formatOrderId(order.id)}</span>
          </div>
          <span class="kc-status ${order.status}">${order.status}</span>
        </div>
        <div class="kc-order-top">
          <div>
            <div class="kc-muted" style="margin: 0.5rem 0">Restaurant: ${getRestaurantName(order.restaurantId)}</div>
            <div class="kc-muted">Remaining time: ${order.remainingTimeMinutes ?? "--"} mins</div>
            <div class="kc-muted">Payment: ${order.paymentStatus}</div>
            <div class="kc-muted">Method: ${order.paymentMethod || "N/A"}</div>
            <div class="kc-muted">Ordered At: ${formatTimestamp(order.createdAt)}</div>
            <div class="kc-muted">Last Update: ${formatTimestamp(order.updatedAt)}</div>
            ${order.promoCode ? `<div class="kc-muted">Promo: ${order.promoCode} (-${order.discountAmount || 0} EGP)</div>` : ""}
            <div class="kc-muted">Subtotal: ${order.subtotal ?? 0} EGP | Final: ${finalTotal(order)} EGP</div>
          </div>
          <div class="kc-order-qr-box">
            ${qrUrls[idx] ? `<img class="kc-order-qr" src="${qrUrls[idx]}" alt="QR for order ${order.id}" />` : '<div class="kc-muted">QR unavailable</div>'}
            <div class="kc-muted">Scan at cashier</div>
          </div>
        </div>
        <div class="kc-inline" style="justify-content: space-between; margin-top: 0.55rem">
          <div class="kc-muted">Points: ${order.pointsEarned || 0} ${order.pointsGranted ? "(granted)" : "(after collection)"}</div>
        </div>
        <div class="kc-list" style="margin-top: 0.7rem">
          ${order.items
            .map((item) => `<div class="kc-item">${item.name} x${item.qty} - ${item.price * item.qty} EGP</div>`)
            .join("")}
        </div>
        ${
          canStudentCancelOrder(order)
            ? `<div class="kc-order-footer"><button type="button" class="kc-btn-danger kc-order-cancel-btn" data-cancel-order="${order.id}">Cancel Order</button></div>`
            : ""
        }
      </article>
    `
    )
    .join("");
}

async function loadAndRender(state) {
  const orders = await getStudentOrders(state.uid);
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

      try {
        const result = await cancelStudentOrder({
          orderId,
          universityId: state.profile.universityId,
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
    });
  });
}

async function init() {
  mountHeader({ active: "orders" });
  const state = await guardStudentPage();
  if (!state) return;

  renderStudentMiniProfile("studentMini", state.profile);

  try {
    await loadAndRender(state);
  } catch (error) {
    document.getElementById("ordersRoot").innerHTML = `<div class="kc-note">${error.message || "Could not load orders."}</div>`;
    await showErrorPopup(error.message || "Could not load orders.", "Orders Unavailable");
  }
}

init();
