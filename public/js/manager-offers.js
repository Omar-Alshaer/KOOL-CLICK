import { guardManagerPage, mountManagerHeader, renderManagerMiniProfile } from "./manager-common.js";
import {
  addOffer,
  deleteOffer,
  getOffers,
  updateOffer,
  getRestaurantProducts,
  addPromoCode,
  deletePromoCode,
  getPromoCodes,
  updatePromoCode,
} from "./services/manager-service.js";
import { showConfirmPopup, showErrorPopup, showSuccessPopup } from "./utils/popup.js";
import { uploadImageToCloudinary } from "./services/upload-service.js";
import { withButtonLoading } from "./utils/loading.js";

const offerForm = document.getElementById("offerForm");
const promoForm = document.getElementById("promoForm");
const offersGrid = document.getElementById("offersGrid");
const promoGrid = document.getElementById("promoGrid");
const offerTargetType = document.getElementById("offerTargetType");
const offerTargetValue = document.getElementById("offerTargetValue");
const offerImageInput = document.getElementById("offerImage");
const offerImageBtn = document.getElementById("offerImageBtn");
const offerImageName = document.getElementById("offerImageName");

let managerProfile = null;
let managerProducts = [];

function renderOffers(offers) {
  if (!offersGrid) return;
  if (!offers.length) {
    offersGrid.innerHTML = `<div class="kc-note">No offers yet.</div>`;
    return;
  }
  offersGrid.innerHTML = offers
    .map(
      (offer) => `
      <div class="kc-card">
        <strong>${offer.title}</strong>
        <div class="kc-muted">${offer.description || "No description"}</div>
        <div class="kc-muted">Target: ${offer.targetLabel || offer.targetValue || "All"}</div>
        <div class="kc-muted">Discount: ${offer.discountValue}${offer.discountType === "percent" ? "%" : " EGP"}</div>
        <div class="kc-inline" style="gap:0.4rem;">
          <button class="kc-btn-secondary" data-action="toggle-offer" data-id="${offer.id}">
            ${offer.isActive ? "Disable" : "Enable"}
          </button>
          <button class="kc-btn-danger" data-action="delete-offer" data-id="${offer.id}">Delete</button>
        </div>
      </div>
    `
    )
    .join("");
}

function renderPromoCodes(codes) {
  if (!promoGrid) return;
  if (!codes.length) {
    promoGrid.innerHTML = `<div class="kc-note">No promo codes yet.</div>`;
    return;
  }
  promoGrid.innerHTML = codes
    .map(
      (code) => `
      <div class="kc-card">
        <strong>${code.code}</strong>
        <div class="kc-muted">Type: ${code.type}</div>
        <div class="kc-muted">Value: ${code.value}${code.type === "percent" ? "%" : " EGP"}</div>
        <div class="kc-muted">Min Subtotal: ${Number(code.minSubtotal || 0).toFixed(0)} EGP</div>
        <div class="kc-inline" style="gap:0.4rem;">
          <button class="kc-btn-secondary" data-action="toggle-promo" data-id="${code.id}">
            ${code.isActive ? "Disable" : "Enable"}
          </button>
          <button class="kc-btn-danger" data-action="delete-promo" data-id="${code.id}">Delete</button>
        </div>
      </div>
    `
    )
    .join("");
}

async function loadOffers() {
  if (!managerProfile) return;
  const offers = await getOffers(managerProfile.restaurantId, 160);
  renderOffers(offers);
}

async function loadPromoCodes() {
  if (!managerProfile) return;
  const codes = await getPromoCodes(managerProfile.restaurantId, 160);
  renderPromoCodes(codes);
}

offerForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!managerProfile) return;
  const submitBtn = offerForm.querySelector('[type="submit"]');

  const title = document.getElementById("offerTitle").value.trim();
  const description = document.getElementById("offerDescription").value.trim();
  const discountType = document.getElementById("offerType").value;
  const discountValue = document.getElementById("offerValue").value;
  const targetType = offerTargetType?.value || "product";
  const targetValue = offerTargetValue?.value || "";
  const targetLabel = offerTargetValue?.selectedOptions?.[0]?.textContent?.trim() || targetValue;

  if (!title) {
    await showErrorPopup("Offer title is required.", "Missing Data");
    return;
  }

  if (!targetValue) {
    await showErrorPopup("Select a target product or section.", "Missing Target");
    return;
  }

  let imageUrl = "";
  const imageFile = offerImageInput?.files?.[0];
  if (imageFile) {
    imageUrl = await uploadImageToCloudinary(imageFile, { folder: "offers" });
  }

  await withButtonLoading(submitBtn, async () => {
    await addOffer({
      restaurantId: managerProfile.restaurantId,
      restaurantName: managerProfile.restaurantName || "",
      title,
      description,
      discountType,
      discountValue,
      targetType,
      targetValue,
      targetLabel,
      imageUrl,
    });

    offerForm.reset();
    if (offerImageName) offerImageName.textContent = "No file selected";
    await showSuccessPopup("Offer added.", "Saved");
    loadOffers();
  }, "Saving...");
});

promoForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!managerProfile) return;
  const submitBtn = promoForm.querySelector('[type="submit"]');

  const code = document.getElementById("promoCode").value.trim();
  const type = document.getElementById("promoType").value;
  const value = document.getElementById("promoValue").value;
  const minSubtotal = document.getElementById("promoMin").value;

  if (!code) {
    await showErrorPopup("Promo code is required.", "Missing Data");
    return;
  }

  await withButtonLoading(submitBtn, async () => {
    await addPromoCode({
      restaurantId: managerProfile.restaurantId,
      code,
      type,
      value,
      minSubtotal,
    });

    promoForm.reset();
    await showSuccessPopup("Promo code added.", "Saved");
    loadPromoCodes();
  }, "Saving...");
});

document.addEventListener("click", async (event) => {
  const btn = event.target.closest("button[data-action]");
  if (!btn) return;
  const id = btn.dataset.id;

  if (btn.dataset.action === "delete-offer") {
    const confirmed = await showConfirmPopup("Delete this offer?", "Confirm Delete", "Delete", "Cancel", { dangerous: true });
    if (!confirmed) return;
    await withButtonLoading(btn, async () => {
      await deleteOffer(id);
      await showSuccessPopup("Offer deleted.", "Removed");
      loadOffers();
    }, "Deleting...");
  }

  if (btn.dataset.action === "toggle-offer") {
    await withButtonLoading(btn, async () => {
      const shouldDisable = btn.textContent.trim() === "Disable";
      await updateOffer(id, { isActive: !shouldDisable });
      await showSuccessPopup("Offer updated.", "Saved");
      loadOffers();
    }, "Saving...");
  }

  if (btn.dataset.action === "delete-promo") {
    const confirmed = await showConfirmPopup("Delete this promo code?", "Confirm Delete", "Delete", "Cancel", { dangerous: true });
    if (!confirmed) return;
    await withButtonLoading(btn, async () => {
      await deletePromoCode(id);
      await showSuccessPopup("Promo code deleted.", "Removed");
      loadPromoCodes();
    }, "Deleting...");
  }

  if (btn.dataset.action === "toggle-promo") {
    await withButtonLoading(btn, async () => {
      const shouldDisable = btn.textContent.trim() === "Disable";
      await updatePromoCode(id, { isActive: !shouldDisable });
      await showSuccessPopup("Promo code updated.", "Saved");
      loadPromoCodes();
    }, "Saving...");
  }
});

async function init() {
  mountManagerHeader({ active: "offers" });
  const state = await guardManagerPage();
  if (!state) return;
  managerProfile = state.profile;
  renderManagerMiniProfile("managerMini", state.profile);
  managerProducts = await getRestaurantProducts(managerProfile.restaurantId, 400);
  refreshOfferTargetOptions();
  loadOffers();
  loadPromoCodes();
}

init();

function refreshOfferTargetOptions() {
  if (!offerTargetValue) return;
  const type = offerTargetType?.value || "product";

  if (type === "section") {
    const categories = [...new Set(managerProducts.map((p) => p.category || "General"))];
    const list = categories.length ? categories : ["General"];
    offerTargetValue.innerHTML = list.map((name) => `<option value="${name}">${name}</option>`).join("");
    return;
  }

  if (!managerProducts.length) {
    offerTargetValue.innerHTML = `<option value="">No products yet</option>`;
    return;
  }

  offerTargetValue.innerHTML = managerProducts
    .map((product) => `<option value="${product.id}">${product.name}</option>`)
    .join("");
}

offerTargetType?.addEventListener("change", refreshOfferTargetOptions);

offerImageBtn?.addEventListener("click", () => offerImageInput?.click());
offerImageInput?.addEventListener("change", () => {
  const file = offerImageInput.files?.[0];
  if (offerImageName) {
    offerImageName.textContent = file ? file.name : "No file selected";
  }
});
