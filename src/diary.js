// 日记模块 — 日记本风格：日期大标题、横线背景、书写仪式感
import { getEntry, saveEntry } from './store.js'
import { debounce, showStatus, parseDate, displayDate } from './utils.js'

const debouncedSave = debounce(saveDiary, 1000)

export function renderDiary(container, dateStr) {
  const date = parseDate(dateStr)
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const weekday = weekDays[date.getDay()]

  container.innerHTML = `
    <div class="notebook">
      <div class="notebook-header">
        <div class="notebook-date-big">${day}</div>
        <div class="notebook-date-info">
          <div class="notebook-month">${year}年${month}月</div>
          <div class="notebook-weekday">${weekday}</div>
        </div>
        <div class="notebook-weather" id="notebook-weather"></div>
      </div>
      <div class="notebook-divider"></div>
      <input id="diary-title" class="notebook-title" placeholder="给今天起个标题..." maxlength="50" />
      <div class="notebook-body">
        <textarea id="diary-content" class="notebook-textarea" placeholder="今天想写点什么..."></textarea>
      </div>
      <div class="notebook-footer">
        <span class="notebook-hint">自动保存中...</span>
      </div>
    </div>
  `

  document.getElementById('diary-title').addEventListener('input', () => debouncedSave(dateStr))
  document.getElementById('diary-content').addEventListener('input', () => debouncedSave(dateStr))
  loadDiary(dateStr)
}

function loadDiary(dateStr) {
  const entry = getEntry(dateStr)
  const data = entry ? entry.diary : null
  const titleInput = document.getElementById('diary-title')
  const contentInput = document.getElementById('diary-content')

  if (data) {
    titleInput.value = data.title || ''
    contentInput.value = data.content || ''
  } else {
    titleInput.value = ''
    contentInput.value = ''
  }
}

function saveDiary(dateStr) {
  const title = document.getElementById('diary-title').value
  const content = document.getElementById('diary-content').value
  if (!title.trim() && !content.trim()) return

  saveEntry(dateStr, {
    diary: { title: title.trim(), content: content.trim() }
  })
  showStatus('日记已自动保存')
}
