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
    try {
      return JSON.parse(raw)
    } catch {
      return structuredClone(fallback)
    }
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

  function readEntries(userId) {
    return readJson(entriesKey(userId), {})
  }

  function readOutbox(userId) {
    return userId ? readJson(outboxKey(userId), {}) : {}
  }

  function saveFields(userId, date, fields, { queue = true } = {}) {
    const next = structuredClone(readEntries(userId))
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
      const marked = verifiedWrite(migrationKey(userId), {
        complete: true,
        migratedAt: now(),
        source: 'empty'
      })
      return marked.kind === 'ok' ? { kind: 'empty' } : marked
    }

    if (storage.getItem(LEGACY_BACKUP_KEY) === null) {
      const backup = verifiedWrite(LEGACY_BACKUP_KEY, { raw, createdAt: now() })
      if (backup.kind !== 'ok') return backup
    }

    let legacy
    try {
      legacy = JSON.parse(raw)
    } catch (error) {
      return { kind: 'invalid-legacy', error }
    }
    if (!legacy || Array.isArray(legacy) || typeof legacy !== 'object') {
      return { kind: 'invalid-legacy' }
    }

    for (const [date, entry] of Object.entries(legacy)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !entry || typeof entry !== 'object') continue
      const fields = Object.fromEntries(
        FIELDS.filter(field => field in entry).map(field => [field, entry[field]])
      )
      const saved = saveFields(userId, date, fields)
      if (saved.kind === 'local-failure') return saved
    }

    const marked = verifiedWrite(migrationKey(userId), {
      complete: true,
      migratedAt: now(),
      source: LEGACY_KEY
    })
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

  return {
    readEntries,
    readOutbox,
    saveFields,
    migrateLegacy,
    exportBundle,
    verifiedWrite
  }
}
