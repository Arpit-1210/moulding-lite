let timer = null;

export function showToast(msg, type = 'success') {
  const toast = document.getElementById('toast');
  const msgEl = document.getElementById('toast-msg');
  const iconEl = document.getElementById('toast-icon');
  if (!toast) return;
  msgEl.textContent = msg;
  iconEl.textContent = type === 'success' ? '✓' : '✕';
  toast.className = `toast toast-${type} is-visible`;
  clearTimeout(timer);
  timer = setTimeout(() => toast.classList.remove('is-visible'), 2500);
}
