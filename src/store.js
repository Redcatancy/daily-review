import { supabase } from './supabase.js'
import { createLocalStore } from './local-store.js'
import { createCloudStore } from './cloud-store.js'

export async function syncWithAdapters(userId, local, cloud) {
  const remote = await cloud.fetchAll(userId)
  if (remote.kind === 'failure') return { kind: 'pending', error: remote.error }

  const merged = local.mergeRemote(userId, remote.data)
  if (merged.kind === 'local-failure') return merged

  const outbox = local.readOutbox(userId)
  for (const [date, fields] of Object.entries(outbox)) {
    for (const [field, value] of Object.entries(fields)) {
      const uploaded = await cloud.upsertFields(userId, date, { [field]: value })
      if (uploaded.kind === 'failure') {
        return {
          kind: 'pending',
          error: uploaded.error,
          conflicts: merged.conflicts
        }
      }
      const acknowledged = local.ackUploaded(userId, date, { [field]: value })
      if (acknowledged.kind !== 'ok') return acknowledged
    }
  }
  return { kind: 'synced', conflicts: merged.conflicts }
}

export function createStoreFacade(localStore, cloudStore) {
  let activeUserId = null
  const syncChains = new Map()

  function setActiveUser(user) {
    activeUserId = user?.id ?? null
  }

  function enqueueUserSync(userId) {
    const previous = syncChains.get(userId) || Promise.resolve()
    const next = previous
      .catch(() => undefined)
      .then(() => syncWithAdapters(userId, localStore, cloudStore))
    syncChains.set(userId, next)
    return next
  }

  async function syncOnLogin() {
    const userId = activeUserId
    if (!userId) return { kind: 'guest' }

    const migrated = localStore.migrateLegacy(userId)
    if (migrated.kind === 'local-failure' || migrated.kind === 'invalid-legacy') {
      return migrated
    }
    return enqueueUserSync(userId)
  }

  async function getEntry(date) {
    return localStore.readEntries(activeUserId)[date] || null
  }

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
    return Object.keys(localStore.readEntries(activeUserId))
      .filter(date => date.startsWith(prefix))
  }

  async function getAllDates() {
    return Object.keys(localStore.readEntries(activeUserId)).sort()
  }

  function exportCurrentBackup() {
    return localStore.exportBundle(activeUserId)
  }

  return {
    setActiveUser,
    syncOnLogin,
    getEntry,
    saveEntry,
    getRange,
    getMonthDates,
    getAllDates,
    exportCurrentBackup
  }
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
