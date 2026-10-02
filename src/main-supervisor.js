import './styles/base.css';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let currentSupervisor = null;
let currentTeamId = null;
let teams = [], products = [], workers = [], todayLogs = [], supervisors = [];
let currentPage = 'dashboard';
const TODAY = new Date().toISOString().slice(0,10);
const OWNER_PIN = '1234'; // Change this

function loadSession() { try { return JSON.parse(localStorage.getItem('ml_session')||'{}'); } catch { return {}; } }
function saveSession(d) { localStorage.setItem('ml_session', JSON.stringify({...loadSession(),...d})); }

function toast(msg, type='success') {
  const el=document.getElementById('toast'), msgEl=document.getElementById('toast-msg');
  if(!el) return;
  msgEl.textContent=msg; el.className=`toast show ${type}`;
  clearTimeout(el._t); el._t=setTimeout(()=>el.classList.remove('show'),2500);
}

// ── Navigation ──
function showPage(page) {
  currentPage=page;
  document.querySelectorAll('.page-view').forEach(v=>v.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n=>n.classList.remove('active'));
  const pageEl=document.getElementById(`page-${page}`);
  if(pageEl) pageEl.classList.add('active');
  document.querySelector(`[data-page="${page}"]`)?.classList.add('active');
  const titles={dashboard:'Dashboard',production:'Log Production',teams:'My Teams',log:'Today\'s Log'};
  const el=document.getElementById('page-title');
  if(el) el.textContent=titles[page]||page;
  closeSidebar();
  switch(page){
    case 'dashboard':  renderDashboard(); break;
    case 'production': renderProduction(); break;
    case 'teams':      renderTeams(); break;
    case 'log':        renderLog(0); break;
  }
}
window.showPage=showPage;

document.getElementById('hamburger')?.addEventListener('click',()=>{
  document.getElementById('sidebar').classList.add('open');
  document.getElementById('overlay').classList.add('open');
});
function closeSidebar(){
  document.getElementById('sidebar')?.classList.remove('open');
  document.getElementById('overlay')?.classList.remove('open');
}
document.getElementById('overlay')?.addEventListener('click',closeSidebar);
document.querySelectorAll('.nav-item').forEach(btn=>btn.addEventListener('click',()=>showPage(btn.dataset.page)));

document.querySelectorAll('[data-days]').forEach(btn=>btn.addEventListener('click',()=>{
  btn.closest('.range-bar').querySelectorAll('.range-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active'); renderLog(parseInt(btn.dataset.days));
}));

const dp=document.getElementById('date-pill');
if(dp) dp.textContent=new Date().toLocaleDateString('en-IN',{weekday:'short',day:'numeric',month:'short'});

// ── Supervisor modal ──
window.openSupModal=async function(){
  const modal=document.getElementById('sup-modal');
  modal.classList.add('open');
  const cardsEl=document.getElementById('sup-cards-modal');
  const confirmBtn=document.getElementById('btn-confirm-sup');
  cardsEl.innerHTML='<div class="state-msg">Loading…</div>';
  confirmBtn.disabled=true;
  if(!supervisors.length){
    const {data}=await supabase.from('supervisors').select('*').eq('active',true).order('name');
    supervisors=data||[];
  }
  let selectedId=currentSupervisor?.id||null;
  function renderCards(){
    cardsEl.innerHTML=supervisors.map(s=>`
      <div class="sup-card ${s.id===selectedId?'selected':''}" data-id="${s.id}">
        <div class="sup-avatar">${s.name.charAt(0).toUpperCase()}</div>
        <div><div class="sup-name">${s.name}</div><div class="sup-role">Moulding Supervisor</div></div>
        <div class="sup-check">✓</div>
      </div>`).join('')||'<div class="state-msg">No supervisors found</div>';
    cardsEl.querySelectorAll('.sup-card').forEach(card=>{
      card.addEventListener('click',()=>{ selectedId=card.dataset.id; confirmBtn.disabled=false; renderCards(); });
    });
  }
  renderCards();
  if(selectedId) confirmBtn.disabled=false;
  confirmBtn.onclick=async()=>{
    const sup=supervisors.find(s=>String(s.id)===String(selectedId));
    if(!sup) return;
    currentSupervisor=sup; saveSession({supervisor:sup,teamId:null});
    updateUserPill(); modal.classList.remove('open');
    await loadSupervisorData(); showPage(currentPage); toast(`Welcome, ${sup.name}!`);
  };
};
document.getElementById('sup-modal').addEventListener('click',e=>{
  if(e.target===document.getElementById('sup-modal')) document.getElementById('sup-modal').classList.remove('open');
});

