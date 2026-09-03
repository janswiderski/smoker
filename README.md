# Smoker

An Electron desktop app for running manual smoke-test checklists. It overlays instructions and a set of action buttons on top of whatever app you're testing, captures screenshots at whichever steps you mark, and automatically diffs each screenshot against a stored baseline (pure pixel comparison via `pixelmatch` — no AI). Test plans are organized into projects, presented as a themed "cigarette vending cabinet" main menu.

## Running it

```
cd /Users/janiwiderski/smoke-check-app
npm start
```

(If launched from inside a Claude Code / agent terminal, that shell sets `ELECTRON_RUN_AS_NODE`, which breaks Electron — use `env -u ELECTRON_RUN_AS_NODE npm start` there instead. A normal Terminal window doesn't need this.)

## How it's built

Plain Electron, no framework or bundler:
- `main.js` — the main process: all file I/O, IPC handlers, and window creation.
- `preload.js` — the only bridge between main and renderer, exposing a `window.api.*` surface via `contextBridge`.
- `src/*.html` + `src/*.js` — one pair per window (see below), plain DOM/CSS, no build step.
- `src/styles.css` — shared stylesheet for every window.
- `lib/diff.js` — the `pixelmatch`/`pngjs` wrapper used to compare two screenshots and produce a highlighted diff image.

### Windows

| Window | Purpose |
|---|---|
| **Start window** (`start.html`/`start.js`) | The main menu — the vending-cabinet UI. Always open; the app's "home". |
| **Overlay window** | The floating instructions + action-button panel shown while a test run is in progress. Frameless, always-on-top, transparent background. |
| **Results window** | Per-test-plan run history, run detail, and the fullscreen baseline/diff comparison lightbox. |
| **Editor window** | Raw-JSON + diff-threshold editor for a single test plan. |
| **Baseline preview window** | Shows a step's stored baseline image full-size, opened from the overlay's "View Baseline" button. |

## Data model

Everything lives under Electron's per-OS user data directory (macOS: `~/Library/Application Support/Smoker`):

```
smoke-tests/
  projects.json              # [{ id, name }, ...]
  <slugified-plan-name>.json # one file per test plan
data/
  <test-slug>/
    baseline/
      step-<id>.png          # current baseline screenshot for that step
    runs/
      <ISO-timestamp>/
        step-<id>.png         # screenshot captured during that run
        step-<id>-diff.png    # pixelmatch diff image (only if a baseline existed)
        report.json           # { testName, runId, startedAt, finishedAt, results[] }
```

A **test plan** JSON file looks like:
```json
{
  "name": "Cart Flow",
  "projectId": "checkout",
  "mismatchThreshold": 0.1,
  "steps": [
    { "id": 1, "instruction": "Open the cart page." },
    { "id": 2, "instruction": "Take a screenshot of the empty cart.", "screenshot": true }
  ]
}
```
- `projectId` links it to a project in `projects.json`. If a plan's `projectId` doesn't match any known project (e.g. old data), it's auto-migrated to the first project on next launch.
- `mismatchThreshold` is the percent of mismatched pixels allowed before a screenshot is flagged as a mismatch instead of a match. Defaults to `0.1` if omitted.
- A step only shows screenshot-related buttons in the overlay if it has `"screenshot": true`. Instructions may contain `http(s)://` URLs, which render as clickable links (opened in the OS default browser).

On first launch, `smoke-tests/` is seeded from the bundled `smoke-tests/` folder in the repo (currently: 4 projects — Core App, Checkout, Marketing Site, Internal Tools — and 15 placeholder test plans distributed across them).

## Workflows

### Managing projects
From the main menu (the cabinet): each project is a shelf. Click its cover to swing it open in place (accordion — only one shelf open at a time) and reveal its test plans as "packs." Click the ✕ in the top-right of an open shelf to close it again. Each shelf's cover also has ✏️ (rename) and 🗑 (delete — cascades: removes every test plan in that project along with their run history and baselines, after a confirmation naming the count). "+ Add New Project" at the bottom of the cabinet prompts for a name and creates a new empty project.

### Managing test plans
Inside an open project shelf, each test plan is a colored pack showing its name. If there are more packs than fit, ‹ › chevrons (or mouse wheel / trackpad horizontal scroll) cycle through them, with a little wobble animation in the scroll direction. The last pack, "+ Add Test Plan," offers a choice:
- **Create Blank** — prompts for a name, creates a one-step placeholder plan, and opens it directly in the Editor.
- **Import JSON File…** — the classic file-picker flow; validates the file has `name` + a non-empty `steps` array, then assigns it to the current project.

Clicking any pack flips it open into an action panel (styled and colored like that pack) with:
- **Start Run** — begins a smoke-test run (opens the Overlay window).
- **View Test Runs** — opens the Results window for this plan.
- **Edit** — opens the Editor window (raw JSON + a dedicated diff-threshold field).
- **Download** — exports the plan's JSON to a location you choose.
- **Delete** — removes the plan's JSON file and its entire `data/<slug>/` directory (baseline + all run history), after confirmation.

### Running a test
The Overlay window shows the current step's instruction on the left and all controls in a grid on the right:
- **‹ Prev / Next Step** — move between steps in either direction; revisiting a step shows whatever result it already has.
- **View Baseline** — opens the step's stored baseline image in a small in-app preview window (only shown on steps with `screenshot: true`).
- **Take Screenshot / Retake Screenshot** — captures the screen immediately. The overlay hides itself for the capture so it doesn't appear in the shot. If no baseline exists yet for that step, the screenshot becomes the baseline; otherwise it's diffed against the baseline via `pixelmatch`, with the result (`match` / `mismatch` / `baseline-created`) and mismatch percentage shown right in the overlay. Label switches to "Retake" once the step already has a result, and retaking overwrites it.
- **Take Screenshot (2s Delay)** — same, but counts down 2 seconds first (for capturing hover states, open dropdowns, etc.).
- **End Run** — finalizes and saves the run's `report.json`, even if zero screenshots were taken (the Results view then explicitly says so rather than showing a misleadingly empty page), and closes the overlay. Also currently causes the overlay to blur itself after **Next Step**, returning focus to whatever app is under test.

### Reviewing results
The Results window (per test plan) lists past runs (`Run #N — <start time>`, with a match/mismatch/"no screenshots taken" badge and a Delete button per row). Opening a run shows every step with its screenshot, baseline, and diff image labeled and thumbnailed; clicking any of them opens a fullscreen lightbox with **Side by Side** (baseline vs. current) or **Diff Highlight** modes, and ‹ › (or arrow keys) to cycle between that run's screenshotted steps. From a run's detail view:
- **Set as Baseline** — promotes every screenshot in that run to become the new baseline for its step, for future comparisons.
- **Delete Run** — removes just that run's directory.
- **Download Collage** (per step) — composites Baseline / Test Run / Diff (whichever exist) stacked vertically, each labeled with its role and capture timestamp, into one PNG you save wherever you like.

## Known limitations
- Screenshot capture requires the OS to grant Smoker Screen Recording permission (macOS will prompt on first use).
- See [`docs/windows-compatibility.md`](docs/windows-compatibility.md) for a full audit of what would need attention to run this on Windows — short version: no code should block it, one macOS-oriented overlay-window behavior degrades gracefully, and there's no packaging/build config yet for producing an actual `.exe`.
