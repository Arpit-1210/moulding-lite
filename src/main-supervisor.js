import './styles/base.css';
import { getSession, setSupervisor, clearSession } from './utils/session.js';
import { initSupervisorSelectView } from './pages/supervisor-select.js';
import { initTeamSetupView } from './pages/team-setup.js';
import { initProductionEntryView } from './pages/production-entry.js';

const views = {
  select: document.getElementById('view-supervisor-select'),
  teams: document.getElementById('view-team-setup'),
  production: document.getElementById('view-production-entry'),
};

function showView(name) {
  Object.values(views).forEach((v) => v.classList.remove('is-active'));
  views[name].classList.add('is-active');
}

function goToSelect() {
  clearSession();
  selectView.refresh();
  showView('select');
}

function goToTeams(supervisor) {
  setSupervisor(supervisor);
  showView('teams');
  teamSetupView.refresh(supervisor);
}

function goToProduction(supervisor) {
  setSupervisor(supervisor);
  showView('production');
  productionView.refresh(supervisor);
}

const selectView = initSupervisorSelectView({
  onContinue: (supervisor) => goToTeams(supervisor),
});

const teamSetupView = initTeamSetupView({
  onContinue: (supervisor) => goToProduction(supervisor),
  onSwitchSupervisor: goToSelect,
});

const productionView = initProductionEntryView({
  onManageTeams: (supervisor) => goToTeams(supervisor),
  onSwitchSupervisor: goToSelect,
});

// Resume where the supervisor left off this session, so they aren't asked to
// re-select their name or re-pick a team between every entry during a shift.
const session = getSession();
if (session.supervisor && session.selectedTeamId) {
  goToProduction(session.supervisor);
} else if (session.supervisor) {
  goToTeams(session.supervisor);
} else {
  showView('select');
}
