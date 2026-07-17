# PC Icon and Contrast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace functional Emoji with a cohesive warm line-icon system and improve secondary-text contrast for the PC-only daily review interface without changing application data behavior.

**Architecture:** Add one dependency-free icon module that owns trusted SVG path definitions and returns complete, decorative SVG strings. Static navigation exposes icon names through `data-icon` and is hydrated once by `main.js`; dynamic feature modules call the same `icon(name, className)` helper while rendering. Existing layout and responsive rules remain unchanged, while shared CSS tokens and icon size classes provide consistent appearance.

**Tech Stack:** Vanilla JavaScript ES modules, inline SVG, CSS custom properties, Node.js built-in test runner, Vite, Playwright desktop browser QA.

---

## File map

- Create `src/icons.js`: trusted icon registry plus the public `icon(name, className = 'ui-icon')` renderer.
- Create `tests/icons.test.js`: contract tests for SVG output, class handling, accessibility, and unknown names.
- Modify `index.html`: replace five navigation Emoji with inert `data-icon` mount points.
- Modify `src/main.js`: hydrate navigation mount points from `src/icons.js` before application initialization.
- Modify `src/checkin.js`: render four dimension icons through the shared helper.
- Modify `src/highlights.js`: render the two section-title icons through the shared helper.
- Modify `src/analysis.js`: render three analysis-card icons through the shared helper.
- Modify `src/quote.js`: render loading and loaded quote icons through the shared helper.
- Modify `src/style.css`: update text tokens, define shared icon sizes, use `currentColor`, and add PC keyboard focus treatment without changing the existing mobile media query.

### Task 1: Build the dependency-free SVG icon renderer

**Files:**
- Create: `tests/icons.test.js`
- Create: `src/icons.js`

- [ ] **Step 1: Write the failing renderer contract tests**

Create `tests/icons.test.js` with:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { icon } from '../src/icons.js'

test('renders the shared decorative SVG contract', () => {
  const svg = icon('check-circle', 'ui-icon ui-icon-nav')

  assert.match(svg, /^<svg /)
  assert.match(svg, /class="ui-icon ui-icon-nav"/)
  assert.match(svg, /viewBox="0 0 24 24"/)
  assert.match(svg, /fill="none"/)
  assert.match(svg, /stroke="currentColor"/)
  assert.match(svg, /stroke-width="1.8"/)
  assert.match(svg, /stroke-linecap="round"/)
  assert.match(svg, /stroke-linejoin="round"/)
  assert.match(svg, /aria-hidden="true"/)
  assert.match(svg, /focusable="false"/)
})

test('renders every icon required by the approved PC design', () => {
  const names = [
    'check-circle', 'sparkles', 'notebook', 'calendar-days',
    'brain-circuit', 'activity', 'book-open', 'briefcase', 'smile',
    'lightbulb', 'chart-bar', 'trending-up', 'calendar-range',
    'message-circle'
  ]

  for (const name of names) {
    assert.match(icon(name), /<path|<circle|<rect|<polyline|<line/)
  }
})

