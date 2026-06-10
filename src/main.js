// 入口文件 — 初始化应用、管理 Tab 切换和日期导航
import { renderCheckin } from './checkin.js'
import { renderHighlights } from './highlights.js'
import { renderDiary } from './diary.js'
import { renderCalendar } from './calendar.js'
import { renderAnalysis } from './analysis.js'
import { formatDate, displayDate, parseDate } from './utils.js'

let currentDate = new Date()
let activeTab = 'checkin'

function getCurrentDateStr() {
  return formatDate(currentDate)
}

function updateDateDisplay() {
  document.getElementById('current-date').textContent = displayDate(currentDate)
}

function renderCurrentTab() {
  const dateStr = getCurrentDateStr()

  document.querySelectorAll('.section').forEach(s => s.classList.remove('active'))
  document.getElementById(`${activeTab}-section`).classList.add('active')

  switch (activeTab) {
    case 'checkin':
      renderCheckin(document.getElementById('checkin-section'), dateStr)
      break
    case 'highlights':
      renderHighlights(document.getElementById('highlights-section'), dateStr)
      break
    case 'diary':
      renderDiary(document.getElementById('diary-section'), dateStr)
      break
    case 'calendar':
      renderCalendar(document.getElementById('calendar-section'), dateStr, (newDateStr) => {
        currentDate = parseDate(newDateStr)
        updateDateDisplay()
        switchTab('checkin')
      })
      break
    case 'analysis':
      renderAnalysis(document.getElementById('analysis-section'), dateStr)
      break
  }
}

function switchTab(tab) {
  activeTab = tab
  document.querySelectorAll('.nav-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tab)
  })
  renderCurrentTab()
}

function init() {
  updateDateDisplay()

  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab))
  })

  document.getElementById('prev-day').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() - 1)
    updateDateDisplay()
    renderCurrentTab()
  })

  document.getElementById('next-day').addEventListener('click', () => {
    currentDate.setDate(currentDate.getDate() + 1)
    updateDateDisplay()
    renderCurrentTab()
  })

  document.getElementById('today-btn').addEventListener('click', () => {
    currentDate = new Date()
    updateDateDisplay()
    renderCurrentTab()
  })

  renderCurrentTab()
}

init()
