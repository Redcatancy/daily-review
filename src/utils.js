// 工具函数

// 格式化日期为 YYYY-MM-DD
export function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

// 解析 YYYY-MM-DD 为 Date 对象
export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number)
  return new Date(y, m - 1, d)
}

// 格式化显示日期：6月6日 周五
export function displayDate(date) {
  const weekDays = ['日', '一', '二', '三', '四', '五', '六']
  const m = date.getMonth() + 1
  const d = date.getDate()
  const w = weekDays[date.getDay()]
  return `${m}月${d}日 周${w}`
}

// 防抖函数
export function debounce(fn, delay = 500) {
  let timer = null
  return function (...args) {
    clearTimeout(timer)
    timer = setTimeout(() => fn.apply(this, args), delay)
  }
}

// 显示状态提示
export function showStatus(message, duration = 2000) {
  const bar = document.getElementById('status-bar')
  bar.textContent = message
  bar.classList.add('visible')
  setTimeout(() => bar.classList.remove('visible'), duration)
}
