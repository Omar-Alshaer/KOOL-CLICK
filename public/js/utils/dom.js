export function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function safeClass(value, allowed = [], fallback = "") {
  const v = String(value ?? "");
  return allowed.includes(v) ? v : fallback;
}

export function sanitizeUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";

  if (raw.startsWith("data:image/")) return raw;
  if (raw.startsWith("/") || raw.startsWith("./") || raw.startsWith("../")) return raw;

  try {
    const url = new URL(raw, window.location.origin);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.href;
    }
  } catch {
    return "";
  }

  return "";
}
