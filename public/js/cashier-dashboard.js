import {
  collectOrderByCashier,
  getCashierOrders,
  updateOrderProgress,
} from "./services/cashier-service.js";
import { guardCashierPage, mountCashierHeader, renderCashierMiniProfile } from "./cashier-common.js";
import { showErrorPopup, showSuccessPopup } from "./utils/popup.js";
import { withButtonLoading } from "./utils/loading.js";
import { APP_CONFIG } from "./config/app-config.js";
import { escapeHtml, safeClass, sanitizeUrl } from "./utils/dom.js";

let currentState = null;
let currentOrders = [];
let activeOrderId = null;
let scanStream = null;
let scanLoopId = null;
let isScanning = false;
let qrDetector = null;
let jsQrDecoder = null;
let scanCanvas = null;
let scanContext = null;
let refreshIntervalId = null;
let isLoadingOrders = false;

function formatOrderId(id) {
  return `KC-${String(id).slice(0, 8).toUpperCase()}`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `${amount.toFixed(2)} EGP`;
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

function getOrderFinalTotal(order) {
  if (typeof order.finalTotal === "number") return order.finalTotal;
  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discountAmount || 0);
  return Math.max(0, subtotal - discount);
}

function safeStatusLabel(status) {
  return safeClass(status, APP_CONFIG.orderStatuses, APP_CONFIG.orderStatuses[0]);
}

function renderStats(orders) {
  const host = document.getElementById("cashierStats");
  if (!host) return;

  const pending = orders.filter((o) => o.status === "Pending").length;
  const preparing = orders.filter((o) => o.status === "Preparing").length;
  const ready = orders.filter((o) => o.status === "Ready").length;
  const collected = orders.filter((o) => o.status === "Collected").length;

  host.innerHTML = `
    <div class="kc-chip">Pending: ${pending}</div>
    <div class="kc-chip">Preparing: ${preparing}</div>
    <div class="kc-chip">Ready: ${ready}</div>
    <div class="kc-chip">Collected: ${collected}</div>
    <div class="kc-chip">Total: ${orders.length}</div>
  `;
}

function renderOrders(orders) {
  const root = document.getElementById("ordersRoot");

  if (!orders.length) {
    root.innerHTML = '<div class="kc-note">No orders found for this restaurant.</div>';
    return;
  }

  root.innerHTML = orders
    .map((order) => {
      const statusLabel = safeStatusLabel(order.status);
      const safeClickerName = escapeHtml(order.clickerName || "N/A");
      const safeClickerPhone = escapeHtml(order.clickerPhone || "N/A");
      const safePaymentStatus = escapeHtml(order.paymentStatus || "N/A");
      const safePaymentMethod = escapeHtml(order.paymentMethod || "N/A");
      const finalTotal = getOrderFinalTotal(order);
      return `
      <article class="kc-card">
        <div class="kc-inline kc-inline-between">
          <div class="kc-order-id-wrap">
            <strong>Order ID</strong>
            <span class="kc-order-id-tag">${formatOrderId(order.id)}</span>
          </div>
          <span class="kc-status ${statusLabel}">${statusLabel}</span>
        </div>

        <div class="kc-order-summary-grid kc-section-spaced-xs">
          <div class="kc-item">
            <div><strong>Clicker:</strong> ${safeClickerName}</div>
            <div class="kc-muted">Phone: ${safeClickerPhone}</div>
          </div>
          <div class="kc-item">
            <div><strong>Payment:</strong> ${safePaymentStatus}</div>
            <div class="kc-muted">Method: ${safePaymentMethod}</div>
            <div class="kc-muted">Ordered At: ${formatTimestamp(order.createdAt)}</div>
          </div>
          <div class="kc-item">
            <div><strong>Total:</strong> ${formatMoney(finalTotal)}</div>
            <div class="kc-muted">Items: ${(order.items || []).length}</div>
          </div>
          <div class="kc-item">
            <div><strong>Points:</strong> ${order.pointsEarned || 0}</div>
            <div class="kc-muted">${order.pointsGranted ? "Granted" : "Pending"}</div>
          </div>
        </div>

        <div class="kc-inline kc-inline-center kc-section-spaced-xl">
          <button type="button" class="kc-btn-secondary" data-open-order="${order.id}">Open Details</button>
        </div>
      </article>
    `;
    })
    .join("");

  root.querySelectorAll("button[data-open-order]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.dataset.openOrder;
      if (orderId) openOrderModal(orderId);
    });
  });
}

