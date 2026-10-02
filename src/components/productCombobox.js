import { formatRupees } from './kpiRow.js';

/**
 * A type-ahead product picker. Builds its own DOM and returns a handle:
 *   { element, getSelectedId(), getSelectedProduct(), reset(), setProducts() }
 */
export function createProductCombobox(products, { onSelect, placeholder = 'Search products…' } = {}) {
  let list = products;
  let selected = null;

  const wrap = document.createElement('div');
  wrap.className = 'combobox';
  wrap.innerHTML = `
    <span class="combobox-icon">🔍</span>
    <input type="text" placeholder="${placeholder}" autocomplete="off" />
    <div class="combobox-options" hidden></div>
  `;

  const input = wrap.querySelector('input');
  const optionsEl = wrap.querySelector('.combobox-options');

  function renderOptions(filterText) {
    const q = filterText.trim().toLowerCase();
    const matches = q ? list.filter((p) => p.name.toLowerCase().includes(q)) : list;

    if (matches.length === 0) {
      optionsEl.innerHTML = '<div class="combobox-option" style="color: var(--ink-faint)">No matching products</div>';
    } else {
      optionsEl.innerHTML = matches
        .slice(0, 30)
        .map(
          (p) =>
            `<div class="combobox-option" data-id="${p.id}">${escapeHtml(p.name)}<span class="price"> · ${formatRupees(p.selling_price)}/unit</span></div>`
        )
        .join('');
    }
    optionsEl.hidden = false;
  }

  function selectProduct(product) {
    selected = product;
    input.value = product.name;
    optionsEl.hidden = true;
    if (onSelect) onSelect(product);
  }

  input.addEventListener('input', () => {
    selected = null;
    if (onSelect) onSelect(null);
    renderOptions(input.value);
  });

  input.addEventListener('focus', () => renderOptions(input.value));

  optionsEl.addEventListener('mousedown', (e) => {
    // mousedown (not click) so this fires before the input's blur hides the list
    const opt = e.target.closest('.combobox-option[data-id]');
    if (!opt) return;
    const product = list.find((p) => String(p.id) === opt.dataset.id);
    if (product) selectProduct(product);
  });

  document.addEventListener('click', (e) => {
    if (!wrap.contains(e.target)) optionsEl.hidden = true;
  });

  return {
    element: wrap,
    getSelectedProduct: () => selected,
    getSelectedId: () => selected?.id ?? null,
    reset() {
      selected = null;
      input.value = '';
      optionsEl.hidden = true;
    },
    setProducts(newList) {
      list = newList;
    },
  };
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
