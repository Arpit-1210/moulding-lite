import { fetchAllProducts, createProduct, updateProduct, setProductActive } from '../../services/products.js';
import { formatRupees } from '../../components/kpiRow.js';

export async function render(container) {
  container.innerHTML = `
    <div class="panel" style="max-width: 640px">
      <div class="panel-head"><h2>Add a product</h2></div>
      <div class="form-grid">
        <input type="text" placeholder="Product name" id="np-name" />
        <input type="number" placeholder="Selling price (₹/unit)" id="np-price" min="0" step="0.01" />
        <input type="number" placeholder="RM cost (₹/unit)" id="np-rm" min="0" step="0.01" />
        <button class="btn btn-primary btn-compact" id="np-save">+ Add product</button>
      </div>
    </div>

    <div class="panel">
      <div class="panel-head"><h2>Product catalogue</h2></div>
      <div id="products-table-root"><p class="state-msg">Loading…</p></div>
    </div>
  `;

  const tableRoot = container.querySelector('#products-table-root');
  const nameInput = container.querySelector('#np-name');
  const priceInput = container.querySelector('#np-price');
  const rmInput = container.querySelector('#np-rm');
  const saveBtn = container.querySelector('#np-save');

  async function load() {
    tableRoot.innerHTML = '<p class="state-msg">Loading…</p>';
    try {
      const products = await fetchAllProducts();
      renderTable(products);
    } catch (err) {
      console.error(err);
      tableRoot.innerHTML = '<p class="error-text">Could not load products.</p>';
    }
  }

  function renderTable(products) {
    if (products.length === 0) {
      tableRoot.innerHTML = '<p class="state-msg">No products yet — add your first one above.</p>';
      return;
    }
    tableRoot.innerHTML = `
      <table class="data-table">
        <thead>
          <tr>
            <th>Product</th><th class="num">Selling price</th><th class="num">RM cost</th>
            <th class="num">Margin/unit</th><th>Status</th><th></th>
          </tr>
        </thead>
        <tbody>
          ${products
            .map((p) => {
              const marginPerUnit = Number(p.selling_price) - Number(p.rm_cost);
              return `
              <tr data-row-id="${p.id}">
                <td data-display>${escapeHtml(p.name)}</td>
                <td class="num" data-display>${formatRupees(p.selling_price)}</td>
                <td class="num" data-display>${formatRupees(p.rm_cost)}</td>
                <td class="num">${formatRupees(marginPerUnit)}</td>
                <td><span class="pill ${p.active ? 'pill-active' : 'pill-inactive'}">${p.active ? 'Active' : 'Inactive'}</span></td>
                <td style="white-space:nowrap">
                  <button class="btn btn-secondary btn-compact" data-action="edit">Edit</button>
                  <button class="btn btn-compact ${p.active ? 'btn-danger-outline' : 'btn-secondary'}" data-action="toggle">
                    ${p.active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>`;
            })
            .join('')}
        </tbody>
      </table>`;

    tableRoot.querySelectorAll('button[data-action="toggle"]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const row = btn.closest('tr');
        const id = row.dataset.rowId;
        const currentlyActive = btn.textContent.trim() === 'Deactivate';
        btn.disabled = true;
        try {
          await setProductActive(id, !currentlyActive);
          await load();
        } catch (err) {
          console.error(err);
          alert('Could not update that product. Please try again.');
          btn.disabled = false;
        }
      });
    });

    tableRoot.querySelectorAll('button[data-action="edit"]').forEach((btn) => {
      btn.addEventListener('click', () => startEdit(btn.closest('tr')));
    });
  }

  function startEdit(row) {
    const id = row.dataset.rowId;
    const nameCell = row.children[0];
    const priceCell = row.children[1];
    const rmCell = row.children[2];
    const currentName = nameCell.textContent;
    const currentPrice = priceCell.textContent.replace(/[^0-9.]/g, '');
    const currentRm = rmCell.textContent.replace(/[^0-9.]/g, '');

    nameCell.innerHTML = `<input type="text" value="${escapeHtml(currentName)}" style="min-width:140px" />`;
    priceCell.innerHTML = `<input type="number" value="${currentPrice}" min="0" step="0.01" style="width:100px; text-align:right" />`;
    rmCell.innerHTML = `<input type="number" value="${currentRm}" min="0" step="0.01" style="width:100px; text-align:right" />`;

    const actionsCell = row.children[5];
    actionsCell.innerHTML = `
      <button class="btn btn-primary btn-compact" data-action="save-edit">Save</button>
      <button class="btn btn-secondary btn-compact" data-action="cancel-edit">Cancel</button>`;

    actionsCell.querySelector('[data-action="cancel-edit"]').addEventListener('click', load);
    actionsCell.querySelector('[data-action="save-edit"]').addEventListener('click', async () => {
      const name = nameCell.querySelector('input').value.trim();
      const sellingPrice = Number(priceCell.querySelector('input').value);
      const rmCost = Number(rmCell.querySelector('input').value);
      if (!name) return alert('Enter a product name.');
      if (Number.isNaN(sellingPrice) || Number.isNaN(rmCost)) return alert('Enter valid numbers for price and RM cost.');
      try {
        await updateProduct(id, { name, sellingPrice, rmCost });
        await load();
      } catch (err) {
        console.error(err);
        alert('Could not save changes. Please try again.');
      }
    });
  }

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    const sellingPrice = Number(priceInput.value);
    const rmCost = Number(rmInput.value);
    if (!name) return alert('Enter a product name.');
    if (!priceInput.value || Number.isNaN(sellingPrice)) return alert('Enter a selling price.');
    if (!rmInput.value || Number.isNaN(rmCost)) return alert('Enter an RM cost.');

    saveBtn.disabled = true;
    try {
      await createProduct({ name, sellingPrice, rmCost });
      nameInput.value = '';
      priceInput.value = '';
      rmInput.value = '';
      await load();
    } catch (err) {
      console.error(err);
      alert('Could not add that product. Please try again.');
    } finally {
      saveBtn.disabled = false;
    }
  });

  await load();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
