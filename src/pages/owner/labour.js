import { supabase } from '../../services/supabaseClient.js';

export async function renderLabour(root) {
  root.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;">
      <div>
        <div style="font-size:15px;font-weight:700;color:var(--ink);">Labour Rate List</div>
        <div id="worker-count" style="font-size:12px;color:var(--ink-dim);margin-top:2px;">Loading…</div>
      </div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <input type="text" id="worker-search" placeholder="Search worker…" style="padding:8px 12px;border:1px solid var(--border-strong);border-radius:8px;font-size:13px;width:180px;" />
        <button class="btn btn-primary btn-sm" onclick="openAddWorker()">+ Add Worker</button>
      </div>
    </div>

    <!-- Add/Edit modal -->
    <div id="worker-modal" style="display:none;position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:100;display:none;align-items:center;justify-content:center;padding:20px;">
      <div style="background:#fff;border-radius:14px;padding:24px;width:100%;max-width:400px;box-shadow:0 20px 60px rgba(0,0,0,.2);">
        <div style="font-size:16px;font-weight:700;margin-bottom:16px;" id="modal-title">Add Worker</div>
        <div class="form-group" style="margin-bottom:12px;">
          <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-dim);display:block;margin-bottom:6px;">Worker Name</label>
          <input type="text" id="worker-name-input" placeholder="Enter full name" style="width:100%;padding:10px 12px;border:1px solid var(--border-strong);border-radius:8px;font-size:14px;box-sizing:border-box;" />
        </div>
        <div class="form-group" style="margin-bottom:20px;">
          <label style="font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-dim);display:block;margin-bottom:6px;">Daily Rate (₹)</label>
          <input type="number" id="worker-rate-input" placeholder="400" style="width:100%;padding:10px 12px;border:1px solid var(--border-strong);border-radius:8px;font-size:14px;box-sizing:border-box;" />
        </div>
        <div style="display:flex;gap:8px;">
          <button onclick="saveWorker()" style="flex:1;background:var(--primary);color:#fff;border:none;border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;">Save</button>
          <button onclick="closeWorkerModal()" style="flex:1;background:var(--bg);border:1px solid var(--border-strong);border-radius:8px;padding:12px;font-size:14px;font-weight:600;cursor:pointer;color:var(--ink);">Cancel</button>
        </div>
      </div>
    </div>

    <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:16px;" id="labour-kpis">
      <div class="kpi-card"><div class="kpi-label">Total Workers</div><div class="kpi-value" id="kpi-total">—</div></div>
      <div class="kpi-card"><div class="kpi-label">Avg Daily Rate</div><div class="kpi-value" id="kpi-avg">—</div></div>
      <div class="kpi-card"><div class="kpi-label">₹400/day</div><div class="kpi-value" id="kpi-400">—</div></div>
      <div class="kpi-card"><div class="kpi-label">₹500+ /day</div><div class="kpi-value" id="kpi-500plus">—</div></div>
    </div>

    <div class="table-wrap">
      <table class="dt" id="workers-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Name</th>
            <th class="num">Daily Rate</th>
            <th class="num">Monthly (26 days)</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="workers-tbody">
          <tr><td colspan="6" style="text-align:center;padding:20px;color:var(--ink-dim);">Loading…</td></tr>
        </tbody>
      </table>
    </div>
  `;

  // Fix modal display
  document.getElementById('worker-modal').style.display = 'none';

  let workers = [];
  let editingId = null;

  async function loadWorkers() {
    const { data, error } = await supabase.from('workers').select('*').order('name');
    if (error) { console.error(error); return; }
    workers = data || [];
    renderWorkers(workers);
  }

  function renderWorkers(list) {
    const tbody = document.getElementById('workers-tbody');
    const total = list.length;
    const avg = total ? Math.round(list.reduce((s,w)=>s+Number(w.daily_rate||0),0)/total) : 0;
    const at400 = list.filter(w=>Number(w.daily_rate||0)===400).length;
    const above500 = list.filter(w=>Number(w.daily_rate||0)>=500).length;

    document.getElementById('kpi-total').textContent = workers.length;
    document.getElementById('kpi-avg').textContent = '₹'+avg;
    document.getElementById('kpi-400').textContent = at400;
    document.getElementById('kpi-500plus').textContent = above500;
    document.getElementById('worker-count').textContent = `${list.length} of ${workers.length} workers`;

    if (!list.length) {
      tbody.innerHTML = '<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--ink-dim);">No workers found</td></tr>';
      return;
    }

    tbody.innerHTML = list.map((w, i) => `
      <tr>
        <td style="color:var(--ink-dim);font-size:12px;">${i+1}</td>
        <td class="bold">${w.name}</td>
        <td class="num">₹${Number(w.daily_rate||0).toLocaleString('en-IN')}</td>
        <td class="num" style="color:var(--green);">₹${(Number(w.daily_rate||0)*26).toLocaleString('en-IN')}</td>
        <td><span style="background:${w.active?'var(--green-soft)':'var(--bg)'};color:${w.active?'var(--green)':'var(--ink-faint)'};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${w.active?'Active':'Inactive'}</span></td>
        <td>
          <button onclick="editWorker('${w.id}')" style="background:none;border:1px solid var(--border-strong);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;margin-right:4px;">Edit</button>
          <button onclick="toggleWorker('${w.id}','${w.active}')" style="background:none;border:1px solid var(--border-strong);border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:${w.active?'var(--red)':'var(--green)'};">${w.active?'Deactivate':'Activate'}</button>
        </td>
      </tr>`).join('');
  }

  // Search
  document.getElementById('worker-search').addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    renderWorkers(workers.filter(w => w.name.toLowerCase().includes(q)));
  });

  // Global functions
  window.openAddWorker = () => {
    editingId = null;
    document.getElementById('modal-title').textContent = 'Add Worker';
    document.getElementById('worker-name-input').value = '';
    document.getElementById('worker-rate-input').value = '400';
    document.getElementById('worker-modal').style.display = 'flex';
  };

  window.closeWorkerModal = () => {
    document.getElementById('worker-modal').style.display = 'none';
  };

  window.editWorker = (id) => {
    const w = workers.find(x => x.id === id);
    if (!w) return;
    editingId = id;
    document.getElementById('modal-title').textContent = 'Edit Worker';
    document.getElementById('worker-name-input').value = w.name;
    document.getElementById('worker-rate-input').value = w.daily_rate;
    document.getElementById('worker-modal').style.display = 'flex';
  };

  window.saveWorker = async () => {
    const name = document.getElementById('worker-name-input').value.trim();
    const rate = parseFloat(document.getElementById('worker-rate-input').value) || 400;
    if (!name) { alert('Enter worker name'); return; }

    if (editingId) {
      const { error } = await supabase.from('workers').update({ name, daily_rate: rate }).eq('id', editingId);
      if (error) { alert('Error: '+error.message); return; }
    } else {
      const { error } = await supabase.from('workers').insert([{ name, daily_rate: rate, active: true }]);
      if (error) { alert('Error: '+error.message); return; }
    }
    window.closeWorkerModal();
    await loadWorkers();
  };

  window.toggleWorker = async (id, currentActive) => {
    const newActive = currentActive === 'true' ? false : true;
    await supabase.from('workers').update({ active: newActive }).eq('id', id);
    await loadWorkers();
  };

  await loadWorkers();
}
