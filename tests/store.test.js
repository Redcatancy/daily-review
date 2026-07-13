import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage } from './memory-storage.js'
import { createLocalStore } from '../src/local-store.js'
import { syncWithAdapters } from '../src/store.js'

test('a remote read failure never uploads or clears local data', async () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-13', { diary: { title: '保留' } })
  let uploads = 0
  const cloud = {
    fetchAll: async () => ({ kind: 'failure', error: new Error('offline') }),
    upsertFields: async () => {
      uploads++
      return { kind: 'success' }
    }
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
    upsertFields: async () => ++call === 1
      ? { kind: 'success' }
      : { kind: 'failure', error: new Error('offline') }
  }

  const result = await syncWithAdapters('u1', local, cloud)

  assert.equal(result.kind, 'pending')
  assert.equal(Object.keys(local.readOutbox('u1')['2026-07-13']).length, 1)
})
