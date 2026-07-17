// 每日语录模块 — 通过一言API获取，按日缓存
import { icon } from './icons.js'

const QUOTE_CACHE_KEY = 'daily-quote-cache'

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(QUOTE_CACHE_KEY)) || {}
  } catch {
    return {}
  }
}

function writeCache(data) {
  localStorage.setItem(QUOTE_CACHE_KEY, JSON.stringify(data))
}

export async function getDailyQuote(dateStr) {
  const cache = readCache()
  if (cache[dateStr]) return cache[dateStr]

  try {
    const resp = await fetch('https://v1.hitokoto.cn/?c=d&c=h&c=i&c=k&encode=json')
    if (!resp.ok) throw new Error('API error')
    const data = await resp.json()
    const quote = {
      text: data.hitokoto,
      from: data.from || '',
      fromWho: data.from_who || ''
    }
    cache[dateStr] = quote
    writeCache(cache)
    return quote
  } catch {
    return null
  }
}

export function renderQuote(container, quote) {
  if (!quote) {
    container.innerHTML = `
      <div class="daily-quote">
        <div class="quote-icon">${icon('message-circle', 'ui-icon ui-icon-section')}</div>
        <div class="quote-text quote-failed">语录加载中...</div>
      </div>
    `
    return
  }

  const source = [quote.fromWho, quote.from].filter(Boolean).join(' · ')
  container.innerHTML = `
    <div class="daily-quote">
      <div class="quote-icon">${icon('sparkles', 'ui-icon ui-icon-section')}</div>
      <div class="quote-body">
        <div class="quote-text">${escapeHtml(quote.text)}</div>
        ${source ? `<div class="quote-source">—— ${escapeHtml(source)}</div>` : ''}
      </div>
    </div>
  `
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
