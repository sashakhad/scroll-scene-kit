export function clamp(value: number, min: number, max: number): number {
  if (value < min) return min
  if (value > max) return max
  return value
}

export type Span = {
  id: string
  start: number
  end: number
}

export function sceneSpans(weights: readonly { id: string; weight: number }[]): Span[] {
  let total = 0
  for (const item of weights) {
    total += item.weight
  }
  const spans: Span[] = []
  if (total <= 0) return spans
  let cursor = 0
  for (const item of weights) {
    const start = cursor / total
    cursor += item.weight
    spans.push({ id: item.id, start, end: cursor / total })
  }
  return spans
}

export function scrollProgress(
  scrollY: number,
  filmTop: number,
  filmHeight: number,
  viewport: number,
): number {
  const range = filmHeight - viewport
  if (range <= 0) return 0
  return clamp((scrollY - filmTop) / range, 0, 1)
}

export function localProgress(global: number, start: number, end: number): number {
  const span = end - start
  if (span <= 0) return 0
  return clamp((global - start) / span, 0, 1)
}

export type FadeEdges = {
  enter: boolean
  exit: boolean
}

/**
 * Opacity of one scene along the global 0–1 timeline.
 * Neighboring scenes share a window of width `2 * fade` centered on their
 * shared boundary, so one fades out as the next fades in.
 */
export function plateOpacity(
  global: number,
  start: number,
  end: number,
  fade: number,
  edges: FadeEdges,
): number {
  if (fade <= 0) {
    if (global < start || global > end) return 0
    return 1
  }
  if (global < start - fade || global > end + fade) return 0

  let opacity = 1
  if (edges.enter) {
    const entered = (global - (start - fade)) / (2 * fade)
    opacity = Math.min(opacity, clamp(entered, 0, 1))
  } else if (global < start) {
    opacity = 0
  }

  if (edges.exit) {
    const left = (global - (end - fade)) / (2 * fade)
    opacity = Math.min(opacity, clamp(1 - left, 0, 1))
  } else if (global > end) {
    opacity = 0
  }

  return opacity
}

export function stillOpacity(
  global: number,
  start: number,
  end: number,
  isLast: boolean,
): number {
  if (global < start) return 0
  if (isLast) return global <= end + 0.0001 ? 1 : 0
  if (global < end) return 1
  return 0
}
