import { createClient } from '@supabase/supabase-js';
const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export async function renderProfitLoss(root) {
  root.innerHTML=`
    <div class="range-bar">
      <button class="range-btn active" data-period="month">This Month</button>
      <button class="range-btn" data-period="lastmonth">Last Month</button>
      <button class="range-btn" data-period="all">All Time</button>
    </div>
    <div id="pl-inner"><div class="state-msg">Loading…</div></div>`;

  async function loadPL(period) {
    const inner=document.getElementById('pl-inner');
    inner.innerHTML='<div class="state-msg">Loading…</div>';
    const TODAY=new Date().toISOString().slice(0,10);
    let fromStr;
    if(period==='month') fromStr=TODAY.slice(0,7)+'-01';
    else if(period==='lastmonth'){ const lm=new Date(); lm.setMonth(lm.getMonth()-1); fromStr=lm.toISOString().slice(0,7)+'-01'; }
    else fromStr='2020-01-01';

    const [lr,pr]=await Promise.all([
      supabase.from('production_log').select('*').gte('production_date',fromStr).lte('production_date',TODAY),
      supabase.from('products').select('*'),
    ]);
    const logs=lr.data||[], prods=pr.data||[];
    const prodMap=Object.fromEntries(prods.map(p=>[p.id,p]));
    let revenue=0,cost=0;
    const byProd={};
    logs.forEach(l=>{
      const p=prodMap[l.product_id]; if(!p) return;
      const qty=Number(l.quantity||0), rev=qty*Number(p.selling_price||0), cst=qty*Number(p.cost_price||0);
      revenue+=rev; cost+=cst;
      const n=p.name;
      if(!byProd[n]) byProd[n]={qty:0,rev:0,cst:0};
      byProd[n].qty+=qty; byProd[n].rev+=rev; byProd[n].cst+=cst;
    });
    const profit=revenue-cost, margin=revenue>0?(profit/revenue*100).toFixed(1):0;
    const totalUnits=logs.reduce((s,l)=>s+Number(l.quantity||0),0);
    const hasPrice=prods.some(p=>p.selling_price>0);
    const rows=Object.entries(byProd).sort((a,b)=>b[1].rev-a[1].rev).map(([n,v])=>`<tr>
      <td class="bold">${n}</td><td class="num">${v.qty}</td>
      <td class="num">₹${v.rev.toLocaleString('en-IN')}</td>
      <td class="num">₹${v.cst.toLocaleString('en-IN')}</td>
      <td class="num" style="color:${v.rev-v.cst>=0?'var(--green)':'var(--red)'}">₹${(v.rev-v.cst).toLocaleString('en-IN')}</td>
    </tr>`).join('')||'<tr><td colspan="5" style="text-align:center;padding:20px;color:var(--ink-dim);">No data</td></tr>';

    inner.innerHTML=`
      <div class="pl-net" style="background:${profit>=0?'linear-gradient(135deg,#1967D2,#4285f4)':'linear-gradient(135deg,#dc2626,#ef4444)'}">
        <div class="lbl">Net Profit</div>
        <div class="amt">₹${Math.abs(profit).toLocaleString('en-IN')}</div>
        <div class="mgn">${profit>=0?'↑':'↓'} ${margin}% margin · ${totalUnits} units</div>
      </div>
      <div class="pl-grid">
        <div class="pl-section"><h3>Revenue</h3>
          <div class="pl-row"><span>Units</span><span>${totalUnits}</span></div>
          <div class="pl-row total"><span>Total</span><span class="green">₹${revenue.toLocaleString('en-IN')}</span></div>
        </div>
        <div class="pl-section"><h3>Cost</h3>
          <div class="pl-row"><span>Material</span><span class="red">₹${cost.toLocaleString('en-IN')}</span></div>
          <div class="pl-row total"><span>Total</span><span class="red">₹${cost.toLocaleString('en-IN')}</span></div>
        </div>
      </div>
      <div class="table-wrap"><table class="data-table">
        <thead><tr><th>Product</th><th class="num">Qty</th><th class="num">Revenue</th><th class="num">Cost</th><th class="num">Profit</th></tr></thead>
        <tbody>${rows}</tbody>
      </table></div>
      ${!hasPrice?'<div style="margin-top:10px;font-size:12px;color:var(--ink-dim);text-align:center;">Set selling price in Products page for revenue figures</div>':''}`;
  }

  root.querySelectorAll('.range-btn').forEach(btn=>btn.addEventListener('click',()=>{
    root.querySelectorAll('.range-btn').forEach(b=>b.classList.remove('active'));
    btn.classList.add('active'); loadPL(btn.dataset.period);
  }));
  loadPL('month');
}
