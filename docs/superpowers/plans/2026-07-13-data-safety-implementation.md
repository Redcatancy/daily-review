# Data Safety Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the existing browser records into a user-isolated, non-destructive storage and synchronization model without deleting legacy, local, remote, queued, or conflicting data.

**Architecture:** Keep `src/store.js` as the application-facing API, move browser persistence and migration into `src/local-store.js`, and move Supabase pagination and writes into `src/cloud-store.js`. Save locally first, queue every authenticated change, reconcile remote data without overwriting conflicts, and allow UI responses only when their user/date/render token is still current.

**Tech Stack:** Vite 8, vanilla JavaScript ES modules, Supabase JS 2, Node 26 built-in test runner, browser localStorage.

---

## File map

- Create `src/local-store.js`: verified localStorage writes, user namespaces, legacy migration, outbox, conflict archive, export bundle.
- Create `src/cloud-store.js`: paginated Supabase reads and structured cloud writes.
- Create `src/editor-state.js`: render-token guard and flushable captured-value debounce.
- Modify `src/store.js`: active-user API, non-destructive reconciliation, local-first saves, ordered outbox flushing.
- Modify `src/main.js`: account switching, save flush before navigation, export button, logout re-render.
- Modify `src/checkin.js`, `src/highlights.js`, `src/diary.js`: per-render state, stale-response rejection, truthful save messages, diary deletion.
- Modify `src/utils.js`: convert structured save results into user messages.
- Create `supabase/migrations/20260713_daily_entries_rls.sql`: unique index, RLS policies, server-managed `updated_at`.
- Create `tests/memory-storage.js`: deterministic localStorage test double.
- Create `tests/local-store.test.js`, `tests/cloud-store.test.js`, `tests/store.test.js`, `tests/editor-state.test.js`: regression coverage.
- Modify `package.json`: add the Node test script.

## Task 1: Establish the test harness and verified user-scoped storage

**Execution correction:** Before Task 3, add `daily-review:legacy-claim:v1` and a failing regression test proving the first confirmed account is the only account allowed to claim the legacy source. Export that claim with the recovery bundle. This closes the cross-account legacy-copy gap found during plan execution.

**Files:**
- Modify: `package.json:6-10`
- Create: `tests/memory-storage.js`
- Create: `tests/local-store.test.js`
- Create: `src/local-store.js`

- [ ] **Step 1: Add the test command and storage double**

Add this script to `package.json`:

```json
"test": "node --test tests/*.test.js"
```

Create `tests/memory-storage.js`:

```js
export class MemoryStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial))
    this.failWrites = false
  }

  getItem(key) { return this.data.has(key) ? this.data.get(key) : null }
  setItem(key, value) {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError')
    this.data.set(key, String(value))
  }
  removeItem(key) { this.data.delete(key) }
  key(index) { return [...this.data.keys()][index] ?? null }
  get length() { return this.data.size }
}
```

- [ ] **Step 2: Write failing migration and isolation tests**

Create `tests/local-store.test.js` with these cases:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage } from './memory-storage.js'
import { createLocalStore } from '../src/local-store.js'

const legacy = JSON.stringify({
  '2026-06-10': { diary: { title: '旧标题', content: '旧正文' } }
})

test('backs up the exact legacy string before copying it to the confirmed user', () => {
  const storage = new MemoryStorage({ 'daily-review': legacy })
  const local = createLocalStore(storage, { now: () => '2026-07-13T00:00:00.000Z' })
  const result = local.migrateLegacy('user-redcatancy')

  assert.equal(result.kind, 'migrated')
  assert.equal(JSON.parse(storage.getItem('daily-review:legacy-backup:v1')).raw, legacy)
  assert.equal(storage.getItem('daily-review'), legacy)
  assert.equal(local.readEntries('user-redcatancy')['2026-06-10'].diary.title, '旧标题')
})

test('migration is idempotent and never duplicates outbox or conflicts', () => {
  const storage = new MemoryStorage({ 'daily-review': legacy })
  const local = createLocalStore(storage, { now: () => '2026-07-13T00:00:00.000Z' })
  local.migrateLegacy('user-redcatancy')
  const first = JSON.stringify(local.exportBundle('user-redcatancy'))
  local.migrateLegacy('user-redcatancy')
  assert.equal(JSON.stringify(local.exportBundle('user-redcatancy')), first)
})

test('keeps guest and authenticated records in different keys', () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields(null, '2026-07-13', { diary: { title: '访客' } })
  local.saveFields('user-redcatancy', '2026-07-13', { diary: { title: '账号' } })
  assert.equal(local.readEntries(null)['2026-07-13'].diary.title, '访客')
  assert.equal(local.readEntries('user-redcatancy')['2026-07-13'].diary.title, '账号')
})

