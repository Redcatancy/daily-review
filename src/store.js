// 本地存储 + Supabase 云同步模块
// localStorage 作为即时缓存，Supabase 作为云端持久化

import { supabase } from './supabase.js'
import { getCurrentUser } from './auth.js'

const STORAGE_KEY = 'daily-review'

// ===== localStorage 操作 =====

function readAll() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}
  } catch {
    return {}
  }
}

function writeAll(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ===== Supabase 操作 =====

async function fetchFromSupabase() {
  const user = getCurrentUser()
  if (!user) return null
  const { data, error } = await supabase
    .from('daily_entries')
    .select('date, checkin, highlights, diary')
    .eq('user_id', user.id)
  if (error) {
    console.error('云端读取失败:', error.message)
    return null
  }
  const result = {}
  for (const row of data) {
    result[row.date] = {
      checkin: row.checkin,
      highlights: row.highlights,
      diary: row.diary
    }
  }
  return result
}

async function upsertToSupabase(dateStr, fields) {
  const user = getCurrentUser()
  if (!user) return
  const { error } = await supabase
    .from('daily_entries')
    .upsert(
      { user_id: user.id, date: dateStr, ...fields, updated_at: new Date().toISOString() },
      { onConflict: 'user_id,date' }
    )
  if (error) console.error('云端保存失败:', error.message)
}

async function uploadAllToSupabase() {
  const user = getCurrentUser()
  if (!user) return
  const localData = readAll()
  const rows = Object.entries(localData).map(([date, entry]) => ({
    user_id: user.id,
    date,
    checkin: entry.checkin || null,
    highlights: entry.highlights || null,
    diary: entry.diary || null,
    updated_at: new Date().toISOString()
  }))
  if (rows.length === 0) return
  const { error } = await supabase
    .from('daily_entries')
    .upsert(rows, { onConflict: 'user_id,date' })
  if (error) console.error('批量上传失败:', error.message)
  else console.log(`已上传 ${rows.length} 条记录到云端`)
}

// ===== 首次登录同步 =====
// 检测 Supabase 是否有数据，没有则将 localStorage 上传

let synced = false
export async function syncOnLogin() {
  if (synced) return
  const user = getCurrentUser()
  if (!user) return
  const remote = await fetchFromSupabase()
  if (remote && Object.keys(remote).length > 0) {
    // 云端有数据，合并到本地（云端覆盖本地同日数据）
    const local = readAll()
    const merged = { ...local, ...remote }
    writeAll(merged)
  } else {
    // 云端无数据，把本地数据上传
    await uploadAllToSupabase()
  }
  synced = true
}

// ===== 导出 API（保持原有接口不变）=====

export async function getEntry(dateStr) {
  const user = getCurrentUser()
  if (user) {
    // 已登录：从 Supabase 读取单条
    const { data, error } = await supabase
      .from('daily_entries')
      .select('checkin, highlights, diary')
      .eq('user_id', user.id)
      .eq('date', dateStr)
      .maybeSingle()
    if (!error && data) {
      // 同步到本地缓存
      const all = readAll()
      all[dateStr] = data
      writeAll(all)
      return data
    }
  }
  // 未登录或云端无数据：读本地
  return readAll()[dateStr] || null
}

export async function saveEntry(dateStr, fields) {
  // 先写本地（即时生效）
  const all = readAll()
  if (!all[dateStr]) all[dateStr] = {}
  Object.assign(all[dateStr], fields)
  writeAll(all)
  // 再同步云端（后台）
  await upsertToSupabase(dateStr, fields)
}

export async function getRange(startDate, endDate) {
  const all = getCurrentUser() ? await fetchAllLocalOrRemote() : readAll()
  const result = []
  const keys = Object.keys(all).sort()
  for (const key of keys) {
    if (key >= startDate && key <= endDate) {
      result.push({ date: key, ...all[key] })
    }
  }
  return result
}

export async function getMonthDates(year, month) {
  const prefix = `${year}-${String(month + 1).padStart(2, '0')}`
  const all = getCurrentUser() ? await fetchAllLocalOrRemote() : readAll()
  return Object.keys(all).filter(d => d.startsWith(prefix))
}

export async function getAllDates() {
  const all = getCurrentUser() ? await fetchAllLocalOrRemote() : readAll()
  return Object.keys(all).sort()
}

// 辅助：已登录时优先从云端获取全量，否则用本地
async function fetchAllLocalOrRemote() {
  const remote = await fetchFromSupabase()
  if (remote && Object.keys(remote).length > 0) {
    writeAll(remote)
    return remote
  }
  return readAll()
}
