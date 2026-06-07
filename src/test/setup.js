import '@testing-library/jest-dom'

// jsdom 沒有 crypto.randomUUID 時補上，供新增記錄/計畫使用
if (!globalThis.crypto) globalThis.crypto = {}
if (typeof globalThis.crypto.randomUUID !== 'function') {
  let n = 0
  globalThis.crypto.randomUUID = () => `test-uuid-${++n}-${Date.now()}`
}
