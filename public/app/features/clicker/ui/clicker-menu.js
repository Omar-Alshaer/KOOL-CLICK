import { guardClickerPage, mountHeader, renderClickerMiniProfile } from "./clicker-common.js";
import { getRestaurants } from "../../../shared/services/restaurant-service.js";
import { escapeHtml, sanitizeUrl } from "../../../core/utils/dom.js";

function renderStars(rating) {
  const full = Math.round(rating);
  return Array.from({ length: 5 }, (_, i) => {
    const filled = i < full ? "filled" : "empty";
    return `<span class="kc-pixel-star ${filled}" aria-hidden="true"></span>`;
  }).join("");
}

function renderRestaurants(restaurants) {
  const root = document.getElementById("menuRoot");
  if (!restaurants.length) {
    root.innerHTML = `
      <div class="kc-empty-state">
        <div class="kc-empty-icon">🏬</div>
        <h3 class="kc-empty-title">No restaurants yet</h3>
        <p class="kc-empty-msg">Admins will add restaurants soon.</p>
      </div>
    `;
    return;
  }

  root.innerHTML = restaurants
    .map((r) => {
      const safeName = escapeHtml(r.name || "");
      const safeZone = escapeHtml(r.campusZone || "Campus");
      const safeLogo = sanitizeUrl(r.logoUrl) || "../../assets/brand/logo.svg";
      return `
      <article class="kc-card kc-restaurant-card">
        <img class="kc-restaurant-thumb" src="${safeLogo}" alt="${safeName}" />
        <div class="kc-restaurant-body">
          <h3 class="kc-title">${safeName}</h3>
          ${
            r.rating
              ? `<div class="kc-stars" aria-label="Rating ${r.rating} out of 5">
                  <span class="kc-stars-line">${renderStars(r.rating)}</span>
                  <span class="kc-muted">${r.rating} (${r.reviews || 0} reviews)</span>
                </div>`
              : `<div class="kc-muted">New restaurant • No rating yet</div>`
          }
          <div class="kc-inline kc-muted">
            <span>${safeZone}</span>
          </div>
          <a class="kc-btn" href="./restaurant.html?id=${encodeURIComponent(r.id)}">Open Restaurant</a>
        </div>
      </article>
    `;
    })
    .join("");
}

async function init() {
  mountHeader({ active: "menu" });
  const state = await guardClickerPage();
  if (!state) return;

  renderClickerMiniProfile("clickerMini", state.profile);

  const restaurants = await getRestaurants(200);
  renderRestaurants(restaurants);
}

init();
