import { fetchActiveSupervisors } from '../services/supervisors.js';

export function initSupervisorSelectView({ onContinue }) {
  const cardsList = document.getElementById('sup-cards-list');
  const continueBtn = document.getElementById('btn-continue-to-teams');

  let supervisors = [];
  let selectedId = null;

  async function load() {
    cardsList.innerHTML = `
      <div class="skeleton" style="height:72px;border-radius:12px;"></div>
      <div class="skeleton" style="height:72px;border-radius:12px;margin-top:10px;"></div>
      <div class="skeleton" style="height:72px;border-radius:12px;margin-top:10px;"></div>`;
    try {
      supervisors = await fetchActiveSupervisors();
      if (!supervisors.length) {
        cardsList.innerHTML = '<div class="state-msg">No supervisors found. Add them in Supabase dashboard.</div>';
        return;
      }
      renderCards();
    } catch(e) {
      cardsList.innerHTML = '<div class="state-msg" style="color:var(--red);">Could not load supervisors. Check connection.</div>';
    }
  }

  function renderCards() {
    cardsList.innerHTML = supervisors.map(s => `
      <div class="sup-card ${s.id === selectedId ? 'selected' : ''}" data-id="${s.id}">
        <div class="sup-avatar">${s.name.charAt(0).toUpperCase()}</div>
        <div>
          <div class="sup-card-name">${s.name}</div>
          <div class="sup-card-sub">Moulding Supervisor</div>
        </div>
        <div class="sup-card-check">✓</div>
      </div>
    `).join('');

    cardsList.querySelectorAll('.sup-card').forEach(card => {
      card.addEventListener('click', () => {
        selectedId = card.dataset.id;
        continueBtn.disabled = false;
        renderCards();
      });
    });
  }

  continueBtn.addEventListener('click', () => {
    const sup = supervisors.find(s => String(s.id) === String(selectedId));
    if (sup) onContinue(sup);
  });

  function refresh() {
    selectedId = null;
    continueBtn.disabled = true;
    load();
  }

  refresh();
  return { refresh };
}