function getOrderById(orderId) {
  return currentOrders.find((order) => order.id === orderId) || null;
}

function closeOrderModal() {
  const modal = document.getElementById("cashierOrderModal");
  if (!modal) return;
  modal.hidden = true;
  activeOrderId = null;
}

function renderOrderModal(order) {
  const body = document.getElementById("orderModalBody");
  const title = document.getElementById("cashierOrderModalTitle");
  if (!body || !title) return;

  const subtotal = Number(order.subtotal || 0);
  const discount = Number(order.discountAmount || 0);
  const finalTotal = getOrderFinalTotal(order);
  const statusLabel = safeStatusLabel(order.status);
  const safeClickerName = escapeHtml(order.clickerName || "N/A");
  const safeClickerPhone = escapeHtml(order.clickerPhone || "N/A");
  const safePaymentStatus = escapeHtml(order.paymentStatus || "N/A");
  const safePaymentMethod = escapeHtml(order.paymentMethod || "N/A");
  const safeReceiptUrl = sanitizeUrl(order.receiptImageUrl);

  title.textContent = `Order ${formatOrderId(order.id)}`;

  body.innerHTML = `
    <div class="kc-order-layout kc-order-layout-stack kc-section-spaced-xs">
      <div class="kc-item kc-order-info">
        <div><strong>Clicker:</strong> ${safeClickerName}</div>
        <div class="kc-muted">Phone: ${safeClickerPhone}</div>
        <div class="kc-muted">Method: ${safePaymentMethod}</div>
        <div class="kc-muted">Payment: ${safePaymentStatus}</div>
        <div class="kc-muted">Status: ${statusLabel}</div>
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
            <img src="${safeReceiptUrl}" alt="InstaPay receipt for ${formatOrderId(order.id)}" />
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
              <label for="orderModalStatus">Status</label>
              <select id="orderModalStatus" class="kc-cashier-field">
                <option value="Pending" ${order.status === "Pending" ? "selected" : ""}>Pending</option>
                <option value="Preparing" ${order.status === "Preparing" ? "selected" : ""}>Preparing</option>
                <option value="Ready" ${order.status === "Ready" ? "selected" : ""}>Ready</option>
              </select>
            </div>

            <div class="kc-order-control-field">
              <label for="orderModalTime">Remaining Time (minutes)</label>
              <select id="orderModalTime" class="kc-cashier-field">
                ${renderEtaOptions(order.remainingTimeMinutes)}
              </select>
            </div>
          </div>

          <div class="kc-order-action-grid">
            <button type="button" id="orderModalSaveBtn" class="kc-order-btn-save">Save Progress</button>
            <button type="button" id="orderModalCollectBtn" class="kc-btn-danger kc-order-btn-collect">Mark Collected</button>
          </div>
        </div>
      </div>
    </div>

    <div class="kc-list kc-section-spaced-xl">
      ${(order.items || [])
        .map((item) => `<div class="kc-item">${escapeHtml(item.name || "")} x${item.qty} - ${formatMoney(item.price * item.qty)}</div>`)
        .join("")}
    </div>
  `;

  document.getElementById("orderModalSaveBtn")?.addEventListener("click", async (event) => {
    const status = document.getElementById("orderModalStatus")?.value;
    const remainingTimeMinutes = Number(document.getElementById("orderModalTime")?.value || 0);
    const btn = event.currentTarget;

    await withButtonLoading(btn, async () => {
      try {
        await updateOrderProgress({
          orderId: order.id,
          status,
          remainingTimeMinutes,
          cashierRestaurantId: currentState.profile.restaurantId,
        });
        await showSuccessPopup("Order progress updated.", "Saved");
        await loadOrders();
        const refreshed = getOrderById(order.id);
        if (refreshed) renderOrderModal(refreshed);
      } catch (error) {
        await showErrorPopup(error.message || "Failed to update order.", "Save Failed");
      }
    }, "Saving...");
  });

  document.getElementById("orderModalCollectBtn")?.addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    await withButtonLoading(btn, async () => {
      try {
        const result = await collectOrderByCashier({
          orderId: order.id,
          cashierRestaurantId: currentState.profile.restaurantId,
        });
        const pointsNote = result.pointsAdded > 0 ? ` ${result.pointsAdded} points added to clicker.` : "";
        await showSuccessPopup(`Order marked as collected.${pointsNote}`, "Collected");
        closeOrderModal();
        await loadOrders();
      } catch (error) {
        await showErrorPopup(error.message || "Failed to collect order.", "Collect Failed");
      }
    }, "Collecting...");
  });
}

