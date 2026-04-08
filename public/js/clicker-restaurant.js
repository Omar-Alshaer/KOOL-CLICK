import { guardClickerPage, mountHeader, renderClickerMiniProfile, updateCartBadge } from "./clicker-common.js";
import { getRestaurantById, getRestaurantProducts } from "./services/restaurant-service.js";
import { getOfferById } from "./services/offers-service.js";
import { getCart, saveCart } from "./utils/storage.js";
import { showErrorPopup, showSuccessPopup } from "./utils/popup.js";
import { escapeHtml, sanitizeUrl } from "./utils/dom.js";

function renderStars(rating) {
  const full = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < full ? "filled" : "empty";
    return `<span class="kc-pixel-star ${filled}" aria-hidden="true"></span>`;
  }).join("");
}

function getRestaurantIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("id") || "";
}

function getOfferIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  return params.get("offer") || "";
}

function normalizeOfferValue(value) {
  if (!value) return "";
  return String(value).trim();
}

function computeOfferPrice(basePrice, offer) {
  const price = Number(basePrice || 0);
  if (!offer) return price;
  if (offer.discountType === "flat") {
    return Math.max(0, price - Number(offer.discountValue || 0));
  }
  const percent = Number(offer.discountValue || 0);
  return Math.max(0, price * (1 - percent / 100));
}

function applyOfferToProducts(products, offer) {
  if (!offer) return products;
  const targetType = offer.targetType || "";
  const targetValue = normalizeOfferValue(offer.targetValue);

  return products.map((product) => {
    let matches = false;
    if (targetType === "product") {
      matches =
        normalizeOfferValue(product.id) === targetValue ||
        normalizeOfferValue(product.name) === targetValue;
    } else if (targetType === "section") {
      matches = normalizeOfferValue(product.category || "General") === targetValue;
    }

    if (!matches) return product;

    const basePrice = Number(product.price || 0);
    const offerPrice = computeOfferPrice(basePrice, offer);
    if (offerPrice >= basePrice) return product;

    return {
      ...product,
      offerApplied: true,
      offerId: offer.id,
      offerTitle: offer.title || "Offer",
      offerPrice,
      offerOldPrice: basePrice,
      offerDiscountPercent:
        offer.discountType === "percent" ? Number(offer.discountValue || 0) : null,
      offerDiscountFlat:
        offer.discountType === "flat" ? Number(offer.discountValue || 0) : null,
    };
  });
}

function upsertItemToCart(item) {
  const cart = getCart();
  const existing = cart.find((x) => x.menuId === item.menuId && x.restaurantId === item.restaurantId);

  if (existing) {
    existing.qty += 1;
    existing.price = Number(item.price);
    existing.offerId = item.offerId || "";
    existing.offerTitle = item.offerTitle || "";
    existing.offerLabel = item.offerLabel || "";
    existing.basePrice = item.basePrice ?? null;
  } else {
    cart.push({ ...item, qty: 1 });
  }

  saveCart(cart);
}

