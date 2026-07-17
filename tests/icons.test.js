import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { icon } from '../src/icons.js'

test('renders the shared decorative SVG contract', () => {
  const svg = icon('check-circle', 'ui-icon ui-icon-nav')

  assert.match(svg, /^<svg /)
  assert.match(svg, /class="ui-icon ui-icon-nav"/)
  assert.match(svg, /viewBox="0 0 24 24"/)
  assert.match(svg, /fill="none"/)
  assert.match(svg, /stroke="currentColor"/)
  assert.match(svg, /stroke-width="1.8"/)
  assert.match(svg, /stroke-linecap="round"/)
  assert.match(svg, /stroke-linejoin="round"/)
  assert.match(svg, /aria-hidden="true"/)
  assert.match(svg, /focusable="false"/)
})

test('renders every icon required by the approved PC design', () => {
  const names = [
    'check-circle', 'sparkles', 'notebook', 'calendar-days',
    'brain-circuit', 'activity', 'book-open', 'briefcase', 'smile',
    'lightbulb', 'chart-bar', 'trending-up', 'calendar-range',
    'message-circle'
  ]

  for (const name of names) {
    assert.match(icon(name), /<path|<circle|<rect|<polyline|<line/)
  }
})

test('rejects unknown icons and unsafe class names', () => {
  assert.throws(() => icon('missing'), /Unknown icon: missing/)
  assert.throws(
    () => icon('sparkles', 'ui-icon" onclick="alert(1)'),
    /Invalid icon class name/
  )
})

test('functional UI sources use the shared icon system instead of approved Emoji', async () => {
  const files = ['index.html', 'src/checkin.js', 'src/highlights.js', 'src/analysis.js', 'src/quote.js']
  const sources = await Promise.all(files.map(file => readFile(new URL(`../${file}`, import.meta.url), 'utf8')))
  const source = sources.join('\n')

  for (const emoji of ['⭐', '✨', '📝', '📅', '🤖', '🏃', '📚', '💼', '😊', '💡', '📊', '📈', '🗓️', '💬']) {
    assert.equal(source.includes(emoji), false, `functional Emoji remains: ${emoji}`)
  }
  assert.match(sources[0], /data-icon="check-circle"/)
  assert.match(sources[1], /icon\(dim\.icon, 'ui-icon ui-icon-dimension'\)/)
})

test('desktop contrast tokens match the approved palette', async () => {
  const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8')
  assert.match(css, /--text-secondary:\s*#514B57;/)
  assert.match(css, /--text-muted:\s*#6F6875;/)
  assert.match(css, /--accent:\s*#6C5CE7;/)
})
