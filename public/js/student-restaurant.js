import { guardStudentPage, mountHeader, renderStudentMiniProfile } from "./student-common.js";
import { restaurants } from "./data/restaurants.js";
import { getCart, saveCart } from "./utils/storage.js";
import { showErrorPopup, showSuccessPopup } from "./utils/popup.js";

function renderStars(rating) {
  const full = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < full ? "filled" : "empty";
    return `<span class="kc-pixel-star ${filled}" aria-hidden="true"></span>`;
  }).join("");
}

function getRestaurantByUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get("id");
  return restaurants.find((r) => r.id === id) || null;
}

function upsertItemToCart(item) {
  const cart = getCart();
  const existing = cart.find((x) => x.menuId === item.menuId && x.restaurantId === item.restaurantId);

  if (existing) {
    existing.qty += 1;
  } else {
    cart.push({ ...item, qty: 1 });
  }

  saveCart(cart);
}

function buildItemsMarkup(category, restaurant) {
  return category.items
    .map(
      (m) => `
        <article class="kc-item">
          <strong>${m.name}</strong>
          <div class="kc-muted">${m.desc}</div>
          <div class="kc-inline" style="justify-content: space-between; margin-top: 0.55rem">
            <span>${m.price} EGP</span>
            <button
              type="button"
              data-menu-id="${m.id}"
              data-restaurant-id="${restaurant.id}"
              data-restaurant-name="${restaurant.name}"
              data-name="${m.name}"
              data-price="${m.price}"
            >Add</button>
          </div>
        </article>
      `
    )
    .join("");
}

function renderRestaurantPage(restaurant) {
  const root = document.getElementById("restaurantRoot");
  const defaultCategory = restaurant.categories[0]?.id || "";

  root.innerHTML = `
    <section class="kc-card kc-restaurant-hero">
      <img class="kc-restaurant-thumb" src="${restaurant.image}" alt="${restaurant.name}" />
      <div>
        <h1 class="kc-title">${restaurant.name}</h1>
        <div class="kc-stars">
          <span class="kc-stars-line">${renderStars(restaurant.rating)}</span>
          <span class="kc-muted">${restaurant.rating} (${restaurant.reviews} reviews)</span>
        </div>
        <div class="kc-inline kc-muted">
          <span>${restaurant.deliveryTime}</span>
          <span>•</span>
          <span>${restaurant.priceRange}</span>
        </div>
      </div>
    </section>

    <section class="kc-card">
      <h2 class="kc-title">Sections</h2>
      <div id="categoryTabs" class="kc-category-tabs">
        ${restaurant.categories
          .map(
            (c) => `
              <button type="button" class="kc-category-btn ${c.id === defaultCategory ? "active" : ""}" data-category="${c.id}">
                ${c.name}
              </button>
            `
          )
          .join("")}
      </div>

      <div id="categoryItems" class="kc-grid" style="margin-top: 0.8rem"></div>
    </section>
  `;

  const itemsRoot = document.getElementById("categoryItems");

  const renderCategoryItems = (categoryId) => {
    const category = restaurant.categories.find((c) => c.id === categoryId);
    if (!category) {
      itemsRoot.innerHTML = '<div class="kc-note">No items in this section.</div>';
      return;
    }

    itemsRoot.innerHTML = `
      <h3 class="kc-title" style="margin-bottom: 0">${category.name}</h3>
      <div class="kc-grid kc-menu-items-grid">${buildItemsMarkup(category, restaurant)}</div>
    `;

    itemsRoot.querySelectorAll("button[data-menu-id]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        upsertItemToCart({
          menuId: btn.dataset.menuId,
          restaurantId: btn.dataset.restaurantId,
          restaurantName: btn.dataset.restaurantName,
          name: btn.dataset.name,
          price: Number(btn.dataset.price),
        });

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
  const state = await guardStudentPage();
  if (!state) return;

  renderStudentMiniProfile("studentMini", state.profile);

  const restaurant = getRestaurantByUrl();
  if (!restaurant) {
    await showErrorPopup("Restaurant not found.", "Invalid Restaurant");
    window.location.href = "./menu.html";
    return;
  }

  renderRestaurantPage(restaurant);
}

init();