function buildItemsMarkup(category, restaurant, products) {
  return products
    .map(
      (m) => {
        const safeName = escapeHtml(m.name || "");
        const safeDesc = escapeHtml(m.description || "");
        const safeBadge = escapeHtml(m.badge || "");
        const safeRestaurantName = escapeHtml(restaurant.name || "");
        const displayPrice = m.offerApplied ? m.offerPrice : m.price;
        const displayOldPrice = m.offerApplied ? m.offerOldPrice : m.oldPrice;
        const displayDiscount = m.offerApplied
          ? m.offerDiscountPercent
          : m.discountPercent;
        const displayFlatDiscount = m.offerApplied ? m.offerDiscountFlat : null;
        const discountBadgeText = displayDiscount
          ? `-${displayDiscount}%`
          : displayFlatDiscount
            ? `-${Number(displayFlatDiscount).toFixed(0)} EGP`
            : "";
        const offerBadge = m.offerApplied ? `<span class="kc-badge kc-badge-offer">Offer</span>` : "";
        const isActive = !(m.isActive === false || m.isActive === "false");
        const safeImage = sanitizeUrl(m.imageUrl) || "../../assets/brand/logo.svg";
        return `
        <article class="kc-item kc-menu-item ${isActive ? "" : "kc-item-disabled"}">
          <div class="kc-menu-thumb">
            <img src="${safeImage}" alt="${safeName}" />
          </div>
          <div class="kc-menu-body">
            <strong>${safeName}</strong>
            <div class="kc-muted">${safeDesc}</div>
            <div class="kc-price-line kc-section-spaced-2xs">
              <span class="kc-price">${Number(displayPrice || 0).toFixed(2)} EGP</span>
              ${
                displayOldPrice && Number(displayOldPrice) > Number(displayPrice)
                  ? `<span class="kc-old-price">${Number(displayOldPrice).toFixed(2)} EGP</span>`
                  : ""
              }
              ${discountBadgeText ? `<span class="kc-badge kc-badge-discount">${discountBadgeText}</span>` : ""}
              ${offerBadge}
              ${m.isBestSeller ? `<span class="kc-badge">Best Seller</span>` : ""}
              ${safeBadge ? `<span class="kc-badge">${safeBadge}</span>` : ""}
              ${isActive ? "" : `<span class="kc-badge kc-badge-soldout">Sold Out</span>`}
            </div>
            <div class="kc-inline kc-inline-between kc-section-spaced-xs">
              <button
                type="button"
                data-menu-id="${m.id}"
                data-restaurant-id="${restaurant.id}"
                data-restaurant-name="${encodeURIComponent(restaurant.name || "")}"
                data-name="${encodeURIComponent(m.name || "")}"
                data-price="${displayPrice}"
                data-offer-id="${m.offerId || ""}"
                data-base-price="${m.offerOldPrice || ""}"
                data-offer-title="${encodeURIComponent(m.offerTitle || "")}"
                data-offer-label="${discountBadgeText || ""}"
                data-active="${isActive ? "true" : "false"}"
                ${isActive ? "" : "disabled"}
              >${isActive ? "Add" : "Sold Out"}</button>
            </div>
          </div>
        </article>
      `;
      }
    )
    .join("");
}

