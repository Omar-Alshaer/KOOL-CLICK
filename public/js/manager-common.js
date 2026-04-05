import { showConfirmPopup } from "./utils/popup.js";
import {
  getCurrentManagerProfile,
  logoutManager,
  watchManagerAuthState,
} from "./services/manager-service.js";

let authSplashMounted = false;

function showAuthSplash() {
  if (authSplashMounted) return;
  authSplashMounted = true;
  document.body.classList.add("kc-auth-loading");
  const splash = document.createElement("div");
  splash.id = "kcAuthSplash";
  splash.innerHTML = `
    <div class="kc-auth-splash-card">
      <img src="../../assets/brand/logo_trans.svg" alt="Kool Click Logo" />
      <div class="kc-auth-splash-text">Loading manager session...</div>
    </div>
  `;
  document.body.appendChild(splash);
}

function hideAuthSplash() {
  document.body.classList.remove("kc-auth-loading");
  const splash = document.getElementById("kcAuthSplash");
  if (splash) splash.remove();
  authSplashMounted = false;
}

export async function guardManagerPage() {
  showAuthSplash();
  return new Promise((resolve) => {
    watchManagerAuthState(async (user) => {
      if (!user) {
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      const profile = await getCurrentManagerProfile(user.uid);
      if (!profile) {
        await logoutManager();
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      hideAuthSplash();
      resolve({ uid: user.uid, profile });
    });
  });
}

export function mountManagerHeader({ active = "dashboard" } = {}) {
  const host = document.getElementById("kcHeader");
  if (!host) return;
  document.body.classList.add("kc-with-sidebar");

  host.innerHTML = `
    <div class="kc-topbar">
      <div class="kc-topbar-brand">
        <img class="kc-topbar-logo" src="../../assets/brand/logo_trans.svg" alt="Kool Click Logo" />
      </div>
      <nav class="kc-topbar-nav">
        <a class="kc-topbar-link ${active === "dashboard" ? "is-active" : ""}" href="./dashboard.html"><span class="kc-topbar-ico">📊</span><span class="kc-topbar-txt">Dashboard</span></a>
        <a class="kc-topbar-link ${active === "products" ? "is-active" : ""}" href="./products.html"><span class="kc-topbar-ico">🍔</span><span class="kc-topbar-txt">Products</span></a>
        <a class="kc-topbar-link ${active === "catalog" ? "is-active" : ""}" href="./products-view.html"><span class="kc-topbar-ico">🧾</span><span class="kc-topbar-txt">Catalog</span></a>
        <a class="kc-topbar-link ${active === "offers" ? "is-active" : ""}" href="./offers.html"><span class="kc-topbar-ico">🏷️</span><span class="kc-topbar-txt">Offers</span></a>
        <a class="kc-topbar-link ${active === "reports" ? "is-active" : ""}" href="./reports.html"><span class="kc-topbar-ico">📈</span><span class="kc-topbar-txt">Reports</span></a>
        <button id="logoutBtn" class="kc-topbar-link kc-topbar-danger" type="button"><span class="kc-topbar-ico">⏻</span><span class="kc-topbar-txt">Logout</span></button>
      </nav>
    </div>
  `;

  const toggleNode = host.querySelector(".kc-topbar-brand");
  const sidebarStateKey = "kc_sidebar_collapsed";
  const applyCollapsed = (collapsed) => {
    document.body.classList.toggle("kc-sidebar-collapsed", collapsed);
    if (toggleNode) toggleNode.setAttribute("aria-expanded", String(!collapsed));
  };
  const canUseSidebarCollapse = () => window.matchMedia("(min-width: 801px)").matches;

  if (canUseSidebarCollapse()) {
    applyCollapsed(localStorage.getItem(sidebarStateKey) === "1");
  } else {
    applyCollapsed(true);
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

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    const confirmed = await showConfirmPopup(
      "Are you sure you want to log out?",
      "Confirm Logout",
      "Logout",
      "Stay",
      { dangerous: true }
    );
    if (!confirmed) return;

    await logoutManager();
    window.location.href = "./login.html";
  });
}

export function renderManagerMiniProfile(targetId, profile) {
  const el = document.getElementById(targetId);
  if (!el) return;

  el.innerHTML = `
    <div class="kc-inline">
      <div>
        <div><strong>${profile.displayName || "Manager"}</strong></div>
        <div class="kc-muted">Restaurant: ${profile.restaurantName || profile.restaurantId}</div>
      </div>
    </div>
  `;
}