function openOrderModal(orderId) {
  const order = getOrderById(orderId);
  if (!order) {
    showErrorPopup("Order not found in current list.", "Order Missing");
    return;
  }

  activeOrderId = order.id;
  renderOrderModal(order);

  const modal = document.getElementById("cashierOrderModal");
  if (modal) modal.hidden = false;
}

function normalizeOrderId(rawValue) {
  return String(rawValue || "")
    .trim()
    .replace(/^KC-/i, "")
    .toLowerCase();
}

function findOrderByScanValue(rawValue) {
  const rawLower = String(rawValue || "").toLowerCase();
  const orderId = normalizeOrderId(rawValue);
  if (!orderId) return null;

  return (
    currentOrders.find((order) => {
      const exactId = (order.id || "").toLowerCase();
      const qrPayload = String(order.qrPayload || "").toLowerCase();
      return exactId === orderId || qrPayload === rawLower || qrPayload === orderId;
    }) || null
  );
}

async function openOrderFromScan(rawValue) {
  const target = findOrderByScanValue(rawValue);
  if (!target) {
    await showErrorPopup("Order not found in this restaurant.", "Scan Result");
    return false;
  }

  openOrderModal(target.id);
  return true;
}

function ensureScanCanvas() {
  if (!scanCanvas) {
    scanCanvas = document.createElement("canvas");
    scanContext = scanCanvas.getContext("2d", { willReadFrequently: true });
  }
}

async function ensureQrDetector() {
  if (qrDetector !== null) return qrDetector;
  if (!("BarcodeDetector" in window)) {
    qrDetector = undefined;
    return qrDetector;
  }

  try {
    qrDetector = new window.BarcodeDetector({ formats: ["qr_code"] });
  } catch {
    qrDetector = undefined;
  }
  return qrDetector;
}

async function ensureJsQrDecoder() {
  if (jsQrDecoder) return jsQrDecoder;
  try {
    const module = await import("https://esm.sh/jsqr@1.4.0");
    jsQrDecoder = module.default;
  } catch {
    jsQrDecoder = null;
  }
  return jsQrDecoder;
}

function closeScanModal() {
  const scanModal = document.getElementById("cashierScanModal");
  if (scanModal) scanModal.hidden = true;
}

function stopCameraScan() {
  isScanning = false;
  if (scanLoopId) {
    cancelAnimationFrame(scanLoopId);
    scanLoopId = null;
  }

  if (scanStream) {
    scanStream.getTracks().forEach((track) => track.stop());
    scanStream = null;
  }

  const video = document.getElementById("scanVideo");
  if (video) video.srcObject = null;
}

async function startCameraScan() {
  const scanModal = document.getElementById("cashierScanModal");
  const video = document.getElementById("scanVideo");
  const hint = document.getElementById("scanHint");
  if (!scanModal || !video || !hint) return;

  stopCameraScan();

  if (!navigator.mediaDevices?.getUserMedia) {
    await showErrorPopup("Camera is not available in this browser.", "Camera Error");
    return;
  }

  const detector = await ensureQrDetector();
  const qrFallback = detector ? null : await ensureJsQrDecoder();
  if (!detector && !qrFallback) {
    await showErrorPopup("QR scan is not supported here. Please paste the Order ID manually.", "Scanner Unsupported");
    return;
  }

  try {
    scanStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: "environment" },
      },
      audio: false,
    });
  } catch {
    await showErrorPopup("Camera permission denied or unavailable.", "Camera Error");
    return;
  }

  scanModal.hidden = false;
  hint.textContent = "Point camera to QR code";
  video.srcObject = scanStream;
  await video.play();

  ensureScanCanvas();
  isScanning = true;

  const tick = async () => {
    if (!isScanning) return;

    if (video.readyState >= 2 && scanContext) {
      const width = video.videoWidth || 0;
      const height = video.videoHeight || 0;
      if (width > 0 && height > 0) {
        if (scanCanvas.width !== width || scanCanvas.height !== height) {
          scanCanvas.width = width;
          scanCanvas.height = height;
        }

        scanContext.drawImage(video, 0, 0, width, height);
        try {
          let scannedValue = "";

          if (detector) {
            const found = await detector.detect(scanCanvas);
            if (found?.length) {
              scannedValue = String(found[0].rawValue || "").trim();
            }
          } else if (qrFallback) {
            const frame = scanContext.getImageData(0, 0, width, height);
            const found = qrFallback(frame.data, width, height, { inversionAttempts: "dontInvert" });
            scannedValue = String(found?.data || "").trim();
          }

          if (scannedValue) {
            const input = document.getElementById("scanInput");
            if (input) input.value = scannedValue;
            const ok = await openOrderFromScan(scannedValue);
            if (ok) {
              hint.textContent = "QR detected";
              stopCameraScan();
              closeScanModal();
              return;
            }
          }
        } catch {
          // continue scanning
        }
      }
    }

    scanLoopId = requestAnimationFrame(() => {
      tick();
    });
  };

  tick();
}

