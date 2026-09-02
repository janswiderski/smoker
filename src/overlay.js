const testNameEl = document.getElementById('testName');
const stepCountEl = document.getElementById('stepCount');
const instructionEl = document.getElementById('instruction');
const resultEl = document.getElementById('result');
const screenshotBtn = document.getElementById('screenshotBtn');
const nextBtn = document.getElementById('nextBtn');
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
  instructionEl.textContent = data.instruction;
  renderResult(data.lastResult);
  nextBtn.textContent = data.isLast ? 'Last Step' : 'Next Step';
  nextBtn.disabled = data.isLast;
  screenshotBtn.style.display = data.requiresScreenshot ? 'block' : 'none';
});

screenshotBtn.addEventListener('click', async () => {
  screenshotBtn.disabled = true;
  screenshotBtn.textContent = 'Capturing…';
  try {
    await window.api.takeScreenshot();
  } finally {
    screenshotBtn.disabled = false;
    screenshotBtn.textContent = 'Take Screenshot';
  }
});

nextBtn.addEventListener('click', () => window.api.nextStep());

endBtn.addEventListener('click', () => window.api.endRun());
