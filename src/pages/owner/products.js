import { fetchProducts, upsertProduct } from '../../services/products.js';

export async function renderProducts(root) {
  let products = await fetchProducts();

  function renderList() {
    const rows = products.map(p => `
      <tr>
        <td class="bold">${p.name}</td>
        <td class="num">₹<input type="number" class="price-input" data-id="${p.id}" data-field="selling_price" value="${p.selling_price||''}" placeholder="0" style="width:90px;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:13px;text-align:right;"></td>
        <td class="num">₹<input type="number" class="price-input" data-id="${p.id}" data-field="cost_price" value="${p.cost_price||''}" placeholder="0" style="width:90px;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:13px;text-align:right;"></td>
        <td class="num" style="color:${(p.selling_price||0)>0?'var(--green)':'var(--ink-faint)'}">
          ${(p.selling_price||0)>0 ? Math.round(((p.selling_price-p.cost_price)/p.selling_price)*100)+'%' : '—'}
        </td>
        <td><span class="badge ${p.active?'badge-green':''}"> ${p.active?'Active':'Inactive'}</span></td>
      </tr>`).join('') || '<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--ink-dim);">No products in catalogue</td></tr>';

    document.getElementById('products-table-body').innerHTML = rows;

    // Auto-save on price change
    document.querySelectorAll('.price-input').forEach(input => {
      input.addEventListener('change', async () => {
        const id = input.dataset.id;
        const field = input.dataset.field;
        const val = parseFloat(input.value) || 0;
        const prod = products.find(p => p.id === id);
        if (prod) {
          prod[field] = val;
          await upsertProduct({ id, [field]: val });
          renderList();
        }
      });
    });
  }

  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
      <div>
        <div class="section-title">Product Catalogue</div>
        <div class="section-sub" style="margin-top:2px;">${products.length} products · Set prices for P&L calculation</div>
      </div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Product Name</th><th class="num">Selling Price</th><th class="num">Cost Price</th><th class="num">Margin</th><th>Status</th></tr></thead>
        <tbody id="products-table-body"></tbody>
      </table>
    </div>
    <div style="margin-top:12px;font-size:12px;color:var(--ink-dim);">Click price cells to edit. Changes save automatically.</div>
  `;

  renderList();
}
