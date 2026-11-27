import { applyBrand } from "../brand.ts"
import type { Brand, Scene } from "../types.ts"
import { clipFor, createScrubber, watchLoops, type Scrubber } from "./media.ts"
import {
  localProgress,
  plateOpacity,
  sceneSpans,
  scrollProgress,
  stillOpacity,
  type Span,
} from "./math.ts"
import { chooseMode, readSignals } from "./mode.ts"
import { mountPage, type PlateNodes } from "./mount.ts"
import { createParticles, type ParticleField } from "./particles.ts"
import { createSound, type SoundController } from "./sound.ts"

const FADE = 0.016

export function startExperience(brand: Brand, scenes: readonly Scene[]): void {
  applyBrand(brand)
  const signals = readSignals()
  const mode = chooseMode(signals)
  const narrowQuery = window.matchMedia("(max-width: 760px)")
  let narrow = narrowQuery.matches
  const page = mountPage(brand, scenes, mode === "video")
  const spans = sceneSpans(scenes)
  const scrubbers = new Map<string, Scrubber>()
  for (const plate of page.plates) {
    if (!plate.video) continue
    scrubbers.set(plate.id, createScrubber(plate.video))
  }

  const particles = createField(page.particles, brand, mode === "video")
  const sound = createPad(page.soundButton, brand)
  watchLoops(document, mode === "video")
  const signatureLengths = measureSignature(page.signature)

  let running = false
  let lastNow = performance.now()
  let lastScroll = window.scrollY
  let drift = 0
  let activeId = ""
  let lastDraw = -1

  function layout(): void {
    const viewport = window.innerHeight
    let weight = 0
    for (const scene of scenes) weight += scene.weight
    const travel = weight * viewport
    page.film.style.height = `${travel + viewport}px`
    page.stage.style.height = `${viewport}px`
    for (let index = 0; index < spans.length; index += 1) {
      const anchor = page.anchors[index]
      const span = spans[index]
      if (!anchor || !span) continue
      const lead = Math.min(FADE + 0.01, (span.end - span.start) * 0.22)
      anchor.style.top = `${(span.start + lead) * travel}px`
    }
    if (particles) particles.resize(page.stage.clientWidth, page.stage.clientHeight)
  }

  function frame(now: number): void {
    running = false
    const dt = Math.min(0.05, Math.max(0, (now - lastNow) / 1000))
    lastNow = now
    if (document.hidden) return

    const y = window.scrollY
    const viewport = window.innerHeight
    const rect = page.film.getBoundingClientRect()
    const global = scrollProgress(y, y + rect.top, page.film.offsetHeight, viewport)
    page.rail.style.setProperty("--global", global.toFixed(4))

    let topIndex = 0
    let topFade = -1
    const stageOn = rect.bottom > 0 && rect.top < viewport

    for (let index = 0; index < scenes.length; index += 1) {
      const scene = scenes[index]
      const span = spans[index]
      const plate = page.plates[index]
      if (!scene || !span || !plate) continue
      const local = localProgress(global, span.start, span.end)
      const fade =
        mode === "video"
          ? plateOpacity(global, span.start, span.end, FADE, {
              enter: index !== 0,
              exit: index !== scenes.length - 1,
            })
          : stillOpacity(global, span.start, span.end, index === scenes.length - 1)

      paintMedia(plate, local, fade)
      if (fade >= topFade) {
        topFade = fade
        topIndex = index
      }
      if (mode === "video") {
        armClip(scene, span, global)
        if (fade > 0.02) scrubbers.get(scene.id)?.seek(local)
      }
      if (scene.kind === "finale" && fade > 0.02) {
        lastDraw = drawSignature(
          page.signature,
          signatureLengths,
          mode === "video" ? local : 1,
          lastDraw,
        )
      }
    }

    const active = scenes[topIndex]
    for (let index = 0; index < page.plates.length; index += 1) {
      const plate = page.plates[index]
      const scene = scenes[index]
      if (!plate || !scene) continue
      const on = index === topIndex && stageOn
      plate.caption.style.setProperty("--fade", on ? "1" : "0")
      plate.caption.classList.toggle("is-on", on)
      plate.caption.classList.toggle("is-top", on)
      plate.caption.inert = !on
      plate.media.inert = !on
      if (on && mode === "video") {
        const span = spans[index]
        const local = span ? localProgress(global, span.start, span.end) : 0
        syncReveals(plate.caption, local)
      }
    }
    if (active && stageOn) {
      page.rail.style.setProperty("--accent", active.accent)
      if (active.id !== activeId && topFade > 0.55) {
        activeId = active.id
        sound?.setScene(active.id, active.audioCue)
      }
      for (const link of page.navLinks) {
        if (link.dataset.scene === active.id) link.setAttribute("aria-current", "true")
        else link.removeAttribute("aria-current")
      }
    } else if (!stageOn) {
      activeId = ""
      for (const link of page.navLinks) link.removeAttribute("aria-current")
    }

    const scrolling = Math.abs(y - lastScroll)
    if (particles && stageOn) {
      if (scrolling > 14) particles.burst(scrolling > 60 ? 3 : 1)
      drift += dt
      if (drift > 0.55) {
        drift = 0
        particles.burst(1)
      }
      particles.frame(dt)
    } else if (particles) {
      particles.clear()
    }
    lastScroll = y
    if (particles?.alive() && stageOn) requestFrame()
  }

  function requestFrame(): void {
    if (running) return
    running = true
    requestAnimationFrame(frame)
  }

  function armClip(scene: Scene, span: Span, global: number): void {
    const scrubber = scrubbers.get(scene.id)
    if (!scrubber) return
    const near = global >= span.start - 0.1 && global <= span.end + 0.06
    if (!near) return
    const src = clipFor(scene.clips, narrow)
    if (src) scrubber.setSource(src)
  }

  window.addEventListener("scroll", requestFrame, { passive: true })
  window.addEventListener("resize", function onResize(): void {
    narrow = narrowQuery.matches
    layout()
    requestFrame()
  })
  narrowQuery.addEventListener("change", function onBreakpoint(): void {
    narrow = narrowQuery.matches
    requestFrame()
  })
  document.addEventListener("visibilitychange", function onVisibility(): void {
    if (!document.hidden) requestFrame()
  })
  window.matchMedia("(prefers-reduced-motion: reduce)").addEventListener("change", function reload(): void {
    window.location.reload()
  })

  layout()
  page.film.classList.add("is-live")
  if (location.hash) scrollToHash()
  frame(performance.now())
}

