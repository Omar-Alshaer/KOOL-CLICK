import { guardClickerPage, mountHeader, renderClickerMiniProfile } from "./clicker-common.js";
import { APP_CONFIG } from "./config/app-config.js";

async function init() {
  mountHeader({ active: "home" });
  const state = await guardClickerPage();
  if (!state) return;

  renderClickerMiniProfile("clickerMini", state.profile);

  document.getElementById("statusFlow").textContent = APP_CONFIG.orderStatuses.join(" -> ");
}

init();
