export type BrandLink = {
  label: string
  href: string
}

export type BrandFont = {
  family: string
  src: string
  weight: number
}

export type BrandPalette = {
  paper: string
  ink: string
  muted: string
  line: string
  tomato: string
  leaf: string
  lemon: string
  eggplant: string
  carrot: string
  cream: string
}

export type WordmarkPath = {
  d: string
  lag: number
  span: number
  flourish?: boolean
  leaf?: boolean
}

export type Wordmark = {
  viewBox: string
  paths: readonly WordmarkPath[]
}

export type Brand = {
  name: string
  tagline: string
  description: string
  url: string
  locale: string
  palette: BrandPalette
  fonts: {
    display: BrandFont
    body: BrandFont
    bodyStrong: BrandFont
  }
  wordmark: Wordmark
  logo: string
  links: readonly BrandLink[]
  copy: {
    skip: string
    start: string
    soundOn: string
    soundOff: string
    visit: string
    scenesLabel: string
    coverKicker: string
    coverDeck: string
    finaleKicker: string
    finaleNote: string
    colophon: string
    scenesMenu: string
  }
  features: {
    particles: boolean
    sound: boolean
  }
  cover: {
    still: string
    alt: string
    loop?: string
    poster?: string
  }
  audio?: {
    ambient?: string
  }
}

export type SceneAlign = "start" | "end" | "center"

export type SceneClips = {
  desktop?: string
  mobile?: string
}

export type Scene = {
  id: string
  title: string
  kicker: string
  copy: string
  still: string
  poster: string
  alt: string
  clips?: SceneClips
  loop?: string
  audioCue?: string
  accent: string
  weight: number
  align: SceneAlign
  kind: "scrub" | "finale"
}
