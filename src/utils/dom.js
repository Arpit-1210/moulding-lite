/** Escapes text before it's interpolated into innerHTML (supervisor/member names come from user input). */
export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
