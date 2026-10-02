import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export async function renderInventory(root) {
  const TODAY = new Date().toISOString().slice(0,10);
  const monthStart = TODAY.slice(0,7)+'-01';
  const weekAgo = new Date(); weekAgo.setDate(weekAgo.getDate()-7);
  const weekStr = weekAgo.toISOString().slice(0,10);

  const [lr, pr] = await Promise.all([
    supabase.from('production_log').select('*').lte('production_date', TODAY),
    supabase.from('products').select('*').eq('active', true),
  ]);

  const logs=lr.data||[], prods=pr.data||[];
  const prodMap=Object.fromEntries(prods.map(p=>[p.id,p]));
  const stock={};
  logs.forEach(l=>{
    const n=prodMap[l.product_id]?.name||'Unknown';
    if(!stock[n]) stock[n]={total:0,month:0,week:0};
    stock[n].total+=Number(l.quantity||0);
    if(l.production_date>=monthStart) stock[n].month+=Number(l.quantity||0);
    if(l.production_date>=weekStr) stock[n].week+=Number(l.quantity||0);
  });

  const totalAll=logs.reduce((s,l)=>s+Number(l.quantity||0),0);
  const totalMonth=logs.filter(l=>l.production_date>=monthStart).reduce((s,l)=>s+Number(l.quantity||0),0);

  const cards=Object.entries(stock).sort((a,b)=>b[1].total-a[1].total).map(([n,v])=>`
    <div class="inv-card">
      <div class="prod-name">${n}</div>
      <div class="inv-stat"><span class="lbl">This week</span><span class="val">${v.week}</span></div>
      <div class="inv-stat"><span class="lbl">This month</span><span class="val">${v.month}</span></div>
      <div class="inv-stat"><span class="lbl" style="font-weight:600;">Total</span><span class="val" style="color:var(--primary);font-size:15px;">${v.total}</span></div>
    </div>`).join('')||'<div class="state-msg">No production data yet</div>';

  root.innerHTML=`
    <div class="kpi-grid" style="margin-bottom:24px;">
      <div class="kpi-card" style="--accent-color:var(--primary)"><div class="kpi-label">All Time</div><div class="kpi-value">${totalAll}</div><div class="kpi-sub">total units</div></div>
      <div class="kpi-card" style="--accent-color:var(--green)"><div class="kpi-label">This Month</div><div class="kpi-value">${totalMonth}</div><div class="kpi-sub">units this month</div></div>
      <div class="kpi-card" style="--accent-color:var(--orange)"><div class="kpi-label">Products</div><div class="kpi-value">${Object.keys(stock).length}</div><div class="kpi-sub">tracked</div></div>
    </div>
    <div class="section-head"><div class="section-title">Stock by Product</div></div>
    <div class="inv-grid">${cards}</div>`;
}
