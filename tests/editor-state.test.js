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
    setTimer: fn => {
      scheduled = fn
      return 1
    },
    clearTimer: () => {
      scheduled = null
    }
  })

  debounce.schedule({ date: '2026-07-12', title: 'A', content: 'B' })
  await debounce.flush()

  assert.deepEqual(calls, [{ date: '2026-07-12', title: 'A', content: 'B' }])
  assert.equal(scheduled, null)
})
