export type SoundController = {
  setScene(id: string, cue: string | undefined): void
}

export function createSound(
  button: HTMLButtonElement,
  ambientSrc: string | undefined,
): SoundController {
  let enabled = false
  let ambient: HTMLAudioElement | null = null
  let cueAudio: HTMLAudioElement | null = null
  let lastScene = ""
  const label = button.querySelector("[data-sound-label]")

  function render(): void {
    button.setAttribute("aria-pressed", enabled ? "true" : "false")
    button.setAttribute("aria-label", enabled ? "Mute ambient sound" : "Play ambient sound")
    button.classList.toggle("is-on", enabled)
    if (label) label.textContent = enabled ? "Sound on" : "Sound off"
  }

  function ensureAmbient(): HTMLAudioElement | null {
    if (!ambientSrc) return null
    if (!ambient) {
      ambient = new Audio(ambientSrc)
      ambient.loop = true
      ambient.volume = 0.35
      ambient.preload = "none"
    }
    return ambient
  }

  button.addEventListener("click", function toggleSound(): void {
    enabled = !enabled
    render()
    const pad = ensureAmbient()
    if (!pad) return
    if (enabled) {
      const pending = pad.play()
      if (pending !== undefined) {
        void pending.catch(function playbackFailed(): void {
          enabled = false
          render()
        })
      }
    } else {
      pad.pause()
      if (cueAudio) cueAudio.pause()
    }
  })

  render()

  return {
    setScene(id: string, cue: string | undefined): void {
      if (id === lastScene) return
      lastScene = id
      if (!enabled || !cue) return
      if (cueAudio) cueAudio.pause()
      cueAudio = new Audio(cue)
      cueAudio.volume = 0.55
      const pending = cueAudio.play()
      if (pending !== undefined) {
        void pending.catch(function ignoreCueError(): void {
          // A missed cue should not turn the pad off.
        })
      }
    },
  }
}
