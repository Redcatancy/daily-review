// 每日亮点 / 改进模块
import { getEntry, saveEntry } from './store.js'
import { getCurrentUser } from './auth.js'
import { createRenderGuard } from './editor-state.js'
import { showStatus } from './utils.js'

const renderGuard = createRenderGuard()

export function renderHighlights(container, dateStr) {
  const state = {
    data: { wins: [], improves: [] },
    edited: false
  }
  const token = renderGuard.begin({
    userId: getCurrentUser()?.id ?? null,
    date: dateStr
  })

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

  function saveHighlights() {
    return saveEntry(dateStr, { highlights: structuredClone(state.data) })
      .then(result => {
        showStatus(result.kind === 'local-failure' ? '保存失败' : '已保存')
        return result
      })
  }

  function renderList(type) {
    const list = container.querySelector(`#${type}-list`)
    if (!list) return
    list.innerHTML = ''

    state.data[type].forEach((text, index) => {
      const item = document.createElement('div')
      item.className = 'highlight-item'

      const input = document.createElement('input')
      input.className = 'highlight-input'
      input.value = text
      input.placeholder = type === 'wins' ? '做得好的事...' : '可以改进的事...'
      input.addEventListener('change', event => {
        state.edited = true
        state.data[type][index] = event.target.value
        void saveHighlights()
      })

      const removeButton = document.createElement('button')
      removeButton.className = 'btn-delete'
      removeButton.innerHTML = '&times;'
      removeButton.addEventListener('click', () => {
        state.edited = true
        state.data[type].splice(index, 1)
        renderList(type)
        void saveHighlights()
      })

      item.append(input, removeButton)
      list.appendChild(item)
    })
  }

  function addEntry(type) {
    state.edited = true
    state.data[type].push('')
    renderList(type)
    const inputs = container.querySelectorAll(`#${type}-list .highlight-input`)
    inputs[inputs.length - 1]?.focus()
  }

  container.querySelector('#add-win').addEventListener('click', () => addEntry('wins'))
  container.querySelector('#add-improve').addEventListener('click', () => addEntry('improves'))

  void getEntry(dateStr).then(entry => {
    if (!renderGuard.isCurrent(token) || !container.isConnected || state.edited) return
    const data = entry?.highlights
    state.data = data
      ? { wins: [...(data.wins || [])], improves: [...(data.improves || [])] }
      : { wins: [], improves: [] }
    renderList('wins')
    renderList('improves')
  })
}
