// AI 分析模块：根据左侧选中日期生成可复制的分析提示词
import { getRange, getEntry } from './store.js'
import { showStatus } from './utils.js'
import { icon } from './icons.js'
import {
  buildAnalysisPrompt,
  getAnalysisRange,
  hasAnalysisData
} from './analysis-core.js'

const TYPES = [
  {
    type: 'daily',
    icon: 'chart-bar',
    title: '当日分析',
    purpose: '问题诊断与次日行动'
  },
  {
    type: 'weekly',
    icon: 'trending-up',
    title: '所在周总结',
    purpose: '趋势、重复问题与下周计划'
  },
  {
    type: 'monthly',
    icon: 'calendar-range',
    title: '所在月回顾',
    purpose: '阶段变化、深层问题与下月策略'
  }
]

function rangeText(type, range) {
  return type === 'daily' ? range.start : `${range.start} 至 ${range.end}`
}

async function readEntries(type, range) {
  if (type === 'daily') {
    const entry = await getEntry(range.start)
    return entry && hasAnalysisData(entry) ? [{ date: range.start, ...entry }] : []
  }
  return (await getRange(range.start, range.end)).filter(hasAnalysisData)
}

export function renderAnalysis(container, dateStr) {
  const cards = TYPES.map(item => {
    const range = getAnalysisRange(item.type, dateStr)
    return `
      <div class="analysis-card" data-type="${item.type}">
        <div class="analysis-card-icon">${icon(item.icon, 'ui-icon ui-icon-analysis')}</div>
        <div class="analysis-card-title">${item.title}</div>
        <div class="analysis-card-desc">${rangeText(item.type, range)}<br>${item.purpose}</div>
        <button class="analysis-btn">生成提示词</button>
      </div>
    `
  }).join('')

  container.innerHTML = `
    <div class="analysis-section">
      <div class="analysis-cards">${cards}</div>
      <div class="prompt-output hidden">
        <div class="prompt-header">
          <span class="prompt-title">分析提示词</span>
          <div class="prompt-actions">
            <button class="prompt-action-btn" data-action="copy">复制到剪贴板</button>
            <button class="prompt-action-btn secondary" data-action="close">关闭</button>
          </div>
        </div>
        <div class="prompt-text"></div>
        <div class="prompt-hint">复制上方提示词，粘贴到你使用的 AI 工具中</div>
      </div>
    </div>
  `

  container.querySelectorAll('.analysis-card').forEach(card => {
    card.querySelector('.analysis-btn').addEventListener('click', () => {
      void generatePrompt(card.dataset.type, dateStr, container)
    })
  })

  container.querySelector('[data-action="copy"]').addEventListener('click', () => {
    const text = container.querySelector('.prompt-text').textContent
    navigator.clipboard.writeText(text).then(() => {
      showStatus('已复制到剪贴板')
    }).catch(() => {
      showStatus('复制失败，请手动选择复制')
    })
  })

  container.querySelector('[data-action="close"]').addEventListener('click', () => {
    container.querySelector('.prompt-output').classList.add('hidden')
  })
}

async function generatePrompt(type, dateStr, container) {
  const range = getAnalysisRange(type, dateStr)
  const entries = await readEntries(type, range)

  if (entries.length === 0) {
    showStatus(`${rangeText(type, range)} 暂无复盘数据`)
    return
  }

  const output = container.querySelector('.prompt-output')
  container.querySelector('.prompt-title').textContent = `分析提示词 · ${rangeText(type, range)}`
  container.querySelector('.prompt-text').textContent = buildAnalysisPrompt(type, entries, range)
  output.classList.remove('hidden')
  output.scrollIntoView({ behavior: 'smooth' })
}