test('reports a local failure without changing the previous value', () => {
  const storage = new MemoryStorage()
  const local = createLocalStore(storage)
  local.saveFields(null, '2026-07-13', { diary: { title: '安全值' } })
  storage.failWrites = true
  const result = local.saveFields(null, '2026-07-13', { diary: { title: '未写入' } })
  storage.failWrites = false
  assert.equal(result.kind, 'local-failure')
  assert.equal(local.readEntries(null)['2026-07-13'].diary.title, '安全值')
})
```

- [ ] **Step 3: Run the tests and confirm the red state**

Run: `node-v26.2.0-win-x64\npm.cmd test`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/local-store.js`.

- [ ] **Step 4: Implement verified storage, namespaces, and legacy migration**

Create `src/local-store.js` with these exported contracts and exact key scheme:

```js
const LEGACY_KEY = 'daily-review'
const LEGACY_BACKUP_KEY = 'daily-review:legacy-backup:v1'
const FIELDS = ['checkin', 'highlights', 'diary']

const entriesKey = userId => userId
  ? `daily-review:user:${userId}:entries`
  : 'daily-review:guest:entries'
const outboxKey = userId => `daily-review:user:${userId}:outbox`
const conflictsKey = userId => `daily-review:user:${userId}:conflicts`
const migrationKey = userId => `daily-review:user:${userId}:migration`

export function createLocalStore(storage, { now = () => new Date().toISOString() } = {}) {
  function readJson(key, fallback) {
    const raw = storage.getItem(key)
    if (raw === null) return structuredClone(fallback)
    try { return JSON.parse(raw) } catch { return structuredClone(fallback) }
  }

  function verifiedWrite(key, value) {
    const raw = JSON.stringify(value)
    try {
      storage.setItem(key, raw)
      if (storage.getItem(key) !== raw) throw new Error('localStorage verification failed')
      return { kind: 'ok' }
    } catch (error) {
      return { kind: 'local-failure', error }
    }
  }

  function readEntries(userId) { return readJson(entriesKey(userId), {}) }
  function readOutbox(userId) { return userId ? readJson(outboxKey(userId), {}) : {} }

  function saveFields(userId, date, fields, { queue = true } = {}) {
    const previous = readEntries(userId)
    const next = structuredClone(previous)
    next[date] = { ...(next[date] || {}), ...structuredClone(fields) }
    if (userId && queue) {
      const outbox = readOutbox(userId)
      outbox[date] = { ...(outbox[date] || {}), ...structuredClone(fields) }
      const queued = verifiedWrite(outboxKey(userId), outbox)
      if (queued.kind !== 'ok') return queued
    }
    const saved = verifiedWrite(entriesKey(userId), next)
    if (saved.kind !== 'ok') return saved
    return { kind: 'local-saved', pending: Boolean(userId && queue) }
  }

  function migrateLegacy(userId) {
    if (!userId) return { kind: 'skipped' }
    if (readJson(migrationKey(userId), null)?.complete) return { kind: 'already-migrated' }
    const raw = storage.getItem(LEGACY_KEY)
    if (raw === null) {
      verifiedWrite(migrationKey(userId), { complete: true, migratedAt: now(), source: 'empty' })
      return { kind: 'empty' }
    }
    if (storage.getItem(LEGACY_BACKUP_KEY) === null) {
      const backup = verifiedWrite(LEGACY_BACKUP_KEY, { raw, createdAt: now() })
      if (backup.kind !== 'ok') return backup
    }
    let legacy
    try { legacy = JSON.parse(raw) } catch (error) { return { kind: 'invalid-legacy', error } }
    if (!legacy || Array.isArray(legacy) || typeof legacy !== 'object') return { kind: 'invalid-legacy' }
    for (const [date, entry] of Object.entries(legacy)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !entry || typeof entry !== 'object') continue
      const fields = Object.fromEntries(FIELDS.filter(field => field in entry).map(field => [field, entry[field]]))
      const saved = saveFields(userId, date, fields)
      if (saved.kind === 'local-failure') return saved
    }
    const marked = verifiedWrite(migrationKey(userId), { complete: true, migratedAt: now(), source: LEGACY_KEY })
    return marked.kind === 'ok' ? { kind: 'migrated' } : marked
  }

  function exportBundle(userId) {
    return {
      version: 1,
      exportedAt: now(),
      userId,
      entries: readEntries(userId),
      outbox: readOutbox(userId),
      conflicts: userId ? readJson(conflictsKey(userId), []) : [],
      migration: userId ? readJson(migrationKey(userId), null) : null,
      legacyBackup: readJson(LEGACY_BACKUP_KEY, null)
    }
  }

  return { readEntries, readOutbox, saveFields, migrateLegacy, exportBundle, verifiedWrite }
}
```

