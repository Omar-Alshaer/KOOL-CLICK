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
  promoCodes: [
    { code: "WELCOME10", type: "percent", value: 10, minSubtotal: 80 },
    { code: "CAMPUS20", type: "flat", value: 20, minSubtotal: 120 },
  ],
  cloudinary: {
    cloudName: "dnf0sdjwj",
    uploadPreset: "koolclick",
  },
};
