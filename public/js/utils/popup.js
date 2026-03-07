let activePopup = null;

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

  frame.classList.remove("is-success", "is-error", "is-info", "is-warning");
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
  return openPopup({ type: "success", title, message, okText: "Great", cancelText: "", showCancel: false });
}

export function showErrorPopup(message, title = "Something Went Wrong") {
  return openPopup({ type: "error", title, message, okText: "Got It", cancelText: "", showCancel: false });
}

export function showInfoPopup(message, title = "Heads Up") {
  return openPopup({ type: "info", title, message, okText: "OK", cancelText: "", showCancel: false });
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
