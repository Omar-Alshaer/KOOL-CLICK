export const APP_CONFIG = {
  appName: "Kool Click",
  signupBonusPoints: 50,
  points: {
    pointsPerStep: 5,
    stepAmountEgp: 50,
    cancellationPenaltyPoints: 20,
  },
  levels: [
    { level: 1, name: "Fresh Click", minPoints: 0, discountPercent: 0 },
    { level: 2, name: "Quick Biter", minPoints: 100, discountPercent: 5 },
    { level: 3, name: "Campus Pro", minPoints: 250, discountPercent: 8 },
    { level: 4, name: "Food Legend", minPoints: 500, discountPercent: 12 },
  ],
  orderStatuses: ["Pending", "Preparing", "Ready", "Collected", "Cancelled"],
  paymentMethods: {
    cod: "CashOnDelivery",
    instaPay: "InstaPay",
  },
  cloudinary: {
    cloudName: "dnf0sdjwj",
    uploadPreset: "koolclick",
    maxFileSizeBytes: 5 * 1024 * 1024,
    allowedMimeTypes: ["image/jpeg", "image/png", "image/webp"],
    allowedFolders: ["receipts", "products", "offers"],
  },
};
