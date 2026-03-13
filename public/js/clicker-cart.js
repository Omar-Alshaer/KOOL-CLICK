import { guardClickerPage, mountHeader, renderClickerMiniProfile, updateCartBadge } from "./clicker-common.js";
import { APP_CONFIG } from "./config/app-config.js";
import { getCart, saveCart, clearCart } from "./utils/storage.js";
import { applyPointsDeltaToProfileCache } from "./services/auth-service.js";
import { placeClickerOrders } from "./services/order-service.js";
import { uploadReceiptToCloudinary } from "./services/upload-service.js";
import { validatePromo } from "./utils/promo.js";
import { pointsFromAmount } from "./utils/levels.js";
import { showConfirmPopup, showErrorPopup, showSuccessPopup } from "./utils/popup.js";

let appliedPromo = null;

function totalAmount(items) {
  return items.reduce((sum, item) => sum + item.price * item.qty, 0);
}

function getSelectedPaymentMethod() {
  const selected = document.querySelector('input[name="paymentMethod"]:checked');
  return selected?.value || APP_CONFIG.paymentMethods.cod;
}

function updateTotals() {
  const items = getCart();
  const subtotal = totalAmount(items);
  const promoResult = appliedPromo ? validatePromo(subtotal, appliedPromo.code) : { discount: 0, valid: false };
  const discount = promoResult.valid ? promoResult.discount : 0;
  const finalPayable = Math.max(0, subtotal - discount);

  const method = getSelectedPaymentMethod();
  const pointsIfInstant = pointsFromAmount(finalPayable);

  document.getElementById("subtotal").textContent = `${subtotal} EGP`;
  document.getElementById("discount").textContent = `${discount} EGP`;
  document.getElementById("total").textContent = `${finalPayable} EGP`;

  if (method === APP_CONFIG.paymentMethods.instaPay) {
    document.getElementById("pointsInfo").textContent = `InstaPay: ${pointsIfInstant} points will be granted instantly.`;
  } else {
    document.getElementById("pointsInfo").textContent = `Cash on pickup: points will be granted after order is collected.`;
  }

  return { subtotal, discount, finalPayable };
}

function renderCart() {
  const items = getCart();
  const root = document.getElementById("cartRoot");

  if (!items.length) {
    root.innerHTML = `
      <div class="kc-empty-state">
        <div class="kc-empty-icon">🛒</div>
        <h3 class="kc-empty-title">Your cart is empty</h3>
        <p class="kc-empty-msg">Browse our restaurants and add something delicious!</p>
        <a class="kc-btn" href="./menu.html">Browse Menu</a>
      </div>
    `;
    appliedPromo = null;
    document.getElementById("promoSummary").textContent = "No promo applied.";
    updateTotals();
    return;
  }

  root.innerHTML = items
    .map(
      (item, index) => `
      <div class="kc-item">
        <div><strong>${item.name}</strong> x${item.qty}</div>
        <div class="kc-muted">Restaurant: ${item.restaurantName}</div>
        <div class="kc-inline" style="justify-content: space-between">
          <span>${item.price * item.qty} EGP</span>
          <button type="button" class="kc-btn-danger" data-remove="${index}">Remove</button>
        </div>
      </div>
    `
    )
    .join("");

  root.querySelectorAll("button[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const cart = getCart();
      cart.splice(Number(btn.dataset.remove), 1);
      saveCart(cart);
      updateCartBadge();
      renderCart();
    });
  });

  updateTotals();
}

function hasMultipleRestaurants(items) {
  return new Set(items.map((x) => x.restaurantId)).size > 1;
}

async function handleApplyPromo() {
  const codeInput = document.getElementById("promoCodeInput");
  const code = codeInput.value.trim();
  const subtotal = totalAmount(getCart());

  if (!code) {
    await showErrorPopup("Enter a promo code first.", "Promo Code");
    return;
  }

  const result = validatePromo(subtotal, code);
  if (!result.valid) {
    appliedPromo = null;
    document.getElementById("promoSummary").textContent = result.reason;
    updateTotals();
    await showErrorPopup(result.reason, "Promo Invalid");
    return;
  }

  appliedPromo = result.promo;
  document.getElementById("promoSummary").textContent = `${result.promo.code} applied: -${result.discount} EGP`;
  updateTotals();
  await showSuccessPopup(`Promo applied successfully. You saved ${result.discount} EGP.`, "Promo Applied");
}

