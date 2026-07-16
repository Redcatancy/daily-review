# Conflict-Safe Refresh and PC UI Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Preserve pending local edits across sync and refresh, show only diary titles in calendar cells, and remove purple focus outlines from diary inputs.

**Architecture:** Keep the existing local-first store and outbox architecture. Change only merge precedence: pending local fields remain authoritative until upload acknowledgement, while non-pending local cache fields follow the cloud. Extract calendar preview selection into a small pure function for direct regression testing.

**Tech Stack:** Vanilla JavaScript ES modules, Node test runner, Vite, CSS, Playwright CLI.

---

### Task 1: Protect pending local edits during merge

**Files:**
- Modify: `tests/local-store.test.js`
- Modify: `tests/store.test.js`
- Modify: `src/local-store.js`

- [ ] **Step 1: Write failing merge tests**

Add tests asserting that a different remote value archives both versions but leaves the pending local value and outbox intact, and that a non-pending cache mismatch accepts the remote value without a conflict.

- [ ] **Step 2: Run the focused tests and verify RED**

Run: `node --test tests/local-store.test.js tests/store.test.js`

Expected: the pending-local assertions fail because the current implementation replaces local data and deletes the outbox field.

- [ ] **Step 3: Implement pending-local precedence**

In `mergeRemote`, branch on `pendingField`. For a pending mismatch, append a deduplicated conflict and leave entries/outbox unchanged. For a non-pending mismatch, copy the remote field into entries without creating a conflict.

- [ ] **Step 4: Run focused and full tests**

Run: `node --test tests/local-store.test.js tests/store.test.js` and `npm test`.

Expected: all tests pass, including proof that `syncWithAdapters` uploads and acknowledges the retained local field.

### Task 2: Limit calendar previews to diary titles

**Files:**
- Create: `tests/calendar.test.js`
- Modify: `src/calendar.js`

- [ ] **Step 1: Write failing preview tests**

Import a pure `getCalendarPreviewText(entry)` function and assert that it returns a diary title, but returns an empty string for highlights-only and diary-content-only entries.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/calendar.test.js`

Expected: fail because the pure export does not exist.

- [ ] **Step 3: Implement the minimal selector**

Export `getCalendarPreviewText(entry)` and call it from `buildPreview`; remove highlights/improvements fallback logic.

- [ ] **Step 4: Run calendar and full tests**

Run: `node --test tests/calendar.test.js` and `npm test`.

Expected: all tests pass.

### Task 3: Remove diary field focus outlines

**Files:**
- Create: `tests/style.test.js`
- Modify: `src/style.css`

- [ ] **Step 1: Write a failing CSS contract test**

Read `src/style.css` and assert the global focus selector does not include `input:focus-visible` or `textarea:focus-visible`, while `button:focus-visible` remains.

- [ ] **Step 2: Run the test and verify RED**

Run: `node --test tests/style.test.js`

Expected: fail because both input and textarea are currently in the global purple outline selector.

- [ ] **Step 3: Narrow the focus selector**

Remove `input:focus-visible` and `textarea:focus-visible` from the shared outline rule. Existing diary field `outline: none` declarations then remain effective.

- [ ] **Step 4: Run full automated verification**

Run: `npm test`, syntax checks for `src/*.js` and `tests/*.js`, `npm run build`, and `git diff --check`.

Expected: all commands succeed without application errors.

### Task 4: PC browser verification and publication

**Files:**
- No committed browser artifacts.

- [ ] **Step 1: Verify the user flows at PC viewports**

Use an isolated Playwright browser context at 1440x900 and 1024x768. Verify a pending local diary survives stale-cloud sync and reload, calendar cells omit highlights body content, diary inputs show no purple outline, and there is no horizontal overflow or relevant console error.

- [ ] **Step 2: Review data-sensitive scope**

Confirm no changes to `src/auth.js`, `src/cloud-store.js`, Supabase migrations, export bundle structure, or existing browser storage data.

- [ ] **Step 3: Commit and push**

Commit the tested implementation on `codex/data-safety-fixes`, push it to `origin`, and verify the existing draft PR includes the new commit.
