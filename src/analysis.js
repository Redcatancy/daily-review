// AI 分析模块 — 生成提示词供用户复制到 AI 工具分析
import { getRange, getEntry } from './store.js'
import { formatDate, showStatus } from './utils.js'

const DIM_LABELS = { health: '健康运动', learning: '学习成长', work: '工作产出', mood: '情绪状态' }

// 获取今天的日期字符串
function today() { return formatDate(new Date()) }

// 获取本周的起止日期（周一到周日）
function getWeekRange() {
  const now = new Date()
  const day = now.getDay() || 7
  const monday = new Date(now)
  monday.setDate(now.getDate() - day + 1)
  return { start: formatDate(monday), end: formatDate(now) }
}

// 获取本月的起止日期
function getMonthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  return {
    start: `${y}-${String(m + 1).padStart(2, '0')}-01`,
    end: formatDate(now)
  }
}

// 将打卡数据格式化为可读文本
function formatCheckin(checkin) {
  if (!checkin) return '无打卡数据'
  const parts = []
  for (const [key, label] of Object.entries(DIM_LABELS)) {
    const score = checkin[key]
    if (score) {
      const stars = '★'.repeat(score) + '☆'.repeat(5 - score)
      let text = `  ${label}: ${stars} (${score}/5)`
      if (checkin.notes && checkin.notes[key]) text += ` — ${checkin.notes[key]}`
      parts.push(text)
    }
  }
  return parts.length > 0 ? parts.join('\n') : '无打卡数据'
}

// 将亮点/改进格式化为可读文本
function formatHighlights(hl) {
  if (!hl) return '无记录'
  let text = ''
  if (hl.wins && hl.wins.length > 0 && hl.wins.some(w => w.trim())) {
    text += '  亮点:\n' + hl.wins.filter(w => w.trim()).map(w => `    - ${w}`).join('\n')
  }
  if (hl.improves && hl.improves.length > 0 && hl.improves.some(w => w.trim())) {
    if (text) text += '\n'
    text += '  改进:\n' + hl.improves.filter(w => w.trim()).map(w => `    - ${w}`).join('\n')
  }
  return text || '无记录'
}

// 将日记格式化为可读文本
function formatDiary(diary) {
  if (!diary || (!diary.title && !diary.content)) return '无日记'
  let text = ''
  if (diary.title) text += `  标题: ${diary.title}\n`
  if (diary.content) text += `  内容: ${diary.content}`
  return text
}

// 将一条完整记录格式化为文本
function formatEntry(entry) {
  let text = `【${entry.date}】\n`
  text += `打卡:\n${formatCheckin(entry.checkin)}\n`
  text += `亮点与改进:\n${formatHighlights(entry.highlights)}\n`
  text += `日记:\n${formatDiary(entry.diary)}`
  return text
}

// 生成提示词
function buildPrompt(type, entries) {
  if (entries.length === 0) return null

  const dataText = entries.map(formatEntry).join('\n\n---\n\n')

  const prompts = {
    daily: `你是一位善于洞察的个人成长教练。以下是我今天（${today()}）的每日复盘记录。请帮我：

1. **综合分析**：分析我今天的打卡评分、亮点和改进，找出做得好的地方和需要注意的模式
2. **明日行动清单**：基于今天的改进项和整体状态，给出 3-5 个具体的、可执行的明天行动建议
3. **鼓励与提醒**：给我一句简短的鼓励，以及一个需要注意的点

请用温暖、简洁的中文回复，像一位好朋友给的建议。

我的复盘数据：
${dataText}`,

    weekly: `你是一位善于洞察的个人成长教练。以下是我本周的每日复盘记录。请帮我：

1. **本周总结**：总结本周的整体表现，分析打卡评分的变化趋势，找出亮点和反复出现的问题
2. **模式识别**：从数据和日记中发现规律（比如哪些方面持续好/持续差，情绪和效率的关联等）
3. **下周行动清单**：给出 5 个具体的、可执行的下周行动建议，要基于本周的实际情况
4. **一句话周评**：用一句话总结这一周

请用温暖、简洁的中文回复，像一位好朋友给的建议。

我本周的复盘数据：
${dataText}`,

    monthly: `你是一位善于洞察的个人成长教练。以下是我本月的每日复盘记录。请帮我：

1. **月度总结**：总结本月的整体表现，分析各维度评分的月度趋势
2. **成长回顾**：对比月初和月末的状态，看看哪些方面有进步，哪些需要继续努力
3. **深度洞察**：从一个月的数据中发现深层规律和模式
4. **下月目标建议**：给出 3-5 个具体的下月成长目标和行动建议
5. **月度一句话**：用一句话总结这个月

请用温暖、简洁的中文回复，像一位好朋友给的建议。

我本月的复盘数据：
${dataText}`
  }

  return prompts[type]
}

