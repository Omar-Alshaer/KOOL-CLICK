import { APP_CONFIG } from "../../config/app-config.js";

const DEFAULT_IMAGE_TRANSFORM = "q_auto,f_auto,c_limit,w_1200";
const DEFAULT_RECEIPT_FOLDER = "receipts";

function validateUploadFile(file, { folder = "" } = {}) {
  if (!file) {
    throw new Error("Please choose an image first.");
  }

  const maxFileSize = APP_CONFIG.cloudinary.maxFileSizeBytes || 5 * 1024 * 1024;
  const allowedMimeTypes = APP_CONFIG.cloudinary.allowedMimeTypes || [];
  const allowedFolders = APP_CONFIG.cloudinary.allowedFolders || [];

  if (file.size > maxFileSize) {
    throw new Error(`Image is too large. Maximum size is ${Math.floor(maxFileSize / 1024 / 1024)} MB.`);
  }

  if (allowedMimeTypes.length && !allowedMimeTypes.includes(file.type)) {
    throw new Error("Unsupported image type. Please upload JPG, PNG, or WebP.");
  }

  if (folder && allowedFolders.length && !allowedFolders.includes(folder)) {
    throw new Error("Upload folder is not allowed.");
  }
}

async function uploadToCloudinary(file, { folder = "", transform = DEFAULT_IMAGE_TRANSFORM } = {}) {
  const cloudName = APP_CONFIG.cloudinary.cloudName;
  const uploadPreset = APP_CONFIG.cloudinary.uploadPreset;

  if (!cloudName || !uploadPreset) {
    throw new Error("Cloudinary config is missing in app-config.js");
  }

  validateUploadFile(file, { folder });

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);
  if (folder) formData.append("folder", folder);
  if (transform) formData.append("transformation", transform);

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
    throw new Error("No image URL returned from Cloudinary.");
  }

  return payload.secure_url;
}

export async function uploadReceiptToCloudinary(file) {
  return uploadToCloudinary(file, { folder: DEFAULT_RECEIPT_FOLDER });
}

export async function uploadImageToCloudinary(file, options = {}) {
  const folder = options.folder || "products";
  const transform = options.transform || DEFAULT_IMAGE_TRANSFORM;
  return uploadToCloudinary(file, { folder, transform });
}
