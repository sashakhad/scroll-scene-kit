export type ExperienceMode = "video" | "still"

export type ModeSignals = {
  reducedMotion: boolean
  saveData: boolean
  effectiveType: string | null
}

export function chooseMode(signals: ModeSignals): ExperienceMode {
  if (signals.reducedMotion) return "still"
  if (signals.saveData) return "still"
  if (signals.effectiveType === "slow-2g" || signals.effectiveType === "2g") return "still"
  return "video"
}

type ConnectionLike = {
  saveData?: boolean
  effectiveType?: string
}

function readConnection(nav: Navigator): ConnectionLike | null {
  const withConnection = nav as Navigator & { connection?: ConnectionLike }
  const connection = withConnection.connection
  if (typeof connection !== "object" || connection === null) return null
  return connection
}

export function readSignals(): ModeSignals {
  const connection = readConnection(navigator)
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
  let effectiveType: string | null = null
  if (connection && typeof connection.effectiveType === "string") {
    effectiveType = connection.effectiveType
  }
  return {
    reducedMotion: reduced,
    saveData: connection?.saveData === true,
    effectiveType,
  }
}

export function isNarrowViewport(): boolean {
  return window.matchMedia("(max-width: 760px)").matches
}