// 渲染分析模块
export function renderAnalysis(container, dateStr) {
  container.innerHTML = `
    <div class="analysis-section">
      <div class="analysis-cards">
        <div class="analysis-card" data-type="daily">
          <div class="analysis-card-icon">📊</div>
          <div class="analysis-card-title">今日分析</div>
          <div class="analysis-card-desc">分析今天的复盘数据，给出明日行动建议</div>
          <button class="analysis-btn">生成提示词</button>
        </div>
        <div class="analysis-card" data-type="weekly">
          <div class="analysis-card-icon">📈</div>
          <div class="analysis-card-title">本周总结</div>
          <div class="analysis-card-desc">回顾本周复盘，发现规律，制定下周计划</div>
          <button class="analysis-btn">生成提示词</button>
        </div>
        <div class="analysis-card" data-type="monthly">
          <div class="analysis-card-icon">🗓️</div>
          <div class="analysis-card-title">月度回顾</div>
          <div class="analysis-card-desc">深度分析本月成长，制定下月目标</div>
          <button class="analysis-btn">生成提示词</button>
        </div>
      </div>

      <div id="prompt-output" class="prompt-output hidden">
        <div class="prompt-header">
          <span class="prompt-title">分析提示词</span>
          <div class="prompt-actions">
            <button id="copy-prompt" class="prompt-action-btn">复制到剪贴板</button>
            <button id="close-prompt" class="prompt-action-btn secondary">关闭</button>
          </div>
        </div>
        <div id="prompt-text" class="prompt-text"></div>
        <div class="prompt-hint">
          复制上方提示词，粘贴到 ChatGPT、Claude 或其他 AI 工具中，即可获得分析结果
        </div>
      </div>
    </div>
  `

  // 绑定按钮事件
  container.querySelectorAll('.analysis-card').forEach(card => {
    card.querySelector('.analysis-btn').addEventListener('click', () => {
      const type = card.dataset.type
      generatePrompt(type)
    })
  })

  document.getElementById('copy-prompt').addEventListener('click', () => {
    const text = document.getElementById('prompt-text').textContent
    navigator.clipboard.writeText(text).then(() => {
      showStatus('已复制到剪贴板，去 AI 工具中粘贴吧')
    }).catch(() => {
      showStatus('复制失败，请手动选择复制')
    })
  })

  document.getElementById('close-prompt').addEventListener('click', () => {
    document.getElementById('prompt-output').classList.add('hidden')
  })
}

// 生成提示词
function generatePrompt(type) {
  let entries = []

  if (type === 'daily') {
    const data = getEntry(today())
    entries = data ? [{ date: today(), ...data }] : []
  } else if (type === 'weekly') {
    const { start, end } = getWeekRange()
    entries = getRange(start, end)
  } else if (type === 'monthly') {
    const { start, end } = getMonthRange()
    entries = getRange(start, end)
  }

  if (entries.length === 0) {
    showStatus('该时间段暂无复盘数据')
    return
  }

  const prompt = buildPrompt(type, entries)
  const outputEl = document.getElementById('prompt-output')
  const textEl = document.getElementById('prompt-text')

  textEl.textContent = prompt
  outputEl.classList.remove('hidden')
  outputEl.scrollIntoView({ behavior: 'smooth' })
}