- [ ] **Step 5: Run the focused tests and confirm green**

Run: `node-v26.2.0-win-x64\node.exe --test tests/local-store.test.js`

Expected: 4 tests pass, 0 fail.

- [ ] **Step 6: Commit Task 1**

```powershell
git add package.json tests/memory-storage.js tests/local-store.test.js src/local-store.js
git commit -m "add verified user-scoped local storage"
```

## Task 2: Add non-destructive merge, conflict archive, outbox acknowledgement, and export

**Files:**
- Modify: `tests/local-store.test.js`
- Modify: `src/local-store.js`

- [ ] **Step 1: Add failing merge and recovery tests**

Append tests that assert all four merge cases and acknowledgement behavior:

```js
test('merges remote-only fields and archives both sides of a conflict', () => {
  const local = createLocalStore(new MemoryStorage(), { now: () => '2026-07-13T00:00:00.000Z' })
  local.saveFields('u1', '2026-07-12', {
    diary: { title: '本地版本' },
    highlights: { wins: ['本地独有'], improves: [] }
  })

  const result = local.mergeRemote('u1', {
    '2026-07-12': {
      diary: { title: '云端版本' },
      checkin: { mood: 5 }
    }
  })

  const visible = local.readEntries('u1')['2026-07-12']
  assert.deepEqual(visible.diary, { title: '云端版本' })
  assert.deepEqual(visible.checkin, { mood: 5 })
  assert.deepEqual(visible.highlights, { wins: ['本地独有'], improves: [] })
  assert.equal(result.conflicts.length, 1)
  assert.deepEqual(local.exportBundle('u1').conflicts[0].local, { title: '本地版本' })
  assert.deepEqual(local.exportBundle('u1').conflicts[0].remote, { title: '云端版本' })
  assert.equal('diary' in local.readOutbox('u1')['2026-07-12'], false)
})

test('acknowledges only fields confirmed by the cloud', () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-13', { diary: null, checkin: { mood: 4 } })
  local.ackOutbox('u1', '2026-07-13', ['diary'])
  assert.deepEqual(local.readOutbox('u1')['2026-07-13'], { checkin: { mood: 4 } })
})
```

- [ ] **Step 2: Run and confirm red**

Run: `node-v26.2.0-win-x64\node.exe --test tests/local-store.test.js`

Expected: FAIL because `mergeRemote` and `ackOutbox` are missing.

- [ ] **Step 3: Implement canonical comparison and merge rules**

Add to `src/local-store.js`:

```js
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]))
  }
  return value
}

function equalValue(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}

function hasValue(value) {
  return value !== undefined && value !== null
}
```

Inside `createLocalStore`, add `mergeRemote` and `ackOutbox`. The implementation must write the conflict archive before replacing the visible local field, remove conflicting fields from outbox only after that archive is verified, and stop on any failed write without deleting a previous storage value. A `null` in outbox is an explicit local deletion operation; a remote `null` with no matching local outbox field is treated as an empty cloud field, not as permission to delete a non-null local value:

```js
function mergeRemote(userId, remoteEntries) {
  const entries = readEntries(userId)
  const outbox = readOutbox(userId)
  const conflicts = readJson(conflictsKey(userId), [])
  const newConflicts = []

  for (const [date, remoteEntry] of Object.entries(remoteEntries)) {
    entries[date] ||= {}
    for (const field of FIELDS) {
      const localValue = entries[date][field]
      const remoteValue = remoteEntry[field]
      const pendingField = Object.hasOwn(outbox[date] || {}, field)
      const localPresent = hasValue(localValue) || pendingField
      if (!hasValue(remoteValue)) continue
      if (!localPresent) {
        entries[date][field] = structuredClone(remoteValue)
      } else if (!equalValue(localValue, remoteValue)) {
        const conflict = { date, field, local: structuredClone(localValue), remote: structuredClone(remoteValue), detectedAt: now() }
        if (!conflicts.some(item => item.date === date && item.field === field &&
          equalValue(item.local, conflict.local) && equalValue(item.remote, conflict.remote))) {
          conflicts.push(conflict)
          newConflicts.push(conflict)
        }
        entries[date][field] = structuredClone(remoteValue)
        if (outbox[date]) delete outbox[date][field]
      }
    }
  }

  for (const date of Object.keys(outbox)) if (Object.keys(outbox[date]).length === 0) delete outbox[date]
  const conflictWrite = verifiedWrite(conflictsKey(userId), conflicts)
  if (conflictWrite.kind !== 'ok') return conflictWrite
  const entriesWrite = verifiedWrite(entriesKey(userId), entries)
  if (entriesWrite.kind !== 'ok') return entriesWrite
  const outboxWrite = verifiedWrite(outboxKey(userId), outbox)
  if (outboxWrite.kind !== 'ok') return outboxWrite
  return { kind: 'merged', conflicts: newConflicts }
}

function ackOutbox(userId, date, fields) {
  const outbox = readOutbox(userId)
  if (!outbox[date]) return { kind: 'ok' }
  for (const field of fields) delete outbox[date][field]
  if (Object.keys(outbox[date]).length === 0) delete outbox[date]
  return verifiedWrite(outboxKey(userId), outbox)
}
```

