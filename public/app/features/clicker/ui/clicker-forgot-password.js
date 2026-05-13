import { auth, sendPasswordResetEmail } from "../../../config/firebase.js";
import { showErrorPopup, showSuccessPopup } from "../../../core/utils/popup.js";
import { withButtonLoading } from "../../../core/utils/loading.js";
import { validateEmail } from "../../../core/utils/validators.js";

const form = document.getElementById("forgotForm");
const requestSection = document.getElementById("requestSection");
const confirmSection = document.getElementById("confirmSection");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const submitBtn = form.querySelector('[type="submit"]');

  await withButtonLoading(
    submitBtn,
    async () => {
      const identifier = document.getElementById("identifier").value.trim();

      if (!identifier) {
        await showErrorPopup("Please enter your email address.", "Missing Input");
        return;
      }

      if (!validateEmail(identifier)) {
        await showErrorPopup("Please enter a valid email address.", "Invalid Email");
        return;
      }

      if (!auth?.app?.options?.apiKey) {
        await showErrorPopup(
          "Please add Firebase config first in /public/app/config/firebase.js.",
          "Firebase Config Missing"
        );
        return;
      }

      try {
        await sendPasswordResetEmail(auth, identifier);
        requestSection.hidden = true;
        confirmSection.hidden = false;
        window.scrollTo({ top: 0, behavior: "smooth" });
        await showSuccessPopup("Password reset email sent.", "Check Your Inbox");
      } catch (error) {
        await showErrorPopup(error.message || "Could not send reset email.", "Reset Failed");
      }
    },
    "Sending..."
  );
});
