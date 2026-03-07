import { guardStudentPage, mountHeader, renderStudentMiniProfile } from "./student-common.js";
import { restaurants } from "./data/restaurants.js";

function renderStars(rating) {
  const full = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < full ? "filled" : "empty";
    return `<span class="kc-pixel-star ${filled}" aria-hidden="true"></span>`;
  }).join("");
}

function renderRestaurants() {
  const root = document.getElementById("menuRoot");

  root.innerHTML = restaurants
    .map(
      (r) => `
      <article class="kc-card kc-restaurant-card">
        <img class="kc-restaurant-thumb" src="${r.image}" alt="${r.name}" />
        <div class="kc-restaurant-body">
          <h3 class="kc-title">${r.name}</h3>
          <div class="kc-stars" aria-label="Rating ${r.rating} out of 5">
            <span class="kc-stars-line">${renderStars(r.rating)}</span>
            <span class="kc-muted">${r.rating} (${r.reviews} reviews)</span>
          </div>
          <div class="kc-inline kc-muted">
            <span>${r.deliveryTime}</span>
            <span>•</span>
            <span>${r.priceRange}</span>
            <span>•</span>
            <span>${r.categories.length} sections</span>
          </div>
          <a class="kc-btn" href="./restaurant.html?id=${encodeURIComponent(r.id)}">Open Restaurant</a>
        </div>
      </article>
    `
    )
    .join("");
}

async function init() {
  mountHeader({ active: "menu" });
  const state = await guardStudentPage();
  if (!state) return;

  renderStudentMiniProfile("studentMini", state.profile);
  renderRestaurants();
}

init();
