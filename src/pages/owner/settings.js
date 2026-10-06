import { supabase } from '../../services/supabaseClient.js';

export async function renderSettings(root) {
  root.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px;">🔌 Supabase Connection</div>
      <div style="font-size:13px;color:var(--ink-dim);margin-bottom:12px;">Test your database connection</div>
      <button class="btn btn-secondary btn-sm" id="test-conn-btn">Test Connection</button>
      <div id="conn-result" style="margin-top:10px;font-size:13px;"></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px;">📊 Sync Status</div>
      <div style="font-size:13px;color:var(--ink-dim);margin-bottom:12px;">Check what's in your database</div>
      <button class="btn btn-secondary btn-sm" id="sync-check-btn">Check Sync</button>
      <div id="sync-result" style="margin-top:10px;font-size:13px;"></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px;">📥 Excel Export</div>
      <div style="font-size:13px;color:var(--ink-dim);margin-bottom:12px;">Download your data as Excel</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="exportProduction()">Production Log</button>
        <button class="btn btn-secondary btn-sm" onclick="exportWorkers()">Labour Rates</button>
        <button class="btn btn-secondary btn-sm" onclick="exportInventory()">Inventory</button>
      </div>
      <div id="export-result" style="margin-top:10px;font-size:13px;"></div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div style="font-weight:700;font-size:15px;margin-bottom:4px;">👷 Supervisors</div>
      <div id="sup-list" style="margin-top:8px;"><div style="font-size:13px;color:var(--ink-dim);">Loading…</div></div>
    </div>

    <div class="card">
      <div style="font-weight:700;font-size:15px;margin-bottom:8px;">ℹ️ App Info</div>
      <div style="font-size:13px;color:var(--ink-dim);line-height:2;">
        Version: Moulding Lite v1.0<br>
        Supervisor App: <a href="/" style="color:var(--primary);">index.html</a><br>
        Owner Dashboard: <a href="/owner.html" style="color:var(--primary);">owner.html</a><br>
        Database: Supabase (PostgreSQL)
      </div>
    </div>
  `;

  // Test connection
  document.getElementById('test-conn-btn').addEventListener('click', async () => {
    const result = document.getElementById('conn-result');
    result.innerHTML = 'Testing…';
    try {
      const start = Date.now();
      const { data, error } = await supabase.from('supervisors').select('count').limit(1);
      const ms = Date.now() - start;
      if (error) throw error;
      result.innerHTML = `<span style="color:var(--green);font-weight:600;">✓ Connected to Supabase (${ms}ms)</span>`;
    } catch(e) {
      result.innerHTML = `<span style="color:var(--red);">✗ Failed: ${e.message}</span>`;
    }
  });

  // Sync check
  document.getElementById('sync-check-btn').addEventListener('click', async () => {
    const result = document.getElementById('sync-result');
    result.innerHTML = 'Checking…';
    try {
      const today = new Date().toISOString().slice(0,10);
      const [sups, teams, prods, workers, todayLogs, allLogs] = await Promise.all([
        supabase.from('supervisors').select('count').eq('active',true),
        supabase.from('teams').select('count'),
        supabase.from('products').select('count').eq('active',true),
        supabase.from('workers').select('count').eq('active',true),
        supabase.from('production_log').select('count').eq('production_date', today),
        supabase.from('production_log').select('count'),
      ]);
      result.innerHTML = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;margin-top:4px;">
          <div style="background:var(--green-soft);border-radius:6px;padding:8px 10px;font-size:12px;"><b>✓ Supervisors</b> ${sups.data?.[0]?.count||0} active</div>
          <div style="background:var(--green-soft);border-radius:6px;padding:8px 10px;font-size:12px;"><b>✓ Teams</b> ${teams.data?.[0]?.count||0} total</div>
          <div style="background:var(--green-soft);border-radius:6px;padding:8px 10px;font-size:12px;"><b>✓ Products</b> ${prods.data?.[0]?.count||0} active</div>
          <div style="background:var(--green-soft);border-radius:6px;padding:8px 10px;font-size:12px;"><b>✓ Workers</b> ${workers.data?.[0]?.count||0} active</div>
          <div style="background:var(--primary-soft);border-radius:6px;padding:8px 10px;font-size:12px;"><b>Today's logs</b> ${todayLogs.data?.[0]?.count||0}</div>
          <div style="background:var(--primary-soft);border-radius:6px;padding:8px 10px;font-size:12px;"><b>Total logs</b> ${allLogs.data?.[0]?.count||0}</div>
        </div>`;
    } catch(e) {
      result.innerHTML = `<span style="color:var(--red);">Error: ${e.message}</span>`;
    }
  });

  // Excel exports
  window.exportProduction = async () => {
    const result = document.getElementById('export-result');
    result.innerHTML = 'Preparing export…';
    try {
      const { data } = await supabase.from('production_log').select('*, teams(team_number, supervisor_id, supervisors(name)), products(name)').order('production_date',{ascending:false});
      if (!data?.length) { result.innerHTML = 'No data to export'; return; }
      const rows = [['Date','Supervisor','Team','Product','Quantity','Weight(kg)','Time']];
      data.forEach(l => {
        rows.push([
          l.production_date,
          l.teams?.supervisors?.name||'',
          'Team '+(l.teams?.team_number||''),
          l.products?.name||'',
          l.quantity,
          l.weight,
          l.production_time||'',
        ]);
      });
      downloadCSV(rows, 'production_log.csv');
      result.innerHTML = '<span style="color:var(--green);">✓ Downloaded production_log.csv</span>';
    } catch(e) { result.innerHTML = `<span style="color:var(--red);">Error: ${e.message}</span>`; }
  };

  window.exportWorkers = async () => {
    const result = document.getElementById('export-result');
    result.innerHTML = 'Preparing export…';
    try {
      const { data } = await supabase.from('workers').select('*').order('name');
      if (!data?.length) { result.innerHTML = 'No workers found'; return; }
      const rows = [['#','Name','Daily Rate (₹)','Monthly (26 days) ₹','Status']];
      data.forEach((w,i) => rows.push([i+1, w.name, w.daily_rate, w.daily_rate*26, w.active?'Active':'Inactive']));
      downloadCSV(rows, 'labour_rates.csv');
      result.innerHTML = '<span style="color:var(--green);">✓ Downloaded labour_rates.csv</span>';
    } catch(e) { result.innerHTML = `<span style="color:var(--red);">Error: ${e.message}</span>`; }
  };

  window.exportInventory = async () => {
    const result = document.getElementById('export-result');
    result.innerHTML = 'Preparing export…';
    try {
      const { data: logs } = await supabase.from('production_log').select('*, products(name)');
      const { data: prods } = await supabase.from('products').select('*');
      if (!logs?.length) { result.innerHTML = 'No production data'; return; }
      const stock = {};
      logs.forEach(l => {
        const n = l.products?.name||'Unknown';
        if (!stock[n]) stock[n] = 0;
        stock[n] += Number(l.quantity||0);
      });
      const rows = [['Product','Total Produced']];
      Object.entries(stock).sort((a,b)=>b[1]-a[1]).forEach(([n,q]) => rows.push([n,q]));
      downloadCSV(rows, 'inventory.csv');
      result.innerHTML = '<span style="color:var(--green);">✓ Downloaded inventory.csv</span>';
    } catch(e) { result.innerHTML = `<span style="color:var(--red);">Error: ${e.message}</span>`; }
  };

  function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(',')).join('\n');
    const blob = new Blob([csv], {type:'text/csv'});
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    a.click();
  }

  // Supervisors list
  try {
    const { data } = await supabase.from('supervisors').select('*').order('name');
    const supList = document.getElementById('sup-list');
    if (data?.length) {
      supList.innerHTML = data.map(s => `
        <div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;">
          <span style="font-weight:500;">${s.name}</span>
          <span style="background:${s.active?'var(--green-soft)':'var(--bg)'};color:${s.active?'var(--green)':'var(--ink-faint)'};padding:2px 8px;border-radius:999px;font-size:11px;font-weight:600;">${s.active?'Active':'Inactive'}</span>
        </div>`).join('');
    } else {
      supList.innerHTML = '<div style="font-size:13px;color:var(--ink-dim);">No supervisors. Add in Supabase dashboard → supervisors table.</div>';
    }
  } catch(e) {}
}
