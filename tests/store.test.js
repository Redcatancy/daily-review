import test from 'node:test'
import assert from 'node:assert/strict'
import { MemoryStorage } from './memory-storage.js'
import { createLocalStore } from '../src/local-store.js'
import { createStoreFacade, syncWithAdapters } from '../src/store.js'
import { saveResultMessage } from '../src/utils.js'

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

test('uploads a pending local edit after archiving a stale cloud version', async () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-15', {
    diary: { title: 'local-new', content: 'kept after refresh' }
  })
  const uploads = []
  const cloud = {
    fetchAll: async () => ({
      kind: 'success',
      data: { '2026-07-15': { diary: { title: 'cloud-old', content: '' } } }
    }),
    upsertFields: async (_userId, date, fields) => {
      uploads.push({ date, fields })
      return { kind: 'success' }
    }
  }

  const result = await syncWithAdapters('u1', local, cloud)

  assert.equal(result.kind, 'synced')
  assert.equal(result.conflicts.length, 1)
  assert.deepEqual(uploads, [{
    date: '2026-07-15',
    fields: { diary: { title: 'local-new', content: 'kept after refresh' } }
  }])
  assert.deepEqual(local.readEntries('u1')['2026-07-15'].diary, {
    title: 'local-new',
    content: 'kept after refresh'
  })
  assert.deepEqual(local.readOutbox('u1'), {})
})

test('switching users and logout changes the visible local namespace', async () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-13', { diary: { title: '用户一' } })
  local.saveFields('u2', '2026-07-13', { diary: { title: '用户二' } })
  local.saveFields(null, '2026-07-13', { diary: { title: '访客' } })
  const facade = createStoreFacade(local, {
    fetchAll: async () => ({ kind: 'empty', data: {} })
  })

  facade.setActiveUser({ id: 'u1' })
  assert.equal((await facade.getEntry('2026-07-13')).diary.title, '用户一')
  facade.setActiveUser({ id: 'u2' })
  assert.equal((await facade.getEntry('2026-07-13')).diary.title, '用户二')
  facade.setActiveUser(null)
  assert.equal((await facade.getEntry('2026-07-13')).diary.title, '访客')
})

test('maps save outcomes to truthful user messages', () => {
  assert.equal(saveResultMessage({ kind: 'synced' }), '已同步')
  assert.equal(
    saveResultMessage({ kind: 'local-saved-pending' }),
    '已保存到本地，等待网络同步'
  )
  assert.equal(
    saveResultMessage({ kind: 'local-failure' }),
    '本地保存失败，请立即导出备份'
  )
})
