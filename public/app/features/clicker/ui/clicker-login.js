import { loginClicker } from "../services/auth-service.js";
import { requireFirebaseConfig } from "./clicker-common.js";
import { showErrorPopup } from "../../../core/utils/popup.js";
import { withButtonLoading } from "../../../core/utils/loading.js";
import { validateEmail } from "../../../core/utils/validators.js";

requireFirebaseConfig();

const form = document.getElementById("loginForm");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = form.querySelector('[type="submit"]');

  await withButtonLoading(submitBtn, async () => {
    const identifier = document.getElementById("identifier").value.trim();
    const password = document.getElementById("password").value;

    if (!identifier) {
      await showErrorPopup("Enter your email address.", "Missing Input");
      return;
    }

    if (!validateEmail(identifier)) {
      await showErrorPopup("Please enter a valid email address.", "Invalid Email");
      return;
    }

    try {
      await loginClicker({ identifier, password });
      window.location.href = "./home.html";
    } catch (error) {
      await showErrorPopup(error.message || "Login failed.", "Login Failed");
    }
  }, "Logging in...");
});
