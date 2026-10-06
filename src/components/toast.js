// A single reusable status banner. Production saves are the one moment on
// the factory floor that must never be ambiguous, so success and error each
// get a distinct color, icon and message — never a generic "done".

let hideTimer = null;

function ensureToastEl() {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    document.body.appendChild(el);
  }
  return el;
}

export function showToast(message, { variant = 'success', duration = 2600 } = {}) {
  const el = ensureToastEl();
  const icon = variant === 'success' ? '\u2713' : '\u26A0';
  el.className = `toast toast-${variant}`;
  el.innerHTML = `<span class="icon">${icon}</span><span>${message}</span>`;

  // Trigger the transition on a fresh frame so repeated saves re-animate.
  el.classList.remove('is-visible');
  requestAnimationFrame(() => el.classList.add('is-visible'));

  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => {
    el.classList.remove('is-visible');
  }, duration);
}

export function showSuccess(message) {
  showToast(message, { variant: 'success' });
}

export function showError(message) {
  showToast(message, { variant: 'error', duration: 4000 });
}