Return both methods from `createLocalStore`.

- [ ] **Step 4: Run local-store tests**

Run: `node-v26.2.0-win-x64\node.exe --test tests/local-store.test.js`

Expected: 6 tests pass, 0 fail.

- [ ] **Step 5: Commit Task 2**

```powershell
git add tests/local-store.test.js src/local-store.js
git commit -m "preserve both sides of sync conflicts"
```

## Task 3: Add paginated cloud access and a failure-safe synchronization state machine

**Files:**
- Create: `tests/cloud-store.test.js`
- Create: `src/cloud-store.js`
- Create: `tests/store.test.js`
- Rewrite: `src/store.js`

- [ ] **Step 1: Write failing pagination and cloud-result tests**

Create `tests/cloud-store.test.js` with a Supabase query double that records `.range(from, to)` calls:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createCloudStore } from '../src/cloud-store.js'

function readClient(pages) {
  const ranges = []
  return {
    ranges,
    from() {
      return {
        select() { return this },
        eq() { return this },
        order() { return this },
        range(from, to) {
          ranges.push([from, to])
          return Promise.resolve(pages[ranges.length - 1])
        }
      }
    }
  }
}

test('reads every page and maps rows by date', async () => {
  const client = readClient([
    { data: [
      { date: '2026-07-12', checkin: null, highlights: null, diary: { title: 'A' } },
      { date: '2026-07-13', checkin: { mood: 5 }, highlights: null, diary: null }
    ], error: null },
    { data: [], error: null }
  ])
  const result = await createCloudStore(client, { pageSize: 2 }).fetchAll('u1')
  assert.deepEqual(result, {
    kind: 'success',
    data: {
      '2026-07-12': { checkin: null, highlights: null, diary: { title: 'A' } },
      '2026-07-13': { checkin: { mood: 5 }, highlights: null, diary: null }
    }
  })
  assert.deepEqual(client.ranges, [[0, 1], [2, 3]])
})

test('distinguishes empty and failed cloud reads', async () => {
  const empty = await createCloudStore(readClient([{ data: [], error: null }])).fetchAll('u1')
  assert.deepEqual(empty, { kind: 'empty', data: {} })
  const error = new Error('denied')
  const failed = await createCloudStore(readClient([{ data: null, error }])).fetchAll('u1')
  assert.deepEqual(failed, { kind: 'failure', error })
})
```

Add this upsert test:

```js
test('returns structured upsert results without throwing', async () => {
  const writeClient = error => ({ from: () => ({ upsert: async () => ({ error }) }) })
  assert.deepEqual(
    await createCloudStore(writeClient(null)).upsertFields('u1', '2026-07-13', { diary: null }),
    { kind: 'success' }
  )
  const error = new Error('offline')
  assert.deepEqual(
    await createCloudStore(writeClient(error)).upsertFields('u1', '2026-07-13', { diary: null }),
    { kind: 'failure', error }
  )
})
```

- [ ] **Step 2: Run and confirm red**

Run: `node-v26.2.0-win-x64\node.exe --test tests/cloud-store.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/cloud-store.js`.

- [ ] **Step 3: Implement the cloud adapter**

Create `src/cloud-store.js`:

```js
export function createCloudStore(client, { pageSize = 500 } = {}) {
  async function fetchAll(userId) {
    const rows = []
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await client
        .from('daily_entries')
        .select('date, checkin, highlights, diary')
        .eq('user_id', userId)
        .order('date', { ascending: true })
        .range(from, from + pageSize - 1)
      if (error) return { kind: 'failure', error }
      rows.push(...data)
      if (data.length < pageSize) break
    }
    const mapped = Object.fromEntries(rows.map(row => [row.date, {
      checkin: row.checkin,
      highlights: row.highlights,
      diary: row.diary
    }]))
    return rows.length === 0 ? { kind: 'empty', data: {} } : { kind: 'success', data: mapped }
  }

  async function upsertFields(userId, date, fields) {
    const { error } = await client.from('daily_entries').upsert(
      { user_id: userId, date, ...fields },
      { onConflict: 'user_id,date' }
    )
    return error ? { kind: 'failure', error } : { kind: 'success' }
  }

  return { fetchAll, upsertFields }
}
```

- [ ] **Step 4: Add failing synchronization tests**

Create `tests/store.test.js` using `MemoryStorage`, `createLocalStore`, and a fake cloud adapter. Cover these exact assertions:

```js
test('a remote read failure never uploads or clears local data', async () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-13', { diary: { title: '保留' } })
  let uploads = 0
  const cloud = {
    fetchAll: async () => ({ kind: 'failure', error: new Error('offline') }),
    upsertFields: async () => { uploads++; return { kind: 'success' } }
  }
  const result = await syncWithAdapters('u1', local, cloud)
  assert.equal(result.kind, 'pending')
  assert.equal(uploads, 0)
  assert.equal(local.readEntries('u1')['2026-07-13'].diary.title, '保留')
  assert.equal(local.readOutbox('u1')['2026-07-13'].diary.title, '保留')
})

