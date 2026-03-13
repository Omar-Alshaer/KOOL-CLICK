import { showConfirmPopup, showErrorPopup } from "./utils/popup.js";
import {
  getCurrentCashierProfile,
  logoutCashier,
  watchCashierAuthState,
} from "./services/cashier-service.js";

export async function guardCashierPage() {
  return new Promise((resolve) => {
    watchCashierAuthState(async (user) => {
      if (!user) {
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      const profile = await getCurrentCashierProfile(user.uid);
      if (!profile) {
        await logoutCashier();
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      resolve({ uid: user.uid, profile });
    });
  });
}

export function mountCashierHeader({ active = "dashboard" } = {}) {
  const host = document.getElementById("kcHeader");
  if (!host) return;
  document.body.classList.add("kc-with-sidebar");

  host.innerHTML = `
    <div class="kc-topbar">
      <div class="kc-topbar-brand">
        <img class="kc-topbar-logo" src="../../assets/brand/logo_trans.svg" alt="Kool Click Logo" />
      </div>
      <nav class="kc-topbar-nav">
        <a class="kc-topbar-link ${active === "dashboard" ? "is-active" : ""}" href="./dashboard.html"><span class="kc-topbar-ico">📋</span><span class="kc-topbar-txt">Dashboard</span></a>
        <a class="kc-topbar-link ${active === "order" ? "is-active" : ""}" href="./order.html"><span class="kc-topbar-ico">🔎</span><span class="kc-topbar-txt">Order</span></a>
        <a class="kc-topbar-link ${active === "completed" ? "is-active" : ""}" href="./completed.html"><span class="kc-topbar-ico">✅</span><span class="kc-topbar-txt">Completed</span></a>
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

  document.getElementById("logoutBtn")?.addEventListener("click", async () => {
    const confirmed = await showConfirmPopup(
      "Are you sure you want to log out?",
      "Confirm Logout",
      "Logout",
      "Stay",
      { dangerous: true }
    );
    if (!confirmed) return;

    await logoutCashier();
    window.location.href = "./login.html";
  });
}

export function renderCashierMiniProfile(targetId, profile) {
  const el = document.getElementById(targetId);
  if (!el) return;

  el.innerHTML = `
    <div class="kc-inline">
      <div>
        <div><strong>${profile.displayName || "Cashier"}</strong></div>
        <div class="kc-muted">Restaurant: ${profile.restaurantName || profile.restaurantId}</div>
      </div>
    </div>
  `;
}

export function ensureCashierCredentials(phone, password) {
  if (!phone || !password) {
    showErrorPopup("Phone number and password are required.", "Missing Credentials");
    return false;
  }

  if (!/^01\d{9}$/.test(phone)) {
    showErrorPopup("Phone must be Egyptian mobile format 01XXXXXXXXX.", "Invalid Phone");
    return false;
  }
  return true;
}
