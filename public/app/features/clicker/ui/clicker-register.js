import { validatePhone, validateEmail, validateBirthDate } from "../../../core/utils/validators.js";
import { APP_CONFIG } from "../../../config/app-config.js";
import { showErrorPopup, showSuccessPopup } from "../../../core/utils/popup.js";
import { withButtonLoading } from "../../../core/utils/loading.js";
import { escapeHtml } from "../../../core/utils/dom.js";

const form = document.getElementById("registerForm");
const selectedAvatarInput = document.getElementById("selectedAvatar");
const selectedAvatarName = document.getElementById("selectedAvatarName");
const selectedAvatarPreview = document.getElementById("selectedAvatarPreview");
const avatarModal = document.getElementById("avatarModal");
const avatarModalGrid = document.getElementById("avatarModalGrid");
const avatarLoadMsg = document.getElementById("avatarLoadMsg");
const openAvatarModalBtn = document.getElementById("openAvatarModalBtn");
const closeAvatarModalBtn = document.getElementById("closeAvatarModalBtn");
const birthDaySelect = document.getElementById("birthDay");
const birthMonthSelect = document.getElementById("birthMonth");
const birthYearSelect = document.getElementById("birthYear");

let selectedAvatar = "";
let avatarFiles = [];

function prettifyAvatarName(fileName) {
  return fileName.replace(/\.[^.]+$/, "");
}

function setSelectedAvatar(file) {
  selectedAvatar = file;
  selectedAvatarInput.value = file;
  selectedAvatarName.textContent = prettifyAvatarName(file);
  selectedAvatarPreview.src = `../../assets/Characters/${file}`;
  selectedAvatarPreview.style.display = "block";

  avatarModalGrid.querySelectorAll(".kc-character-option").forEach((btn) => {
    const isSelected = btn.dataset.avatar === file;
    btn.classList.toggle("selected", isSelected);
    btn.setAttribute("aria-pressed", String(isSelected));
  });
}

function renderAvatarOptions() {
  avatarModalGrid.innerHTML = avatarFiles
    .map((file) => {
      const safeFile = escapeHtml(file);
      const safeName = escapeHtml(prettifyAvatarName(file));
      return `
      <button type="button" class="kc-character-option" data-avatar="${safeFile}" aria-pressed="false">
        <span class="kc-character-media">
          <img src="../../assets/Characters/${safeFile}" alt="${safeName}" />
        </span>
        <span class="kc-character-name">${safeName}</span>
      </button>
    `;
    })
    .join("");

  avatarModalGrid.querySelectorAll(".kc-character-option").forEach((btn) => {
    btn.addEventListener("click", () => {
      setSelectedAvatar(btn.dataset.avatar);
      closeAvatarModal();
    });
  });
}

function openAvatarModal() {
  avatarModal.classList.add("open");
  avatarModal.setAttribute("aria-hidden", "false");
}

function closeAvatarModal() {
  avatarModal.classList.remove("open");
  avatarModal.setAttribute("aria-hidden", "true");
}

function populateBirthDate() {
  if (!birthDaySelect || !birthMonthSelect || !birthYearSelect) return;

  birthDaySelect.innerHTML =
    `<option value="">Day</option>` +
    Array.from({ length: 31 }, (_, i) => {
      const day = String(i + 1).padStart(2, "0");
      return `<option value="${day}">${day}</option>`;
    }).join("");

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  birthMonthSelect.innerHTML =
    `<option value="">Month</option>` +
    months
      .map((label, idx) => {
        const value = String(idx + 1).padStart(2, "0");
        return `<option value="${value}">${label}</option>`;
      })
      .join("");

  const currentYear = new Date().getFullYear();
  const startYear = currentYear - 60;
  const endYear = currentYear - 12;
  let yearOptions = `<option value="">Year</option>`;
  for (let y = endYear; y >= startYear; y -= 1) {
    yearOptions += `<option value="${y}">${y}</option>`;
  }
  birthYearSelect.innerHTML = yearOptions;
}

