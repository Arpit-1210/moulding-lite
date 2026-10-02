import { resolveDateRange } from '../utils/date.js';

/**
 * Renders Today / Week / Month chips into `container` and calls
 * onChange({ key, from, to }) whenever the selection changes, including once
 * immediately on init. Returns { getRange() } for callers that need the
 * current value without waiting for a callback.
 */
export function initRangeFilter(container, { onChange, initial = 'today' } = {}) {
  const options = [
    { key: 'today', label: 'Today' },
    { key: 'week', label: 'This week' },
    { key: 'month', label: 'This month' },
  ];

  let current = initial;

  function render() {
    container.innerHTML = options
      .map(
        (o) => `<button type="button" class="range-chip${o.key === current ? ' is-active' : ''}" data-key="${o.key}">${o.label}</button>`
      )
      .join('');
  }

  function emit() {
    const { from, to } = resolveDateRange(current);
    onChange({ key: current, from, to });
  }

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-key]');
    if (!btn) return;
    current = btn.dataset.key;
    render();
    emit();
  });

  render();
  emit();

  return {
    getRange: () => resolveDateRange(current),
  };
}