test('acknowledges an outbox field only after confirmed upload', async () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-13', { diary: null, checkin: { mood: 5 } })
  let call = 0
  const cloud = {
    fetchAll: async () => ({ kind: 'empty', data: {} }),
    upsertFields: async () => ++call === 1 ? { kind: 'success' } : { kind: 'failure', error: new Error('offline') }
  }
  await syncWithAdapters('u1', local, cloud)
  assert.equal(Object.keys(local.readOutbox('u1')['2026-07-13']).length, 1)
})
```

- [ ] **Step 5: Rewrite the store facade around injected adapters**

In `src/store.js`, keep adapter construction lazy so Node can import the module without a browser global. Export an injectable facade for tests and retain the existing application-facing function names:

```js
export async function syncWithAdapters(userId, local, cloud) {
  const remote = await cloud.fetchAll(userId)
  if (remote.kind === 'failure') return { kind: 'pending', error: remote.error }
  const merged = local.mergeRemote(userId, remote.data)
  if (merged.kind === 'local-failure') return merged

  const outbox = local.readOutbox(userId)
  for (const [date, fields] of Object.entries(outbox)) {
    for (const [field, value] of Object.entries(fields)) {
      const uploaded = await cloud.upsertFields(userId, date, { [field]: value })
      if (uploaded.kind === 'failure') return { kind: 'pending', error: uploaded.error, conflicts: merged.conflicts }
      const acked = local.ackOutbox(userId, date, [field])
      if (acked.kind !== 'ok') return acked
    }
  }
  return { kind: 'synced', conflicts: merged.conflicts }
}

export function createStoreFacade(localStore, cloudStore) {
  let activeUserId = null
  const syncChains = new Map()

  function setActiveUser(user) { activeUserId = user?.id ?? null }
  function enqueueUserSync(userId) {
    const previous = syncChains.get(userId) || Promise.resolve()
    const next = previous.catch(() => undefined)
      .then(() => syncWithAdapters(userId, localStore, cloudStore))
    syncChains.set(userId, next)
    return next
  }
  async function syncOnLogin() {
    const userId = activeUserId
    if (!userId) return { kind: 'guest' }
    const migrated = localStore.migrateLegacy(userId)
    if (migrated.kind === 'local-failure' || migrated.kind === 'invalid-legacy') return migrated
    return enqueueUserSync(userId)
  }
  async function getEntry(date) { return localStore.readEntries(activeUserId)[date] || null }
  async function saveEntry(date, fields) {
    const userId = activeUserId
    const localResult = localStore.saveFields(userId, date, fields)
    if (localResult.kind === 'local-failure' || !userId) return localResult
    return enqueueUserSync(userId)
      .then(result => result.kind === 'synced'
        ? { kind: 'synced', conflicts: result.conflicts }
        : { kind: 'local-saved-pending', error: result.error })
      .catch(error => ({ kind: 'local-saved-pending', error }))
  }
  async function getRange(startDate, endDate) {
    return Object.entries(localStore.readEntries(activeUserId))
      .filter(([date]) => date >= startDate && date <= endDate)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([date, entry]) => ({ date, ...entry }))
  }
  async function getMonthDates(year, month) {
    const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
    return Object.keys(localStore.readEntries(activeUserId)).filter(date => date.startsWith(prefix))
  }
  async function getAllDates() { return Object.keys(localStore.readEntries(activeUserId)).sort() }
  function exportCurrentBackup() { return localStore.exportBundle(activeUserId) }

  return { setActiveUser, syncOnLogin, getEntry, saveEntry, getRange, getMonthDates, getAllDates, exportCurrentBackup }
}

let defaultFacade
function appStore() {
  defaultFacade ||= createStoreFacade(
    createLocalStore(globalThis.localStorage),
    createCloudStore(supabase)
  )
  return defaultFacade
}

