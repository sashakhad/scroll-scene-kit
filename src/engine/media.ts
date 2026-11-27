import { clamp } from "./math.ts"

const SEEK_GAP = 0.034

export type Scrubber = {
  setSource(src: string): void
  seek(progress: number): void
}

export function createScrubber(video: HTMLVideoElement): Scrubber {
  let duration = 0
  let lastTarget = -1
  let currentSrc = ""

  video.addEventListener("loadedmetadata", function onMeta(): void {
    duration = Number.isFinite(video.duration) ? video.duration : 0
  })

  video.addEventListener("loadeddata", function onReady(): void {
    video.classList.add("is-ready")
    kickDecoder(video)
  })

  video.addEventListener("error", function onError(): void {
    video.classList.remove("is-ready")
  })

  return {
    setSource(src: string): void {
      if (currentSrc === src) return
      currentSrc = src
      duration = 0
      lastTarget = -1
      video.classList.remove("is-ready")
      video.preload = "auto"
      video.src = src
      video.load()
    },
    seek(progress: number): void {
      const dur = duration > 0 ? duration : finiteDuration(video)
      if (dur <= 0) return
      const target = clamp(progress, 0, 1) * Math.max(dur - 0.05, 0)
      if (Math.abs(target - lastTarget) < SEEK_GAP) return
      if (video.seeking && Math.abs(target - lastTarget) < 0.12) return
      lastTarget = target
      try {
        video.currentTime = target
      } catch {
        // The element can reject a seek before metadata arrives.
      }
    },
  }
}

function finiteDuration(video: HTMLVideoElement): number {
  if (Number.isFinite(video.duration) && video.duration > 0) return video.duration
  return 0
}

function kickDecoder(video: HTMLVideoElement): void {
  if (video.dataset.kicked === "1") return
  video.dataset.kicked = "1"
  const pending = video.play()
  if (pending === undefined) {
    video.pause()
    return
  }
  void pending
    .then(function pauseAfterKick(): void {
      video.pause()
    })
    .catch(function keepStill(): void {
      video.classList.remove("is-ready")
    })
}

export function watchLoops(root: ParentNode, enabled: boolean): void {
  const nodes = root.querySelectorAll<HTMLVideoElement>("video[data-loop]")
  if (!enabled) return

  const observer = new IntersectionObserver(
    function onIntersect(entries: IntersectionObserverEntry[]): void {
      for (const entry of entries) {
        const video = entry.target
        if (!(video instanceof HTMLVideoElement)) continue
        if (entry.isIntersecting) {
          armLoop(video)
          const pending = video.play()
          if (pending !== undefined) {
            void pending.catch(function ignorePlayError(): void {
              // Autoplay can fail; the poster remains.
            })
          }
        } else {
          video.pause()
        }
      }
    },
    { rootMargin: "160px", threshold: 0.01 },
  )

  for (const node of nodes) observer.observe(node)
}

function armLoop(video: HTMLVideoElement): void {
  const src = video.dataset.loop
  if (!src || video.dataset.armed === src) return
  video.dataset.armed = src
  video.src = src
  video.load()
}

export function clipFor(
  clips: { desktop?: string; mobile?: string } | undefined,
  narrow: boolean,
): string | null {
  if (!clips) return null
  if (narrow && clips.mobile) return clips.mobile
  if (clips.desktop) return clips.desktop
  if (clips.mobile) return clips.mobile
  return null
}