function updateUserPill(){
  const name=document.getElementById('sup-pill-name');
  const avatar=document.getElementById('sup-avatar-sm');
  if(currentSupervisor){ if(name) name.textContent=currentSupervisor.name; if(avatar) avatar.textContent=currentSupervisor.name.charAt(0).toUpperCase(); }
  else{ if(name) name.textContent='Select Supervisor'; if(avatar) avatar.textContent='?'; }
}

async function loadSupervisorData(){
  if(!currentSupervisor) return;
  const [tr,pr,wr]=await Promise.all([
    supabase.from('teams').select('*').eq('supervisor_id',currentSupervisor.id).order('team_number'),
    supabase.from('products').select('*').eq('active',true).order('name'),
    supabase.from('workers').select('*').eq('active',true).order('name'),
  ]);
  teams=tr.data||[]; products=pr.data||[]; workers=wr.data||[];
  if(teams.length&&!currentTeamId) currentTeamId=teams[0].id;
  await loadTodayLogs();
}

async function loadTodayLogs(){
  if(!currentSupervisor||!teams.length){ todayLogs=[]; return; }
  const teamIds=teams.map(t=>t.id);
  const {data}=await supabase.from('production_log').select('*').in('team_id',teamIds).eq('production_date',TODAY).order('created_at',{ascending:false});
  todayLogs=data||[];
}

