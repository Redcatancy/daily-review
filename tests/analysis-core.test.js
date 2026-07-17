import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildAnalysisPrompt,
  getAnalysisRange,
  hasAnalysisData
} from '../src/analysis-core.js'

test('daily analysis targets the selected historical date', () => {
  assert.deepEqual(getAnalysisRange('daily', '2026-05-18'), {
    start: '2026-05-18',
    end: '2026-05-18',
    totalDays: 1
  })
})

test('weekly analysis uses the complete Monday-to-Sunday week across months', () => {
  assert.deepEqual(getAnalysisRange('weekly', '2026-07-01'), {
    start: '2026-06-29',
    end: '2026-07-05',
    totalDays: 7
  })
})

test('monthly analysis uses the complete selected calendar month', () => {
  assert.deepEqual(getAnalysisRange('monthly', '2028-02-10'), {
    start: '2028-02-01',
    end: '2028-02-29',
    totalDays: 29
  })
})

const sampleEntries = [{
  date: '2026-07-15',
  checkin: {
    health: 2,
    learning: 4,
    work: 3,
    mood: 2,
    notes: { health: '睡眠不足', mood: '下午焦虑' }
  },
  highlights: {
    wins: ['完成客户方案'],
    improves: ['会议后没有及时整理任务']
  },
  diary: {
    title: '节奏失控',
    content: '上午效率不错，下午被临时消息打断后一直拖延。'
  }
}]

test('daily prompt demands evidence-led diagnosis and measurable actions', () => {
  const range = getAnalysisRange('daily', '2026-07-15')
  const prompt = buildAnalysisPrompt('daily', sampleEntries, range)

  assert.match(prompt, /分析范围：2026-07-15/)
  assert.match(prompt, /事实、推断、信息缺口/)
  assert.match(prompt, /引用具体日期、评分、备注、亮点或日记原文/)
  assert.match(prompt, /按影响程度和紧迫性排序/)
  assert.match(prompt, /触发时机/)
  assert.match(prompt, /最低执行版本/)
  assert.match(prompt, /完成标准/)
  assert.match(prompt, /复查时间/)
  assert.match(prompt, /最多 3 个关键追问/)
  assert.match(prompt, /禁止空泛鼓励/)
})

test('period prompt reports coverage without treating missing dates as zero scores', () => {
  const range = getAnalysisRange('weekly', '2026-07-15')
  const prompt = buildAnalysisPrompt('weekly', sampleEntries, range)

  assert.match(prompt, /分析范围：2026-07-13 至 2026-07-19/)
  assert.match(prompt, /数据覆盖：1\/7 天/)
  assert.match(prompt, /无记录日期属于缺失数据，不得按 0 分计算/)
  assert.match(prompt, /仅使用实际有评分的日期计算趋势/)
  assert.match(prompt, /反复出现的问题/)
})

test('empty storage shells do not count as analysis data', () => {
  assert.equal(hasAnalysisData({
    checkin: {},
    highlights: { wins: ['', '  '], improves: [] },
    diary: null
  }), false)
  assert.equal(hasAnalysisData({
    checkin: { notes: { mood: '有备注' } }
  }), true)
  assert.equal(hasAnalysisData({
    diary: { title: '', content: '有正文' }
  }), true)
})