test('rejects unknown icons and unsafe class names', () => {
  assert.throws(() => icon('missing'), /Unknown icon: missing/)
  assert.throws(
    () => icon('sparkles', 'ui-icon" onclick="alert(1)'),
    /Invalid icon class name/
  )
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/icons.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/icons.js`.

- [ ] **Step 3: Implement the minimal complete icon module**

Create `src/icons.js` with a frozen registry containing these exact trusted names and SVG body primitives:

```js
const ICONS = Object.freeze({
  'check-circle': '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  sparkles: '<path d="m12 3-1.3 3.7L7 8l3.7 1.3L12 13l1.3-3.7L17 8l-3.7-1.3L12 3Z"/><path d="m19 14-.8 2.2L16 17l2.2.8L19 20l.8-2.2L22 17l-2.2-.8L19 14Z"/><path d="m5 13-.8 2.2L2 16l2.2.8L5 19l.8-2.2L8 16l-2.2-.8L5 13Z"/>',
  notebook: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/><line x1="8" y1="7" x2="16" y2="7"/><line x1="8" y1="11" x2="16" y2="11"/>',
  'calendar-days': '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="8" y1="14" x2="8.01" y2="14"/><line x1="12" y1="14" x2="12.01" y2="14"/><line x1="16" y1="14" x2="16.01" y2="14"/><line x1="8" y1="18" x2="8.01" y2="18"/><line x1="12" y1="18" x2="12.01" y2="18"/>',
  'brain-circuit': '<path d="M9.5 4.5A3 3 0 0 0 5 7.1 3.5 3.5 0 0 0 4.5 14 3 3 0 0 0 9 17v2"/><path d="M14.5 4.5A3 3 0 0 1 19 7.1a3.5 3.5 0 0 1 .5 6.9 3 3 0 0 1-4.5 3v2"/><path d="M9.5 4.5c0 1.4 1.1 2.5 2.5 2.5s2.5-1.1 2.5-2.5"/><path d="M9 19h6"/><circle cx="12" cy="11" r="1"/><path d="M12 12v3M9 11H7m10 0h-2"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  'book-open': '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2Z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7Z"/>',
  briefcase: '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M3 12h18"/><path d="M10 12v2h4v-2"/>',
  smile: '<circle cx="12" cy="12" r="9"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/>',
  lightbulb: '<path d="M9 18h6"/><path d="M10 22h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5C14.6 15.2 14 16.2 14 17h-4c0-.8-.6-1.8-1.5-2.5Z"/>',
  'chart-bar': '<line x1="4" y1="20" x2="20" y2="20"/><rect x="6" y="11" width="3" height="6" rx="1"/><rect x="11" y="7" width="3" height="10" rx="1"/><rect x="16" y="3" width="3" height="14" rx="1"/>',
  'trending-up': '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>',
  'calendar-range': '<rect x="3" y="5" width="18" height="16" rx="2"/><line x1="16" y1="3" x2="16" y2="7"/><line x1="8" y1="3" x2="8" y2="7"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h3M13 17h3"/>',
  'message-circle': '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.5 9.7 9.7 0 0 1-4-.9L3 21l1.7-4.5A8.5 8.5 0 1 1 21 11.5Z"/>'
})

const CLASS_NAME_PATTERN = /^[A-Za-z0-9_-]+(?: [A-Za-z0-9_-]+)*$/

export function icon(name, className = 'ui-icon') {
  const body = ICONS[name]
  if (!body) throw new Error(`Unknown icon: ${name}`)
  if (!CLASS_NAME_PATTERN.test(className)) {
    throw new Error('Invalid icon class name')
  }

  return `<svg class="${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${body}</svg>`
}
```

- [ ] **Step 4: Run the focused test and verify GREEN**

Run: `node --test tests/icons.test.js`

Expected: 3 tests pass, 0 fail.

- [ ] **Step 5: Commit the icon foundation**

```bash
git add tests/icons.test.js src/icons.js
git commit -m "feat: add unified line icon renderer"
```

### Task 2: Replace functional Emoji and improve desktop contrast

**Files:**
- Modify: `index.html`
- Modify: `src/main.js`
- Modify: `src/checkin.js`
- Modify: `src/highlights.js`
- Modify: `src/analysis.js`
- Modify: `src/quote.js`
- Modify: `src/style.css`
- Test: `tests/icons.test.js`

- [ ] **Step 1: Strengthen the test with integration-source assertions**

Append to `tests/icons.test.js`:

```js
import { readFile } from 'node:fs/promises'

test('functional UI sources use the shared icon system instead of approved Emoji', async () => {
  const files = ['index.html', 'src/checkin.js', 'src/highlights.js', 'src/analysis.js', 'src/quote.js']
  const sources = await Promise.all(files.map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')))
  const source = sources.join('\n')

  for (const emoji of ['⭐', '✨', '📝', '📅', '🤖', '🏃', '📚', '💼', '😊', '💡', '📊', '📈', '🗓️', '💬']) {
    assert.equal(source.includes(emoji), false, `functional Emoji remains: ${emoji}`)
  }
  assert.match(sources[0], /data-icon="check-circle"/)
  assert.match(sources[1], /icon\(dim\.icon, 'ui-icon ui-icon-dimension'\)/)
})

test('desktop contrast tokens match the approved palette', async () => {
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(css, /--text-secondary:\s*#514B57;/)
  assert.match(css, /--text-muted:\s*#6F6875;/)
  assert.match(css, /--accent:\s*#6C5CE7;/)
})
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/icons.test.js`

Expected: the original 3 tests pass; the two new tests fail because Emoji and old token values remain.

- [ ] **Step 3: Convert static navigation mounts and hydrate them once**

In `index.html`, replace the five Emoji spans with:

```html
<span class="nav-icon" data-icon="check-circle"></span>
<span class="nav-icon" data-icon="sparkles"></span>
<span class="nav-icon" data-icon="notebook"></span>
<span class="nav-icon" data-icon="calendar-days"></span>
<span class="nav-icon" data-icon="brain-circuit"></span>
```

In `src/main.js`, add `import { icon } from './icons.js'`, then add:

```js
function hydrateStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach(mount => {
    mount.innerHTML = icon(mount.dataset.icon, 'ui-icon ui-icon-nav')
  })
}
```

Call `hydrateStaticIcons()` as the first statement inside `init()` so icons appear before asynchronous authentication work.

- [ ] **Step 4: Convert dynamic module markup to the shared renderer**

In `src/checkin.js`, import `icon`, change `DIMENSIONS` icon values to `activity`, `book-open`, `briefcase`, and `smile`, then render:

```js
<span class="checkin-icon">${icon(dim.icon, 'ui-icon ui-icon-dimension')}</span>
```

In `src/highlights.js`, import `icon` and render:

```js
<h3 class="highlights-title">${icon('sparkles', 'ui-icon ui-icon-section')}<span>今日亮点</span></h3>
<h3 class="highlights-title">${icon('lightbulb', 'ui-icon ui-icon-section')}<span>明日改进</span></h3>
```

In `src/analysis.js`, import `icon` and replace the three card icon contents with:

```js
<div class="analysis-card-icon">${icon('chart-bar', 'ui-icon ui-icon-analysis')}</div>
<div class="analysis-card-icon">${icon('trending-up', 'ui-icon ui-icon-analysis')}</div>
<div class="analysis-card-icon">${icon('calendar-range', 'ui-icon ui-icon-analysis')}</div>
```

In `src/quote.js`, import `icon` and replace both quote-state icon contents with:

```js
<div class="quote-icon">${icon('message-circle', 'ui-icon ui-icon-section')}</div>
```

Use `sparkles` with the same `ui-icon ui-icon-section` classes for the successful quote state.

- [ ] **Step 5: Apply approved tokens, icon sizing, and PC focus styling**

In `src/style.css`, change only the existing text tokens:

```css
--text-secondary: #514B57;
--text-muted: #6F6875;
```

Add shared SVG rules outside every media query:

```css
.ui-icon {
  display: block;
  flex: 0 0 auto;
  pointer-events: none;
}

.ui-icon-nav {
  width: 20px;
  height: 20px;
}

.ui-icon-section,
.ui-icon-dimension {
  width: 22px;
  height: 22px;
}

.ui-icon-analysis {
  width: 34px;
  height: 34px;
}
```

Update `.nav-icon`, `.checkin-icon`, `.highlights-title`, `.analysis-card-icon`, and `.quote-icon` so their wrappers use flex alignment and inherit color instead of Emoji font sizes. Keep `.nav-icon` at its existing 24px width. Set `.nav-tab.active` to `color: var(--accent)` so icon and label share the approved accent. Add the following desktop keyboard treatment outside the existing mobile query:

```css
button:focus-visible,
input:focus-visible,
textarea:focus-visible,
[tabindex]:focus-visible {
  outline: 2px solid rgba(108, 92, 231, 0.72);
  outline-offset: 3px;
}
```

Do not edit the existing `@media (max-width: 900px)` block.

- [ ] **Step 6: Run focused and full automated tests**

Run: `node --test tests/icons.test.js`

Expected: 5 tests pass, 0 fail.

Run: `npm test`

Expected: all existing 17 data-safety tests plus 5 icon tests pass (22 total), 0 fail.

- [ ] **Step 7: Commit the visual integration**

```bash
git add index.html src/main.js src/checkin.js src/highlights.js src/analysis.js src/quote.js src/style.css tests/icons.test.js
git commit -m "feat: unify PC icons and text contrast"
```

### Task 3: Verify syntax, build, and PC-only rendered behavior

**Files:**
- Verify: `index.html`
- Verify: `src/*.js`
- Verify: `src/style.css`

- [ ] **Step 1: Check every JavaScript file for syntax errors**

Run in PowerShell:

```powershell
Get-ChildItem -LiteralPath src,tests -Filter *.js -File | ForEach-Object { node --check $_.FullName }
```

Expected: exit code 0 with no syntax errors.

- [ ] **Step 2: Build the production bundle**

Run: `npm run build`

Expected: Vite exits 0 and creates the production bundle without warnings caused by missing icon imports.

- [ ] **Step 3: Run desktop Playwright QA at 1440×900**

Start the existing Vite development server and inspect `http://localhost:53141/` with a 1440×900 browser viewport. Verify:

- all five navigation items show crisp line SVGs and no functional Emoji;
- inactive navigation and secondary text remain visibly legible;
- active navigation icon and label use `#6C5CE7`;
- 打卡 shows four 22px icons while rating stars still render and respond;
- 亮点改进 shows two aligned title icons and add/delete controls still work;
- 日记 and 日历 navigation renders without layout shift;
- AI 分析 shows three 34px line icons and buttons still open the prompt area when data exists;
- quote loading/success area uses the shared line icon;
- Tab-key focus rings are clear on navigation, date controls, buttons, inputs, and textarea;
- browser console contains no new application errors.

Expected: all checks pass at 1440×900.

- [ ] **Step 4: Run desktop Playwright QA at 1024×768**

Repeat the same page/tab/console/focus checks at exactly 1024×768. Confirm the desktop sidebar and main content remain usable with no horizontal clipping.

Expected: all checks pass at 1024×768.

Do not run a mobile viewport and do not modify or evaluate the existing mobile media query.

- [ ] **Step 5: Inspect the final diff for scope and data safety**

Run:

```bash
git diff origin/codex/data-safety-fixes...HEAD -- index.html src tests docs/superpowers
git status --short
```

Expected: only the plan/spec, icon tests/module, approved visual markup, and CSS appear. No changes exist in `src/auth.js`, `src/store.js`, `src/local-store.js`, `src/cloud-store.js`, `src/diary.js`, or Supabase migrations.

- [ ] **Step 6: Push the verified branch and update the existing draft PR**

Run:

```bash
git push origin codex/data-safety-fixes
```

Expected: push succeeds and draft PR #2 includes the design, plan, implementation, and verification commits.

## Plan self-review

- Spec coverage: every approved icon location, exact color token, SVG contract, size tier, keyboard focus state, and both PC validation viewports maps to a task above.
- Placeholder scan: every implementation and verification step contains concrete content with no deferred work or undefined follow-up.
- Interface consistency: all consumers use `icon(name, className)`; all icon names are defined in `ICONS`; the CSS class names match test and markup snippets.
- Scope guard: mobile adaptation/testing and all data/auth/sync/save behavior are explicitly excluded; rating stars remain unchanged.
