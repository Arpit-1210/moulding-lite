import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

let dashChannel = null;

export async function renderDashboard(root) {
  const TODAY = new Date().toISOString().slice(0,10);

  // Remove old channel
  if (dashChannel) { supabase.removeChannel(dashChannel); dashChannel = null; }

  const [lr, pr, sr, tr] = await Promise.all([
    supabase.from('production_log').select('*').eq('production_date', TODAY),
    supabase.from('products').select('*').eq('active', true),
    supabase.from('supervisors').select('*').eq('active', true),
    supabase.from('teams').select('*'),
  ]);

  const logs=lr.data||[], prods=pr.data||[], sups=sr.data||[], allTeams=tr.data||[];
  const prodMap=Object.fromEntries(prods.map(p=>[p.id,p]));
  const totalUnits=logs.reduce((s,l)=>s+Number(l.quantity||0),0);
  const totalWeight=logs.reduce((s,l)=>s+Number(l.weight||0),0);
  const activeTeams=[...new Set(logs.map(l=>l.team_id))].length;

  const byProd={};
  logs.forEach(l=>{ const n=prodMap[l.product_id]?.name||'—'; if(!byProd[n]) byProd[n]={qty:0,wt:0}; byProd[n].qty+=Number(l.quantity||0); byProd[n].wt+=Number(l.weight||0); });

  const supCards=sups.map(s=>{
    const sTeams=allTeams.filter(t=>t.supervisor_id===s.id);
    const sLogs=logs.filter(l=>sTeams.some(t=>t.id===l.team_id));
    const sUnits=sLogs.reduce((a,l)=>a+Number(l.quantity||0),0);
    const sWt=sLogs.reduce((a,l)=>a+Number(l.weight||0),0);
    return `<div class="team-prod-card" style="border-left-color:${sUnits>0?'var(--green)':'var(--border-strong)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <h3>${s.name}</h3>
        <span class="badge ${sUnits>0?'badge-green':''}" style="${!sUnits?'background:var(--bg);color:var(--ink-faint);':''}">${sUnits>0?'● Active':'Idle'}</span>
      </div>
      <div class="team-prod-stat"><span class="label">Teams</span><span class="value">${sTeams.length}</span></div>
      <div class="team-prod-stat"><span class="label">Units</span><span class="value" style="color:var(--primary)">${sUnits}</span></div>
      <div class="team-prod-stat"><span class="label">Weight</span><span class="value">${sWt.toFixed(1)} kg</span></div>
      <div class="team-prod-stat"><span class="label">Entries</span><span class="value">${sLogs.length}</span></div>
    </div>`;
  }).join('')||'<div class="state-msg">No supervisors</div>';

  const prodRows=Object.entries(byProd).sort((a,b)=>b[1].qty-a[1].qty)
    .map(([n,v])=>`<tr><td class="bold">${n}</td><td class="num">${v.qty}</td><td class="num">${v.wt.toFixed(1)} kg</td></tr>`)
    .join('')||'<tr><td colspan="3" style="text-align:center;color:var(--ink-dim);padding:20px;">No production today</td></tr>';

  root.innerHTML = `
    <div class="kpi-grid">
      <div class="kpi-card" style="--accent-color:var(--primary)"><div class="kpi-icon">🏭</div><div class="kpi-label">Units Today</div><div class="kpi-value">${totalUnits}</div><div class="kpi-sub">${logs.length} entries</div></div>
      <div class="kpi-card" style="--accent-color:var(--green)"><div class="kpi-icon">⚖️</div><div class="kpi-label">Total Weight</div><div class="kpi-value">${totalWeight.toFixed(1)}</div><div class="kpi-sub">Kilograms</div></div>
      <div class="kpi-card" style="--accent-color:var(--orange)"><div class="kpi-icon">👷</div><div class="kpi-label">Active Teams</div><div class="kpi-value">${activeTeams}</div><div class="kpi-sub">of ${allTeams.length} total</div></div>
      <div class="kpi-card" style="--accent-color:var(--purple)"><div class="kpi-icon">📦</div><div class="kpi-label">Products</div><div class="kpi-value">${Object.keys(byProd).length}</div><div class="kpi-sub">made today</div></div>
    </div>
    <div class="section-head"><div><div class="section-title">By Supervisor</div><div class="section-sub">Live status</div></div><span class="badge badge-green" id="live-badge">● Live</span></div>
    <div class="team-prod-grid">${supCards}</div>
    <div class="section-head"><div class="section-title">Today by Product</div></div>
    <div class="table-wrap"><table class="data-table">
      <thead><tr><th>Product</th><th class="num">Units</th><th class="num">Weight</th></tr></thead>
      <tbody>${prodRows}</tbody>
    </table></div>`;

  // Live subscription with unique channel name
  dashChannel = supabase.channel(`owner-dash-${Date.now()}`)
    .on('postgres_changes', { event:'INSERT', schema:'public', table:'production_log', filter:`production_date=eq.${TODAY}` },
      () => { const b=document.getElementById('live-badge'); if(b){b.textContent='● Updated'; setTimeout(()=>b.textContent='● Live',2000);} renderDashboard(root); })
    .subscribe();
}
