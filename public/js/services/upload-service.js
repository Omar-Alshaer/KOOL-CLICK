import { APP_CONFIG } from "../config/app-config.js";

export async function uploadReceiptToCloudinary(file) {
  const cloudName = APP_CONFIG.cloudinary.cloudName;
  const uploadPreset = APP_CONFIG.cloudinary.uploadPreset;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary config is missing in app-config.js");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const reason =
      payload?.error?.message ||
      payload?.message ||
      `Cloudinary upload failed (HTTP ${response.status}).`;
    throw new Error(reason);
  }

  if (!payload?.secure_url) {
    throw new Error("No receipt URL returned from Cloudinary.");
  }

  return payload.secure_url;
}
