// 每日亮点 / 改进模块
import { getEntry, saveEntry } from './store.js'
import { showStatus } from './utils.js'

let currentData = { wins: [], improves: [] }

export function renderHighlights(container, dateStr) {
  container.innerHTML = `
    <div class="highlights-group">
      <h3 class="highlights-title">✨ 今日亮点</h3>
      <div id="wins-list" class="highlights-list"></div>
      <button id="add-win" class="btn-add">+ 添加亮点</button>
    </div>
    <div class="highlights-group">
      <h3 class="highlights-title">💡 明日改进</h3>
      <div id="improves-list" class="highlights-list"></div>
      <button id="add-improve" class="btn-add">+ 添加改进</button>
    </div>
  `

  document.getElementById('add-win').addEventListener('click', () => addEntry('wins', dateStr))
  document.getElementById('add-improve').addEventListener('click', () => addEntry('improves', dateStr))
  loadHighlights(dateStr)
}

function addEntry(type, dateStr) {
  currentData[type].push('')
  renderList(type, dateStr)
  const inputs = document.querySelectorAll(`#${type}-list .highlight-input`)
  if (inputs.length > 0) inputs[inputs.length - 1].focus()
}

function removeEntry(type, index, dateStr) {
  currentData[type].splice(index, 1)
  renderList(type, dateStr)
  saveHighlights(dateStr)
}

function renderList(type, dateStr) {
  const listEl = document.getElementById(`${type}-list`)
  listEl.innerHTML = ''

  currentData[type].forEach((text, i) => {
    const item = document.createElement('div')
    item.className = 'highlight-item'
    item.innerHTML = `
      <input class="highlight-input" value="${text.replace(/"/g, '&quot;')}"
             placeholder="${type === 'wins' ? '做得好的事...' : '可以改进的事...'}" />
      <button class="btn-delete">&times;</button>
    `
    item.querySelector('.highlight-input').addEventListener('change', (e) => {
      currentData[type][i] = e.target.value
      saveHighlights(dateStr)
    })
    item.querySelector('.btn-delete').addEventListener('click', () => {
      removeEntry(type, i, dateStr)
    })
    listEl.appendChild(item)
  })
}

function loadHighlights(dateStr) {
  const entry = getEntry(dateStr)
  const data = entry ? entry.highlights : null
  if (data) {
    currentData = { wins: data.wins || [], improves: data.improves || [] }
  } else {
    currentData = { wins: [], improves: [] }
  }
  renderList('wins', dateStr)
  renderList('improves', dateStr)
}

function saveHighlights(dateStr) {
  saveEntry(dateStr, { highlights: currentData })
  showStatus('已保存')
}
