export class MemoryStorage {
  constructor(initial = {}) {
    this.data = new Map(Object.entries(initial))
    this.failWrites = false
  }

  getItem(key) {
    return this.data.has(key) ? this.data.get(key) : null
  }

  setItem(key, value) {
    if (this.failWrites) throw new DOMException('quota', 'QuotaExceededError')
    this.data.set(key, String(value))
  }

  removeItem(key) {
    this.data.delete(key)
  }

  key(index) {
    return [...this.data.keys()][index] ?? null
  }

  get length() {
    return this.data.size
  }
}
