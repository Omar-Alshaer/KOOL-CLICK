import { loginStudent } from "./services/auth-service.js";
import { validateUniversityId } from "./utils/validators.js";
import { requireFirebaseConfig } from "./student-common.js";
import { showErrorPopup } from "./utils/popup.js";

requireFirebaseConfig();

const form = document.getElementById("loginForm");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const universityId = document.getElementById("universityId").value.trim();
  const password = document.getElementById("password").value;

  if (!validateUniversityId(universityId)) {
    await showErrorPopup("University ID must be 8 digits and start with 2.", "Invalid University ID");
    return;
  }

  try {
    await loginStudent({ universityId, password });
    window.location.href = "./home.html";
  } catch (error) {
    await showErrorPopup(error.message || "Login failed.", "Login Failed");
  }
});
