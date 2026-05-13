import {
  guardManagerPage,
  mountManagerHeader,
  renderManagerMiniProfile,
} from "./manager-common.js";
import {
  addProduct,
  deleteProduct,
  getRestaurantProducts,
  updateProduct,
} from "../services/manager-service.js";
import { uploadImageToCloudinary } from "../../../shared/services/upload-service.js";
import { showConfirmPopup, showErrorPopup, showSuccessPopup } from "../../../core/utils/popup.js";
import { withButtonLoading } from "../../../core/utils/loading.js";
import { escapeHtml, sanitizeUrl } from "../../../core/utils/dom.js";

const form = document.getElementById("productForm");
const productsGrid = document.getElementById("productsGrid");
const categoryTabs = document.getElementById("managerCategoryTabs");
const editModal = document.getElementById("productEditModal");
const editForm = document.getElementById("productEditForm");
const closeEditModalBtn = document.getElementById("closeProductModalBtn");
const categorySelect = document.getElementById("productCategorySelect");
const categoryInput = document.getElementById("productCategoryInput");
const editCategorySelect = document.getElementById("editProductCategorySelect");
const editCategoryInput = document.getElementById("editProductCategoryInput");
const productImageInput = document.getElementById("productImage");
const productImageBtn = document.getElementById("productImageBtn");
const productImageName = document.getElementById("productImageName");
const editImageInput = document.getElementById("editProductImage");
const editImageBtn = document.getElementById("editProductImageBtn");
const editImageName = document.getElementById("editProductImageName");

