// 入口文件 — 初始化应用、管理 Tab 切换和日期导航
import { renderCheckin } from './checkin.js'
import { renderHighlights } from './highlights.js'
import { renderDiary, flushPendingDiarySave } from './diary.js'
import { renderCalendar } from './calendar.js'
import { renderAnalysis } from './analysis.js'
import { formatDate, displayDate, parseDate, showStatus } from './utils.js'
import { icon } from './icons.js'
import { initAuth, onAuthChange, signInWithGitHub, signOut } from './auth.js'
import {
  exportCurrentBackup,
  setActiveUser,
  syncOnLogin
} from './store.js'

let currentDate = new Date()
let activeTab = 'checkin'

function getCurrentDateStr() {
  return formatDate(currentDate)
}

function updateDateDisplay() {
  document.getElementById('current-date').textContent = displayDate(currentDate)
}

async function renderCurrentTab() {
  const dateStr = getCurrentDateStr()

  document.querySelectorAll('.section').forEach(section => section.classList.remove('active'))
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
      await renderCalendar(
        document.getElementById('calendar-section'),
        dateStr,
        async newDateStr => {
          await flushPendingDiarySave()
          currentDate = parseDate(newDateStr)
          updateDateDisplay()
          await switchTab('checkin')
        }
      )
      break
    case 'analysis':
      renderAnalysis(document.getElementById('analysis-section'), dateStr)
      break
  }
}

async function switchTab(tab) {
  await flushPendingDiarySave()
  activeTab = tab
  document.querySelectorAll('.nav-tab').forEach(item => {
    item.classList.toggle('active', item.dataset.tab === tab)
  })
  await renderCurrentTab()
}

function createButton(id, label, className, onClick) {
  const button = document.createElement('button')
  button.id = id
  button.type = 'button'
  button.className = className
  button.textContent = label
  button.addEventListener('click', onClick)
  return button
}

function downloadCurrentBackup() {
  const bundle = exportCurrentBackup()
  const blob = new Blob([JSON.stringify(bundle, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = `daily-review-backup-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  anchor.click()
  setTimeout(() => URL.revokeObjectURL(url), 0)
}

function updateAuthUI(user) {
  const authArea = document.getElementById('auth-area')
  authArea.replaceChildren()

  if (!user) {
    authArea.appendChild(createButton(
      'login-btn',
      'GitHub 登录',
      'auth-btn login',
      () => { void signInWithGitHub() }
    ))
    return
  }

  const userInfo = document.createElement('div')
  userInfo.className = 'user-info'
  const avatarUrl = user.user_metadata?.avatar_url
  if (avatarUrl) {
    const avatar = document.createElement('img')
    avatar.className = 'user-avatar'
    avatar.src = avatarUrl
    avatar.alt = ''
    avatar.referrerPolicy = 'no-referrer'
    userInfo.appendChild(avatar)
  }
  const name = document.createElement('span')
  name.className = 'user-name'
  name.textContent = user.user_metadata?.user_name || user.email || '用户'
  userInfo.appendChild(name)

  const exportButton = createButton(
    'export-backup-btn',
    '导出数据备份',
    'auth-btn login',
    downloadCurrentBackup
  )
  const logoutButton = createButton(
    'logout-btn',
    '退出登录',
    'auth-btn logout',
    async () => {
      await flushPendingDiarySave()
      await signOut()
    }
  )
  authArea.append(userInfo, exportButton, logoutButton)
}

function reportSyncResult(result) {
  if (result?.kind === 'invalid-legacy') {
    showStatus('旧数据已备份但格式异常，请立即导出备份', 5000)
  } else if (result?.kind === 'local-failure') {
    showStatus('本地迁移失败，旧数据保持不变', 5000)
  } else if (result?.kind === 'pending') {
    showStatus('云端暂不可用，本地数据安全保留', 4000)
  } else if (result?.conflicts?.length) {
    showStatus('发现数据冲突，双方版本已保留', 4000)
  }
}

function hydrateStaticIcons() {
  document.querySelectorAll('[data-icon]').forEach(mount => {
    mount.innerHTML = icon(mount.dataset.icon, 'ui-icon ui-icon-nav')
  })
}

async function init() {
  hydrateStaticIcons()
  const user = await initAuth()
  setActiveUser(user)
  updateAuthUI(user)

  if (user) reportSyncResult(await syncOnLogin())

  updateDateDisplay()
  document.querySelectorAll('.nav-tab').forEach(tab => {
    tab.addEventListener('click', () => { void switchTab(tab.dataset.tab) })
  })

  document.getElementById('prev-day').addEventListener('click', async () => {
    await flushPendingDiarySave()
    currentDate.setDate(currentDate.getDate() - 1)
    updateDateDisplay()
    await renderCurrentTab()
  })

  document.getElementById('next-day').addEventListener('click', async () => {
    await flushPendingDiarySave()
    currentDate.setDate(currentDate.getDate() + 1)
    updateDateDisplay()
    await renderCurrentTab()
  })

  document.getElementById('today-btn').addEventListener('click', async () => {
    await flushPendingDiarySave()
    currentDate = new Date()
    updateDateDisplay()
    await renderCurrentTab()
  })

  window.addEventListener('pagehide', () => {
    void flushPendingDiarySave()
  })

  onAuthChange(async newUser => {
    await flushPendingDiarySave()
    setActiveUser(newUser)
    updateAuthUI(newUser)
    if (newUser) reportSyncResult(await syncOnLogin())
    await renderCurrentTab()
  })

  await renderCurrentTab()
}

void init()
