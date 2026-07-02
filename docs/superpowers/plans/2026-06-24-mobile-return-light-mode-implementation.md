# Mobile Return And Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize Android mobile restore behavior while upgrading the homepage hero and light mode into a softer luxury-glass presentation.

**Architecture:** Keep the existing single-page structure and introduce a small visual state machine in `app.js` plus layered material refinements in `styles.css`. Avoid `index.html` edits unless a structural hook becomes strictly necessary.

**Tech Stack:** Vanilla JavaScript, CSS, existing canvas hero background, responsive media queries

---

### Task 1: Add mobile restore-state control

**Files:**
- Modify: `C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\outputs\liquid-glass-blog\app.js`
- Test: manual browser verification on mobile restore flow

- [ ] **Step 1: Add a visual FX state model**

Create root-class driven FX states in `app.js`:

```js
let fxState = "active";
let warmupTimer = 0;

function applyFxState(nextState) {
  fxState = nextState;
  root.classList.toggle("fx-stable", nextState === "stable");
  root.classList.toggle("fx-warming", nextState === "warming");
  root.classList.toggle("fx-active", nextState === "active");
}
```

- [ ] **Step 2: Throttle heavy drawing based on state**

Gate canvas work by `fxState`:

```js
if (isMobileFx && fxState !== "active" && frameTick % 3 !== 0) {
  requestAnimationFrame(paint);
  return;
}
```

And suppress spark-heavy drawing outside `active`.

- [ ] **Step 3: Replace simple freeze/unfreeze with staged restore**

Use `stable -> warming -> active`:

```js
const warmup = () => {
  clearTimeout(warmupTimer);
  freezeVisualFx = false;
  root.classList.remove("is-frozen");
  applyFxState("warming");
  warmupTimer = window.setTimeout(() => {
    if (document.visibilityState === "visible") {
      applyFxState("active");
    }
  }, isMobileFx ? 420 : 120);
};
```

- [ ] **Step 4: Run manual verification logic**

Verify code flow by reading the final `pagehide`, `pageshow`, and `visibilitychange` handlers and confirming all three states are reachable.

- [ ] **Step 5: Commit checkpoint**

Repository commit is optional because the working directory is not a git repo root. Record completion in the session summary instead.

### Task 2: Add stable-state and mobile hero styling

**Files:**
- Modify: `C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\outputs\liquid-glass-blog\styles.css`
- Test: manual CSS inspection for mobile classes

- [ ] **Step 1: Add stable and warming state selectors**

Introduce selectors for `fx-stable` and `fx-warming` that:

```css
.fx-stable .plasma-field,
.fx-warming .plasma-field {
  opacity: 0.18;
  filter: blur(5px) saturate(0.92);
}
```

Also reduce `body::before`, `energy-grid`, and glass blur while not fully active.

- [ ] **Step 2: Make mobile cards use cheaper material during recovery**

Add restore-safe surfaces:

```css
.mobile-fx.fx-stable .liquid-card,
.mobile-fx.fx-warming .liquid-card {
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}
```

- [ ] **Step 3: Refine hero composition on mobile**

Tighten hero spacing and strengthen the avatar stage with soft underglow, while keeping contact actions full-width and calmer.

- [ ] **Step 4: Verify CSS cascade**

Check that new selectors compose with existing `.mobile-fx`, `.browser-*`, and `:root.light` rules instead of overriding unrelated desktop behavior.

- [ ] **Step 5: Commit checkpoint**

Repository commit is optional because the working directory is not a git repo root. Record completion in the session summary instead.

### Task 3: Upgrade light mode to luxury glass

**Files:**
- Modify: `C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\outputs\liquid-glass-blog\styles.css`
- Test: manual CSS inspection for light-mode selectors

- [ ] **Step 1: Expand light-mode surface tokens**

Add softer material tokens for nav, hero, actions, and panels.

- [ ] **Step 2: Unify light-mode cards and action surfaces**

Refine `.glass-pill`, `.liquid-card`, `.contact-grid a`, `.button`, `.writing-console`, `.contact-panel`, and `.status-rail div` under `:root.light`.

- [ ] **Step 3: Soften input and action emphasis**

Reduce boxiness in `input`, `input:focus`, `.button.primary`, and action hover states.

- [ ] **Step 4: Verify day-mode hierarchy**

Read the final selectors and confirm the nav, hero card, contact bar, and contact form all share one material family.

- [ ] **Step 5: Commit checkpoint**

Repository commit is optional because the working directory is not a git repo root. Record completion in the session summary instead.

### Task 4: Verify changed files and summarize

**Files:**
- Modify: none
- Test: `app.js`, `styles.css`

- [ ] **Step 1: Review diffs**

Run:

```powershell
git -C "C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\outputs\liquid-glass-blog" diff -- app.js styles.css
```

Expected: only targeted FX-state and style-polish changes.

- [ ] **Step 2: Run syntax-safe checks**

Run:

```powershell
@'
new Function(require("fs").readFileSync("C:\\Users\\32452\\Documents\\Codex\\2026-06-22\\https-21st-dev-community-components-5\\outputs\\liquid-glass-blog\\app.js","utf8"));
'@ | "C:\Users\32452\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe" -
```

Expected: no output, exit code `0`.

- [ ] **Step 3: Inspect key selectors and handlers**

Run targeted searches for:

```powershell
Select-String -Path "C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\outputs\liquid-glass-blog\app.js","C:\Users\32452\Documents\Codex\2026-06-22\https-21st-dev-community-components-5\outputs\liquid-glass-blog\styles.css" -Pattern "fx-stable|fx-warming|fx-active|pageshow|pagehide|:root.light .button|:root.light .contact-grid a"
```

Expected: all new hooks present.

- [ ] **Step 4: Summarize implementation**

Report:
- mobile restore stabilization changes
- hero/mobile polish
- light-mode luxury-glass updates
- any remaining limitations
