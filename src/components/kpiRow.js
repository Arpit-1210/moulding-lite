const rupeeFmt = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 });
const numberFmt = new Intl.NumberFormat('en-IN');

export function formatRupees(n) {
  return `₹${rupeeFmt.format(Math.round(n || 0))}`;
}

export function formatNumber(n) {
  return numberFmt.format(Math.round((n || 0) * 100) / 100);
}

/**
 * cards: [{ label, value, caption, color }]
 * color is one of: green, orange, purple, blue, red, slate
 */
export function renderKpiRow(cards) {
  return `
    <div class="kpi-row">
      ${cards
        .map(
          (c) => `
        <div class="kpi-card kpi-${c.color || 'slate'}">
          <p class="label">${c.label}</p>
          <p class="value">${c.value}</p>
          ${c.caption ? `<p class="caption">${c.caption}</p>` : ''}
        </div>`
        )
        .join('')}
    </div>`;
}
