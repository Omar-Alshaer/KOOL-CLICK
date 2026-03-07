import { guardStudentPage, mountHeader, renderStudentMiniProfile } from "./student-common.js";
import { APP_CONFIG } from "./config/app-config.js";

async function init() {
  mountHeader({ active: "home" });
  const state = await guardStudentPage();
  if (!state) return;

  renderStudentMiniProfile("studentMini", state.profile);

  document.getElementById("statusFlow").textContent = APP_CONFIG.orderStatuses.join(" -> ");
}

init();
