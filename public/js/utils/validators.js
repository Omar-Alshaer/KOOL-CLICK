export function validatePhone(phone) {
  return /^01\d{9}$/.test(phone);
}

export function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function validateBirthDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;
  const now = new Date();
  return date < now;
}

// Letters, digits, underscores — 3 to 20 chars
export function validateUsername(username) {
  return /^[a-zA-Z0-9_]{3,20}$/.test(username);
}