// ── Dashboard ──
async function renderDashboard(){
  const el=document.getElementById('dash-content');
  el.innerHTML='<div class="state-msg">Loading…</div>';
  const [lr,pr,sr,tr]=await Promise.all([
    supabase.from('production_log').select('*').eq('production_date',TODAY),
    supabase.from('products').select('*').eq('active',true),
    supabase.from('supervisors').select('*').eq('active',true),
    supabase.from('teams').select('*'),
  ]);
  const logs=lr.data||[],allProds=pr.data||[],allSups=sr.data||[],allTeams=tr.data||[];
  const prodMap=Object.fromEntries(allProds.map(p=>[p.id,p]));
  const totalUnits=logs.reduce((s,l)=>s+Number(l.quantity||0),0);
  const totalWeight=logs.reduce((s,l)=>s+Number(l.weight||0),0);
  const activeTeams=[...new Set(logs.map(l=>l.team_id))].length;
  const byProd={};
  logs.forEach(l=>{ const n=prodMap[l.product_id]?.name||'—'; if(!byProd[n]) byProd[n]={qty:0,wt:0}; byProd[n].qty+=Number(l.quantity||0); byProd[n].wt+=Number(l.weight||0); });
  const supCards=allSups.map(s=>{
    const sTeams=allTeams.filter(t=>t.supervisor_id===s.id);
    const sLogs=logs.filter(l=>sTeams.some(t=>t.id===l.team_id));
    const sUnits=sLogs.reduce((a,l)=>a+Number(l.quantity||0),0);
    const sWt=sLogs.reduce((a,l)=>a+Number(l.weight||0),0);
    return `<div class="team-card" style="border-left-color:${sUnits>0?'var(--green)':'var(--border-strong)'}">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
        <h3>${s.name}</h3><span class="badge ${sUnits>0?'badge-green':''}" style="${!sUnits?'background:var(--bg);color:var(--ink-faint);':''}">${sUnits>0?'● Active':'Idle'}</span>
      </div>
      <div class="team-stat"><span class="lbl">Teams</span><span class="val">${sTeams.length}</span></div>
      <div class="team-stat"><span class="lbl">Units</span><span class="val" style="color:var(--primary)">${sUnits}</span></div>
      <div class="team-stat"><span class="lbl">Weight</span><span class="val">${sWt.toFixed(1)} kg</span></div>
    </div>`;
  }).join('')||'<div class="state-msg">No supervisors</div>';
  const prodRows=Object.entries(byProd).sort((a,b)=>b[1].qty-a[1].qty)
    .map(([n,v])=>`<tr><td class="bold">${n}</td><td class="num">${v.qty}</td><td class="num">${v.wt.toFixed(1)} kg</td></tr>`)
    .join('')||'<tr><td colspan="3" style="text-align:center;color:var(--ink-dim);padding:20px;">No production today</td></tr>';
  const heroText=currentSupervisor?`Welcome back, ${currentSupervisor.name}`:`Good ${new Date().getHours()<12?'Morning':'Afternoon'} 👋`;
  el.innerHTML=`
    <div class="hero-banner">
      <div><div class="hero-title">${heroText}</div><div class="hero-sub">Moulding · ${new Date().toLocaleDateString('en-IN',{day:'numeric',month:'long'})}</div></div>
      <button class="hero-action" onclick="${currentSupervisor?'showPage(\'production\')':'openSupModal()'}">${currentSupervisor?'Log Production →':'Select Supervisor →'}</button>
    </div>
    <div class="kpi-grid">
      <div class="kpi-card" style="--accent:#1967D2"><div class="kpi-icon">🏭</div><div class="kpi-label">Units Today</div><div class="kpi-value">${totalUnits}</div><div class="kpi-sub">${logs.length} entries</div></div>
      <div class="kpi-card" style="--accent:#16a34a"><div class="kpi-icon">⚖️</div><div class="kpi-label">Weight (kg)</div><div class="kpi-value">${totalWeight.toFixed(1)}</div><div class="kpi-sub">Total produced</div></div>
      <div class="kpi-card" style="--accent:#d97706"><div class="kpi-icon">👷</div><div class="kpi-label">Active Teams</div><div class="kpi-value">${activeTeams}</div><div class="kpi-sub">of ${allTeams.length} total</div></div>
      <div class="kpi-card" style="--accent:#7c3aed"><div class="kpi-icon">📦</div><div class="kpi-label">Products</div><div class="kpi-value">${Object.keys(byProd).length}</div><div class="kpi-sub">made today</div></div>
    </div>
    <div style="text-align:right;margin-bottom:8px;"><a href="/owner.html" style="font-size:12px;color:var(--primary);font-weight:600;">👑 Owner Dashboard →</a></div>
    <div class="section-head"><div><div class="section-title">By Supervisor</div><div class="section-sub">Live status</div></div></div>
    <div class="team-grid">${supCards}</div>
    <div class="section-head"><div class="section-title">Today by Product</div></div>
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Product</th><th class="num">Units</th><th class="num">Weight</th></tr></thead>
      <tbody>${prodRows}</tbody>
    </table></div>`;
  supabase.channel(`dash-${Date.now()}`).on('postgres_changes',{event:'INSERT',schema:'public',table:'production_log',filter:`production_date=eq.${TODAY}`},()=>renderDashboard()).subscribe();
}

