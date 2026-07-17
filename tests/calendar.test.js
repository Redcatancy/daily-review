import test from 'node:test'
import assert from 'node:assert/strict'
import { getCalendarPreviewText } from '../src/calendar.js'

test('uses the diary title as the calendar preview', () => {
  assert.equal(getCalendarPreviewText({
    diary: { title: 'Main title', content: 'Core diary content' },
    highlights: { wins: ['Highlight body'], improves: [] }
  }), 'Main title')
})

test('does not expose highlights or diary body content in the calendar', () => {
  assert.equal(getCalendarPreviewText({
    diary: { title: '', content: 'Core diary content' },
    highlights: { wins: ['Highlight body'], improves: ['Improvement body'] }
  }), '')
  assert.equal(getCalendarPreviewText({
    highlights: { wins: ['Highlight body'], improves: [] }
  }), '')
})