export const setActiveUser = user => appStore().setActiveUser(user)
export const syncOnLogin = () => appStore().syncOnLogin()
export const getEntry = date => appStore().getEntry(date)
export const saveEntry = (date, fields) => appStore().saveEntry(date, fields)
export const getRange = (start, end) => appStore().getRange(start, end)
export const getMonthDates = (year, month) => appStore().getMonthDates(year, month)
export const getAllDates = () => appStore().getAllDates()
export const exportCurrentBackup = () => appStore().exportCurrentBackup()
```

Rendering now reads only the active local namespace; no render path performs a hidden cloud fetch or replaces local data.

- [ ] **Step 6: Run cloud and store tests**

Run: `node-v26.2.0-win-x64\node.exe --test tests/cloud-store.test.js tests/store.test.js`

Expected: all tests pass, 0 fail.

- [ ] **Step 7: Commit Task 3**

```powershell
git add src/cloud-store.js src/store.js tests/cloud-store.test.js tests/store.test.js
git commit -m "make cloud sync non-destructive and retryable"
```

## Task 4: Prevent stale async renders and make diary debounce flushable

**Files:**
- Create: `src/editor-state.js`
- Create: `tests/editor-state.test.js`
- Modify: `src/checkin.js`
- Modify: `src/highlights.js`
- Modify: `src/diary.js`

- [ ] **Step 1: Write failing pure state tests**

Create `tests/editor-state.test.js`:

```js
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRenderGuard, createCapturedDebounce } from '../src/editor-state.js'

test('rejects a response from an older render', () => {
  const guard = createRenderGuard()
  const first = guard.begin({ userId: 'u1', date: '2026-07-12' })
  const second = guard.begin({ userId: 'u1', date: '2026-07-13' })
  assert.equal(guard.isCurrent(first), false)
  assert.equal(guard.isCurrent(second), true)
})

test('flush saves the captured date and values exactly once', async () => {
  const calls = []
  let scheduled
  const debounce = createCapturedDebounce(value => calls.push(value), 1000, {
    setTimer: fn => { scheduled = fn; return 1 },
    clearTimer: () => { scheduled = null }
  })
  debounce.schedule({ date: '2026-07-12', title: 'A', content: 'B' })
  await debounce.flush()
  assert.deepEqual(calls, [{ date: '2026-07-12', title: 'A', content: 'B' }])
  assert.equal(scheduled, null)
})
```

- [ ] **Step 2: Run and confirm red**

Run: `node-v26.2.0-win-x64\node.exe --test tests/editor-state.test.js`

Expected: FAIL with `ERR_MODULE_NOT_FOUND` for `src/editor-state.js`.

- [ ] **Step 3: Implement render guards and captured debounce**

Create `src/editor-state.js`:

```js
export function createRenderGuard() {
  let version = 0
  let current = null
  return {
    begin(context) {
      current = { ...context, version: ++version }
      return current
    },
    isCurrent(token) {
      return Boolean(current && token.version === current.version &&
        token.userId === current.userId && token.date === current.date)
    }
  }
}

export function createCapturedDebounce(run, delay, timers = {}) {
  const setTimer = timers.setTimer || ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = timers.clearTimer || (id => clearTimeout(id))
  let timer = null
  let pending = null
  async function execute() {
    if (!pending) return
    const value = pending
    pending = null
    if (timer !== null) clearTimer(timer)
    timer = null
    return run(value)
  }
  return {
    schedule(value) {
      pending = structuredClone(value)
      if (timer !== null) clearTimer(timer)
      timer = setTimer(execute, delay)
    },
    flush: execute
  }
}
```

- [ ] **Step 4: Refactor each editor to own its render state**

For `src/checkin.js` and `src/highlights.js`:

- replace module-global mutable entry data with a per-render `state` object captured by event handlers;
- call `const token = guard.begin({ userId: getCurrentUser()?.id ?? null, date: dateStr })` before `getEntry`;
- after `await getEntry(dateStr)`, return without updating state or DOM unless `guard.isCurrent(token)` and `container.isConnected`;
- await `saveEntry` in event handlers and pass the structured result to the status renderer from Task 5.

Use this exact load pattern:

```js
const guard = createRenderGuard()

async function loadForRender(container, dateStr, state, token) {
  const entry = await getEntry(dateStr)
  if (!guard.isCurrent(token) || !container.isConnected) return false
  state.data = structuredClone(entry?.checkin || {})
  return true
}
```

For `src/diary.js`, remove the module-global `debouncedSave`. Add one module-level `pendingDiary` whose payload contains values, not DOM references:

```js
let pendingDiary = null

export async function flushPendingDiarySave() {
  return pendingDiary?.flush()
}