async function loadAvatarFilesFromJson() {
  const response = await fetch("../../assets/Characters/avatars.json", { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load avatars.json.");

  const list = await response.json();
  if (!Array.isArray(list)) throw new Error("Invalid avatars.json format.");

  const filtered = list.filter((name) => /\.(png|jpe?g|webp|gif)$/i.test(name));
  if (!filtered.length) throw new Error("No avatars found.");

  return filtered;
}

async function initAvatars() {
  avatarLoadMsg.textContent = "Loading avatars...";

  try {
    avatarFiles = await loadAvatarFilesFromJson();
  } catch {
    avatarLoadMsg.textContent = "Could not load avatars. Check avatars.json file.";
    await showErrorPopup(
      "Could not load avatars. Check public/assets/Characters/avatars.json file.",
      "Avatar Load Failed"
    );
    return;
  }

  avatarLoadMsg.textContent = `Found ${avatarFiles.length} avatars`;
  renderAvatarOptions();
}

openAvatarModalBtn?.addEventListener("click", openAvatarModal);
closeAvatarModalBtn?.addEventListener("click", closeAvatarModal);
avatarModal?.addEventListener("click", (event) => {
  if (event.target === avatarModal) {
    closeAvatarModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && avatarModal.classList.contains("open")) {
    closeAvatarModal();
  }
});

initAvatars();
populateBirthDate();

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = form.querySelector('[type="submit"]');

  await withButtonLoading(
    submitBtn,
    async () => {
      const fullName = document.getElementById("fullName").value.trim();
      const phone = document.getElementById("phone").value.trim();
      const email = document.getElementById("email")?.value.trim() || "";
      const birthDay = birthDaySelect?.value || "";
      const birthMonth = birthMonthSelect?.value || "";
      const birthYear = birthYearSelect?.value || "";
      const birthDate =
        birthYear && birthMonth && birthDay ? `${birthYear}-${birthMonth}-${birthDay}` : "";
      const password = document.getElementById("password").value;
      const confirmPassword = document.getElementById("confirmPassword").value;

      if (!fullName) {
        await showErrorPopup("Full name is required.", "Missing Data");
        return;
      }

      if (!validatePhone(phone)) {
        await showErrorPopup(
          "Phone must be Egyptian mobile format 01XXXXXXXXX.",
          "Invalid Phone Number"
        );
        return;
      }

      if (!email) {
        await showErrorPopup("Email is required.", "Missing Email");
        return;
      }

      if (!validateEmail(email)) {
        await showErrorPopup("Invalid email address.", "Invalid Email");
        return;
      }

      if (!birthDate || !validateBirthDate(birthDate)) {
        await showErrorPopup("Birth date must be a valid past date.", "Invalid Birth Date");
        return;
      }

      if (!selectedAvatar) {
        await showErrorPopup("Please select an avatar.", "Avatar Required");
        return;
      }

      if (password.length < 6) {
        await showErrorPopup("Password must be at least 6 characters.", "Weak Password");
        return;
      }

      if (password !== confirmPassword) {
        await showErrorPopup("Passwords do not match.", "Password Mismatch");
        return;
      }

      try {
        const [{ registerClicker }, { auth }] = await Promise.all([
          import("../services/auth-service.js"),
          import("../../../config/firebase.js"),
        ]);

        if (!auth.app.options.apiKey) {
          await showErrorPopup(
            "Please add Firebase config first in /public/app/config/firebase.js.",
            "Firebase Config Missing"
          );
          return;
        }

        await registerClicker({
          fullName,
          phone,
          email,
          password,
          birthDate,
          avatar: selectedAvatar,
        });

        await showSuccessPopup(
          `Welcome to Kool Click! You got ${APP_CONFIG.signupBonusPoints} bonus points as a signup reward.`,
          "Account Created"
        );
        window.location.href = "./home.html";
      } catch (error) {
        await showErrorPopup(error.message || "Registration failed.", "Registration Failed");
      }
    },
    "Creating..."
  );
});
