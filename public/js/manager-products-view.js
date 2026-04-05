import { guardManagerPage, mountManagerHeader, renderManagerMiniProfile } from "./manager-common.js";
import { getRestaurantProducts, updateProduct, deleteProduct } from "./services/manager-service.js";
import { uploadImageToCloudinary } from "./services/upload-service.js";
import { showConfirmPopup, showErrorPopup, showSuccessPopup } from "./utils/popup.js";
import { withButtonLoading } from "./utils/loading.js";

const root = document.getElementById("catalogRoot");
const tabs = document.getElementById("catalogTabs");
const editModal = document.getElementById("catalogEditModal");
const editForm = document.getElementById("catalogEditForm");
const closeEditModalBtn = document.getElementById("closeCatalogModalBtn");
const editCategorySelect = document.getElementById("catalogEditCategorySelect");
const editCategoryInput = document.getElementById("catalogEditCategoryInput");
const editImageInput = document.getElementById("catalogEditImage");
const editImageBtn = document.getElementById("catalogEditImageBtn");
const editImageName = document.getElementById("catalogEditImageName");
const categoryList = document.getElementById("catalogCategoryList");

let currentProducts = [];

function groupByCategory(items) {
  const map = new Map();
  items.forEach((item) => {
    const key = item.category || "General";
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(item);
  });
  return [...map.entries()];
}

function updateCategorySelect(items) {
  if (!editCategorySelect) return;
  const categories = [...new Set(items.map((i) => i.category || "General"))];
  const options = [
    `<option value="">Select category</option>`,
    ...categories.map((c) => `<option value="${c}">${c}</option>`),
    `<option value="__other__">Other...</option>`,
  ].join("");
  editCategorySelect.innerHTML = options;
}

function renderCategoryTabs(categories, activeKey) {
  if (!tabs) return;
  tabs.innerHTML = categories
    .map(
      (name) => `
      <button type="button" class="kc-category-btn ${name === activeKey ? "active" : ""}" data-category="${name}">
        ${name}
      </button>
    `
    )
    .join("");
}

function renderCategoryItems(items) {
  if (!root) return;
  if (!items.length) {
    root.innerHTML = `<div class="kc-note">No products in this section.</div>`;
    return;
  }

  root.innerHTML = `
    <div class="kc-grid kc-menu-items-grid">
      ${items
        .map(
          (m) => {
            const isActive = !(m.isActive === false || m.isActive === "false");
            return `
          <article class="kc-item kc-menu-item ${isActive ? "" : "kc-item-disabled"}">
            <div class="kc-menu-thumb">
              <img src="${m.imageUrl || "../../assets/brand/logo.svg"}" alt="${m.name}" />
            </div>
            <div class="kc-menu-body">
              <strong>${m.name}</strong>
              <div class="kc-muted">${m.description || ""}</div>
              <div class="kc-price-line kc-section-spaced-2xs">
                <span class="kc-price">${Number(m.price || 0).toFixed(2)} EGP</span>
                ${
                  m.oldPrice && Number(m.oldPrice) > Number(m.price)
                    ? `<span class="kc-old-price">${Number(m.oldPrice).toFixed(2)} EGP</span>`
                    : ""
                }
                ${m.discountPercent ? `<span class="kc-badge kc-badge-discount">-${m.discountPercent}%</span>` : ""}
                ${m.isBestSeller ? `<span class="kc-badge kc-badge-best">Best Seller</span>` : ""}
                ${m.badge ? `<span class="kc-badge">${m.badge}</span>` : ""}
                ${isActive ? "" : `<span class="kc-badge kc-badge-soldout">Sold Out</span>`}
              </div>
              <div class="kc-inline" style="gap:0.4rem; margin-top:0.35rem;">
                <button class="kc-btn-secondary" data-action="edit" data-id="${m.id}" data-active="${isActive}">Edit</button>
                <button class="kc-btn-secondary" data-action="toggle" data-id="${m.id}" data-active="${isActive}">
                  ${isActive ? "Disable" : "Enable"}
                </button>
                <button class="kc-btn-danger" data-action="delete" data-id="${m.id}">Delete</button>
              </div>
            </div>
          </article>
        `
            ;
          }
        )
        .join("")}
    </div>
  `;

  root.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "edit") {
        openEditModal(id);
      }
      if (action === "toggle") {
        await withButtonLoading(btn, async () => {
          try {
            const currentActive = btn.dataset.active === "true";
            await updateProduct(id, { isActive: !currentActive });
            await showSuccessPopup("Product status updated.", "Saved");
            await loadProducts();
          } catch (error) {
            await showErrorPopup(error.message || "Failed to update product.", "Update Failed");
          }
        }, "Saving...");
      }
      if (action === "delete") {
        const ok = await showConfirmPopup(
          "Delete this product permanently?",
          "Confirm Delete",
          "Delete",
          "Cancel",
          { dangerous: true }
        );
        if (!ok) return;
        await withButtonLoading(btn, async () => {
          await deleteProduct(id);
          await showSuccessPopup("Product deleted.", "Removed");
          await loadProducts();
        }, "Deleting...");
      }
    });
  });
}

