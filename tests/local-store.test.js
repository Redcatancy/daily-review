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

test('claims the legacy source for only the first confirmed account', () => {
  const storage = new MemoryStorage({ 'daily-review': legacy })
  const local = createLocalStore(storage)
  local.migrateLegacy('user-redcatancy')

  const second = local.migrateLegacy('another-user')

  assert.equal(second.kind, 'claimed-by-other-user')
  assert.deepEqual(local.readEntries('another-user'), {})
  assert.equal(storage.getItem('daily-review'), legacy)
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

test('does not report normal cloud lag as a conflict when the remote baseline is known', () => {
  const local = createLocalStore(new MemoryStorage(), {
    now: () => '2026-07-13T00:00:00.000Z'
  })
  local.mergeRemote('u1', {
    '2026-07-12': {
      diary: { title: 'cloud-old' },
      checkin: { mood: 5 }
    }
  })
  local.saveFields('u1', '2026-07-12', {
    diary: { title: 'local-new' }
  })

  const result = local.mergeRemote('u1', {
    '2026-07-12': {
      diary: { title: 'cloud-old' },
      checkin: { mood: 5 }
    }
  })

  const visible = local.readEntries('u1')['2026-07-12']
  assert.deepEqual(visible.diary, { title: 'local-new' })
  assert.deepEqual(visible.checkin, { mood: 5 })
  assert.deepEqual(result.conflicts, [])
  assert.deepEqual(local.exportBundle('u1').conflicts, [])
  assert.deepEqual(local.readOutbox('u1')['2026-07-12'].diary, { title: 'local-new' })
  assert.deepEqual(local.exportBundle('u1').remoteSnapshot['2026-07-12'].diary, {
    title: 'cloud-old'
  })
})

test('archives both sides without a false warning when upgrading without a baseline', () => {
  const local = createLocalStore(new MemoryStorage(), {
    now: () => '2026-07-13T00:00:00.000Z'
  })
  local.saveFields('u1', '2026-07-12', {
    diary: { title: 'local-new' }
  })

  const result = local.mergeRemote('u1', {
    '2026-07-12': { diary: { title: 'cloud-old' } }
  })

  assert.deepEqual(result.conflicts, [])
  assert.deepEqual(local.readEntries('u1')['2026-07-12'].diary, { title: 'local-new' })
  assert.deepEqual(local.exportBundle('u1').conflicts[0].local, { title: 'local-new' })
  assert.deepEqual(local.exportBundle('u1').conflicts[0].remote, { title: 'cloud-old' })
})

test('reports a genuine conflict when the cloud diverges from the known baseline', () => {
  const local = createLocalStore(new MemoryStorage(), {
    now: () => '2026-07-13T00:00:00.000Z'
  })
  local.mergeRemote('u1', {
    '2026-07-12': { diary: { title: 'shared-base' } }
  })
  local.saveFields('u1', '2026-07-12', {
    diary: { title: 'local-new' }
  })

  const result = local.mergeRemote('u1', {
    '2026-07-12': { diary: { title: 'remote-new' } }
  })

  assert.equal(result.conflicts.length, 1)
  assert.deepEqual(result.conflicts[0].local, { title: 'local-new' })
  assert.deepEqual(result.conflicts[0].remote, { title: 'remote-new' })
  assert.deepEqual(local.readEntries('u1')['2026-07-12'].diary, { title: 'local-new' })
})

test('refreshes a non-pending local cache from the cloud without a conflict', () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-12', {
    diary: { title: 'previous-cache' }
  }, { queue: false })

  const result = local.mergeRemote('u1', {
    '2026-07-12': { diary: { title: 'cloud-current' } }
  })

  assert.deepEqual(local.readEntries('u1')['2026-07-12'].diary, {
    title: 'cloud-current'
  })
  assert.deepEqual(result.conflicts, [])
})

test('acknowledges only fields confirmed by the cloud', () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-13', { diary: null, checkin: { mood: 4 } })
  local.ackOutbox('u1', '2026-07-13', ['diary'])
  assert.deepEqual(local.readOutbox('u1')['2026-07-13'], { checkin: { mood: 4 } })
})

test('an older upload acknowledgement cannot clear a newer queued value', () => {
  const local = createLocalStore(new MemoryStorage())
  local.saveFields('u1', '2026-07-13', {
    diary: { title: 'first edit' }
  })
  local.saveFields('u1', '2026-07-13', {
    diary: { title: 'newer edit' }
  })

  local.ackUploaded('u1', '2026-07-13', {
    diary: { title: 'first edit' }
  })

  assert.deepEqual(local.readOutbox('u1')['2026-07-13'].diary, {
    title: 'newer edit'
  })
  assert.deepEqual(local.readRemoteSnapshot('u1')['2026-07-13'].diary, {
    title: 'first edit'
  })
})
