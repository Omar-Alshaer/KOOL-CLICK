let activePopup = null;
let toastTimerSeed = 0;

function ensureToastRoot() {
  let root = document.getElementById("kcToastRoot");
  if (root) return root;

  root = document.createElement("div");
  root.id = "kcToastRoot";
  root.className = "kc-toast-root";
  root.setAttribute("aria-live", "polite");
  root.setAttribute("aria-atomic", "true");
  document.body.appendChild(root);
  return root;
}

function showToast({ type = "success", title = "Done", message = "", durationMs = 2600 }) {
  const root = ensureToastRoot();
  const toast = document.createElement("div");
  const toastId = `kc-toast-${Date.now()}-${++toastTimerSeed}`;
  toast.className = `kc-toast kc-toast-${type}`;
  toast.id = toastId;
  toast.innerHTML = `
    <div class="kc-toast-title">${title}</div>
    <div class="kc-toast-msg">${message}</div>
  `;

  root.appendChild(toast);
  // allow CSS transition after mount
  requestAnimationFrame(() => toast.classList.add("open"));

  const dismiss = () => {
    toast.classList.remove("open");
    toast.classList.add("closing");
    window.setTimeout(() => {
      const node = document.getElementById(toastId);
      if (node) node.remove();
      if (!root.children.length) root.remove();
    }, 180);
  };

  const timer = window.setTimeout(dismiss, durationMs);
  toast.addEventListener("click", () => {
    window.clearTimeout(timer);
    dismiss();
  });

  return Promise.resolve(true);
}

function ensurePopupRoot() {
  let root = document.getElementById("kcFeedbackModal");
  if (root) return root;

  root = document.createElement("div");
  root.id = "kcFeedbackModal";
  root.className = "kc-feedback-modal";
  root.setAttribute("aria-hidden", "true");
  root.innerHTML = `
    <div class="kc-feedback-frame" role="dialog" aria-modal="true" aria-live="polite">
      <div class="kc-feedback-head">
        <h3 id="kcFeedbackTitle" class="kc-title">Notice</h3>
      </div>
      <p id="kcFeedbackMessage" class="kc-feedback-message"></p>
      <div class="kc-feedback-actions">
        <button id="kcFeedbackCancel" type="button" class="kc-btn kc-btn-secondary">Cancel</button>
        <button id="kcFeedbackOk" type="button" class="kc-btn">OK</button>
      </div>
    </div>
  `;

  document.body.appendChild(root);
  return root;
}

function hidePopup() {
  const root = document.getElementById("kcFeedbackModal");
  if (!root) return;
  root.classList.remove("open");
  root.setAttribute("aria-hidden", "true");
  activePopup = null;
}

function openPopup({ type, title, message, okText, cancelText, showCancel = false, dangerous = false }) {
  if (activePopup) {
    activePopup.reject?.(new Error("Popup replaced by a new one."));
    hidePopup();
  }

  const root = ensurePopupRoot();
  const frame = root.querySelector(".kc-feedback-frame");
  const titleEl = document.getElementById("kcFeedbackTitle");
  const msgEl = document.getElementById("kcFeedbackMessage");
  const okBtn = document.getElementById("kcFeedbackOk");
  const cancelBtn = document.getElementById("kcFeedbackCancel");

  frame.classList.remove("is-error", "is-warning");
  frame.classList.add(`is-${type}`);

  titleEl.textContent = title;
  msgEl.textContent = message;
  okBtn.textContent = okText;
  cancelBtn.textContent = cancelText;
  cancelBtn.style.display = showCancel ? "inline-flex" : "none";
  okBtn.classList.toggle("kc-btn-danger", Boolean(dangerous));

  root.classList.add("open");
  root.setAttribute("aria-hidden", "false");

  return new Promise((resolve, reject) => {
    const cleanup = () => {
      root.removeEventListener("click", onOverlayClick);
      okBtn.removeEventListener("click", onOk);
      cancelBtn.removeEventListener("click", onCancel);
      document.removeEventListener("keydown", onEsc);
      hidePopup();
    };

    const onOk = () => {
      cleanup();
      resolve(true);
    };

    const onCancel = () => {
      cleanup();
      resolve(false);
    };

    const onOverlayClick = (event) => {
      if (event.target === root) onCancel();
    };

    const onEsc = (event) => {
      if (event.key === "Escape") onCancel();
    };

    root.addEventListener("click", onOverlayClick);
    okBtn.addEventListener("click", onOk);
    cancelBtn.addEventListener("click", onCancel);
    document.addEventListener("keydown", onEsc);

    activePopup = { reject };
  });
}

export function showSuccessPopup(message, title = "Success") {
  return showToast({ type: "success", title, message, durationMs: 2400 });
}

export function showErrorPopup(message, title = "Something Went Wrong") {
  return openPopup({ type: "error", title, message, okText: "Got It", cancelText: "", showCancel: false });
}

export function showInfoPopup(message, title = "Heads Up") {
  return showToast({ type: "info", title, message, durationMs: 2600 });
}

export function showConfirmPopup(
  message,
  title = "Please Confirm",
  okText = "Continue",
  cancelText = "Cancel",
  options = {}
) {
  return openPopup({
    type: "warning",
    title,
    message,
    okText,
    cancelText,
    showCancel: true,
    dangerous: Boolean(options.dangerous),
  });
}
