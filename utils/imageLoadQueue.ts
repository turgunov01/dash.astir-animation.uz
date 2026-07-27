// Global concurrency limiter for image loading. Decoding many large posters at
// once blocks the main thread and freezes the tab (and a weak laptop). This caps
// how many images are in the load+decode phase simultaneously; the rest wait in
// a queue and start as slots free up — Pinterest-style regulated loading.

const MAX_CONCURRENT_IMAGE_LOADS = 6

let active = 0
const waiting: Array<() => void> = []

export interface ImageSlot {
  /** Resolves when this image is allowed to start loading. */
  promise: Promise<void>
  /** Must be called exactly once when the image settles OR the owner unmounts. */
  release: () => void
}

export function acquireImageSlot(): ImageSlot {
  let released = false
  let queuedResolver: (() => void) | null = null

  const promise = new Promise<void>((resolve) => {
    if (active < MAX_CONCURRENT_IMAGE_LOADS) {
      active += 1
      resolve()
      return
    }

    // No free slot: wait in line. The resolver grants a slot when promoted.
    queuedResolver = () => {
      active += 1
      resolve()
    }
    waiting.push(queuedResolver)
  })

  function release() {
    if (released) return
    released = true

    // Still queued and never granted: just drop out of the line, hold no slot.
    if (queuedResolver) {
      const index = waiting.indexOf(queuedResolver)
      queuedResolver = null
      if (index >= 0) {
        waiting.splice(index, 1)
        return
      }
    }

    // We held a slot: free it, then promote the next waiter (which re-takes one).
    active = Math.max(0, active - 1)
    const next = waiting.shift()
    if (next) next()
  }

  return { promise, release }
}
