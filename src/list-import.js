const errorEl = document.getElementById('importError');
const nameInput = document.getElementById('nameInput');
const stepCountEl = document.getElementById('stepCount');
const stepList = document.getElementById('stepList');
const toggleAllBtn = document.getElementById('toggleAllBtn');
const cancelBtn = document.getElementById('cancelBtn');
const saveBtn = document.getElementById('saveBtn');

let projectId = null;
let steps = []; // [{ instruction, screenshot }]

function showError(message) {
  errorEl.textContent = message;
  errorEl.style.display = message ? 'block' : 'none';
}

function updateToggleAllLabel() {
  toggleAllBtn.textContent = steps.every((s) => s.screenshot) ? 'Untick All' : 'Tick All';
}

function renderSteps() {
  stepList.innerHTML = '';
  steps.forEach((step, index) => {
    const item = document.createElement('li');
    const label = document.createElement('label');
    label.className = 'list-import-step';
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.checked = step.screenshot;
    box.title = 'Take a screenshot during this step';
    box.addEventListener('change', () => {
      steps[index].screenshot = box.checked;
      updateToggleAllLabel();
    });
    const text = document.createElement('span');
    text.textContent = step.instruction;
    label.append(box, text);
    item.append(label);
    stepList.append(item);
  });
  stepCountEl.textContent = `${steps.length} step${steps.length === 1 ? '' : 's'}`;
  updateToggleAllLabel();
}

window.api.onListImportInit((init) => {
  projectId = init.projectId;
  nameInput.value = init.name;
  steps = init.steps.map((instruction) => ({ instruction, screenshot: false }));
  renderSteps();
});

toggleAllBtn.addEventListener('click', () => {
  const tick = !steps.every((s) => s.screenshot);
  steps.forEach((s) => { s.screenshot = tick; });
  renderSteps();
});

saveBtn.addEventListener('click', async () => {
  showError('');
  try {
    await window.api.saveListTestPlan({ name: nameInput.value, projectId, steps });
    window.close();
  } catch (err) {
    // ipcRenderer.invoke wraps the message as "Error invoking remote method '...': Error: <message>".
    showError(String(err.message || err).replace(/^.*Error: /, ''));
  }
});

cancelBtn.addEventListener('click', () => window.close());
