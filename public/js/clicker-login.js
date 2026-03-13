import { loginClicker, detectLoginInput } from "./services/auth-service.js";
import { requireFirebaseConfig } from "./clicker-common.js";
import { showErrorPopup } from "./utils/popup.js";

requireFirebaseConfig();

const form = document.getElementById("loginForm");

form?.addEventListener("submit", async (event) => {
  event.preventDefault();

  const identifier = document.getElementById("identifier").value.trim();
  const password    = document.getElementById("password").value;

  if (!identifier) {
    await showErrorPopup("Enter your username, phone number, or email.", "Missing Input");
    return;
  }

  const inputType = detectLoginInput(identifier);

  // Basic front-end format check for phone
  if (inputType === "phone" && !/^01\d{9}$/.test(identifier)) {
    await showErrorPopup("Phone must be Egyptian mobile format 01XXXXXXXXX.", "Invalid Phone");
    return;
  }

  try {
    await loginClicker({ identifier, password });
    window.location.href = "./home.html";
  } catch (error) {
    await showErrorPopup(error.message || "Login failed.", "Login Failed");
  }
});
