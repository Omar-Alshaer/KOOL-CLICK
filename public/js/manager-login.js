import { showErrorPopup } from "./utils/popup.js";
import { validatePhone } from "./utils/validators.js";
import { loginManager } from "./services/manager-service.js";
import { withButtonLoading } from "./utils/loading.js";

const form = document.getElementById("managerLoginForm");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = form.querySelector('[type="submit"]');
  await withButtonLoading(submitBtn, async () => {
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;

    if (!validatePhone(phone)) {
      await showErrorPopup("Phone must be Egyptian mobile format 01XXXXXXXXX.", "Invalid Phone");
      return;
    }

    if (!password) {
      await showErrorPopup("Password is required.", "Missing Password");
      return;
    }

    try {
      await loginManager({ phone, password });
      window.location.href = "./dashboard.html";
    } catch (error) {
      await showErrorPopup(error.message || "Login failed.", "Login Failed");
    }
  }, "Logging in...");
});
