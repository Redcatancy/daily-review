// 打卡模块 — 4 个维度的星级评分 + 备注
import { getEntry, saveEntry } from './store.js'
import { showStatus } from './utils.js'

const DIMENSIONS = [
  { key: 'health', label: '健康运动', icon: '🏃' },
  { key: 'learning', label: '学习成长', icon: '📚' },
  { key: 'work', label: '工作产出', icon: '💼' },
  { key: 'mood', label: '情绪状态', icon: '😊' }
]

let currentData = {}

export function renderCheckin(container, dateStr) {
  container.innerHTML = ''

  DIMENSIONS.forEach(dim => {
    const card = document.createElement('div')
    card.className = 'checkin-card'
    card.innerHTML = `
      <div class="checkin-header">
        <span class="checkin-icon">${dim.icon}</span>
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
    starsEl.addEventListener('click', (e) => {
      const btn = e.target.closest('.star')
      if (!btn) return
      const dim = starsEl.dataset.dim
      const value = Number(btn.dataset.value)
      currentData[dim] = value
      updateStarsUI(starsEl, value)
      saveCheckin(dateStr)
    })
  })

  container.querySelectorAll('.checkin-note').forEach(input => {
    input.addEventListener('change', () => {
      const dim = input.dataset.dim
      if (!currentData.notes) currentData.notes = {}
      currentData.notes[dim] = input.value
      saveCheckin(dateStr)
    })
  })

  loadCheckin(dateStr)
}

function updateStarsUI(starsEl, value) {
  starsEl.querySelectorAll('.star').forEach(btn => {
    btn.classList.toggle('active', Number(btn.dataset.value) <= value)
  })
}

async function loadCheckin(dateStr) {
  const entry = await getEntry(dateStr)
  const data = entry ? entry.checkin : null
  if (data) {
    currentData = data
    DIMENSIONS.forEach(dim => {
      const starsEl = document.querySelector(`.stars[data-dim="${dim.key}"]`)
      if (starsEl && currentData[dim.key]) {
        updateStarsUI(starsEl, currentData[dim.key])
      }
      const noteInput = document.querySelector(`.checkin-note[data-dim="${dim.key}"]`)
      if (noteInput && currentData.notes && currentData.notes[dim.key]) {
        noteInput.value = currentData.notes[dim.key]
      }
    })
  } else {
    currentData = {}
    resetUI()
  }
}

function resetUI() {
  document.querySelectorAll('.stars').forEach(el => {
    el.querySelectorAll('.star').forEach(btn => btn.classList.remove('active'))
  })
  document.querySelectorAll('.checkin-note').forEach(input => { input.value = '' })
}

function saveCheckin(dateStr) {
  saveEntry(dateStr, { checkin: currentData })
  showStatus('打卡已保存')
}