// ── Production — with product SEARCH ──
async function renderProduction(){
  if(!currentSupervisor){
    document.getElementById('page-production').innerHTML=`
      <div class="prod-panel" style="border-left:4px solid var(--orange);">
        <div style="font-weight:600;color:var(--orange);margin-bottom:6px;">⚠ No supervisor selected</div>
        <div style="font-size:13px;color:var(--ink-dim);margin-bottom:12px;">Select your name from the sidebar.</div>
        <button class="btn-primary" onclick="openSupModal()" style="max-width:200px;">Select Supervisor</button>
      </div>`; return;
  }
  document.getElementById('page-production').innerHTML=`
    <div class="today-bar">
      <div class="today-kpi"><div class="val" id="kpi-units">0</div><div class="lbl">Units</div></div>
      <div class="today-kpi"><div class="val" id="kpi-weight">0</div><div class="lbl">Kg</div></div>
      <div class="today-kpi"><div class="val" id="kpi-entries">0</div><div class="lbl">Entries</div></div>
    </div>
    <div class="prod-panel">
      <div class="team-tabs" id="team-tabs-prod"></div>
      <div class="field">
        <label>Product</label>
        <input type="text" id="prod-search" placeholder="Search product…" autocomplete="off"
          style="margin-bottom:6px;" />
        <select id="prod-product-select"><option value="">Select product…</option></select>
      </div>
      <div class="field-row">
        <div class="field" style="margin-bottom:0;"><label>Quantity (pcs)</label><input type="number" id="prod-qty" inputmode="numeric" placeholder="0" min="1" /></div>
        <div class="field" style="margin-bottom:0;"><label>Weight (kg)</label><input type="number" id="prod-weight" inputmode="decimal" placeholder="0.0" min="0" step="0.1" /></div>
      </div>
      <div style="height:12px;"></div>
      <button class="btn-primary" id="btn-save-prod">Save Entry</button>
    </div>
    <div class="section-head"><div class="section-title">Today's Log</div></div>
    <div id="prod-log-list"><div class="state-msg">No entries yet</div></div>`;

  // Team tabs
  const tabsEl=document.getElementById('team-tabs-prod');
  tabsEl.innerHTML=teams.map(t=>`<button class="team-tab ${t.id===currentTeamId?'active':''}" data-id="${t.id}">${t.name||'Team '+t.team_number}</button>`).join('');
  tabsEl.querySelectorAll('.team-tab').forEach(btn=>btn.addEventListener('click',()=>{
    currentTeamId=btn.dataset.id; saveSession({teamId:currentTeamId}); renderProduction();
  }));

  // Product search + dropdown
  const sel=document.getElementById('prod-product-select');
  const searchInput=document.getElementById('prod-search');
  function populateProducts(filter=''){
    const filtered=filter?products.filter(p=>p.name.toLowerCase().includes(filter.toLowerCase())):products;
    sel.innerHTML='<option value="">Select product…</option>'+filtered.map(p=>`<option value="${p.id}">${p.name}</option>`).join('');
  }
  populateProducts();
  searchInput.addEventListener('input',()=>populateProducts(searchInput.value));

  updateProdKPIs(); renderProdLog();

  document.getElementById('btn-save-prod').onclick=async()=>{
    const productId=sel.value, qty=parseFloat(document.getElementById('prod-qty').value), weight=parseFloat(document.getElementById('prod-weight').value);
    if(!currentTeamId){toast('Select a team','error');return;}
    if(!productId){toast('Select a product','error');return;}
    if(!qty||qty<=0){toast('Enter quantity','error');return;}
    if(!weight||weight<=0){toast('Enter weight','error');return;}
    const saveBtn=document.getElementById('btn-save-prod');
    saveBtn.disabled=true; saveBtn.textContent='Saving…';
    const now=new Date();
    const {data,error}=await supabase.from('production_log').insert([{team_id:currentTeamId,product_id:productId,quantity:qty,weight,production_date:TODAY,production_time:now.toTimeString().slice(0,5)}]).select().single();
    saveBtn.disabled=false; saveBtn.textContent='Save Entry';
    if(error){toast('Save failed','error');return;}
    todayLogs.unshift(data);
    document.getElementById('prod-qty').value=''; document.getElementById('prod-weight').value='';
    sel.value=''; searchInput.value=''; populateProducts();
    updateProdKPIs(); renderProdLog(); toast('Saved ✓');
  };
}

function updateProdKPIs(){
  const u=document.getElementById('kpi-units'),w=document.getElementById('kpi-weight'),e=document.getElementById('kpi-entries');
  if(u) u.textContent=todayLogs.reduce((s,l)=>s+Number(l.quantity||0),0);
  if(w) w.textContent=todayLogs.reduce((s,l)=>s+Number(l.weight||0),0).toFixed(1);
  if(e) e.textContent=todayLogs.length;
}

function renderProdLog(){
  const el=document.getElementById('prod-log-list');
  if(!el) return;
  const prodMap=Object.fromEntries(products.map(p=>[p.id,p]));
  const teamMap=Object.fromEntries(teams.map(t=>[t.id,t]));
  if(!todayLogs.length){el.innerHTML='<div class="state-msg">No entries yet today</div>';return;}
  el.innerHTML=todayLogs.map(l=>`
    <div class="log-item">
      <div><div class="prod-name">${prodMap[l.product_id]?.name||'—'}</div><div class="prod-meta">${teamMap[l.team_id]?.name||'Team '+(teamMap[l.team_id]?.team_number||'—')} · ${l.production_time||''}</div></div>
      <div style="text-align:right;"><div class="prod-qty">${l.quantity}</div><div class="prod-wt">${l.weight} kg</div></div>
    </div>`).join('');
}