function paintMedia(plate: PlateNodes, local: number, fade: number): void {
  const shown = fade > 0.012
  const progress = local.toFixed(4)
  plate.media.style.setProperty("--p", progress)
  plate.caption.style.setProperty("--p", progress)
  plate.media.style.setProperty("--fade", fade.toFixed(4))
  plate.media.classList.toggle("is-on", shown)
}

function syncReveals(root: HTMLElement, progress: number): void {
  const nodes = root.querySelectorAll<HTMLElement>("[data-at]")
  for (const node of nodes) {
    const at = Number(node.dataset.at)
    const on = Number.isFinite(at) && progress >= at
    if (node.classList.contains("is-on") !== on) node.classList.toggle("is-on", on)
  }
}

function measureSignature(svg: SVGSVGElement | null): number[] {
  if (!svg) return []
  const paths = svg.querySelectorAll<SVGPathElement>(".signature__strokes path")
  const lengths: number[] = []
  for (const path of paths) {
    const length = path.getTotalLength()
    path.style.strokeDasharray = `${length}`
    path.style.strokeDashoffset = `${length}`
    lengths.push(length)
  }
  return lengths
}

function drawSignature(
  svg: SVGSVGElement | null,
  lengths: readonly number[],
  progress: number,
  previous: number,
): number {
  if (!svg) return previous
  if (previous >= 0 && Math.abs(progress - previous) < 0.006 && progress < 0.995) return previous
  const paths = svg.querySelectorAll<SVGPathElement>(".signature__strokes path")
  let index = 0
  for (const path of paths) {
    const length = lengths[index] ?? 0
    const lag = Number(path.dataset.lag ?? "0")
    const span = Number(path.dataset.span ?? "1")
    let amount = span <= 0 ? 1 : (progress - lag) / span
    if (amount < 0) amount = 0
    if (amount > 1) amount = 1
    path.style.strokeDashoffset = `${length * (1 - amount)}`
    index += 1
  }
  const fill = progress < 0.74 ? 0 : (progress - 0.74) / 0.26
  svg.style.setProperty("--fill", fill.toFixed(3))
  return progress
}

function scrollToHash(): void {
  const id = decodeURIComponent(location.hash.replace(/^#/, ""))
  if (!id) return
  const target = document.getElementById(id)
  if (!target) return
  target.scrollIntoView({ block: "start", behavior: "auto" })
}

function createField(
  canvas: HTMLCanvasElement | null,
  brand: Brand,
  enabled: boolean,
): ParticleField | null {
  if (!canvas || !enabled || !brand.features.particles) return null
  return createParticles(canvas, [
    brand.palette.tomato,
    brand.palette.leaf,
    brand.palette.lemon,
    brand.palette.eggplant,
    brand.palette.carrot,
  ])
}

function createPad(button: HTMLButtonElement | null, brand: Brand): SoundController | null {
  if (!button || !brand.features.sound) return null
  return createSound(button, brand.audio?.ambient)
}
