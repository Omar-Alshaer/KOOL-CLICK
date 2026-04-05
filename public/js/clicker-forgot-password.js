import { showErrorPopup } from "./utils/popup.js";
import { withButtonLoading } from "./utils/loading.js";
import { validateEmail } from "./utils/validators.js";

const form = document.getElementById("forgotForm");
const requestSection = document.getElementById("requestSection");
const confirmSection = document.getElementById("confirmSection");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = form.querySelector('[type="submit"]');

  await withButtonLoading(submitBtn, async () => {
    const identifier = document.getElementById("identifier").value.trim();

    if (!identifier) {
      await showErrorPopup("Please enter your email address.", "Missing Input");
      return;
    }

    if (!validateEmail(identifier)) {
      await showErrorPopup("Please enter a valid email address.", "Invalid Email");
      return;
    }

    // Show confirmation screen
    requestSection.hidden = true;
    confirmSection.hidden = false;
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, "Sending...");
});