function renderRestaurantPage(restaurant, products, offer) {
  const root = document.getElementById("restaurantRoot");
  if (!products.length) {
    root.innerHTML = `
      <section class="kc-card">
        <h2 class="kc-title">${escapeHtml(restaurant.name || "")}</h2>
        <p class="kc-muted">No products available yet.</p>
      </section>
    `;
    return;
  }
  const categories = [...new Set(products.map((p) => p.category || "General"))]
    .map((name) => ({
      id: String(name || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, ""),
      name: escapeHtml(name || "General"),
      rawName: String(name || "General"),
    }));
  const defaultCategory = categories[0]?.id || "";
  const offeredCategories = new Set(
    products
      .filter((p) => p.offerApplied)
      .map((p) => String(p.category || "General").toLowerCase())
  );

  const safeRestaurantName = escapeHtml(restaurant.name || "");
  const safeRestaurantZone = escapeHtml(restaurant.campusZone || "Campus");
  const safeRestaurantLogo = sanitizeUrl(restaurant.logoUrl) || "../../assets/brand/logo.svg";
  const safeOfferTitle = escapeHtml(offer?.title || "Offer");
  const safeOfferDesc = escapeHtml(offer?.description || "");

  root.innerHTML = `
    <section class="kc-card kc-restaurant-hero">
      <img class="kc-restaurant-thumb" src="${safeRestaurantLogo}" alt="${safeRestaurantName}" />
      <div>
        <h1 class="kc-title">${safeRestaurantName}</h1>
        ${
          restaurant.rating
            ? `<div class="kc-stars">
                <span class="kc-stars-line">${renderStars(restaurant.rating)}</span>
                <span class="kc-muted">${restaurant.rating} (${restaurant.reviews || 0} reviews)</span>
              </div>`
            : `<div class="kc-muted">New restaurant • No rating yet</div>`
        }
        <div class="kc-inline kc-muted"><span>${safeRestaurantZone}</span></div>
      </div>
    </section>

    <section class="kc-card">
      <h2 class="kc-title">Sections</h2>
      ${
        offer
          ? `
            <div class="kc-offer-note">
              <strong>${safeOfferTitle}</strong>
              <span class="kc-muted">${safeOfferDesc}</span>
              <span class="kc-badge kc-badge-discount">${offer.discountType === "flat" ? `-${Number(offer.discountValue || 0).toFixed(0)} EGP` : `-${Number(offer.discountValue || 0).toFixed(0)}%`}</span>
            </div>
          `
          : ""
      }
      <div id="categoryTabs" class="kc-category-tabs">
        ${categories
          .map(
            (c) => `
              <button type="button" class="kc-category-btn ${c.id === defaultCategory ? "active" : ""}" data-category="${c.id}">
                ${c.name}
                ${offeredCategories.has(c.rawName.toLowerCase()) ? `<span class="kc-category-badge">Offer</span>` : ""}
              </button>
            `
          )
          .join("")}
      </div>

      <div id="categoryItems" class="kc-grid kc-section-spaced-sm"></div>
    </section>
  `;

  const itemsRoot = document.getElementById("categoryItems");

  const renderCategoryItems = (categoryId) => {
    const category = categories.find((c) => c.id === categoryId);
    if (!category) {
      itemsRoot.innerHTML = '<div class="kc-note">No items in this section.</div>';
      return;
    }

    const categoryProducts = products.filter((p) => (p.category || "General") === category.rawName);
    itemsRoot.innerHTML = `
      <h3 class="kc-title kc-title-no-margin">${category.name}</h3>
      <div class="kc-grid kc-menu-items-grid">${buildItemsMarkup(category, restaurant, categoryProducts)}</div>
    `;

    itemsRoot.querySelectorAll("button[data-menu-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (btn.dataset.active === "false") {
          await showErrorPopup("This item is sold out right now.", "Sold Out");
          return;
        }
        upsertItemToCart({
          menuId: btn.dataset.menuId,
          restaurantId: btn.dataset.restaurantId,
          restaurantName: decodeURIComponent(btn.dataset.restaurantName || ""),
          name: decodeURIComponent(btn.dataset.name || ""),
          price: Number(btn.dataset.price),
          offerId: btn.dataset.offerId || "",
          offerTitle: decodeURIComponent(btn.dataset.offerTitle || ""),
          offerLabel: btn.dataset.offerLabel || "",
          basePrice: btn.dataset.basePrice ? Number(btn.dataset.basePrice) : null,
        });
        updateCartBadge();
        await showSuccessPopup(`${btn.dataset.name} added to cart.`, "Added to Cart");
      });
    });
  };

  renderCategoryItems(defaultCategory);

  document.querySelectorAll(".kc-category-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".kc-category-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      renderCategoryItems(btn.dataset.category);
    });
  });
}

async function init() {
  mountHeader({ active: "menu" });
  const state = await guardClickerPage();
  if (!state) return;

  renderClickerMiniProfile("clickerMini", state.profile);

  const restaurantId = getRestaurantIdFromUrl();
  const offerId = getOfferIdFromUrl();
  const restaurant = await getRestaurantById(restaurantId);
  if (!restaurant) {
    await showErrorPopup("Restaurant not found.", "Invalid Restaurant");
    window.location.href = "./menu.html";
    return;
  }

  const products = await getRestaurantProducts(restaurant.id, 300, false);
  let offer = null;
  if (offerId) {
    offer = await getOfferById(offerId);
  }
  const safeOffer = offer && offer.restaurantId === restaurant.id ? offer : null;
  const updatedProducts = applyOfferToProducts(products, safeOffer);
  renderRestaurantPage(restaurant, updatedProducts, safeOffer);
}

init();
