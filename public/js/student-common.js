import { auth } from "./config/firebase.js";
import { getCurrentStudentProfile, logoutUser, watchAuthState } from "./services/auth-service.js";
import { getLevelFromPoints } from "./utils/levels.js";
import { showConfirmPopup, showErrorPopup } from "./utils/popup.js";

export async function guardStudentPage() {
  return new Promise((resolve) => {
    watchAuthState(async (user) => {
      if (!user) {
        window.location.href = "./login.html";
        resolve(null);
        return;
      }

      const profile = await getCurrentStudentProfile(user.uid, { forceFresh: true });
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

  host.innerHTML = `
    <div class="kc-brand">
      <img src="../../assets/temp/logo.png" alt="Kool Click Logo" />
      <div class="kc-brand-text">
        <span class="kc-brand-title">Kool Click</span>
        <span class="kc-brand-slogan">Click. Order. Enjoy.</span>
      </div>
    </div>
    <nav class="kc-nav">
      <a class="${active === "home" ? "kc-active" : ""}" href="./home.html">Home</a>
      <a class="${active === "menu" ? "kc-active" : ""}" href="./menu.html">Menu</a>
      <a class="${active === "cart" ? "kc-active" : ""}" href="./cart.html">Cart</a>
      <a class="${active === "orders" ? "kc-active" : ""}" href="./orders.html">Orders</a>
      <a class="${active === "profile" ? "kc-active" : ""}" href="./profile.html">Profile</a>
      <button id="logoutBtn" class="kc-btn kc-btn-danger" type="button">Logout</button>
    </nav>
  `;

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

export function renderStudentMiniProfile(targetId, profile) {
  const el = document.getElementById(targetId);
  if (!el) return;

  const points = Number(profile.points || 0);
  const level = getLevelFromPoints(points);
  const pointsClass = points < 0 ? "kc-points-negative" : "kc-points-positive";
  el.innerHTML = `
    <div class="kc-inline">
      <img src="../../assets/Characters/${profile.avatar}" alt="Avatar" width="54" height="54" style="image-rendering: pixelated; border: 2px solid #4b067f" />
      <div>
        <div><strong>${profile.fullName}</strong> (${profile.universityId})</div>
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
