// 日历模块 — 月历展示，高亮有数据的日期，顶部展示每日语录
import { getEntry } from './store.js'
import { formatDate, parseDate } from './utils.js'
import { getDailyQuote, renderQuote } from './quote.js'

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

export function getCalendarPreviewText(entry) {
  return entry?.diary?.title?.trim() || ''
}

async function buildPreview(dateStr) {
  const entry = await getEntry(dateStr)
  if (!entry) return { moodColor: '', previewText: '' }

  let moodColor = ''
  if (entry.checkin) {
    const dims = ['health', 'learning', 'work', 'mood']
    const scores = dims.map(d => entry.checkin[d] || 0).filter(s => s > 0)
    if (scores.length > 0) {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      if (avg >= 4) moodColor = '#00B894'
      else if (avg >= 3) moodColor = '#FECA57'
      else if (avg >= 2) moodColor = '#E17055'
      else moodColor = '#D63031'
    }
  }

  const previewText = getCalendarPreviewText(entry)

  return { moodColor, previewText }
}

export async function renderCalendar(container, currentDateStr, onDateClick) {
  const today = new Date()
  const current = parseDate(currentDateStr)
  const year = current.getFullYear()
  const month = current.getMonth()

  const firstDay = new Date(year, month, 1)
  const lastDay = new Date(year, month + 1, 0)
  const startWeekday = firstDay.getDay()
  const totalDays = lastDay.getDate()

  const weekDays = ['日', '一', '二', '三', '四', '五', '六']

  let html = `
    <div class="calendar">
      <div id="daily-quote-container"></div>
      <div class="calendar-header">
        <button class="nav-btn" id="cal-prev">&lt;</button>
        <span class="calendar-month">${year}年${month + 1}月</span>
        <button class="nav-btn" id="cal-next">&gt;</button>
      </div>
      <div class="calendar-weekdays">
        ${weekDays.map(d => `<span>${d}</span>`).join('')}
      </div>
      <div class="calendar-grid">
  `

  for (let i = 0; i < startWeekday; i++) {
    html += '<span class="calendar-day empty"></span>'
  }

  for (let d = 1; d <= totalDays; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
    const isToday = dateStr === formatDate(today)
    const isSelected = dateStr === currentDateStr
    const classes = ['calendar-day']
    if (isToday) classes.push('today')
    if (isSelected) classes.push('selected')

    const { moodColor, previewText } = await buildPreview(dateStr)
    if (moodColor || previewText) classes.push('has-data')

    const moodHtml = moodColor ? `<span class="day-mood" style="background:${moodColor}"></span>` : ''
    const previewHtml = previewText ? `<span class="day-preview">${escapeHtml(previewText)}</span>` : ''

    html += `<div class="${classes.join(' ')}" data-date="${dateStr}"><span class="day-num">${d}</span>${moodHtml}${previewHtml}</div>`
  }

  html += '</div></div>'
  container.innerHTML = html

  container.querySelectorAll('.calendar-day:not(.empty)').forEach(el => {
    el.addEventListener('click', () => onDateClick(el.dataset.date))
  })

  document.getElementById('cal-prev').addEventListener('click', () => {
    onDateClick(formatDate(new Date(year, month - 1, 1)))
  })
  document.getElementById('cal-next').addEventListener('click', () => {
    onDateClick(formatDate(new Date(year, month + 1, 1)))
  })

  // 加载每日语录
  const quoteContainer = document.getElementById('daily-quote-container')
  getDailyQuote(formatDate(today)).then(quote => renderQuote(quoteContainer, quote))
}
