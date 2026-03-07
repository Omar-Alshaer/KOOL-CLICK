import {
  validateUniversityId,
  validatePhone,
  validateBirthDate,
} from "./utils/validators.js";
import { APP_CONFIG } from "./config/app-config.js";
import { showErrorPopup, showSuccessPopup } from "./utils/popup.js";

const form = document.getElementById("registerForm");
const selectedAvatarInput = document.getElementById("selectedAvatar");
const selectedAvatarName = document.getElementById("selectedAvatarName");
const selectedAvatarPreview = document.getElementById("selectedAvatarPreview");

const avatarModal = document.getElementById("avatarModal");
const avatarModalGrid = document.getElementById("avatarModalGrid");
const avatarLoadMsg = document.getElementById("avatarLoadMsg");
const openAvatarModalBtn = document.getElementById("openAvatarModalBtn");
const closeAvatarModalBtn = document.getElementById("closeAvatarModalBtn");

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

  avatarModalGrid
    .querySelectorAll(".kc-avatar-btn")
    .forEach((btn) => btn.classList.toggle("selected", btn.dataset.avatar === file));
}

function renderAvatarOptions() {
  avatarModalGrid.innerHTML = avatarFiles
    .map(
      (file) => `
      <button type="button" class="kc-avatar-btn" data-avatar="${file}">
        <img src="../../assets/Characters/${file}" alt="${prettifyAvatarName(file)}" />
        <div class="kc-avatar-name">${prettifyAvatarName(file)}</div>
      </button>
    `
    )
    .join("");

  avatarModalGrid.querySelectorAll(".kc-avatar-btn").forEach((btn) => {
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

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const fullName = document.getElementById("fullName").value.trim();
  const universityId = document.getElementById("universityId").value.trim();
  const phone = document.getElementById("phone").value.trim();
  const birthDate = document.getElementById("birthDate").value;
  const password = document.getElementById("password").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  if (!fullName) {
    await showErrorPopup("Full name is required.", "Missing Data");
    return;
  }

  if (!validateUniversityId(universityId)) {
    await showErrorPopup("University ID must be 8 digits and start with 2.", "Invalid University ID");
    return;
  }

  if (!validatePhone(phone)) {
    await showErrorPopup("Phone must be Egyptian mobile format 01XXXXXXXXX.", "Invalid Phone Number");
    return;
  }

  if (!validateBirthDate(birthDate)) {
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
    const [{ registerStudent }, { auth }] = await Promise.all([
      import("./services/auth-service.js"),
      import("./config/firebase.js"),
    ]);

    if (!auth.app.options.apiKey) {
      await showErrorPopup(
        "Please add Firebase config first in /public/js/config/firebase.js.",
        "Firebase Config Missing"
      );
      return;
    }

    await registerStudent({
      universityId,
      password,
      fullName,
      phone,
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
});
