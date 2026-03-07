import { guardStudentPage, mountHeader, renderStudentMiniProfile } from "./student-common.js";
import { getLevelFromPoints } from "./utils/levels.js";

async function init() {
  mountHeader({ active: "profile" });
  const state = await guardStudentPage();
  if (!state) return;

  renderStudentMiniProfile("studentMini", state.profile);

  const profile = state.profile;
  const level = getLevelFromPoints(profile.points || 0);

  document.getElementById("fullName").textContent = profile.fullName;
  document.getElementById("universityId").textContent = profile.universityId;
  document.getElementById("phone").textContent = profile.phone;
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
