export function setButtonLoading(button, isLoading, loadingText = "Loading...") {
  if (!button) return;
  const isInput = button.tagName === "INPUT";

  if (isLoading) {
    if (button.dataset.kcLoading === "1") return;
    button.dataset.kcLoading = "1";
    if (isInput) {
      button.dataset.kcOriginalValue = button.value;
      button.value = loadingText;
    } else {
      button.dataset.kcOriginalHtml = button.innerHTML;
      button.textContent = loadingText;
    }
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
    button.classList.add("kc-btn-loading");
    return;
  }

  if (button.dataset.kcLoading !== "1") return;
  if (isInput) {
    button.value = button.dataset.kcOriginalValue || button.value;
    delete button.dataset.kcOriginalValue;
  } else {
    if (button.dataset.kcOriginalHtml) {
      button.innerHTML = button.dataset.kcOriginalHtml;
      delete button.dataset.kcOriginalHtml;
    }
  }
  delete button.dataset.kcLoading;
  button.disabled = false;
  button.removeAttribute("aria-busy");
  button.classList.remove("kc-btn-loading");
}

export async function withButtonLoading(button, task, loadingText = "Loading...") {
  if (!button) {
    return task();
  }
  if (button.dataset.kcLoading === "1") return null;
  setButtonLoading(button, true, loadingText);
  try {
    return await task();
  } finally {
    setButtonLoading(button, false, loadingText);
  }
}
