const LEGACY_KEY = 'daily-review'
const LEGACY_BACKUP_KEY = 'daily-review:legacy-backup:v1'
const FIELDS = ['checkin', 'highlights', 'diary']

const entriesKey = userId => userId
  ? `daily-review:user:${userId}:entries`
  : 'daily-review:guest:entries'
const outboxKey = userId => `daily-review:user:${userId}:outbox`
const conflictsKey = userId => `daily-review:user:${userId}:conflicts`
const migrationKey = userId => `daily-review:user:${userId}:migration`

function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.keys(value).sort().map(key => [key, canonical(value[key])])
    )
  }
  return value
}

function equalValue(left, right) {
  return JSON.stringify(canonical(left)) === JSON.stringify(canonical(right))
}

function hasValue(value) {
  return value !== undefined && value !== null
}

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
          continue
        }
        if (equalValue(localValue, remoteValue)) continue

        const conflict = {
          date,
          field,
          local: structuredClone(localValue),
          remote: structuredClone(remoteValue),
          detectedAt: now()
        }
        const alreadyArchived = conflicts.some(item =>
          item.date === date &&
          item.field === field &&
          equalValue(item.local, conflict.local) &&
          equalValue(item.remote, conflict.remote)
        )
        if (!alreadyArchived) {
          conflicts.push(conflict)
          newConflicts.push(conflict)
        }

        entries[date][field] = structuredClone(remoteValue)
        if (outbox[date]) delete outbox[date][field]
      }
    }

    for (const date of Object.keys(outbox)) {
      if (Object.keys(outbox[date]).length === 0) delete outbox[date]
    }

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
    mergeRemote,
    ackOutbox,
    exportBundle,
    verifiedWrite
  }
}
