let hideTimer = null;

/** Briefly shows the bottom "Updated just now" pill after a realtime refresh. */
export function flashLivePill(text = 'Updated just now') {
  const el = document.getElementById('live-pill');
  if (!el) return;
  el.querySelector('span:last-child').textContent = text;
  el.classList.add('is-visible');
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => el.classList.remove('is-visible'), 2200);
}
