import type { Brand, Scene, Wordmark, WordmarkPath } from "../types.ts"

const SVG_NS = "http://www.w3.org/2000/svg"

export type PlateNodes = {
  id: string
  media: HTMLElement
  caption: HTMLElement
  video: HTMLVideoElement | null
}

export type MountedPage = {
  film: HTMLElement
  stage: HTMLElement
  rail: HTMLElement
  plates: PlateNodes[]
  anchors: HTMLElement[]
  navLinks: HTMLAnchorElement[]
  signature: SVGSVGElement | null
  particles: HTMLCanvasElement | null
  soundButton: HTMLButtonElement | null
}

export function mountPage(brand: Brand, scenes: readonly Scene[], videoMode: boolean): MountedPage {
  const app = document.querySelector("#app")
  if (!(app instanceof HTMLElement)) {
    throw new Error("Missing #app")
  }
  app.replaceChildren()

  const skip = el("a", "skip-link")
  skip.href = "#sprout"
  skip.textContent = brand.copy.skip

  const header = renderHeader(brand, scenes)
  const cover = renderCover(brand, videoMode)
  const film = el("div", videoMode ? "film" : "film is-plain")
  film.id = "film"
  const stage = el("div", "stage")
  const plates: PlateNodes[] = []
  const anchors: HTMLElement[] = []
  let signature: SVGSVGElement | null = null

  for (let index = 0; index < scenes.length; index += 1) {
    const scene = scenes[index]
    if (!scene) continue
    const built = renderScene(brand, scene, videoMode, index === 0)
    plates.push(built.plate)
    anchors.push(built.anchor)
    stage.append(built.plate.media)
    if (built.signature) signature = built.signature
  }

  const particles = brand.features.particles && videoMode ? elCanvas() : null
  if (particles) stage.append(particles)
  for (const plate of plates) stage.append(plate.caption)

  const anchorLayer = el("div", "anchors")
  for (const anchor of anchors) anchorLayer.append(anchor)
  film.append(stage, anchorLayer)

  const footer = renderFooter(brand, scenes)
  const rail = el("div", "rail")
  rail.setAttribute("aria-hidden", "true")
  const fill = el("span", "rail__fill")
  rail.append(fill)

  const soundButton = brand.features.sound ? renderSound(brand) : null
  if (soundButton) {
    const visit = header.querySelector(".visit-link")
    if (visit) header.insertBefore(soundButton, visit)
    else header.append(soundButton)
  }

  const main = el("main")
  main.id = "top"
  main.append(cover, film, footer)
  app.append(skip, header, main, rail)

  return {
    film,
    stage,
    rail,
    plates,
    anchors,
    navLinks: Array.from(app.querySelectorAll<HTMLAnchorElement>("a[data-scene]")),
    signature,
    particles,
    soundButton,
  }
}

function renderHeader(brand: Brand, scenes: readonly Scene[]): HTMLElement {
  const header = el("header", "site-header flex items-center justify-between gap-3 px-4 py-3 md:px-8")
  const lockup = el("a", "brand-lockup flex items-center gap-2 min-h-11")
  lockup.href = "#top"
  const mark = document.createElement("img")
  mark.src = brand.logo
  mark.alt = ""
  mark.width = 36
  mark.height = 36
  const name = el("span", "brand-name", brand.name)
  lockup.append(mark, name)

  const nav = el("nav", "scene-nav hidden md:block")
  nav.setAttribute("aria-label", brand.copy.scenesLabel)
  nav.append(sceneList(scenes, "flex items-center gap-4"))

  const menu = el("details", "scene-menu md:hidden")
  const summary = el("summary", "min-h-11 px-3 flex items-center", brand.copy.scenesMenu)
  const menuNav = el("nav")
  menuNav.setAttribute("aria-label", brand.copy.scenesLabel)
  menuNav.append(sceneList(scenes, "grid gap-1 py-2"))
  menu.append(summary, menuNav)
  menu.addEventListener("click", function closeMenu(event: MouseEvent): void {
    if (event.target instanceof HTMLAnchorElement) menu.open = false
  })

  const visit = externalLink(brand.links[0]?.href ?? brand.url, "Visit", "visit-link min-h-11")
  visit.setAttribute("aria-label", brand.copy.visit)
  header.append(lockup, nav, menu, visit)
  return header
}

function sceneList(scenes: readonly Scene[], className: string): HTMLElement {
  const list = el("ol", className)
  for (const scene of scenes) {
    const item = el("li")
    const link = el("a", "scene-link", scene.kind === "finale" ? "Finale" : scene.title)
    link.href = `#${scene.id}`
    link.dataset.scene = scene.id
    item.append(link)
    list.append(item)
  }
  return list
}

