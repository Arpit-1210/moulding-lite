import { fetchAllSupervisors, createSupervisor, setSupervisorActive } from '../../services/supervisors.js';

export async function render(container) {
  container.innerHTML = `
    <div class="panel" style="max-width: 480px">
      <div class="panel-head"><h2>Add a supervisor</h2></div>
      <div class="form-grid">
        <input type="text" placeholder="Supervisor name" id="ns-name" />
        <button class="btn btn-primary btn-compact" id="ns-save">+ Add supervisor</button>
      </div>
    </div>

    <div class="panel" style="max-width: 480px">
      <div class="panel-head"><h2>Supervisors</h2></div>
      <div id="supervisors-table-root"><p class="state-msg">Loading…</p></div>
    </div>
  `;

  const tableRoot = container.querySelector('#supervisors-table-root');
  const nameInput = container.querySelector('#ns-name');
  const saveBtn = container.querySelector('#ns-save');

  async function load() {
    tableRoot.innerHTML = '<p class="state-msg">Loading…</p>';
    try {
      const supervisors = await fetchAllSupervisors();
      renderTable(supervisors);
    } catch (err) {
      console.error(err);
      tableRoot.innerHTML = '<p class="error-text">Could not load supervisors.</p>';
    }
  }

  function renderTable(supervisors) {
    if (supervisors.length === 0) {
      tableRoot.innerHTML = '<p class="state-msg">No supervisors yet.</p>';
      return;
    }
    tableRoot.innerHTML = `
      <table class="data-table">
        <thead><tr><th>Name</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${supervisors
            .map(
              (s) => `
            <tr>
              <td>${escapeHtml(s.name)}</td>
              <td><span class="pill ${s.active ? 'pill-active' : 'pill-inactive'}">${s.active ? 'Active' : 'Inactive'}</span></td>
              <td>
                <button class="btn btn-compact ${s.active ? 'btn-danger-outline' : 'btn-secondary'}" data-id="${s.id}" data-active="${s.active}">
                  ${s.active ? 'Deactivate' : 'Activate'}
                </button>
              </td>
            </tr>`
            )
            .join('')}
        </tbody>
      </table>`;

    tableRoot.querySelectorAll('button[data-id]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await setSupervisorActive(btn.dataset.id, btn.dataset.active !== 'true');
          await load();
        } catch (err) {
          console.error(err);
          alert('Could not update that supervisor. Please try again.');
          btn.disabled = false;
        }
      });
    });
  }

  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) return alert('Enter a supervisor name.');
    saveBtn.disabled = true;
    try {
      await createSupervisor(name);
      nameInput.value = '';
      await load();
    } catch (err) {
      console.error(err);
      alert('Could not add that supervisor. Please try again.');
    } finally {
      saveBtn.disabled = false;
    }
  });

  await load();
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}
