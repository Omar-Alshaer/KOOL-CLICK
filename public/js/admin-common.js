import { showConfirmPopup, showErrorPopup } from "./utils/popup.js";
import { escapeHtml } from "./utils/dom.js";
import {
  getCurrentSuperAdminProfile,
  logoutSuperAdmin,
  watchSuperAdminAuthState,
} from "./services/admin-service.js";

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
      <div class="kc-auth-splash-text">Loading system owner session...</div>
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

export async function guardSuperAdminPage() {
  showAuthSplash();
  return new Promise((resolve) => {
    watchSuperAdminAuthState(async (user) => {
      if (!user) {
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      let profile = null;
      try {
        profile = await getCurrentSuperAdminProfile(user.uid);
      } catch (error) {
        await showErrorPopup(
          error.message || "Could not load system owner session.",
          "Session Error"
        );
      }

      if (!profile) {
        await logoutSuperAdmin();
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      hideAuthSplash();
      resolve({ uid: user.uid, profile });
    });
  });
}

export function mountAdminHeader({ active = "system" } = {}) {
  const host = document.getElementById("kcHeader");
  if (!host) return;
  document.body.classList.add("kc-with-sidebar");

  host.innerHTML = `
    <div class="kc-topbar">
      <div class="kc-topbar-brand">
        <img class="kc-topbar-logo" src="../../assets/brand/logo_trans.svg" alt="Kool Click Logo" />
      </div>
      <nav class="kc-topbar-nav">
        <a class="kc-topbar-link ${active === "system" ? "is-active" : ""}" href="./system.html"><span class="kc-topbar-ico">SA</span><span class="kc-topbar-txt">System</span></a>
        <button id="logoutBtn" class="kc-topbar-link kc-topbar-danger" type="button"><span class="kc-topbar-ico">OUT</span><span class="kc-topbar-txt">Logout</span></button>
      </nav>
    </div>
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

    await logoutSuperAdmin();
    window.location.href = "./login.html";
  });
}

export function renderAdminMiniProfile(targetId, profile) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const safeName = escapeHtml(profile.displayName || "System Owner");
  const safeEmail = escapeHtml(profile.email || profile.authEmail || "");

  el.innerHTML = `
    <div class="kc-inline">
      <div>
        <div><strong>${safeName}</strong></div>
        <div class="kc-muted">Role: superAdmin ${safeEmail ? `- ${safeEmail}` : ""}</div>
      </div>
    </div>
  `;
}
