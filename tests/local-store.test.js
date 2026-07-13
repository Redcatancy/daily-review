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