function handleClearPromo() {
  appliedPromo = null;
  document.getElementById("promoCodeInput").value = "";
  document.getElementById("promoSummary").textContent = "No promo applied.";
  updateTotals();
}

function wirePaymentMethodUI() {
  const receiptSection = document.getElementById("receiptSection");
  const receiptInput = document.getElementById("receiptFile");
  const chooseBtn = document.getElementById("receiptChooseBtn");
  const fileName = document.getElementById("receiptFileName");

  chooseBtn?.addEventListener("click", () => receiptInput?.click());
  receiptInput?.addEventListener("change", () => {
    const file = receiptInput.files?.[0];
    fileName.textContent = file ? file.name : "No file selected";
  });

  document.querySelectorAll('input[name="paymentMethod"]').forEach((radio) => {
    radio.addEventListener("change", () => {
      const method = getSelectedPaymentMethod();
      receiptSection.style.display =
        method === APP_CONFIG.paymentMethods.instaPay ? "block" : "none";
      if (method !== APP_CONFIG.paymentMethods.instaPay && fileName) {
        fileName.textContent = "No file selected";
      }
      updateTotals();
    });
  });
}

async function getReceiptUrlIfNeeded(paymentMethod) {
  if (paymentMethod !== APP_CONFIG.paymentMethods.instaPay) {
    return "";
  }

  const fileInput = document.getElementById("receiptFile");
  const file = fileInput?.files?.[0];
  if (!file) {
    throw new Error("Please upload InstaPay receipt image first.");
  }

  return uploadReceiptToCloudinary(file);
}

async function init() {
  mountHeader({ active: "cart" });
  const state = await guardClickerPage();
  if (!state) return;

  renderClickerMiniProfile("clickerMini", state.profile);

  renderCart();
  wirePaymentMethodUI();

  document.getElementById("applyPromoBtn")?.addEventListener("click", handleApplyPromo);
  document.getElementById("clearPromoBtn")?.addEventListener("click", handleClearPromo);

  const placeOrderBtn = document.getElementById("placeOrderBtn");

  placeOrderBtn?.addEventListener("click", async () => {
    const items = getCart();

    if (!items.length) {
      await showErrorPopup("Cart is empty.", "No Items");
      return;
    }

    if (hasMultipleRestaurants(items)) {
      const ok = await showConfirmPopup(
        "Your cart has multiple restaurants. Kool Click will create separate orders. Continue?",
        "Multiple Restaurants",
        "Yes, Continue",
        "Cancel"
      );
      if (!ok) return;
    }

    const paymentMethod = getSelectedPaymentMethod();

    try {
      const receiptImageUrl = await getReceiptUrlIfNeeded(paymentMethod);
      const result = await placeClickerOrders({
        uid: state.uid,
        fullName: state.profile.fullName,
        phone: state.profile.phone,
        cartItems: items,
        paymentMethod,
        receiptImageUrl,
        promoCode: appliedPromo?.code || "",
      });

      clearCart();
      applyPointsDeltaToProfileCache(state.uid, result.pointsGrantedNow);
      updateCartBadge();
      appliedPromo = null;
      document.getElementById("promoCodeInput").value = "";
      document.getElementById("promoSummary").textContent = "No promo applied.";
      renderCart();

      const pointsLine =
        paymentMethod === APP_CONFIG.paymentMethods.instaPay
          ? `${result.pointsGrantedNow} points were added instantly.`
          : `${result.pointsPendingOnCollection} points will be added after collection.`;

      await showSuccessPopup(
        `Orders placed successfully (${result.createdOrderIds.length} order(s)). Final payable: ${result.finalPayable} EGP. ${pointsLine}`,
        "Order Created"
      );
    } catch (error) {
      await showErrorPopup(error.message || "Failed to place orders.", "Order Failed");
    }
  });
}

init();
