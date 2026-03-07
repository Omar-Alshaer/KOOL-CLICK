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

  host.innerHTML = `
    <div class="kc-brand">
      <img src="../../assets/temp/logo.png" alt="Kool Click Logo" />
      <div class="kc-brand-text">
        <span class="kc-brand-title">Kool Click</span>
        <span class="kc-brand-slogan">Cashier Panel</span>
      </div>
    </div>
    <nav class="kc-nav">
      <a class="${active === "dashboard" ? "kc-active" : ""}" href="./dashboard.html">Dashboard</a>
      <a class="${active === "order" ? "kc-active" : ""}" href="./order.html">Order</a>
      <a class="${active === "completed" ? "kc-active" : ""}" href="./completed.html">Completed</a>
      <button id="logoutBtn" class="kc-btn kc-btn-danger" type="button">Logout</button>
    </nav>
  `;

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