function renderCatalog(items) {
  if (!root) return;
  if (!items.length) {
    root.innerHTML = `<div class="kc-note">No products yet.</div>`;
    if (tabs) tabs.innerHTML = "";
    return;
  }

  const grouped = groupByCategory(items);
  const categories = grouped.map(([name]) => name);
  const activeCategory = categories[0];

  updateCategorySelect(items);
  renderCategoryTabs(categories, activeCategory);
  renderCategoryItems(grouped.find(([name]) => name === activeCategory)?.[1] || []);

  tabs?.querySelectorAll(".kc-category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.category;
      tabs.querySelectorAll(".kc-category-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const items = grouped.find(([cat]) => cat === name)?.[1] || [];
      renderCategoryItems(items);
    });
  });
}

function openEditModal(productId) {
  const product = currentProducts.find((p) => p.id === productId);
  if (!product || !editModal) return;

  document.getElementById("catalogEditId").value = product.id;
  document.getElementById("catalogEditName").value = product.name || "";
  const category = product.category || "";
  if (editCategorySelect) {
    const optionExists = Array.from(editCategorySelect.options).some((o) => o.value === category);
    editCategorySelect.value = optionExists ? category : "__other__";
  }
  if (editCategoryInput) {
    if (category && (!editCategorySelect || editCategorySelect.value === "__other__")) {
      editCategoryInput.classList.remove("kc-hidden");
      editCategoryInput.value = category;
    } else {
      editCategoryInput.classList.add("kc-hidden");
      editCategoryInput.value = "";
    }
  }
  document.getElementById("catalogEditDescription").value = product.description || "";
  document.getElementById("catalogEditPrice").value = Number(product.price || 0);
  document.getElementById("catalogEditOldPrice").value = Number(product.oldPrice || 0) || "";
  document.getElementById("catalogEditDiscount").value = Number(product.discountPercent || 0) || "";
  document.getElementById("catalogEditBadge").value = product.badge || "";
  document.getElementById("catalogEditBestSeller").value = String(Boolean(product.isBestSeller));
  document.getElementById("catalogEditActive").value = String(product.isActive !== false);

  editModal.classList.add("open");
  editModal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  editModal?.classList.remove("open");
  editModal?.setAttribute("aria-hidden", "true");
  editForm?.reset();
  const imageInput = document.getElementById("catalogEditImage");
  if (imageInput) imageInput.value = "";
  if (editImageName) editImageName.textContent = "No file selected";
}

closeEditModalBtn?.addEventListener("click", closeEditModal);
editModal?.addEventListener("click", (event) => {
  if (event.target === editModal) closeEditModal();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && editModal?.classList.contains("open")) {
    closeEditModal();
  }
});

editImageBtn?.addEventListener("click", () => editImageInput?.click());
editImageInput?.addEventListener("change", () => {
  const file = editImageInput.files?.[0];
  if (editImageName) editImageName.textContent = file ? file.name : "No file selected";
});

editCategorySelect?.addEventListener("change", () => {
  if (!editCategoryInput) return;
  if (editCategorySelect.value === "__other__") {
    editCategoryInput.classList.remove("kc-hidden");
    editCategoryInput.value = "";
  } else {
    editCategoryInput.classList.add("kc-hidden");
    editCategoryInput.value = editCategorySelect.value || "";
  }
});

editForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = editForm.querySelector('[type="submit"]');
  const productId = document.getElementById("catalogEditId").value;
  if (!productId) return;

  const name = document.getElementById("catalogEditName").value.trim();
  const category = (editCategorySelect?.value === "__other__"
    ? editCategoryInput?.value
    : editCategorySelect?.value) || "";
  const description = document.getElementById("catalogEditDescription").value.trim();
  const price = document.getElementById("catalogEditPrice").value;
  const oldPrice = document.getElementById("catalogEditOldPrice").value;
  const discountPercent = document.getElementById("catalogEditDiscount").value;
  const badge = document.getElementById("catalogEditBadge").value;
  const isBestSeller = document.getElementById("catalogEditBestSeller").value === "true";
  const isActive = document.getElementById("catalogEditActive").value === "true";
  const imageFile = document.getElementById("catalogEditImage").files?.[0];

  if (!name) {
    await showErrorPopup("Product name is required.", "Missing Data");
    return;
  }

  if (!price || Number.isNaN(Number(price))) {
    await showErrorPopup("Price must be a valid number.", "Invalid Price");
    return;
  }

  let imageUrl = "";
  try {
    if (imageFile) {
      imageUrl = await uploadImageToCloudinary(imageFile, { folder: "products" });
    }
  } catch (error) {
    await showErrorPopup(error.message || "Image upload failed.", "Upload Failed");
    return;
  }

  const patch = {
    name,
    category,
    description,
    price: Number(price),
    oldPrice: Number(oldPrice || 0),
    discountPercent: Number(discountPercent || 0),
    badge: badge || "",
    isBestSeller,
    isActive,
  };
  if (imageUrl) patch.imageUrl = imageUrl;

  await withButtonLoading(submitBtn, async () => {
    await updateProduct(productId, patch);
    await showSuccessPopup("Product updated.", "Saved");
    closeEditModal();
    await loadProducts();
  }, "Saving...");
});

async function loadProducts() {
  const products = await getRestaurantProducts(window.__managerRestaurantId || "", 400);
  currentProducts = products;
  updateCategorySelect(products);
  renderCatalog(products);
}

async function init() {
  mountManagerHeader({ active: "catalog" });
  const state = await guardManagerPage();
  if (!state) return;
  renderManagerMiniProfile("managerMini", state.profile);

  try {
    window.__managerRestaurantId = state.profile.restaurantId;
    await loadProducts();
  } catch (error) {
    await showErrorPopup(error.message || "Could not load products.", "Catalog Error");
  }
}

init();
