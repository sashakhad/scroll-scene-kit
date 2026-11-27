import type { Brand } from "./types.ts"
import { wordmark } from "./wordmark.ts"

/**
 * One object rebrands the site: name, palette, fonts, wordmark, copy, and links.
 * Scene pictures live in `scenes.ts` and `public/media`.
 */
export const brand: Brand = {
  name: "Music for Vegans",
  tagline: "Songs for the garden, the skillet, and the dance floor.",
  description:
    "Music for Vegans — a playful vegan-food-themed music project, told as a scroll of kitchen scenes. Songs for the garden, the skillet, and the dance floor.",
  url: "https://music-for-vegans.vercel.app",
  locale: "en",
  palette: {
    paper: "#f3ead7",
    ink: "#1c1915",
    muted: "#3f3a33",
    line: "#e2d5bf",
    tomato: "#e23b2f",
    leaf: "#1f7a45",
    lemon: "#e2b143",
    eggplant: "#5c3d7a",
    carrot: "#e07a2f",
    cream: "#fff8ee",
  },
  fonts: {
    display: { family: "Fraunces", src: "/fonts/fraunces-700.woff2", weight: 700 },
    body: { family: "Outfit", src: "/fonts/outfit-400.woff2", weight: 400 },
    bodyStrong: { family: "Outfit", src: "/fonts/outfit-500.woff2", weight: 500 },
  },
  wordmark,
  logo: "/mark.svg",
  links: [{ label: "Visit the project", href: "https://music-for-vegans.vercel.app" }],
  copy: {
    skip: "Skip to scenes",
    start: "Start the scroll",
    soundOn: "Sound on",
    soundOff: "Sound off",
    visit: "Visit the project",
    scenesLabel: "Scenes",
    coverKicker: "Scroll-scene kit",
    coverDeck:
      "A playful vegan-food-themed music project, told as six scrolling scenes and a signature.",
    finaleKicker: "07 — Signature",
    finaleNote: "The first skin on this scroll-scene kit.",
    colophon: "A scroll-scene kit demo.",
    scenesMenu: "Scenes",
  },
  features: {
    particles: true,
    sound: true,
  },
  cover: {
    still: "/media/stills/cover.webp",
    alt: "A vinyl record surrounded by tomatoes, lemons, carrots, and leaves.",
    loop: "/media/loops/vinyl.mp4",
    poster: "/media/stills/vinyl.webp",
  },
  audio: {
    ambient: "/media/audio/ambient.m4a",
  },
}

export function applyBrand(next: Brand): void {
  const root = document.documentElement
  root.lang = next.locale
  const palette = next.palette
  let key: keyof typeof palette
  for (key in palette) {
    root.style.setProperty(`--${key}`, palette[key])
  }
  root.style.setProperty("--font-display", `"${next.fonts.display.family}", Georgia, serif`)
  root.style.setProperty("--font-body", `"${next.fonts.body.family}", system-ui, sans-serif`)

  const style = document.createElement("style")
  style.setAttribute("data-brand-fonts", "true")
  style.textContent = [next.fonts.display, next.fonts.body, next.fonts.bodyStrong]
    .map(function fontFace(font): string {
      return `@font-face{font-family:"${font.family}";src:url("${font.src}") format("woff2");font-weight:${font.weight};font-style:normal;font-display:swap;}`
    })
    .join("")
  document.head.append(style)
  document.title = next.name

  const description = document.querySelector('meta[name="description"]')
  if (description) description.setAttribute("content", next.description)
}
