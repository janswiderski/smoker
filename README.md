# Smoker

An Electron desktop app for running manual smoke-test checklists. It overlays instructions and a set of action buttons on top of whatever app you're testing, captures screenshots at whichever steps you mark, and automatically diffs each screenshot against a stored baseline (pure pixel comparison via `pixelmatch` — no AI). Test plans are organized into projects, presented as a themed "cigarette vending cabinet" main menu — a real 3D scene (Three.js/WebGL), not a flat mockup.

## Running it

```
cd /Users/janiwiderski/smoke-check-app
npm start
```

(If launched from inside a Claude Code / agent terminal, that shell sets `ELECTRON_RUN_AS_NODE`, which breaks Electron — use `env -u ELECTRON_RUN_AS_NODE npm start` there instead. A normal Terminal window doesn't need this.)

## How it's built

Plain Electron, no framework or bundler (Three.js is loaded via a browser import map, no build step):
- `main.js` — the main process: all file I/O, IPC handlers, and window creation.
- `preload.js` — the only bridge between main and renderer, exposing a `window.api.*` surface via `contextBridge`.
- `src/cabinet3d.html` + `src/cabinet3d.js` — the main window: a Three.js scene for the cabinet, plus a handful of ordinary DOM overlay elements (action panel, rename/create-project prompt, error banner) layered on top of the canvas for anything that's just text and buttons.
- `src/*.html` + `src/*.js` (the rest) — one pair per secondary window (see below), plain DOM/CSS, no build step.
- `src/styles.css` — shared stylesheet for every window, including the DOM overlays inside `cabinet3d.html`.
- `src/textures/*.png` — the surface texture for every 3D element (cabinet body, shelf, cover, packs, chevrons, buttons, trash can, cardboard boxes). See [`src/textures/README.md`](src/textures/README.md) for the file-to-element mapping — swap any of them out and reload to restyle that element.
- `lib/diff.js` — the `pixelmatch`/`pngjs` wrapper used to compare two screenshots and produce a highlighted diff image.

### Windows

| Window | Purpose |
|---|---|
| **Start window** (`cabinet3d.html`/`cabinet3d.js`) | The main menu — a real 3D cabinet scene, one shelf per project, cloned/resized to fit however many projects and test plans actually exist. Always open; the app's "home". |
| **Overlay window** | The floating instructions + action-button panel shown while a test run is in progress. Frameless, always-on-top, transparent background. |
| **Results window** | Per-test-plan run history, run detail, and the fullscreen baseline/diff comparison lightbox. |
| **Editor window** | Raw-JSON + diff-threshold editor for a single test plan. |
| **Baseline preview window** | Shows a step's stored baseline image full-size, opened from the overlay's "View Baseline" button. |

## Sharing data across a team

By default every install's projects, test plans, and run history live only on that machine. The gear icon (bottom-right of the main window) lets you point the app at a folder everyone syncs instead — Dropbox, Google Drive, a network share — so projects, test plans, and run history (baselines, screenshots, diffs) are the same for everyone. The first person to point at an empty shared folder seeds it with the same starter content a fresh local install gets; after that, whatever's in the folder is what everyone sees. Changing the folder restarts the app; "Use Local Only" switches back to this machine's private copy without touching either copy's files.

This is a cheap stand-in for a real shared backend, not a replacement for one: there's no locking, so two people editing projects (renaming, deleting) at the exact same instant can clobber each other's write — low risk for a small team using it sequentially, but a real one under heavier concurrent use. It also means running two copies of the app against the same folder at once (e.g. while testing) is genuinely unsafe for the same reason.

## Data model

Everything lives under a data root — by default Electron's per-OS user data directory (macOS: `~/Library/Application Support/Smoker`), or the shared folder chosen via the gear icon:

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
From the main menu (the 3D cabinet, orbit with drag / zoom with scroll): each project is a shelf with a colored cover. Click a cover to swing it open on its hinge (only one shelf open at a time — opening another closes whichever was open) and reveal its test plans as "packs" sitting on the shelf behind. Each row also has a chevron on either side and edit (✏️)/delete (🗑) buttons flanking the cabinet — edit prompts to rename that project, delete removes it and cascades (every test plan in it, plus their run history and baselines, after a confirmation naming the count). A dedicated dark cover at the top of the stack, "+ Add New Project," prompts for a name and creates a new empty project. The cabinet's height and the logo's position both adjust automatically as projects are added or removed.

### Managing test plans
Inside an open project shelf, each test plan is a colored pack showing its name. Packs shrink to fit the shelf's width as more test plans are added; once they'd get uncomfortably small, the shelf switches to a fixed pack width and scrolls instead — the side chevrons appear only on shelves that actually need it, and click them to scroll the packs left/right. The last pack, "+ Add Test Plan," offers a choice:
- **Create Blank** — prompts for a name, creates a one-step placeholder plan, and opens it directly in the Editor.
- **Import JSON File…** — the classic file-picker flow; validates the file has `name` + a non-empty `steps` array, then assigns it to the current project.

Clicking any real pack opens a DOM action panel over the (dimmed) 3D scene, styled and colored like that pack, with:
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
