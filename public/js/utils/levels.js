import { APP_CONFIG } from "../config/app-config.js";

export function pointsFromAmount(amountEgp) {
  const steps = Math.floor(amountEgp / APP_CONFIG.points.stepAmountEgp);
  return steps * APP_CONFIG.points.pointsPerStep;
}

export function getLevelFromPoints(points) {
  const levels = APP_CONFIG.levels;
  let current = levels[0];

  for (const level of levels) {
    if (points >= level.minPoints) {
      current = level;
    }
  }

  return current;
}
