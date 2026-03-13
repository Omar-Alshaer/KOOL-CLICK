import { auth } from "./config/firebase.js";
import { getCurrentClickerProfile, logoutUser, watchAuthState } from "./services/auth-service.js";
import { getLevelFromPoints } from "./utils/levels.js";
import { showConfirmPopup, showErrorPopup } from "./utils/popup.js";
import { getCart } from "./utils/storage.js";

function getCartCount() {
  return getCart().reduce((sum, item) => sum + (item.qty || 1), 0);
}

export function updateCartBadge() {
  const badge = document.getElementById("kcCartBadge");
  if (!badge) return;
  const count = getCartCount();
  badge.textContent = count;
  badge.style.display = count > 0 ? "flex" : "none";
}

export async function guardClickerPage() {
  return new Promise((resolve) => {
    watchAuthState(async (user) => {
      if (!user) {
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      const profile = await getCurrentClickerProfile(user.uid, { forceFresh: true });
      if (!profile) {
        await logoutUser();
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      resolve({ uid: user.uid, profile });
    });
  });
}

export function mountHeader({ active = "" }) {
  const host = document.getElementById("kcHeader");
  if (!host) return;
  document.body.classList.add("kc-with-sidebar");

  host.innerHTML = `
    <div class="kc-topbar">
      <div class="kc-topbar-brand">
        <img class="kc-topbar-logo" src="../../assets/brand/logo_trans.svg" alt="Kool Click Logo" />
      </div>
      <nav class="kc-topbar-nav">
        <a class="kc-topbar-link ${active === "home" ? "is-active" : ""}" href="./home.html"><span class="kc-topbar-ico">🏠</span><span class="kc-topbar-txt">Home</span></a>
        <a class="kc-topbar-link ${active === "menu" ? "is-active" : ""}" href="./menu.html"><span class="kc-topbar-ico">🍽️</span><span class="kc-topbar-txt">Menu</span></a>
        <a class="kc-topbar-link ${active === "cart" ? "is-active" : ""}" href="./cart.html"><span class="kc-topbar-ico">🛒</span><span class="kc-topbar-txt">Cart</span><span id="kcCartBadge" class="kc-cart-badge" style="display:none">0</span></a>
        <a class="kc-topbar-link ${active === "orders" ? "is-active" : ""}" href="./orders.html"><span class="kc-topbar-ico">📦</span><span class="kc-topbar-txt">Orders</span></a>
        <a class="kc-topbar-link ${active === "profile" ? "is-active" : ""}" href="./profile.html"><span class="kc-topbar-ico">👤</span><span class="kc-topbar-txt">Profile</span></a>
        <button id="logoutBtn" class="kc-topbar-link kc-topbar-danger" type="button"><span class="kc-topbar-ico">⏻</span><span class="kc-topbar-txt">Logout</span></button>
      </nav>
    </div>
  `;

  const toggleNode = host.querySelector(".kc-topbar-brand");

  // Update cart badge immediately then listen for changes
  updateCartBadge();
  window.addEventListener("storage", (e) => {
    if (e.key === "koolclick_clicker_cart") updateCartBadge();
  });
  // Also update on focus (when user comes back from cart page)
  window.addEventListener("focus", updateCartBadge);
  const sidebarStateKey = "kc_sidebar_collapsed";
  const applyCollapsed = (collapsed) => {
    document.body.classList.toggle("kc-sidebar-collapsed", collapsed);
    if (toggleNode) toggleNode.setAttribute("aria-expanded", String(!collapsed));
  };
  const canUseSidebarCollapse = () => window.matchMedia("(min-width: 801px)").matches;

  if (canUseSidebarCollapse()) {
    applyCollapsed(localStorage.getItem(sidebarStateKey) === "1");
  } else {
    applyCollapsed(true); // Mobile: start with nav hidden
  }

  const toggleSidebar = () => {
    const nextCollapsed = !document.body.classList.contains("kc-sidebar-collapsed");
    applyCollapsed(nextCollapsed);
    if (canUseSidebarCollapse()) {
      localStorage.setItem(sidebarStateKey, nextCollapsed ? "1" : "0");
    }
  };
  if (toggleNode) {
    toggleNode.setAttribute("role", "button");
    toggleNode.setAttribute("tabindex", "0");
    toggleNode.setAttribute("aria-label", "Toggle sidebar");
    toggleNode.addEventListener("click", toggleSidebar);
    toggleNode.addEventListener("keydown", (event) => {
      if (event.key !== "Enter" && event.key !== " ") return;
      event.preventDefault();
      toggleSidebar();
    });
  }

  const logoutBtn = document.getElementById("logoutBtn");
  logoutBtn?.addEventListener("click", async () => {
    const confirmed = await showConfirmPopup(
      "Are you sure you want to log out now?",
      "Confirm Logout",
      "Logout",
      "Stay"
    );
    if (!confirmed) return;

    await logoutUser();
    window.location.href = "./login.html";
  });
}

export function renderClickerMiniProfile(targetId, profile) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const points = Number(profile.points || 0);
  const level = getLevelFromPoints(points);
  const pointsClass = points < 0 ? "kc-points-negative" : "kc-points-positive";
  el.innerHTML = `
    <div class="kc-inline">
      <img src="../../assets/Characters/${profile.avatar}" alt="Avatar" width="54" height="54" style="image-rendering: pixelated; border: 2px solid #4b067f" />
      <div>
        <div><strong>${profile.fullName}</strong>${profile.username ? ` <span class="kc-muted" style="font-size:0.82em">@${profile.username}</span>` : ""}</div>
        <div class="kc-muted">Points: <span class="${pointsClass}">${points}</span> | ${level.name} (L${level.level})</div>
      </div>
    </div>
  `;
}

export function requireFirebaseConfig() {
  if (!auth.app.options.apiKey) {
    showErrorPopup(
      "Please add Firebase config in /public/js/config/firebase.js before using the app.",
      "Firebase Config Missing"
    );
    return false;
  }
  return true;
}
