// 本地存储模块 — 数据存在浏览器 localStorage 中
// 数据格式：localStorage['daily-review'] = { "2026-06-06": { checkin, highlights, diary }, ... }

const STORAGE_KEY = 'daily-review'

// 读取所有数据
function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

// 写入所有数据
function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// 获取某天的数据
export function getEntry(dateStr) {
  const all = readAll()
  return all[dateStr] || null
}

// 保存某天的部分数据（自动合并）
export function saveEntry(dateStr, fields) {
  const all = readAll()
  if (!all[dateStr]) all[dateStr] = {}
  Object.assign(all[dateStr], fields)
  writeAll(all)
}

// 查询某月有数据的日期
export function getMonthDates(year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const all = readAll()
  return Object.keys(all).filter(d => d.startsWith(prefix))
}

// 获取日期范围内的所有数据（返回 [{date, ...data}] 数组，按日期排序）
export function getRange(startDate, endDate) {
  const all = readAll()
  const result = []
  const keys = Object.keys(all).sort()
  for (const key of keys) {
    if (key >= startDate && key <= endDate) {
      result.push({ date: key, ...all[key] })
    }
  }
  return result
}

// 获取所有有数据的日期
export function getAllDates() {
  return Object.keys(readAll()).sort()
}
