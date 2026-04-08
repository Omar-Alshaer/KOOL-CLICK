import { guardClickerPage, mountHeader, renderClickerMiniProfile } from "./clicker-common.js";
import { APP_CONFIG } from "./config/app-config.js";
import { getActiveOffers } from "./services/offers-service.js";
import { getRestaurants } from "./services/restaurant-service.js";
import { escapeHtml, sanitizeUrl } from "./utils/dom.js";

function formatOfferDiscount(offer) {
  if (!offer) return "";
  if (offer.discountType === "flat") {
    return `-${Number(offer.discountValue || 0).toFixed(0)} EGP`;
  }
  return `-${Number(offer.discountValue || 0).toFixed(0)}%`;
}

function renderOfferBanner(offers, restaurants) {
  const banner = document.getElementById("offerBanner");
  const track = document.getElementById("offerTrack");
  if (!banner || !track) return;

  if (!offers.length) {
    banner.classList.add("kc-hidden");
    return;
  }

  const restaurantMap = new Map(restaurants.map((r) => [r.id, r]));

  track.innerHTML = offers
    .map((offer) => {
      const restaurant = restaurantMap.get(offer.restaurantId) || {};
      const imageUrl = sanitizeUrl(offer.imageUrl) || sanitizeUrl(restaurant.logoUrl) || "../../assets/brand/logo.svg";
      const restaurantName = escapeHtml(offer.restaurantName || restaurant.name || "Restaurant");
      const targetLabel = escapeHtml(offer.targetLabel || offer.targetValue || "Offer");
      const targetLine =
        offer.targetType === "section"
          ? `Section: ${targetLabel}`
          : offer.targetType === "product"
            ? `Product: ${targetLabel}`
            : targetLabel;
      const detail = escapeHtml(offer.description || targetLine);
      const safeTitle = escapeHtml(offer.title || "Offer");

      return `
        <article class="kc-offer-card">
          <div class="kc-offer-thumb">
            <img src="${imageUrl}" alt="${safeTitle}" />
          </div>
          <div class="kc-offer-body">
            <div class="kc-offer-top">
              <strong>${safeTitle}</strong>
              <span class="kc-badge kc-badge-discount">${formatOfferDiscount(offer)}</span>
            </div>
            <div class="kc-muted">${detail}</div>
            <div class="kc-muted">Restaurant: ${restaurantName}</div>
            <a class="kc-btn" href="./restaurant.html?id=${encodeURIComponent(offer.restaurantId || "")}&offer=${encodeURIComponent(offer.id || "")}">
              Get Offer
            </a>
          </div>
        </article>
      `;
    })
    .join("");

  const cardsCount = offers.length;
  let currentIndex = 0;
  let autoTimer = null;
  let scrollTick = false;

  const goTo = (index) => {
    if (!cardsCount) return;
    currentIndex = (index + cardsCount) % cardsCount;
    const left = track.clientWidth * currentIndex;
    track.scrollTo({ left, behavior: "smooth" });
  };

  const startAuto = () => {
    if (autoTimer) clearInterval(autoTimer);
    autoTimer = setInterval(() => goTo(currentIndex + 1), 5000);
  };

  track.addEventListener("scroll", () => {
    if (scrollTick) return;
    scrollTick = true;
    window.requestAnimationFrame(() => {
      const nextIndex = Math.round(track.scrollLeft / track.clientWidth);
      if (!Number.isNaN(nextIndex)) {
        currentIndex = Math.max(0, Math.min(cardsCount - 1, nextIndex));
      }
      scrollTick = false;
    });
  });

  window.addEventListener("resize", () => goTo(currentIndex));
  startAuto();
}

async function init() {
  mountHeader({ active: "home" });
  const state = await guardClickerPage();
  if (!state) return;

  renderClickerMiniProfile("clickerMini", state.profile);

  document.getElementById("statusFlow").textContent = APP_CONFIG.orderStatuses.join(" -> ");

  const [offers, restaurants] = await Promise.all([
    getActiveOffers(12),
    getRestaurants(200),
  ]);
  renderOfferBanner(offers, restaurants);
}

init();