// ── Teams — with worker search dropdown + rename ──
async function renderTeams(){
  const el=document.getElementById('page-teams');
  if(!currentSupervisor){el.innerHTML='<div class="state-msg">Select a supervisor first</div>';return;}
  el.innerHTML='<div class="state-msg">Loading…</div>';
  const {data}=await supabase.from('teams').select('*').eq('supervisor_id',currentSupervisor.id).order('team_number');
  teams=data||[];

  async function addTeam(){
    const next=teams.length+1;
    const {data:t}=await supabase.from('teams').insert([{supervisor_id:currentSupervisor.id,team_number:next,name:`Team ${next}`,members:[]}]).select().single();
    if(t){teams.push(t);renderTeamCards();}
  }

  async function renameTeam(teamId,newName){
    if(!newName.trim()) return;
    await supabase.from('teams').update({name:newName.trim()}).eq('id',teamId);
    const t=teams.find(x=>x.id===teamId); if(t) t.name=newName.trim();
    renderTeamCards(); toast('Team renamed');
  }

  async function addMemberFromWorker(teamId, workerName){
    const team=teams.find(t=>t.id===teamId);
    if(!team||!workerName.trim()) return;
    if((team.members||[]).includes(workerName.trim())){toast('Already in team','error');return;}
    team.members=[...(team.members||[]),workerName.trim()];
    await supabase.from('teams').update({members:team.members}).eq('id',teamId);
    renderTeamCards(); toast(`${workerName} added`);
  }

  async function removeMember(teamId, memberName){
    const team=teams.find(t=>t.id===teamId);
    if(!team) return;
    team.members=(team.members||[]).filter(m=>m!==memberName);
    await supabase.from('teams').update({members:team.members}).eq('id',teamId);
    renderTeamCards();
  }

  function renderTeamCards(){
    el.innerHTML=`
      ${teams.map(t=>`
        <div class="team-setup-card">
          <div class="team-setup-head">
            <span class="team-badge">👷 ${t.name||'Team '+t.team_number}</span>
            <span style="font-size:12px;color:var(--ink-dim);">${(t.members||[]).length} members</span>
          </div>

          <!-- Rename -->
          <div style="display:flex;gap:8px;margin-bottom:10px;">
            <input type="text" id="rename-${t.id}" value="${t.name||'Team '+t.team_number}"
              placeholder="Team name"
              style="flex:1;padding:7px 10px;font-size:13px;border:1px solid var(--border-strong);border-radius:6px;font-family:inherit;" />
            <button onclick="renameTeam('${t.id}',document.getElementById('rename-${t.id}').value)"
              style="background:var(--primary-soft);color:var(--primary);border:1px solid var(--primary);border-radius:6px;padding:7px 12px;font-size:12px;font-weight:600;cursor:pointer;">Rename</button>
          </div>

          <!-- Members -->
          <div class="member-chips" style="margin-bottom:10px;">
            ${(t.members||[]).map(m=>`
              <span class="chip" style="display:inline-flex;align-items:center;gap:4px;">
                ${m}
                <span onclick="removeMember('${t.id}','${m.replace(/'/g,"\\'")}')"
                  style="cursor:pointer;color:var(--red);font-size:14px;line-height:1;margin-left:2px;">×</span>
              </span>`).join('')||'<span style="font-size:12px;color:var(--ink-faint);">No members yet</span>'}
          </div>

          <!-- Add from worker list -->
          <div style="display:flex;gap:8px;align-items:center;">
            <div style="flex:1;position:relative;">
              <input type="text" id="worker-search-${t.id}" placeholder="Search worker…" autocomplete="off"
                style="width:100%;padding:8px 10px;font-size:13px;border:1px solid var(--border-strong);border-radius:6px;font-family:inherit;box-sizing:border-box;"
                oninput="filterWorkers('${t.id}',this.value)" />
              <select id="worker-select-${t.id}"
                style="width:100%;padding:8px 10px;font-size:13px;border:1px solid var(--border-strong);border-radius:6px;font-family:inherit;margin-top:4px;">
                <option value="">Select from list…</option>
                ${workers.map(w=>`<option value="${w.name}">${w.name} (₹${w.daily_rate||w.daily_wage||0}/day)</option>`).join('')}
              </select>
            </div>
            <button onclick="addMemberFromWorker('${t.id}',document.getElementById('worker-select-${t.id}').value||document.getElementById('worker-search-${t.id}').value)"
              class="btn-add-member">Add</button>
          </div>
        </div>`).join('')}
      <button class="btn-ghost" onclick="addTeam()">+ Add Team ${teams.length+1}</button>`;

    window.renameTeam=renameTeam;
    window.addMemberFromWorker=addMemberFromWorker;
    window.removeMember=removeMember;
    window.addTeam=addTeam;
    window.filterWorkers=(teamId,val)=>{
      const sel=document.getElementById(`worker-select-${teamId}`);
      if(!sel) return;
      const filtered=val?workers.filter(w=>w.name.toLowerCase().includes(val.toLowerCase())):workers;
      sel.innerHTML='<option value="">Select from list…</option>'+filtered.map(w=>`<option value="${w.name}">${w.name} (₹${w.daily_rate||w.daily_wage||0}/day)</option>`).join('');
    };
  }
  renderTeamCards();
}

