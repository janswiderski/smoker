const testNameEl = document.getElementById('testName');
const stepCountEl = document.getElementById('stepCount');
const instructionEl = document.getElementById('instruction');
const resultEl = document.getElementById('result');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const viewBaselineBtn = document.getElementById('viewBaselineBtn');
const screenshotBtn = document.getElementById('screenshotBtn');
const delayedScreenshotBtn = document.getElementById('delayedScreenshotBtn');
const endBtn = document.getElementById('endBtn');

const screenshotOnlyButtons = [viewBaselineBtn, screenshotBtn, delayedScreenshotBtn];

const CAPTURE_DELAY_MS = 2000;

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

  screenshotOnlyButtons.forEach((btn) => {
    btn.style.display = data.requiresScreenshot ? '' : 'none';
  });
  const verb = data.stepResult ? 'Retake' : 'Take';
  screenshotBtn.textContent = `${verb} Screenshot`;
  delayedScreenshotBtn.textContent = `${verb} Screenshot (2s Delay)`;
});

prevBtn.addEventListener('click', () => window.api.prevStep());
nextBtn.addEventListener('click', () => window.api.nextStep());

function setCaptureButtonsDisabled(disabled) {
  screenshotBtn.disabled = disabled;
  delayedScreenshotBtn.disabled = disabled;
}

screenshotBtn.addEventListener('click', async () => {
  setCaptureButtonsDisabled(true);
  screenshotBtn.textContent = 'Capturing…';
  try {
    await window.api.takeScreenshot();
  } finally {
    setCaptureButtonsDisabled(false);
  }
});

delayedScreenshotBtn.addEventListener('click', async () => {
  setCaptureButtonsDisabled(true);
  let secondsLeft = Math.ceil(CAPTURE_DELAY_MS / 1000);
  delayedScreenshotBtn.textContent = `Capturing in ${secondsLeft}s…`;
  const countdown = setInterval(() => {
    secondsLeft -= 1;
    delayedScreenshotBtn.textContent = secondsLeft > 0 ? `Capturing in ${secondsLeft}s…` : 'Capturing…';
  }, 1000);
  try {
    await window.api.takeScreenshot(CAPTURE_DELAY_MS);
  } finally {
    clearInterval(countdown);
    setCaptureButtonsDisabled(false);
  }
});

viewBaselineBtn.addEventListener('click', async () => {
  const result = await window.api.viewBaseline();
  if (!result.exists) {
    alert('No baseline saved yet for this step — take a screenshot first to create one.');
  }
});

endBtn.addEventListener('click', () => window.api.endRun());
