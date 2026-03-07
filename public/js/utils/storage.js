const CART_KEY = "koolclick_student_cart";

export function getCart() {
  const raw = localStorage.getItem(CART_KEY);
  if (!raw) return [];

  try {
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveCart(items) {
  localStorage.setItem(CART_KEY, JSON.stringify(items));
}

export function clearCart() {
  localStorage.removeItem(CART_KEY);
}
