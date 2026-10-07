import './styles/base.css';
import { supabase as ownerSupabase } from './services/supabaseClient.js';
import { startAutoClose } from './utils/dayclose.js';
import { requireLogin } from './utils/auth.js';
import './styles/owner.css';
import { renderDashboard } from './pages/owner/dashboard.js';
import { renderProductionLog } from './pages/owner/productionLog.js';
import { renderInventory } from './pages/owner/inventory.js';

import { renderTeams } from './pages/owner/teams.js';
import { renderProducts } from './pages/owner/products.js';
import { renderSettings } from './pages/owner/settings.js';
import { renderLabour } from './pages/owner/labour.js';

const pageRoot = document.getElementById('page-root');
const pageTitle = document.getElementById('page-title');
const pageSub = document.getElementById('page-sub');
const todayPill = document.getElementById('today-pill');

const d = new Date();
if (todayPill) todayPill.textContent = d.toLocaleDateString('en-IN', { weekday:'short', day:'numeric', month:'short' });

// Mobile sidebar
const sidebar = document.getElementById('sidebar');
const hamburger = document.getElementById('hamburger');
const overlay = document.getElementById('sidebar-overlay');
hamburger?.addEventListener('click', () => { sidebar.classList.add('is-open'); overlay.classList.add('is-open'); });
overlay?.addEventListener('click', () => { sidebar.classList.remove('is-open'); overlay.classList.remove('is-open'); });

const routes = {
  dashboard:       { title:'Dashboard',       sub:'Live moulding overview',     fn: renderDashboard },
  'production-log':{ title:'Production Log',  sub:'All entries by team & date', fn: renderProductionLog },
  inventory:       { title:'Inventory',        sub:'Finished goods stock',       fn: renderInventory },
  
  labour:          { title:'Labour',           sub:'Worker rates & management',  fn: renderLabour },
  teams:           { title:'Teams',            sub:'Supervisor teams',            fn: renderTeams },
  products:        { title:'Products',         sub:'Moulding catalogue',          fn: renderProducts },
  settings:        { title:'Settings',         sub:'Connection & exports',        fn: renderSettings },
};

function getRoute() {
  const hash = location.hash.replace('#/', '');
  if (!hash) return 'dashboard';
  return Object.keys(routes).find(k => hash.startsWith(k)) || 'dashboard';
}

async function navigate(route) {
  const r = routes[route];
  if (!r) return;
  if (pageTitle) pageTitle.textContent = r.title;
  if (pageSub) pageSub.textContent = r.sub;
  pageRoot.innerHTML = '<div class="state-msg" style="padding-top:60px;">Loading…</div>';
  document.querySelectorAll('.nav-link').forEach(l => l.classList.toggle('active', l.dataset.route === route));
  sidebar.classList.remove('is-open');
  overlay?.classList.remove('is-open');
  try { await r.fn(pageRoot); }
  catch(e) { pageRoot.innerHTML = `<div class="state-msg" style="color:var(--red);">Error: ${e.message}</div>`; }
}

window.addEventListener('hashchange', () => { if (authed) navigate(getRoute()); });
let authed = false;
requireLogin().then(() => { authed = true; navigate(getRoute()); startAutoClose(ownerSupabase); });
