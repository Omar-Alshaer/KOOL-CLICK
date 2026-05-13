import { loginSuperAdmin } from "./services/admin-service.js";
import { withButtonLoading } from "./utils/loading.js";
import { showErrorPopup } from "./utils/popup.js";

const form = document.getElementById("adminLoginForm");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = form.querySelector("button[type='submit']");

  await withButtonLoading(submitBtn, async () => {
    try {
      const formData = new FormData(form);
      await loginSuperAdmin({
        email: formData.get("email"),
        password: formData.get("password"),
      });
      window.location.href = "./system.html";
    } catch (error) {
      await showErrorPopup(
        error.message || "Could not sign in as system owner.",
        "Access Denied"
      );
    }
  }, "Signing in...");
});
