import { guardClickerPage, mountHeader, renderClickerMiniProfile } from "./clicker-common.js";
import { getLevelFromPoints } from "./utils/levels.js";

async function init() {
  mountHeader({ active: "profile" });
  const state = await guardClickerPage();
  if (!state) return;

  renderClickerMiniProfile("clickerMini", state.profile);

  const profile = state.profile;
  const level = getLevelFromPoints(profile.points || 0);

  document.getElementById("fullName").textContent = profile.fullName;
  const usernameEl = document.getElementById("username");
  if (usernameEl) usernameEl.textContent = profile.username ? `@${profile.username}` : "—";
  document.getElementById("phone").textContent = profile.phone;
  const emailEl = document.getElementById("email");
  if (emailEl) emailEl.textContent = profile.email || "—";
  document.getElementById("birthDate").textContent = profile.birthDate;
  const pointsEl = document.getElementById("points");
  const points = Number(profile.points || 0);
  pointsEl.textContent = String(points);
  pointsEl.classList.remove("kc-points-positive", "kc-points-negative");
  pointsEl.classList.add(points < 0 ? "kc-points-negative" : "kc-points-positive");
  document.getElementById("level").textContent = `${level.name} (L${level.level})`;
  document.getElementById("discount").textContent = `${level.discountPercent}%`;
}

init();