let managerProfile = null;
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
  if (!categorySelect || !editCategorySelect) return;
  const categories = [...new Set(items.map((i) => i.category || "General"))];
  const options = [
    `<option value="">Select category</option>`,
    ...categories.map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`),
    `<option value="__other__">Other...</option>`,
  ].join("");
  categorySelect.innerHTML = options;
  editCategorySelect.innerHTML = options;
}

function renderCategoryTabs(categories, activeKey) {
  if (!categoryTabs) return;
  categoryTabs.innerHTML = categories
    .map(
      (name) => `
      <button type="button" class="kc-category-btn ${name === activeKey ? "active" : ""}" data-category="${escapeHtml(name)}">
        ${escapeHtml(name)}
      </button>
    `
    )
    .join("");
}

function renderCategoryItems(items) {
  if (!productsGrid) return;
  if (!items.length) {
    productsGrid.innerHTML = `<div class="kc-note">No products in this section.</div>`;
    return;
  }

  productsGrid.innerHTML = `
    <div class="kc-grid kc-menu-items-grid">
      ${items
        .map((item) => {
          const safeName = escapeHtml(item.name || "");
          const safeCategory = escapeHtml(item.category || "General");
          const safeBadge = escapeHtml(item.badge || "");
          const safeImage = sanitizeUrl(item.imageUrl);
          const isActive = !(item.isActive === false || item.isActive === "false");
          return `
        <div class="kc-card kc-product-card ${isActive ? "" : "kc-card-disabled"}">
          <div class="kc-product-thumb">
            ${safeImage ? `<img src="${safeImage}" alt="${safeName}" />` : `<div class="kc-muted">No Image</div>`}
          </div>
          <div class="kc-product-body">
            <strong>${safeName}</strong>
            <div class="kc-muted">Category: ${safeCategory}</div>
            <div class="kc-price-line">
              <span class="kc-price">${Number(item.price || 0).toFixed(2)} EGP</span>
              ${item.oldPrice && Number(item.oldPrice) > Number(item.price) ? `<span class="kc-old-price">${Number(item.oldPrice).toFixed(2)} EGP</span>` : ""}
              ${item.discountPercent ? `<span class="kc-badge kc-badge-discount">-${item.discountPercent}%</span>` : ""}
              ${isActive ? "" : `<span class="kc-badge kc-badge-soldout">Sold Out</span>`}
            </div>
            <div class="kc-inline" style="gap:0.35rem;">
              ${item.isBestSeller ? `<span class="kc-badge">Best Seller</span>` : ""}
              ${safeBadge ? `<span class="kc-badge">${safeBadge}</span>` : ""}
            </div>
            <div class="kc-inline" style="gap:0.4rem;">
              <button class="kc-btn-secondary" data-action="edit" data-id="${item.id}" data-active="${isActive}">Edit</button>
              <button class="kc-btn-secondary" data-action="toggle" data-id="${item.id}" data-active="${isActive}">
                ${isActive ? "Disable" : "Enable"}
              </button>
              <button class="kc-btn-danger" data-action="delete" data-id="${item.id}">Delete</button>
            </div>
          </div>
        </div>
      `;
        })
        .join("")}
    </div>
  `;
}

function renderProducts(products) {
  if (!productsGrid) return;
  if (!products.length) {
    productsGrid.innerHTML = `<div class="kc-note">No products yet.</div>`;
    if (categoryTabs) categoryTabs.innerHTML = "";
    return;
  }

  const grouped = groupByCategory(products);
  const categories = grouped.map(([name]) => name);
  const activeCategory = categories[0];
  updateCategorySelect(products);
  renderCategoryTabs(categories, activeCategory);
  renderCategoryItems(grouped.find(([name]) => name === activeCategory)?.[1] || []);

  categoryTabs?.querySelectorAll(".kc-category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      const name = btn.dataset.category;
      categoryTabs
        .querySelectorAll(".kc-category-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      const items = grouped.find(([cat]) => cat === name)?.[1] || [];
      renderCategoryItems(items);
    });
  });

  productsGrid.querySelectorAll("button[data-action]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const action = btn.dataset.action;
      const id = btn.dataset.id;
      if (action === "edit") {
        openEditModal(id);
      }
      if (action === "toggle") {
        await withButtonLoading(
          btn,
          async () => {
            try {
              const currentActive = btn.dataset.active === "true";
              await updateProduct(id, { isActive: !currentActive });
              await showSuccessPopup("Product status updated.", "Saved");
              loadProducts();
            } catch (error) {
              await showErrorPopup(error.message || "Failed to update product.", "Update Failed");
            }
          },
          "Saving..."
        );
      }
      if (action === "delete") {
        const confirmed = await showConfirmPopup(
          "Delete this product permanently?",
          "Confirm Delete",
          "Delete",
          "Cancel",
          { dangerous: true }
        );
        if (!confirmed) return;
        await withButtonLoading(
          btn,
          async () => {
            await deleteProduct(id);
            await showSuccessPopup("Product deleted.", "Removed");
            loadProducts();
          },
          "Deleting..."
        );
      }
    });
  });
}

async function loadProducts() {
  if (!managerProfile) return;
  const products = await getRestaurantProducts(managerProfile.restaurantId, 220);
  currentProducts = products;
  renderProducts(products);
}

function openEditModal(productId) {
  const product = currentProducts.find((p) => p.id === productId);
  if (!product || !editModal) return;

  document.getElementById("editProductId").value = product.id;
  document.getElementById("editProductName").value = product.name || "";
  const category = product.category || "";
  if (editCategorySelect) {
    const optionExists = Array.from(editCategorySelect.options).some((o) => o.value === category);
    editCategorySelect.value = optionExists ? category : "__other__";
  }
  if (editCategoryInput) {
    if (category && (!editCategorySelect || editCategorySelect.value === "__other__")) {
      editCategoryInput.style.display = "block";
      editCategoryInput.value = category;
    } else {
      editCategoryInput.style.display = "none";
      editCategoryInput.value = "";
    }
  }
  document.getElementById("editProductDescription").value = product.description || "";
  document.getElementById("editProductPrice").value = Number(product.price || 0);
  document.getElementById("editProductOldPrice").value = Number(product.oldPrice || 0) || "";
  document.getElementById("editProductDiscount").value = Number(product.discountPercent || 0) || "";
  document.getElementById("editProductBadge").value = product.badge || "";
  document.getElementById("editProductBestSeller").value = String(Boolean(product.isBestSeller));
  document.getElementById("editProductActive").value = String(product.isActive !== false);

  editModal.classList.add("open");
  editModal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  editModal?.classList.remove("open");
  editModal?.setAttribute("aria-hidden", "true");
  editForm?.reset();
  const imageInput = document.getElementById("editProductImage");
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

productImageBtn?.addEventListener("click", () => productImageInput?.click());
productImageInput?.addEventListener("change", () => {
  const file = productImageInput.files?.[0];
  if (productImageName) productImageName.textContent = file ? file.name : "No file selected";
});

editImageBtn?.addEventListener("click", () => editImageInput?.click());
editImageInput?.addEventListener("change", () => {
  const file = editImageInput.files?.[0];
  if (editImageName) editImageName.textContent = file ? file.name : "No file selected";
});

// معالج تغيير الكاتيجوري في نموذج الإضافة
categorySelect?.addEventListener("change", () => {
  if (!categoryInput) return;
  if (categorySelect.value === "__other__") {
    categoryInput.style.display = "block";
    categoryInput.value = "";
    categoryInput.focus();
  } else {
    categoryInput.style.display = "none";
    categoryInput.value = categorySelect.value || "";
  }
});

// معالج الكتابة في حقل الفئة الجديدة
categoryInput?.addEventListener("input", () => {
  if (categoryInput.value.trim()) {
    categorySelect.value = "__other__";
  }
});

// معالج تغيير الكاتيجوري في نموذج التحرير
editCategorySelect?.addEventListener("change", () => {
  if (!editCategoryInput) return;
  if (editCategorySelect.value === "__other__") {
    editCategoryInput.style.display = "block";
    editCategoryInput.value = "";
    editCategoryInput.focus();
  } else {
    editCategoryInput.style.display = "none";
    editCategoryInput.value = editCategorySelect.value || "";
  }
});

// معالج الكتابة في حقل الفئة الجديدة في التحرير
editCategoryInput?.addEventListener("input", () => {
  if (editCategoryInput.value.trim()) {
    editCategorySelect.value = "__other__";
  }
});

editForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = editForm.querySelector('[type="submit"]');
  const productId = document.getElementById("editProductId").value;
  if (!productId) return;

  const name = document.getElementById("editProductName").value.trim();
  const category =
    (editCategorySelect?.value === "__other__"
      ? editCategoryInput?.value
      : editCategorySelect?.value) || "";
  const description = document.getElementById("editProductDescription").value.trim();
  const price = document.getElementById("editProductPrice").value;
  const oldPrice = document.getElementById("editProductOldPrice").value;
  const discountPercent = document.getElementById("editProductDiscount").value;
  const badge = document.getElementById("editProductBadge").value;
  const isBestSeller = document.getElementById("editProductBestSeller").value === "true";
  const isActive = document.getElementById("editProductActive").value === "true";
  const imageFile = document.getElementById("editProductImage").files?.[0];

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

  await withButtonLoading(
    submitBtn,
    async () => {
      await updateProduct(productId, patch);
      await showSuccessPopup("Product updated.", "Saved");
      closeEditModal();
      loadProducts();
    },
    "Saving..."
  );
});

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!managerProfile) return;
  const submitBtn = form.querySelector('[type="submit"]');

  const name = document.getElementById("productName").value.trim();
  const category =
    (categorySelect?.value === "__other__" ? categoryInput?.value : categorySelect?.value) || "";
  const description = document.getElementById("productDescription").value.trim();
  const price = document.getElementById("productPrice").value;
  const oldPrice = document.getElementById("productOldPrice").value;
  const discountPercent = document.getElementById("productDiscount").value;
  const badge = document.getElementById("productBadge").value;
  const isBestSeller = document.getElementById("productBestSeller").value === "true";
  const imageFile = document.getElementById("productImage").files?.[0];

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

  await withButtonLoading(
    submitBtn,
    async () => {
      await addProduct({
        restaurantId: managerProfile.restaurantId,
        restaurantName: managerProfile.restaurantName || "",
        name,
        category,
        description,
        price,
        oldPrice,
        discountPercent,
        badge,
        isBestSeller,
        imageUrl,
      });

      form.reset();
      await showSuccessPopup("Product added successfully.", "Saved");
      loadProducts();
    },
    "Saving..."
  );
});

async function init() {
  mountManagerHeader({ active: "products" });
  const state = await guardManagerPage();
  if (!state) return;
  managerProfile = state.profile;
  renderManagerMiniProfile("managerMini", state.profile);
  loadProducts();
}

init();
