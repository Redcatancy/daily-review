// 日记模块 — 日记本风格：日期大标题、横线背景、书写仪式感
import { getEntry, saveEntry } from './store.js'
import { getCurrentUser } from './auth.js'
import { createCapturedDebounce, createRenderGuard } from './editor-state.js'
import { showStatus, parseDate } from './utils.js'

const renderGuard = createRenderGuard()
let pendingDiary = null

export async function flushPendingDiarySave() {
  return pendingDiary?.flush()
}

export function renderDiary(container, dateStr) {
  void flushPendingDiarySave()

  const date = parseDate(dateStr)
  const weekDays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六']
  const token = renderGuard.begin({
    userId: getCurrentUser()?.id ?? null,
    date: dateStr
  })
  const state = { edited: false }

  container.innerHTML = `
    <div class="notebook">
      <div class="notebook-header">
        <div class="notebook-date-big">${date.getDate()}</div>
        <div class="notebook-date-info">
          <div class="notebook-month">${date.getFullYear()}年${date.getMonth() + 1}月</div>
          <div class="notebook-weekday">${weekDays[date.getDay()]}</div>
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

  const titleInput = container.querySelector('#diary-title')
  const contentInput = container.querySelector('#diary-content')
  pendingDiary = createCapturedDebounce(saveCapturedDiary, 1000)

  function scheduleSave() {
    state.edited = true
    pendingDiary.schedule({
      date: dateStr,
      title: titleInput.value,
      content: contentInput.value
    })
  }

  titleInput.addEventListener('input', scheduleSave)
  contentInput.addEventListener('input', scheduleSave)

  void getEntry(dateStr).then(entry => {
    if (!renderGuard.isCurrent(token) || !container.isConnected || state.edited) return
    titleInput.value = entry?.diary?.title || ''
    contentInput.value = entry?.diary?.content || ''
  })
}

async function saveCapturedDiary({ date, title, content }) {
  const diary = title.trim() || content.trim()
    ? { title: title.trim(), content: content.trim() }
    : null
  const result = await saveEntry(date, { diary })
  showStatus(result.kind === 'local-failure' ? '日记保存失败' : '日记已自动保存')
  return result
}
