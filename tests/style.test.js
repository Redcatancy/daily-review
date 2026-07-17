import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/style.css', import.meta.url), 'utf8')

test('does not apply the purple focus outline to text fields', () => {
  assert.doesNotMatch(css, /input:focus-visible/)
  assert.doesNotMatch(css, /textarea:focus-visible/)
})

test('keeps a visible keyboard focus indicator on buttons', () => {
  assert.match(css, /button:focus-visible/)
  assert.match(css, /outline:\s*2px solid rgba\(108, 92, 231, 0\.72\)/)
})
