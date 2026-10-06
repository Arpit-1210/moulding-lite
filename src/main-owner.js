import './styles/base.css';
import './styles/owner.css';

const pageRoot  = document.getElementById('page-root');
const pageTitle = document.getElementById('page-title');
const todayPill = document.getElementById('today-pill');
const navLinks  = Array.from(document.querySelectorAll('.nav-link'));

todayPill.textContent = new Date(
  new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

const routes = [
  {
    match: (hash) => hash === '' || hash === '#/dashboard',
    route: 'dashboard',
    title: 'Dashboard',
    load: () => import('./pages/owner/dashboard.js'),
  },
  {
    match: (hash) => hash === '#/production/history',
    route: 'production-log',
    title: 'Production Log',
    load: () => import('./pages/owner/productionLog.js'),
  },
  {
    match: (hash) => hash === '#/teams',
    route: 'teams',
    title: 'Teams',
    load: () => import('./pages/owner/teams.js'),
  },
  {
    match: (hash) => hash === '#/products',
    route: 'products',
    title: 'Products',
    load: () => import('./pages/owner/products.js'),
  },
  {
    match: (hash) => hash === '#/settings',
    route: 'settings',
    title: 'Settings',
    load: () => import('./pages/owner/settings.js'),
  },
];

let currentCleanup = null;

async function renderRoute() {
  const hash  = window.location.hash;
  const match = routes.find((r) => r.match(hash)) ?? routes[0];

  navLinks.forEach((link) =>
    link.classList.toggle('is-active', link.dataset.route === match.route)
  );
  pageTitle.textContent = match.title;

  if (typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  pageRoot.innerHTML = '<p class="state-msg">Loading…</p>';
  try {
    const mod    = await match.load();
    const result = await mod.render(pageRoot);
    if (typeof result === 'function') currentCleanup = result;
  } catch (err) {
    console.error(err);
    pageRoot.innerHTML = '<p class="error-text">Could not load this page. Reload to try again.</p>';
  }
}

window.addEventListener('hashchange', renderRoute);
renderRoute();
