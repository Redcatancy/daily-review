export function createRenderGuard() {
  let version = 0
  let current = null

  return {
    begin(context) {
      current = { ...context, version: ++version }
      return current
    },
    isCurrent(token) {
      return Boolean(
        current &&
        token.version === current.version &&
        token.userId === current.userId &&
        token.date === current.date
      )
    }
  }
}

export function createCapturedDebounce(run, delay, timers = {}) {
  const setTimer = timers.setTimer || ((fn, ms) => setTimeout(fn, ms))
  const clearTimer = timers.clearTimer || (id => clearTimeout(id))
  let timer = null
  let pending = null

  async function execute() {
    if (!pending) return undefined
    const value = pending
    pending = null
    if (timer !== null) clearTimer(timer)
    timer = null
    return run(value)
  }

  return {
    schedule(value) {
      pending = structuredClone(value)
      if (timer !== null) clearTimer(timer)
      timer = setTimer(execute, delay)
    },
    flush: execute
  }
}
