// 打卡模块 — 4 个维度的星级评分 + 备注
import { getEntry, saveEntry } from './store.js'
import { getCurrentUser } from './auth.js'
import { createRenderGuard } from './editor-state.js'
import { showSaveResult } from './utils.js'
import { icon } from './icons.js'

const DIMENSIONS = [
  { key: 'health', label: '健康运动', icon: 'activity' },
  { key: 'learning', label: '学习成长', icon: 'book-open' },
  { key: 'work', label: '工作产出', icon: 'briefcase' },
  { key: 'mood', label: '情绪状态', icon: 'smile' }
]

const renderGuard = createRenderGuard()

export function renderCheckin(container, dateStr) {
  const state = { data: {}, edited: false }
  const token = renderGuard.begin({
    userId: getCurrentUser()?.id ?? null,
    date: dateStr
  })
  container.innerHTML = ''

  DIMENSIONS.forEach(dim => {
    const card = document.createElement('div')
    card.className = 'checkin-card'
    card.innerHTML = `
      <div class="checkin-header">
        <span class="checkin-icon">${icon(dim.icon, 'ui-icon ui-icon-dimension')}</span>
        <span class="checkin-label">${dim.label}</span>
      </div>
      <div class="stars" data-dim="${dim.key}">
        ${[1, 2, 3, 4, 5].map(i => `
          <button class="star" data-value="${i}">★</button>
        `).join('')}
      </div>
      <input class="checkin-note" data-dim="${dim.key}"
             placeholder="备注（可选）" maxlength="100" />
    `
    container.appendChild(card)
  })

  container.querySelectorAll('.stars').forEach(starsEl => {
    starsEl.addEventListener('click', event => {
      const button = event.target.closest('.star')
      if (!button) return
      const dimension = starsEl.dataset.dim
      const value = Number(button.dataset.value)
      state.edited = true
      state.data[dimension] = value
      updateStarsUI(starsEl, value)
      void saveCheckin(dateStr, state.data)
    })
  })

  container.querySelectorAll('.checkin-note').forEach(input => {
    input.addEventListener('change', () => {
      const dimension = input.dataset.dim
      state.edited = true
      state.data.notes ||= {}
      state.data.notes[dimension] = input.value
      void saveCheckin(dateStr, state.data)
    })
  })

  void loadCheckin(container, state, token)
}

function updateStarsUI(starsEl, value) {
  starsEl.querySelectorAll('.star').forEach(button => {
    button.classList.toggle('active', Number(button.dataset.value) <= value)
  })
}

async function loadCheckin(container, state, token) {
  const entry = await getEntry(token.date)
  if (!renderGuard.isCurrent(token) || !container.isConnected || state.edited) return

  state.data = structuredClone(entry?.checkin || {})
  DIMENSIONS.forEach(dimension => {
    const starsEl = container.querySelector(`.stars[data-dim="${dimension.key}"]`)
    if (starsEl && state.data[dimension.key]) {
      updateStarsUI(starsEl, state.data[dimension.key])
    }
    const noteInput = container.querySelector(`.checkin-note[data-dim="${dimension.key}"]`)
    if (noteInput) noteInput.value = state.data.notes?.[dimension.key] || ''
  })
}

async function saveCheckin(dateStr, data) {
  const result = await saveEntry(dateStr, { checkin: structuredClone(data) })
  showSaveResult(result)
}
