const testNameEl = document.getElementById('testName');
const stepCountEl = document.getElementById('stepCount');
const instructionEl = document.getElementById('instruction');
const resultEl = document.getElementById('result');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const screenshotRow = document.getElementById('screenshotRow');
const viewBaselineBtn = document.getElementById('viewBaselineBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const endBtn = document.getElementById('endBtn');

function renderResult(result) {
  if (!result) {
    resultEl.style.display = 'none';
    return;
  }
  resultEl.style.display = 'block';
  resultEl.className = `overlay-result ${result.status}`;
  if (result.status === 'baseline-created') {
    resultEl.textContent = 'Baseline screenshot saved for this step.';
  } else if (result.status === 'match') {
    resultEl.textContent = `Matches baseline (${result.mismatchPercent.toFixed(2)}% diff).`;
  } else {
    resultEl.textContent = `Mismatch vs baseline: ${result.mismatchPercent.toFixed(2)}% of pixels differ.`;
  }
}

window.api.onStepUpdate((data) => {
  testNameEl.textContent = data.testName;
  stepCountEl.textContent = `Step ${data.stepNumber} / ${data.totalSteps}`;
  instructionEl.innerHTML = linkify(data.instruction);
  renderResult(data.stepResult);

  prevBtn.disabled = data.isFirst;
  nextBtn.textContent = data.isLast ? 'Last Step' : 'Next Step';
  nextBtn.disabled = data.isLast;

  screenshotRow.style.display = data.requiresScreenshot ? 'flex' : 'none';
  screenshotBtn.textContent = data.stepResult ? 'Retake Screenshot' : 'Take Screenshot';
});

prevBtn.addEventListener('click', () => window.api.prevStep());
nextBtn.addEventListener('click', () => window.api.nextStep());

screenshotBtn.addEventListener('click', async () => {
  screenshotBtn.disabled = true;
  screenshotBtn.textContent = 'Capturing…';
  try {
    await window.api.takeScreenshot();
  } finally {
    screenshotBtn.disabled = false;
  }
});

viewBaselineBtn.addEventListener('click', async () => {
  const result = await window.api.viewBaseline();
  if (!result.exists) {
    alert('No baseline saved yet for this step — take a screenshot first to create one.');
  }
});

endBtn.addEventListener('click', () => window.api.endRun());
