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
    {
      data: [
        { date: '2026-07-12', checkin: null, highlights: null, diary: { title: 'A' } },
        { date: '2026-07-13', checkin: { mood: 5 }, highlights: null, diary: null }
      ],
      error: null
    },
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
  const empty = await createCloudStore(
    readClient([{ data: [], error: null }])
  ).fetchAll('u1')
  assert.deepEqual(empty, { kind: 'empty', data: {} })

  const error = new Error('denied')
  const failed = await createCloudStore(
    readClient([{ data: null, error }])
  ).fetchAll('u1')
  assert.deepEqual(failed, { kind: 'failure', error })
})

test('returns structured upsert results without throwing', async () => {
  const writeClient = error => ({
    from: () => ({ upsert: async () => ({ error }) })
  })
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

test('converts rejected network requests into failure results', async () => {
  const error = new Error('network down')
  const readFailure = {
    from: () => ({
      select() { return this },
      eq() { return this },
      order() { return this },
      range: async () => { throw error }
    })
  }
  assert.deepEqual(
    await createCloudStore(readFailure).fetchAll('u1'),
    { kind: 'failure', error }
  )

  const writeFailure = {
    from: () => ({ upsert: async () => { throw error } })
  }
  assert.deepEqual(
    await createCloudStore(writeFailure).upsertFields('u1', '2026-07-13', { diary: null }),
    { kind: 'failure', error }
  )
})
