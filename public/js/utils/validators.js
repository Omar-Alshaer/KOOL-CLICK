export function validateUniversityId(universityId) {
  return /^2\d{7}$/.test(universityId);
}

export function validatePhone(phone) {
  return /^01\d{9}$/.test(phone);
}

export function validateBirthDate(dateStr) {
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return false;

  const now = new Date();
  return date < now;
}