function saveCapturedDiary({ date, title, content }) {
  const diary = title.trim() || content.trim()
    ? { title: title.trim(), content: content.trim() }
    : null
  return saveEntry(date, { diary }).then(showSaveResult)
}
```

Each `renderDiary` must flush the previous pending saver, create a new `createCapturedDebounce(saveCapturedDiary, 1000)`, and schedule `{ date: dateStr, title: titleInput.value, content: contentInput.value }` on input. Its async load must use a render token before assigning input values.

- [ ] **Step 5: Run editor-state tests and syntax checks**

Run:

```powershell
node-v26.2.0-win-x64\node.exe --test tests/editor-state.test.js
Get-ChildItem src -Filter *.js | ForEach-Object { .\node-v26.2.0-win-x64\node.exe --check $_.FullName }
```

Expected: editor-state tests pass and every syntax check exits 0.

- [ ] **Step 6: Commit Task 4**

```powershell
git add src/editor-state.js src/checkin.js src/highlights.js src/diary.js tests/editor-state.test.js
git commit -m "prevent stale editor writes across dates"
```

## Task 5: Connect account switching, truthful status, flush navigation, and backup export

**Files:**
- Modify: `src/utils.js`
- Modify: `src/main.js`
- Modify: `src/auth.js`
- Modify: `index.html` only if a dedicated download anchor is required
- Modify: `tests/store.test.js`

- [ ] **Step 1: Add failing status and account-switch tests**

Add these tests to `tests/store.test.js` and import `saveResultMessage` from `src/utils.js`:

```js
test('switching users and logout changes the visible local namespace', async () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-13', { diary: { title: '用户一' } })
  local.saveFields('u2', '2026-07-13', { diary: { title: '用户二' } })
  local.saveFields(null, '2026-07-13', { diary: { title: '访客' } })
  const facade = createStoreFacade(local, { fetchAll: async () => ({ kind: 'empty', data: {} }) })

  facade.setActiveUser({ id: 'u1' })
  assert.equal((await facade.getEntry('2026-07-13')).diary.title, '用户一')
  facade.setActiveUser({ id: 'u2' })
  assert.equal((await facade.getEntry('2026-07-13')).diary.title, '用户二')
  facade.setActiveUser(null)
  assert.equal((await facade.getEntry('2026-07-13')).diary.title, '访客')
})

test('maps save outcomes to truthful user messages', () => {
  assert.equal(saveResultMessage({ kind: 'synced' }), '已同步')
  assert.equal(saveResultMessage({ kind: 'local-saved-pending' }), '已保存到本地，等待网络同步')
  assert.equal(saveResultMessage({ kind: 'local-failure' }), '本地保存失败，请立即导出备份')
})
```

- [ ] **Step 2: Run and confirm red**

Run: `node-v26.2.0-win-x64\node.exe --test tests/store.test.js`

Expected: FAIL because the new account-switch assertions or `saveResultMessage` are not implemented.

- [ ] **Step 3: Implement truthful status rendering**

Add to `src/utils.js`:

```js
export function saveResultMessage(result) {
  if (result?.kind === 'synced') return result.conflicts?.length
    ? '发现数据冲突，双方版本已保留'
    : '已同步'
  if (result?.kind === 'local-saved' && !result.pending) return '已保存到本地'
  if (result?.kind === 'local-saved-pending' || result?.kind === 'pending') return '已保存到本地，等待网络同步'
  return '本地保存失败，请立即导出备份'
}