// ── Log ──
async function renderLog(days){
  const el=document.getElementById('log-content');
  el.innerHTML='<div class="state-msg">Loading…</div>';
  const from=new Date(); if(days>0) from.setDate(from.getDate()-days);
  const fromStr=from.toISOString().slice(0,10);
  const [lr,pr,tr,sr]=await Promise.all([
    supabase.from('production_log').select('*').gte('production_date',fromStr).lte('production_date',TODAY).order('production_date',{ascending:false}).order('created_at',{ascending:false}),
    supabase.from('products').select('*'),
    supabase.from('teams').select('*'),
    supabase.from('supervisors').select('*'),
  ]);
  const logs=lr.data||[],prods=pr.data||[],allTeams=tr.data||[],sups=sr.data||[];
  const prodMap=Object.fromEntries(prods.map(p=>[p.id,p]));
  const teamMap=Object.fromEntries(allTeams.map(t=>[t.id,t]));
  const supMap=Object.fromEntries(sups.map(s=>[s.id,s]));
  const teamSupMap=Object.fromEntries(allTeams.map(t=>[t.id,t.supervisor_id]));
  const totalU=logs.reduce((s,l)=>s+Number(l.quantity||0),0);
  const totalW=logs.reduce((s,l)=>s+Number(l.weight||0),0);
  const rows=logs.map(l=>`<tr>
    <td>${l.production_date}</td>
    <td>${supMap[teamSupMap[l.team_id]]?.name||'—'}</td>
    <td>${teamMap[l.team_id]?.name||'Team '+(teamMap[l.team_id]?.team_number||'—')}</td>
    <td class="bold">${prodMap[l.product_id]?.name||'—'}</td>
    <td class="num">${l.quantity}</td>
    <td class="num">${Number(l.weight).toFixed(1)}</td>
  </tr>`).join('')||'<tr><td colspan="6" style="text-align:center;padding:20px;color:var(--ink-dim);">No entries</td></tr>';
  el.innerHTML=`
    <div class="kpi-grid" style="grid-template-columns:repeat(3,1fr);margin-bottom:16px;">
      <div class="kpi-card"><div class="kpi-label">Units</div><div class="kpi-value">${totalU}</div></div>
      <div class="kpi-card"><div class="kpi-label">Weight</div><div class="kpi-value">${totalW.toFixed(1)} kg</div></div>
      <div class="kpi-card"><div class="kpi-label">Entries</div><div class="kpi-value">${logs.length}</div></div>
    </div>
    <div class="table-wrap"><table class="dt">
      <thead><tr><th>Date</th><th>Supervisor</th><th>Team</th><th>Product</th><th class="num">Qty</th><th class="num">Wt(kg)</th></tr></thead>
      <tbody>${rows}</tbody>
    </table></div>`;
}

// ── Init ──
async function init(){
  supabase.from('supervisors').select('*').eq('active',true).order('name').then(({data})=>{supervisors=data||[];});
  const session=loadSession();
  if(session.supervisor){
    currentSupervisor=session.supervisor; currentTeamId=session.teamId||null;
    updateUserPill(); await loadSupervisorData();
  }
  showPage('dashboard');
}
init();