async function startCameraScanFromUser() {
  await startCameraScan();
}

function applyFiltersAndRender() {
  const queryText = document.getElementById("orderSearch")?.value.trim().toLowerCase() || "";
  const sortBy = document.getElementById("sortBy")?.value || "time";
  const showCompleted = document.getElementById("showCompleted")?.checked;

  let filtered = [...currentOrders];
  renderStats(currentOrders);

  if (!showCompleted) {
    filtered = filtered.filter((order) => order.status !== "Collected");
  }

  if (queryText) {
    filtered = filtered.filter((order) => {
      const idHit = order.id.toLowerCase().includes(queryText);
      const clickerHit = (order.clickerName || "").toLowerCase().includes(queryText);
      const phoneHit = (order.clickerPhone || "").toLowerCase().includes(queryText);
      return idHit || clickerHit || phoneHit;
    });
  }

  if (sortBy === "name") {
    filtered.sort((a, b) => (a.clickerName || "").localeCompare(b.clickerName || ""));
  } else {
    filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }

  renderOrders(filtered);
}

async function loadOrders() {
  if (!currentState?.profile?.restaurantId || isLoadingOrders) return;
  isLoadingOrders = true;

  try {
    currentOrders = await getCashierOrders(currentState.profile.restaurantId);
    applyFiltersAndRender();

    if (activeOrderId) {
      const refreshed = getOrderById(activeOrderId);
      if (refreshed) {
        renderOrderModal(refreshed);
      } else {
        closeOrderModal();
      }
    }
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

function wireScanSection() {
  const scanBtn = document.getElementById("scanFindBtn");
  const scanInput = document.getElementById("scanInput");
  const scanOpenBtn = document.getElementById("scanOpenBtn");
  const scanCloseBtn = document.getElementById("scanCloseBtn");
  const orderModalCloseBtn = document.getElementById("orderModalCloseBtn");
  const orderModal = document.getElementById("cashierOrderModal");
  const scanModal = document.getElementById("cashierScanModal");

  scanBtn?.addEventListener("click", async () => {
    const raw = (scanInput.value || "").trim();
    if (!raw) return;
    await openOrderFromScan(raw);
  });

  scanOpenBtn?.addEventListener("click", async () => {
    await startCameraScanFromUser();
  });

  scanCloseBtn?.addEventListener("click", () => {
    stopCameraScan();
    closeScanModal();
  });

  orderModalCloseBtn?.addEventListener("click", () => {
    closeOrderModal();
  });

  orderModal?.addEventListener("click", (event) => {
    if (event.target === orderModal) closeOrderModal();
  });

  scanModal?.addEventListener("click", (event) => {
    if (event.target === scanModal) {
      stopCameraScan();
      closeScanModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Escape") return;
    closeOrderModal();
    stopCameraScan();
    closeScanModal();
  });
}

async function init() {
  mountCashierHeader({ active: "dashboard" });
  currentState = await guardCashierPage();
  if (!currentState) return;

  renderCashierMiniProfile("cashierMini", currentState.profile);

  document.getElementById("sortBy")?.addEventListener("change", applyFiltersAndRender);
  document.getElementById("orderSearch")?.addEventListener("input", applyFiltersAndRender);
  document.getElementById("showCompleted")?.addEventListener("change", applyFiltersAndRender);

  wireScanSection();
  closeOrderModal();
  closeScanModal();
  stopCameraScan();
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
  stopCameraScan();
  stopRefreshLoop();
});