export function showSaveResult(result) {
  showStatus(saveResultMessage(result))
  return result
}
```

- [ ] **Step 4: Flush saves around navigation and switch storage scope on auth events**

Modify `src/main.js` so `switchTab`, previous day, next day, today, logout handling, and calendar date selection call `await flushPendingDiarySave()` before changing date/tab/user. On every auth callback:

```js
onAuthChange(async newUser => {
  await flushPendingDiarySave()
  setActiveUser(newUser)
  updateAuthUI(newUser)
  if (newUser) await syncOnLogin()
  await renderCurrentTab()
})
```

Immediately after `initAuth`, call `setActiveUser(user)` before the first sync or render. Add:

```js
window.addEventListener('pagehide', () => { void flushPendingDiarySave() })
```

Do not clear any localStorage key during logout.

- [ ] **Step 5: Add backup export without injecting user metadata as HTML**

Build the authenticated user block with `document.createElement`, assign `textContent` for the username, and assign `avatar.src` as a property. Add an “导出数据备份” button that calls:

```js
function downloadCurrentBackup() {
  const bundle = exportCurrentBackup()
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `daily-review-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  anchor.click()
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 6: Run tests and build**

Run:

```powershell
node-v26.2.0-win-x64\npm.cmd test
node-v26.2.0-win-x64\npm.cmd run build
```

Expected: all tests pass and Vite reports `built` with exit code 0.

- [ ] **Step 7: Commit Task 5**

```powershell
git add src/utils.js src/main.js src/auth.js index.html tests/store.test.js
git commit -m "connect safe saves to auth and navigation"
```

## Task 6: Add the Supabase authorization migration

**Files:**
- Create: `supabase/migrations/20260713_daily_entries_rls.sql`

- [ ] **Step 1: Create the idempotent SQL migration**

Create `supabase/migrations/20260713_daily_entries_rls.sql`:

```sql
create unique index if not exists daily_entries_user_date_uidx
  on public.daily_entries (user_id, date);

alter table public.daily_entries enable row level security;

drop policy if exists "daily_entries_select_own" on public.daily_entries;
create policy "daily_entries_select_own"
  on public.daily_entries for select
  to authenticated
  using ((select auth.uid()) = user_id);

drop policy if exists "daily_entries_insert_own" on public.daily_entries;
create policy "daily_entries_insert_own"
  on public.daily_entries for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_entries_update_own" on public.daily_entries;
create policy "daily_entries_update_own"
  on public.daily_entries for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

drop policy if exists "daily_entries_delete_own" on public.daily_entries;
create policy "daily_entries_delete_own"
  on public.daily_entries for delete
  to authenticated
  using ((select auth.uid()) = user_id);

create or replace function public.set_daily_entries_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists set_daily_entries_updated_at on public.daily_entries;
create trigger set_daily_entries_updated_at
before insert or update on public.daily_entries
for each row execute function public.set_daily_entries_updated_at();
```

- [ ] **Step 2: Review SQL safety without applying it remotely**

Run:

```powershell
Select-String -Path supabase/migrations/20260713_daily_entries_rls.sql -Pattern 'enable row level security|auth.uid|unique index|updated_at'
```

Expected: one RLS enable statement, four policies containing `auth.uid()`, one unique index, and one updated-at trigger. Do not execute this migration against the remote project without separate user approval.

- [ ] **Step 3: Commit Task 6**

```powershell
git add supabase/migrations/20260713_daily_entries_rls.sql
git commit -m "add daily entries row level security migration"
```

## Task 7: Final regression, manual recovery proof, and publication

**Files:**
- Modify only if verification reveals a failing requirement.

- [ ] **Step 1: Run the complete automated suite**

Run:

```powershell
node-v26.2.0-win-x64\npm.cmd test
Get-ChildItem src -Filter *.js | ForEach-Object { .\node-v26.2.0-win-x64\node.exe --check $_.FullName }
node-v26.2.0-win-x64\npm.cmd run build
git diff --check codex/current-app-backup-20260713...HEAD
```

Expected: zero test failures, zero syntax failures, successful Vite build, and no whitespace errors.

- [ ] **Step 2: Verify the immutable recovery point**

Run:

```powershell
git rev-parse codex/current-app-backup-20260713
git show --no-patch --oneline 1987729
git status -sb
```

Expected: backup branch resolves to `1987729`, the backup commit exists, and the feature worktree is clean.

- [ ] **Step 3: Exercise the browser recovery flow**

With a temporary test profile, seed `localStorage['daily-review']` with two dated entries, then verify:

1. First login creates `daily-review:legacy-backup:v1` with an exact `raw` match.
2. The old `daily-review` key remains unchanged.
3. The same entries appear in the authenticated user's key whose name starts with `daily-review:user:` and ends with `:entries`.
4. Simulated offline saving retains the change in entries and outbox and displays the pending message.
5. Logging out displays guest data, not authenticated data.
6. Logging back in restores authenticated data.
7. Clearing a diary stores `diary: null` in the outbox.
8. Exported JSON contains entries, outbox, conflicts, migration metadata, and the legacy backup.

Expected: every step passes without deleting a storage key. Save screenshots or traces outside the repository.

- [ ] **Step 4: Push the fix branch and open a draft PR**

```powershell
git push -u origin codex/data-safety-fixes
$body = @'
## Summary
- preserves the exact legacy browser payload before migration
- isolates guest and authenticated local data
- merges cloud data without silently overwriting conflicts
- queues offline writes and exports all recovery records

## Recovery point
- branch: codex/current-app-backup-20260713
- commit: 1987729

## Validation
- Node test suite passed
- JavaScript syntax checks passed
- Vite production build passed
- browser migration and recovery flow passed

## Database
The RLS migration is committed but has not been applied to the remote Supabase project.
'@
gh pr create --draft --base main --head codex/data-safety-fixes --title "[codex] preserve daily review data during sync" --body $body
```

The PR body must include the backup branch and commit, migration behavior, conflict behavior, tests run, build result, manual recovery proof, and the fact that the SQL migration has not been applied remotely.
