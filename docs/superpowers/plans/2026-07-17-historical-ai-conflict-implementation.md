# Historical AI Analysis and Conflict Accuracy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make AI prompt generation follow any selected day/week/month, strengthen its evidence and action quality, and classify synchronization conflicts without false warnings or lost rapid edits.

**Architecture:** Add a pure `analysis-core.js` boundary for ranges and prompts, leaving `analysis.js` responsible for rendering and store access. Extend the local store with a per-field remote snapshot, and replace blind outbox acknowledgement with value-conditional upload acknowledgement.

**Tech Stack:** Vanilla JavaScript ES modules, browser localStorage, Supabase adapter, Node test runner, Vite, Playwright.

---

### Task 1: Historical analysis ranges

**Files:**
- Create: `src/analysis-core.js`
- Create: `tests/analysis-core.test.js`
- Modify: `src/analysis.js`

- [ ] **Step 1: Write failing range tests**

Test a selected historical day, a week crossing month boundaries, a complete month, and leap-year February through the wished-for API:

```js
assert.deepEqual(getAnalysisRange('weekly', '2026-07-01'), {
  start: '2026-06-29', end: '2026-07-05', totalDays: 7
})
```

- [ ] **Step 2: Verify RED**

Run `node --test tests/analysis-core.test.js` and expect module/export failure.

- [ ] **Step 3: Implement pure local-date range calculation**

Create `getAnalysisRange(type, anchorDate)` using `parseDate` and `formatDate`, cloning dates before mutation and returning complete natural periods.

- [ ] **Step 4: Connect the selected date to rendering and reads**

Pass `dateStr` into generation callbacks. Daily calls `getEntry(range.start)`; weekly and monthly call `getRange(range.start, range.end)`. Render `当日分析`, `所在周总结`, and `所在月回顾` with exact dates.

- [ ] **Step 5: Verify GREEN**

Run `node --test tests/analysis-core.test.js` and `npm test`; expect zero failures.

### Task 2: Evidence-led detailed prompts

**Files:**
- Modify: `src/analysis-core.js`
- Modify: `tests/analysis-core.test.js`

- [ ] **Step 1: Write failing prompt-contract tests**

Assert generated prompts include the exact analysis range, coverage count, `事实 / 推断 / 信息缺口`, evidence citations, ranked problems, and action fields `触发时机 / 最低执行版本 / 完成标准 / 复查时间`. Assert missing dates are not described as zero scores.

- [ ] **Step 2: Verify RED**

Run `node --test tests/analysis-core.test.js`; expect missing prompt requirements.

- [ ] **Step 3: Implement prompt builders**

Export `buildAnalysisPrompt(type, entries, range)`. Reuse entry formatting, add coverage metadata, shared evidence rules, and type-specific daily/weekly/monthly output contracts.

- [ ] **Step 4: Verify GREEN**

Run the focused test and full suite; expect zero failures.

### Task 3: Remote baseline conflict classification

**Files:**
- Modify: `src/local-store.js`
- Modify: `tests/local-store.test.js`

- [ ] **Step 1: Write failing classification tests**

Cover normal remote lag matching a known baseline, a remote value diverging from a known baseline, and an upgrade with no baseline. Require only genuine divergence in `result.conflicts`, while all versions remain archived where classification is uncertain or genuine.

- [ ] **Step 2: Verify RED**

Run `node --test tests/local-store.test.js`; expect false-conflict assertions to fail.

- [ ] **Step 3: Implement remote snapshots**

Add a user-scoped remote snapshot key, read/write it inside `mergeRemote`, compare pending fields with their last confirmed remote values, and include the snapshot in `exportBundle`.

- [ ] **Step 4: Verify GREEN**

Run focused and full tests; expect zero failures and unchanged legacy data.

### Task 4: Protect rapid edits from stale acknowledgements

**Files:**
- Modify: `src/local-store.js`
- Modify: `src/store.js`
- Modify: `tests/local-store.test.js`
- Modify: `tests/store.test.js`

- [ ] **Step 1: Write failing overlapping-upload tests**

Pause the first cloud upload, save a newer value, then complete the first upload. Assert the first acknowledgement cannot clear the newer outbox value and the next serialized sync uploads it.

- [ ] **Step 2: Verify RED**

Run `node --test tests/local-store.test.js tests/store.test.js`; expect the newer outbox preservation assertion to fail.

- [ ] **Step 3: Implement value-conditional acknowledgement**

Add `ackUploaded(userId, date, uploadedFields)`. Update the remote snapshot to confirmed uploaded values, and delete each queued field only when `equalValue(currentQueued, uploadedValue)` is true. Use it from `syncWithAdapters`.

- [ ] **Step 4: Verify GREEN**

Run focused and full suites; expect both upload values in order and an empty outbox only after the second confirmation.

### Task 5: Full PC verification and publication

**Files:**
- No committed browser artifacts.

- [ ] **Step 1: Run automated verification**

Run `npm test`, `node --check` for all source/tests, `npm run build`, and `git diff --check`.

- [ ] **Step 2: Run isolated PC browser flows**

At 1440x900 and 1024x768: navigate to a historical date, open AI analysis, verify all three exact ranges, generate a historical prompt, exercise an empty range, save rapid edits, reload, and confirm no false conflict toast or horizontal overflow.

- [ ] **Step 3: Review sensitive scope**

Confirm no destructive storage migration, no deletion of conflict archives, no authentication changes, and no Supabase schema change.

- [ ] **Step 4: Commit and push**

Commit on `codex/data-safety-fixes`, push to `origin`, and confirm draft PR #2 contains the new commit.