function renderCover(brand: Brand, videoMode: boolean): HTMLElement {
  const cover = el("section", "cover")
  cover.setAttribute("aria-labelledby", "cover-title")
  const copy = el("div", "cover__copy max-w-xl")
  copy.append(el("p", "kicker", brand.copy.coverKicker))
  const title = el("h1", "display", brand.name)
  title.id = "cover-title"
  const tagline = el("p", "tagline", brand.tagline)
  const deck = el("p", "deck", brand.copy.coverDeck)
  const actions = el("div", "cover__actions flex flex-wrap items-center gap-4")
  const start = el("a", "button", brand.copy.start)
  start.href = "#sprout"
  const visit = externalLink(brand.url, brand.copy.visit, "text-link")
  actions.append(start, visit)
  const hint = el("p", "scroll-hint", "Scroll")
  copy.append(title, tagline, deck, actions, hint)

  const frame = el("div", "cover__frame")
  const image = document.createElement("img")
  image.src = brand.cover.still
  image.alt = brand.cover.alt
  image.width = 1600
  image.height = 900
  image.decoding = "async"
  image.fetchPriority = "high"
  frame.append(image)

  if (videoMode && brand.cover.loop) {
    const loop = document.createElement("video")
    loop.className = "loop-badge cover__badge"
    loop.muted = true
    loop.defaultMuted = true
    loop.loop = true
    loop.playsInline = true
    loop.preload = "none"
    loop.poster = brand.cover.poster ?? brand.cover.still
    loop.dataset.loop = brand.cover.loop
    loop.setAttribute("aria-hidden", "true")
    loop.tabIndex = -1
    frame.append(loop)
  }

  cover.append(copy, frame)
  return cover
}

function renderScene(
  brand: Brand,
  scene: Scene,
  videoMode: boolean,
  first: boolean,
): { plate: PlateNodes; anchor: HTMLElement; signature: SVGSVGElement | null } {
  const media = el("article", "plate")
  media.dataset.scene = scene.id
  if (first) media.dataset.first = "true"
  media.style.setProperty("--accent", scene.accent)
  const still = document.createElement("img")
  still.className = "plate__still"
  still.src = scene.still
  still.alt = scene.alt
  still.width = 1600
  still.height = 900
  still.decoding = "async"
  if (!first) still.loading = "lazy"
  media.append(still)

  let video: HTMLVideoElement | null = null
  if (videoMode && scene.clips && (scene.clips.desktop || scene.clips.mobile)) {
    video = document.createElement("video")
    video.className = "plate__scrub"
    video.muted = true
    video.defaultMuted = true
    video.playsInline = true
    video.preload = "none"
    video.poster = scene.poster
    video.setAttribute("aria-hidden", "true")
    video.tabIndex = -1
    media.append(video)
  }

  if (videoMode && scene.loop) {
    const loop = document.createElement("video")
    loop.className = "loop-badge plate__loop"
    loop.muted = true
    loop.defaultMuted = true
    loop.loop = true
    loop.playsInline = true
    loop.preload = "none"
    loop.poster = "/media/stills/vinyl.webp"
    loop.dataset.loop = scene.loop
    loop.setAttribute("aria-hidden", "true")
    loop.tabIndex = -1
    media.append(loop)
  }

  const caption = el("div", "caption")
  caption.dataset.align = scene.align
  caption.dataset.scene = scene.id
  if (first) caption.dataset.first = "true"
  caption.style.setProperty("--accent", scene.accent)

  let signature: SVGSVGElement | null = null
  const card = el("div", scene.kind === "finale" ? "card card--finale" : "card")
  if (scene.kind === "finale") {
    signature = renderSignature(brand.wordmark)
    card.append(signature)
  }
  const kicker = el("p", "kicker", scene.kicker)
  kicker.dataset.at = scene.kind === "finale" ? "0.06" : "0.04"
  const heading = el("h2", "display", scene.title)
  heading.id = `title-${scene.id}`
  heading.dataset.at = scene.kind === "finale" ? "0.22" : "0.1"
  media.setAttribute("aria-labelledby", heading.id)
  const copy = el("p", "scene-copy", scene.copy)
  copy.dataset.at = scene.kind === "finale" ? "0.34" : "0.12"
  card.append(kicker, heading, copy)
  if (scene.kind === "finale") {
    const visit = externalLink(brand.url, brand.copy.visit, "button")
    visit.dataset.at = "0.48"
    card.append(visit)
  }
  caption.append(card)

  const anchor = el("div", "anchor")
  anchor.id = scene.id
  anchor.tabIndex = -1
  const label = el("span", "sr-only", scene.title)
  anchor.append(label)

  return {
    plate: { id: scene.id, media, caption, video },
    anchor,
    signature,
  }
}

