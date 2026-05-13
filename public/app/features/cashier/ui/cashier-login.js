import { loginCashier } from "../services/cashier-service.js";
import { ensureCashierCredentials } from "./cashier-common.js";
import { showErrorPopup } from "../../../core/utils/popup.js";
import { withButtonLoading } from "../../../core/utils/loading.js";

const form = document.getElementById("cashierLoginForm");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const submitBtn = form.querySelector('[type="submit"]');
  await withButtonLoading(submitBtn, async () => {
    const phone = document.getElementById("phone").value.trim();
    const password = document.getElementById("password").value;

    if (!ensureCashierCredentials(phone, password)) return;

    try {
      await loginCashier({ phone, password });
      window.location.href = "./dashboard.html";
    } catch (error) {
      await showErrorPopup(error.message || "Cashier login failed.", "Login Failed");
    }
  }, "Logging in...");
});
