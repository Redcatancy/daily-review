import { formatDate, parseDate } from './utils.js'

const DIM_LABELS = {
  health: '健康运动',
  learning: '学习成长',
  work: '工作产出',
  mood: '情绪状态'
}

function addDays(date, days) {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function hasText(value) {
  return typeof value === 'string' && value.trim().length > 0
}

export function hasAnalysisData(entry) {
  if (!entry) return false
  const checkin = entry.checkin || {}
  const hasScore = Object.keys(DIM_LABELS).some(key => Number(checkin[key]) > 0)
  const hasNote = Object.values(checkin.notes || {}).some(hasText)
  const highlights = entry.highlights || {}
  const hasHighlight = [...(highlights.wins || []), ...(highlights.improves || [])]
    .some(hasText)
  const diary = entry.diary || {}
  return hasScore || hasNote || hasHighlight || hasText(diary.title) || hasText(diary.content)
}

export function getAnalysisRange(type, anchorDate) {
  const anchor = parseDate(anchorDate)

  if (type === 'daily') {
    return { start: anchorDate, end: anchorDate, totalDays: 1 }
  }

  if (type === 'weekly') {
    const weekday = anchor.getDay() || 7
    const start = addDays(anchor, 1 - weekday)
    return {
      start: formatDate(start),
      end: formatDate(addDays(start, 6)),
      totalDays: 7
    }
  }

  if (type === 'monthly') {
    const year = anchor.getFullYear()
    const month = anchor.getMonth()
    const start = new Date(year, month, 1)
    const end = new Date(year, month + 1, 0)
    return {
      start: formatDate(start),
      end: formatDate(end),
      totalDays: end.getDate()
    }
  }

  throw new Error(`Unknown analysis type: ${type}`)
}

function formatCheckin(checkin) {
  if (!checkin) return '无打卡数据'
  const values = Object.entries(DIM_LABELS).flatMap(([key, label]) => {
    const score = checkin[key]
    if (!score) return []
    const note = checkin.notes?.[key] ? `；备注：${checkin.notes[key]}` : ''
    return [`  ${label}：${score}/5${note}`]
  })
  return values.length ? values.join('\n') : '无打卡数据'
}

function formatList(title, values = []) {
  const items = values.filter(value => value?.trim())
  return items.length
    ? `  ${title}：\n${items.map(value => `    - ${value}`).join('\n')}`
    : `  ${title}：无记录`
}

function formatEntry(entry) {
  const diary = entry.diary || {}
  return [
    `【${entry.date}】`,
    `打卡：\n${formatCheckin(entry.checkin)}`,
    `亮点与改进：\n${formatList('亮点', entry.highlights?.wins)}\n${formatList('改进', entry.highlights?.improves)}`,
    `日记：\n  标题：${diary.title || '无'}\n  内容：${diary.content || '无'}`
  ].join('\n')
}

function rangeLabel(type, range) {
  return type === 'daily' ? range.start : `${range.start} 至 ${range.end}`
}

function analysisTasks(type) {
  if (type === 'daily') {
    return `1. 数据质量：先指出哪些信息充分、哪些缺失，缺失会限制哪些判断。
2. 状态快照：用不超过 5 条事实概括当天的精力、情绪、投入和产出。
3. 核心问题诊断：找出 1-3 个最重要的问题，按影响程度和紧迫性排序。逐项分析触发条件、当时行为、直接结果、可能根因和置信度；根因只能作为待验证假设。
4. 正向模式：指出真正有效、值得复制的行为，并说明复制条件，不要泛泛表扬。
5. 次日行动：给出最多 3 项行动，逐项写明优先级、触发时机、具体步骤、最低执行版本、完成标准、复查时间和失败后的调整办法。
6. 风险与追问：指出一个最需要防止的风险；证据不足时提出最多 3 个关键追问。`
  }

  if (type === 'weekly') {
    return `1. 数据质量与覆盖：说明有效记录天数、缺失分布，以及这些缺失对结论的影响。
2. 有效趋势：仅使用实际有评分的日期计算趋势，列出各维度的有效样本数、均值、最高/最低日期和变化方向。
3. 反复出现的问题：找出 1-3 个重复问题，按影响程度和紧迫性排序，并引用至少两条跨日期证据；样本不足时明确说明。
4. 关联与反证：分析情绪、健康、学习、工作之间可能的关联，同时列出不支持该推断的证据，禁止把相关性写成因果。
5. 下周计划：给出最多 5 项行动，每项写明优先级、触发时机、具体步骤、最低执行版本、完成标准、复查时间和止损条件。
6. 关键追问：信息不足时提出最多 3 个关键追问。`
  }

  return `1. 数据质量与覆盖：说明有效记录天数、连续缺失区间，以及缺失对月度判断的影响。
2. 月度趋势：仅使用实际有评分的日期，列出各维度有效样本数、均值、波动和高低点；比较月初/月中/月末时必须说明样本量。
3. 阶段变化：识别状态转折点、持续有效的行为和反复出现的问题，并逐条引用日期证据。
4. 深层问题：找出 1-3 个最有影响的问题，区分事实、可能机制和待验证假设，指出矛盾、回避或盲区。
5. 下月策略：给出 3-5 个目标，每个目标包含基线、目标值、触发时机、行动步骤、最低执行版本、完成标准、每周复查时间和调整规则。
6. 关键追问：信息不足时提出最多 3 个关键追问。`
}

export function buildAnalysisPrompt(type, entries, range) {
  const meaningfulEntries = entries.filter(hasAnalysisData)
  const label = rangeLabel(type, range)
  const dataText = meaningfulEntries.map(formatEntry).join('\n\n---\n\n')

  return `你是一名严谨、直接、以证据为基础的个人行为复盘分析师。你的目标不是安慰我，而是帮助我识别问题、验证原因并形成可执行的改进闭环。

分析范围：${label}
数据覆盖：${meaningfulEntries.length}/${range.totalDays} 天

工作原则：
- 所有重要结论必须引用具体日期、评分、备注、亮点或日记原文作为证据。
- 明确区分事实、推断、信息缺口；推断必须标注置信度以及需要如何验证。
- 无记录日期属于缺失数据，不得按 0 分计算，也不得据此推断状态差。
- 禁止虚构事件或因果，禁止空泛鼓励，禁止医学或心理诊断；涉及持续身体不适或安全风险时，只建议寻求合格专业帮助。
- 建议必须针对本次数据暴露的具体问题，不能给通用模板答案。

请严格按以下结构输出：
${analysisTasks(type)}

原始复盘数据：
${dataText}`
}
