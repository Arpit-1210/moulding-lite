import { fetchProducts, upsertProduct, addProduct } from '../../services/products.js';

export async function renderProducts(root) {
  let products = await fetchProducts();

  function renderList() {
    const rows = products.map(p => `
      <tr>
        <td class="bold">${p.name}</td>
        <td class="num">₹<input type="number" class="price-input" data-id="${p.id}" data-field="selling_price" value="${p.selling_price||''}" placeholder="0" style="width:90px;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:13px;text-align:right;"></td>
        <td class="num">₹<input type="number" class="price-input" data-id="${p.id}" data-field="cost_price" value="${p.cost_price||''}" placeholder="0" style="width:90px;border:1px solid var(--border);border-radius:4px;padding:4px 8px;font-size:13px;text-align:right;"></td>
        <td><span class="badge ${p.active?'badge-green':''}"> ${p.active?'Active':'Inactive'}</span></td>
      </tr>`).join('') || '<tr><td colspan="4" style="text-align:center;padding:20px;color:var(--ink-dim);">No products in catalogue</td></tr>';

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
        <div class="section-sub" style="margin-top:2px;">${products.length} products · Prices set here are used for production value</div>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:14px;margin-bottom:10px;">➕ Add New Product</div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;">
        <input id="np-name" placeholder="Product name" style="flex:2;min-width:160px;border:1px solid var(--border);border-radius:6px;padding:9px 10px;font-size:14px;">
        <input id="np-sell" type="number" placeholder="Selling price ₹" style="flex:1;min-width:110px;border:1px solid var(--border);border-radius:6px;padding:9px 10px;font-size:14px;">
        <input id="np-cost" type="number" placeholder="Cost price ₹ (optional)" style="flex:1;min-width:110px;border:1px solid var(--border);border-radius:6px;padding:9px 10px;font-size:14px;">
        <button id="np-add" style="background:var(--primary);color:#fff;border:0;border-radius:6px;padding:9px 18px;font-weight:600;font-size:14px;cursor:pointer;">Add</button>
      </div>
      <div id="np-msg" style="font-size:12px;margin-top:8px;"></div>
    </div>
    <div class="table-wrap">
      <table class="data-table">
        <thead><tr><th>Product Name</th><th class="num">Selling Price</th><th class="num">Cost Price</th><th>Status</th></tr></thead>
        <tbody id="products-table-body"></tbody>
      </table>
    </div>
    <div style="margin-top:12px;font-size:12px;color:var(--ink-dim);">Click price cells to edit. Changes save automatically.</div>
  `;

  renderList();

  document.getElementById('np-add').addEventListener('click', async () => {
    const name = document.getElementById('np-name').value.trim();
    const msg = document.getElementById('np-msg');
    if (!name) { msg.style.color = 'var(--red)'; msg.textContent = 'Enter a product name'; return; }
    if (products.some(p => p.name.toLowerCase() === name.toLowerCase())) { msg.style.color = 'var(--red)'; msg.textContent = 'Product already exists'; return; }
    try {
      const p = await addProduct({
        name,
        selling_price: parseFloat(document.getElementById('np-sell').value) || 0,
        cost_price: parseFloat(document.getElementById('np-cost').value) || 0,
      });
      products = [...products, p].sort((a, b) => a.name.localeCompare(b.name));
      ['np-name', 'np-sell', 'np-cost'].forEach(i => { document.getElementById(i).value = ''; });
      msg.style.color = 'var(--green)'; msg.textContent = `Added "${name}"`;
      renderList();
    } catch (e) { msg.style.color = 'var(--red)'; msg.textContent = 'Could not add: ' + e.message; }
  });
}
