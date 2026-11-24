/**
 * Stands in for the browser's full screen in stories: a story's frame may not be allowed it, and a scripted press is
 * not the person's own. Entering and leaving are counted and announced the way the browser announces them. `restore`
 * puts the browser's own back.
 */
export function fakeFullscreen({ enabled = true }: { enabled?: boolean } = {}) {
  const doc = document
  const root = doc.documentElement
  let shown: Element | null = null
  const calls = { requests: 0, exits: 0 }
  const announce = () => doc.dispatchEvent(new Event('fullscreenchange'))
  Object.defineProperty(doc, 'fullscreenEnabled', { configurable: true, get: () => enabled })
  Object.defineProperty(doc, 'fullscreenElement', { configurable: true, get: () => shown })
  Object.defineProperty(root, 'requestFullscreen', {
    configurable: true,
    value: () => {
      calls.requests += 1
      shown = root
      announce()
      return Promise.resolve()
    },
  })
  Object.defineProperty(doc, 'exitFullscreen', {
    configurable: true,
    value: () => {
      calls.exits += 1
      shown = null
      announce()
      return Promise.resolve()
    },
  })
  return {
    calls,
    restore: () => {
      for (const key of ['fullscreenEnabled', 'fullscreenElement', 'exitFullscreen']) Reflect.deleteProperty(doc, key)
      Reflect.deleteProperty(root, 'requestFullscreen')
      announce()
    },
  }
}
