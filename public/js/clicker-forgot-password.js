import { showErrorPopup } from "./utils/popup.js";

const form = document.getElementById("forgotForm");
const requestSection = document.getElementById("requestSection");
const confirmSection = document.getElementById("confirmSection");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const identifier = document.getElementById("identifier").value.trim();

  if (!identifier) {
    await showErrorPopup("Please enter your username or phone number.", "Missing Input");
    return;
  }

  // Basic phone format check
  if (/^\d/.test(identifier) && !/^01\d{9}$/.test(identifier)) {
    await showErrorPopup(
      "Phone number must be in Egyptian format: 01XXXXXXXXX",
      "Invalid Phone"
    );
    return;
  }

  // Show confirmation screen
  requestSection.style.display = "none";
  confirmSection.style.display = "block";
  window.scrollTo({ top: 0, behavior: "smooth" });
});
