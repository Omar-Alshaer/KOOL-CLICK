import { guardClickerPage, mountHeader, renderClickerMiniProfile } from "./clicker-common.js";
import { getLevelFromPoints } from "./utils/levels.js";
import { showErrorPopup, showSuccessPopup } from "./utils/popup.js";
import { withButtonLoading } from "./utils/loading.js";
import { updateClickerUsername } from "./services/auth-service.js";

let currentState = null;

function formatUsername(value) {
  if (!value) return "—";
  return value.includes("@") ? value : `@${value}`;
}

function openUsernameModal() {
  const modal = document.getElementById("usernameModal");
  if (!modal || !currentState?.profile) return;
  const input = document.getElementById("newUsername");
  if (input) {
    const current = currentState.profile.username || "";
    input.value = formatUsername(current).replace(/^@+/, "");
  }
  modal.classList.add("open");
  modal.setAttribute("aria-hidden", "false");
}

function closeUsernameModal() {
  const modal = document.getElementById("usernameModal");
  if (!modal) return;
  modal.classList.remove("open");
  modal.setAttribute("aria-hidden", "true");
}

function isValidUsername(value) {
  return /^[a-z0-9_]{3,20}$/.test(value);
}

async function init() {
  mountHeader({ active: "profile" });
  currentState = await guardClickerPage();
  if (!currentState) return;

  renderClickerMiniProfile("clickerMini", currentState.profile);

  const profile = currentState.profile;
  const level = getLevelFromPoints(profile.points || 0);

  document.getElementById("fullName").textContent = profile.fullName;
  const usernameEl = document.getElementById("username");
  if (usernameEl) usernameEl.textContent = formatUsername(profile.username);
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

  document.getElementById("editUsernameBtn")?.addEventListener("click", openUsernameModal);
  document.getElementById("closeUsernameModalBtn")?.addEventListener("click", closeUsernameModal);
  document.getElementById("usernameModal")?.addEventListener("click", (event) => {
    if (event.target.id === "usernameModal") closeUsernameModal();
  });
  document.addEventListener("keydown", (event) => {
    const modal = document.getElementById("usernameModal");
    if (event.key === "Escape" && modal?.classList.contains("open")) {
      closeUsernameModal();
    }
  });

  const usernameForm = document.getElementById("usernameForm");
  usernameForm?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const submitBtn = usernameForm.querySelector('[type="submit"]');
    const input = document.getElementById("newUsername");
    const rawValue = input?.value || "";
    const normalized = String(rawValue).toLowerCase().trim().replace(/^@+/, "");

    if (!normalized) {
      await showErrorPopup("Username is required.", "Missing Username");
      return;
    }

    if (!isValidUsername(normalized)) {
      await showErrorPopup("Username must be letters, numbers, or underscore only.", "Invalid Username");
      return;
    }

    await withButtonLoading(submitBtn, async () => {
      try {
        const updated = await updateClickerUsername({
          uid: currentState.uid,
          newUsername: normalized,
        });
        currentState.profile.username = updated;
        if (usernameEl) usernameEl.textContent = formatUsername(updated);
        renderClickerMiniProfile("clickerMini", currentState.profile);
        await showSuccessPopup("Username updated.", "Saved");
        closeUsernameModal();
      } catch (error) {
        await showErrorPopup(error.message || "Could not update username.", "Update Failed");
      }
    }, "Saving...");
  });
}

init();