function renderSignature(wordmark: Wordmark): SVGSVGElement {
  const svg = document.createElementNS(SVG_NS, "svg")
  svg.setAttribute("class", "signature")
  svg.setAttribute("viewBox", wordmark.viewBox)
  svg.setAttribute("aria-hidden", "true")
  const strokes = document.createElementNS(SVG_NS, "g")
  strokes.setAttribute("class", "signature__strokes")
  const ink = document.createElementNS(SVG_NS, "g")
  ink.setAttribute("class", "signature__ink")
  ink.setAttribute("fill-rule", "evenodd")
  for (const item of wordmark.paths) {
    strokes.append(pathNode(item, true))
    ink.append(pathNode(item, false))
  }
  svg.append(strokes, ink)
  return svg
}

function pathNode(item: WordmarkPath, stroke: boolean): SVGPathElement {
  const path = document.createElementNS(SVG_NS, "path")
  path.setAttribute("d", item.d)
  if (stroke) {
    path.dataset.lag = String(item.lag)
    path.dataset.span = String(item.span)
    if (item.flourish) path.classList.add("is-flourish")
    if (item.leaf) path.classList.add("is-leaf")
  } else if (item.leaf) {
    path.classList.add("is-leaf")
  }
  return path
}

function renderFooter(brand: Brand, scenes: readonly Scene[]): HTMLElement {
  const footer = el("footer", "site-footer px-4 py-16 md:px-8")
  const inner = el("div", "max-w-3xl mx-auto grid gap-4 text-center")
  inner.append(el("p", "footer-name display", brand.name))
  inner.append(el("p", undefined, brand.tagline))
  const visit = externalLink(brand.url, brand.copy.visit, "text-link")
  const index = el("nav", "footer-index")
  index.setAttribute("aria-label", "Scene index")
  index.append(sceneList(scenes, "flex flex-wrap justify-center gap-x-4 gap-y-2"))
  inner.append(visit, index, el("p", "colophon", brand.copy.colophon))
  footer.append(inner)
  return footer
}

function renderSound(brand: Brand): HTMLButtonElement {
  const button = document.createElement("button")
  button.type = "button"
  button.className = "sound-toggle"
  button.setAttribute("aria-pressed", "false")
  button.setAttribute("aria-label", "Play ambient sound")
  button.innerHTML =
    '<svg viewBox="0 0 24 24" aria-hidden="true" class="sound-icon"><path d="M4 10h3l4-3v10l-4-3H4z"/><path class="sound-waves" d="M15 9c1.2 1 1.8 2 1.8 3s-.6 2-1.8 3"/><path class="sound-waves" d="M17.2 7c2 1.6 3 3.2 3 5s-1 3.4-3 5"/></svg>'
  const label = el("span", undefined, brand.copy.soundOff)
  label.dataset.soundLabel = "true"
  button.append(label)
  return button
}

function externalLink(href: string, label: string, className: string): HTMLAnchorElement {
  const link = el("a", className, label)
  link.href = href
  link.target = "_blank"
  link.rel = "noreferrer"
  return link
}

function elCanvas(): HTMLCanvasElement {
  const canvas = document.createElement("canvas")
  canvas.className = "particles"
  canvas.setAttribute("aria-hidden", "true")
  return canvas
}

function el(tag: "a", className?: string, text?: string): HTMLAnchorElement
function el(tag: "button", className?: string, text?: string): HTMLButtonElement
function el(tag: "span", className?: string, text?: string): HTMLSpanElement
function el(tag: "p", className?: string, text?: string): HTMLParagraphElement
function el(tag: "h1", className?: string, text?: string): HTMLHeadingElement
function el(tag: "h2", className?: string, text?: string): HTMLHeadingElement
function el(tag: "ol", className?: string, text?: string): HTMLOListElement
function el(tag: "li", className?: string, text?: string): HTMLLIElement
function el(tag: "nav", className?: string, text?: string): HTMLElement
function el(tag: "header", className?: string, text?: string): HTMLElement
function el(tag: "footer", className?: string, text?: string): HTMLElement
function el(tag: "main", className?: string, text?: string): HTMLElement
function el(tag: "section", className?: string, text?: string): HTMLElement
function el(tag: "div", className?: string, text?: string): HTMLDivElement
function el(tag: "article", className?: string, text?: string): HTMLElement
function el(tag: "details", className?: string, text?: string): HTMLDetailsElement
function el(tag: "summary", className?: string, text?: string): HTMLElement
function el(tag: keyof HTMLElementTagNameMap, className?: string, text?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  if (text !== undefined) node.textContent = text
  return node
}
